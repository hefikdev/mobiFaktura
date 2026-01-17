"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { shouldRetryMutation, getRetryDelay } from "@/lib/trpc/mutation-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, DollarSign, User, CheckCircle, Building2, Wallet, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { Badge } from "@/components/ui/badge";

interface AdvanceDetailsDialogProps {
  advanceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdvanceDetailsDialog({
  advanceId,
  open,
  onOpenChange,
  onSuccess,
}: AdvanceDetailsDialogProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [transferNumber, setTransferNumber] = useState("");
  
  const { data: advance, isLoading } = trpc.advances.getById.useQuery(
    { id: advanceId ?? "" },
    { enabled: !!advanceId }
  );

  const transferMutation = trpc.advances.transfer.useMutation({
    retry: shouldRetryMutation,
    retryDelay: getRetryDelay,
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      onOpenChange(false);
      setTransferNumber("");
      // Invalidate all related queries
      utils.advances.getAll.invalidate();
      utils.advances.getById.invalidate();
      utils.saldo.getMySaldo.invalidate();
      utils.saldo.getAllUsersSaldo.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const settleMutation = trpc.advances.settle.useMutation({
    retry: shouldRetryMutation,
    retryDelay: getRetryDelay,
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      onOpenChange(false);
      // Invalidate all related queries
      utils.advances.getAll.invalidate();
      utils.advances.getById.invalidate();
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.myInvoices.invalidate();
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTransfer = () => {
    if (!advance) return;
    transferMutation.mutate({
      id: advance.id,
      transferNumber: transferNumber || undefined,
    });
  };

  const handleSettle = () => {
    if (!advance) return;
    settleMutation.mutate({ id: advance.id });
  };

  if (!advanceId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : advance ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-orange-600" />
                Szczegóły zaliczki
                {advance.status === "pending" && <Badge variant="outline" className="border-orange-500 text-orange-500">Oczekująca</Badge>}
                {advance.status === "transferred" && <Badge variant="outline" className="border-blue-500 text-blue-500">Przelana</Badge>}
                {advance.status === "settled" && <Badge variant="outline" className="border-green-500 text-green-500">Rozliczona</Badge>}
              </DialogTitle>
              <DialogDescription>
                ID: {advance.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Basic Info */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informacje podstawowe</h3>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md">
                  <div>
                    <p className="text-xs text-muted-foreground">Użytkownik</p>
                    <p className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" /> {advance.userName}
                    </p>
                  </div>
                  {advance.companyName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Firma</p>
                      <p className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4" /> {advance.companyName}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Obecne saldo użytkownika</p>
                    <p className={`font-medium ${advance.userSaldo < 0 ? "text-red-600" : "text-foreground"}`}>
                      {advance.userSaldo.toFixed(2)} PLN
                    </p>
                  </div>
                  <div>
                     <p className="text-xs text-muted-foreground">Źródło</p>
                     <p className="font-medium">
                        {advance.sourceType === "budget_request" ? "Wniosek budżetowy" : "Przyznana przez księgowego"}
                     </p>
                  </div>
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kwoty</h3>
                {advance.status === "pending" ? (
                   <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Obecne saldo</p>
                      <p className={`text-lg font-bold ${advance.userSaldo < 0 ? "text-red-600" : "text-foreground"}`}>
                        {advance.userSaldo.toFixed(2)} PLN
                      </p>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Kwota zaliczki</p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-500">
                        +{advance.amount.toFixed(2)} PLN
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Po przelewie</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-500">
                        {(advance.userSaldo + advance.amount).toFixed(2)} PLN
                      </p>
                    </div>
                  </div>
                ) : (
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30 rounded-md text-center">
                       <p className="text-sm text-muted-foreground mb-1">Kwota zaliczki</p>
                       <p className="text-3xl font-bold text-orange-600 dark:text-orange-500">
                         {advance.amount.toFixed(2)} PLN
                       </p>
                    </div>
                )}
              </div>

              {/* Budget Request Snapshot */}
              {advance.sourceType === "budget_request" && advance.budgetRequest && (
                  <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground flex gap-4">
                      <span>Saldo w momencie wniosku: <strong>{advance.budgetRequest.currentBalanceAtRequest.toFixed(2)} PLN</strong></span>
                  </div>
              )}

              {/* Previous Advance */}
              {advance.previousAdvance && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Poprzednia zaliczka</h3>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md">
                      <div>
                        <p className="font-medium text-sm">{advance.previousAdvance.amount.toFixed(2)} PLN</p>
                      </div>
                      <div>
                         <Badge variant="outline">
                            {advance.previousAdvance.status === "pending" ? "Oczekująca" : 
                             advance.previousAdvance.status === "transferred" ? "Przelana" : 
                             advance.previousAdvance.status === "settled" ? "Rozliczona" : advance.previousAdvance.status}
                         </Badge>
                      </div>
                    </div>
                  </div>
              )}

              {/* Justification or Description */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {advance.sourceType === "budget_request" ? "Uzasadnienie wniosku" : "Opis"}
                </h3>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">
                    {advance.sourceType === "budget_request" && advance.budgetRequest 
                        ? advance.budgetRequest.justification 
                        : advance.description}
                  </p>
                </div>
              </div>

              {/* History */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historia</h3>
                <div className="space-y-2 border-l-2 border-muted pl-4 ml-2">
                  {/* Creation / Request */}
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-muted-foreground" />
                    <p className="text-sm font-medium">Utworzono / Złożono</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(advance.createdAt), "dd MMMM yyyy, HH:mm", { locale: pl })}
                      {advance.createdByName ? ` przez ${advance.createdByName}` : ""}
                    </p>
                  </div>

                  {/* Approval (if from budget request) */}
                  {advance.sourceType === "budget_request" && advance.budgetRequest?.reviewedAt && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-green-500" />
                        <p className="text-sm font-medium">Zaakceptowano wniosek</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(advance.budgetRequest.reviewedAt), "dd MMMM yyyy, HH:mm", { locale: pl })}
                          {advance.budgetRequest.reviewerName && ` przez ${advance.budgetRequest.reviewerName}`}
                        </p>
                      </div>
                  )}

                  {/* Transfer */}
                  {advance.status !== "pending" && advance.transferDate && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500" />
                        <p className="text-sm font-medium">Wykonano przelew (Zaliczka aktywna)</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(advance.transferDate), "dd MMMM yyyy, HH:mm", { locale: pl })}
                          {advance.transferConfirmedByName ? ` przez ${advance.transferConfirmedByName}` : ""}
                        </p>
                      </div>
                  )}

                  {/* Settle */}
                  {advance.status === "settled" && advance.settledAt && (
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-purple-500" />
                        <p className="text-sm font-medium">Rozliczono</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(advance.settledAt), "dd MMMM yyyy, HH:mm", { locale: pl })}
                          {advance.settledByName ? ` przez ${advance.settledByName}` : ""}
                        </p>
                      </div>
                  )}
                </div>
              </div>

              {/* Related Invoices */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Powiązane faktury ({advance.relatedInvoices.length})
                </h3>
                {advance.relatedInvoices.length > 0 ? (
                    <div className="border rounded-md bg-muted/30 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left p-2 font-medium">Numer faktury</th>
                            <th className="text-left p-2 font-medium">Kwota</th>
                            <th className="text-left p-2 font-medium">Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {advance.relatedInvoices.map((inv) => (
                            <tr key={inv.id} className="border-t hover:bg-muted/30">
                            <td className="p-2">
                                <Link 
                                href={`/a/invoice/${inv.id}`}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                target="_blank"
                                >
                                {inv.invoiceNumber}
                                </Link>
                            </td>
                            <td className="p-2">
                                {inv.kwota ? `${inv.kwota.toFixed(2)} PLN` : "-"}
                            </td>
                            <td className="p-2">
                                <InvoiceStatusBadge status={inv.status as any} variant="compact" />
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground italic">Brak powiązanych faktur.</p>
                )}
              </div>

              {/* Action Area */}
              {advance.status === "pending" && (
                  <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Wykonaj przelew
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                          Zleć przelew środków na konto użytkownika. Po potwierdzeniu saldo użytkownika zostanie zasilone kwotą <strong>{advance.amount.toFixed(2)} PLN</strong>.
                      </p>
                      <div className="flex gap-2">
                          <Input 
                              placeholder="Nr przelewu (opcjonalnie)" 
                              value={transferNumber}
                              onChange={(e) => setTransferNumber(e.target.value)}
                              className="bg-background"
                          />
                      </div>
                  </div>
              )}

              {advance.status === "transferred" && (
                  <div className="p-4 border rounded-md bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/30">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" /> Rozlicz zaliczkę
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Zakończ cykl życia zaliczki. Wszystkie zaakceptowane faktury podpięte pod tę zaliczkę otrzymają status <strong>Rozliczona</strong>.
                      </p>
                  </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Zamknij
               </Button>
               
               {advance.status === "pending" && (
                   <Button 
                     onClick={handleTransfer}
                     disabled={transferMutation.isPending}
                     className="bg-blue-600 hover:bg-blue-700 text-white"
                   >
                       {transferMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                       Zatwierdź przelew
                   </Button>
               )}

               {advance.status === "transferred" && (
                   <Button 
                     onClick={handleSettle}
                     disabled={settleMutation.isPending}
                     className="bg-purple-600 hover:bg-purple-700 text-white"
                   >
                       {settleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                       Rozlicz zaliczkę
                   </Button>
               )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}