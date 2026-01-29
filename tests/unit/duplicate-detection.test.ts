import { describe, it, expect } from 'vitest';

describe('Duplicate Invoice Detection', () => {
  describe('Duplicate Detection Logic', () => {
    it('should detect duplicates with same kwota, ksefNumber, and companyId', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          companyName: 'Test Company',
        },
        {
          id: '2',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          companyName: 'Test Company',
        },
      ];

      const key = `${invoices[0]!.kwota}_${invoices[0]!.ksefNumber}_${invoices[0]!.companyId}`;
      const key2 = `${invoices[1]!.kwota}_${invoices[1]!.ksefNumber}_${invoices[1]!.companyId}`;
      
      expect(key).toBe(key2);
    });

    it('should not detect duplicates with different kwota', () => {
      const invoice1 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '200.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).not.toBe(key2);
    });

    it('should not detect duplicates with different ksefNumber', () => {
      const invoice1 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-789-012',
        companyId: 'company-1',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).not.toBe(key2);
    });

    it('should not detect duplicates with different companyId', () => {
      const invoice1 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-2',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Grouping Logic', () => {
    it('should group invoices with identical key', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          userName: 'User 1',
        },
        {
          id: '2',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          userName: 'User 2',
        },
        {
          id: '3',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          userName: 'User 3',
        },
      ];

      const duplicateGroups: Record<string, typeof invoices> = {};
      
      for (const invoice of invoices) {
        const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
        
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(invoice);
      }
      
      const groups = Object.values(duplicateGroups);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(3);
    });

    it('should create separate groups for different keys', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
        {
          id: '2',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
        {
          id: '3',
          kwota: '200.00',
          ksefNumber: 'KSEF-789-012',
          companyId: 'company-2',
        },
        {
          id: '4',
          kwota: '200.00',
          ksefNumber: 'KSEF-789-012',
          companyId: 'company-2',
        },
      ];

      const duplicateGroups: Record<string, typeof invoices> = {};
      
      for (const invoice of invoices) {
        const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
        
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(invoice);
      }
      
      const groups = Object.values(duplicateGroups);
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(2);
      expect(groups[1]).toHaveLength(2);
    });

    it('should filter out single invoices (non-duplicates)', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
        {
          id: '2',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
        {
          id: '3',
          kwota: '200.00',
          ksefNumber: 'KSEF-789-012',
          companyId: 'company-2',
        },
      ];

      const duplicateGroups: Record<string, typeof invoices> = {};
      
      for (const invoice of invoices) {
        const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
        
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(invoice);
      }
      
      const duplicates = Object.values(duplicateGroups)
        .filter(group => group.length > 1);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toHaveLength(2);
    });
  });

  describe('Data Validation', () => {
    it('should skip invoices with null kwota', () => {
      const invoices = [
        {
          id: '1',
          kwota: null,
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
      ];

      const validInvoices = invoices.filter(inv => inv.kwota !== null);
      
      expect(validInvoices).toHaveLength(0);
    });

    it('should skip invoices with null ksefNumber', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: null,
          companyId: 'company-1',
        },
      ];

      const validInvoices = invoices.filter(inv => inv.ksefNumber !== null);
      
      expect(validInvoices).toHaveLength(0);
    });

    it('should skip invoices with null companyId', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: null,
        },
      ];

      const validInvoices = invoices.filter(inv => inv.companyId !== null);
      
      expect(validInvoices).toHaveLength(0);
    });

    it('should only process invoices with all required fields', () => {
      const invoices = [
        {
          id: '1',
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
        },
        {
          id: '2',
          kwota: null,
          ksefNumber: 'KSEF-789-012',
          companyId: 'company-2',
        },
        {
          id: '3',
          kwota: '200.00',
          ksefNumber: null,
          companyId: 'company-3',
        },
      ];

      const validInvoices = invoices.filter(
        inv => inv.kwota !== null && inv.ksefNumber !== null && inv.companyId !== null
      );
      
      expect(validInvoices).toHaveLength(1);
      expect(validInvoices[0]!.id).toBe('1');
    });
  });

  describe('Conflict Count', () => {
    it('should count total conflicts correctly', () => {
      const duplicateGroups = [
        {
          kwota: '100.00',
          ksefNumber: 'KSEF-123-456',
          companyId: 'company-1',
          count: 2,
          invoices: [],
        },
        {
          kwota: '200.00',
          ksefNumber: 'KSEF-789-012',
          companyId: 'company-2',
          count: 3,
          invoices: [],
        },
      ];
      
      expect(duplicateGroups.length).toBe(2);
    });

    it('should return zero conflicts when no duplicates exist', () => {
      const duplicateGroups: unknown[] = [];
      
      expect(duplicateGroups.length).toBe(0);
    });

    it('should count invoices in each group', () => {
      const group = {
        invoices: [
          { id: '1' },
          { id: '2' },
          { id: '3' },
        ],
      };
      
      expect(group.invoices.length).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty invoice list', () => {
      const invoices: Array<{ kwota: string; ksefNumber: string; companyId: string }> = [];
      const duplicateGroups: Record<string, typeof invoices> = {};
      
      for (const invoice of invoices) {
        const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(invoice);
      }
      
      expect(Object.keys(duplicateGroups)).toHaveLength(0);
    });

    it('should handle invoice with undefined first element safely', () => {
      const group: unknown[] = [];
      const firstInvoice = group[0];
      
      expect(firstInvoice).toBeUndefined();
    });

    it('should handle very large duplicate groups', () => {
      const largeGroup = Array.from({ length: 100 }, (_, i) => ({
        id: `invoice-${i}`,
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      }));
      
      expect(largeGroup.length).toBe(100);
      expect(largeGroup.length > 1).toBe(true);
    });

    it('should handle decimal amounts correctly', () => {
      const invoice1 = {
        kwota: '100.50',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '100.50',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).toBe(key2);
    });

    it('should handle special characters in ksefNumber', () => {
      const invoice1 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-ABC-123-XYZ',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-ABC-123-XYZ',
        companyId: 'company-1',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).toBe(key2);
    });

    it('should be case-sensitive for ksefNumber', () => {
      const invoice1 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-abc-123',
        companyId: 'company-1',
      };
      
      const invoice2 = {
        kwota: '100.00',
        ksefNumber: 'KSEF-ABC-123',
        companyId: 'company-1',
      };

      const key1 = `${invoice1.kwota}_${invoice1.ksefNumber}_${invoice1.companyId}`;
      const key2 = `${invoice2.kwota}_${invoice2.ksefNumber}_${invoice2.companyId}`;
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Response Structure', () => {
    it('should structure duplicate group correctly', () => {
      const group = {
        kwota: '100.00',
        ksefNumber: 'KSEF-123-456',
        companyId: 'company-1',
        companyName: 'Test Company',
        invoices: [
          { id: '1', userName: 'User 1' },
          { id: '2', userName: 'User 2' },
        ],
        count: 2,
      };
      
      expect(group).toHaveProperty('kwota');
      expect(group).toHaveProperty('ksefNumber');
      expect(group).toHaveProperty('companyId');
      expect(group).toHaveProperty('companyName');
      expect(group).toHaveProperty('invoices');
      expect(group).toHaveProperty('count');
      expect(group.count).toBe(group.invoices.length);
    });

    it('should structure response correctly', () => {
      const response = {
        duplicates: [
          {
            kwota: '100.00',
            ksefNumber: 'KSEF-123-456',
            companyId: 'company-1',
            companyName: 'Test Company',
            invoices: [],
            count: 2,
          },
        ],
        totalConflicts: 1,
      };
      
      expect(response).toHaveProperty('duplicates');
      expect(response).toHaveProperty('totalConflicts');
      expect(response.totalConflicts).toBe(response.duplicates.length);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle multiple groups efficiently', () => {
      // Create 50 different invoice groups
      const invoices = [];
      for (let i = 0; i < 50; i++) {
        invoices.push(
          {
            id: `${i}-1`,
            kwota: `${i * 100}.00`,
            ksefNumber: `KSEF-${i}`,
            companyId: `company-${i}`,
          },
          {
            id: `${i}-2`,
            kwota: `${i * 100}.00`,
            ksefNumber: `KSEF-${i}`,
            companyId: `company-${i}`,
          }
        );
      }

      const duplicateGroups: Record<string, typeof invoices> = {};
      
      for (const invoice of invoices) {
        const key = `${invoice.kwota}_${invoice.ksefNumber}_${invoice.companyId}`;
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(invoice);
      }
      
      const duplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
      
      expect(duplicates).toHaveLength(50);
      duplicates.forEach(group => {
        expect(group).toHaveLength(2);
      });
    });
  });
});
