"use client";

import React, { useState, useEffect, memo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KSeFInvoiceData } from "@/types";

const KsefInvoicePopup = memo(function KsefInvoicePopup({
  ksefNumber,
  invoiceId,
  userInvoiceData,
  open,
  onOpenChange,
}: {
  ksefNumber: string;
  invoiceId?: string | null;
  userInvoiceData?: {
    invoiceNumber?: string;
    kwota?: number;
  } | null;
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

  // Compare KSeF data with user-entered data
  const ksefInvoiceNumber = invoice?.Faktura?.Fa?.NrFa || "";
  const ksefKwota = invoice?.Faktura?.FaPodsumowanie?.KwotaBrutto 
    ? parseFloat(invoice.Faktura.FaPodsumowanie.KwotaBrutto) 
    : null;
  
  const invoiceNumberMatch = !userInvoiceData?.invoiceNumber || 
    ksefInvoiceNumber === userInvoiceData.invoiceNumber;
  const kwotaMatch = !userInvoiceData?.kwota || !ksefKwota ||
    Math.abs(ksefKwota - userInvoiceData.kwota) < 0.01;
  
  const hasComparison = userInvoiceData && (userInvoiceData.invoiceNumber || userInvoiceData.kwota);
  const allMatch = invoiceNumberMatch && kwotaMatch;

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
          <div className={`border-2 p-4 rounded space-y-3 ${allMatch ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-amber-500 bg-amber-50 dark:bg-amber-950'}`}>
            <div className="flex items-center gap-2">
              {allMatch ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              <h2 className={`font-bold ${allMatch ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {allMatch ? "✅ Faktura zweryfikowana - Dane zgodne" : "⚠️ Faktura zweryfikowana - Sprawdź dane"}
              </h2>
            </div>

            <div className="text-sm space-y-2">
              {invoice.Faktura?.Fa?.NrFa && (
                <div className={`p-2 rounded ${!invoiceNumberMatch ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300' : ''}`}>
                  <p className="flex items-center gap-2">
                    {!invoiceNumberMatch && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <span className="font-semibold">Numer faktury (KSeF):</span>{" "}
                    {invoice.Faktura.Fa.NrFa}
                  </p>
                  {hasComparison && userInvoiceData?.invoiceNumber && !invoiceNumberMatch && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Wprowadzono: {userInvoiceData.invoiceNumber}
                    </p>
                  )}
                </div>
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
                <div className={`p-2 rounded ${!kwotaMatch ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300' : ''}`}>
                  <p className="flex items-center gap-2">
                    {!kwotaMatch && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <span className="font-semibold">Kwota brutto (KSeF):</span>{" "}
                    {invoice.Faktura.FaPodsumowanie.KwotaBrutto} PLN
                  </p>
                  {hasComparison && userInvoiceData?.kwota && !kwotaMatch && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Wprowadzono: {userInvoiceData.kwota.toFixed(2)} PLN
                    </p>
                  )}
                </div>
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

