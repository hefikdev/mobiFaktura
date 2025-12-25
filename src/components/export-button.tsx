"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportToCSV, ExportOptions } from "@/lib/export";
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
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";

// Initialize pdfMake with fonts
if (pdfFonts && (pdfFonts as unknown as { pdfMake?: { vfs: unknown } }).pdfMake) {
  (pdfMake as { vfs?: unknown }).vfs = (pdfFonts as unknown as { pdfMake: { vfs: unknown } }).pdfMake.vfs;
} else {
  (pdfMake as { vfs?: unknown }).vfs = pdfFonts;
}

type ExportFormat = "csv" | "pdf";

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ExportButtonProps<T = unknown> {
  data: T[];
  columns: ExportOptions<T>['columns'];
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
  onExport?: () => Promise<T[]> | T[];
  filters?: FilterOption[];
  enablePdf?: boolean;
  pdfTitle?: string;
  pdfSubtitle?: string;
  userName?: string;
}

export function ExportButton<T>({
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
  pdfTitle = "Historia saldo",
  pdfSubtitle = "",
  userName,
}: ExportButtonProps<T>) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);

  // Initialize filters
  const initializeFilters = () => {
    const initialFilters: Record<string, string> = {};
    filters.forEach(filter => {
      initialFilters[filter.key] = "all";
    });
    setSelectedFilters(initialFilters);
  };

  const openDialog = () => {
    initializeFilters();
    setExportDialogOpen(true);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(10);

    try {
      let exportData = data;

      if (onExport) {
        const result = onExport();
        if (result instanceof Promise) {
          exportData = await result;
        } else {
          exportData = result;
        }
      }

      // Apply filters
      if (filters.length > 0 && Object.keys(selectedFilters).length > 0) {
        exportData = exportData.filter(item => {
          return filters.every(filter => {
            const filterValue = selectedFilters[filter.key];
            if (filterValue === "all") return true;

            const itemValue = (item as any)[filter.key];
            return itemValue === filterValue;
          });
        });
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

      if (exportFormat === "csv") {
        setProgress(50);

        exportToCSV({
          data: exportData,
          columns,
          filename,
        });

        setProgress(100);
      } else if (exportFormat === "pdf" && enablePdf) {
        setProgress(50);

        // Generate PDF
        await generatePDF(exportData, columns, filename, pdfTitle, pdfSubtitle, userName);

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
    const headers = columns.map(col => col.header);
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.key ? (item as any)[col.key] : item;
        return col.formatter ? col.formatter(value) : String(value || "");
      })
    );

    const statsLine = `Data: ${new Date().toLocaleDateString("pl-PL")} | Liczba rekordów: ${data.length}`;

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [10, 75, 10, 40],
      header: function(currentPage: number, pageCount: number) {
        return [
          { text: userName ? `${title} - ${userName}` : title, style: 'header', alignment: 'center', margin: [0, 20, 0, 8] },
          { text: subtitle || statsLine, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 15] }
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
            widths: columns.map(() => 'auto'),
            body: [
              headers.map(h => ({ text: h, style: 'tableHeader', alignment: 'center' })),
              ...rows
            ]
          },
          layout: {
            fillColor: function(rowIndex: number) {
              return rowIndex === 0 ? '#000000' : (rowIndex % 2 === 0 ? '#f5f5f5' : null);
            },
            hLineWidth: function() { return 0.5; },
            vLineWidth: function() { return 0.5; },
            hLineColor: function() { return '#000000'; },
            vLineColor: function() { return '#000000'; }
          }
        }
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          color: '#000000'
        },
        subheader: {
          fontSize: 10,
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
        fontSize: 9
      }
    };

    setProgress(80);
    await new Promise(resolve => setTimeout(resolve, 100));

    pdfMake.createPdf(docDefinition).download(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eksport danych</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {enablePdf && (
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select value={exportFormat} onValueChange={(value: string) => setExportFormat(value as ExportFormat)}>
                  <SelectTrigger id="format">
                    <SelectValue placeholder="Wybierz format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV (Excel)</SelectItem>
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
                    <SelectItem value="all">Wszystkie</SelectItem>
                    {filter.options.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {isExporting && (
              <div className="space-y-2">
                <Label>{exportFormat === "csv" ? "Generowanie CSV..." : "Generowanie PDF..."}</Label>
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
              const result = onExport();
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

            setProgress(80);

            exportToCSV({
              data: exportData,
              columns,
              filename,
            });

            setProgress(100);

            toast({
              title: "Sukces",
              description: "Dane zostały wyeksportowane do pliku CSV",
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
      {isExporting && (
        <Progress value={progress} className="w-full h-2" />
      )}
    </div>
  );
}