import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { headers } from "next/headers";

// Context creation
export const createTRPCContext = cache(async () => {
  const sessionData = await getCurrentSession();
  const headersList = await headers();
  
  // Extract IP address from headers (simple priority: forwarded-for > real-ip > localhost)
  const forwardedFor = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";
  
  // Extract user agent
  const userAgent = headersList.get("user-agent") || "unknown";

  return {
    db,
    session: sessionData?.session,
    user: sessionData?.user,
    ipAddress,
    userAgent,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Router and procedure helpers
export const createTRPCRouter = t.router;

// Public procedure (no auth required)
export const publicProcedure = t.procedure;

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany",
    });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  });
});

// Accountant procedure (requires accountant role or admin)
export const accountantProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla księgowych",
      });
    }
    return next({ ctx });
  }
);

// User procedure (requires user role or admin)
export const userProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "user" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla użytkowników",
      });
    }
    return next({ ctx });
  }
);

// Admin procedure (requires admin role)
export const adminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla administratorów",
      });
    }
    return next({ ctx });
  }
);
