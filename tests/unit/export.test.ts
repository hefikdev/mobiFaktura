import { describe, it, expect } from 'vitest';
import { convertToCSV } from '@/lib/export';

describe('convertToCSV', () => {
  it('preserves Polish diacritics and includes headers', () => {
    const csv = convertToCSV({
      filename: 'test',
      columns: [{ key: 'name', header: 'Nazwa' }],
      data: [{ name: 'Zażółć gęślą jaźń' }],
    } as any);

    expect(csv).toContain('Nazwa');
    expect(csv).toContain('Zażółć gęślą jaźń');
  });

  it('includes metadata lines when meta provided', () => {
    const csv = convertToCSV({
      filename: 'test',
      columns: [{ key: 'a', header: 'Kolumna' }],
      data: [{ a: 'x' }],
      meta: {
        title: 'Tytuł',
        generatedAt: '01.01.2025',
        user: 'Jan',
        filters: 'ostatnie 30 dni'
      }
    } as any);

    expect(csv.split('\n')[0]).toContain('Title: Tytuł');
    expect(csv).toContain('Generated at: 01.01.2025');
    expect(csv).toContain('User: Jan');
    expect(csv).toContain('Filters: ostatnie 30 dni');
  });
});