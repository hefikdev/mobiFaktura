import { z } from "zod";
import {
  createTRPCRouter,
  accountantProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, advances, invoices, saldoTransactions, budgetRequests, companies } from "@/server/db/schema";
import { eq, desc, and, or, sql, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const createManualAdvanceSchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().trim().min(5, "Opis musi mieć co najmniej 5 znaków"),
});

const transferAdvanceSchema = z.object({
  id: z.string().uuid(),
  transferNumber: z.string().optional(),
});

export const advancesRouter = createTRPCRouter({
  // Get all advances
  getAll: accountantProcedure
    .input(z.object({
      status: z.enum(["all", "pending", "transferred", "settled"]).optional().default("all"),
      userId: z.string().uuid().optional(),
      limit: z.number().min(1).max(200).default(50),
      cursor: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 50;
      const cursor = input?.cursor || 0;
      const status = input?.status || "all";
      const userId = input?.userId;
      const search = input?.search;

      let conditions = [];

      if (status !== "all") {
        conditions.push(eq(advances.status, status));
      }

      if (userId) {
        conditions.push(eq(advances.userId, userId));
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.toLowerCase()}%`;
        conditions.push(
          sql`(
            ${advances.id}::text LIKE ${searchTerm}
            OR LOWER(${users.name}) LIKE ${searchTerm}
            OR LOWER(${users.email}) LIKE ${searchTerm}
            OR LOWER(${companies.name}) LIKE ${searchTerm}
            OR LOWER(${advances.description}) LIKE ${searchTerm}
          )`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db
        .select({
          id: advances.id,
          userId: advances.userId,
          companyId: advances.companyId,
          userName: users.name,
          userEmail: users.email,
          companyName: companies.name,
          amount: advances.amount,
          status: advances.status,
          sourceType: advances.sourceType,
          description: advances.description,
          createdAt: advances.createdAt,
          transferDate: advances.transferDate,
          settledAt: advances.settledAt,
        })
        .from(advances)
        .leftJoin(users, eq(advances.userId, users.id))
        .leftJoin(companies, eq(advances.companyId, companies.id))
        .where(whereClause)
        .orderBy(desc(advances.createdAt))
        .limit(limit + 1)
        .offset(cursor);

      const hasMore = result.length > limit;
      const items = hasMore ? result.slice(0, limit) : result;

      return {
        items: items.map(item => ({
          ...item,
          amount: parseFloat(item.amount),
        })),
        nextCursor: hasMore ? cursor + limit : undefined,
      };
    }),

  getById: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const creator = alias(users, "creator");
      const transferUser = alias(users, "transferUser");
      const settledUser = alias(users, "settledUser");

      const [advance] = await db
        .select({
           id: advances.id,
           userId: advances.userId,
           companyId: advances.companyId,
           amount: advances.amount,
           status: advances.status,
           sourceType: advances.sourceType,
           sourceId: advances.sourceId,
           description: advances.description,
           createdAt: advances.createdAt,
           transferDate: advances.transferDate,
           settledAt: advances.settledAt,
           userName: users.name,
           userEmail: users.email,
           userSaldo: users.saldo,
           companyName: companies.name,
            createdByName: creator.name,
            transferConfirmedByName: transferUser.name,
            settledByName: settledUser.name,
        })
        .from(advances)
        .leftJoin(users, eq(advances.userId, users.id))
        .leftJoin(companies, eq(advances.companyId, companies.id))
          .leftJoin(creator, eq(advances.createdBy, creator.id))
          .leftJoin(transferUser, eq(advances.transferConfirmedBy, transferUser.id))
          .leftJoin(settledUser, eq(advances.settledBy, settledUser.id))
        .where(eq(advances.id, input.id))
        .limit(1);

      if (!advance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zaliczka nie znaleziona" });
      }

      let budgetRequestDetails = null;
      // We need to fetch reviewer name if we have a budget request
      let reviewerName = null;
      
      if (advance.sourceType === "budget_request" && advance.sourceId) {
          const [br] = await db.select().from(budgetRequests).where(eq(budgetRequests.id, advance.sourceId)).limit(1);
          budgetRequestDetails = br || null;
          
          if (br && br.reviewedBy) {
             const [reviewer] = await db.select({ name: users.name }).from(users).where(eq(users.id, br.reviewedBy)).limit(1);
             reviewerName = reviewer?.name || null;
          }
      }
      
      const relatedInvoices = await db
        .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            kwota: invoices.kwota,
            status: invoices.status
        })
        .from(invoices)
        .where(eq(invoices.advanceId, input.id));

      const [previousAdvance] = await db
        .select({ amount: advances.amount, status: advances.status })
        .from(advances)
        .where(
            and(
                eq(advances.userId, advance.userId),
                lt(advances.createdAt, advance.createdAt)
            )
        )
        .orderBy(desc(advances.createdAt))
        .limit(1);
      
      return {
          ...advance,
          amount: parseFloat(advance.amount),
          userSaldo: parseFloat(advance.userSaldo || "0"),
          budgetRequest: budgetRequestDetails ? {
              ...budgetRequestDetails,
              requestedAmount: parseFloat(budgetRequestDetails.requestedAmount),
              currentBalanceAtRequest: parseFloat(budgetRequestDetails.currentBalanceAtRequest),
              reviewerName,
          } : null,
          // For compatibility with UI that expects 'invoices' list
          relatedInvoices: relatedInvoices.map(inv => ({
              ...inv,
              kwota: inv.kwota ? parseFloat(inv.kwota) : 0,
          })),
          previousAdvance: previousAdvance ? {
              amount: parseFloat(previousAdvance.amount),
              status: previousAdvance.status,
          } : null,
      };
    }),

  createManual: accountantProcedure
    .input(createManualAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Użytkownik nie znaleziony" });
      }

      const [advance] = await db
        .insert(advances)
        .values({
          userId: input.userId,
          companyId: input.companyId,
          amount: input.amount.toFixed(2),
          status: "pending",
          sourceType: "manual",
          description: input.description || "Manualna zaliczka od księgowego",
          createdBy: ctx.user.id,
        })
        .returning();

      return { success: true, advance };
    }),

  transfer: accountantProcedure
    .input(transferAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const [advance] = await db
        .select()
        .from(advances)
        .where(eq(advances.id, input.id))
        .limit(1);

      if (!advance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zaliczka nie znaleziona" });
      }

      if (advance.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tylko oczekujące zaliczki mogą być przetransferowane" });
      }

      await db.transaction(async (tx) => {
        // Update user saldo
        const [targetUser] = await tx
          .select({ saldo: users.saldo })
          .from(users)
          .where(eq(users.id, advance.userId))
          .limit(1);
          
        const currentSaldo = parseFloat(targetUser?.saldo || "0");
        const amount = parseFloat(advance.amount);
        
        await tx
          .update(users)
          .set({ 
            saldo: (currentSaldo + amount).toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(users.id, advance.userId));
          
        // Create Saldo Transaction record for history
        await tx.insert(saldoTransactions).values({
          userId: advance.userId,
          amount: advance.amount,
          balanceBefore: currentSaldo.toFixed(2),
          balanceAfter: (currentSaldo + amount).toFixed(2),
          transactionType: "advance_credit",
          referenceId: advance.id,
          notes: "Przyznana przez księgowego",
          createdBy: ctx.user.id,
        });

        // Update advance status
        await tx
          .update(advances)
          .set({
            status: "transferred",
            transferDate: new Date(),
            transferNumber: input.transferNumber ?? null,
            transferConfirmedBy: ctx.user.id,
            transferConfirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(advances.id, input.id));
      });

      return { success: true, message: "Zaliczka przetransferowana (saldo zaktualizowane)" };
    }),

  settle: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
       const [advance] = await db
        .select()
        .from(advances)
        .where(eq(advances.id, input.id))
        .limit(1);

      if (!advance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zaliczka nie znaleziona" });
      }

      if (advance.status !== "transferred") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tylko przetransferowane zaliczki mogą być rozliczone" });
      }
      
      await db.transaction(async (tx) => {
          // Mark advance as settled
          await tx
            .update(advances)
            .set({
                status: "settled",
                settledAt: new Date(),
                settledBy: ctx.user.id,
                updatedAt: new Date(),
            })
            .where(eq(advances.id, input.id));
            
          // Update linked invoices
          // When an advance is settled, accepted linked invoices become settled.
          const updatedInvoices = await tx
             .update(invoices)
             .set({
                 status: "settled",
                 settledAt: new Date(),
                 settledBy: ctx.user.id,
                 updatedAt: new Date(),
             })
             .where(
                 and(
                     eq(invoices.advanceId, input.id),
                     eq(invoices.status, "accepted")
                 )
             )
             .returning();
      });
      
      return { success: true, message: "Zaliczka rozliczona" };
    })
});
