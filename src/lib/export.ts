import { format } from "date-fns";
import { pl } from "date-fns/locale";

export interface ExportColumn<T = unknown> {
  key: string;
  header: string;
  formatter?: (value: unknown) => string;
}

export interface ExportOptions<T = unknown> {
  filename: string;
  columns: ExportColumn<T>[];
  data: T[];
  // Optional metadata shown at top of CSV (title, generatedAt, user, filters)
  meta?: {
    title?: string;
    generatedAt?: string;
    user?: string;
    filters?: string;
  };
}

/**
 * Converts data to CSV format
 */
export function convertToCSV<T extends Record<string, unknown>>(options: ExportOptions<T>): string {
  const { columns, data, meta } = options;

  // Create header row
  const headers = columns.map(col => `"${col.header}"`).join(',');

  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      const formattedValue = col.formatter ? col.formatter(value) : value;
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(formattedValue || '');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  // Add optional metadata lines at the top (title, generatedAt, user, filters)
  const metaLines: string[] = [];
  if (meta) {
    if (meta.title) metaLines.push(`"Title: ${meta.title}"`);
    if (meta.generatedAt) metaLines.push(`"Generated at: ${meta.generatedAt}"`);
    if (meta.user) metaLines.push(`"User: ${meta.user}"`);
    if (meta.filters) metaLines.push(`"Filters: ${meta.filters}"`);
  }

  const content = [
    ...metaLines,
    metaLines.length ? '' : undefined,
    headers,
    ...rows,
  ].filter(Boolean) as string[];

  return content.join('\n');
}

/**
 * Downloads a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Prepend UTF-8 BOM so Excel and other programs correctly detect UTF-8 and display Polish diacritics
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Common formatters for export columns
 */
export const formatters = {
  currency: (value: number) => `${value?.toFixed(2) || '0.00'} PLN`,
  date: (value: Date | string) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    return format(date, 'dd.MM.yyyy HH:mm', { locale: pl });
  },
  dateOnly: (value: Date | string) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    return format(date, 'dd.MM.yyyy', { locale: pl });
  },
  status: (value: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Oczekujące',
      in_review: 'W recenzji',
      accepted: 'Zaakceptowane',
      rejected: 'Odrzucone',
      re_review: 'Ponowna recenzja',
      approved: 'Zatwierdzone',
      all: 'Wszystkie'
    };
    return statusMap[value] || value;
  },
  transactionType: (value: string) => {
    const typeMap: Record<string, string> = {
      adjustment: 'Korekta',
      advance_credit: 'Przyznana przez księgowego',
      zasilenie: 'Zasilenie',
      korekta: 'Korekta',
      invoice_deduction: 'odliczenie',
      invoice_refund: 'Zwrot za fakturę'
    };
    return typeMap[value] || value;
  }
};

/**
 * Sanitize a value for inclusion in exports (CSV/PDF). Ensures formatters are handled and
 * returns a safe string (never NaN, undefined, or object).
 */
export function sanitizeExportCell(value: unknown, formatter?: (v: unknown) => unknown): string {
  let cellValue: unknown = value;
  if (formatter) {
    try {
      cellValue = formatter(value);
    } catch (e) {
      // If formatter throws, fallback to raw value
      console.warn('Export formatter threw error', e);
      cellValue = value;
    }
  }

  // Coerce to string robustly; handle numbers, dates, nulls, undefined
  let text = typeof cellValue === 'string' ? cellValue : (cellValue === null || cellValue === undefined ? '' : String(cellValue));
  if (text === 'NaN' || text === 'undefined' || text === 'null') text = '';
  return text;
}

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(options: ExportOptions<T>): void {
  const csvContent = convertToCSV(options);
  const filename = options.filename.endsWith('.csv') ? options.filename : `${options.filename}.csv`;
  downloadCSV(csvContent, filename);
}