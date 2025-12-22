import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAdminCount, hasAdmins, isUserAdmin, getAllAdmins } from '@/server/lib/admin-utils';
import { db } from '@/server/db';

// Mock the database
vi.mock('@/server/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('Admin Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdminCount', () => {
    it('should return the count of admin users', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });
      (db.select as any) = mockSelect;

      const count = await getAdminCount();

      expect(count).toBe(3);
      expect(mockSelect).toHaveBeenCalledOnce();
    });

    it('should return 0 when no admins exist', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });
      (db.select as any) = mockSelect;

      const count = await getAdminCount();

      expect(count).toBe(0);
    });

    it('should handle empty result', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any) = mockSelect;

      const count = await getAdminCount();

      expect(count).toBe(0);
    });
  });

  describe('hasAdmins', () => {
    it('should return true when admins exist', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await hasAdmins();

      expect(result).toBe(true);
    });

    it('should return false when no admins exist', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await hasAdmins();

      expect(result).toBe(false);
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for admin users', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
          }),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await isUserAdmin('user-123');

      expect(result).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'user' }]),
          }),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await isUserAdmin('user-123');

      expect(result).toBe(false);
    });

    it('should return false for accountant users', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'accountant' }]),
          }),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await isUserAdmin('user-123');

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await isUserAdmin('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAllAdmins', () => {
    it('should return all admin users', async () => {
      const mockAdmins = [
        { id: 'admin-1', email: 'admin1@test.com', name: 'Admin 1', createdAt: new Date() },
        { id: 'admin-2', email: 'admin2@test.com', name: 'Admin 2', createdAt: new Date() },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockAdmins),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await getAllAdmins();

      expect(result).toEqual(mockAdmins);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no admins exist', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db.select as any) = mockSelect;

      const result = await getAllAdmins();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
