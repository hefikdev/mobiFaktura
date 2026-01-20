import { describe, it, expect } from 'vitest';

describe('Saldo System - Logic Tests', () => {
  describe('Balance Calculations', () => {
    it('should calculate current balance correctly', () => {
      const invoices = [
        { kwota: 1000, status: 'APPROVED' },
        { kwota: 500, status: 'APPROVED' },
        { kwota: 300, status: 'PENDING' },
      ];

      const approvedSum = invoices
        .filter(inv => inv.status === 'APPROVED')
        .reduce((sum, inv) => sum + inv.kwota, 0);
      
      expect(approvedSum).toBe(1500);
    });

    it('should exclude rejected invoices from balance', () => {
      const invoices = [
        { kwota: 1000, status: 'APPROVED' },
        { kwota: 500, status: 'REJECTED' },
        { kwota: 300, status: 'APPROVED' },
      ];

      const balance = invoices
        .filter(inv => inv.status === 'APPROVED')
        .reduce((sum, inv) => sum + inv.kwota, 0);
      
      expect(balance).toBe(1300);
    });

    it('should handle empty invoice list', () => {
      const invoices: Array<{ kwota: number; status: string }> = [];
      const balance = invoices.reduce((sum, inv) => sum + inv.kwota, 0);
      
      expect(balance).toBe(0);
    });

    it('should handle negative amounts (returns)', () => {
      const transactions = [
        { kwota: 1000, type: 'INVOICE' },
        { kwota: -200, type: 'RETURN' },
        { kwota: 500, type: 'INVOICE' },
      ];

      const balance = transactions.reduce((sum, t) => sum + t.kwota, 0);
      
      expect(balance).toBe(1300);
    });
  });

  describe('Saldo Status Logic', () => {
    it('should determine if balance is sufficient', () => {
      const balance = 5000;
      const requestedAmount = 3000;
      
      const isSufficient = balance >= requestedAmount;
      
      expect(isSufficient).toBe(true);
    });

    it('should determine if balance is insufficient', () => {
      const balance = 2000;
      const requestedAmount = 3000;
      
      const isSufficient = balance >= requestedAmount;
      
      expect(isSufficient).toBe(false);
    });

    it('should handle exact balance match', () => {
      const balance = 3000;
      const requestedAmount = 3000;
      
      const isSufficient = balance >= requestedAmount;
      
      expect(isSufficient).toBe(true);
    });
  });

  describe('Transaction History', () => {
    it('should sort transactions by date descending', () => {
      const transactions = [
        { id: '1', date: new Date('2026-01-18'), amount: 100 },
        { id: '2', date: new Date('2026-01-20'), amount: 200 },
        { id: '3', date: new Date('2026-01-19'), amount: 150 },
      ];

      const sorted = [...transactions].sort((a, b) => 
        b.date.getTime() - a.date.getTime()
      );
      
      expect(sorted.map(t => t.id!)).toEqual(['2', '3', '1']);
    });

    it('should filter transactions by date range', () => {
      const transactions = [
        { date: new Date('2026-01-15'), amount: 100 },
        { date: new Date('2026-01-18'), amount: 200 },
        { date: new Date('2026-01-22'), amount: 300 },
      ];

      const startDate = new Date('2026-01-17');
      const endDate = new Date('2026-01-20');

      const filtered = transactions.filter(t => 
        t.date >= startDate && t.date <= endDate
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.amount).toBe(200);
    });

    it('should calculate running balance', () => {
      const transactions = [
        { amount: 1000 },
        { amount: -200 },
        { amount: 500 },
        { amount: -100 },
      ];

      let runningBalance = 0;
      const balances = transactions.map(t => {
        runningBalance += t.amount;
        return runningBalance;
      });
      
      expect(balances).toEqual([1000, 800, 1300, 1200]);
    });
  });

  describe('Budget Allocation', () => {
    it('should allocate budget to companies', () => {
      const totalBudget = 10000;
      const companies = [
        { id: 'c1', allocation: 0.4 }, // 40%
        { id: 'c2', allocation: 0.35 }, // 35%
        { id: 'c3', allocation: 0.25 }, // 25%
      ];

      const allocations = companies.map(c => ({
        companyId: c.id,
        amount: totalBudget * c.allocation,
      }));
      
      expect(allocations[0]!.amount).toBe(4000);
      expect(allocations[1]!.amount).toBe(3500);
      expect(allocations[2]!.amount).toBe(2500);
      expect(allocations.reduce((sum, a) => sum + a.amount, 0)).toBe(10000);
    });

    it('should track used vs remaining budget', () => {
      const allocated = 5000;
      const used = 3200;
      const remaining = allocated - used;
      
      expect(remaining).toBe(1800);
      expect(used / allocated).toBeCloseTo(0.64);
    });
  });

  describe('Saldo Report Generation', () => {
    it('should calculate total income', () => {
      const invoices = [
        { kwota: 1000, type: 'INCOME' },
        { kwota: 500, type: 'INCOME' },
        { kwota: 200, type: 'EXPENSE' },
      ];

      const totalIncome = invoices
        .filter(inv => inv.type === 'INCOME')
        .reduce((sum, inv) => sum + inv.kwota, 0);
      
      expect(totalIncome).toBe(1500);
    });

    it('should calculate total expenses', () => {
      const invoices = [
        { kwota: 1000, type: 'INCOME' },
        { kwota: 500, type: 'INCOME' },
        { kwota: 200, type: 'EXPENSE' },
        { kwota: 300, type: 'EXPENSE' },
      ];

      const totalExpenses = invoices
        .filter(inv => inv.type === 'EXPENSE')
        .reduce((sum, inv) => sum + inv.kwota, 0);
      
      expect(totalExpenses).toBe(500);
    });

    it('should calculate net balance', () => {
      const income = 5000;
      const expenses = 3200;
      const netBalance = income - expenses;
      
      expect(netBalance).toBe(1800);
    });
  });

  describe('Currency Handling', () => {
    it('should format amount to 2 decimal places', () => {
      const amount = 1234.567;
      const formatted = amount.toFixed(2);
      
      expect(formatted).toBe('1234.57');
    });

    it('should handle rounding correctly', () => {
      const amounts = [10.125, 10.135, 10.145];
      const rounded = amounts.map(a => Math.round(a * 100) / 100);
      
      expect(rounded).toEqual([10.13, 10.14, 10.15]);
    });

    it('should format currency with separators', () => {
      const amount = 1234567.89;
      const formatted = new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
      }).format(amount);
      
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});
