import { cleanOldLoginLogs } from "./cleanup";

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
    
    console.log(`[CRON] Next login logs cleanup scheduled for: ${nextRun.toISOString()}`);
    
    setTimeout(() => {
      cleanOldLoginLogs();
      // Schedule next run (24 hours)
      setInterval(() => {
        cleanOldLoginLogs();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextRun);
  };

  // Start the cleanup schedule
  runDailyCleanup();
  
  console.log("[CRON] Cron jobs initialized successfully");
}
