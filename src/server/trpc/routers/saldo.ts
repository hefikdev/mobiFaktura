import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, saldoTransactions } from "@/server/db/schema";
import { eq, desc, and, or, ilike, sql, type SQL } from "drizzle-orm";import { notifySaldoAdjusted } from "@/server/lib/notifications";
// Zod Schemas
const adjustSaldoSchema = z.object({
  userId: z.string().uuid("Nieprawidłowy identyfikator użytkownika"),
  amount: z.number({
    required_error: "Kwota jest wymagana",
    invalid_type_error: "Kwota musi być liczbą",
  }),
  notes: z.string().min(5, "Notatka musi zawierać minimum 5 znaków").max(500, "Notatka nie może przekraczać 500 znaków"),
  transactionType: z.enum(["zasilenie", "korekta"], {
    required_error: "Typ transakcji jest wymagany",
    invalid_type_error: "Nieprawidłowy typ transakcji",
  }),
});

const getUserSaldoSchema = z.object({
  userId: z.string().uuid().optional(),
});

const getSaldoHistorySchema = z.object({
  userId: z.string().uuid().optional(),
  cursor: z.number().optional(),
  limit: z.number().min(1).max(200).default(50),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "amount", "transactionType"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const getAllUsersSaldoSchema = z.object({
  cursor: z.number().optional(),
  limit: z.number().min(1).max(200).default(50),
  search: z.string().optional(),
  sortBy: z.enum(["name", "email", "saldo"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const saldoRouter = createTRPCRouter({
  // Get current user's saldo
  getMySaldo: protectedProcedure
    .query(async ({ ctx }) => {
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

      return {
        saldo: user.saldo ? parseFloat(user.saldo) : 0,
      };
    }),

  // Get specific user's saldo (accountant/admin only)
  getUserSaldo: accountantProcedure
    .input(getUserSaldoSchema)
    .query(async ({ input }) => {
      const [user] = await db
        .select({ 
          id: users.id,
          name: users.name,
          email: users.email,
          saldo: users.saldo 
        })
        .from(users)
        .where(eq(users.id, input.userId!))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      return {
        ...user,
        saldo: user.saldo ? parseFloat(user.saldo) : 0,
      };
    }),

  // Get all users with their saldo (accountant/admin only)
  getAllUsersSaldo: accountantProcedure
    .input(getAllUsersSaldoSchema.optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;
      const search = input?.search;
      const sortBy = input?.sortBy || "name";
      const sortOrder = input?.sortOrder || "asc";
      
      // Apply search filter
      let whereCondition: SQL | undefined = undefined;
      if (search && search.trim()) {
        const searchTerm = `%${search.toLowerCase()}%`;
        whereCondition = or(ilike(users.name, searchTerm), ilike(users.email, searchTerm));
      }

      let query = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          saldo: users.saldo,
        })
        .from(users)
        .where(whereCondition);

      // Apply sorting
      const orderColumn = sortBy === "name" ? users.name : sortBy === "email" ? users.email : users.saldo;
      const orderedQuery = sortOrder === "asc" ? query.orderBy(orderColumn) : query.orderBy(desc(orderColumn));

      // Apply pagination with cursor
      const result = await orderedQuery.limit(limit + 1).offset(cursor);
      
      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map((user) => ({
          ...user,
          saldo: user.saldo ? parseFloat(user.saldo) : 0,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Adjust user's saldo (accountant/admin only)
  adjustSaldo: accountantProcedure
    .input(adjustSaldoSchema)
    .mutation(async ({ ctx, input }) => {
      // Get current user saldo
      const [targetUser] = await db
        .select({ saldo: users.saldo })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      const balanceBefore = targetUser.saldo ? parseFloat(targetUser.saldo) : 0;
      const balanceAfter = balanceBefore + input.amount;

      // Start transaction
      await db.transaction(async (tx) => {
        // Update user saldo
        await tx
          .update(users)
          .set({ 
            saldo: balanceAfter.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(users.id, input.userId));

        // Create transaction record
        await tx.insert(saldoTransactions).values({
          userId: input.userId,
          amount: input.amount.toFixed(2),
          balanceBefore: balanceBefore.toFixed(2),
          balanceAfter: balanceAfter.toFixed(2),
          transactionType: input.transactionType,
          notes: input.notes,
          createdBy: ctx.user.id,
        });
      });

      // Notify user of saldo adjustment
      await notifySaldoAdjusted(
        input.userId,
        input.amount,
        balanceAfter
      );

      return {
        success: true,
        newSaldo: balanceAfter,
        message: `Saldo zostało ${input.amount > 0 ? 'zwiększone' : 'zmniejszone'} o ${Math.abs(input.amount).toFixed(2)} PLN`,
      };
    }),

  // Get saldo transaction history
  getSaldoHistory: protectedProcedure
    .input(getSaldoHistorySchema.optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;
      const search = input?.search;
      const sortBy = input?.sortBy || "createdAt";
      const sortOrder = input?.sortOrder || "desc";
      
      // If userId is provided, check permissions
      const targetUserId = input?.userId || ctx.user.id;
      
      // Non-accountants can only view their own history
      if (targetUserId !== ctx.user.id && ctx.user.role === "user") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak uprawnień do przeglądania historii tego użytkownika",
        });
      }

      let whereCondition: SQL = eq(saldoTransactions.userId, targetUserId);
      if (search && search.trim()) {
        const searchTerm = `%${search.toLowerCase()}%`;
        whereCondition = and(
          whereCondition,
          or(ilike(saldoTransactions.notes, searchTerm), ilike(saldoTransactions.transactionType, searchTerm))
        ) as SQL;
      }

      const query = db
        .select({
          id: saldoTransactions.id,
          amount: saldoTransactions.amount,
          balanceBefore: saldoTransactions.balanceBefore,
          balanceAfter: saldoTransactions.balanceAfter,
          transactionType: saldoTransactions.transactionType,
          referenceId: saldoTransactions.referenceId,
          notes: saldoTransactions.notes,
          createdAt: saldoTransactions.createdAt,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(saldoTransactions)
        .leftJoin(users, eq(saldoTransactions.createdBy, users.id))
        .where(whereCondition);

      // Apply sorting
      const orderColumn = sortBy === "amount" ? saldoTransactions.amount 
        : sortBy === "transactionType" ? saldoTransactions.transactionType 
        : saldoTransactions.createdAt;
      const orderedQuery = sortOrder === "asc" ? query.orderBy(orderColumn) : query.orderBy(desc(orderColumn));

      // Apply pagination with cursor
      const result = await orderedQuery.limit(limit + 1).offset(cursor);
      
      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map((tx) => ({
          ...tx,
          amount: tx.amount ? parseFloat(tx.amount) : 0,
          balanceBefore: tx.balanceBefore ? parseFloat(tx.balanceBefore) : 0,
          balanceAfter: tx.balanceAfter ? parseFloat(tx.balanceAfter) : 0,
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  // Get saldo statistics (accountant/admin only)
  getSaldoStats: accountantProcedure
    .query(async () => {
      try {
        const stats = await db
          .select({
            totalUsers: sql<number>`count(*)::int`,
            totalSaldo: sql<string>`coalesce(sum(${users.saldo}), 0)::text`,
            avgSaldo: sql<string>`coalesce(avg(${users.saldo}), 0)::text`,
            positiveBalance: sql<string>`coalesce(sum(${users.saldo}) filter (where ${users.saldo} > 0), 0)::text`,
            negativeBalance: sql<string>`coalesce(sum(${users.saldo}) filter (where ${users.saldo} < 0), 0)::text`,
            zeroBalance: sql<number>`count(*) filter (where ${users.saldo} = 0)::int`,
          })
          .from(users);

        const [result] = stats;

        if (!result) {
          return {
            totalUsers: 0,
            totalSaldo: 0,
            avgSaldo: 0,
            positiveBalance: 0,
            negativeBalance: 0,
            zeroBalance: 0,
          };
        }

        return {
          totalUsers: result.totalUsers || 0,
          totalSaldo: parseFloat(result.totalSaldo) || 0,
          avgSaldo: parseFloat(result.avgSaldo) || 0,
          positiveBalance: parseFloat(result.positiveBalance) || 0,
          negativeBalance: parseFloat(result.negativeBalance) || 0,
          zeroBalance: result.zeroBalance || 0,
        };
      } catch (error) {
        console.error("Error fetching saldo stats:", error);
        return {
          totalUsers: 0,
          totalSaldo: 0,
          avgSaldo: 0,
          positiveBalance: 0,
          negativeBalance: 0,
          zeroBalance: 0,
        };
      }
    }),

  // Export all users saldo (accountant/admin only)
  exportAllUsersSaldo: accountantProcedure
    .input(getAllUsersSaldoSchema.optional())
    .query(async ({ input }) => {
      const sortBy = input?.sortBy || "name";
      const sortOrder = input?.sortOrder || "asc";

      // Apply search filter
      let whereCondition: SQL = sql`1=1`;
      if (input?.search && input.search.trim()) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        whereCondition = or(ilike(users.name, searchTerm), ilike(users.email, searchTerm)) as SQL;
      }

      const query = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          saldo: users.saldo,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereCondition);

      // Apply sorting
      const orderColumn = sortBy === "name" ? users.name : sortBy === "email" ? users.email : users.saldo;
      const orderedQuery = sortOrder === "asc" ? query.orderBy(orderColumn) : query.orderBy(desc(orderColumn));

      const result = await orderedQuery;

      return result.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        saldo: user.saldo ? parseFloat(user.saldo) : 0,
        createdAt: user.createdAt,
      }));
    }),

  // Export saldo transaction history
  exportSaldoHistory: protectedProcedure
    .input(getSaldoHistorySchema.optional())
    .query(async ({ ctx, input }) => {
      // If userId is provided, check permissions
      const targetUserId = input?.userId || ctx.user.id;

      // Non-accountants can only view their own history
      if (targetUserId !== ctx.user.id && ctx.user.role === "user") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak uprawnień do przeglądania historii tego użytkownika",
        });
      }

      let whereCondition: SQL = eq(saldoTransactions.userId, targetUserId);
      if (input?.search && input.search.trim()) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        whereCondition = and(
          whereCondition,
          or(ilike(saldoTransactions.notes, searchTerm), ilike(saldoTransactions.transactionType, searchTerm))
        ) as SQL;
      }

      const query = db
        .select({
          id: saldoTransactions.id,
          amount: saldoTransactions.amount,
          balanceBefore: saldoTransactions.balanceBefore,
          balanceAfter: saldoTransactions.balanceAfter,
          transactionType: saldoTransactions.transactionType,
          referenceId: saldoTransactions.referenceId,
          notes: saldoTransactions.notes,
          createdAt: saldoTransactions.createdAt,
          createdByName: users.name,
          createdByEmail: users.email,
        })
        .from(saldoTransactions)
        .leftJoin(users, eq(saldoTransactions.createdBy, users.id))
        .where(whereCondition);

      // Apply sorting
      const orderColumn = input?.sortBy === "amount" ? saldoTransactions.amount
        : input?.sortBy === "transactionType" ? saldoTransactions.transactionType
        : saldoTransactions.createdAt;
      const orderedQuery = (input?.sortOrder || "desc") === "asc" ? query.orderBy(orderColumn) : query.orderBy(desc(orderColumn));

      const result = await orderedQuery;

      return result.map((tx) => ({
        id: tx.id,
        amount: tx.amount ? parseFloat(tx.amount) : 0,
        balanceBefore: tx.balanceBefore ? parseFloat(tx.balanceBefore) : 0,
        balanceAfter: tx.balanceAfter ? parseFloat(tx.balanceAfter) : 0,
        transactionType: tx.transactionType,
        referenceId: tx.referenceId,
        notes: tx.notes,
        createdAt: tx.createdAt,
        createdByName: tx.createdByName,
        createdByEmail: tx.createdByEmail,
      }));
    }),
});
