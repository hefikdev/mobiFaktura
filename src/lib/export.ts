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
}

/**
 * Converts data to CSV format
 */
export function convertToCSV<T extends Record<string, unknown>>(options: ExportOptions<T>): string {
  const { columns, data } = options;

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

  return [headers, ...rows].join('\n');
}

/**
 * Downloads a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      zasilenie: 'Zasilenie',
      korekta: 'Korekta',
      invoice_deduction: 'Odliczenie faktury',
      invoice_refund: 'Zwrot za fakturę'
    };
    return typeMap[value] || value;
  }
};

/**
 * Export data to CSV and trigger download
 */
export function exportToCSV<T extends Record<string, unknown>>(options: ExportOptions<T>): void {
  const csvContent = convertToCSV(options);
  const filename = options.filename.endsWith('.csv') ? options.filename : `${options.filename}.csv`;
  downloadCSV(csvContent, filename);
}