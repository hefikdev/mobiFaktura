import { describe, it, expect } from 'vitest';
import { shouldRetryMutation, getRetryDelay } from '@/lib/trpc/mutation-config';

describe('tRPC Mutation Configuration', () => {
  describe('shouldRetryMutation', () => {
    it('should not retry after max retries exceeded', () => {
      const error = {
        data: { code: 'CONFLICT' },
      };

      const result = shouldRetryMutation(3, error);

      expect(result).toBe(false);
    });

    it('should not retry after exactly max retries', () => {
      const error = {
        data: { code: 'CONFLICT' },
      };

      const result = shouldRetryMutation(3, error);

      expect(result).toBe(false);
    });

    it('should retry for CONFLICT errors within retry limit', () => {
      const error = {
        data: { code: 'CONFLICT' },
      };

      expect(shouldRetryMutation(0, error)).toBe(true);
      expect(shouldRetryMutation(1, error)).toBe(true);
      expect(shouldRetryMutation(2, error)).toBe(true);
    });

    it('should retry for TIMEOUT errors within retry limit', () => {
      const error = {
        data: { code: 'TIMEOUT' },
      };

      expect(shouldRetryMutation(0, error)).toBe(true);
      expect(shouldRetryMutation(1, error)).toBe(true);
      expect(shouldRetryMutation(2, error)).toBe(true);
    });

    it('should not retry for non-retryable errors', () => {
      const errors = [
        { data: { code: 'BAD_REQUEST' } },
        { data: { code: 'UNAUTHORIZED' } },
        { data: { code: 'FORBIDDEN' } },
        { data: { code: 'NOT_FOUND' } },
        { data: { code: 'INTERNAL_SERVER_ERROR' } },
      ];

      errors.forEach((error) => {
        expect(shouldRetryMutation(0, error)).toBe(false);
        expect(shouldRetryMutation(1, error)).toBe(false);
        expect(shouldRetryMutation(2, error)).toBe(false);
      });
    });

    it('should not retry for errors without code', () => {
      const error = {
        data: {},
      };

      expect(shouldRetryMutation(0, error)).toBe(false);
    });

    it('should not retry for errors without data', () => {
      const error = {
        message: 'Some error',
      };

      expect(shouldRetryMutation(0, error)).toBe(false);
    });

    it('should not retry for null or undefined errors', () => {
      expect(shouldRetryMutation(0, null)).toBe(false);
      expect(shouldRetryMutation(0, undefined)).toBe(false);
    });

    it('should not retry for string errors', () => {
      expect(shouldRetryMutation(0, 'Error message')).toBe(false);
    });

    it('should not retry for number errors', () => {
      expect(shouldRetryMutation(0, 404)).toBe(false);
    });

    it('should handle edge case of failure count at boundary', () => {
      const error = {
        data: { code: 'CONFLICT' },
      };

      expect(shouldRetryMutation(2, error)).toBe(true); // Last valid retry
      expect(shouldRetryMutation(3, error)).toBe(false); // Exceeded limit
      expect(shouldRetryMutation(4, error)).toBe(false); // Way exceeded
    });

    it('should handle malformed error structures', () => {
      const errors = [
        { data: { code: 123 } }, // code is number instead of string
        { data: null },
        { data: 'string' },
        { data: { wrongField: 'CONFLICT' } },
      ];

      errors.forEach((error) => {
        expect(shouldRetryMutation(0, error)).toBe(false);
      });
    });

    it('should be case sensitive for error codes', () => {
      const errors = [
        { data: { code: 'conflict' } }, // lowercase
        { data: { code: 'Conflict' } }, // mixed case
        { data: { code: 'CONFLICTS' } }, // plural
      ];

      errors.forEach((error) => {
        expect(shouldRetryMutation(0, error)).toBe(false);
      });
    });
  });

  describe('getRetryDelay', () => {
    it('should return exponential backoff delays', () => {
      expect(getRetryDelay(0)).toBe(1000); // 1s * 2^0 = 1s
      expect(getRetryDelay(1)).toBe(2000); // 1s * 2^1 = 2s
      expect(getRetryDelay(2)).toBe(4000); // 1s * 2^2 = 4s
      expect(getRetryDelay(3)).toBe(8000); // 1s * 2^3 = 8s
      expect(getRetryDelay(4)).toBe(16000); // 1s * 2^4 = 16s
    });

    it('should cap delay at 30 seconds', () => {
      expect(getRetryDelay(5)).toBe(30000); // Would be 32s, capped at 30s
      expect(getRetryDelay(6)).toBe(30000); // Would be 64s, capped at 30s
      expect(getRetryDelay(10)).toBe(30000); // Would be 1024s, capped at 30s
      expect(getRetryDelay(100)).toBe(30000); // Very large, capped at 30s
    });

    it('should handle zero attempt index', () => {
      expect(getRetryDelay(0)).toBe(1000);
    });

    it('should handle negative attempt index gracefully', () => {
      // Math.min will handle this: 2^(-1) = 0.5, so 500ms
      expect(getRetryDelay(-1)).toBe(500);
    });

    it('should provide reasonable delays for first few retries', () => {
      const delays = [0, 1, 2].map(getRetryDelay);
      
      expect(delays[0]).toBeLessThanOrEqual(2000); // First retry quick
      expect(delays[1]).toBeLessThanOrEqual(3000); // Second retry reasonable
      expect(delays[2]).toBeLessThanOrEqual(5000); // Third retry acceptable
    });

    it('should have increasing delays', () => {
      const delay0 = getRetryDelay(0);
      const delay1 = getRetryDelay(1);
      const delay2 = getRetryDelay(2);
      const delay3 = getRetryDelay(3);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should double each time until cap', () => {
      const delay0 = getRetryDelay(0);
      const delay1 = getRetryDelay(1);
      const delay2 = getRetryDelay(2);

      expect(delay1).toBe(delay0 * 2);
      expect(delay2).toBe(delay1 * 2);
    });

    it('should be consistent for same attempt index', () => {
      const delay1 = getRetryDelay(2);
      const delay2 = getRetryDelay(2);
      const delay3 = getRetryDelay(2);

      expect(delay1).toBe(delay2);
      expect(delay2).toBe(delay3);
    });
  });

  describe('Integration scenarios', () => {
    it('should simulate full retry sequence for conflict', () => {
      const error = { data: { code: 'CONFLICT' } };

      // Attempt 1 (failureCount = 0)
      expect(shouldRetryMutation(0, error)).toBe(true);
      expect(getRetryDelay(0)).toBe(1000);

      // Attempt 2 (failureCount = 1)
      expect(shouldRetryMutation(1, error)).toBe(true);
      expect(getRetryDelay(1)).toBe(2000);

      // Attempt 3 (failureCount = 2)
      expect(shouldRetryMutation(2, error)).toBe(true);
      expect(getRetryDelay(2)).toBe(4000);

      // Attempt 4 (failureCount = 3) - should not retry
      expect(shouldRetryMutation(3, error)).toBe(false);
    });

    it('should not retry non-retryable errors regardless of delay', () => {
      const error = { data: { code: 'UNAUTHORIZED' } };

      expect(shouldRetryMutation(0, error)).toBe(false);
      expect(shouldRetryMutation(1, error)).toBe(false);
      expect(shouldRetryMutation(2, error)).toBe(false);

      // Delays are still calculated but shouldn't be used
      expect(getRetryDelay(0)).toBeGreaterThan(0);
    });

    it('should handle timeout errors with appropriate delays', () => {
      const error = { data: { code: 'TIMEOUT' } };

      // Should retry with increasing delays
      expect(shouldRetryMutation(0, error)).toBe(true);
      expect(getRetryDelay(0)).toBe(1000);

      expect(shouldRetryMutation(1, error)).toBe(true);
      expect(getRetryDelay(1)).toBe(2000);

      expect(shouldRetryMutation(2, error)).toBe(true);
      expect(getRetryDelay(2)).toBe(4000);
    });

    it('should calculate total retry time for max retries', () => {
      // Total delay = 1000 + 2000 + 4000 = 7000ms = 7s
      const totalDelay = [0, 1, 2].reduce((sum, i) => sum + getRetryDelay(i), 0);
      
      expect(totalDelay).toBe(7000);
      expect(totalDelay).toBeLessThan(10000); // Less than 10 seconds total
    });
  });
});
