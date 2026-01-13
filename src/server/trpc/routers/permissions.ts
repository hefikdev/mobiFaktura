import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, companies, userCompanyPermissions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  grantCompanyPermission,
  revokeCompanyPermission,
  getUserPermissions,
  setUserPermissions,
} from "@/server/permissions";

export const permissionsRouter = createTRPCRouter({
  // Get all users with their company permissions
  getAllUserPermissions: adminProcedure.query(async ({ ctx }) => {
    // Get all regular users (not admin or accountant)
    const regularUsers = await db.query.users.findMany({
      where: eq(users.role, "user"),
      columns: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: (users, { asc }) => [asc(users.name)],
    });

    // Get permissions for all users in one query
    const allPermissions = await db
      .select()
      .from(userCompanyPermissions);

    const permissionsMap = new Map(
      allPermissions.map((p) => [p.userId, p.companyIds])
    );

    // Get all companies for name lookup
    const allCompanies = await db.query.companies.findMany({
      where: eq(companies.active, true),
    });

    const companiesMap = new Map(allCompanies.map((c) => [c.id, c.name]));

    return regularUsers.map((user) => {
      const userCompanyIds = permissionsMap.get(user.id) || [];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        permissions: userCompanyIds.map((companyId) => ({
          companyId,
          companyName: companiesMap.get(companyId) || "Unknown",
        })),
      };
    });
  }),

  // Get permissions for a specific user
  getUserPermissions: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const permissions = await getUserPermissions(input.userId);
      return permissions;
    }),

  // Grant permission to a user for a company
  grantPermission: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        companyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await grantCompanyPermission(
          input.userId,
          input.companyId,
          ctx.user.id
        );
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to grant permission",
        });
      }
    }),

  // Revoke permission from a user for a company
  revokePermission: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        companyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeCompanyPermission(
          input.userId,
          input.companyId,
          ctx.user.id
        );
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to revoke permission",
        });
      }
    }),

  // Set all permissions for a user (replaces existing)
  setUserPermissions: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        companyIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await setUserPermissions(
          input.userId,
          input.companyIds,
          ctx.user.id
        );
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set permissions",
        });
      }
    }),

  // Get all available companies
  getAllCompanies: adminProcedure.query(async () => {
    const allCompanies = await db.query.companies.findMany({
      where: eq(companies.active, true),
      orderBy: (companies, { asc }) => [asc(companies.name)],
    });
    return allCompanies;
  }),

  // Bulk update permissions for multiple users
  bulkUpdatePermissions: adminProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            userId: z.string(),
            companyIds: z.array(z.string()),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Process each user update
        for (const update of input.updates) {
          await setUserPermissions(
            update.userId,
            update.companyIds,
            ctx.user.id
          );
        }
        return { success: true };
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update permissions",
        });
      }
    }),
});
