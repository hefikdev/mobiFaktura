"use client";

import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, ZoomIn, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, use } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function UserInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <UserInvoiceContent id={id} />;
}

function UserInvoiceContent({ id }: { id: string }) {
  const { data: invoice, isLoading, refetch } = trpc.invoice.getById.useQuery({ id });
  const { data: user } = trpc.auth.me.useQuery();
  const [imageZoomed, setImageZoomed] = useState(false);
  const { toast } = useToast();

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

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <UserHeader />}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold mb-2">Faktura nie została znaleziona</p>
            <Link href="/auth/dashboard">
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
          <Link href="/auth/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Powrót do listy
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Zdjęcie faktury
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setImageZoomed(true)}
                  className="ml-auto"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
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
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2">
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                {invoice.reviewedAt && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Sprawdzona: {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                  </p>
                )}
                {invoice.status === "rejected" && invoice.rejectionReason && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">Powód odrzucenia:</p>
                    <p className="text-sm text-red-800 dark:text-red-300">{invoice.rejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Szczegóły faktury</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Dodana: {format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Image Zoom Dialog */}
      <Dialog open={imageZoomed} onOpenChange={setImageZoomed}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          <div className="relative w-full h-[90vh]">
            <img
              src={invoice.imageUrl}
              alt="Faktura - powiększenie"
              className="w-full h-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
}
