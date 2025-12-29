import { describe, it, expect } from 'vitest';
import { sanitizeExportCell } from '@/lib/export';

describe('sanitizeExportCell', () => {
  it('converts numbers to strings and handles NaN', () => {
    expect(sanitizeExportCell(123)).toBe('123');
    expect(sanitizeExportCell(NaN)).toBe('');
  });

  it('uses formatter and handles formatter returning NaN', () => {
    const f = (v: any) => {
      if (v === 'bad') return NaN as any;
      return `#${v}`;
    };
    expect(sanitizeExportCell('good', f)).toBe('#good');
    expect(sanitizeExportCell('bad', f)).toBe('');
  });

  it('handles formatter throwing', () => {
    const broken = () => { throw new Error('boom'); };
    expect(sanitizeExportCell('x', broken)).toBe('x');
  });

  it('handles null/undefined', () => {
    expect(sanitizeExportCell(null)).toBe('');
    expect(sanitizeExportCell(undefined)).toBe('');
  });
});