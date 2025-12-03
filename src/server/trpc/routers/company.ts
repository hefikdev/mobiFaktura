import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure, userProcedure } from "@/server/trpc/init";
import { db } from "@/server/db";
import { companies } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const companyRouter = createTRPCRouter({
  // Get all active companies (for dropdown)
  list: userProcedure.query(async () => {
    const activeCompanies = await db
      .select()
      .from(companies)
      .where(eq(companies.active, true))
      .orderBy(companies.name);

    return activeCompanies;
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
        name: z.string().min(1, "Nazwa firmy jest wymagana"),
        nip: z.string().optional(),
        address: z.string().optional(),
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

  // Update company (admin only)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        nip: z.string().optional(),
        address: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new Error("Tylko administrator może edytować firmy");
      }

      const { id, ...data } = input;

      const [updated] = await db
        .update(companies)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning();

      return updated;
    }),
});
