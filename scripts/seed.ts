import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as argon2 from "argon2";
import { users } from "../src/server/db/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  const connectionString = process.env.DATABASE_URL!;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Create test user
    const testUserPassword = await argon2.hash("TestUser123!", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const [testUser] = await db
      .insert(users)
      .values({
        email: "user@test.pl",
        passwordHash: testUserPassword,
        name: "Jan Kowalski",
        role: "user",
      })
      .onConflictDoNothing()
      .returning();

    if (testUser) {
      console.log("✅ Created test user:");
      console.log("   Email: user@test.pl");
      console.log("   Password: TestUser123!");
      console.log("   Role: user (mobile view)");
    }

    // Create test accountant
    const testAccountantPassword = await argon2.hash("TestAccountant123!", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const [testAccountant] = await db
      .insert(users)
      .values({
        email: "ksiegowy@test.pl",
        passwordHash: testAccountantPassword,
        name: "Anna Nowak",
        role: "accountant",
      })
      .onConflictDoNothing()
      .returning();

    if (testAccountant) {
      console.log("\n✅ Created test accountant:");
      console.log("   Email: ksiegowy@test.pl");
      console.log("   Password: TestAccountant123!");
      console.log("   Role: accountant (desktop view)");
    }

    // Create test admin
    const testAdminPassword = await argon2.hash("AdminSecure123!", {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const [testAdmin] = await db
      .insert(users)
      .values({
        email: "admin@test.pl",
        passwordHash: testAdminPassword,
        name: "Administrator",
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    if (testAdmin) {
      console.log("\n✅ Created test admin:");
      console.log("   Email: admin@test.pl");
      console.log("   Password: AdminSecure123!");
      console.log("   Role: admin (admin panel)");
    }

    console.log("\n🎉 Seeding completed!");
    await client.end();
    console.log("\n📝 You can now login with:");
    console.log("   User: user@test.pl / TestUser123!");
    console.log("   Accountant: ksiegowy@test.pl / TestAccountant123!");
    console.log("   Admin: admin@test.pl / AdminSecure123! (login at /admlogin)");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }

  process.exit(0);
}

seed();
