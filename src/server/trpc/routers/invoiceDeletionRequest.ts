import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
  adminProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { invoiceDeletionRequests, invoices, users } from "@/server/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { verifyPassword } from "@/server/auth/password";
import { deleteFile } from "@/server/storage/minio";

const requestDeletionSchema = z.object({
  invoiceId: z.string().uuid("Nieprawidłowy identyfikator faktury"),
  reason: z.string().min(10, "Powód musi zawierać minimum 10 znaków").max(500, "Powód nie może przekraczać 500 znaków"),
});

const reviewDeletionSchema = z.object({
  requestId: z.string().uuid("Nieprawidłowy identyfikator prośby"),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
  adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
});

export const invoiceDeletionRequestRouter = createTRPCRouter({
  // Create deletion request (user or accountant)
  create: protectedProcedure
    .input(requestDeletionSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if invoice exists and belongs to user (for users) or exists (for accountants)
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nie znaleziono faktury",
        });
      }

      // Users can only request deletion of their own invoices
      if (ctx.user.role === "user" && invoice.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Możesz prosić o usunięcie tylko swoich faktur",
        });
      }

      // Check if there's already a pending request for this invoice
      const [existingRequest] = await db
        .select()
        .from(invoiceDeletionRequests)
        .where(
          and(
            eq(invoiceDeletionRequests.invoiceId, input.invoiceId),
            eq(invoiceDeletionRequests.status, "pending")
          )
        )
        .limit(1);

      if (existingRequest) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Prośba o usunięcie tej faktury już istnieje i oczekuje na rozpatrzenie",
        });
      }

      // Create deletion request
      const [newRequest] = await db
        .insert(invoiceDeletionRequests)
        .values({
          invoiceId: input.invoiceId,
          requestedBy: ctx.user.id,
          reason: input.reason,
          status: "pending",
        })
        .returning();

      if (!newRequest) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć prośby o usunięcie",
        });
      }

      return {
        success: true,
        message: "Prośba o usunięcie faktury została wysłana do administratora",
      };
    }),

  // Get all deletion requests (admin only)
  getAll: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input.status !== "all") {
        conditions.push(eq(invoiceDeletionRequests.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const requests = await db
        .select({
          id: invoiceDeletionRequests.id,
          invoiceId: invoiceDeletionRequests.invoiceId,
          reason: invoiceDeletionRequests.reason,
          status: invoiceDeletionRequests.status,
          reviewedAt: invoiceDeletionRequests.reviewedAt,
          rejectionReason: invoiceDeletionRequests.rejectionReason,
          createdAt: invoiceDeletionRequests.createdAt,
          requestedBy: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
          invoice: {
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            description: invoices.description,
            kwota: invoices.kwota,
          },
        })
        .from(invoiceDeletionRequests)
        .leftJoin(users, eq(invoiceDeletionRequests.requestedBy, users.id))
        .leftJoin(invoices, eq(invoiceDeletionRequests.invoiceId, invoices.id))
        .where(whereClause)
        .orderBy(desc(invoiceDeletionRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        requests,
        total: requests.length,
      };
    }),

  // Get user's deletion requests
  getMy: protectedProcedure.query(async ({ ctx }) => {
    const requests = await db
      .select({
        id: invoiceDeletionRequests.id,
        invoiceId: invoiceDeletionRequests.invoiceId,
        reason: invoiceDeletionRequests.reason,
        status: invoiceDeletionRequests.status,
        reviewedAt: invoiceDeletionRequests.reviewedAt,
        rejectionReason: invoiceDeletionRequests.rejectionReason,
        createdAt: invoiceDeletionRequests.createdAt,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          description: invoices.description,
          kwota: invoices.kwota,
        },
      })
      .from(invoiceDeletionRequests)
      .leftJoin(invoices, eq(invoiceDeletionRequests.invoiceId, invoices.id))
      .where(eq(invoiceDeletionRequests.requestedBy, ctx.user.id))
      .orderBy(desc(invoiceDeletionRequests.createdAt))
      .limit(50);

    return requests;
  }),

  // Review deletion request (admin only)
  review: adminProcedure
    .input(reviewDeletionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin || !admin.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nie znaleziono administratora",
        });
      }

      const passwordValid = await verifyPassword(input.adminPassword, admin.passwordHash);
      if (!passwordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      // Get deletion request with invoice details
      const [request] = await db
        .select({
          id: invoiceDeletionRequests.id,
          invoiceId: invoiceDeletionRequests.invoiceId,
          status: invoiceDeletionRequests.status,
          invoice: {
            id: invoices.id,
            imageKey: invoices.imageKey,
            userId: invoices.userId,
          },
        })
        .from(invoiceDeletionRequests)
        .leftJoin(invoices, eq(invoiceDeletionRequests.invoiceId, invoices.id))
        .where(eq(invoiceDeletionRequests.id, input.requestId))
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nie znaleziono prośby o usunięcie",
        });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ta prośba została już rozpatrzona",
        });
      }

      if (input.action === "reject") {
        if (!input.rejectionReason || input.rejectionReason.trim().length < 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Powód odrzucenia musi zawierać minimum 10 znaków",
          });
        }

        // Update request as rejected - using atomic transaction
        const [updated] = await db
          .update(invoiceDeletionRequests)
          .set({
            status: "rejected",
            reviewedBy: ctx.user.id,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoiceDeletionRequests.id, input.requestId),
              eq(invoiceDeletionRequests.status, "pending") // Prevent race condition
            )
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nie udało się odrzucić prośby. Być może została już rozpatrzona przez innego administratora.",
          });
        }

        return {
          success: true,
          message: "Prośba o usunięcie faktury została odrzucona",
        };
      }

      // Approve - delete invoice
      if (!request.invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Faktura nie istnieje - być może została już usunięta",
        });
      }

      await db.transaction(async (tx) => {
        // Delete file from MinIO
        try {
          await deleteFile(request.invoice!.imageKey);
        } catch (error) {
          console.error("Failed to delete file from MinIO:", error);
          // Continue with database deletion even if MinIO fails
        }

        // Delete invoice (cascade will delete edit history, etc.)
        await tx.delete(invoices).where(eq(invoices.id, request.invoiceId));

        // Update deletion request as approved
        const [updated] = await tx
          .update(invoiceDeletionRequests)
          .set({
            status: "approved",
            reviewedBy: ctx.user.id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(invoiceDeletionRequests.id, input.requestId),
              eq(invoiceDeletionRequests.status, "pending") // Prevent race condition
            )
          )
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nie udało się zatwierdzić prośby. Być może została już rozpatrzona przez innego administratora.",
          });
        }
      });

      return {
        success: true,
        message: "Faktura została usunięta",
      };
    }),

  // Cancel own deletion request (user/accountant)
  cancel: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await db
        .select()
        .from(invoiceDeletionRequests)
        .where(
          and(
            eq(invoiceDeletionRequests.id, input.requestId),
            eq(invoiceDeletionRequests.requestedBy, ctx.user.id),
            eq(invoiceDeletionRequests.status, "pending")
          )
        )
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nie znaleziono oczekującej prośby",
        });
      }

      await db
        .delete(invoiceDeletionRequests)
        .where(eq(invoiceDeletionRequests.id, input.requestId));

      return {
        success: true,
        message: "Prośba o usunięcie została anulowana",
      };
    }),
});
