import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, loginLogs, loginAttempts } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
} from "@/server/auth/password";
import { createSession, invalidateSession } from "@/server/auth/session";

// Validation schemas
const emailSchema = z.string().email("Nieprawidłowy adres email");
const passwordSchema = z.string().min(8, "Hasło musi mieć minimum 8 znaków");

// Login attempt constants
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

// Helper function to check and update login attempts
async function checkLoginAttempts(identifier: string): Promise<{ 
  isLocked: boolean; 
  remainingTime?: number;
  remainingAttempts?: number;
}> {
  const now = new Date();
  
  // Find existing attempt record
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (!attempt) {
    return { isLocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  // Check if currently locked
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    const remainingTime = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000);
    return { isLocked: true, remainingTime };
  }

  // If lock expired, reset attempts
  if (attempt.lockedUntil && attempt.lockedUntil <= now) {
    await db
      .update(loginAttempts)
      .set({
        attemptCount: "0",
        lockedUntil: null,
        updatedAt: now,
      })
      .where(eq(loginAttempts.id, attempt.id));
    return { isLocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  const currentAttempts = parseInt(attempt.attemptCount);
  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - currentAttempts);
  return { isLocked: false, remainingAttempts };
}

// Helper function to record failed login attempt
async function recordFailedAttempt(identifier: string): Promise<void> {
  const now = new Date();
  
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (!attempt) {
    // Create new attempt record
    await db.insert(loginAttempts).values({
      identifier,
      attemptCount: "1",
      updatedAt: now,
    });
  } else {
    const currentAttempts = parseInt(attempt.attemptCount);
    const newAttempts = currentAttempts + 1;

    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock the account
      const lockUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
      await db
        .update(loginAttempts)
        .set({
          attemptCount: String(newAttempts),
          lockedUntil: lockUntil,
          updatedAt: now,
        })
        .where(eq(loginAttempts.id, attempt.id));
    } else {
      // Increment attempt count
      await db
        .update(loginAttempts)
        .set({
          attemptCount: String(newAttempts),
          updatedAt: now,
        })
        .where(eq(loginAttempts.id, attempt.id));
    }
  }
}

// Helper function to reset login attempts on successful login
async function resetLoginAttempts(identifier: string): Promise<void> {
  await db
    .update(loginAttempts)
    .set({
      attemptCount: "0",
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(loginAttempts.identifier, identifier));
}

export const authRouter = createTRPCRouter({
  // Register new user
  register: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().min(2, "Imię musi mieć minimum 2 znaki"),
        role: z.enum(["user", "accountant"]).default("user"),
      })
    )
    .mutation(async ({ input }) => {
      // Validate password strength
      const passwordValidation = validatePassword(input.password);
      if (!passwordValidation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: passwordValidation.message,
        });
      }

      // Check if user exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Użytkownik o tym adresie email już istnieje",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          role: input.role,
        })
        .returning({ id: users.id, email: users.email, role: users.role });

      if (!newUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Nie udało się utworzyć konta",
        });
      }

      // Create session
      await createSession(newUser.id);

      return {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      };
    }),

  // Login
  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "Hasło jest wymagane"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const loginEmail = input.email.toLowerCase();
      
      // Check login attempts
      const attemptStatus = await checkLoginAttempts(loginEmail);
      if (attemptStatus.isLocked) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${attemptStatus.remainingTime} sekund.`,
        });
      }
      
      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, loginEmail))
        .limit(1);

      if (!user) {
        // Record failed attempt
        await recordFailedAttempt(loginEmail);
        
        // Log failed login attempt
        await db.insert(loginLogs).values({
          email: loginEmail,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          success: false,
          userId: null,
        });
        
        // Get updated attempt status for user feedback
        const updatedStatus = await checkLoginAttempts(loginEmail);
        const remainingAttempts = updatedStatus.remainingAttempts || 0;
        
        if (remainingAttempts > 0) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Nieprawidłowy email lub hasło. Pozostało prób: ${remainingAttempts}`,
          });
        } else {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Nieprawidłowy email lub hasło. Konto zablokowane na 30 sekund.",
          });
        }
      }

      // Verify password
      const isValid = await verifyPassword(user.passwordHash, input.password);
      if (!isValid) {
        // Record failed attempt
        await recordFailedAttempt(loginEmail);
        
        // Log failed login attempt
        await db.insert(loginLogs).values({
          email: loginEmail,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          success: false,
          userId: user.id,
        });
        
        // Get updated attempt status for user feedback
        const updatedStatus = await checkLoginAttempts(loginEmail);
        const remainingAttempts = updatedStatus.remainingAttempts || 0;
        
        if (remainingAttempts > 0) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: `Nieprawidłowy email lub hasło. Pozostało prób: ${remainingAttempts}`,
          });
        } else {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Nieprawidłowy email lub hasło. Konto zablokowane na 30 sekund.",
          });
        }
      }

      // Reset login attempts on successful login
      await resetLoginAttempts(loginEmail);

      // Log successful login
      await db.insert(loginLogs).values({
        email: loginEmail,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        success: true,
        userId: user.id,
      });

      // Create session
      await createSession(user.id);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }),

  // Logout
  logout: protectedProcedure.mutation(async () => {
    await invalidateSession();
    return { success: true };
  }),

  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      createdAt: ctx.user.createdAt,
    };
  }),

  // Dev admin login (development only)
  devAdminLogin: publicProcedure.mutation(async ({ ctx }) => {
    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Dev login only available in development mode",
      });
    }

    // Find or create dev admin
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, "dev@admin.com"))
      .limit(1);

    let admin = existingAdmin;

    if (!admin) {
      // Create dev admin if doesn't exist
      const passwordHash = await hashPassword("dev123");
      const [newAdmin] = await db
        .insert(users)
        .values({
          email: "dev@admin.com",
          name: "Dev Admin",
          passwordHash,
          role: "admin",
        })
        .returning();
      admin = newAdmin;
    }

    if (!admin) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create dev admin",
      });
    }

    // Log the dev login
    await db.insert(loginLogs).values({
      email: admin.email,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      success: true,
      userId: admin.id,
    });

    // Create session
    await createSession(admin.id);

    return {
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }),
});
