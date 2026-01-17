"use client";

import React, { useState, useMemo } from "react";
import type { TDocumentDefinitions, Content, DynamicContent } from "pdfmake/interfaces";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Download, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { formatDate } from "@/lib/date-utils";
import { sanitizeExportCell } from "@/lib/export";

// Initialize pdfMake with fonts
if (pdfFonts && (pdfFonts as unknown as { pdfMake?: { vfs: unknown } }).pdfMake) {
  (pdfMake as { vfs?: unknown }).vfs = (pdfFonts as unknown as { pdfMake: { vfs: unknown } }).pdfMake.vfs;
} else {
  (pdfMake as { vfs?: unknown }).vfs = pdfFonts;
}

type ExportPeriod = "last30" | "specificMonth" | "last3Months" | "last6Months" | "thisYear" | "all";
type ExportFormat = "csv" | "pdf";

interface Company {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  ksefNumber?: string | null;
  userId?: string | null;
  userName?: string | null;
  companyName?: string | null;
  status: string;
  createdAt: Date;
  reviewedAt?: Date | null;
  reviewerName?: string | null;
  description?: string | null;
  companyId: string | null;
}

interface InvoiceExportDialogProps {
  invoices?: Invoice[];
  companies?: Company[];
  users?: User[];
}

const InvoiceExportDialog = React.memo(function InvoiceExportDialog({ invoices, companies, users }: InvoiceExportDialogProps) {
  const { toast } = useToast();
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("last30");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth().toString());
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportCompany, setExportCompany] = useState<string>("all");
  const [exportStatus, setExportStatus] = useState<string>("all");
  const [exportUser, setExportUser] = useState<string>("all");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearchQuery) return users;
    
    const query = userSearchQuery.toLowerCase();
    return users.filter(user => 
      user.name.toLowerCase().includes(query) || 
      user.email.toLowerCase().includes(query)
    );
  }, [users, userSearchQuery]);

  // Get selected user name for display
  const selectedUserName = useMemo(() => {
    if (exportUser === "all") return "Wszyscy użytkownicy";
    const user = users?.find(u => u.id === exportUser);
    return user ? `${user.name} (${user.email})` : "Wszyscy użytkownicy";
  }, [exportUser, users]);

  const handleExport = async () => {
    // Calculate date range based on selected period
    const now = new Date();
    let startDate: Date | undefined;
    
    switch (exportPeriod) {
      case "last30":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "specificMonth":
        const month = parseInt(exportMonth);
        const year = parseInt(exportYear);
        startDate = new Date(year, month, 1);
        break;
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case "thisYear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "all":
        startDate = undefined;
        break;
    }

    // Filter invoices by date, company, status, and user
    const exportInvoices = invoices?.filter(inv => {
      // Filter by company
      if (exportCompany !== "all" && inv.companyId !== exportCompany) return false;
      
      // Filter by status
      if (exportStatus !== "all" && inv.status !== exportStatus) return false;
      
      // Filter by user
      if (exportUser !== "all" && inv.userId !== exportUser) return false;
      
      // Filter by date
      if (!startDate) return true;
      
      const invDate = new Date(inv.createdAt);
      
      if (exportPeriod === "specificMonth") {
        const month = parseInt(exportMonth);
        const year = parseInt(exportYear);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        return invDate >= startDate && invDate <= endDate;
      }
      
      return invDate >= startDate;
    }) || [];

    if (!exportInvoices.length) {
      toast({
        title: "Brak danych",
        description: "Nie ma faktur do eksportu",
        variant: "destructive",
      });
      return;
    }

    // Check if there are any invoices with re_review status
    const reReviewInvoices = exportInvoices.filter(inv => inv.status === "re_review");
    if (reReviewInvoices.length > 0) {
      toast({
        title: "Ostrzeżenie",
        description: `Eksportowana partia zawiera ${reReviewInvoices.length} faktur(y) w statusie "Ponowna weryfikacja". Sprawdź dokumenty przed eksportem.`,
        variant: "destructive",
      });
    }

    // Convert to table format
    const headers: string[] = ["Data przesłania", "Data decyzji", "Numer faktury", "KSeF", "Użytkownik", "Firma", "Status", "Księgowy", "Opis"];
    const rows: string[][] = exportInvoices.map(inv => [
      inv.createdAt ? formatDate(inv.createdAt) : "",
      inv.reviewedAt ? formatDate(inv.reviewedAt) : "-",
      inv.invoiceNumber || "",
      inv.ksefNumber || "-",
      inv.userName || "",
      inv.companyName || "",
      inv.status === "accepted" ? "Zaakceptowana" : inv.status === "rejected" ? "Odrzucona" : inv.status === "in_review" ? "W trakcie" : inv.status === "re_review" ? "Ponowna weryfikacja" : "Oczekuje",
      inv.reviewerName || "-",
      inv.description || "-"
    ]);

    // Precompute periodText and filterLine for both CSV and PDF exports
    let periodText = "";
    switch (exportPeriod) {
      case "last30": periodText = "Ostatnie 30 dni"; break;
      case "specificMonth": periodText = `${parseInt(exportMonth) + 1}/${exportYear}`; break;
      case "last3Months": periodText = "Ostatnie 3 miesiące"; break;
      case "last6Months": periodText = "Ostatnie 6 miesięcy"; break;
      case "thisYear": periodText = "Bieżący rok"; break;
      case "all": periodText = "Wszystkie"; break;
    }

    let filterLine = "";
    if (exportCompany !== "all" || exportStatus !== "all") {
      if (exportCompany !== "all") {
        const companyName = companies?.find(c => c.id === exportCompany)?.name || "";
        filterLine += `Firma: ${companyName}`;
      }
      if (exportStatus !== "all") {
        const statusText = exportStatus === "accepted" ? "Zaakceptowane" : exportStatus === "rejected" ? "Odrzucone" : exportStatus === "in_review" ? "W trakcie" : "Oczekujące";
        if (filterLine) filterLine += " | ";
        filterLine += `Status: ${statusText}`;
      }
    }
    if (exportFormat === "csv") {
      setIsGenerating(true);
      setProgress(20);
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use shared exportToCSV helper to ensure BOM and metadata
      const formattedRows = exportInvoices.map(inv => ({
        submittedAt: inv.createdAt ? formatDate(inv.createdAt) : "",
        reviewedAt: inv.reviewedAt ? formatDate(inv.reviewedAt) : "-",
        invoiceNumber: inv.invoiceNumber || "",
        ksefNumber: inv.ksefNumber || "-",
        user: inv.userName || "",
        company: inv.companyName || "",
        status: inv.status === "accepted" ? "Zaakceptowana" : inv.status === "rejected" ? "Odrzucona" : inv.status === "in_review" ? "W trakcie" : inv.status === "re_review" ? "Ponowna weryfikacja" : "Oczekuje",
        reviewer: inv.reviewerName || "-",
        description: inv.description || "-",
      }));

      // trigger CSV download
      import("@/lib/export").then(({ exportToCSV }) => {
        exportToCSV({
          filename: `faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}`,
          columns: [
            { key: 'submittedAt', header: String(headers[0] ?? '') },
            { key: 'reviewedAt', header: String(headers[1] ?? '') },
            { key: 'invoiceNumber', header: String(headers[2] ?? '') },
            { key: 'ksefNumber', header: String(headers[3] ?? '') },
            { key: 'user', header: String(headers[4] ?? '') },
            { key: 'company', header: String(headers[5] ?? '') },
            { key: 'status', header: String(headers[6] ?? '') },
            { key: 'reviewer', header: String(headers[7] ?? '') },
            { key: 'description', header: String(headers[8] ?? '') },
          ],
          data: formattedRows,
          meta: {
            title: 'Raport Faktur - mobiFaktura',
            generatedAt: new Date().toLocaleString('pl-PL'),
            user: selectedUserName,
            filters: periodText + (filterLine ? ' | ' + filterLine : '')
          }
        });
      }).catch(e => {
        console.error('CSV export helper load failed', e);
      });

      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsGenerating(false);
      setProgress(0);
    } else {
      // PDF Export using pdfMake
      setIsGenerating(true);
      setProgress(10);
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let periodText = "";
      switch (exportPeriod) {
        case "last30": periodText = "Ostatnie 30 dni"; break;
        case "specificMonth": periodText = `${parseInt(exportMonth) + 1}/${exportYear}`; break;
        case "last3Months": periodText = "Ostatnie 3 miesiące"; break;
        case "last6Months": periodText = "Ostatnie 6 miesięcy"; break;
        case "thisYear": periodText = "Bieżący rok"; break;
        case "all": periodText = "Wszystkie"; break;
      }
      
      setProgress(25);
      
      // Build stats line
      const statsLine = `Data: ${new Date().toLocaleDateString("pl-PL")} | Okres: ${periodText} | Liczba faktur: ${exportInvoices.length}`;
      
      // Build optional filter line
      let filterLine = "";
      if (exportCompany !== "all" || exportStatus !== "all") {
        if (exportCompany !== "all") {
          const companyName = companies?.find(c => c.id === exportCompany)?.name || "";
          filterLine += `Firma: ${companyName}`;
        }
        if (exportStatus !== "all") {
          const statusText = exportStatus === "accepted" ? "Zaakceptowane" : exportStatus === "rejected" ? "Odrzucone" : exportStatus === "in_review" ? "W trakcie" : "Oczekujące";
          if (filterLine) filterLine += " | ";
          filterLine += `Status: ${statusText}`;
        }
      }
      
      setProgress(40);
      
      // Prepare table body with sanitized cells and safe wrapping; also compute column widths numerically
      const insertSoftBreaks = (text: string, maxWord = 30, insertEvery = 30) => {
        if (!text || typeof text !== 'string') return '';
        return text.replace(new RegExp(`([^\\n\\s]{${maxWord},})`, 'g'), (match) => {
          return match.replace(new RegExp(`(.{1,${insertEvery}})`, 'g'), '$1\u200B');
        });
      };

      const sanitizedRows = rows.map(row => {
        return row.map((cell, index) => {
          const text = insertSoftBreaks(sanitizeExportCell(cell));
          if (index === 6) { // Status column - make bold
            return { text, bold: true };
          }
          return { text };
        });
      });

      // Compute widths: prefer wider column for description (last column) but cap to prevent overflow
      const leftMargin = 10;
      const rightMargin = 10;
      const pageWidthPt = 841.89;
      const availableWidth = pageWidthPt - leftMargin - rightMargin;
      const gutters = (headers.length - 1) * 6;
      const extraSafety = 12;
      const contentWidth = Math.max(0, availableWidth - gutters - extraSafety);

      // Determine column weights based on header semantics (description gets more space, numeric/date less)
      const largeKeywords = ['uzasad', 'uzasadnienie', 'opis', 'notat', 'description', 'note', 'notes', 'justification', 'comment', 'remark'];
      const smallKeywords = ['kwota', 'amount', 'saldo', 'data', 'date', 'typ', 'id', 'nr', 'numer'];

      const rawWeights = headers.map(h => {
        const headerLower = String(h || '').toLowerCase();
        if (largeKeywords.some(k => headerLower.includes(k))) return 3;
        if (smallKeywords.some(k => headerLower.includes(k))) return 0.6;
        return 1;
      });

      const total = rawWeights.reduce((s, v) => s + v, 0);
      const maxFraction = 0.4;
      let fractions = rawWeights.map(w => w/total);
      let fixed = 0; const flexIdx: number[] = [];
      fractions.forEach((f,i) => { if (f>maxFraction) { fractions[i]=maxFraction; fixed += maxFraction } else flexIdx.push(i) });
      if (flexIdx.length) {
        const flexTotalOrig = flexIdx.reduce((s,i)=> s + ((rawWeights[i] ?? 0)/total), 0);
        const remaining = Math.max(0, 1-fixed);
        flexIdx.forEach(i => { const orig = ((rawWeights[i] ?? 0)/total); fractions[i] = flexTotalOrig>0 ? (remaining * orig / flexTotalOrig) : (remaining / flexIdx.length) });
      }

      let numericWidths = fractions.map(f => Number((f*contentWidth).toFixed(2)));
      // adjust rounding
      let diff = Math.round((contentWidth - numericWidths.reduce((s,v) => s+v,0))*100)/100;
      let id=0; while (Math.abs(diff)>=0.01 && id < numericWidths.length) { numericWidths[id] = Number(((numericWidths[id] ?? 0) + Math.sign(diff)*0.01).toFixed(2)); diff = Math.round((contentWidth - numericWidths.reduce((s,v) => s+(v ?? 0),0))*100)/100; id = (id+1)%numericWidths.length }

      // Cap the last column to prevent it from being too wide and causing overflow
      const lastColIdx = numericWidths.length - 1;
      const maxLastColWidth = 215; // max 215pt for last column to prevent overflow
      if ((numericWidths[lastColIdx] ?? 0) > maxLastColWidth) {
        const excess = (numericWidths[lastColIdx] ?? 0) - maxLastColWidth;
        numericWidths[lastColIdx] = maxLastColWidth;
        // Reduce total width proportionally instead of redistributing to avoid making other columns too wide
        const currentTotal = numericWidths.reduce((s, v) => s + (v ?? 0), 0);
        const targetTotal = contentWidth;
        if (currentTotal > targetTotal) {
          const scale = targetTotal / currentTotal;
          numericWidths = numericWidths.map(w => Number((w * scale).toFixed(2)));
        }
      }

      setProgress(60);

      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [leftMargin, 75, rightMargin, 40],
        header: function(currentPage: number, pageCount: number): Content {
          return [
            { text: 'Raport Faktur - mobiFaktura', style: 'header', alignment: 'center' as const, margin: [0, 20, 0, 8] as [number, number, number, number] },
            { text: statsLine, style: 'subheader', alignment: 'center' as const, margin: [0, 0, 0, 5] as [number, number, number, number] },
            ...(filterLine ? [{ text: filterLine, style: 'subheader', alignment: 'center' as const, margin: [0, 0, 0, 15] as [number, number, number, number] }] : [{ text: '', margin: [0, 0, 0, 10] as [number, number, number, number] }])
          ];
        },
        footer: function(currentPage: number, pageCount: number): Content {
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
              widths: numericWidths as any,
              body: [
                headers.map(h => ({ text: insertSoftBreaks(String(h || '')), style: 'tableHeader', alignment: 'center' })),
                ...sanitizedRows
              ]
            },
            layout: {
              fillColor: undefined,
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#000000',
              vLineColor: () => '#000000'
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
          fontSize: 9,
          font: 'Roboto'
        }
      };
      
      setProgress(80);
      
      // Allow UI to update before generating PDF
      await new Promise(resolve => setTimeout(resolve, 100));

      // Preflight NaN check
      const findNaN = (obj: any, path: string[] = []): string | null => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj === 'number') return Number.isNaN(obj) ? path.join('.') || 'root' : null;
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
            const res = findNaN((obj as any)[k], [...path, k]);
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
        pdfMake.createPdf(docDefinition).download(`faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}.pdf`);
      } catch (e) {
        console.error('pdfMake generation error:', e, { docDefinition });
        toast({ title: 'Błąd', description: 'Wystąpił błąd podczas generowania pliku PDF', variant: 'destructive' });
        setIsGenerating(false);
        setProgress(0);
        return;
      }
      
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 200));
      setIsGenerating(false);
      setProgress(0);
    }

    setExportDialogOpen(false);
    toast({ title: "Wyeksportowano", description: `Wyeksportowano ${exportInvoices.length} faktur` });
  };

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Eksportuj faktury
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Eksport faktur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[calc(90vh-120px)] overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="format">Format</Label>
            <Select value={exportFormat} onValueChange={(value: string) => setExportFormat(value as "csv" | "pdf")}>
              <SelectTrigger id="format">
                <SelectValue placeholder="Wybierz format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="pdf">PDF (do druku)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="period">Okres</Label>
            <Select value={exportPeriod} onValueChange={(value: string) => setExportPeriod(value as "last30" | "specificMonth" | "last3Months" | "last6Months" | "thisYear" | "all")}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Wybierz okres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30">Ostatnie 30 dni</SelectItem>
                <SelectItem value="specificMonth">Wybrany miesiąc</SelectItem>
                <SelectItem value="last3Months">Ostatnie 3 miesiące</SelectItem>
                <SelectItem value="last6Months">Ostatnie 6 miesięcy</SelectItem>
                <SelectItem value="thisYear">Ten rok</SelectItem>
                <SelectItem value="all">Wszystkie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {exportPeriod === "specificMonth" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="month">Miesiąc</Label>
                <Select value={exportMonth} onValueChange={setExportMonth}>
                  <SelectTrigger id="month">
                    <SelectValue placeholder="Miesiąc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Styczeń</SelectItem>
                    <SelectItem value="1">Luty</SelectItem>
                    <SelectItem value="2">Marzec</SelectItem>
                    <SelectItem value="3">Kwiecień</SelectItem>
                    <SelectItem value="4">Maj</SelectItem>
                    <SelectItem value="5">Czerwiec</SelectItem>
                    <SelectItem value="6">Lipiec</SelectItem>
                    <SelectItem value="7">Sierpień</SelectItem>
                    <SelectItem value="8">Wrzesień</SelectItem>
                    <SelectItem value="9">Październik</SelectItem>
                    <SelectItem value="10">Listopad</SelectItem>
                    <SelectItem value="11">Grudzień</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Rok</Label>
                <Select value={exportYear} onValueChange={setExportYear}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Rok" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="exportCompany">Firma (opcjonalne)</Label>
            <Select value={exportCompany} onValueChange={setExportCompany}>
              <SelectTrigger id="exportCompany">
                <SelectValue placeholder="Wszystkie firmy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie firmy</SelectItem>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportStatus">Status (opcjonalny)</Label>
            <Select value={exportStatus} onValueChange={setExportStatus}>
              <SelectTrigger id="exportStatus">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="pending">Oczekujące</SelectItem>
                <SelectItem value="in_review">W trakcie</SelectItem>
                <SelectItem value="accepted">Zaakceptowane</SelectItem>
                <SelectItem value="rejected">Odrzucone</SelectItem>
                <SelectItem value="re_review">Ponowna weryfikacja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportUser">Użytkownik (opcjonalne)</Label>
            <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userPopoverOpen}
                  className="w-full justify-between"
                >
                  {selectedUserName}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <div className="p-2">
                  <Input
                    placeholder="Szukaj użytkownika..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        setExportUser("all");
                        setUserPopoverOpen(false);
                        setUserSearchQuery("");
                      }}
                    >
                      Wszyscy użytkownicy
                    </Button>
                    {filteredUsers.map((user) => (
                      <Button
                        key={user.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setExportUser(user.id);
                          setUserPopoverOpen(false);
                          setUserSearchQuery("");
                        }}
                      >
                        {user.name} ({user.email})
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {isGenerating && (
            <div className="space-y-2">
              <Label>{exportFormat === "csv" ? "Generowanie CSV..." : "Generowanie PDF..."}</Label>
              <Progress value={progress} className="w-full" />
            </div>
          )}
          <Button onClick={handleExport} className="w-full" disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? "Generowanie..." : `Eksportuj do ${exportFormat.toUpperCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export { InvoiceExportDialog };
