import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "@/server/trpc/init";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const notificationRouter = createTRPCRouter({
  // Get user's notifications
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(notifications.userId, ctx.user.id)];
      
      if (input.unreadOnly) {
        conditions.push(eq(notifications.read, false));
      }

      const userNotifications = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);

      return userNotifications;
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.read, false)
        )
      );

    return result.length;
  }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input.id))
        .limit(1);

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Powiadomienie nie znalezione",
        });
      }

      if (notification.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak dostępu",
        });
      }

      await db
        .update(notifications)
        .set({
          read: true,
          readAt: new Date(),
        })
        .where(eq(notifications.id, input.id));

      return { success: true };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.read, false)
        )
      );

    return { success: true };
  }),

  // Clear all notifications (delete all user's notifications)
  clearAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db
      .delete(notifications)
      .where(eq(notifications.userId, ctx.user.id));

    return { success: true };
  }),

  // Delete old notifications (older than 2 days) - should be called by cron
  deleteOld: protectedProcedure.mutation(async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    await db
      .delete(notifications)
      .where(lt(notifications.createdAt, twoDaysAgo));

    return { success: true };
  }),

  // Delete notification
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, input.id))
        .limit(1);

      if (!notification) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Powiadomienie nie znalezione",
        });
      }

      if (notification.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brak dostępu",
        });
      }

      await db.delete(notifications).where(eq(notifications.id, input.id));

      return { success: true };
    }),

  // Create notification (admin only)
  create: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        type: z.enum([
          "invoice_accepted",
          "invoice_rejected",
          "invoice_submitted",
          "invoice_assigned",
          "invoice_re_review",
          "system_message",
          "company_updated",
          "password_changed",
        ]),
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        invoiceId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [notification] = await db
        .insert(notifications)
        .values({
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          invoiceId: input.invoiceId,
          companyId: input.companyId,
        })
        .returning();

      return notification;
    }),

  // Send system-wide notification (admin only)
  sendSystemNotification: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        message: z.string().min(1),
        userRole: z.enum(["all", "user", "accountant", "admin"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Get all users or filtered by role
      let targetUsers;
      
      if (input.userRole && input.userRole !== "all") {
        const { users } = await import("@/server/db/schema");
        targetUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, input.userRole));
      } else {
        const { users } = await import("@/server/db/schema");
        targetUsers = await db.select({ id: users.id }).from(users);
      }

      // Create notification for each user
      const notificationPromises = targetUsers.map((user) =>
        db.insert(notifications).values({
          userId: user.id,
          type: "system_message",
          title: input.title,
          message: input.message,
        })
      );

      await Promise.all(notificationPromises);

      return { 
        success: true, 
        count: targetUsers.length,
        message: `Wysłano powiadomienie do ${targetUsers.length} użytkowników`
      };
    }),
});
