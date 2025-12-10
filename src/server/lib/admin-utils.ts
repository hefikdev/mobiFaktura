import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Get the count of admin users in the system
 */
export async function getAdminCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  
  return result[0]?.count ?? 0;
}

/**
 * Check if the system has at least one admin
 */
export async function hasAdmins(): Promise<boolean> {
  const count = await getAdminCount();
  return count > 0;
}

/**
 * Check if a specific user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user?.role === "admin";
}

/**
 * Get all admin users
 */
export async function getAllAdmins() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "admin"));
}
