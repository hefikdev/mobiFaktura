import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
  adminUnlimitedProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, budgetRequests, saldoTransactions } from "@/server/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { verifyPassword } from "@/server/auth/password";
import { notifyBudgetRequestSubmitted, notifyBudgetRequestApproved, notifyBudgetRequestRejected } from "@/server/lib/notifications";

// Zod Schemas
const createBudgetRequestSchema = z.object({
  requestedAmount: z.number().positive("Kwota musi być większa od zera"),
  justification: z.string().min(5, "Uzasadnienie musi zawierać minimum 5 znaków").max(1000, "Uzasadnienie nie może przekraczać 1000 znaków"),
});

const reviewBudgetRequestSchema = z.object({
  requestId: z.string().uuid("Nieprawidłowy identyfikator prośby"),
  action: z.enum(["approve", "reject"], {
    errorMap: () => ({ message: "Akcja musi być 'approve' lub 'reject'" }),
  }),
  rejectionReason: z.string().optional(),
});

const getBudgetRequestsSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).optional().default("all"),
  userId: z.string().uuid().optional(),
  cursor: z.number().optional(),
  limit: z.number().min(1).max(200).default(50),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "requestedAmount", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const budgetRequestRouter = createTRPCRouter({
  // Create a budget request (users)
  create: protectedProcedure
    .input(createBudgetRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user already has a pending request
      const [existingRequest] = await db
        .select()
        .from(budgetRequests)
        .where(
          and(
            eq(budgetRequests.userId, ctx.user.id),
            eq(budgetRequests.status, "pending")
          )
        )
        .limit(1);

      if (existingRequest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Masz już oczekującą prośbę o zwiększenie budżetu. Poczekaj na rozpatrzenie obecnej prośby.",
        });
      }

      // Get current user balance
      const [user] = await db
        .select({ saldo: users.saldo })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      const currentBalance = parseFloat(user.saldo || "0");

      const [request] = await db
        .insert(budgetRequests)
        .values({
          userId: ctx.user.id,
          requestedAmount: input.requestedAmount.toFixed(2),
          currentBalanceAtRequest: currentBalance.toFixed(2),
          justification: input.justification,
          status: "pending",
        })
        .returning();

      if (!request) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć prośby",
        });
      }

      // Notify all accountants and admins
      const accountants = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, "accountant"), eq(users.role, "admin")));

      if (accountants.length > 0) {
        await notifyBudgetRequestSubmitted(
          accountants.map(a => a.id),
          ctx.user.name,
          input.requestedAmount
        );
      }

      return {
        success: true,
        requestId: request.id,
        message: "Prośba o zwiększenie budżetu została wysłana do księgowego",
      };
    }),

  // Get user's own budget requests
  myRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const requests = await db
        .select({
          id: budgetRequests.id,
          requestedAmount: budgetRequests.requestedAmount,
          justification: budgetRequests.justification,
          status: budgetRequests.status,
          rejectionReason: budgetRequests.rejectionReason,
          createdAt: budgetRequests.createdAt,
          reviewedAt: budgetRequests.reviewedAt,
          reviewerName: users.name,
        })
        .from(budgetRequests)
        .leftJoin(users, eq(budgetRequests.reviewedBy, users.id))
        .where(eq(budgetRequests.userId, ctx.user.id))
        .orderBy(desc(budgetRequests.createdAt));

      return requests.map(req => ({
        ...req,
        requestedAmount: req.requestedAmount ? parseFloat(req.requestedAmount) : 0,
      }));
    }),

  // Get all budget requests (accountant/admin)
  getAll: accountantProcedure
    .input(getBudgetRequestsSchema.optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;
      const status = input?.status || "all";
      const userId = input?.userId;
      const search = input?.search;
      const sortBy = input?.sortBy || "createdAt";
      const sortOrder = input?.sortOrder || "desc";
      
      let conditions = [];

      if (status !== "all") {
        conditions.push(eq(budgetRequests.status, status));
      }

      if (userId) {
        conditions.push(eq(budgetRequests.userId, userId));
      }

      // Apply search filter
      if (search && search.trim()) {
        const searchTerm = `%${search.toLowerCase()}%`;
        conditions.push(
          sql`(LOWER(${users.name}) LIKE ${searchTerm} OR LOWER(${users.email}) LIKE ${searchTerm} OR LOWER(${budgetRequests.justification}) LIKE ${searchTerm})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Apply sorting
      let orderByClause;
      if (sortBy === "requestedAmount") {
        orderByClause = sortOrder === "asc" ? budgetRequests.requestedAmount : desc(budgetRequests.requestedAmount);
      } else if (sortBy === "status") {
        orderByClause = sortOrder === "asc" ? budgetRequests.status : desc(budgetRequests.status);
      } else {
        orderByClause = sortOrder === "asc" ? budgetRequests.createdAt : desc(budgetRequests.createdAt);
      }

      // Create alias for reviewer join
      const reviewer = alias(users, 'reviewer');

      // Subquery to get the last approved budget request for each user
      const lastApprovedRequest = db
        .select({
          userId: budgetRequests.userId,
          status: budgetRequests.status,
          requestedAmount: budgetRequests.requestedAmount,
        })
        .from(budgetRequests)
        .where(eq(budgetRequests.status, "approved"))
        .orderBy(desc(budgetRequests.createdAt))
        .limit(1)
        .as('last_approved');

      // For each user, we need the most recent approved request
      // We'll use a correlated subquery approach
      const result = await db
        .select({
          id: budgetRequests.id,
          userId: budgetRequests.userId,
          userName: users.name,
          userEmail: users.email,
          currentBalanceAtRequest: budgetRequests.currentBalanceAtRequest,
          requestedAmount: budgetRequests.requestedAmount,
          justification: budgetRequests.justification,
          status: budgetRequests.status,
          rejectionReason: budgetRequests.rejectionReason,
          createdAt: budgetRequests.createdAt,
          reviewedAt: budgetRequests.reviewedAt,
          reviewerName: reviewer.name,
          lastBudgetRequestStatus: sql<string | null>`
            (SELECT status FROM budget_requests br2 
             WHERE br2.user_id = budget_requests.user_id 
             AND br2.id != budget_requests.id
             ORDER BY br2.created_at DESC LIMIT 1)
          `,
          lastBudgetRequestAmount: sql<number | null>`
            (SELECT CAST(requested_amount AS DECIMAL) FROM budget_requests br2 
             WHERE br2.user_id = budget_requests.user_id 
             AND br2.id != budget_requests.id
             ORDER BY br2.created_at DESC LIMIT 1)
          `,
        })
        .from(budgetRequests)
        .innerJoin(users, eq(budgetRequests.userId, users.id))
        .leftJoin(reviewer, eq(budgetRequests.reviewedBy, reviewer.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map(req => ({
          ...req,
          requestedAmount: req.requestedAmount ? parseFloat(req.requestedAmount) : 0,
          currentBalanceAtRequest: req.currentBalanceAtRequest != null ? parseFloat(req.currentBalanceAtRequest) : 0,
          lastBudgetRequestAmount: req.lastBudgetRequestAmount ? parseFloat(req.lastBudgetRequestAmount) : null,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get pending requests count (accountant/admin)
  getPendingCount: accountantProcedure
    .query(async () => {
      const result = await db
        .select({ count: budgetRequests.id })
        .from(budgetRequests)
        .where(eq(budgetRequests.status, "pending"));

      return result.length;
    }),

  // Review budget request (accountant/admin)
  review: accountantProcedure
    .input(reviewBudgetRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate input thoroughly
      if (!input.requestId || typeof input.requestId !== 'string') {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nieprawidłowy identyfikator prośby",
        });
      }

      if (!['approve', 'reject'].includes(input.action)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nieprawidłowa akcja",
        });
      }

      // Get the request
      const [request] = await db
        .select({
          id: budgetRequests.id,
          userId: budgetRequests.userId,
          requestedAmount: budgetRequests.requestedAmount,
          justification: budgetRequests.justification,
          status: budgetRequests.status,
          userName: users.name,
        })
        .from(budgetRequests)
        .innerJoin(users, eq(budgetRequests.userId, users.id))
        .where(eq(budgetRequests.id, input.requestId))
        .limit(1);

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Prośba nie została znaleziona",
        });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
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

        // Safety check: Re-verify the request is still pending before updating
        const [currentRequest] = await db
          .select({ status: budgetRequests.status })
          .from(budgetRequests)
          .where(eq(budgetRequests.id, input.requestId))
          .limit(1);

        if (!currentRequest) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Prośba nie została znaleziona",
          });
        }

        if (currentRequest.status !== "pending") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Ta prośba została już rozpatrzona przez innego księgowego",
          });
        }

        // Update the request status with result verification
        const updateResult = await db
          .update(budgetRequests)
          .set({
            status: "rejected",
            reviewedBy: ctx.user.id,
            reviewedAt: new Date(),
            rejectionReason: input.rejectionReason,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(budgetRequests.id, input.requestId),
              eq(budgetRequests.status, "pending")
            )
          )
          .returning({ id: budgetRequests.id });

        if (!updateResult || updateResult.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Nie udało się odrzucić prośby. Być może została już rozpatrzona przez innego księgowego.",
          });
        }

        // Notify user of rejection
        try {
          await notifyBudgetRequestRejected(
            request.userId,
            parseFloat(request.requestedAmount),
            input.rejectionReason
          );
        } catch (notifyError) {
          console.error("Failed to send rejection notification:", notifyError);
          // Don't throw - rejection was successful, notification is secondary
        }

        return {
          success: true,
          message: "Prośba została odrzucona",
        };
      }

      // Approve - update saldo in transaction
      const amount = parseFloat(request.requestedAmount);
      
      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nieprawidłowa kwota prośby",
        });
      }
      
      const requestJustification = request.justification || "Prośba o zwiększenie budżetu";
      
      // Safety check: Re-verify the request is still pending before starting transaction
      const [currentRequest] = await db
        .select({ status: budgetRequests.status })
        .from(budgetRequests)
        .where(eq(budgetRequests.id, input.requestId))
        .limit(1);

      if (!currentRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Prośba nie została znaleziona",
        });
      }

      if (currentRequest.status !== "pending") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ta prośba została już rozpatrzona przez innego księgowego",
        });
      }
      
      await db.transaction(async (tx) => {
        // Get current user saldo
        const [targetUser] = await tx
          .select({ saldo: users.saldo, id: users.id })
          .from(users)
          .where(eq(users.id, request.userId))
          .limit(1);

        if (!targetUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Użytkownik nie został znaleziony",
          });
        }

        const balanceBefore = targetUser.saldo ? parseFloat(targetUser.saldo) : 0;
        const balanceAfter = balanceBefore + amount;

        // Update user saldo with result verification
        const saldoUpdateResult = await tx
          .update(users)
          .set({ 
            saldo: balanceAfter.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(users.id, request.userId))
          .returning({ id: users.id });

        if (!saldoUpdateResult || saldoUpdateResult.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Nie udało się zaktualizować saldo użytkownika",
          });
        }

        // Create transaction record with result verification
        const transactionResult = await tx.insert(saldoTransactions).values({
          userId: request.userId,
          amount: amount.toFixed(2),
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          transactionType: "zasilenie",
          referenceId: request.id,
          notes: `${requestJustification.substring(0, 100)}`,
          createdBy: ctx.user.id,
        }).returning({ id: saldoTransactions.id });

        if (!transactionResult || transactionResult.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Nie udało się zapisać transakcji",
          });
        }

        // Update request status with concurrent modification check
        const requestUpdateResult = await tx
          .update(budgetRequests)
          .set({
            status: "approved",
            reviewedBy: ctx.user.id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(budgetRequests.id, input.requestId),
              eq(budgetRequests.status, "pending")
            )
          )
          .returning({ id: budgetRequests.id });

        if (!requestUpdateResult || requestUpdateResult.length === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nie udało się zatwierdzić prośby. Być może została już rozpatrzona przez innego księgowego.",
          });
        }
      });

      // Notify user of approval (outside transaction to not block it)
      try {
        await notifyBudgetRequestApproved(
          request.userId,
          amount
        );
      } catch (notifyError) {
        console.error("Failed to send approval notification:", notifyError);
        // Don't throw - approval was successful, notification is secondary
      }

      return {
        success: true,
        message: `Prośba została zatwierdzona. Saldo użytkownika ${request.userName} zostało zwiększone o ${amount.toFixed(2)} PLN`,
      };
    }),

  // Cancel own pending request (user)
  cancel: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [request] = await db
        .select()
        .from(budgetRequests)
        .where(
          and(
            eq(budgetRequests.id, input.requestId),
            eq(budgetRequests.userId, ctx.user.id),
            eq(budgetRequests.status, "pending")
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
        .delete(budgetRequests)
        .where(eq(budgetRequests.id, input.requestId));

      return {
        success: true,
        message: "Prośba została anulowana",
      };
    }),

  // Bulk delete budget requests (admin only)
  // No rate limiting - protected by password verification
  bulkDelete: adminUnlimitedProcedure
    .input(z.object({
      filters: z.object({
        statuses: z.array(z.enum(["all", "pending", "approved", "rejected"])),
        olderThanMonths: z.number().optional(),
        year: z.number().optional(),
        month: z.number().optional(),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }).optional(),
        userId: z.string().uuid().optional(),
      }),
      adminPassword: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tylko administrator może masowo usuwać prośby o budżet",
        });
      }

      // Verify password
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

      // Build where conditions
      const conditions = [];

      // Status filter
      if (!input.filters.statuses.includes("all")) {
        conditions.push(
          or(
            ...input.filters.statuses.map((status) => 
              eq(budgetRequests.status, status as "pending" | "approved" | "rejected")
            )
          )
        );
      }

      // User filter
      if (input.filters.userId) {
        conditions.push(eq(budgetRequests.userId, input.filters.userId));
      }

      // Date filters
      if (input.filters.olderThanMonths) {
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - input.filters.olderThanMonths);
        conditions.push(
          // Using sql template for date comparison
          sql`${budgetRequests.createdAt} < ${monthsAgo.toISOString()}`
        );
      }

      if (input.filters.year) {
        const yearStart = new Date(input.filters.year, 0, 1);
        const yearEnd = new Date(input.filters.year, 11, 31, 23, 59, 59);
        
        if (input.filters.month) {
          const monthStart = new Date(input.filters.year, input.filters.month - 1, 1);
          const monthEnd = new Date(input.filters.year, input.filters.month, 0, 23, 59, 59);
          conditions.push(
            and(
              sql`${budgetRequests.createdAt} >= ${monthStart.toISOString()}`,
              sql`${budgetRequests.createdAt} <= ${monthEnd.toISOString()}`
            )
          );
        } else {
          conditions.push(
            and(
              sql`${budgetRequests.createdAt} >= ${yearStart.toISOString()}`,
              sql`${budgetRequests.createdAt} <= ${yearEnd.toISOString()}`
            )
          );
        }
      }

      if (input.filters.dateRange) {
        conditions.push(
          and(
            sql`${budgetRequests.createdAt} >= ${input.filters.dateRange.start}`,
            sql`${budgetRequests.createdAt} <= ${input.filters.dateRange.end}`
          )
        );
      }

      // Execute deletion
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const deletedRequests = await db
        .delete(budgetRequests)
        .where(whereClause)
        .returning({ id: budgetRequests.id });

      return {
        success: true,
        deletedCount: deletedRequests.length,
        message: `Usunięto ${deletedRequests.length} próśb o budżet`,
      };
    }),

  // Export budget requests (accountant/admin)
  exportBudgetRequests: accountantProcedure
    .input(getBudgetRequestsSchema.optional())
    .query(async ({ input }) => {
      const status = input?.status || "all";
      const userId = input?.userId;
      const search = input?.search;
      const sortBy = input?.sortBy || "createdAt";
      const sortOrder = input?.sortOrder || "desc";

      let conditions = [];

      if (status !== "all") {
        conditions.push(eq(budgetRequests.status, status));
      }

      if (userId) {
        conditions.push(eq(budgetRequests.userId, userId));
      }

      // Apply search filter
      if (search && search.trim()) {
        const searchTerm = `%${search.toLowerCase()}%`;
        conditions.push(
          sql`(LOWER(${users.name}) LIKE ${searchTerm} OR LOWER(${users.email}) LIKE ${searchTerm} OR LOWER(${budgetRequests.justification}) LIKE ${searchTerm})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Apply sorting
      let orderByClause;
      if (sortBy === "requestedAmount") {
        orderByClause = sortOrder === "asc" ? budgetRequests.requestedAmount : desc(budgetRequests.requestedAmount);
      } else if (sortBy === "status") {
        orderByClause = sortOrder === "asc" ? budgetRequests.status : desc(budgetRequests.status);
      } else {
        orderByClause = sortOrder === "asc" ? budgetRequests.createdAt : desc(budgetRequests.createdAt);
      }

      const result = await db
        .select({
          id: budgetRequests.id,
          userId: budgetRequests.userId,
          userName: users.name,
          userEmail: users.email,
          requestedAmount: budgetRequests.requestedAmount,
          currentBalanceAtRequest: budgetRequests.currentBalanceAtRequest,
          justification: budgetRequests.justification,
          status: budgetRequests.status,
          rejectionReason: budgetRequests.rejectionReason,
          createdAt: budgetRequests.createdAt,
          reviewedAt: budgetRequests.reviewedAt,
          reviewerName: sql<string>`reviewer.name`,
        })
        .from(budgetRequests)
        .leftJoin(users, eq(budgetRequests.userId, users.id))
        .leftJoin(sql`users as reviewer`, eq(budgetRequests.reviewedBy, sql`reviewer.id`))
        .where(whereClause)
        .orderBy(orderByClause);

      return result.map(req => ({
        id: req.id,
        userId: req.userId,
        userName: req.userName,
        userEmail: req.userEmail,
        requestedAmount: req.requestedAmount ? parseFloat(req.requestedAmount) : 0,
        currentBalanceAtRequest: req.currentBalanceAtRequest ? parseFloat(req.currentBalanceAtRequest) : 0,
        justification: req.justification,
        status: req.status,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        reviewedAt: req.reviewedAt,
        reviewerName: req.reviewerName,
      }));
    }),
});
