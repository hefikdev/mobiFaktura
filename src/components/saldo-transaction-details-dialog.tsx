"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { RefreshCw, ArrowUp, ArrowDown } from "lucide-react";

interface SaldoTransactionDetailsDialogProps {
  transaction: {
    id: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    transactionType: string;
    notes: string | null;
    createdAt: Date;
    createdByName: string | null;
    createdByEmail?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaldoTransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: SaldoTransactionDetailsDialogProps) {
  if (!transaction) return null;

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "adjustment":
        return "Korekta salda";
      case "invoice_deduction":
        return "Odliczenie faktury";
      case "invoice_refund":
        return "Zwrot za fakturę";
      case "invoice_delete_refund":
        return "Zwrot z usuniętej faktury";
      case "advance_credit":
        return "Zaliczka";
      default:
        return type;
    }
  };

  const getTransactionIcon = () => {
    if (transaction.amount > 0) {
      return <ArrowUp className="h-5 w-5 text-green-600" />;
    } else if (transaction.amount < 0) {
      return <ArrowDown className="h-5 w-5 text-red-600" />;
    } else {
      return <RefreshCw className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTransactionIcon()}
            Szczegóły transakcji salda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
          {/* UUID Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Identyfikator
            </h3>
            <div className="p-3 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">UUID</p>
              <p className="text-sm font-mono text-foreground break-all">{transaction.id}</p>
            </div>
          </div>

          {/* Transaction Type */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Typ transakcji
            </h3>
            <div className="p-3 bg-muted/50 rounded-md">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                {getTransactionTypeLabel(transaction.transactionType)}
              </Badge>
            </div>
          </div>

          {/* Financial Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Kwoty
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Saldo przed</p>
                <p className="text-lg font-bold font-mono">
                  {transaction.balanceBefore.toFixed(2)} PLN
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Zmiana</p>
                <p className={`text-lg font-bold font-mono ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {transaction.amount > 0 ? "+" : ""}{transaction.amount.toFixed(2)} PLN
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Saldo po</p>
                <p className="text-lg font-bold font-mono">
                  {transaction.balanceAfter.toFixed(2)} PLN
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Notatka
              </h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{transaction.notes}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Informacje
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                <div className="flex-1">
                  <p className="text-sm font-medium">Wykonane przez</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.createdByName || "System"}
                    {transaction.createdByEmail && (
                      <span className="ml-1">({transaction.createdByEmail})</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                <div className="flex-1">
                  <p className="text-sm font-medium">Data</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(transaction.createdAt), "dd MMMM yyyy, HH:mm:ss", { locale: pl })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
