import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  accountantProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, saldoTransactions } from "@/server/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";import { notifySaldoAdjusted } from "@/server/lib/notifications";
// Zod Schemas
const adjustSaldoSchema = z.object({
  userId: z.string().uuid("Nieprawidłowy identyfikator użytkownika"),
  amount: z.number({
    required_error: "Kwota jest wymagana",
    invalid_type_error: "Kwota musi być liczbą",
  }),
  notes: z.string().min(5, "Notatka musi zawierać minimum 5 znaków").max(500, "Notatka nie może przekraczać 500 znaków"),
});

const getUserSaldoSchema = z.object({
  userId: z.string().uuid().optional(),
});

const getSaldoHistorySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
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
    .query(async ({ ctx }) => {
      const allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          saldo: users.saldo,
        })
        .from(users)
        .orderBy(users.name);

      return allUsers.map(user => ({
        ...user,
        saldo: user.saldo ? parseFloat(user.saldo) : 0,
      }));
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
          transactionType: "adjustment",
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
    .input(getSaldoHistorySchema)
    .query(async ({ ctx, input }) => {
      // If userId is provided, check permissions
      const targetUserId = input.userId || ctx.user.id;
      
      // Non-accountants can only view their own history
      if (targetUserId !== ctx.user.id && ctx.user.role === "user") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak uprawnień do przeglądania historii tego użytkownika",
        });
      }

      const transactions = await db
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
        .where(eq(saldoTransactions.userId, targetUserId))
        .orderBy(desc(saldoTransactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return transactions.map(tx => ({
        ...tx,
        amount: tx.amount ? parseFloat(tx.amount) : 0,
        balanceBefore: tx.balanceBefore ? parseFloat(tx.balanceBefore) : 0,
        balanceAfter: tx.balanceAfter ? parseFloat(tx.balanceAfter) : 0,
      }));
    }),

  // Get saldo statistics (accountant/admin only)
  getSaldoStats: accountantProcedure
    .query(async () => {
      const stats = await db
        .select({
          totalUsers: sql<number>`count(*)::int`,
          totalSaldo: sql<number>`sum(${users.saldo})::numeric`,
          avgSaldo: sql<number>`avg(${users.saldo})::numeric`,
          positiveBalance: sql<number>`count(*) filter (where ${users.saldo} > 0)::int`,
          negativeBalance: sql<number>`count(*) filter (where ${users.saldo} < 0)::int`,
          zeroBalance: sql<number>`count(*) filter (where ${users.saldo} = 0)::int`,
        })
        .from(users)
        .where(eq(users.role, "user"));

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
        totalSaldo: result.totalSaldo ? parseFloat(String(result.totalSaldo)) : 0,
        avgSaldo: result.avgSaldo ? parseFloat(String(result.avgSaldo)) : 0,
        positiveBalance: result.positiveBalance || 0,
        negativeBalance: result.negativeBalance || 0,
        zeroBalance: result.zeroBalance || 0,
      };
    }),
});
