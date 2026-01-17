"use client";

import React, { useState, useEffect, memo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KSeFInvoiceData } from "@/types";

const KsefInvoicePopup = memo(function KsefInvoicePopup({
  ksefNumber,
  invoiceId,
  open,
  onOpenChange,
}: {
  ksefNumber: string;
  invoiceId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [invoice, setInvoice] = useState<KSeFInvoiceData | null>(null);

  // Use tRPC query to verify invoice
  const { data, isLoading, error, refetch } = trpc.ksef.verifyInvoice.useQuery(
    { ksefNumber, invoiceId: invoiceId || undefined },
    {
      enabled: false, // Don't auto-fetch, we'll fetch manually when dialog opens
      retry: false,
    }
  );

  // Fetch when dialog opens
  useEffect(() => {
    if (open && ksefNumber) {
      setInvoice(null);
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ksefNumber]);

  // Update invoice when data changes
  useEffect(() => {
    if (data?.valid && data.invoice) {
      setInvoice(data.invoice);
    }
  }, [data]);

  const isValid = data?.valid && !error;
  const isError = !isValid && (error || (data && !data.valid));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogTitle>Weryfikacja faktury w KSeF</DialogTitle>

        <div className="max-h-[calc(90vh-100px)] overflow-y-auto pr-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <p className="text-muted-foreground">Weryfikowanie faktury...</p>
          </div>
        )}

        {isValid && invoice && (
          <div className="border-2 border-green-500 p-4 rounded space-y-3 bg-green-50 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h2 className="font-bold text-green-700 dark:text-green-400">
                ✅ Faktura zweryfikowana
              </h2>
            </div>

            <div className="text-sm space-y-2">
              {invoice.Faktura?.Fa?.NrFa && (
                <p>
                  <span className="font-semibold">Numer faktury:</span>{" "}
                  {invoice.Faktura.Fa.NrFa}
                </p>
              )}
              {invoice.Faktura?.Podmiot1?.DaneIdentyfikacyjne?.Nazwa && (
                <p>
                  <span className="font-semibold">Sprzedawca:</span>{" "}
                  {invoice.Faktura.Podmiot1.DaneIdentyfikacyjne.Nazwa}
                </p>
              )}
              {invoice.Faktura?.Podmiot2?.DaneIdentyfikacyjne?.Nazwa && (
                <p>
                  <span className="font-semibold">Nabywca:</span>{" "}
                  {invoice.Faktura.Podmiot2.DaneIdentyfikacyjne.Nazwa}
                </p>
              )}
              {invoice.Faktura?.FaPodsumowanie?.KwotaBrutto && (
                <p>
                  <span className="font-semibold">Kwota brutto:</span>{" "}
                  {invoice.Faktura.FaPodsumowanie.KwotaBrutto} PLN
                </p>
              )}
              {invoice.Faktura?.FaPodsumowanie?.DataWystawienia && (
                <p>
                  <span className="font-semibold">Data wystawienia:</span>{" "}
                  {invoice.Faktura.FaPodsumowanie.DataWystawienia}
                </p>
              )}
            </div>
          </div>
        )}

        {isError && (
          <div className="border-2 border-red-500 p-4 rounded space-y-3 bg-red-50 dark:bg-red-950">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 className="font-bold text-red-700 dark:text-red-400">
                ❌ Błąd weryfikacji
              </h2>
            </div>
            <p className="text-sm text-red-700 dark:text-red-400">
              {error?.message ||
                "Faktura nieznaleziona lub nie ma dostępu w systemie KSeF"}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );

});

export { KsefInvoicePopup };

