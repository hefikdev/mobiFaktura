import { describe, it, expect } from 'vitest';
import { validatePassword } from '@/server/auth/password';

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const result = validatePassword('StrongP@ss123');
      
      expect(result.valid).toBe(true);
      expect(result.message).toBe('');
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('Pass1!');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('password123!');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('wielką');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('PASSWORD123!');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('małą');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('Password!');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('cyfrę');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('Password123');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('znak');
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A1b!' + 'x'.repeat(100);
      const result = validatePassword(longPassword);
      
      expect(result.valid).toBe(true);
    });

    it('should accept passwords with various special characters', () => {
      const passwords = [
        'Password1@',
        'Password1#',
        'Password1$',
        'Password1%',
        'Password1^',
        'Password1&',
        'Password1*',
      ];

      passwords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
      });
    });
  });
});
