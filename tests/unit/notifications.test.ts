import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createNotification,
  notifyInvoiceAccepted,
  notifyInvoiceRejected,
  notifyInvoiceSubmitted,
  notifyInvoiceAssigned,
  notifyInvoiceReReview,
} from '@/server/lib/notifications';
import { db } from '@/server/db';

// Mock the database
vi.mock('@/server/db', () => ({
  db: {
    insert: vi.fn(),
  },
}));

describe('Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification with all fields', async () => {
      const mockNotification = {
        id: 'notif-123',
        userId: 'user-123',
        type: 'invoice_accepted',
        title: 'Test Title',
        message: 'Test Message',
        invoiceId: 'inv-123',
        companyId: 'comp-123',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await createNotification({
        userId: 'user-123',
        type: 'invoice_accepted',
        title: 'Test Title',
        message: 'Test Message',
        invoiceId: 'inv-123',
        companyId: 'comp-123',
      });

      expect(result).toEqual(mockNotification);
      expect(mockInsert).toHaveBeenCalledOnce();
    });

    it('should create a notification without optional fields', async () => {
      const mockNotification = {
        id: 'notif-124',
        userId: 'user-124',
        type: 'system',
        title: 'System Notice',
        message: 'System Message',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await createNotification({
        userId: 'user-124',
        type: 'system_message',
        title: 'System Notice',
        message: 'System Message',
      });

      expect(result).toEqual(mockNotification);
    });
  });

  describe('notifyInvoiceAccepted', () => {
    it('should create an invoice accepted notification', async () => {
      const mockNotification = {
        id: 'notif-125',
        userId: 'user-125',
        type: 'invoice_accepted',
        title: 'Faktura zaakceptowana',
        message: 'Twoja faktura INV-001 została zaakceptowana przez księgowego.',
        invoiceId: 'inv-125',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await notifyInvoiceAccepted('user-125', 'INV-001', 'inv-125');

      expect(result).toEqual(mockNotification);
      expect(result?.type).toBe('invoice_accepted');
      expect(result?.message).toContain('INV-001');
    });
  });

  describe('notifyInvoiceRejected', () => {
    it('should create an invoice rejected notification with reason', async () => {
      const mockNotification = {
        id: 'notif-126',
        userId: 'user-126',
        type: 'invoice_rejected',
        title: 'Faktura odrzucona',
        message: 'Twoja faktura INV-002 została odrzucona. Powód: Nieprawidłowa data',
        invoiceId: 'inv-126',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await notifyInvoiceRejected(
        'user-126',
        'INV-002',
        'inv-126',
        'Nieprawidłowa data'
      );

      expect(result).toEqual(mockNotification);
      expect(result?.type).toBe('invoice_rejected');
      expect(result?.message).toContain('INV-002');
      expect(result?.message).toContain('Nieprawidłowa data');
    });

    it('should handle special characters in rejection reason', async () => {
      const mockNotification = {
        id: 'notif-127',
        userId: 'user-127',
        type: 'invoice_rejected',
        title: 'Faktura odrzucona',
        message: 'Twoja faktura INV-003 została odrzucona. Powód: Brak podpisu & stempla',
        invoiceId: 'inv-127',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await notifyInvoiceRejected(
        'user-127',
        'INV-003',
        'inv-127',
        'Brak podpisu & stempla'
      );

      expect(result?.message).toContain('Brak podpisu & stempla');
    });
  });

  describe('notifyInvoiceSubmitted', () => {
    it('should create notifications for multiple accountants', async () => {
      const mockNotification = {
        id: 'notif-128',
        userId: 'accountant-1',
        type: 'invoice_submitted',
        title: 'Nowa faktura do weryfikacji',
        message: 'Użytkownik John Doe przesłał fakturę INV-004 do weryfikacji.',
        invoiceId: 'inv-128',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const accountantIds = ['accountant-1', 'accountant-2', 'accountant-3'];
      const results = await notifyInvoiceSubmitted(
        accountantIds,
        'INV-004',
        'inv-128',
        'John Doe'
      );

      expect(results).toHaveLength(3);
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });

    it('should handle empty accountant list', async () => {
      const results = await notifyInvoiceSubmitted([], 'INV-005', 'inv-129', 'Jane Doe');

      expect(results).toHaveLength(0);
    });

    it('should handle single accountant', async () => {
      const mockNotification = {
        id: 'notif-129',
        userId: 'accountant-1',
        type: 'invoice_submitted',
        title: 'Nowa faktura do weryfikacji',
        message: 'Użytkownik Jane Doe przesłał fakturę INV-006 do weryfikacji.',
        invoiceId: 'inv-130',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const results = await notifyInvoiceSubmitted(
        ['accountant-1'],
        'INV-006',
        'inv-130',
        'Jane Doe'
      );

      expect(results).toHaveLength(1);
      expect(mockInsert).toHaveBeenCalledOnce();
    });
  });

  describe('notifyInvoiceAssigned', () => {
    it('should create an invoice assigned notification', async () => {
      const mockNotification = {
        id: 'notif-130',
        userId: 'accountant-5',
        type: 'invoice_assigned',
        title: 'Przypisano fakturę',
        message: 'Została Ci przypisana faktura INV-007 do weryfikacji.',
        invoiceId: 'inv-131',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await notifyInvoiceAssigned('accountant-5', 'INV-007', 'inv-131');

      expect(result).toEqual(mockNotification);
      expect(result?.type).toBe('invoice_assigned');
      expect(result?.message).toContain('INV-007');
    });
  });

  describe('notifyInvoiceReReview', () => {
    it('should create a re-review notification', async () => {
      const mockNotification = {
        id: 'notif-131',
        userId: 'user-132',
        type: 'invoice_re_review',
        title: 'Faktura wymaga ponownej weryfikacji',
        message: 'Faktura INV-008 wymaga ponownej weryfikacji.',
        invoiceId: 'inv-132',
        read: false,
        createdAt: new Date(),
      };

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockNotification]),
        }),
      });
      (db.insert as any) = mockInsert;

      const result = await notifyInvoiceReReview('user-132', 'INV-008', 'inv-132');

      expect(result).toEqual(mockNotification);
      expect(result?.type).toBe('invoice_re_review');
    });
  });
});
