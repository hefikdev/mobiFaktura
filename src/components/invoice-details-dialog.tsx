"use client";

import React, { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface InvoiceEditHistory {
  editedAt: Date | string;
  editor?: {
    name: string | null;
  };
}

interface InvoiceData {
  id: string;
  userId: string;
  companyId: string;
  invoiceType: string;
  imageKey: string;
  invoiceNumber: string | null;
  ksefNumber: string | null;
  kwota: string | null;
  description: string | null;
  justification: string | null;
  originalInvoiceId: string | null;
  correctionAmount: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  rejectionReason: string | null;
  reviewStartedAt: Date | string | null;
  lastReviewPing: Date | string | null;
  transferredBy: string | null;
  transferredAt: Date | string | null;
  settledBy: string | null;
  settledAt: Date | string | null;
  budgetRequestId: string | null;
  advanceId: string | null;
  lastEditedBy: string | null;
  lastEditedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  imageUrl: string | null;
  submitter?: {
    name: string;
    email: string;
  } | undefined;
  company?: {
    name: string;
    nip: string | null;
    address: string | null;
  } | undefined;
  currentReviewer?: {
    name: string;
  } | null;
  reviewer?: {
    name: string;
  } | null;
  lastEditor?: {
    name: string;
  } | null;
  settledByUser?: {
    name: string;
  } | null;
  editHistory?: InvoiceEditHistory[];
  budgetRequest?: {
    id: string;
    requestedAmount: number;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    userName: string | null;
    companyId: string;
    companyName: string | null;
    relatedInvoices?: Array<{
      id: string;
      invoiceNumber: string | null;
      kwota: number | null;
      status: string;
      createdAt: Date;
    }>;
  } | null;
  advance?: {
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
    transferDate: Date | null;
  } | null;
  isCurrentUserReviewing: boolean;
}

interface CorrectionInvoice {
  id: string;
  invoiceNumber: string | null;
  correctionAmount: number;
  justification: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
}

type Props = {
  invoice: InvoiceData;
  corrections?: CorrectionInvoice[] | null;
  invoiceId: string;
};

const InvoiceDetailsDialog = memo(function InvoiceDetailsDialog({
  invoice,
  corrections,
  invoiceId,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Pokaż wszystkie informacje o fakturze"
        className="h-8 w-8"
      >
        <Info className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Szczegóły faktury</DialogTitle>
            <DialogDescription>
              Pełne informacje i historia zdarzeń powiązanych z tą fakturą.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 max-h-[calc(90vh-200px)] overflow-y-auto pr-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                <p className="text-xs text-muted-foreground">UUID</p>
                <p className="font-mono break-words">{invoice?.id || invoiceId}</p>

                <p className="text-xs text-muted-foreground mt-3">Numer faktury</p>
                <p className="font-medium">{invoice?.invoiceNumber || "Brak numeru"}</p>

                <p className="text-xs text-muted-foreground mt-3">Typ</p>
                <p className="font-medium">{invoice?.invoiceType === "receipt" ? "Paragon" : invoice?.invoiceType === "correction" ? "Korekta" : "Faktura"}</p>

                <p className="text-xs text-muted-foreground mt-3">Status</p>
                <p className="font-medium">{invoice?.status}</p>

                {invoice?.ksefNumber && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Numer KSeF</p>
                    <p className="font-medium">{invoice.ksefNumber}</p>
                  </>
                )}

                {invoice?.kwota && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Kwota</p>
                    <p className="font-medium">{invoice.kwota} PLN</p>
                  </>
                )}

                {invoice?.company && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Firma</p>
                    <p className="font-medium">{invoice.company.name} {invoice.company.nip ? `• NIP: ${invoice.company.nip}` : ''}</p>
                  </>
                )}

                {invoice?.submitter && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Wystawił / zgłosił</p>
                    <p className="font-medium">{invoice.submitter.name} {invoice.submitter.email ? `• ${invoice.submitter.email}` : ''}</p>
                  </>
                )}

                <p className="text-xs text-muted-foreground mt-3">Faktura wystawiona</p>
                <p className="font-medium">{invoice?.createdAt ? format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: pl }) : '—'}</p>

                {invoice?.reviewedAt && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Przegląd / decyzja</p>
                    <p className="font-medium">{invoice.reviewer?.name || 'Nieznany'} • {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</p>
                    {invoice.status === 'rejected' && invoice.rejectionReason && (
                      <p className="text-sm text-destructive mt-1">Powód odrzucenia: {invoice.rejectionReason}</p>
                    )}
                  </>
                )}

                {invoice?.settledAt && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3">Rozliczona / przelana</p>
                    <p className="font-medium">{invoice.settledByUser?.name || 'Nieznany'} • {format(new Date(invoice.settledAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</p>
                  </>
                )}

              </div>

              <div className="space-y-2">
                <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Dekretacja</p>
                  <p className="font-medium">{invoice?.description || 'Brak'}</p>

                  <p className="text-xs text-muted-foreground mt-3">Dodatkowe informacje</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Ostatni edytor: {invoice?.lastEditor?.name || '—'}</div>
                    <div>Ostatnia edycja: {invoice?.lastEditedAt ? format(new Date(invoice.lastEditedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl }) : '—'}</div>
                    {invoice?.advance && <div>Zaliczka powiązana: {invoice.advance.amount.toFixed(2)} PLN • status: {invoice.advance.status}</div>}
                    {invoice?.budgetRequest && <div>Zaliczka (request): {invoice.budgetRequest.requestedAmount.toFixed(2)} PLN • status: {invoice.budgetRequest.status}</div>}
                  </div>
                </div>

                <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                  <p className="text-sm font-medium">Historia zdarzeń</p>
                  <div className="mt-2 space-y-2 text-sm max-h-[240px] overflow-y-auto">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Utworzono</span>
                      <span>{invoice?.createdAt ? format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: pl }) : '—'} • {invoice?.submitter?.name || '—'}</span>
                    </div>

                    {invoice?.editHistory && invoice.editHistory.length > 0 && invoice.editHistory.map((e, idx) => (
                      <div key={idx} className="flex justify-between text-muted-foreground">
                        <span>Edycja</span>
                        <span>{format(new Date(e.editedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })} • {e.editor?.name || '—'}</span>
                      </div>
                    ))}

                    {invoice?.reviewedAt && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Decyzja</span>
                        <span>{format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })} • {invoice.reviewer?.name || '—'}</span>
                      </div>
                    )}

                    {invoice?.settledAt && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Rozliczono / przelano</span>
                        <span>{format(new Date(invoice.settledAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })} • {invoice.settledByUser?.name || '—'}</span>
                      </div>
                    )}

                    {invoice?.rejectionReason && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Odrzucono</span>
                        <span>{invoice.reviewer?.name || '—'}{invoice.reviewedAt ? ` • ${format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}` : ''}</span>
                      </div>
                    )}

                    {corrections && corrections.length > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Korekty</span>
                        <span>{corrections.length} korekta(y)</span>
                      </div>
                    )}

                  </div>
                </div>

              </div>

            </div>

            <div className="pt-2 border-t flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Zamknij</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default InvoiceDetailsDialog;
