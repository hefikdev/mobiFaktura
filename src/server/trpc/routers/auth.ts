import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, loginLogs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  validatePassword,
} from "@/server/auth/password";
import { createSession, invalidateSession } from "@/server/auth/session";

// Validation schemas
const emailSchema = z.string().email("Nieprawidłowy adres email");
const passwordSchema = z.string().min(8, "Hasło musi mieć minimum 8 znaków");

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
      
      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, loginEmail))
        .limit(1);

      if (!user) {
        // Log failed login attempt
        await db.insert(loginLogs).values({
          email: loginEmail,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          success: false,
          userId: null,
        });
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowy email lub hasło",
        });
      }

      // Verify password
      const isValid = await verifyPassword(user.passwordHash, input.password);
      if (!isValid) {
        // Log failed login attempt
        await db.insert(loginLogs).values({
          email: loginEmail,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          success: false,
          userId: user.id,
        });
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Nieprawidłowy email lub hasło",
        });
      }

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
