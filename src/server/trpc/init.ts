import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { headers } from "next/headers";
import { trpcLogger, logError } from "@/lib/logger";

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
  
  // Extract CSRF-related headers
  const origin = headersList.get("origin");
  const referer = headersList.get("referer");
  const host = headersList.get("host");

  return {
    db,
    session: sessionData?.session,
    user: sessionData?.user,
    ipAddress,
    userAgent,
    origin,
    referer,
    host,
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

// CSRF Protection middleware
const csrfMiddleware = t.middleware(async ({ ctx, next, type }) => {
  // Only check CSRF for mutations (mutations change state, queries don't)
  if (type === "query") {
    return next();
  }
  
  // For mutations, verify origin matches host (prevents CSRF attacks)
  const { origin, host } = ctx;
  
  // If origin header exists, validate it
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostName = host?.split(":")[0] || "";
      
      // Check if the origin hostname matches the request host
      if (!originUrl.hostname.includes(hostName)) {
        trpcLogger.warn({
          type: "csrf_attempt",
          origin,
          host,
          ip: ctx.ipAddress,
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "CSRF validation failed",
        });
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid CSRF origin",
      });
    }
  }
  
  return next();
});

// Logging middleware
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const userId = 'user' in ctx && ctx.user ? ctx.user.id : undefined;
  
  trpcLogger.info({
    type: 'request_start',
    procedure: path,
    procedureType: type,
    userId,
    ip: ctx.ipAddress,
  });

  try {
    const result = await next();
    const duration = Date.now() - start;
    
    trpcLogger.info({
      type: 'request_success',
      procedure: path,
      procedureType: type,
      userId,
      duration: `${duration}ms`,
      ip: ctx.ipAddress,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    trpcLogger.error({
      type: 'request_error',
      procedure: path,
      procedureType: type,
      userId,
      duration: `${duration}ms`,
      ip: ctx.ipAddress,
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        code: error instanceof TRPCError ? error.code : undefined,
      } : String(error),
    });
    
    throw error;
  }
});

// Public procedure (no auth required) with CSRF protection
export const publicProcedure = t.procedure
  .use(loggingMiddleware)
  .use(csrfMiddleware);

// Protected procedure (requires authentication) with CSRF protection
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(csrfMiddleware)
  .use(async ({ ctx, next }) => {
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
        origin: ctx.origin,
        referer: ctx.referer,
        host: ctx.host,
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

// Accountant unlimited procedure (for bulk operations)
export const accountantUnlimitedProcedure = protectedProcedure.use(
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

// Admin unlimited procedure (for bulk operations)
export const adminUnlimitedProcedure = protectedProcedure.use(
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

// Auth procedure (for login/register)
export const authProcedure = publicProcedure;

// Write procedure (for mutations)
export const writeProcedure = protectedProcedure;

// Read procedure (for queries)
export const readProcedure = protectedProcedure;
