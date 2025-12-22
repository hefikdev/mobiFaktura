import { describe, it, expect, vi } from 'vitest';

// Mock server-only to work in test environment
vi.mock('server-only', () => ({}));

// Mock argon2
vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
    argon2id: 2,
  },
}));

import { validatePassword } from '@/server/auth/password';

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const result = validatePassword('StrongPass123');
      
      expect(result.valid).toBe(true);
      expect(result.message).toBe('');
    });

    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('Pass1');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('password123');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('wielką');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('PASSWORD123');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('małą');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('Password');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('cyfrę');
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A1b' + 'x'.repeat(100);
      const result = validatePassword(longPassword);
      
      expect(result.valid).toBe(true);
    });

    it('should accept passwords with mixed case and numbers', () => {
      const passwords = [
        'Password123',
        'MySecure1Pass',
        'Test1234Word',
        'ValidPass99',
        'Strong2Pass',
        'MyPassw0rd',
      ];

      passwords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
      });
    });

    it('should handle edge case with exactly 8 characters', () => {
      const result = validatePassword('Pass1234');
      
      expect(result.valid).toBe(true);
      expect(result.message).toBe('');
    });

    it('should reject empty password', () => {
      const result = validatePassword('');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should reject password with only spaces', () => {
      const result = validatePassword('        ');
      
      expect(result.valid).toBe(false);
    });

    it('should accept password with spaces if other requirements met', () => {
      const result = validatePassword('Pass Word 123');
      
      expect(result.valid).toBe(true);
    });

    it('should validate passwords with unicode characters', () => {
      const result = validatePassword('Pässwörd123');
      
      expect(result.valid).toBe(true);
    });

    it('should reject passwords with 7 characters', () => {
      const result = validatePassword('Pass123');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should validate all rules are checked in order', () => {
      // Missing length, uppercase, lowercase, and number
      const result1 = validatePassword('abc');
      expect(result1.valid).toBe(false);
      expect(result1.message).toContain('8'); // Length checked first
      
      // Missing uppercase, lowercase, and number
      const result2 = validatePassword('abcdefgh');
      expect(result2.valid).toBe(false);
      expect(result2.message).toContain('wielką'); // Uppercase checked second
      
      // Missing lowercase and number
      const result3 = validatePassword('ABCDEFGH');
      expect(result3.valid).toBe(false);
      expect(result3.message).toContain('małą'); // Lowercase checked third
      
      // Missing number only
      const result4 = validatePassword('ABCDefgh');
      expect(result4.valid).toBe(false);
      expect(result4.message).toContain('cyfrę'); // Number checked last
    });
  });
});
