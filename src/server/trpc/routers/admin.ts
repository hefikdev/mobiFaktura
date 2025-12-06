import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, invoices, companies, loginLogs, invoiceEditHistory } from "@/server/db/schema";
import { eq, sql, desc, gte, and, inArray, lt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getStorageUsage, deleteFile } from "@/server/storage/minio";

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
    const dbSizeBytes = Number((dbSizeResult.rows[0] as any)?.size || 0);
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
        .select()
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
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się zaktualizować użytkownika",
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

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

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
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.reviewedBy, users.id))
      .where(sql`${invoices.reviewedBy} IS NOT NULL`)
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
    const avgTimeToReview = Number((avgTimeToReviewResult.rows[0] as any)?.avg_hours || 0);

    // Average time to decision (from created to reviewed_at)
    const avgTimeToDecisionResult = await db.execute(sql`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600), 0)::numeric(10,1) as avg_hours
      FROM ${invoices}
      WHERE status IN ('accepted', 'rejected')
      AND reviewed_at IS NOT NULL
    `);
    const avgTimeToDecision = Number((avgTimeToDecisionResult.rows[0] as any)?.avg_hours || 0);

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

      // Update invoice status
      const updateData: any = {
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
        .where(eq(invoices.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się zmienić statusu faktury",
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
});
