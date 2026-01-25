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
  description: z.string().trim().min(5, "Opis musi mieć co najmniej 5 znaków").max(2000, "Opis nie może przekraczać 2000 znaków"),
});

const transferAdvanceSchema = z.object({
  id: z.string().uuid(),
  transferNumber: z.string().max(255, "Numer przelewu nie może przekraczać 255 znaków").optional(),
});

export const advancesRouter = createTRPCRouter({
  // Get all advances
  getAll: accountantProcedure
    .input(z.object({
      status: z.enum(["all", "pending", "transferred", "settled"]).optional().default("all"),
      userId: z.string().uuid().optional(),
      limit: z.number().min(1).max(200).default(50),
      cursor: z.number().optional(),
      search: z.string().max(255, "Zapytanie nie może przekraczać 255 znaków").optional(),
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
    }),

  // Delete advance
  delete: accountantProcedure
    .input(z.object({ 
      id: z.string().uuid(),
      password: z.string().min(1),
      strategy: z.enum(["delete_with_invoices", "reassign_invoices"]),
      targetAdvanceId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { verifyPassword } = await import("@/server/auth/password");
      
      // Verify password
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Użytkownik nie znaleziony" });
      }

      const isPasswordValid = await verifyPassword(input.password, currentUser.passwordHash);
      if (!isPasswordValid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Nieprawidłowe hasło" });
      }

      // Get the advance to delete
      const [advance] = await db
        .select()
        .from(advances)
        .where(eq(advances.id, input.id))
        .limit(1);

      if (!advance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zaliczka nie znaleziona" });
      }

      // Get linked invoices
      const linkedInvoices = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.advanceId, input.id));

      if (input.strategy === "reassign_invoices") {
        // Validate target advance exists if reassignment is requested
        if (linkedInvoices.length > 0) {
          if (!input.targetAdvanceId) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: "Docelowa zaliczka jest wymagana przy przeniesieniu faktur" 
            });
          }

          const [targetAdvance] = await db
            .select()
            .from(advances)
            .where(eq(advances.id, input.targetAdvanceId))
            .limit(1);

          if (!targetAdvance) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Docelowa zaliczka nie znaleziona" });
          }

          if (targetAdvance.id === input.id) {
            throw new TRPCError({ 
              code: "BAD_REQUEST", 
              message: "Nie można przenieść faktur do tej samej zaliczki" 
            });
          }
        }
      }

      await db.transaction(async (tx) => {
        if (input.strategy === "delete_with_invoices") {
          // Delete linked invoices first and refund their saldo
          if (linkedInvoices.length > 0) {
            // Get full invoice details for saldo refunds
            const invoicesToDelete = await tx
              .select()
              .from(invoices)
              .where(eq(invoices.advanceId, input.id));

            // Process saldo refunds for each invoice
            for (const invoice of invoicesToDelete) {
              if (invoice.kwota && parseFloat(invoice.kwota) > 0) {
                const refundAmount = parseFloat(invoice.kwota);

                // Get current user saldo
                const [invoiceUser] = await tx
                  .select({ saldo: users.saldo, updatedAt: users.updatedAt })
                  .from(users)
                  .where(eq(users.id, invoice.userId))
                  .limit(1);

                if (invoiceUser) {
                  const balanceBefore = invoiceUser.saldo ? parseFloat(invoiceUser.saldo) : 0;
                  const balanceAfter = balanceBefore + refundAmount;
                  const lastUpdatedAt = invoiceUser.updatedAt;

                  // Update user saldo
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

                  if (saldoUpdateResult && saldoUpdateResult.length > 0) {
                    // Create saldo transaction record for refund
                    await tx.insert(saldoTransactions).values({
                      userId: invoice.userId,
                      amount: refundAmount.toFixed(2),
                      balanceBefore: balanceBefore.toFixed(2),
                      balanceAfter: balanceAfter.toFixed(2),
                      transactionType: "invoice_delete_refund",
                      referenceId: invoice.id,
                      notes: `Zwrot z usuniętej faktury ${invoice.invoiceNumber} (usunięcie zaliczki)`,
                      createdBy: ctx.user.id,
                    });
                  }
                }
              }
            }

            // Now delete the invoices
            await tx
              .delete(invoices)
              .where(eq(invoices.advanceId, input.id));
          }
        } else {
          // Reassign invoices to target advance
          if (linkedInvoices.length > 0 && input.targetAdvanceId) {
            await tx
              .update(invoices)
              .set({ 
                advanceId: input.targetAdvanceId,
                updatedAt: new Date(),
              })
              .where(eq(invoices.advanceId, input.id));
          }
        }

        // If advance was transferred, reverse the saldo transaction
        if (advance.status === "transferred" || advance.status === "settled") {
          const [advanceUser] = await tx
            .select({ saldo: users.saldo })
            .from(users)
            .where(eq(users.id, advance.userId))
            .limit(1);

          if (advanceUser) {
            const currentSaldo = parseFloat(advanceUser.saldo || "0");
            const amount = parseFloat(advance.amount);
            const newSaldo = currentSaldo - amount;

            // Update user saldo
            await tx
              .update(users)
              .set({ 
                saldo: newSaldo.toFixed(2),
                updatedAt: new Date(),
              })
              .where(eq(users.id, advance.userId));

            // Create reversal saldo transaction
            await tx.insert(saldoTransactions).values({
              userId: advance.userId,
              amount: (-amount).toFixed(2),
              balanceBefore: currentSaldo.toFixed(2),
              balanceAfter: newSaldo.toFixed(2),
              transactionType: "adjustment",
              referenceId: advance.id,
              notes: "Usunięcie zaliczki przez księgowego",
              createdBy: ctx.user.id,
            });
          }
        }

        // Delete the advance
        await tx
          .delete(advances)
          .where(eq(advances.id, input.id));
      });

      const deletedInvoicesCount = input.strategy === "delete_with_invoices" ? linkedInvoices.length : 0;
      const reassignedInvoicesCount = input.strategy === "reassign_invoices" ? linkedInvoices.length : 0;

      return { 
        success: true, 
        message: "Zaliczka została usunięta",
        deletedInvoicesCount,
        reassignedInvoicesCount,
      };
    })
});
