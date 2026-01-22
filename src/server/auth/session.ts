import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { User, Session } from "@/server/db/schema";

// Validate JWT_SECRET on startup
if (!process.env.JWT_SECRET) {
  throw new Error(
    `JWT_SECRET environment variable is not set!\n` +
    `Generate a secure secret with:\n` +
    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "mobifaktura_session";
const SESSION_DURATION = 60 * 24 * 60 * 60 * 1000; // 60 days (2 months)

interface SessionPayload {
  sessionId: string;
  expiresAt: Date;
}

// Create JWT token
async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(JWT_SECRET);
}

// Verify JWT token
async function verifyToken(token: string): Promise<SessionPayload | undefined> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return undefined;
  }
}

// Create new session
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  // Create session in database
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      expiresAt,
    })
    .returning();

  if (!session) {
    throw new Error("Failed to create session");
  }

  // Create JWT token
  const token = await createToken({
    sessionId: session.id,
    expiresAt,
  });

  // Set cookie
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    expires: expiresAt,
    path: "/",
    ...(isProduction && process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
  });
}

// Get current session with user (cached per request)
export const getCurrentSession = cache(
  async (): Promise<{ session: Session; user: User } | undefined> => {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return undefined;
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return undefined;
    }

    // Get session with user from database
    const result = await db
      .select()
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, payload.sessionId),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    const row = result[0];
    if (!row) {
      return undefined;
    }

    return {
      session: row.sessions,
      user: row.users,
    };
  }
);

// Invalidate session
export async function invalidateSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      // Delete session from database
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
  }

  // Clear cookie
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Invalidate all sessions for a specific user (e.g., on password change)
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  // Delete all sessions for this user from database
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
