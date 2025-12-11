import { 
  cleanOldLoginLogs, 
  cleanExpiredSessions, 
  cleanOldLoginAttempts,
  auditOrphanedFiles 
} from "./cleanup";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { lt } from "drizzle-orm";
import { logCron, logError } from "@/lib/logger";

/**
 * Clean old notifications (older than 2 days)
 */
export async function cleanOldNotifications() {
  const start = Date.now();
  logCron('cleanup_old_notifications', 'started');
  
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, twoDaysAgo));

    const duration = Date.now() - start;
    logCron('cleanup_old_notifications', 'completed', duration, {
      deletedBefore: twoDaysAgo.toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - start;
    logCron('cleanup_old_notifications', 'failed', duration);
    logError(error, { job: 'cleanup_old_notifications' });
  }
}

/**
 * Initialize all cron jobs
 * Runs cleanup tasks on a schedule
 */
export function initCronJobs() {
  // Run cleanup daily at 1 AM
  const runDailyCleanup = () => {
    const now = new Date();
    const nextRun = new Date();
    
    // Set to 1 AM
    nextRun.setHours(1, 0, 0, 0);
    
    // If we've passed 1 AM today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const msUntilNextRun = nextRun.getTime() - now.getTime();
    
    console.log(`[CRON] Next cleanup scheduled for: ${nextRun.toISOString()}`);
    
    setTimeout(() => {
      cleanOldLoginLogs();
      cleanOldNotifications();
      cleanExpiredSessions();
      cleanOldLoginAttempts();
      auditOrphanedFiles();
      
      // Schedule next run (24 hours)
      setInterval(() => {
        cleanOldLoginLogs();
        cleanOldNotifications();
        cleanExpiredSessions();
        cleanOldLoginAttempts();
        auditOrphanedFiles();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextRun);
  };

  // Start the cleanup schedule
  runDailyCleanup();
  
  console.log("[CRON] Cron jobs initialized successfully");
}
