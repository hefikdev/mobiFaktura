"use client";

import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { ErrorDisplay } from "@/components/error-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, ZoomIn, RefreshCw, X, ExternalLink, Printer, Download } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import dynamic from "next/dynamic";

const KsefInvoicePopup = dynamic(() => import("@/components/ksef-invoice-popup").then(m => m.KsefInvoicePopup));

export default function UserInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserInvoiceContent id={id} />;
}

function UserInvoiceContent({ id }: { id: string }) {
  const { data: invoice, isLoading, refetch, error } = trpc.invoice.getById.useQuery({ id, claimReview: false });
  const { data: user } = trpc.auth.me.useQuery();
  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

  // KSeF Popup states
  const [ksefPopupOpen, setKsefPopupOpen] = useState(false);

  const handlePrint = () => {
    if (!invoice) return;

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
    if (!invoice) return;

    try {
      // Fetch the image as a blob
      const response = await fetch(invoice.imageUrl);
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
            <Link href="/a/dashboard">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Powrót do listy
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}

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
                className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setImageZoomed(true)}
              >
                <img
                  src={invoice.imageUrl}
                  alt="Faktura"
                  className="w-full h-full object-contain"
                />
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
        </div>
            </CardContent>
            
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Status Card */}
            {user && (user.role === "admin" || user.role === "accountant") && (
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">Przeglądasz fakturę w trybie pracownika</span>
            <Link href={`/a/invoice/${id}`}>
              <Button size="sm">Kliknij aby zarządzać</Button>
            </Link>
          </div>
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
                {(invoice.status === "accepted" || invoice.status === "re_review") && invoice.rejectionReason && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">Uwagi księgowego:</p>
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
            />
            <img
              src={invoice.imageUrl}
              alt="Faktura - powiększenie"
              className="max-w-full h-auto object-contain sm:hidden"
            />
          </div>
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
    </div>
  );
}
