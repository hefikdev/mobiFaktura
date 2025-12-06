"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ExportPeriod = "last30" | "specificMonth" | "last3Months" | "last6Months" | "thisYear" | "all";
type ExportFormat = "csv" | "pdf";

interface Company {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  ksefNumber?: string | null;
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
}

export function InvoiceExportDialog({ invoices, companies }: InvoiceExportDialogProps) {
  const { toast } = useToast();
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("last30");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth().toString());
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportCompany, setExportCompany] = useState<string>("all");
  const [exportStatus, setExportStatus] = useState<string>("all");

  const handleExport = () => {
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

    // Filter invoices by date, company, and status
    const exportInvoices = invoices?.filter(inv => {
      // Filter by company
      if (exportCompany !== "all" && inv.companyId !== exportCompany) return false;
      
      // Filter by status
      if (exportStatus !== "all" && inv.status !== exportStatus) return false;
      
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
    const headers = ["Data przesłania", "Data decyzji", "Numer faktury", "KSeF", "Użytkownik", "Firma", "Status", "Księgowy", "Opis"];
    const rows = exportInvoices.map(inv => [
      inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("pl-PL") : "",
      inv.reviewedAt ? new Date(inv.reviewedAt).toLocaleDateString("pl-PL") : "-",
      inv.invoiceNumber || "",
      inv.ksefNumber || "-",
      inv.userName || "",
      inv.companyName || "",
      inv.status === "accepted" ? "Zaakceptowana" : inv.status === "rejected" ? "Odrzucona" : inv.status === "in_review" ? "W trakcie" : inv.status === "re_review" ? "Ponowna weryfikacja" : "Oczekuje",
      inv.reviewerName || "-",
      inv.description || "-"
    ]);

    if (exportFormat === "csv") {
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Download CSV
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // PDF Export using jsPDF
      const doc = new jsPDF("landscape");
      
      // Add title
      doc.setFontSize(16);
      doc.text("Raport Faktur - mobiFaktura", 14, 15);
      
      // Add metadata
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString("pl-PL")}`, 14, 22);
      let periodText = "Okres: ";
      switch (exportPeriod) {
        case "last30": periodText += "Ostatnie 30 dni"; break;
        case "specificMonth": periodText += `${parseInt(exportMonth) + 1}/${exportYear}`; break;
        case "last3Months": periodText += "Ostatnie 3 miesiące"; break;
        case "last6Months": periodText += "Ostatnie 6 miesięcy"; break;
        case "thisYear": periodText += "Bieżący rok"; break;
        case "all": periodText += "Wszystkie"; break;
      }
      doc.text(periodText, 14, 28);
      if (exportCompany !== "all") {
        const companyName = companies?.find(c => c.id === exportCompany)?.name || "";
        doc.text(`Firma: ${companyName}`, 14, 34);
      }
      if (exportStatus !== "all") {
        const statusText = exportStatus === "accepted" ? "Zaakceptowane" : exportStatus === "rejected" ? "Odrzucone" : exportStatus === "in_review" ? "W trakcie" : "Oczekujące";
        doc.text(`Status: ${statusText}`, 14, exportCompany !== "all" ? 40 : 34);
      }
      doc.text(`Liczba faktur: ${exportInvoices.length}`, 14, exportCompany !== "all" && exportStatus !== "all" ? 46 : exportCompany !== "all" || exportStatus !== "all" ? 40 : 34);
      
      // Add table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: exportCompany !== "all" && exportStatus !== "all" ? 52 : exportCompany !== "all" || exportStatus !== "all" ? 46 : 40,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 30 },
          5: { cellWidth: 35 },
          6: { cellWidth: 25 },
          7: { cellWidth: 25 },
          8: { cellWidth: "auto" }
        },
        didParseCell: function(data) {
          // Color status column
          if (data.column.index === 6 && data.section === "body") {
            if (data.cell.text[0] === "Zaakceptowana") {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.text[0] === "Odrzucona") {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.text[0] === "W trakcie") {
              data.cell.styles.textColor = [59, 130, 246];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });
      
      // Download PDF
      doc.save(`faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}.pdf`);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eksport faktur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <Button onClick={handleExport} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Eksportuj do {exportFormat.toUpperCase()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
