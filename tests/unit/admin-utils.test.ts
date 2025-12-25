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
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const count = await getAdminCount();

      expect(count).toBe(3);
      expect(db.select).toHaveBeenCalledOnce();
    });

    it('should return 0 when no admins exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const count = await getAdminCount();

      expect(count).toBe(0);
    });

    it('should handle empty result', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const count = await getAdminCount();

      expect(count).toBe(0);
    });
  });

  describe('hasAdmins', () => {
    it('should return true when admins exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await hasAdmins();

      expect(result).toBe(true);
    });

    it('should return false when no admins exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await hasAdmins();

      expect(result).toBe(false);
    });
  });

  describe('isUserAdmin', () => {
    it('should return true for admin users', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await isUserAdmin('user-123');

      expect(result).toBe(true);
    });

    it('should return false for non-admin users', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'user' }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await isUserAdmin('user-123');

      expect(result).toBe(false);
    });

    it('should return false for accountant users', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ role: 'accountant' }]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await isUserAdmin('user-123');

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

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

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockAdmins),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await getAllAdmins();

      expect(result).toEqual(mockAdmins);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no admins exist', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await getAllAdmins();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
