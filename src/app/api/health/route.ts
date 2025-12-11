import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";
import { apiLogger, logError } from "@/lib/logger";

/**
 * Health Check Endpoint
 * Used by load balancers and monitoring systems to verify app health
 * 
 * Returns:
 * - 200: All systems operational
 * - 503: Service unavailable (DB connection failed)
 */
export async function GET() {
  const startTime = Date.now();
  
  apiLogger.debug({ type: 'health_check_start' });
  
  try {
    // Check database connection
    const dbCheck = await db.execute(sql`SELECT 1 as health`);
    const dbHealthy = dbCheck.rows.length > 0;

    if (!dbHealthy) {
      return NextResponse.json(
        {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          checks: {
            database: "failed",
          },
        },
        { status: 503 }
      );
    }

    // Check MinIO connection (optional - won't fail health check)
    let minioHealthy = "unknown";
    try {
      const { minioClient } = await import("@/server/storage/minio");
      await minioClient.listBuckets();
      minioHealthy = "healthy";
    } catch (error) {
      minioHealthy = "degraded";
      // MinIO failure doesn't fail the health check
    }

    const responseTime = Date.now() - startTime;

    apiLogger.info({
      type: 'health_check_success',
      duration: `${responseTime}ms`,
      database: 'healthy',
      storage: minioHealthy,
    });

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        checks: {
          database: "healthy",
          storage: minioHealthy,
        },
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV,
      },
      { 
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    logError(error, {
      type: 'health_check_failed',
      duration: `${Date.now() - startTime}ms`,
    });
    
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        checks: {
          database: "failed",
        },
      },
      { status: 503 }
    );
  }
}

// Disable caching for health endpoint
export const dynamic = "force-dynamic";
export const revalidate = 0;
