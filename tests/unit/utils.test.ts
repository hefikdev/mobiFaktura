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

    it('should handle empty string', () => {
      const result = cn('', 'class1');
      
      expect(result).toBe('class1');
    });

    it('should handle no arguments', () => {
      const result = cn();
      
      expect(result).toBe('');
    });

    it('should handle multiple conflicting tailwind classes', () => {
      const result = cn('bg-red-500', 'bg-blue-500');
      
      // Last one should win
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('bg-red-500');
    });

    it('should handle object with boolean conditions', () => {
      const result = cn({
        'base-class': true,
        'active': true,
        'disabled': false,
        'hidden': false,
      });
      
      expect(result).toContain('base-class');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
      expect(result).not.toContain('hidden');
    });

    it('should handle nested arrays', () => {
      const result = cn(['class1', ['class2', 'class3']]);
      
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle mixed arguments', () => {
      const result = cn(
        'base',
        ['array1', 'array2'],
        { conditional: true, hidden: false },
        null,
        undefined,
        'final'
      );
      
      expect(result).toContain('base');
      expect(result).toContain('array1');
      expect(result).toContain('array2');
      expect(result).toContain('conditional');
      expect(result).not.toContain('hidden');
      expect(result).toContain('final');
    });

    it('should handle width and height conflicts', () => {
      const result = cn('w-full h-screen', 'w-1/2 h-full');
      
      expect(result).toContain('w-1/2');
      expect(result).toContain('h-full');
      expect(result).not.toContain('w-full');
      expect(result).not.toContain('h-screen');
    });

    it('should handle padding conflicts correctly', () => {
      const result = cn('p-4', 'p-2');
      
      expect(result).toContain('p-2');
      expect(result).not.toContain('p-4');
    });

    it('should keep non-conflicting classes together', () => {
      const result = cn('flex items-center', 'justify-between gap-4');
      
      expect(result).toContain('flex');
      expect(result).toContain('items-center');
      expect(result).toContain('justify-between');
      expect(result).toContain('gap-4');
    });

    it('should handle responsive classes', () => {
      const result = cn('text-sm md:text-base lg:text-lg');
      
      expect(result).toContain('text-sm');
      expect(result).toContain('md:text-base');
      expect(result).toContain('lg:text-lg');
    });

    it('should handle hover and focus states', () => {
      const result = cn('hover:bg-blue-500 focus:ring-2');
      
      expect(result).toContain('hover:bg-blue-500');
      expect(result).toContain('focus:ring-2');
    });

    it('should handle dark mode classes', () => {
      const result = cn('bg-white dark:bg-gray-900');
      
      expect(result).toContain('bg-white');
      expect(result).toContain('dark:bg-gray-900');
    });

    it('should handle complex real-world scenario', () => {
      const isActive = true;
      const isDisabled = false;
      
      const result = cn(
        'px-4 py-2 rounded-md font-medium',
        'transition-colors duration-200',
        isActive && 'bg-blue-500 text-white',
        isDisabled && 'opacity-50 cursor-not-allowed',
        !isDisabled && 'hover:bg-blue-600'
      );
      
      expect(result).toContain('px-4');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-blue-500');
      expect(result).toContain('text-white');
      expect(result).toContain('hover:bg-blue-600');
      expect(result).not.toContain('opacity-50');
      expect(result).not.toContain('cursor-not-allowed');
    });
  });
});
