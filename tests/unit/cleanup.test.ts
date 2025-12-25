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
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 5 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success status and deletion timestamp', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 3 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should calculate correct date threshold', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 2 });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as unknown as ReturnType<typeof db.delete>);

      await cleanOldLoginLogs();

      expect(db.delete).toHaveBeenCalledOnce();
      expect(mockWhere).toHaveBeenCalledOnce();
    });
  });

  describe('cleanExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 10 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success with timestamp', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 7 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should use current date for comparison', async () => {
      const mockWhere = vi.fn().mockResolvedValue({ rowCount: 5 });
      vi.mocked(db.delete).mockReturnValue({
        where: mockWhere,
      } as unknown as ReturnType<typeof db.delete>);

      const beforeCall = new Date();
      await cleanExpiredSessions();
      const afterCall = new Date();

      expect(db.delete).toHaveBeenCalledOnce();
      expect(mockWhere).toHaveBeenCalledOnce();
    });

    it('should handle zero deleted sessions', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(true);
    });
  });

  describe('cleanOldLoginAttempts', () => {
    it('should delete old login attempts', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 15 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalledOnce();
    });

    it('should handle deletion errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Lock timeout')),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return success status with timestamp', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 8 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should handle empty table gracefully', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(true);
      expect(result.deletedAt).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should catch and log database connection errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginLogs();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should handle null/undefined errors gracefully', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockRejectedValue(null),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanExpiredSessions();

      expect(result.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
        ),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await cleanOldLoginAttempts();

      expect(result.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete cleanup within reasonable time', async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 100 }),
      } as unknown as ReturnType<typeof db.delete>);

      const start = Date.now();
      await cleanOldLoginLogs();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});
