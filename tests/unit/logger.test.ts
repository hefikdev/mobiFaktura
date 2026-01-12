import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock server-only to work in test environment
vi.mock('server-only', () => ({}));

// Mock pino logger
vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

// Mock pino-pretty
vi.mock('pino-pretty', () => ({
  default: vi.fn(),
}));

import { logError, logRequest, logAuth, logDatabase, logCron } from '@/lib/logger';

describe('Logger Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logError', () => {
    it('should log Error objects', () => {
      const error = new Error('Test error message');
      
      expect(() => logError(error)).not.toThrow();
    });

    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'login' };
      
      expect(() => logError(error, context)).not.toThrow();
    });

    it('should handle string errors', () => {
      expect(() => logError('String error')).not.toThrow();
    });

    it('should handle null errors', () => {
      expect(() => logError(null)).not.toThrow();
    });

    it('should handle undefined errors', () => {
      expect(() => logError(undefined)).not.toThrow();
    });

    it('should handle objects as errors', () => {
      const error = { code: 'ERR_001', message: 'Custom error' };
      
      expect(() => logError(error)).not.toThrow();
    });

    it('should handle errors with additional properties', () => {
      const error = new Error('Test');
      Object.assign(error, { statusCode: 500, metadata: { foo: 'bar' } });
      
      expect(() => logError(error)).not.toThrow();
    });
  });

  describe('logRequest', () => {
    it('should log successful requests', () => {
      expect(() => logRequest(
        'GET',
        '/api/test',
        123,
        200
      )).not.toThrow();
    });

    it('should log failed requests', () => {
      expect(() => logRequest(
        'POST',
        '/api/error',
        456,
        500
      )).not.toThrow();
    });

    it('should log requests with user info', () => {
      expect(() => logRequest(
        'PUT',
        '/api/update',
        200,
        200,
        { userId: 'user-123' }
      )).not.toThrow();
    });

    it('should handle very short requests', () => {
      expect(() => logRequest(
        'GET',
        '/health',
        1,
        200
      )).not.toThrow();
    });

    it('should handle very long requests', () => {
      expect(() => logRequest(
        'POST',
        '/api/upload',
        30000,
        200
      )).not.toThrow();
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
      
      methods.forEach(method => {
        expect(() => logRequest(
          method,
          '/api/test',
          100,
          200
        )).not.toThrow();
      });
    });

    it('should handle different status codes', () => {
      const statusCodes = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503];
      
      statusCodes.forEach(statusCode => {
        expect(() => logRequest(
          'GET',
          '/api/test',
          100,
          statusCode
        )).not.toThrow();
      });
    });
  });

  describe('logAuth', () => {
    it('should log successful authentication', () => {
      expect(() => logAuth(
        'login',
        'user-123',
        { email: 'test@example.com', success: true }
      )).not.toThrow();
    });

    it('should log failed authentication', () => {
      expect(() => logAuth(
        'failed-login',
        undefined,
        { email: 'test@example.com', reason: 'Invalid credentials' }
      )).not.toThrow();
    });

    it('should log registration attempts', () => {
      expect(() => logAuth(
        'register',
        undefined,
        { email: 'newuser@example.com', success: true }
      )).not.toThrow();
    });

    it('should log logout events', () => {
      expect(() => logAuth(
        'logout',
        'user-123',
        { success: true }
      )).not.toThrow();
    });

    it('should log password reset attempts', () => {
      expect(() => logAuth(
        'session-check',
        undefined,
        { action: 'password_reset', email: 'user@example.com', success: true }
      )).not.toThrow();
    });

    it('should handle authentication with IP address', () => {
      expect(() => logAuth(
        'login',
        'user-123',
        { email: 'test@example.com', success: true, ip: '192.168.1.1' }
      )).not.toThrow();
    });

    it('should handle authentication with user agent', () => {
      expect(() => logAuth(
        'login',
        'user-123',
        { email: 'test@example.com', success: true, userAgent: 'Mozilla/5.0' }
      )).not.toThrow();
    });
  });

  describe('logDatabase', () => {
    it('should log successful database queries', () => {
      expect(() => logDatabase(
        'query',
        'users',
        50,
        { success: true }
      )).not.toThrow();
    });

    it('should log failed database queries', () => {
      expect(() => logDatabase(
        'insert',
        'invoices',
        100,
        { success: false, error: 'Constraint violation' }
      )).not.toThrow();
    });

    it('should handle different database operations', () => {
      const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'];
      
      operations.forEach(operation => {
        expect(() => logDatabase(
          operation as 'query',
          'test_table',
          50,
          { success: true }
        )).not.toThrow();
      });
    });

    it('should log queries with row count', () => {
      expect(() => logDatabase(
        'query',
        'users',
        75,
        { success: true, rowCount: 42 }
      )).not.toThrow();
    });

    it('should handle very slow queries', () => {
      expect(() => logDatabase(
        'query',
        'large_table',
        5000,
        { success: true }
      )).not.toThrow();
    });

    it('should handle very fast queries', () => {
      expect(() => logDatabase(
        'query',
        'cache',
        1,
        { success: true }
      )).not.toThrow();
    });
  });

  describe('logCron', () => {
    it('should log successful cron job execution', () => {
      expect(() => logCron(
        'cleanup',
        'completed',
        1000,
        { success: true }
      )).not.toThrow();
    });

    it('should log failed cron job execution', () => {
      expect(() => logCron(
        'cleanup',
        'failed',
        500,
        { error: 'Connection timeout' }
      )).not.toThrow();
    });

    it('should log cron job start', () => {
      expect(() => logCron(
        'email_notifications',
        'started'
      )).not.toThrow();
    });

    it('should log cron job with details', () => {
      expect(() => logCron(
        'data_sync',
        'completed',
        2500,
        { details: { recordsProcessed: 1500 } }
      )).not.toThrow();
    });

    it('should handle different cron job names', () => {
      const jobs = ['cleanup', 'sync', 'notifications', 'reports'];
      
      jobs.forEach(jobName => {
        expect(() => logCron(
          jobName,
          'completed',
          1000,
          { success: true }
        )).not.toThrow();
      });
    });

    it('should handle cron jobs with long durations', () => {
      expect(() => logCron(
        'monthly_report',
        'completed',
        60000,
        { success: true }
      )).not.toThrow();
    });

    it('should handle cron jobs with short durations', () => {
      expect(() => logCron(
        'health_check',
        'completed',
        10,
        { success: true }
      )).not.toThrow();
    });
  });
});
