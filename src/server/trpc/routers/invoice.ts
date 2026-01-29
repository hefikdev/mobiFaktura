import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
  userProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { invoices, users, companies, invoiceEditHistory, invoiceActionLogs, saldoTransactions, budgetRequests, advances } from "@/server/db/schema";
import { eq, desc, and, ne, or, isNull, lt, isNotNull, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { uploadFile, getPresignedUrl, deleteFile } from "@/server/storage/minio";
import { compressImage, dataUrlToBuffer } from "@/server/storage/image-processor";
import { hasCompanyPermission, getUserCompanyIds } from "@/server/permissions";

export const invoiceRouter = createTRPCRouter({
  // Create new invoice (user and admin)
  create: protectedProcedure
    .input(
      z.object({
        imageDataUrl: z.string().min(1, "Zdjęcie jest wymagane"),
        invoiceNumber: z.string().min(1, "Numer faktury jest wymagany").max(100, "Numer faktury nie może przekraczać 100 znaków"),
        invoiceType: z.enum(["einvoice", "receipt"]).default("einvoice"),
        ksefNumber: z.string().max(100, "Numer KSeF nie może przekraczać 100 znaków").optional(),
        kwota: z.number().positive("Kwota musi być większa od zera").optional(),
        companyId: z.string().uuid("Firma jest wymagana"),
        justification: z.string().min(10, "Uzasadnienie musi zawierać minimum 10 znaków").max(2000, "Uzasadnienie nie może przekraczać 2000 znaków"),
        budgetRequestId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate: receipt should not have ksefNumber
      if (input.invoiceType === "receipt" && input.ksefNumber) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paragon nie może mieć numeru KSeF",
        });
      }

      // Check if user has permission to create invoices for this company
      const canAccess = await hasCompanyPermission(ctx.user.id, input.companyId);
      if (!canAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nie masz uprawnień do tworzenia faktur dla tej firmy",
        });
      }

      // Validate budget request if provided
      if (input.budgetRequestId) {
        const [budgetRequest] = await db
          .select({ status: budgetRequests.status, companyId: budgetRequests.companyId })
          .from(budgetRequests)
          .where(eq(budgetRequests.id, input.budgetRequestId))
          .limit(1);

        if (!budgetRequest) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Prośba o zwiększenie budżetu nie została znaleziona",
          });
        }

        if (budgetRequest.status === "rejected") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nie można powiązać faktury z odrzuconą prośbą o zwiększenie budżetu",
          });
        }

        if (budgetRequest.companyId !== input.companyId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Faktura i prośba o zwiększenie budżetu muszą dotyczyć tej samej firmy",
          });
        }
      }

      // Verify company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, input.companyId))
        .limit(1);

      if (!company || !company.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Wybrana firma nie istnieje lub jest nieaktywna",
        });
      }

      // Convert data URL to buffer with validation
      let originalBuffer: Buffer;
      try {
        originalBuffer = dataUrlToBuffer(input.imageDataUrl);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Nieprawidłowy format pliku",
        });
      }
      
      // Compress image to 80% JPEG quality with validation
      let compressedBuffer: Buffer;
      try {
        compressedBuffer = await compressImage(originalBuffer);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Nie udało się przetworzyć obrazu",
        });
      }

      // Generate unique object key
      const timestamp = Date.now();
      const objectKey = `${ctx.user.id}/${timestamp}.jpg`;

      // Upload compressed image to MinIO first
      let minioUploadSuccess = false;
      try {
        await uploadFile(compressedBuffer, objectKey, "image/jpeg");
        minioUploadSuccess = true;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się przesłać pliku do systemu przechowywania",
        });
      }

      // Find latest accepted advance (transferred)
      const [latestAdvance] = await db
        .select({ id: advances.id })
        .from(advances)
        .where(
            and(
                eq(advances.userId, ctx.user.id),
                eq(advances.status, "transferred")
            )
        )
        .orderBy(desc(advances.transferDate), desc(advances.createdAt))
        .limit(1);

      // Create invoice record in database
      let invoice: typeof invoices.$inferSelect | undefined;
      try {
        // Use transaction to create invoice and update saldo atomically
        await db.transaction(async (tx) => {
          // Create the invoice
          const [createdInvoice] = await tx
            .insert(invoices)
            .values({
              userId: ctx.user.id,
              companyId: input.companyId,
              invoiceType: input.invoiceType,
              imageKey: objectKey,
              invoiceNumber: input.invoiceNumber,
              ksefNumber: input.ksefNumber || null,
              kwota: input.kwota?.toString() || null,
              justification: input.justification,
              budgetRequestId: input.budgetRequestId || null,
              advanceId: latestAdvance?.id || null,
              status: "pending",
            })
            .returning();
          
          if (!createdInvoice) {
            throw new Error("Failed to create invoice");
          }
          
          invoice = createdInvoice;

          // Deduct saldo if kwota is provided
          if (input.kwota && input.kwota > 0) {
            // Get current user saldo with timestamp for optimistic locking
            const [currentUser] = await tx
              .select({ saldo: users.saldo, updatedAt: users.updatedAt })
              .from(users)
              .where(eq(users.id, ctx.user.id))
              .limit(1);

            if (!currentUser) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Użytkownik nie został znaleziony",
              });
            }

            const balanceBefore = currentUser.saldo ? parseFloat(currentUser.saldo) : 0;
            const balanceAfter = balanceBefore - input.kwota;
            const lastUpdatedAt = currentUser.updatedAt;

            // Update user saldo with optimistic locking
            const saldoUpdateResult = await tx
              .update(users)
              .set({ 
                saldo: balanceAfter.toFixed(2),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(users.id, ctx.user.id),
                  eq(users.updatedAt, lastUpdatedAt) // Optimistic lock
                )
              )
              .returning({ id: users.id });

            if (!saldoUpdateResult || saldoUpdateResult.length === 0) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Saldo zostało zmodyfikowane podczas przetwarzania faktury. Spróbuj ponownie.",
              });
            }

            // Create saldo transaction record
            await tx.insert(saldoTransactions).values({
              userId: ctx.user.id,
              amount: (-input.kwota).toFixed(2),
              balanceBefore: balanceBefore.toFixed(2),
              balanceAfter: balanceAfter.toFixed(2),
              transactionType: "invoice_deduction",
              referenceId: createdInvoice.id,
              notes: `Odliczenie za fakturę ${input.invoiceNumber}`,
              createdBy: ctx.user.id,
            });
          }
        });
      } catch (error) {
        // Rollback: Delete file from MinIO if database insert fails
        if (minioUploadSuccess) {
          try {
            await deleteFile(objectKey);
          } catch (deleteError) {
            // Log but don't throw - original error is more important
            console.error("Failed to rollback MinIO file after DB error:", deleteError);
          }
        }
        
        // Log the original error for debugging
        console.error("Failed to create invoice in database:", error);
        
        // Re-throw TRPCErrors as-is (e.g., CONFLICT from optimistic locking)
        if (error instanceof TRPCError) {
          throw error;
        }
        
        // For other errors, provide more context
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Nie udało się utworzyć faktury w bazie danych: ${errorMessage}`,
        });
      }

      // Verify both operations succeeded
      if (!invoice || !minioUploadSuccess) {
        // This should never happen due to earlier checks, but added for safety
        if (minioUploadSuccess) {
          await deleteFile(objectKey);
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć faktury - błąd synchronizacji",
        });
      }

      return {
        success: true,
        invoice: {
          id: invoice.id,
          status: invoice.status,
        },
      };
    }),

  // Get user's invoices (for user dashboard)
  // Get user's own invoices (user only)
  myInvoices: userProcedure.query(async ({ ctx }) => {
    // Get companies the user has access to
    const allowedCompanyIds = await getUserCompanyIds(ctx.user.id);

    // If user has no permissions, return empty array
    if (allowedCompanyIds.length === 0) {
      return [];
    }

    const result = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        description: invoices.description,
        status: invoices.status,
        createdAt: invoices.createdAt,
        reviewedAt: invoices.reviewedAt,
        imageKey: invoices.imageKey,
        companyId: invoices.companyId,
        companyName: companies.name,
        budgetRequestId: invoices.budgetRequestId,
      })
      .from(invoices)
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(
        and(
          eq(invoices.userId, ctx.user.id),
          // Filter by allowed companies using inArray
          allowedCompanyIds.length > 0 
            ? inArray(invoices.companyId, allowedCompanyIds)
            : sql`false`
        )
      )
      .orderBy(desc(invoices.createdAt));

    // Enrich with budget request info
    const enriched = await Promise.all(
      result.map(async (invoice) => {
        let budgetRequest = null;
        if (invoice.budgetRequestId) {
          const [br] = await db
            .select({
              id: budgetRequests.id,
              requestedAmount: budgetRequests.requestedAmount,
              status: budgetRequests.status,
            })
            .from(budgetRequests)
            .where(eq(budgetRequests.id, invoice.budgetRequestId))
            .limit(1);
          
          if (br) {
            budgetRequest = {
              id: br.id,
              requestedAmount: br.requestedAmount ? parseFloat(br.requestedAmount) : 0,
              status: br.status,
            };
          }
        }

        return {
          ...invoice,
          budgetRequest,
        };
      })
    );

    return enriched;
  }),

  // Get all pending/in_review invoices (for accountant)
  pendingInvoices: accountantProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;

      // First, release stale reviews (no ping in last 5 seconds)
      const staleThreshold = new Date(Date.now() - 5000); // 5 seconds
      await db
        .update(invoices)
        .set({
          status: "pending",
          currentReviewer: null,
          reviewStartedAt: null,
          lastReviewPing: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.status, "in_review"),
            or(
              isNull(invoices.lastReviewPing),
              lt(invoices.lastReviewPing, staleThreshold)
            )
          )
        );

      const reviewer = alias(users, 'reviewer');

      const result = await db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          companyId: invoices.companyId,
          invoiceType: invoices.invoiceType,
          invoiceNumber: invoices.invoiceNumber,
          ksefNumber: invoices.ksefNumber,
          kwota: invoices.kwota,
          description: invoices.description,
          justification: invoices.justification,
          imageKey: invoices.imageKey,
          originalInvoiceId: invoices.originalInvoiceId,
          correctionAmount: invoices.correctionAmount,
          status: invoices.status,
          reviewedBy: invoices.reviewedBy,
          reviewedAt: invoices.reviewedAt,
          rejectionReason: invoices.rejectionReason,
          currentReviewer: invoices.currentReviewer,
          reviewStartedAt: invoices.reviewStartedAt,
          lastReviewPing: invoices.lastReviewPing,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          userName: users.name,
          userEmail: users.email,
          companyName: companies.name,
          currentReviewerName: reviewer.name,
        })
        .from(invoices)
        .leftJoin(users, eq(invoices.userId, users.id))
        .leftJoin(companies, eq(invoices.companyId, companies.id))
        .leftJoin(reviewer, eq(invoices.currentReviewer, reviewer.id))
        .where(or(eq(invoices.status, "pending"), eq(invoices.status, "in_review")))
        .orderBy(desc(invoices.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map(item => ({
          ...item,
          userName: item.userName || "",
          userEmail: item.userEmail || "",
          companyName: item.companyName || "",
          currentReviewerName: item.currentReviewerName || null,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get only in_review invoices (for fast polling)
  inReviewInvoices: accountantProcedure.query(async () => {
    // Release stale reviews (no ping in last 5 seconds) to avoid stuck in_review statuses
    const staleThreshold = new Date(Date.now() - 5000); // 5 seconds
    await db
      .update(invoices)
      .set({
        status: "pending",
        currentReviewer: null,
        reviewStartedAt: null,
        lastReviewPing: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(invoices.status, "in_review"),
          or(
            isNull(invoices.lastReviewPing),
            lt(invoices.lastReviewPing, staleThreshold)
          )
        )
      );

    const result = await db
      .select()
      .from(invoices)
      .where(eq(invoices.status, "in_review"))
      .orderBy(desc(invoices.createdAt));

    // Fetch related user and company data
    const enriched = await Promise.all(
      result.map(async (invoice) => {
        const [submitter] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, invoice.userId))
          .limit(1);

        const [company] = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, invoice.companyId))
          .limit(1);

        let currentReviewer = null;
        if (invoice.currentReviewer) {
          const [reviewer] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, invoice.currentReviewer))
            .limit(1);
          currentReviewer = reviewer;
        }

        return {
          ...invoice,
          userName: submitter?.name || "",
          userEmail: submitter?.email || "",
          companyName: company?.name || "",
          currentReviewerName: currentReviewer?.name || null,
        };
      })
    );

    return enriched;
  }),

  // Get reviewed invoices (for accountant)
  reviewedInvoices: accountantProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().min(1).max(100).default(10),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 10;
      const cursor = input?.cursor || 0;

      const reviewer = alias(users, 'reviewer');

      const result = await db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          companyId: invoices.companyId,
          invoiceType: invoices.invoiceType,
          invoiceNumber: invoices.invoiceNumber,
          ksefNumber: invoices.ksefNumber,
          kwota: invoices.kwota,
          description: invoices.description,
          justification: invoices.justification,
          imageKey: invoices.imageKey,
          originalInvoiceId: invoices.originalInvoiceId,
          correctionAmount: invoices.correctionAmount,
          status: invoices.status,
          reviewedBy: invoices.reviewedBy,
          reviewedAt: invoices.reviewedAt,
          rejectionReason: invoices.rejectionReason,
          currentReviewer: invoices.currentReviewer,
          reviewStartedAt: invoices.reviewStartedAt,
          lastReviewPing: invoices.lastReviewPing,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          userName: users.name,
          userEmail: users.email,
          companyName: companies.name,
          reviewerName: reviewer.name,
        })
        .from(invoices)
        .leftJoin(users, eq(invoices.userId, users.id))
        .leftJoin(companies, eq(invoices.companyId, companies.id))
        .leftJoin(reviewer, eq(invoices.reviewedBy, reviewer.id))
        .where(or(eq(invoices.status, "accepted"), eq(invoices.status, "rejected")))
        .orderBy(desc(invoices.updatedAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map(item => ({
          ...item,
          userName: item.userName || "",
          userEmail: item.userEmail || "",
          companyName: item.companyName || "",
          reviewerName: item.reviewerName || null,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get all invoices (for accountant and admin - invoices page)
  getAllInvoices: accountantProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().min(1).max(200).default(100),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const cursor = input?.cursor || 0;

      const result = await db
        .select()
        .from(invoices)
        .orderBy(desc(invoices.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      // Fetch related user and company data
      const enriched = await Promise.all(
        items.map(async (invoice) => {
          const [submitter] = await db
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, invoice.userId))
            .limit(1);

          const [company] = await db
            .select({ name: companies.name })
            .from(companies)
            .where(eq(companies.id, invoice.companyId))
            .limit(1);

          let reviewer = null;
          if (invoice.reviewedBy) {
            const [rev] = await db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, invoice.reviewedBy))
              .limit(1);
            reviewer = rev;
          }

          // Get linked budget request info
          let budgetRequest = null;
          if (invoice.budgetRequestId) {
            const [br] = await db
              .select({
                id: budgetRequests.id,
                requestedAmount: budgetRequests.requestedAmount,
                status: budgetRequests.status,
              })
              .from(budgetRequests)
              .where(eq(budgetRequests.id, invoice.budgetRequestId))
              .limit(1);
            
            if (br) {
              budgetRequest = {
                id: br.id,
                requestedAmount: br.requestedAmount ? parseFloat(br.requestedAmount) : 0,
                status: br.status,
              };
            }
          }

          return {
            ...invoice,
            userId: invoice.userId,
            userName: submitter?.name || "",
            userEmail: submitter?.email || "",
            companyName: company?.name || "",
            reviewerName: reviewer?.name || null,
            budgetRequest,
          };
        })
      );

      return {
        items: enriched,
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get single invoice with full details
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid(), claimReview: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Faktura nie została znaleziona",
        });
      }

      // Check access - user can only see their own invoices, accountant and admin can see all
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin" && invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak dostępu do tej faktury",
        });
      }

      // Check if user has permission for this invoice's company
      const canAccess = await hasCompanyPermission(ctx.user.id, invoice.companyId);
      if (!canAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nie masz uprawnień do przeglądania faktur tej firmy",
        });
      }

      // Automatically start review if accountant or admin is viewing and status is pending
      // Only claim review when claimReview is not explicitly false
      // Don't auto-claim review for correction invoices
      if ((ctx.user.role === "accountant" || ctx.user.role === "admin") && invoice.status === "pending" && invoice.invoiceType !== "correction" && (input.claimReview ?? true)) {
        await db
          .update(invoices)
          .set({
            status: "in_review",
            currentReviewer: ctx.user.id,
            reviewStartedAt: new Date(),
            lastReviewPing: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, input.id));
        
        // Refetch the updated invoice
        const [updatedInvoice] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, input.id))
          .limit(1);
        
        if (updatedInvoice) {
          invoice.status = updatedInvoice.status;
          invoice.currentReviewer = updatedInvoice.currentReviewer;
          invoice.reviewStartedAt = updatedInvoice.reviewStartedAt;
        }
      }

      // Also release any stale in_review entries (no ping in last 5 seconds) proactively
      const staleThresholdAll = new Date(Date.now() - 5000); // 5 seconds
      await db
        .update(invoices)
        .set({
          status: "pending",
          currentReviewer: null,
          reviewStartedAt: null,
          lastReviewPing: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.status, "in_review"),
            or(
              isNull(invoices.lastReviewPing),
              lt(invoices.lastReviewPing, staleThresholdAll)
            )
          )
        );

      // Get presigned URL for image (may be missing for corrections)
      let imageUrl: string | null = null;
      try {
        imageUrl = await getPresignedUrl(invoice.imageKey);
      } catch {
        imageUrl = null;
      }

      // Get submitter details
      const [submitter] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, invoice.userId))
        .limit(1);

      // Get company details
      const [company] = await db
        .select({ name: companies.name, nip: companies.nip, address: companies.address })
        .from(companies)
        .where(eq(companies.id, invoice.companyId))
        .limit(1);

      // Get current reviewer details if exists
      let currentReviewer = null;
      if (invoice.currentReviewer) {
        const [reviewer] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invoice.currentReviewer))
          .limit(1);
        currentReviewer = reviewer;
      }

      // Get reviewer details if reviewed
      let reviewer = null;
      if (invoice.reviewedBy) {
        const [rev] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invoice.reviewedBy))
          .limit(1);
        reviewer = rev;
      }

      // Get last editor details if exists
      let lastEditor = null;
      if (invoice.lastEditedBy) {
        const [editor] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invoice.lastEditedBy))
          .limit(1);
        lastEditor = editor;
      }

      // Get settled by user details if exists
      let settledByUser = null;
      if (invoice.settledBy) {
        const [settled] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, invoice.settledBy))
          .limit(1);
        settledByUser = settled;
      }

      // Get edit history
      const editHistoryRecords = await db
        .select({
          id: invoiceEditHistory.id,
          editedAt: invoiceEditHistory.editedAt,
          editorId: invoiceEditHistory.editedBy,
          editorName: users.name,
        })
        .from(invoiceEditHistory)
        .leftJoin(users, eq(invoiceEditHistory.editedBy, users.id))
        .where(eq(invoiceEditHistory.invoiceId, input.id))
        .orderBy(desc(invoiceEditHistory.editedAt));

      const editHistory = editHistoryRecords.map(record => ({
        editedAt: record.editedAt,
        editor: {
          name: record.editorName || "Nieznany",
        },
      }));

      // Get linked budget request details if exists
      let budgetRequest: {
        id: string;
        requestedAmount: number;
        status: string;
        createdAt: Date;
        reviewedAt: Date | null;
        userName: string | null;
        companyId: string;
        companyName: string | null;
        relatedInvoices?: Array<{
          id: string;
          invoiceNumber: string | null;
          kwota: number | null;
          status: string;
          createdAt: Date;
        }>;
      } | null = null;
      if (invoice.budgetRequestId) {
        const [br] = await db
          .select({
            id: budgetRequests.id,
            requestedAmount: budgetRequests.requestedAmount,
            status: budgetRequests.status,
            createdAt: budgetRequests.createdAt,
            reviewedAt: budgetRequests.reviewedAt,
            userName: users.name,
            companyId: budgetRequests.companyId,
            companyName: companies.name,
          })
          .from(budgetRequests)
          .leftJoin(users, eq(budgetRequests.userId, users.id))
          .leftJoin(companies, eq(budgetRequests.companyId, companies.id))
          .where(eq(budgetRequests.id, invoice.budgetRequestId))
          .limit(1);
        
        if (br) {
          budgetRequest = {
            ...br,
            requestedAmount: br.requestedAmount ? parseFloat(br.requestedAmount) : 0,
          };
          
          // Get all other invoices linked to this budget request
          const relatedInvoices = await db
            .select({
              id: invoices.id,
              invoiceNumber: invoices.invoiceNumber,
              kwota: invoices.kwota,
              status: invoices.status,
              createdAt: invoices.createdAt,
            })
            .from(invoices)
            .where(
              and(
                eq(invoices.budgetRequestId, invoice.budgetRequestId),
                ne(invoices.id, invoice.id) // Exclude current invoice
              )
            )
            .orderBy(desc(invoices.createdAt));
          
          budgetRequest.relatedInvoices = relatedInvoices.map(inv => ({
            ...inv,
            kwota: inv.kwota ? parseFloat(inv.kwota) : null,
          }));
        }
      }

        let advance = null;
        if (invoice.advanceId) {
          const [adv] = await db
            .select({
              id: advances.id,
              amount: advances.amount,
              status: advances.status,
              createdAt: advances.createdAt,
              transferDate: advances.transferDate,
            })
            .from(advances)
            .where(eq(advances.id, invoice.advanceId))
            .limit(1);

          if (adv) {
            advance = {
              ...adv,
              amount: parseFloat(adv.amount),
            };
          }
        }

      return {
        id: invoice.id,
        userId: invoice.userId,
        companyId: invoice.companyId,
        invoiceType: invoice.invoiceType,
        imageKey: invoice.imageKey,
        invoiceNumber: invoice.invoiceNumber,
        ksefNumber: invoice.ksefNumber,
        kwota: invoice.kwota,
        description: invoice.description,
        justification: invoice.justification,
        originalInvoiceId: invoice.originalInvoiceId,
        correctionAmount: invoice.correctionAmount,
        status: invoice.status,
        reviewedBy: invoice.reviewedBy,
        reviewedAt: invoice.reviewedAt,
        rejectionReason: invoice.rejectionReason,
        reviewStartedAt: invoice.reviewStartedAt,
        lastReviewPing: invoice.lastReviewPing,
        transferredBy: invoice.transferredBy,
        transferredAt: invoice.transferredAt,
        settledBy: invoice.settledBy,
        settledAt: invoice.settledAt,
        budgetRequestId: invoice.budgetRequestId,
        advanceId: invoice.advanceId,
        lastEditedBy: invoice.lastEditedBy,
        lastEditedAt: invoice.lastEditedAt,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        imageUrl,
        submitter,
        company,
        currentReviewer,
        reviewer,
        lastEditor,
        settledByUser,
        editHistory,
        budgetRequest,
        advance,
        isCurrentUserReviewing: invoice.currentReviewer === ctx.user.id,
      };
    }),

  // Update invoice data during review
  updateInvoiceData: accountantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        invoiceNumber: z.string().max(100, "Numer faktury nie może przekraczać 100 znaków").optional(),
        description: z.string().max(2000, "Opis nie może przekraczać 2000 znaków").optional(),
        kwota: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, invoiceNumber, description, kwota } = input;

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Faktura nie została znaleziona",
        });
      }

      // Transaction safety: Can only edit if invoice is in_review
      if (invoice.status !== "in_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Możesz edytować tylko faktury w trakcie przeglądu",
        });
      }

      if (invoice.currentReviewer !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nie możesz edytować tej faktury",
        });
      }

      // Check if there are actual changes
      const hasInvoiceNumberChange = invoiceNumber !== undefined && invoiceNumber !== invoice.invoiceNumber;
      const hasDescriptionChange = description !== undefined && description !== invoice.description;
      const hasKwotaChange = kwota !== undefined && kwota !== invoice.kwota;

      if (!hasInvoiceNumberChange && !hasDescriptionChange && !hasKwotaChange) {
        // No changes, return without saving
        return { success: true, noChanges: true };
      }

      // Prepare update data
      const updateData: {
        lastEditedBy: string;
        lastEditedAt: Date;
        updatedAt: Date;
        invoiceNumber?: string;
        description?: string;
        kwota?: string;
      } = {
        lastEditedBy: ctx.user.id,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      };

      if (hasInvoiceNumberChange) {
        updateData.invoiceNumber = invoiceNumber;
      }
      if (hasDescriptionChange) {
        updateData.description = description;
      }
      if (hasKwotaChange) {
        updateData.kwota = kwota;
      }

      // Update invoice with transaction safety
      const [updated] = await db
        .update(invoices)
        .set(updateData)
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.status, "in_review"),
            eq(invoices.currentReviewer, ctx.user.id)
          )
        )
        .returning();

      // Verify update was successful
      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Faktura nie może być edytowana - zmienił się jej status",
        });
      }

      // Log to edit history
      await db.insert(invoiceEditHistory).values({
        invoiceId: id,
        editedBy: ctx.user.id,
        previousInvoiceNumber: hasInvoiceNumberChange ? invoice.invoiceNumber : null,
        newInvoiceNumber: hasInvoiceNumberChange ? invoiceNumber : null,
        previousDescription: hasDescriptionChange ? invoice.description : null,
        newDescription: hasDescriptionChange ? description : null,
      });

      return { success: true };
    }),

  // Release review (when leaving page)
  releaseReview: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);

      if (!invoice) {
        return { success: false };
      }

      // Only release if this accountant is the current reviewer and status is in_review
      if (invoice.currentReviewer === ctx.user.id && invoice.status === "in_review") {
        await db
          .update(invoices)
          .set({
            status: "pending",
            currentReviewer: null,
            reviewStartedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, input.id));
      }

      return { success: true };
    }),

  // Heartbeat to indicate accountant is still viewing
  reviewHeartbeat: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);

      if (!invoice) {
        return { success: false };
      }

      // Only update ping if this accountant is the current reviewer and status is in_review
      if (invoice.currentReviewer === ctx.user.id && invoice.status === "in_review") {
        await db
          .update(invoices)
          .set({
            lastReviewPing: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, input.id));
        
        return { success: true };
      }

      return { success: false };
    }),

  // Finalize review (accept/reject)
  finalizeReview: accountantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["accepted", "rejected"]),
        rejectionReason: z.string().min(1, "Dekretacja jest wymagana").max(2000, "Powód odrzucenia nie może przekraczać 2000 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Faktura nie została znaleziona",
        });
      }

      // Transaction safety: Check if invoice is already finalized
      if (invoice.status === "accepted" || invoice.status === "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ta faktura została już rozpatrzona",
        });
      }

      // Verify the invoice is in_review status
      if (invoice.status !== "in_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Faktura musi być w trakcie przeglądu",
        });
      }

      if (invoice.currentReviewer !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nie możesz zakończyć przeglądu tej faktury",
        });
      }

      const [updated] = await db
        .update(invoices)
        .set({
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason,
          currentReviewer: null,
          lastReviewPing: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, input.id),
            // Additional safety: only update if still in_review and current reviewer matches
            eq(invoices.status, "in_review"),
            eq(invoices.currentReviewer, ctx.user.id)
          )
        )
        .returning();

      // Verify the update was successful
      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Faktura została już rozpatrzona przez innego księgowego",
        });
      }

      // Check for auto-settlement if linked to a settled advance
      if (input.status === "accepted" && updated.advanceId) {
         const [advance] = await db
           .select({ status: advances.status })
           .from(advances)
           .where(eq(advances.id, updated.advanceId))
           .limit(1);
         
         if (advance && advance.status === "settled") {
            await db
              .update(invoices)
              .set({ 
                status: "settled", 
                settledAt: new Date(), 
                settledBy: ctx.user.id,
                updatedAt: new Date(),
              })
              .where(eq(invoices.id, updated.id));
         }
      }

      return {
        success: true,
        invoice: updated,
      };
    }),

  // Get duplicate invoices (for conflict detection)
  getDuplicates: accountantProcedure.query(async () => {
    // Find invoices with matching kwota, ksefNumber, and companyId that are accepted
    // Group by these fields and find groups with more than 1 invoice
    const allInvoices = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        userName: users.name,
        userEmail: users.email,
        companyId: invoices.companyId,
        companyName: companies.name,
        invoiceNumber: invoices.invoiceNumber,
        ksefNumber: invoices.ksefNumber,
        kwota: invoices.kwota,
        status: invoices.status,
        createdAt: invoices.createdAt,
        reviewedAt: invoices.reviewedAt,
        reviewedBy: invoices.reviewedBy,
        imageKey: invoices.imageKey,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(
        and(
          eq(invoices.status, "accepted"),
          isNotNull(invoices.ksefNumber),
          isNotNull(invoices.kwota)
        )
      )
      .orderBy(desc(invoices.createdAt));

    // Group by kwota, ksefNumber, and companyId
    const duplicateGroups: Record<string, typeof allInvoices> = {};
    
    for (const invoice of allInvoices) {
      if (!invoice.ksefNumber || !invoice.kwota || !invoice.companyId) continue;
      
      const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
      
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(invoice);
    }

    // Filter out groups with only one invoice
    const duplicates = Object.values(duplicateGroups)
      .filter(group => group.length > 1)
      .map(group => {
        const firstInvoice = group[0];
        if (!firstInvoice) {
          return null;
        }
        return {
          kwota: firstInvoice.kwota,
          ksefNumber: firstInvoice.ksefNumber,
          companyId: firstInvoice.companyId,
          companyName: firstInvoice.companyName,
          invoices: group,
          count: group.length,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      duplicates,
      totalConflicts: duplicates.length,
    };
  }),

  // Delete invoice - users can delete their own, accountants/admins can delete any
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        password: z.string().min(1, "Hasło jest wymagane").max(30, "Hasło nie może przekraczać 30 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user password
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!currentUser || !currentUser.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nie znaleziono użytkownika",
        });
      }

      // Import password verification
      const { verifyPassword } = await import("@/server/auth/password");
      const isValidPassword = await verifyPassword(
        input.password,
        currentUser.passwordHash
      );

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło",
        });
      }

      // Get invoice details
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.id))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Faktura nie została znaleziona",
        });
      }

      // Check permissions: users can only delete their own invoices
      if (ctx.user.role === "user" && invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Możesz usuwać tylko swoje faktury",
        });
      }

      // Users cannot delete transferred or settled invoices
      if (ctx.user.role === "user" && (invoice.status === "transferred" || invoice.status === "settled")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nie możesz usunąć faktury która jest już przelana lub rozliczona",
        });
      }

      // Accountants and admins can delete any invoice - no additional check needed

      try {
        // Perform deletion and saldo refund in a transaction
        await db.transaction(async (tx) => {
          // Refund saldo if invoice has kwota
          if (invoice.kwota && parseFloat(invoice.kwota) > 0) {
            const refundAmount = parseFloat(invoice.kwota);

            // Get current user saldo
            const [invoiceUser] = await tx
              .select({ saldo: users.saldo, updatedAt: users.updatedAt })
              .from(users)
              .where(eq(users.id, invoice.userId))
              .limit(1);

            if (!invoiceUser) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Użytkownik faktury nie został znaleziony",
              });
            }

            const balanceBefore = invoiceUser.saldo ? parseFloat(invoiceUser.saldo) : 0;
            const balanceAfter = balanceBefore + refundAmount;
            const lastUpdatedAt = invoiceUser.updatedAt;

            // Update user saldo with optimistic locking
            const saldoUpdateResult = await tx
              .update(users)
              .set({ 
                saldo: balanceAfter.toFixed(2),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(users.id, invoice.userId),
                  eq(users.updatedAt, lastUpdatedAt)
                )
              )
              .returning({ id: users.id });

            if (!saldoUpdateResult || saldoUpdateResult.length === 0) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "Saldo zostało zmodyfikowane podczas usuwania faktury. Spróbuj ponownie.",
              });
            }

            // Create saldo transaction record for refund
            await tx.insert(saldoTransactions).values({
              userId: invoice.userId,
              amount: refundAmount.toFixed(2),
              balanceBefore: balanceBefore.toFixed(2),
              balanceAfter: balanceAfter.toFixed(2),
              transactionType: "invoice_delete_refund",
              referenceId: invoice.id,
              notes: `Zwrot z usuniętej faktury ${invoice.invoiceNumber}`,
              createdBy: ctx.user.id,
            });
          }

          // 1. Delete from MinIO
          await deleteFile(invoice.imageKey);

          // 2. Delete edit history (cascade should handle this, but being explicit)
          await tx.delete(invoiceEditHistory).where(eq(invoiceEditHistory.invoiceId, input.id));

          // 3. Delete from database (cascade will handle related records)
          await tx.delete(invoices).where(eq(invoices.id, input.id));

          // 4. Verify deletion
          const [stillExists] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, input.id))
            .limit(1);

          if (stillExists) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Nie udało się usunąć faktury z bazy danych",
            });
          }
        });

        return {
          success: true,
          message: "Faktura została pomyślnie usunięta",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Wystąpił błąd podczas usuwania faktury",
        });
      }
    }),

  // Get invoices eligible for correction (accountant/admin only)
  getCorrectableInvoices: accountantProcedure
    .input(
      z.object({
        searchQuery: z.string().max(255, "Zapytanie nie może przekraczać 255 znaków").optional(),
        companyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Build where conditions
      const conditions = [
        eq(invoices.status, "accepted"),
        ne(invoices.invoiceType, "correction"), // Can't correct a correction
      ];

      if (input.companyId) {
        conditions.push(eq(invoices.companyId, input.companyId));
      }

      if (input.searchQuery) {
        // Allow searching by UUID (with or without dashes) as well as invoice number
        const normalizedQuery = input.searchQuery.replace(/[^a-z0-9]/gi, "").toLowerCase();

        conditions.push(
          or(
            // direct text match (keeps existing behaviour)
            sql`${invoices.id}::text ILIKE ${`%${input.searchQuery}%`}`,
            sql`${invoices.invoiceNumber} ILIKE ${`%${input.searchQuery}%`}`,
            // match UUIDs even if user omits dashes: compare regexp_replace(id, '-', '') against normalized query
            sql`regexp_replace(${invoices.id}::text, '-', '', 'g') ILIKE ${`%${normalizedQuery}%`}`
          )!
        );
      }

      const correctableInvoices = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          companyId: invoices.companyId,
          companyName: companies.name,
          userId: invoices.userId,
          userName: users.name,
          kwota: invoices.kwota,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .leftJoin(users, eq(invoices.userId, users.id))
        .leftJoin(companies, eq(invoices.companyId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt))
        .limit(50);

      return correctableInvoices;
    }),

  // Create correction invoice (accountant/admin only)
  createCorrection: accountantProcedure
    .input(
      z.object({
        originalInvoiceId: z.string().uuid("Wybierz oryginalną fakturę"),
        correctionAmount: z.number().positive("Kwota korekty musi być większa od zera"),
        justification: z.string().min(10, "Uzasadnienie musi zawierać minimum 10 znaków").max(2000, "Uzasadnienie nie może przekraczać 2000 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get original invoice
      const [originalInvoice] = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          userId: invoices.userId,
          companyId: invoices.companyId,
          status: invoices.status,
          invoiceType: invoices.invoiceType,
        })
        .from(invoices)
        .where(eq(invoices.id, input.originalInvoiceId))
        .limit(1);

      if (!originalInvoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Oryginalna faktura nie została znaleziona",
        });
      }

      if (originalInvoice.status !== "accepted") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Można korygować tylko zaakceptowane faktury",
        });
      }

      if (originalInvoice.invoiceType === "correction") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nie można korygować faktury korygującej",
        });
      }

      // Create correction invoice in transaction
      let correctionInvoice: typeof invoices.$inferSelect | undefined;
      try {
        await db.transaction(async (tx) => {
          // Generate unique correction invoice number
          const [existingCount] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(invoices)
            .where(
              and(
                eq(invoices.invoiceType, "correction"),
                eq(invoices.originalInvoiceId, originalInvoice.id)
              )
            );
          const correctionIndex = Number(existingCount?.count || 0) + 1;
          const correctionNumber = `${originalInvoice.invoiceNumber}-KOREKTA-${correctionIndex}`;

          // Create correction invoice (no image for corrections)
          const [createdCorrection] = await tx
            .insert(invoices)
            .values({
              userId: originalInvoice.userId,
              companyId: originalInvoice.companyId,
              invoiceType: "correction",
              imageKey: `corrections/placeholder-${Date.now()}.jpg`, // Placeholder since corrections don't have images
              invoiceNumber: correctionNumber,
              originalInvoiceId: originalInvoice.id,
              correctionAmount: input.correctionAmount.toString(),
              justification: input.justification,
              status: "accepted", // Corrections are auto-accepted
              reviewedBy: ctx.user.id,
              reviewedAt: new Date(),
            })
            .returning();

          if (!createdCorrection) {
            throw new Error("Failed to create correction invoice");
          }

          correctionInvoice = createdCorrection;

          // Log correction creation action (audit trail)
          await tx.insert(invoiceActionLogs).values({
            invoiceId: createdCorrection.id,
            action: "correction_created",
            performedBy: ctx.user.id,
          });

          // Update user's saldo (positive adjustment)
          const [currentUser] = await tx
            .select({ saldo: users.saldo })
            .from(users)
            .where(eq(users.id, originalInvoice.userId))
            .limit(1);

          if (!currentUser) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Użytkownik nie został znaleziony",
            });
          }

          const balanceBefore = currentUser.saldo ? parseFloat(currentUser.saldo) : 0;
          const balanceAfter = balanceBefore + input.correctionAmount;

          // Update user saldo
          await tx
            .update(users)
            .set({
              saldo: balanceAfter.toString(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, originalInvoice.userId));

          // Create saldo transaction record
          await tx.insert(saldoTransactions).values({
            userId: originalInvoice.userId,
            amount: input.correctionAmount.toString(),
            balanceBefore: balanceBefore.toString(),
            balanceAfter: balanceAfter.toString(),
            transactionType: "invoice_refund",
            notes: `Korekta faktury ${originalInvoice.invoiceNumber}`,
            referenceId: createdCorrection.id,
            createdBy: ctx.user.id,
          });
        });

        return {
          success: true,
          correctionInvoice,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć faktury korygującej",
        });
      }
    }),

  // Get all correction invoices (accountant/admin only)
  getCorrectionInvoices: accountantProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
        searchQuery: z.string().max(255, "Zapytanie nie może przekraczać 255 znaków").optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(invoices.invoiceType, "correction")];

      if (input.companyId) {
        conditions.push(eq(invoices.companyId, input.companyId));
      }

      if (input.searchQuery) {
        conditions.push(
          or(
            sql`${invoices.id}::text ILIKE ${`%${input.searchQuery}%`}`,
            sql`${invoices.invoiceNumber} ILIKE ${`%${input.searchQuery}%`}`
          )!
        );
      }

      if (input.cursor) {
        conditions.push(lt(invoices.createdAt, 
          sql`(SELECT created_at FROM invoices WHERE id = ${input.cursor})`
        ));
      }

      const reviewer = alias(users, "reviewer");
      const originalInvoiceAlias = alias(invoices, "original_invoice");

      const corrections = await db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          userName: users.name,
          userEmail: users.email,
          companyId: invoices.companyId,
          companyName: companies.name,
          invoiceNumber: invoices.invoiceNumber,
          imageKey: invoices.imageKey,
          originalInvoiceId: invoices.originalInvoiceId,
          originalInvoiceNumber: originalInvoiceAlias.invoiceNumber,
          correctionAmount: invoices.correctionAmount,
          justification: invoices.justification,
          status: invoices.status,
          reviewedBy: invoices.reviewedBy,
          reviewedAt: invoices.reviewedAt,
          reviewerName: reviewer.name,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .leftJoin(users, eq(invoices.userId, users.id))
        .leftJoin(companies, eq(invoices.companyId, companies.id))
        .leftJoin(reviewer, eq(invoices.reviewedBy, reviewer.id))
        .leftJoin(originalInvoiceAlias, eq(invoices.originalInvoiceId, originalInvoiceAlias.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt))
        .limit(input.limit + 1);

      let nextCursor: string | undefined = undefined;
      if (corrections.length > input.limit) {
        const nextItem = corrections.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: corrections,
        nextCursor,
      };
    }),

  // Get corrections for a specific original invoice
  getCorrectionsForInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ input }) => {
      const reviewer = alias(users, "reviewer");
      
      const corrections = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          correctionAmount: invoices.correctionAmount,
          justification: invoices.justification,
          createdAt: invoices.createdAt,
          reviewedAt: invoices.reviewedAt,
          reviewerName: reviewer.name,
        })
        .from(invoices)
        .leftJoin(reviewer, eq(invoices.reviewedBy, reviewer.id))
        .where(
          and(
            eq(invoices.invoiceType, "correction"),
            eq(invoices.originalInvoiceId, input.invoiceId)
          )
        )
        .orderBy(desc(invoices.createdAt));

      return corrections.map(c => ({
        ...c,
        correctionAmount: c.correctionAmount ? parseFloat(c.correctionAmount) : 0,
      }));
    }),
});
