import { describe, it, expect } from 'vitest';
import { sanitizeExportCell } from '@/lib/export';

describe('sanitizeExportCell', () => {
  it('coerces numbers and handles undefined/null safely', () => {
    expect(sanitizeExportCell(123.45)).toBe('123.45');
    expect(sanitizeExportCell(undefined)).toBe('');
    expect(sanitizeExportCell(null)).toBe('');
  });

  it('uses formatter when provided and falls back on error', () => {
    const fmt = (v: any) => `x:${v}`;
    expect(sanitizeExportCell('a', fmt)).toBe('x:a');

    const badFmt = () => { throw new Error('boom'); };
    expect(sanitizeExportCell('a', badFmt as any)).toBe('a');
  });
});