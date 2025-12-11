import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn (class names utility)', () => {
    it('should merge class names', () => {
      const result = cn('class1', 'class2');
      
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'active', false && 'disabled');
      
      expect(result).toContain('base');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4');
      
      // Should only have px-4 (last one wins)
      expect(result).toContain('px-4');
      expect(result).not.toContain('px-2');
    });

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2']);
      
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2');
      
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });
  });
});
