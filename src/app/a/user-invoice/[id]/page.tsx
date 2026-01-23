"use client";

import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { BudgetRequestReviewDialog } from "@/components/budget-request-review-dialog";
import { CorrectionsDialog } from "@/components/corrections-dialog";
import { ErrorDisplay } from "@/components/error-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, ZoomIn, RefreshCw, X, ExternalLink, Printer, Download, Trash2, FilePen, ImageOff, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { generateSingleInvoiceExcel } from "@/lib/excel-utils";

const KsefInvoicePopup = dynamic(() => import("@/components/ksef-invoice-popup").then(m => m.KsefInvoicePopup));

export default function UserInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserInvoiceContent id={id} />;
}

function UserInvoiceContent({ id }: { id: string }) {
  const router = useRouter();
  const { data: invoice, isLoading, refetch, error } = trpc.invoice.getById.useQuery({ id, claimReview: false });
  const { data: user } = trpc.auth.me.useQuery();
  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageLoadError, setImageLoadError] = useState(false);
  const [budgetRequestDialogOpen, setBudgetRequestDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [correctionsDialogOpen, setCorrectionsDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { toast } = useToast();

  // KSeF Popup states
  const [ksefPopupOpen, setKsefPopupOpen] = useState(false);
  
  // Query corrections for this invoice
  const { data: corrections } = trpc.invoice.getCorrectionsForInvoice.useQuery(
    { invoiceId: id },
    { enabled: !!invoice }
  );

  const deleteInvoiceMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Faktura usunięta",
        description: "Faktura została trwale usunięta",
      });
      router.push("/a/dashboard");
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExportInvoice = async () => {
    if (!invoice) return;
    
    setIsExporting(true);
    setExportProgress(10);
    
    try {
      setExportProgress(30);
      await generateSingleInvoiceExcel(invoice, {
        dateFormat: "dd/MM/yyyy",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
      });

      setExportProgress(100);
      toast({
        title: "Sukces",
        description: "Faktura została wyeksportowana",
      });
      setExportDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wyeksportować faktury",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 500);
    }
  };

  const handlePrint = () => {
    if (!invoice || !invoice.imageUrl) {
      toast({
        title: "Brak obrazu",
        description: "Nie można wydrukować faktury bez obrazu",
        variant: "destructive",
      });
      return;
    }

    // Create a hidden iframe to load and print the image
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; }
              img { width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${invoice.imageUrl}" onload="window.print(); setTimeout(() => document.body.parentElement.remove(), 100);" />
          </body>
        </html>
      `);
      iframeDoc.close();
    }

    // Clean up iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  const handleDownload = async () => {
    if (!invoice || !invoice.imageUrl) {
      toast({
        title: "Brak obrazu",
        description: "Nie można pobrać faktury bez obrazu",
        variant: "destructive",
      });
      return;
    }

    const imageUrl = invoice.imageUrl;

    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `faktura_${invoice.invoiceNumber || id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      window.URL.revokeObjectURL(url);

      toast({
        title: "Pobrano",
        description: "Faktura została pobrana",
      });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać faktury",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}
        <main className="flex-1 p-6">
          <ErrorDisplay
            title="Błąd podczas ładowania faktury"
            message={error.message}
            error={error}
          />
        </main>
        <Footer />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold mb-2">Faktura nie została znaleziona</p>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót do listy
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}

      {/* Budget Request Review Dialog - Only for Accountants/Admins */}
      {invoice.budgetRequest && (user?.role === "accountant" || user?.role === "admin") && (
        <BudgetRequestReviewDialog
          request={{
            id: invoice.budgetRequest.id,
            userId: "",
            userName: invoice.budgetRequest.userName || "",
            userEmail: invoice.submitter?.email || "",
            currentBalanceAtRequest: 0,
            requestedAmount: invoice.budgetRequest.requestedAmount,
            justification: "",
            status: invoice.budgetRequest.status,
            createdAt: invoice.budgetRequest.createdAt,
            reviewedAt: invoice.budgetRequest.reviewedAt,
            companyId: invoice.budgetRequest.companyId,
            companyName: invoice.budgetRequest.companyName,
          }}
          open={budgetRequestDialogOpen}
          onOpenChange={setBudgetRequestDialogOpen}
          onSuccess={() => {
            refetch();
          }}
          mode="details"
        />
      )}

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="mb-4">
          <Link href="/a/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót do listy
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Section */}
          <Card>
            <CardContent>
              <div
                className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border"
              >
                {invoice.imageUrl && !imageLoadError ? (
                  <div
                    className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setImageZoomed(true)}
                  >
                    <img
                      src={invoice.imageUrl}
                      alt="Faktura"
                      className="w-full h-full object-contain"
                      onError={() => setImageLoadError(true)}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="h-8 w-8" />
                    <p className="text-sm">Brak obrazu faktury</p>
                    <p className="text-xs">Nie znaleziono pliku lub jest niedostępny</p>
                  </div>
                )}
              </div>
                      {/* Action buttons */}
        <div className="flex gap-2 mt-4 justify-center lg:justify-end">
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            title="Drukuj"
            className="flex items-center gap-1"
          >
            <Printer className="h-4 w-4" />
            <span>Drukuj</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            title="Pobierz"
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            <span>Pobierz</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            title="Eksportuj do Excel"
            className="flex items-center gap-1"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel</span>
          </Button>
          {user?.role === "user" && invoice.userId === user.id && invoice.status !== "transferred" && invoice.status !== "settled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              title="Usuń fakturę"
              className="flex items-center gap-1 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
              <span>Usuń</span>
            </Button>
          )}
                          {invoice.ksefNumber && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setKsefPopupOpen(true)}
                        title="Zobacz KSEF"
                      >
                        KSeF<ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {corrections && corrections.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCorrectionsDialogOpen(true)}
                    title="Zobacz faktury korygujące"
                    className="flex items-center gap-1"
                  >
                    <FilePen className="h-4 w-4" />
                    <span>Korekty</span>
                    <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">
                      {corrections.length}
                    </span>
                  </Button>
                )}
        </div>
            </CardContent>
            
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
                    {user && (user.role === "admin" || user.role === "accountant") && (
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">Przeglądasz fakturę w trybie pracownika</span>
            <Link href={`/a/invoice/${id}`}>
              <Button size="sm">Kliknij aby zarządzać</Button>
            </Link>
          </div>
        )}

            {invoice.advance && (
              <Card>
                <CardHeader>
                  <CardTitle>Zaliczka</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Kwota</p>
                      <p className="font-medium">{invoice.advance.amount.toFixed(2)} PLN</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="font-medium">
                        {invoice.advance.status === "pending" ? "Oczekująca" :
                         invoice.advance.status === "transferred" ? "Przelana" :
                         invoice.advance.status === "settled" ? "Rozliczona" : invoice.advance.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data utworzenia</p>
                      <p className="font-medium">{format(new Date(invoice.advance.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                    </div>
                    {invoice.advance.transferDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Data przelewu</p>
                        <p className="font-medium">{format(new Date(invoice.advance.transferDate), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Budget Request Info */}
            {invoice.budgetRequest && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Zaliczka</CardTitle>
                    {(user?.role === "accountant" || user?.role === "admin") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBudgetRequestDialogOpen(true)}
                      >
                        Zobacz szczegóły
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`space-y-2 ${(user?.role === "accountant" || user?.role === "admin") ? "cursor-pointer hover:bg-muted/50 -mx-4 -my-2 p-4 rounded-md transition-colors" : ""}`}
                    onClick={() => {
                      if (user?.role === "accountant" || user?.role === "admin") {
                        setBudgetRequestDialogOpen(true);
                      }
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Użytkownik</p>
                        <p className="font-medium">{invoice.budgetRequest.userName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Firma</p>
                        <p className="font-medium">{invoice.budgetRequest.companyName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Kwota zaliczki</p>
                        <p className="font-medium">{invoice.budgetRequest.requestedAmount.toFixed(2)} PLN</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <InvoiceStatusBadge status={invoice.budgetRequest.status === "approved" ? "accepted" : invoice.budgetRequest.status === "rejected" ? "rejected" : "pending"} variant="compact" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Data złożenia</p>
                        <p className="font-medium">{format(new Date(invoice.budgetRequest.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                      </div>
                      {invoice.budgetRequest.reviewedAt && (
                        <div>
                          <p className="text-xs text-muted-foreground">Data decyzji</p>
                          <p className="font-medium">{format(new Date(invoice.budgetRequest.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                        </div>
                      )}
                    </div>
                    {invoice.budgetRequest.relatedInvoices && invoice.budgetRequest.relatedInvoices.length > 0 && (user?.role === "accountant" || user?.role === "admin") && (
                      <div className="pt-2 mt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">Inne faktury powiązane z tą zaliczką:</p>
                        <div className="space-y-1">
                          {invoice.budgetRequest.relatedInvoices.map((relInv: { id: string; invoiceNumber: string | null; kwota: number | null; status: string }) => (
                            <div
                              key={relInv.id}
                              className="flex items-center justify-between text-xs p-1.5 bg-background rounded hover:bg-muted"
                            >
                              <span className="font-medium">{relInv.invoiceNumber || "Brak numeru"}</span>
                              <div className="flex items-center gap-2">
                                {relInv.kwota && <span>{relInv.kwota.toFixed(2)} PLN</span>}
                                <InvoiceStatusBadge status={relInv.status} variant="compact" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
              </CardHeader>
              <CardContent>
                <div className="mb-2 scale-150 origin-left">
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                {invoice.reviewedAt && invoice.reviewer && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Sprawdzona przez: <span className="font-medium">{invoice.reviewer.name}</span>
                    <br />
                    {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                  </p>
                )}
                {invoice.status === "rejected" && invoice.rejectionReason && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">Powód odrzucenia:</p>
                    <p className="text-sm text-red-800 dark:text-red-300">{invoice.rejectionReason}</p>
                  </div>
                )}
                {invoice.status === "accepted" && invoice.rejectionReason && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">Dekretacja księgowego:</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{invoice.rejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Details Card */}
            <Card>
              <CardHeader>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Numer faktury</label>
                  <p className="text-base mt-1">
                    {invoice.invoiceNumber || "Brak danych"}
                  </p>
                </div>

                {invoice.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Opis</label>
                    <p className="text-base mt-1">{invoice.description}</p>
                  </div>
                )}

                {invoice.justification && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Uzasadnienie</label>
                    <p className="text-base mt-1">{invoice.justification}</p>
                  </div>
                )}

                {invoice.kwota && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Kwota</label>
                    <p className="text-base mt-1">
                      {parseFloat(invoice.kwota).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',')} PLN
                    </p>
                  </div>
                )}

                {invoice.ksefNumber && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Numer KSeF</label>
                    <p className="text-base mt-1">{invoice.ksefNumber}</p>
                  </div>
                )}

                <div>
                    <label className="text-sm font-medium text-muted-foreground">Dodana:</label>
                    <p className="text-base mt-1">{format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                  </div>

                {/* Edit tracking info */}
                {invoice.editHistory && invoice.editHistory.length > 0 && (
                  <>
                    <div className="pt-2 border-t col-span-1 md:col-span-2">
                      <p className="text-sm font-medium">Historia edycji</p>
                    </div>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-md max-h-[120px] overflow-y-auto col-span-1 md:col-span-2">
                      <div className="space-y-2">
                        {invoice.editHistory.map((edit: { editor: { name: string } | null; editedAt: Date }, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{edit.editor?.name || "Nieznany"}</span>
                            <span className="text-muted-foreground text-xs">{format(new Date(edit.editedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {(!invoice.editHistory || invoice.editHistory.length === 0) && invoice.lastEditor && invoice.lastEditedAt && (
                  <>
                    <div className="pt-2 border-t col-span-1 md:col-span-2">
                      <p className="text-sm font-medium">Ostatnia edycja</p>
                    </div>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-md col-span-1 md:col-span-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{invoice.lastEditor.name}</span>
                        <span className="text-muted-foreground text-xs">{format(new Date(invoice.lastEditedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Image Zoom Dialog */}
      <Dialog open={imageZoomed} onOpenChange={(open) => {
        setImageZoomed(open);
        if (!open) {
          setImageScale(1);
          setImagePosition({ x: 50, y: 50 });
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[95vh] p-2">
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm"
            onClick={() => setImageZoomed(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative w-full h-[85vh] overflow-auto scrollbar-hide flex items-start justify-center">
            {invoice.imageUrl && !imageLoadError ? (
              <>
                <img
                  src={invoice.imageUrl}
                  alt="Faktura - powiększenie"
                  className="max-w-full h-auto object-contain cursor-zoom-in transition-transform duration-100 ease-out hidden sm:block"
                  style={{
                    transform: `scale(${imageScale})`,
                    transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`
                  }}
                  onMouseEnter={() => setImageScale(2.5)}
                  onMouseLeave={() => {
                    setImageScale(1);
                    setImagePosition({ x: 50, y: 50 });
                  }}
                  onMouseMove={(e) => {
                    if (imageScale > 1) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      setImagePosition({ x, y });
                    }
                  }}
                  onError={() => setImageLoadError(true)}
                />
                <img
                  src={invoice.imageUrl}
                  alt="Faktura - powiększenie"
                  className="max-w-full h-auto object-contain sm:hidden"
                  onError={() => setImageLoadError(true)}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">Brak obrazu faktury</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Usuń fakturę</DialogTitle>
            <DialogDescription>
              Ta operacja jest NIEODWRACALNA. Faktura i plik zostaną trwale usunięte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
            <div className="space-y-2 p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Numer faktury:</strong> {invoice.invoiceNumber || "Brak numeru"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Firma:</strong> {invoice.company?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Twoje hasło *</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Wprowadź hasło aby potwierdzić"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletePassword("");
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deletePassword.trim()) {
                  toast({
                    title: "Błąd",
                    description: "Hasło jest wymagane",
                    variant: "destructive",
                  });
                  return;
                }
                deleteInvoiceMutation.mutate({
                  id,
                  password: deletePassword,
                });
                setShowDeleteDialog(false);
                setDeletePassword("");
              }}
              disabled={deleteInvoiceMutation.isPending || !deletePassword.trim()}
            >
              {deleteInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                "Usuń definitywnie"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="md:hidden">
        <Footer />
      </div>

      {/* KSeF Invoice Popup */}
      {invoice?.ksefNumber && (
        <KsefInvoicePopup
          ksefNumber={invoice.ksefNumber}
          invoiceId={id}
          open={ksefPopupOpen}
          onOpenChange={setKsefPopupOpen}
        />
      )}
      
      {/* Corrections Dialog */}
      <CorrectionsDialog
        invoiceId={id}
        open={correctionsDialogOpen}
        onOpenChange={setCorrectionsDialogOpen}
      />

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eksportuj fakturę do Excel</DialogTitle>
            <DialogDescription>
              Wybierz format daty dla eksportu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isExporting && (
              <div className="space-y-2">
                <Label>Generowanie Excel...</Label>
                <Progress value={exportProgress} className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting}>
              Anuluj
            </Button>
            <Button onClick={handleExportInvoice} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eksportowanie...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Eksportuj
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
