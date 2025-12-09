import { db } from "@/server/db";
import { loginLogs, sessions, loginAttempts, invoices } from "@/server/db/schema";
import { lt } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/server/storage/minio";

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

/**
 * Clean up expired sessions
 * This function is called automatically by the cron job
 */
export async function cleanExpiredSessions() {
  try {
    const now = new Date();

    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now));

    console.log(`[CRON] Expired sessions cleanup completed at ${new Date().toISOString()}`);
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    console.error("[CRON] Error cleaning expired sessions:", error);
    return { success: false, error };
  }
}

/**
 * Clean up old login attempts (30+ days)
 * This function is called automatically by the cron job
 */
export async function cleanOldLoginAttempts() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.updatedAt, thirtyDaysAgo));

    console.log(`[CRON] Old login attempts cleanup completed at ${new Date().toISOString()}`);
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    console.error("[CRON] Error cleaning login attempts:", error);
    return { success: false, error };
  }
}

/**
 * Check for orphaned files in MinIO (files without corresponding database records)
 * WARNING: This is a read-only audit function - logs orphans but doesn't delete them
 */
export async function auditOrphanedFiles() {
  try {
    const stream = minioClient.listObjectsV2(BUCKET_NAME, '', true);
    const minioFiles: string[] = [];
    
    // Collect all MinIO file keys
    for await (const obj of stream) {
      if (obj.name) {
        minioFiles.push(obj.name);
      }
    }
    
    // Get all image keys from database
    const dbFiles = await db
      .select({ imageKey: invoices.imageKey })
      .from(invoices);
    
    const dbFileSet = new Set(dbFiles.map(f => f.imageKey));
    
    // Find orphans
    const orphans = minioFiles.filter(f => !dbFileSet.has(f));
    
    if (orphans.length > 0) {
      console.warn(`[CRON] Found ${orphans.length} orphaned files in MinIO`);
      console.warn(`[CRON] Orphaned files:`, orphans);
    } else {
      console.log(`[CRON] No orphaned files found in MinIO`);
    }
    
    return { success: true, orphanCount: orphans.length, orphans };
  } catch (error) {
    console.error("[CRON] Error auditing orphaned files:", error);
    return { success: false, error };
  }
}
