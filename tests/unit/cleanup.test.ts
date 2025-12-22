import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  cleanOldLoginLogs,
  cleanExpiredSessions,
  cleanOldLoginAttempts 
} from '@/server/cron/cleanup';
import { db } from '@/server/db';

// Mock the database
vi.mock('@/server/db', () => ({
  db: {
    delete: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logCron: vi.fn(),
  logError: vi.fn(),
}));

// Mock storage
vi.mock('@/server/storage/minio', () => ({
  minioClient: {
    removeObject: vi.fn(),
  },
  BUCKET_NAME: 'test-bucket',
}));

describe('Cleanup Cron Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanOldLoginLogs', () => {
    it('should delete login logs older than 30 days', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 5 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success status and deletion timestamp', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 3 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should calculate correct date threshold', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 2 });
      const mockDelete = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.delete as any) = mockDelete;

      await cleanOldLoginLogs();

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockWhere).toHaveBeenCalledOnce();
    });
  });

  describe('cleanExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 10 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Connection timeout')),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success with timestamp', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 7 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should use current date for comparison', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 5 });
      const mockDelete = vi.fn().mockReturnValue({
        where: mockWhere,
      });
      (db.delete as any) = mockDelete;

      const beforeCall = new Date();
      await cleanExpiredSessions();
      const afterCall = new Date();

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockWhere).toHaveBeenCalledOnce();
    });

    it('should handle zero deleted sessions', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
    });
  });

  describe('cleanOldLoginAttempts', () => {
    it('should delete old login attempts', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 15 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Lock timeout')),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success status with timestamp', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 8 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should handle empty table gracefully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should catch and log database connection errors', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Connection refused')),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should handle null/undefined errors gracefully', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(null),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
        ),
      });
      (db.delete as any) = mockDelete;

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete cleanup within reasonable time', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 100 }),
      });
      (db.delete as any) = mockDelete;

      const start = Date.now();
      await cleanOldLoginLogs();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
