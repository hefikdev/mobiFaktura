import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { ZodError } from "zod";
import { getCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { headers } from "next/headers";
import { 
  globalRateLimit, 
  authRateLimit, 
  writeRateLimit, 
  readRateLimit,
  checkRateLimit 
} from "@/server/lib/rate-limit";
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

// Public procedure (no auth required) with rate limiting
export const publicProcedure = t.procedure
  .use(loggingMiddleware)
  .use(async ({ ctx, next }) => {
    // Apply global rate limit to all public procedures
    const identifier = `${ctx.ipAddress}:public`;
    try {
      await checkRateLimit(identifier, globalRateLimit);
    } catch (error) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: error instanceof Error ? error.message : "Zbyt wiele żądań",
      });
    }
    return next({ ctx });
  });

// Protected procedure (requires authentication) with rate limiting
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Musisz być zalogowany",
    });
  }
  
  // Apply global rate limit to authenticated users
  const identifier = `${ctx.ipAddress}:user:${ctx.user.id}`;
  try {
    await checkRateLimit(identifier, globalRateLimit);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: error instanceof Error ? error.message : "Zbyt wiele żądań",
    });
  }
  
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  });
});

// Accountant procedure (requires accountant role or admin) with rate limiting
export const accountantProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla księgowych",
      });
    }
    
    // Apply write rate limit for regular accountant operations
    const identifier = `${ctx.ipAddress}:accountant:${ctx.user.id}`;
    try {
      await checkRateLimit(identifier, writeRateLimit);
    } catch (error) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Zbyt wiele operacji. Spróbuj ponownie za chwilę.",
      });
    }
    
    return next({ ctx });
  }
);

// Accountant unlimited procedure (for bulk operations like batch reviews)
// No rate limiting - for operations that need to process many items
export const accountantUnlimitedProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla księgowych",
      });
    }
    
    // No rate limiting for bulk operations
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

// Admin procedure (requires admin role) with rate limiting for regular operations
export const adminProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla administratorów",
      });
    }
    
    // Apply write rate limit for regular admin operations
    const identifier = `${ctx.ipAddress}:admin:${ctx.user.id}`;
    try {
      await checkRateLimit(identifier, writeRateLimit);
    } catch (error) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Zbyt wiele operacji. Spróbuj ponownie za chwilę.",
      });
    }
    
    return next({ ctx });
  }
);

// Admin unlimited procedure (for bulk operations like bulk delete)
// No rate limiting - these operations are already protected by password verification
export const adminUnlimitedProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tylko dla administratorów",
      });
    }
    
    // No rate limiting for bulk operations
    return next({ ctx });
  }
);

// Auth procedure (for login/register) with stricter rate limiting
export const authProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const identifier = `${ctx.ipAddress}:auth`;
  try {
    await checkRateLimit(identifier, authRateLimit);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.",
    });
  }
  return next({ ctx });
});

// Write procedure (for mutations) with moderate rate limiting
export const writeProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const identifier = `${ctx.ipAddress}:user:${ctx.user.id}:write`;
  try {
    await checkRateLimit(identifier, writeRateLimit);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Zbyt wiele operacji zapisu. Spróbuj ponownie za chwilę.",
    });
  }
  return next({ ctx });
});

// Read procedure (for queries) with generous rate limiting
export const readProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const identifier = `${ctx.ipAddress}:user:${ctx.user.id}:read`;
  try {
    await checkRateLimit(identifier, readRateLimit);
  } catch (error) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Zbyt wiele żądań. Spróbuj ponownie za chwilę.",
    });
  }
  return next({ ctx });
});
