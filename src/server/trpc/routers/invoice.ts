import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
  userProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { invoices, users, companies, invoiceEditHistory, saldoTransactions, budgetRequests, advances } from "@/server/db/schema";
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
        invoiceNumber: z.string().min(1, "Numer faktury jest wymagany"),
        ksefNumber: z.string().optional(),
        kwota: z.number().positive("Kwota musi być większa od zera").optional(),
        companyId: z.string().uuid("Firma jest wymagana"),
        justification: z.string().min(10, "Uzasadnienie musi zawierać minimum 10 znaków"),
        budgetRequestId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć faktury w bazie danych",
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
          invoiceNumber: invoices.invoiceNumber,
          ksefNumber: invoices.ksefNumber,
          kwota: invoices.kwota,
          description: invoices.description,
          justification: invoices.justification,
          imageKey: invoices.imageKey,
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
          invoiceNumber: invoices.invoiceNumber,
          ksefNumber: invoices.ksefNumber,
          kwota: invoices.kwota,
          description: invoices.description,
          justification: invoices.justification,
          imageKey: invoices.imageKey,
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
        .where(or(eq(invoices.status, "accepted"), eq(invoices.status, "rejected"), eq(invoices.status, "re_review")))
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
      if ((ctx.user.role === "accountant" || ctx.user.role === "admin") && invoice.status === "pending" && (input.claimReview ?? true)) {
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

      // Get presigned URL for image
      const imageUrl = await getPresignedUrl(invoice.imageKey);

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
        ...invoice,
        imageUrl,
        submitter,
        company,
        currentReviewer,
        reviewer,
        lastEditor,
        editHistory,
        budgetRequest,
          advance,
        // Add flag to indicate if current user is the reviewer
        isCurrentUserReviewing: invoice.currentReviewer === ctx.user.id,
      };
    }),

  // Update invoice data during review
  updateInvoiceData: accountantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        invoiceNumber: z.string().optional(),
        description: z.string().optional(),
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
        rejectionReason: z.string().min(1, "Dekretacja jest wymagana"),
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

  // Request re-review (accountant can request admin to review again)
  requestReReview: accountantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Powód jest wymagany"),
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

      // Can only request re-review on accepted or rejected invoices
      if (invoice.status !== "accepted" && invoice.status !== "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Można poprosić o edycję tylko zaakceptowanych lub odrzuconych faktur",
        });
      }

      // Check if the accountant reviewed this invoice
      if (invoice.reviewedBy !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Możesz poprosić o edycję tylko faktur, które sam rozpatrzyłeś",
        });
      }

      // Update status to re_review with conflict prevention
      const [updated] = await db
        .update(invoices)
        .set({
          status: "re_review",
          rejectionReason: input.reason, // Store the reason for re-review
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, input.id),
            or(eq(invoices.status, "accepted"), eq(invoices.status, "rejected")) // Only allow if still in final state
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Status faktury został już zmieniony",
        });
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
});
