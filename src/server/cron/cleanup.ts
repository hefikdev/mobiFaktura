import { db } from "@/server/db";
import { loginLogs, sessions, loginAttempts, invoices } from "@/server/db/schema";
import { lt, eq } from "drizzle-orm";
import { minioClient, BUCKET_NAME } from "@/server/storage/minio";
import { logCron, logError } from "@/lib/logger";

/**
 * Clean up login logs older than 30 days
 * This function is called automatically by the cron job
 */
export async function cleanOldLoginLogs() {
  const start = Date.now();
  logCron('cleanup_login_logs', 'started');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Safety check: ensure date is valid and in the past
    if (isNaN(thirtyDaysAgo.getTime()) || thirtyDaysAgo >= new Date()) {
      throw new Error('Invalid cleanup date calculated');
    }

    const result = await db
      .delete(loginLogs)
      .where(lt(loginLogs.createdAt, thirtyDaysAgo));

    const duration = Date.now() - start;
    logCron('cleanup_login_logs', 'completed', duration, {
      deletedBefore: thirtyDaysAgo.toISOString(),
    });
    
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    const duration = Date.now() - start;
    logCron('cleanup_login_logs', 'failed', duration);
    logError(error, { job: 'cleanup_login_logs' });
    return { success: false, error };
  }
}

/**
 * Clean up expired sessions
 * This function is called automatically by the cron job
 */
export async function cleanExpiredSessions() {
  const start = Date.now();
  logCron('cleanup_expired_sessions', 'started');
  
  try {
    const now = new Date();

    // Safety check: ensure we're only deleting expired sessions (not future ones)
    if (isNaN(now.getTime())) {
      throw new Error('Invalid current date');
    }

    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now));

    const duration = Date.now() - start;
    logCron('cleanup_expired_sessions', 'completed', duration);
    
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    const duration = Date.now() - start;
    logCron('cleanup_expired_sessions', 'failed', duration);
    logError(error, { job: 'cleanup_expired_sessions' });
    return { success: false, error };
  }
}

/**
 * Clean up old login attempts (30+ days)
 * This function is called automatically by the cron job
 */
export async function cleanOldLoginAttempts() {
  const start = Date.now();
  logCron('cleanup_login_attempts', 'started');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Safety check: ensure date is valid and in the past
    if (isNaN(thirtyDaysAgo.getTime()) || thirtyDaysAgo >= new Date()) {
      throw new Error('Invalid cleanup date calculated');
    }

    const result = await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.updatedAt, thirtyDaysAgo));

    const duration = Date.now() - start;
    logCron('cleanup_login_attempts', 'completed', duration, {
      deletedBefore: thirtyDaysAgo.toISOString(),
    });
    
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    const duration = Date.now() - start;
    logCron('cleanup_login_attempts', 'failed', duration);
    logError(error, { job: 'cleanup_login_attempts' });
    return { success: false, error };
  }
}

/**
 * Check for orphaned files in MinIO (files without corresponding database records)
 * WARNING: This is a read-only audit function - logs orphans but doesn't delete them
 */
export async function auditOrphanedFiles() {
  const start = Date.now();
  logCron('audit_orphaned_files', 'started');
  
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
    
    const duration = Date.now() - start;
    
    if (orphans.length > 0) {
      logCron('audit_orphaned_files', 'completed', duration, {
        orphanCount: orphans.length,
        totalFiles: minioFiles.length,
        orphans: orphans.slice(0, 10), // Log first 10 only
      });
    } else {
      logCron('audit_orphaned_files', 'completed', duration, {
        orphanCount: 0,
        totalFiles: minioFiles.length,
      });
    }
    
    return { success: true, orphanCount: orphans.length, orphans };
  } catch (error) {
    const duration = Date.now() - start;
    logCron('audit_orphaned_files', 'failed', duration);
    logError(error, { job: 'audit_orphaned_files' });
    return { success: false, error };
  }
}

/**
 * Reset invoices stuck in "in_review" status back to "pending"
 * This function is called automatically by the cron job at night
 * It helps prevent invoices from being stuck if a reviewer doesn't complete the review
 */
export async function resetStuckInReviewInvoices() {
  const start = Date.now();
  logCron('reset_stuck_in_review_invoices', 'started');
  
  try {
    // Find all invoices that are stuck in "in_review" status
    const result = await db
      .update(invoices)
      .set({
        status: "pending",
        currentReviewer: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.status, "in_review"))
      .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

    const duration = Date.now() - start;
    logCron('reset_stuck_in_review_invoices', 'completed', duration, {
      resetCount: result.length,
    });
    
    return { success: true, resetCount: result.length, invoices: result };
  } catch (error) {
    const duration = Date.now() - start;
    logCron('reset_stuck_in_review_invoices', 'failed', duration);
    logError(error, { job: 'reset_stuck_in_review_invoices' });
    return { success: false, error };
  }
}
