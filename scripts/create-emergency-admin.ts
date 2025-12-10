/**
 * Emergency Admin Creation Script
 * 
 * This script creates an emergency admin account directly in the database.
 * Use this when:
 * - All admin accounts are locked/lost
 * - Login system is broken
 * - Emergency access to data is needed
 * 
 * Usage:
 *   npm run create-emergency-admin
 * 
 * Or with custom credentials:
 *   ADMIN_EMAIL=custom@admin.com ADMIN_PASSWORD=CustomPass123! npm run create-emergency-admin
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as argon2 from "argon2";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function createEmergencyAdmin() {
  console.log("🚨 Emergency Admin Creation Tool\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  // Get credentials from environment or prompt
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;

  if (!email) {
    email = await question("Enter admin email: ");
  }

  if (!password) {
    password = await question("Enter admin password (min 8 chars): ");
  }

  // Validate inputs
  if (!email || !email.includes("@")) {
    console.error("❌ ERROR: Invalid email address");
    rl.close();
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error("❌ ERROR: Password must be at least 8 characters");
    rl.close();
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log("\n🔍 Checking if admin already exists...");

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Hash password
    console.log("🔐 Hashing password...");
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    if (existingUser) {
      console.log("⚠️  User already exists. Updating to admin role and password...");
      
      await db
        .update(users)
        .set({
          passwordHash,
          role: "admin",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      console.log("\n✅ Emergency admin updated successfully!");
    } else {
      console.log("➕ Creating new emergency admin...");
      
      const [newAdmin] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          name: "Emergency Admin",
          role: "admin",
        })
        .returning();

      if (!newAdmin) {
        throw new Error("Failed to create admin");
      }

      console.log("\n✅ Emergency admin created successfully!");
    }

    console.log("\n📋 Admin Credentials:");
    console.log("   Email:", email);
    console.log("   Password:", password);
    console.log("\n⚠️  IMPORTANT: Store these credentials securely!");
    console.log("💡 You can now login at /login");

    await client.end();
    rl.close();
  } catch (error) {
    console.error("\n❌ ERROR:", error);
    await client.end();
    rl.close();
    process.exit(1);
  }
}

createEmergencyAdmin();
