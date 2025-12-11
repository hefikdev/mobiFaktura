import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, formatDateTime } from '@/lib/date-utils';

describe('Date Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatDate(date);
      
      // Check it returns a string in DD.MM.YYYY format
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-15');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle string dates', () => {
      const result = formatDate('2025-12-11');
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatTime(date);
      
      // Check it returns a string in HH:MM format
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle midnight', () => {
      const date = new Date('2025-12-11T00:00:00Z');
      const result = formatTime(date);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatDateTime(date);
      
      // Should contain both date and time parts
      expect(result).toContain('.');
      expect(result).toContain(':');
      expect(typeof result).toBe('string');
    });

    it('should handle string dates', () => {
      const result = formatDateTime('2025-12-11T15:45:00Z');
      
      expect(result).toBeTruthy();
      expect(result).toContain('.');
      expect(result).toContain(':');
    });
  });
});
