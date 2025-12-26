import { z } from "zod";
import { createTRPCRouter, adminProcedure, adminUnlimitedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { 
  users, 
  invoices, 
  companies, 
  loginLogs, 
  invoiceEditHistory,
  sessions,
  loginAttempts,
  notifications
} from "@/server/db/schema";
import { eq, sql, desc, gte, and, inArray, lt } from "drizzle-orm";
import { hashPassword, verifyPassword, validatePassword } from "@/server/auth/password";
import { getStorageUsage, deleteFile, minioClient, BUCKET_NAME } from "@/server/storage/minio";

export const adminRouter = createTRPCRouter({
  // Get dashboard statistics
  getStats: adminProcedure.query(async ({ ctx }) => {

    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [invoiceCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices);

    const [companyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies);

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "pending"));

    const [acceptedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "accepted"));

    const [rejectedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "rejected"));

    const [reReviewCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "re_review"));

    // Get storage usage in GB (always show decimal, even if less than 1GB)
    const storageBytes = await getStorageUsage();
    const storageGB = storageBytes / (1024 * 1024 * 1024);

    // Get PostgreSQL database size in GB
    const dbSizeResult = await db.execute(sql`
      SELECT pg_database_size(current_database()) as size
    `);
    const dbSizeBytes = Number((dbSizeResult.rows[0] as Record<string, unknown>)?.size || 0);
    const dbSizeGB = dbSizeBytes / (1024 * 1024 * 1024);

    return {
      users: userCount?.count || 0,
      invoices: invoiceCount?.count || 0,
      companies: companyCount?.count || 0,
      pending: pendingCount?.count || 0,
      accepted: acceptedCount?.count || 0,
      rejected: rejectedCount?.count || 0,
      reReview: reReviewCount?.count || 0,
      storageGB: parseFloat(storageGB.toFixed(3)),
      databaseGB: parseFloat(dbSizeGB.toFixed(4)),
    };
  }),

  // Get all users
  getUsers: adminProcedure
    .input(
      z.object({
        cursor: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;

      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = allUsers.length > limit;
      const items = hasMore ? allUsers.slice(0, limit) : allUsers;

      return {
        items,
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Create user (admin only - replaces registration)
  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email("Nieprawidłowy adres email"),
        password: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
        name: z.string().min(1, "Imię i nazwisko są wymagane"),
        role: z.enum(["user", "accountant", "admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {

      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Użytkownik z tym adresem email już istnieje",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const [newUser] = await db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          name: input.name,
          role: input.role,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      return newUser;
    }),

  // Update user
  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        role: z.enum(["user", "accountant", "admin"]).optional(),
        password: z.string().min(6).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...data } = input;

      // Transaction safety: Verify user exists before update
      const [existingUser] = await db
        .select({ updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      const updateData: typeof data & { updatedAt: Date; passwordHash?: string } = { 
        ...data, 
        updatedAt: new Date() 
      };

      if (password) {
        updateData.passwordHash = await hashPassword(password);
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(
          and(
            eq(users.id, id),
            eq(users.updatedAt, existingUser.updatedAt) // Optimistic lock
          )
        )
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Użytkownik został zmodyfikowany przez innego administratora. Odśwież stronę i spróbuj ponownie.",
        });
      }

      return updated;
    }),

  // Delete user (requires admin password)
  deleteUser: adminProcedure
    .input(z.object({ 
      id: z.string().uuid(),
      adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Prevent self-deletion
      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nie możesz usunąć własnego konta",
        });
      }

      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nie znaleziono administratora",
        });
      }

      const isValidPassword = await verifyPassword(
        admin.passwordHash,
        input.adminPassword
      );

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      // Delete user
      await db.delete(users).where(eq(users.id, input.id));

      // Verify deletion
      const [stillExists] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.id))
        .limit(1);

      if (stillExists) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się usunąć użytkownika",
        });
      }

      return { success: true };
    }),

  // Reset user password
  resetUserPassword: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(6, "Hasło musi mieć minimum 6 znaków"),
        confirmPassword: z.string(),
        adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify passwords match
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Hasła nie są identyczne",
        });
      }

      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nie znaleziono administratora",
        });
      }

      const isValidAdminPassword = await verifyPassword(
        admin.passwordHash,
        input.adminPassword
      );

      if (!isValidAdminPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      // Get target user with timestamp for optimistic locking
      const [targetUser] = await db
        .select({ updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update user password with optimistic locking
      const updateResult = await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(
          and(
            eq(users.id, input.userId),
            eq(users.updatedAt, targetUser.updatedAt) // Optimistic lock
          )
        )
        .returning({ id: users.id });

      if (!updateResult || updateResult.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Hasło użytkownika zostało zmienione przez innego administratora. Odśwież stronę i spróbuj ponownie.",
        });
      }

      return { success: true };
    }),

  // Get all invoices with details
  getAllInvoices: adminProcedure.query(async ({ ctx }) => {

    const allInvoices = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        description: invoices.description,
        status: invoices.status,
        createdAt: invoices.createdAt,
        reviewedAt: invoices.reviewedAt,
        reviewedBy: invoices.reviewedBy,
        userName: users.name,
        userId: users.id,
        companyName: companies.name,
        companyId: companies.id,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .orderBy(desc(invoices.createdAt))
      .limit(1000);

    // Get reviewer names efficiently
    const reviewerIds = allInvoices
      .filter(inv => inv.reviewedBy)
      .map(inv => inv.reviewedBy as string);
    
    const uniqueReviewerIds = [...new Set(reviewerIds)];
    
    const reviewers = uniqueReviewerIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, uniqueReviewerIds))
      : [];
    
    const reviewerMap = new Map(reviewers.map(r => [r.id, r.name]));

    return allInvoices.map(invoice => ({
      ...invoice,
      reviewerName: invoice.reviewedBy ? reviewerMap.get(invoice.reviewedBy) || null : null,
    }));
  }),

  // Get login logs
  getLoginLogs: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(),
        days: z.number().min(1).default(30),
        cursor: z.number().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const limit = input.limit;
      const cursor = input.cursor || 0;
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - input.days);

      let conditions = [gte(loginLogs.createdAt, dateThreshold)];
      if (input.userId) {
        conditions.push(eq(loginLogs.userId, input.userId));
      }

      const logs = await db
        .select({
          id: loginLogs.id,
          email: loginLogs.email,
          ipAddress: loginLogs.ipAddress,
          userAgent: loginLogs.userAgent,
          success: loginLogs.success,
          userId: loginLogs.userId,
          createdAt: loginLogs.createdAt,
          userName: users.name,
        })
        .from(loginLogs)
        .leftJoin(users, eq(loginLogs.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(loginLogs.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = logs.length > limit;
      const items = hasMore ? logs.slice(0, limit) : logs;

      return {
        items,
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Clean old login logs (30+ days)
  cleanOldLoginLogs: adminProcedure.mutation(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(loginLogs)
      .where(lt(loginLogs.createdAt, thirtyDaysAgo));

    return { success: true, message: "Stare logi logowania zostały usunięte" };
  }),

  // Delete all login logs
  deleteAllLoginLogs: adminProcedure
    .input(
      z.object({
        adminPassword: z.string().min(1, "Hasło jest wymagane"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Administrator nie został znaleziony",
        });
      }

      const isPasswordValid = await verifyPassword(input.adminPassword, admin.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło",
        });
      }

      // Delete all logs
      await db.delete(loginLogs);

      return { success: true, message: "Wszystkie logi logowania zostały usunięte" };
    }),

  // Get analytics data
  getAnalytics: adminProcedure.query(async ({ ctx }) => {
    // Total invoices by status
    const [totalInvoices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices);

    const [acceptedInvoices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "accepted"));

    const [rejectedInvoices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "rejected"));

    const [pendingInvoices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "pending"));

    const [reReviewInvoices] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.status, "re_review"));

    // Invoices by company
    const invoicesByCompany = await db
      .select({
        companyId: invoices.companyId,
        companyName: companies.name,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .groupBy(invoices.companyId, companies.name)
      .orderBy(desc(sql`count(*)`));

    // Invoices by user
    const invoicesByUser = await db
      .select({
        userId: invoices.userId,
        userName: users.name,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.userId, users.id))
      .groupBy(invoices.userId, users.name)
      .orderBy(desc(sql`count(*)`));

    // Accountant performance
    const accountantPerformance = await db
      .select({
        accountantId: invoices.reviewedBy,
        accountantName: users.name,
        totalReviewed: sql<number>`count(*)::int`,
        accepted: sql<number>`count(*) FILTER (WHERE ${invoices.status} = 'accepted')::int`,
        rejected: sql<number>`count(*) FILTER (WHERE ${invoices.status} = 'rejected')::int`,
        avgReviewTime: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${invoices.reviewedAt} - ${invoices.createdAt})) / 3600), 0)::numeric(10,1)`,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.reviewedBy, users.id))
      .where(sql`${invoices.reviewedBy} IS NOT NULL AND ${invoices.reviewedAt} IS NOT NULL`)
      .groupBy(invoices.reviewedBy, users.name)
      .orderBy(desc(sql`count(*)`));

    // Average time to review (from created to first review)
    const avgTimeToReviewResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 0)::numeric(10,1) as avg_hours
      FROM ${invoices}
      WHERE status IN ('accepted', 'rejected')
      AND updated_at IS NOT NULL
    `);
    const avgTimeToReview = Number((avgTimeToReviewResult.rows[0] as Record<string, unknown>)?.avg_hours || 0);

    // Average time to decision (from created to reviewed_at)
    const avgTimeToDecisionResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600), 0)::numeric(10,1) as avg_hours
      FROM ${invoices}
      WHERE status IN ('accepted', 'rejected')
      AND reviewed_at IS NOT NULL
    `);
    const avgTimeToDecision = Number((avgTimeToDecisionResult.rows[0] as Record<string, unknown>)?.avg_hours || 0);

    // Monthly summaries (last 6 months)
    const monthlySummariesResult = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month_name,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending
      FROM ${invoices}
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) DESC
    `);
    
    const monthlySummaries = (monthlySummariesResult.rows as Array<{
      month: string;
      month_name: string;
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
    }>);

    // Quarterly summaries (last 4 quarters)
    const quarterlySummariesResult = await db.execute(sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('quarter', created_at), 'YYYY-"Q"Q') as quarter,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending
      FROM ${invoices}
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('quarter', created_at)
      ORDER BY DATE_TRUNC('quarter', created_at) DESC
    `);
    
    const quarterlySummaries = (quarterlySummariesResult.rows as Array<{
      quarter: string;
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
    }>);

    return {
      totalInvoices: totalInvoices?.count || 0,
      acceptedInvoices: acceptedInvoices?.count || 0,
      rejectedInvoices: rejectedInvoices?.count || 0,
      pendingInvoices: pendingInvoices?.count || 0,
      reReviewInvoices: reReviewInvoices?.count || 0,
      invoicesByCompany,
      invoicesByUser,
      accountantPerformance,
      avgTimeToReview,
      avgTimeToDecision,
      monthlySummaries,
      quarterlySummaries,
    };
  }),

  // Delete invoice (requires admin password)
  deleteInvoice: adminProcedure
    .input(z.object({ 
      id: z.string().uuid(),
      adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nie znaleziono administratora",
        });
      }

      const isValidPassword = await verifyPassword(
        admin.passwordHash,
        input.adminPassword
      );

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      // Get invoice details for cleanup
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

      let minioDeleted = false;
      let dbDeleted = false;

      try {
        // 1. Delete from MinIO
        await deleteFile(invoice.imageKey);
        minioDeleted = true;

        // 2. Delete edit history
        await db.delete(invoiceEditHistory).where(eq(invoiceEditHistory.invoiceId, input.id));

        // 3. Delete from database
        await db.delete(invoices).where(eq(invoices.id, input.id));
        dbDeleted = true;

        // 4. Verify complete deletion from database
        const [stillExistsInDb] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, input.id))
          .limit(1);

        if (stillExistsInDb) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Nie udało się usunąć faktury z bazy danych",
          });
        }

        return { 
          success: true,
          minioDeleted,
          dbDeleted,
        };
      } catch (error) {
        // If one deletion succeeded but the other failed, we have a problem
        if (minioDeleted && !dbDeleted) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Plik został usunięty, ale nie udało się usunąć wpisu z bazy danych",
          });
        }
        throw error;
      }
    }),

  // Admin change invoice status (for re-review invoices)
  changeInvoiceStatus: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newStatus: z.enum(["pending", "accepted", "rejected"]),
        reason: z.string().optional(),
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

      // Store previous values for history
      const previousStatus = invoice.status;
      const previousUpdatedAt = invoice.updatedAt;

      // Update invoice status with optimistic locking
      const updateData: Partial<typeof invoices.$inferInsert> = {
        status: input.newStatus,
        updatedAt: new Date(),
        lastEditedBy: ctx.user.id,
        lastEditedAt: new Date(),
      };

      // If changing to accepted or rejected, set reviewedBy and reviewedAt
      if (input.newStatus === "accepted" || input.newStatus === "rejected") {
        updateData.reviewedBy = ctx.user.id;
        updateData.reviewedAt = new Date();
        if (input.reason && input.newStatus === "rejected") {
          updateData.rejectionReason = input.reason;
        }
      }

      // If changing from re_review to pending, clear rejection reason
      if (previousStatus === "re_review" && input.newStatus === "pending") {
        updateData.rejectionReason = null;
      }

      const [updated] = await db
        .update(invoices)
        .set(updateData)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.updatedAt, previousUpdatedAt) // Optimistic lock
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Status faktury został zmieniony przez innego administratora. Odśwież stronę i spróbuj ponownie.",
        });
      }

      // Log to edit history
      await db.insert(invoiceEditHistory).values({
        invoiceId: input.id,
        editedBy: ctx.user.id,
        previousInvoiceNumber: null,
        newInvoiceNumber: null,
        previousDescription: `Status: ${previousStatus}`,
        newDescription: `Status zmieniony przez admina na: ${input.newStatus}${input.reason ? ` (${input.reason})` : ''}`,
      });

      return {
        success: true,
        invoice: updated,
      };
    }),

  // Bulk delete invoices with verification (no rate limit)
  bulkDeleteInvoices: adminUnlimitedProcedure
    .input(
      z.object({
        password: z.string().min(1, "Password is required"),
        filters: z.object({
          olderThanMonths: z.number().optional(),
          year: z.number().optional(),
          month: z.number().optional(), // 1-12
          dateRange: z.object({
            start: z.string().datetime().optional(),
            end: z.string().datetime().optional(),
          }).optional(),
          statuses: z.array(z.enum(["pending", "in_review", "accepted", "rejected", "re_review", "all"])).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Administrator not found",
        });
      }

      const isPasswordValid = await verifyPassword(input.password, admin.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid password",
        });
      }

      // Build query conditions
      const conditions = [];

      // Older than X months
      if (input.filters.olderThanMonths) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - input.filters.olderThanMonths);
        conditions.push(lt(invoices.createdAt, cutoffDate));
      }

      // Specific year/month
      if (input.filters.year) {
        if (input.filters.month) {
          // Specific year and month
          const startDate = new Date(input.filters.year, input.filters.month - 1, 1);
          const endDate = new Date(input.filters.year, input.filters.month, 0, 23, 59, 59, 999);
          conditions.push(
            and(
              gte(invoices.createdAt, startDate),
              lt(invoices.createdAt, new Date(endDate.getTime() + 1))
            )!
          );
        } else {
          // Only year
          const startDate = new Date(input.filters.year, 0, 1);
          const endDate = new Date(input.filters.year, 11, 31, 23, 59, 59, 999);
          conditions.push(
            and(
              gte(invoices.createdAt, startDate),
              lt(invoices.createdAt, new Date(endDate.getTime() + 1))
            )!
          );
        }
      }

      // Date range
      if (input.filters.dateRange?.start && input.filters.dateRange?.end) {
        const startDate = new Date(input.filters.dateRange.start);
        const endDate = new Date(input.filters.dateRange.end);
        conditions.push(
          and(
            gte(invoices.createdAt, startDate),
            lt(invoices.createdAt, new Date(endDate.getTime() + 86400000)) // +1 day
          )!
        );
      }

      // Statuses
      if (input.filters.statuses && input.filters.statuses.length > 0 && !input.filters.statuses.includes("all")) {
        const validStatuses = input.filters.statuses.filter(s => s !== "all") as Array<"pending" | "in_review" | "accepted" | "rejected" | "re_review">;
        if (validStatuses.length > 0) {
          conditions.push(inArray(invoices.status, validStatuses));
        }
      }

      // Get invoices to delete
      const query = conditions.length > 0 
        ? db.select().from(invoices).where(and(...conditions))
        : db.select().from(invoices);

      const invoicesToDelete = await query;

      if (invoicesToDelete.length === 0) {
        return {
          success: true,
          totalFound: 0,
          deleted: 0,
          failed: 0,
          errors: [],
        };
      }

      return {
        success: true,
        totalFound: invoicesToDelete.length,
        invoices: invoicesToDelete.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          imageKey: inv.imageKey,
          status: inv.status,
          createdAt: inv.createdAt,
        })),
      };
    }),

  // Delete single invoice with verification (step-by-step, no rate limit)
  deleteSingleInvoice: adminUnlimitedProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get invoice details
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Invoice not found: ${input.invoiceId}`,
        });
      }

      const imageKey = invoice.imageKey;

      try {
        // Step 1: Delete from MinIO
        await deleteFile(imageKey);

        // Step 2: Verify MinIO deletion by trying to get presigned URL (should fail)
        let minioDeleted = false;
        try {
          await minioClient.statObject(BUCKET_NAME, imageKey);
          minioDeleted = false;
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'code' in err && err.code === 'NotFound') {
            minioDeleted = true;
          }
        }

        if (!minioDeleted) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete from MinIO: ${imageKey}`,
          });
        }

        // Step 3: Delete from PostgreSQL
        await db.delete(invoices).where(eq(invoices.id, input.invoiceId));

        // Step 4: Verify PostgreSQL deletion
        const [stillExists] = await db
          .select()
          .from(invoices)
          .where(eq(invoices.id, input.invoiceId))
          .limit(1);

        if (stillExists) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to delete from database: ${input.invoiceId}`,
          });
        }

        return {
          success: true,
          invoiceId: input.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete invoice: ${errorMessage}`,
        });
      }
    }),

  // Verify all invoices deleted
  verifyDeletion: adminProcedure
    .input(
      z.object({
        filters: z.object({
          olderThanMonths: z.number().optional(),
          year: z.number().optional(),
          month: z.number().optional(),
          dateRange: z.object({
            start: z.string().datetime().optional(),
            end: z.string().datetime().optional(),
          }).optional(),
          statuses: z.array(z.enum(["pending", "in_review", "accepted", "rejected", "re_review", "all"])).optional(),
        }),
      })
    )
    .query(async ({ input }) => {
      // Build same query conditions
      const conditions = [];

      if (input.filters.olderThanMonths) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - input.filters.olderThanMonths);
        conditions.push(lt(invoices.createdAt, cutoffDate));
      }

      if (input.filters.year) {
        if (input.filters.month) {
          const startDate = new Date(input.filters.year, input.filters.month - 1, 1);
          const endDate = new Date(input.filters.year, input.filters.month, 0, 23, 59, 59, 999);
          conditions.push(
            and(
              gte(invoices.createdAt, startDate),
              lt(invoices.createdAt, new Date(endDate.getTime() + 1))
            )!
          );
        } else {
          const startDate = new Date(input.filters.year, 0, 1);
          const endDate = new Date(input.filters.year, 11, 31, 23, 59, 59, 999);
          conditions.push(
            and(
              gte(invoices.createdAt, startDate),
              lt(invoices.createdAt, new Date(endDate.getTime() + 1))
            )!
          );
        }
      }

      if (input.filters.dateRange?.start && input.filters.dateRange?.end) {
        const startDate = new Date(input.filters.dateRange.start);
        const endDate = new Date(input.filters.dateRange.end);
        conditions.push(
          and(
            gte(invoices.createdAt, startDate),
            lt(invoices.createdAt, new Date(endDate.getTime() + 86400000))
          )!
        );
      }

      if (input.filters.statuses && input.filters.statuses.length > 0 && !input.filters.statuses.includes("all")) {
        const validStatuses = input.filters.statuses.filter(s => s !== "all") as Array<"pending" | "in_review" | "accepted" | "rejected" | "re_review">;
        if (validStatuses.length > 0) {
          conditions.push(inArray(invoices.status, validStatuses));
        }
      }

      const query = conditions.length > 0 
        ? db.select().from(invoices).where(and(...conditions))
        : db.select().from(invoices);

      const remainingInvoices = await query;

      return {
        remaining: remainingInvoices.length,
        allDeleted: remainingInvoices.length === 0,
      };
    }),

  // Change user password (admin only with password confirmation)
  changeUserPassword: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(8, "Nowe hasło musi mieć minimum 8 znaków"),
        adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Administrator nie został znaleziony",
        });
      }

      const isValidPassword = await verifyPassword(input.adminPassword, admin.passwordHash);
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      // Validate new password
      const validation = validatePassword(input.newPassword);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message,
        });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Get detailed database statistics for monitoring
  getDatabaseStats: adminProcedure.query(async () => {
    try {
      // Get table sizes from PostgreSQL
      const tableSizes = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) AS bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);
      
      // Get row counts for key tables
      const [sessionsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions);
      
      const [loginLogsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginLogs);
      
      const [loginAttemptsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginAttempts);
      
      const [notificationsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications);
      
      const [invoicesCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices);
      
      const [invoiceEditHistoryCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoiceEditHistory);

      // Get expired sessions count
      const now = new Date();
      const [expiredSessionsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .where(lt(sessions.expiresAt, now));

      // Get old records that should be cleaned up
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [oldLoginLogsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginLogs)
        .where(lt(loginLogs.createdAt, thirtyDaysAgo));
      
      const [oldLoginAttemptsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(loginAttempts)
        .where(lt(loginAttempts.updatedAt, thirtyDaysAgo));

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const [oldNotificationsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(lt(notifications.createdAt, twoDaysAgo));

      // Get total database size
      const dbSizeResult = await db.execute(sql`
        SELECT pg_database_size(current_database()) as size
      `);
      
      const dbSizeBytes = Number((dbSizeResult.rows[0] as Record<string, unknown>)?.size || 0);
      
      return {
        totalDatabaseSize: {
          bytes: dbSizeBytes,
          megabytes: parseFloat((dbSizeBytes / (1024 * 1024)).toFixed(2)),
          gigabytes: parseFloat((dbSizeBytes / (1024 * 1024 * 1024)).toFixed(4)),
        },
        tableSizes: tableSizes.rows as Array<{
          schemaname: string;
          tablename: string;
          size: string;
          bytes: number;
        }>,
        rowCounts: {
          sessions: sessionsCount?.count || 0,
          loginLogs: loginLogsCount?.count || 0,
          loginAttempts: loginAttemptsCount?.count || 0,
          notifications: notificationsCount?.count || 0,
          invoices: invoicesCount?.count || 0,
          invoiceEditHistory: invoiceEditHistoryCount?.count || 0,
        },
        cleanupStats: {
          expiredSessions: expiredSessionsCount?.count || 0,
          oldLoginLogs: oldLoginLogsCount?.count || 0,
          oldLoginAttempts: oldLoginAttemptsCount?.count || 0,
          oldNotifications: oldNotificationsCount?.count || 0,
        },
        alerts: [
          ...(expiredSessionsCount && expiredSessionsCount.count > 1000 
            ? [{ level: "warning" as const, message: `${expiredSessionsCount.count} expired sessions pending cleanup` }] 
            : []),
          ...(oldLoginLogsCount && oldLoginLogsCount.count > 10000 
            ? [{ level: "warning" as const, message: `${oldLoginLogsCount.count} old login logs pending cleanup` }] 
            : []),
          ...(oldLoginAttemptsCount && oldLoginAttemptsCount.count > 5000 
            ? [{ level: "info" as const, message: `${oldLoginAttemptsCount.count} old login attempts pending cleanup` }] 
            : []),
          ...(sessionsCount && sessionsCount.count > 50000 
            ? [{ level: "critical" as const, message: `High session count: ${sessionsCount.count}. Check cleanup job.` }] 
            : []),
          ...(dbSizeBytes > 10 * 1024 * 1024 * 1024 
            ? [{ level: "warning" as const, message: `Database size exceeds 10 GB` }] 
            : []),
        ],
      };
    } catch (error) {
      console.error("Error getting database stats:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get database statistics",
      });
    }
  }),

  // Bulk delete ALL notifications (admin only, for clearing purposes)
  bulkDeleteAllNotifications: adminProcedure
    .input(
      z.object({
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin password
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!admin) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Administrator not found",
        });
      }

      const isPasswordValid = await verifyPassword(input.password, admin.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe hasło administratora",
        });
      }

      try {
        // Count total notifications before deletion
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications);

        const totalCount = countResult?.count || 0;

        // Delete all notifications
        await db.delete(notifications);

        return {
          success: true,
          message: `Pomyślnie usunięto ${totalCount} powiadomień z bazy danych`,
          deletedCount: totalCount,
        };
      } catch (error) {
        console.error("Error deleting all notifications:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się usunąć powiadomień",
        });
      }
    }),
});
