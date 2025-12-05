import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
  userProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { invoices, users, companies, invoiceEditHistory } from "@/server/db/schema";
import { eq, desc, and, ne, or, isNull, lt } from "drizzle-orm";
import { uploadFile, getPresignedUrl, deleteFile } from "@/server/storage/minio";
import { compressImage, dataUrlToBuffer } from "@/server/storage/image-processor";

export const invoiceRouter = createTRPCRouter({
  // Create new invoice (user and admin)
  create: protectedProcedure
    .input(
      z.object({
        imageDataUrl: z.string().min(1, "Zdjęcie jest wymagane"),
        invoiceNumber: z.string().min(1, "Numer faktury jest wymagany"),
        ksefNumber: z.string().optional(),
        companyId: z.string().uuid("Firma jest wymagana"),
        justification: z.string().min(10, "Uzasadnienie musi zawierać minimum 10 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Convert data URL to buffer
      const originalBuffer = dataUrlToBuffer(input.imageDataUrl);
      
      // Compress image to 80% JPEG quality
      const compressedBuffer = await compressImage(originalBuffer);

      // Generate unique object key
      const timestamp = Date.now();
      const objectKey = `${ctx.user.id}/${timestamp}.jpg`;

      // Upload compressed image to MinIO
      await uploadFile(compressedBuffer, objectKey, "image/jpeg");

      // Create invoice record
      const [invoice] = await db
        .insert(invoices)
        .values({
          userId: ctx.user.id,
          companyId: input.companyId,
          imageKey: objectKey,
          invoiceNumber: input.invoiceNumber,
          ksefNumber: input.ksefNumber || null,
          justification: input.justification,
          status: "pending",
        })
        .returning();

      if (!invoice) {
        await deleteFile(objectKey);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć faktury",
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
      })
      .from(invoices)
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(eq(invoices.userId, ctx.user.id))
      .orderBy(desc(invoices.createdAt));

    return result;
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

      // First, release stale reviews (no ping in last 10 seconds)
      const staleThreshold = new Date(Date.now() - 10000); // 10 seconds
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
        .where(or(eq(invoices.status, "pending"), eq(invoices.status, "in_review")))
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

      return {
        items: enriched,
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get only in_review invoices (for fast polling)
  inReviewInvoices: accountantProcedure.query(async () => {
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

      const result = await db
        .select()
        .from(invoices)
        .where(or(eq(invoices.status, "accepted"), eq(invoices.status, "rejected")))
        .orderBy(desc(invoices.reviewedAt))
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

          return {
            ...invoice,
            userName: submitter?.name || "",
            userEmail: submitter?.email || "",
            companyName: company?.name || "",
            reviewerName: reviewer?.name || null,
          };
        })
      );

      return {
        items: enriched,
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

          return {
            ...invoice,
            userName: submitter?.name || "",
            userEmail: submitter?.email || "",
            companyName: company?.name || "",
            reviewerName: reviewer?.name || null,
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
    .input(z.object({ id: z.string().uuid() }))
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

      // Automatically start review if accountant or admin is viewing and status is pending
      if ((ctx.user.role === "accountant" || ctx.user.role === "admin") && invoice.status === "pending") {
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

      return {
        ...invoice,
        imageUrl,
        submitter,
        company,
        currentReviewer,
        reviewer,
        lastEditor,
        editHistory,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, invoiceNumber, description } = input;

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

      if (!hasInvoiceNumberChange && !hasDescriptionChange) {
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
        rejectionReason: z.string().optional(),
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

      // Validate rejection reason
      if (input.status === "rejected" && !input.rejectionReason) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Powód odrzucenia jest wymagany",
        });
      }

      const [updated] = await db
        .update(invoices)
        .set({
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.status === "rejected" ? input.rejectionReason : null,
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

      return {
        success: true,
        invoice: updated,
      };
    }),
});
