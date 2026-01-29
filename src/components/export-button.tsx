"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportToExcel, ExportOptions, sanitizeExportCell } from "@/lib/export";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with fonts
if (pdfFonts && (pdfFonts as unknown as { pdfMake?: { vfs: unknown } }).pdfMake) {
  (pdfMake as { vfs?: unknown }).vfs = (pdfFonts as unknown as { pdfMake: { vfs: unknown } }).pdfMake.vfs;
} else {
  (pdfMake as { vfs?: unknown }).vfs = pdfFonts;
}

type ExportFormat = "xlsx" | "pdf";

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ExportButtonProps<T extends Record<string, unknown> = Record<string, unknown>> {
  data: T[];
  columns: ExportOptions<T>['columns'];
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
  // onExport now receives parsed filter input (dateFrom/dateTo/specificMonth) when invoked
  onExport?: (filterInput?: { dateFrom?: string; dateTo?: string; specificMonth?: { year: number; month: number } }) => Promise<T[]> | T[];
  filters?: FilterOption[];
  enablePdf?: boolean;
  pdfTitle?: string;
  pdfSubtitle?: string;
  userName?: string;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  label = "Eksportuj",
  variant = "outline",
  size = "default",
  disabled = false,
  className = "",
  onExport,
  filters = [],
  enablePdf = true,
  pdfTitle = "Historia Salda",
  pdfSubtitle = "",
  userName,
}: ExportButtonProps<T>) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  // For "Specific month" filter: store temporary year/month selections per filter key
  const [monthSelections, setMonthSelections] = useState<Record<string, { year?: string; month?: string }>>({});
  const [progress, setProgress] = useState(0);

  // Initialize filters
  const initializeFilters = () => {
    const initialFilters: Record<string, string> = {};
    const initialMonths: Record<string, { year?: string; month?: string }> = {};
    filters.forEach(filter => {
      initialFilters[filter.key] = "all";
      initialMonths[filter.key] = {};
    });
    setSelectedFilters(initialFilters);
    setMonthSelections(initialMonths);
  };

  const openDialog = () => {
    initializeFilters();
    setExportDialogOpen(true);
  };

  const parseSelectedFilters = () => {
    const input: { dateFrom?: string; dateTo?: string; specificMonth?: { year: number; month: number } } = {};
    const descriptions: string[] = [];

    Object.entries(selectedFilters).forEach(([key, value]) => {
      if (!value || value === 'all') return;

      // Numeric days (last N days)
      if (/^[0-9]+$/.test(value)) {
        const days = parseInt(value, 10);
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        input.dateFrom = input.dateFrom && new Date(input.dateFrom) > from ? input.dateFrom : from.toISOString();
        descriptions.push(`${key}: ostatnie ${days} dni`);
        return;
      }

      // Specific month pattern stored as monthSelections
      if (value === '__specific_month__') {
        const sel = monthSelections[key];
        if (sel && sel.year && sel.month) {
          const y = parseInt(sel.year, 10);
          const m = parseInt(sel.month, 10);
          input.specificMonth = { year: y, month: m };
          descriptions.push(`${key}: ${sel.year}-${sel.month}`);
        }
        return;
      }

      // Fallback to equality - include in description (server might not use arbitrary equality but we include it)
      descriptions.push(`${key}: ${value}`);
    });

    return { input, description: descriptions.join(', ') };
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(10);

    try {
      // Parse filters into server-friendly input and human-readable description
      const parsed = parseSelectedFilters();
      const filtersInput = parsed.input;
      const filtersDescription = parsed.description;

      let exportData = data;

      if (onExport) {
        const result = onExport(filtersInput);
        if (result instanceof Promise) {
          exportData = await result;
        } else {
          exportData = result;
        }
      } else {
        // Client-side filtering (maintain previous behavior)
        if (filters.length > 0 && Object.keys(selectedFilters).length > 0) {
          exportData = exportData.filter(item => {
            return filters.every(filter => {
              const filterValue = selectedFilters[filter.key];
              if (!filterValue || filterValue === "all") return true;

              const itemValue = item[filter.key];

              // If the filter value looks like a numeric date range (days), treat as date-range filter
              if (/^[0-9]+$/.test(filterValue)) {
                const days = parseInt(filterValue, 10);
                const dateValue = itemValue instanceof Date ? itemValue : (typeof itemValue === 'string' || typeof itemValue === 'number' ? new Date(itemValue) : null);
                if (!dateValue || isNaN(dateValue.getTime())) return false;
                const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                return dateValue >= cutoff;
              }

              // If specific month was chosen client-side, match month
              if (filterValue === '__specific_month__') {
                const sel = monthSelections[filter.key];
                if (!sel || !sel.year || !sel.month) return false;
                const dateValue = itemValue instanceof Date ? itemValue : (typeof itemValue === 'string' || typeof itemValue === 'number' ? new Date(itemValue) : null);
                if (!dateValue || isNaN(dateValue.getTime())) return false;
                return dateValue.getFullYear() === parseInt(sel.year, 10) && (dateValue.getMonth() + 1) === parseInt(sel.month, 10);
              }

              // Fallback to string equality
              return String(itemValue) === String(filterValue);
            });
          });
        }
      }

      setProgress(30);

      if (exportData.length === 0) {
        toast({
          title: "Brak danych",
          description: "Nie ma danych do eksportu po zastosowaniu filtrów",
          variant: "destructive",
        });
        return;
      }

      // compute a timestamped filename
      const dateStamp = new Date().toISOString().split('T')[0];
      const outFilename = `${filename}_${dateStamp}`;

      // human readable filters for metadata
      const filtersMeta = filtersDescription;

      if (exportFormat === "xlsx") {
        setProgress(50);

        // Show incremental progress for large datasets
        if (exportData.length > 100) {
          await new Promise(resolve => setTimeout(resolve, 50));
          setProgress(60);
        }

        await exportToExcel({
          data: exportData,
          columns,
          filename: `${outFilename}.xlsx`,
          meta: {
            title: pdfTitle || filename,
            generatedAt: new Date().toLocaleString('pl-PL'),
            user: userName,
            filters: filtersMeta,
          }
        });

        setProgress(90);
        await new Promise(resolve => setTimeout(resolve, 100));
        setProgress(100);
      } else if (exportFormat === "pdf" && enablePdf) {
        setProgress(50);

        // Show progress during data processing
        if (exportData.length > 50) {
          await new Promise(resolve => setTimeout(resolve, 50));
          setProgress(60);
        }

        // Generate PDF
        await generatePDF(exportData, columns, `${outFilename}.pdf`, pdfTitle, filtersMeta || pdfSubtitle, userName);

        setProgress(100);
      }

      toast({
        title: "Sukces",
        description: `Dane zostały wyeksportowane do pliku ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas eksportu danych",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setProgress(0), 500);
      setExportDialogOpen(false);
    }
  };

  const generatePDF = async (data: T[], columns: ExportOptions<T>['columns'], filename: string, title: string, subtitle: string, userName?: string) => {
    if (!columns || columns.length === 0) {
      throw new Error("No columns defined for PDF export");
    }

    const headers: string[] = columns.map(col => String(col.header || ''));

    setProgress(65);

    const rows: string[][] = data.map(item =>
      columns.map(col => {
        const value = col.key ? item[col.key] : item;
        // Use shared sanitizer to ensure consistent behavior
        return sanitizeExportCell(value, col.formatter);
      })
    );

    setProgress(75);

    // Metadata lines: date generated, number of records, user, and subtitle (used for filters)
    const generatedAt = new Date().toLocaleString('pl-PL');
    const metaLines = [
      `Data wygenerowania: ${generatedAt}`,
      `Liczba rekordów: ${data.length}`,
    ];
    if (userName) metaLines.push(`Użytkownik: ${userName}`);
    if (subtitle) metaLines.push(`Filtry: ${subtitle}`);

    // Helper: insert zero-width spaces into very long words so pdfMake can break them
    const insertSoftBreaks = (text: string, maxWord = 30, insertEvery = 30) => {
      if (!text || typeof text !== 'string') return '';
      // Replace very long sequences without whitespace with insertions of ZWSP
      return text.replace(new RegExp(`([^\\n\\s]{${maxWord},})`, 'g'), (match) => {
        return match.replace(new RegExp(`(.{1,${insertEvery}})`, 'g'), '$1\u200B');
      });
    };

    // Compute column widths: prefer wider column for 'uzasadnienie' or 'opis' (Polish) but cap max fraction
    const leftMargin = 10; // matches pageMargins[0]
    const rightMargin = 10; // matches pageMargins[2]
    // A4 landscape width in points ~ 841.89
    const pageWidthPt = 841.89;
    const availableWidth = pageWidthPt - leftMargin - rightMargin;

    // Determine weights based on header/key semantics (give more space to description-like columns,
    // less space to numeric/date/amount columns). This helps avoid uniform sizing.
    const largeKeywords = ['uzasad', 'uzasadnienie', 'opis', 'notat', 'description', 'note', 'notes', 'justification', 'comment', 'remark'];
    const smallKeywords = ['kwota', 'amount', 'saldo', 'data', 'date', 'typ', 'id', 'nr', 'numer'];

    const rawWeights = columns.map(col => {
      const keyLower = String(col.key || '').toLowerCase();
      const headerLower = String(col.header || '').toLowerCase();

      if (largeKeywords.some(k => keyLower.includes(k) || headerLower.includes(k))) return 3;
      if (smallKeywords.some(k => keyLower.includes(k) || headerLower.includes(k))) return 0.6;
      return 1;
    });

    const totalRaw = rawWeights.reduce((a, b) => a + b, 0) || 1;

    // Start with fractions
    let fractions = rawWeights.map(w => w / totalRaw);
    const maxFraction = 0.4; // no single column may exceed 40% of available width to keep descriptions within margins
    // Cap fractions and redistribute remaining space
    let fixedSum = 0;
    const flexibleIndices: number[] = [];
    fractions.forEach((f, i) => {
      if (f > maxFraction) {
        fractions[i] = maxFraction;
        fixedSum += maxFraction;
      } else {
        flexibleIndices.push(i);
      }
    });
    if (flexibleIndices.length > 0) {
      const flexibleTotalOriginal = flexibleIndices.reduce((s, i) => s + ((rawWeights[i] ?? 0) / totalRaw), 0);
      const remaining = Math.max(0, 1 - fixedSum);
      flexibleIndices.forEach(i => {
        const orig = ((rawWeights[i] ?? 0) / totalRaw);
        fractions[i] = flexibleTotalOriginal > 0 ? (remaining * orig / flexibleTotalOriginal) : (remaining / flexibleIndices.length);
      });
    }

    // Add column gutters and a small safety margin so table never exceeds printable area
    const gutter = 6; // gap between columns in points
    const extraSafetyMargin = 12; // extra right-side safety margin in points
    const totalGutter = Math.max(0, (columns.length - 1) * gutter);
    const contentAvailableWidth = Math.max(0, availableWidth - totalGutter - extraSafetyMargin);

    let numericWidths = fractions.map((f, i) => {
      const val = f * contentAvailableWidth;
      return Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
    });

    // Fix rounding so sum of widths + gutters <= availableWidth - extraSafetyMargin
    const sumWidths = numericWidths.reduce((s, v) => s + (v ?? 0), 0);
    const totalTarget = contentAvailableWidth;
    let diff = Math.round((totalTarget - sumWidths) * 100) / 100; // cents
    // Distribute the diff (usually small) across columns
    let idx = 0;
    while (Math.abs(diff) >= 0.01 && idx < numericWidths.length) {
      // numericWidths[idx] may be undefined due to type narrowing, coalesce to 0
      numericWidths[idx] = Number(((numericWidths[idx] ?? 0) + Math.sign(diff) * 0.01).toFixed(2));
      diff = Math.round((totalTarget - numericWidths.reduce((s, v) => s + (v ?? 0), 0)) * 100) / 100;
      idx = (idx + 1) % numericWidths.length;
    }

    // Cap the last column to prevent it from being too wide and causing overflow
    const lastColIdx = numericWidths.length - 1;
    const maxLastColWidth = 80; // max 80pt for last column to prevent overflow
    if ((numericWidths[lastColIdx] ?? 0) > maxLastColWidth) {
      const excess = (numericWidths[lastColIdx] ?? 0) - maxLastColWidth;
      numericWidths[lastColIdx] = maxLastColWidth;
      // Reduce total width proportionally instead of redistributing to avoid making other columns too wide
      const currentTotal = numericWidths.reduce((s, v) => s + (v ?? 0), 0);
      const targetTotal = contentAvailableWidth;
      if (currentTotal > targetTotal) {
        const scale = targetTotal / currentTotal;
        numericWidths = numericWidths.map(w => Number((w * scale).toFixed(2)));
      }
    }

    // Ensure last description-like column doesn't overflow printable area: cap and reduce if necessary
    const maxAllowedTableWidth = availableWidth - totalGutter - extraSafetyMargin;
    const currentTableWidth = numericWidths.reduce((s, v) => s + (v ?? 0), 0);
    let overflow = currentTableWidth - maxAllowedTableWidth;
    if (overflow > 0) {
      // find description-like column index, prefer last matching one
      const descKeywords = ['uzasad', 'uzasadnienie', 'opis', 'notat', 'description', 'note', 'notes', 'justification', 'comment', 'remark'];
      let descIdx = -1;
      for (let i = columns.length - 1; i >= 0; i--) {
        const col = columns[i] || { key: '', header: '' };
        const keyLower = String(col.key || '').toLowerCase();
        const headerLower = String(col.header || '').toLowerCase();
        if (descKeywords.some(k => keyLower.includes(k) || headerLower.includes(k))) { descIdx = i; break; }
      }
      if (descIdx === -1) descIdx = numericWidths.length - 1; // fallback to last column

      // Try to shrink the description column first
      numericWidths[descIdx] = Math.max(40, Number(((numericWidths[descIdx] ?? 0) - overflow).toFixed(2)));
      // Recalculate overflow and if still >0, proportionally shrink other flexible columns
      let newTotal = numericWidths.reduce((s, v) => s + (v ?? 0), 0);
      overflow = newTotal - maxAllowedTableWidth;
      if (overflow > 0) {
        // shrink from columns that are larger than their minimum (min 30 pts)
        const minWidth = 30;
        const shrinkableIdxs = numericWidths.map((w, i) => ({ w: w ?? 0, i })).filter(x => x.w > minWidth).sort((a,b) => b.w - a.w);
        let j = 0;
        while (overflow > 0 && j < shrinkableIdxs.length) {
          const shrinkable = shrinkableIdxs[j];
          if (!shrinkable) break;
          const i = shrinkable.i;
          const availableToShrink = Math.max(0, (numericWidths[i] ?? 0) - minWidth);
          const shrink = Math.min(availableToShrink, overflow);
          numericWidths[i] = Number(((numericWidths[i] ?? 0) - shrink).toFixed(2));
          overflow = Number((overflow - shrink).toFixed(2));
          j++;
        }
      }
    }

    // Build table body as array of rows with per-cell objects and alternating fillColor, and safe wrapping
    interface PDFCell {
      text: string;
      style?: string;
      alignment?: string;
      noWrap?: boolean;
      fillColor?: string;
    }
    const tableBody: Array<Array<PDFCell>> = [];
    tableBody.push(headers.map(h => ({ text: insertSoftBreaks(String(h || '')), style: 'tableHeader', alignment: 'center', noWrap: false })));
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const rowObj = row.map((cellText: string) => ({ text: insertSoftBreaks(String(cellText || '')), fillColor: r % 2 === 0 ? '#f5f5f5' : undefined, noWrap: false }));
      tableBody.push(rowObj);
    }

    // Format headerTitle: prefer 'Historia salda - User' (avoid duplication)
    const baseTitle = String(title || '').replace(/\bSaldo\b/, 'salda');
    const headerTitle = userName && !baseTitle.toLowerCase().includes((userName || '').toLowerCase()) ? `${baseTitle} - ${userName}` : baseTitle;

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [leftMargin, 100, rightMargin, 40],
      header: function(currentPage: number, pageCount: number) {
        return [
          { text: headerTitle, style: 'header', alignment: 'center', margin: [0, 12, 0, 4] },
          { text: metaLines.join(' | '), style: 'subheader', alignment: 'center', margin: [0, 0, 0, 8] }
        ];
      },
      footer: function(currentPage: number, pageCount: number) {
        return {
          text: `Strona ${currentPage} z ${pageCount}`,
          alignment: 'center',
          style: 'footer',
          margin: [0, 10, 0, 0]
        };
      },
      content: [
        {
          table: {
            headerRows: 1,
            widths: numericWidths as (number | string)[],
            body: tableBody
          },
          layout: {
            fillColor: undefined as unknown,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#000000',
            vLineColor: () => '#000000'
          }
        } as unknown as Content
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#000000'
        },
        subheader: {
          fontSize: 9,
          color: '#000000'
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#000000'
        },
        footer: {
          fontSize: 8,
          color: '#000000'
        }
      },
      defaultStyle: {
        fontSize: 9,
        font: 'Roboto' // ensure Polish diacritics supported by using Roboto (included in vfs_fonts)
      }
    };

    setProgress(85);
    await new Promise(resolve => setTimeout(resolve, 100));
    setProgress(95);

    // Preflight: ensure there are no NaN numbers in the docDefinition which pdfMake cannot handle
    const findNaN = (obj: unknown, path: string[] = []): string | null => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj === 'number') {
        if (Number.isNaN(obj)) return path.join('.') || 'root';
        return null;
      }
      if (typeof obj === 'string' || typeof obj === 'boolean') return null;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const res = findNaN(obj[i], [...path, String(i)]);
          if (res) return res;
        }
        return null;
      }
      if (typeof obj === 'object') {
        for (const k of Object.keys(obj)) {
          const res = findNaN((obj as Record<string, unknown>)[k], [...path, k]);
          if (res) return res;
        }
      }
      return null;
    };

    const nanLocation = findNaN(docDefinition);
    if (nanLocation) {
      console.error('PDF generation aborted: found NaN in docDefinition at', nanLocation, { docDefinition });
      throw new Error(`PDF generation failed: Unsupported number NaN found in docDefinition at ${nanLocation}`);
    }

    try {
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (e) {
      console.error('pdfMake generation error:', e);
      throw new Error('Błąd generowania PDF: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const hasFilters = filters.length > 0;
  const showDialog = hasFilters || enablePdf;

  if (showDialog) {
    return (
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled || (!onExport && data.length === 0)}
            className={className}
            onClick={openDialog}
          >
            <Download className="h-4 w-4 mr-2" />
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Eksport raportów</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto pr-2">
            {enablePdf && (
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select value={exportFormat} onValueChange={(value: string) => setExportFormat(value as ExportFormat)}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Wybierz format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    <SelectItem value="pdf">PDF (do druku)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {filters.map(filter => (
              <div key={filter.key} className="space-y-2">
                <Label htmlFor={filter.key}>{filter.label}</Label>
                <Select
                  value={selectedFilters[filter.key] || "all"}
                  onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, [filter.key]: value }))}
                >
                  <SelectTrigger id={filter.key}>
                    <SelectValue placeholder={`Wszystkie ${filter.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only add a default "Wszystkie" option when filter.options doesn't already include it */}
                    {!filter.options.some(opt => opt.value === 'all') && (
                      <SelectItem value="all">Wszystkie</SelectItem>
                    )}
                    {filter.options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* If user selected the special specific-month option, show year/month pickers */}
                {selectedFilters[filter.key] === '__specific_month__' && (
                  <div className="flex gap-2 mt-2">
                    <Select
                      value={monthSelections[filter.key]?.year || ''}
                      onValueChange={(v) => setMonthSelections(prev => ({ ...prev, [filter.key]: { ...(prev[filter.key] || {}), year: v } }))}
                    >
                      <SelectTrigger id={`${filter.key}-year`}>
                        <SelectValue placeholder="Rok" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* show last 6 years including current */}
                        {Array.from({ length: 6 }).map((_, idx) => {
                          const year = String(new Date().getFullYear() - idx);
                          return <SelectItem key={year} value={year}>{year}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>

                    <Select
                      value={monthSelections[filter.key]?.month || ''}
                      onValueChange={(v) => setMonthSelections(prev => ({ ...prev, [filter.key]: { ...(prev[filter.key] || {}), month: v } }))}
                    >
                      <SelectTrigger id={`${filter.key}-month`}>
                        <SelectValue placeholder="Miesiąc" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, idx) => {
                          const month = String(idx + 1).padStart(2, '0');
                          return <SelectItem key={month} value={month}>{month}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}

            {isExporting && (
              <div className="space-y-2">
                <Label>{exportFormat === "xlsx" ? "Generowanie Excel..." : "Generowanie PDF..."}</Label>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <Button onClick={handleExport} className="w-full" disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generowanie...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Eksportuj do {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback to simple button if no filters or PDF
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size={size}
        onClick={async () => {
          setIsExporting(true);
          setProgress(10);
          try {
            let exportData = data;
            if (onExport) {
              setProgress(30);
              const result = onExport(undefined);
              if (result instanceof Promise) {
                exportData = await result;
              } else {
                exportData = result;
              }
            }

            setProgress(50);

            if (exportData.length === 0) {
              toast({
                title: "Brak danych",
                description: "Nie ma danych do eksportu",
                variant: "destructive",
              });
              return;
            }

            setProgress(70);

            const dateStamp = new Date().toISOString().split('T')[0];
            const outFilename = filename.endsWith('.xlsx') ? `${filename}_${dateStamp}` : `${filename}_${dateStamp}.xlsx`;

            await exportToExcel({
              data: exportData,
              columns,
              filename: outFilename,
              meta: {
                title: pdfTitle || filename,
                generatedAt: new Date().toLocaleString('pl-PL'),
                user: userName,
              }
            });

            setProgress(100);

            toast({
              title: "Sukces",
              description: "Dane zostały wyeksportowane do pliku Excel",
            });
          } catch (error) {
            console.error("Export error:", error);
            toast({
              title: "Błąd",
              description: "Wystąpił błąd podczas eksportu danych",
              variant: "destructive",
            });
          } finally {
            setIsExporting(false);
            setTimeout(() => setProgress(0), 500);
          }
        }}
        disabled={disabled || isExporting || (!onExport && data.length === 0)}
        className={className}
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {isExporting ? "Eksportowanie..." : label}
      </Button>
      {(isExporting || progress > 0) && (
        <div className="space-y-1">
          <Progress value={progress} className="w-full h-2" />
          {progress > 0 && progress < 100 && (
            <div className="text-xs text-muted-foreground text-center">
              {progress}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}