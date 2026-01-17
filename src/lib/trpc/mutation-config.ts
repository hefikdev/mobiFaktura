/**
 * Global mutation configuration for tRPC with retry logic for conflict resolution
 * and error handling specific to financial operations
 */

/**
 * Check if an error should be retried
 */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  const maxRetries = 3;
  
  if (failureCount >= maxRetries) {
    return false;
  }

  // Check if error is a TRPCError with a retryable code
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "code" in error.data
  ) {
    const code = error.data.code as string;
    const retryableErrors = ["CONFLICT", "TIMEOUT"];
    return retryableErrors.includes(code);
  }

  return false;
}

/**
 * Get retry delay for a given attempt (exponential backoff)
 */
export function getRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}
