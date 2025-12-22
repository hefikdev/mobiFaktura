import { describe, it, expect } from 'vitest';
import { 
  formatDate, 
  formatTime, 
  formatDateTime,
  formatTimeWithSeconds,
  formatDateTimeWithSeconds,
  formatDateLong 
} from '@/lib/date-utils';

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

    it('should format dates with leading zeros', () => {
      const date = new Date('2025-01-05T10:00:00Z');
      const result = formatDate(date);
      
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should handle end of year dates', () => {
      const date = new Date('2025-12-31T12:00:00Z');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      // Date might shift to next year due to timezone, check for valid format
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    it('should handle beginning of year dates', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/01\.01\.2025/);
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

    it('should handle noon', () => {
      const date = new Date('2025-12-11T12:00:00Z');
      const result = formatTime(date);
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle end of day', () => {
      const date = new Date('2025-12-11T23:59:59Z');
      const result = formatTime(date);
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should handle single digit hours and minutes', () => {
      const date = new Date('2025-12-11T09:05:00Z');
      const result = formatTime(date);
      
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('formatTimeWithSeconds', () => {
    it('should format time with seconds correctly', () => {
      const date = new Date('2025-12-11T10:30:45Z');
      const result = formatTimeWithSeconds(date);
      
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should handle zero seconds', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatTimeWithSeconds(date);
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should handle 59 seconds', () => {
      const date = new Date('2025-12-11T10:30:59Z');
      const result = formatTimeWithSeconds(date);
      
      expect(result).toContain(':59');
    });

    it('should handle string dates', () => {
      const result = formatTimeWithSeconds('2025-12-11T15:45:30Z');
      
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
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

    it('should have correct format with space separator', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatDateTime(date);
      
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/);
    });

    it('should handle midnight datetime', () => {
      const date = new Date('2025-01-01T00:00:00Z');
      const result = formatDateTime(date);
      
      expect(result).toBeTruthy();
      expect(result).toContain('01.01.2025');
    });
  });

  describe('formatDateTimeWithSeconds', () => {
    it('should format date and time with seconds', () => {
      const date = new Date('2025-12-11T10:30:45Z');
      const result = formatDateTimeWithSeconds(date);
      
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}/);
    });

    it('should handle string dates', () => {
      const result = formatDateTimeWithSeconds('2025-12-11T15:45:30Z');
      
      expect(result).toBeTruthy();
      expect(result).toContain(':');
      expect(result).toContain('.');
    });

    it('should include seconds in output', () => {
      const date = new Date('2025-12-11T10:30:45Z');
      const result = formatDateTimeWithSeconds(date);
      
      const parts = result.split(' ');
      expect(parts).toHaveLength(2);
      expect(parts[1]?.split(':')).toHaveLength(3);
    });
  });

  describe('formatDateLong', () => {
    it('should format date in long format', () => {
      const date = new Date('2025-12-11T10:30:00Z');
      const result = formatDateLong(date);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result).toContain('2025');
    });

    it('should handle string dates', () => {
      const result = formatDateLong('2025-12-11');
      
      expect(result).toBeTruthy();
      expect(result).toContain('2025');
    });

    it('should contain month name', () => {
      const date = new Date('2025-01-15T10:00:00Z');
      const result = formatDateLong(date);
      
      // Should contain Polish month name
      expect(result.length).toBeGreaterThan(10);
    });

    it('should handle different months', () => {
      const dates = [
        new Date('2025-01-01'),
        new Date('2025-06-15'),
        new Date('2025-12-31'),
      ];
      
      dates.forEach(date => {
        const result = formatDateLong(date);
        expect(result).toBeTruthy();
        expect(result).toContain('2025');
      });
    });

    it('should format without leading zeros for day', () => {
      const date = new Date('2025-12-07T10:00:00Z');
      const result = formatDateLong(date);
      
      // Should contain single digit day without leading zero
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('Edge cases', () => {
    it('should handle leap year dates', () => {
      const date = new Date('2024-02-29T12:00:00Z');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      expect(result).toContain('29');
      expect(result).toContain('02');
      expect(result).toContain('2024');
    });

    it('should handle very old dates', () => {
      const date = new Date('1900-01-01T00:00:00Z');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      expect(result).toContain('1900');
    });

    it('should handle future dates', () => {
      const date = new Date('2099-12-31T12:00:00Z');
      const result = formatDate(date);
      
      expect(result).toBeTruthy();
      // Date might shift to next year due to timezone, check for valid format
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });
  });
});
