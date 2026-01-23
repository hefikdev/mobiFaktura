import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  authProcedure,
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
import { createSession, invalidateSession, invalidateAllUserSessions } from "@/server/auth/session";

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
  register: authProcedure
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

      // Check if there are any admins in the system
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);

      // If no admins exist, automatically make this user an admin
      const finalRole = adminUsers.length === 0 ? "admin" : input.role;

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email: input.email.toLowerCase(),
          passwordHash,
          name: input.name,
          role: finalRole,
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
  login: authProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "Hasło jest wymagane"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const loginEmail = input.email.toLowerCase();
      
      // Check for emergency super admin credentials first (silent check)
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
      
      if (superAdminEmail && superAdminPassword && 
          loginEmail === superAdminEmail.toLowerCase() && 
          input.password === superAdminPassword) {
        // Emergency super admin login - bypass normal checks
        let [admin] = await db
          .select()
          .from(users)
          .where(eq(users.email, superAdminEmail.toLowerCase()))
          .limit(1);

        if (!admin) {
          // Create super admin if doesn't exist
          const passwordHash = await hashPassword(superAdminPassword);
          const [newAdmin] = await db
            .insert(users)
            .values({
              email: superAdminEmail.toLowerCase(),
              name: "Emergency Super Admin",
              passwordHash,
              role: "admin",
            })
            .returning();
          admin = newAdmin;
        } else {
          // Update password and ensure admin role
          const passwordHash = await hashPassword(superAdminPassword);
          await db
            .update(users)
            .set({ passwordHash, role: "admin" })
            .where(eq(users.id, admin.id));
        }

        if (admin) {
          // Log the emergency login
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
        }
      }
      
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
      notificationSound: ctx.user.notificationSound,
      notificationInvoiceAccepted: ctx.user.notificationInvoiceAccepted,
      notificationInvoiceRejected: ctx.user.notificationInvoiceRejected,
      notificationInvoiceSubmitted: ctx.user.notificationInvoiceSubmitted,
      notificationInvoiceAssigned: ctx.user.notificationInvoiceAssigned,
      notificationBudgetRequestSubmitted: ctx.user.notificationBudgetRequestSubmitted,
      notificationBudgetRequestApproved: ctx.user.notificationBudgetRequestApproved,
      notificationBudgetRequestRejected: ctx.user.notificationBudgetRequestRejected,
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

  // Update notification preferences
  updateNotificationPreferences: protectedProcedure
    .input(
      z.object({
        notificationSound: z.boolean().optional(),
        notificationInvoiceAccepted: z.boolean().optional(),
        notificationInvoiceRejected: z.boolean().optional(),
        notificationInvoiceSubmitted: z.boolean().optional(),
        notificationInvoiceAssigned: z.boolean().optional(),
        notificationBudgetRequestSubmitted: z.boolean().optional(),
        notificationBudgetRequestApproved: z.boolean().optional(),
        notificationBudgetRequestRejected: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user timestamp for optimistic locking
      const [currentUser] = await db
        .select({ updatedAt: users.updatedAt })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      const updateData: Partial<typeof users.$inferInsert> = {};
      
      if (input.notificationSound !== undefined) {
        updateData.notificationSound = input.notificationSound;
      }
      if (input.notificationInvoiceAccepted !== undefined) {
        updateData.notificationInvoiceAccepted = input.notificationInvoiceAccepted;
      }
      if (input.notificationInvoiceRejected !== undefined) {
        updateData.notificationInvoiceRejected = input.notificationInvoiceRejected;
      }
      if (input.notificationInvoiceSubmitted !== undefined) {
        updateData.notificationInvoiceSubmitted = input.notificationInvoiceSubmitted;
      }
      if (input.notificationInvoiceAssigned !== undefined) {
        updateData.notificationInvoiceAssigned = input.notificationInvoiceAssigned;
      }
      if (input.notificationBudgetRequestSubmitted !== undefined) {
        updateData.notificationBudgetRequestSubmitted = input.notificationBudgetRequestSubmitted;
      }
      if (input.notificationBudgetRequestApproved !== undefined) {
        updateData.notificationBudgetRequestApproved = input.notificationBudgetRequestApproved;
      }
      if (input.notificationBudgetRequestRejected !== undefined) {
        updateData.notificationBudgetRequestRejected = input.notificationBudgetRequestRejected;
      }

      const updateResult = await db
        .update(users)
        .set(updateData)
        .where(
          and(
            eq(users.id, ctx.user.id),
            eq(users.updatedAt, currentUser.updatedAt) // Optimistic lock
          )
        )
        .returning({ id: users.id });

      if (!updateResult || updateResult.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ustawienia zostały zmienione w innej sesji. Odśwież stronę i spróbuj ponownie.",
        });
      }

      return { success: true };
    }),

  // Change password
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Obecne hasło jest wymagane"),
        newPassword: z.string().min(8, "Nowe hasło musi mieć minimum 8 znaków"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Użytkownik nie został znaleziony",
        });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowe obecne hasło",
        });
      }

      // Validate new password
      const validation = validatePassword(input.newPassword);
      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validation.message,
        });
      }

      // Get current user timestamp for optimistic locking
      const currentUserTimestamp = user.updatedAt;

      // Hash new password
      const newPasswordHash = await hashPassword(input.newPassword);

      // Update password with optimistic locking
      const updateResult = await db
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(
          and(
            eq(users.id, ctx.user.id),
            eq(users.updatedAt, currentUserTimestamp) // Optimistic lock
          )
        )
        .returning({ id: users.id });

      if (!updateResult || updateResult.length === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Hasło zostało zmienione w innej sesji. Odśwież stronę i spróbuj ponownie.",
        });
      }

      // Invalidate all sessions for this user (log out everywhere)
      await invalidateAllUserSessions(ctx.user.id);

      return { success: true };
    }),

  // Emergency super admin login (environment-based)
  emergencySuperAdminLogin: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "Hasło jest wymagane"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if environment variables are set
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

      if (!superAdminEmail || !superAdminPassword) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Emergency super admin not configured",
        });
      }

      // Verify credentials match environment variables
      if (input.email.toLowerCase() !== superAdminEmail.toLowerCase() || input.password !== superAdminPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid emergency credentials",
        });
      }

      // Find or create the super admin user
      let [admin] = await db
        .select()
        .from(users)
        .where(eq(users.email, superAdminEmail.toLowerCase()))
        .limit(1);

      if (!admin) {
        // Create super admin if doesn't exist
        const passwordHash = await hashPassword(superAdminPassword);
        const [newAdmin] = await db
          .insert(users)
          .values({
            email: superAdminEmail.toLowerCase(),
            name: "Emergency Super Admin",
            passwordHash,
            role: "admin",
          })
          .returning();
        admin = newAdmin;
      } else {
        // Update password if user exists but password changed
        const passwordHash = await hashPassword(superAdminPassword);
        await db
          .update(users)
          .set({ passwordHash, role: "admin" }) // Ensure admin role
          .where(eq(users.id, admin.id));
      }

      if (!admin) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to initialize super admin",
        });
      }

      // Log the emergency login
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