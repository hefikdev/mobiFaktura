/**
 * Instrumentation file for Next.js
 * This file is automatically loaded when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server-side
    const { initCronJobs } = await import('./server/cron');
    initCronJobs();
  }
}
