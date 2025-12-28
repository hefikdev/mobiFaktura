/**
 * Simple In-Memory Rate Limiting
 * 
 * Lightweight rate limiting without external dependencies.
 * Suitable for single-server deployments and high-traffic applications.
 */

// Simple in-memory rate limiter
class MemoryRateLimiter {
  private cache: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.resetAt < now) {
        this.cache.delete(key);
      }
    }
  }

  async limit(identifier: string) {
    const now = Date.now();
    const entry = this.cache.get(identifier);

    if (!entry || entry.resetAt < now) {
      // New window
      this.cache.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: now + this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    // Increment counter
    entry.count++;
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - entry.count,
      reset: entry.resetAt,
    };
  }
}

// Rate limit configurations - generous for high traffic
const RATE_LIMITS = {
  // Global API rate limit - very generous for high traffic
  global: {
    requests: 300, // 300 requests per minute
    windowMs: 60000, // 1 minute
  },
  // Authentication endpoints - moderate to prevent brute force
  auth: {
    requests: 50, // 50 attempts per minute
    windowMs: 60000, // 1 minute
  },
  // Write operations - generous to not disrupt normal usage
  write: {
    requests: 100, // 100 requests per minute
    windowMs: 60000, // 1 minute
  },
  // Read operations - very generous for high traffic
  read: {
    requests: 500, // 500 requests per minute
    windowMs: 60000, // 1 minute
  },
} as const;

// Create rate limiters
export const globalRateLimit = new MemoryRateLimiter(
  RATE_LIMITS.global.requests,
  RATE_LIMITS.global.windowMs
);

export const authRateLimit = new MemoryRateLimiter(
  RATE_LIMITS.auth.requests,
  RATE_LIMITS.auth.windowMs
);

export const writeRateLimit = new MemoryRateLimiter(
  RATE_LIMITS.write.requests,
  RATE_LIMITS.write.windowMs
);

export const readRateLimit = new MemoryRateLimiter(
  RATE_LIMITS.read.requests,
  RATE_LIMITS.read.windowMs
);

/**
 * Get identifier for rate limiting
 * Uses IP address, falling back to user ID or random identifier
 */
export function getRateLimitIdentifier(
  request: Request,
  userId?: number
): string {
  // Try to get IP from headers (works with proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip =
    forwarded?.split(",")[0] || realIp || request.headers.get("host") || "unknown";

  // Use IP + user ID for authenticated requests, just IP for anonymous
  return userId ? `${ip}:user:${userId}` : ip;
}

/**
 * Check rate limit and throw error if exceeded
 */
export async function checkRateLimit(
  identifier: string,
  limiter: typeof globalRateLimit
): Promise<void> {
  const result = await limiter.limit(identifier);

  if (!result.success) {
    const resetDate = new Date(result.reset);
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

    throw new Error(
      `Rate limit exceeded. Try again in ${retryAfter} seconds (resets at ${resetDate.toISOString()})`
    );
  }
}

/**
 * Apply rate limit headers to response
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: {
    limit: number;
    remaining: number;
    reset: number;
  }
): void {
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", new Date(result.reset).toISOString());
  
  if (result.remaining === 0) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    headers.set("Retry-After", retryAfter.toString());
  }
}
