import { db } from "@/server/db";
import { loginLogs } from "@/server/db/schema";
import { lt } from "drizzle-orm";

/**
 * Clean up login logs older than 30 days
 * This function is called automatically by the cron job
 */
export async function cleanOldLoginLogs() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(loginLogs)
      .where(lt(loginLogs.createdAt, thirtyDaysAgo));

    console.log(`[CRON] Login logs cleanup completed at ${new Date().toISOString()}`);
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    console.error("[CRON] Error cleaning login logs:", error);
    return { success: false, error };
  }
}
