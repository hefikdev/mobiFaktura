import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, userProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { companies, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword } from "@/server/auth/password";
import { createNotification } from "@/server/lib/notifications";
import { getUserCompanies } from "@/server/permissions";

export const companyRouter = createTRPCRouter({
  // Get all active companies (for dropdown) - filtered by user permissions
  list: userProcedure.query(async ({ ctx }) => {
    // Get companies the user has access to
    const userCompanies = await getUserCompanies(ctx.user.id);
    return userCompanies;
  }),

  // Get all companies (admin only)
  listAll: adminProcedure.query(async ({ ctx }) => {

    const allCompanies = await db
      .select()
      .from(companies)
      .orderBy(companies.name);

    return allCompanies;
  }),

  // Create company (admin only)
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nazwa firmy jest wymagana").max(255, "Nazwa firmy nie może przekraczać 255 znaków"),
        nip: z.string().max(20, "NIP nie może przekraczać 20 znaków").optional(),
        address: z.string().max(50, "Adres nie może przekraczać 50 znaków").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [company] = await db
        .insert(companies)
        .values({
          name: input.name,
          nip: input.nip,
          address: input.address,
        })
        .returning();

      return company;
    }),

  // Update company (admin only with password confirmation)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255, "Nazwa firmy nie może przekraczać 255 znaków").optional(),
        nip: z.string().max(20, "NIP nie może przekraczać 20 znaków").optional(),
        address: z.string().max(50, "Adres nie może przekraczać 50 znaków").optional(),
        active: z.boolean().optional(),
        adminPassword: z.string().min(1, "Hasło administratora jest wymagane").max(30, "Hasło nie może przekraczać 30 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tylko administrator może edytować firmy",
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

      const { id, adminPassword, ...data } = input;

      // Get current company timestamp for optimistic locking
      const [currentCompany] = await db
        .select({ updatedAt: companies.updatedAt })
        .from(companies)
        .where(eq(companies.id, id))
        .limit(1);

      if (!currentCompany) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Firma nie została znaleziona",
        });
      }

      const [updated] = await db
        .update(companies)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(companies.id, id),
            eq(companies.updatedAt, currentCompany.updatedAt) // Optimistic lock
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Firma została zmodyfikowana przez innego administratora. Odśwież stronę i spróbuj ponownie.",
        });
      }

      // Create notification for company update
      await createNotification({
        userId: ctx.user.id,
        type: "company_updated",
        title: "Firma zaktualizowana",
        message: `Firma "${updated.name}" została zaktualizowana`,
        companyId: updated.id,
      });

      return updated;
    }),

  // Delete company (admin only with password confirmation)
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        adminPassword: z.string().min(1, "Hasło administratora jest wymagane"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tylko administrator może usuwać firmy",
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

      // Get company name before deletion
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, input.id))
        .limit(1);

      if (!company) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Firma nie została znaleziona",
        });
      }

      // Delete the company
      await db.delete(companies).where(eq(companies.id, input.id));

      // Create notification for company deletion
      await createNotification({
        userId: ctx.user.id,
        type: "company_updated",
        title: "Firma usunięta",
        message: `Firma "${company.name}" została usunięta z systemu`,
      });

      return { success: true, companyName: company.name };
    }),
});