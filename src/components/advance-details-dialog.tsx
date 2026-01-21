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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, DollarSign, User, CheckCircle, Building2, Wallet, ArrowRightLeft, Trash2, AlertTriangle } from "lucide-react";
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
  
  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteStrategy, setShowDeleteStrategy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState<"delete_with_invoices" | "reassign_invoices">("delete_with_invoices");
  const [targetAdvanceId, setTargetAdvanceId] = useState<string>("");

  // Get current user to check role
  const { data: currentUser } = trpc.auth.me.useQuery();
  
  // Get all advances for reassignment dropdown
  const { data: allAdvancesData } = trpc.advances.getAll.useQuery(
    { status: "all", limit: 100 },
    { enabled: showDeleteStrategy && deleteStrategy === "reassign_invoices" }
  );
  
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

  const deleteMutation = trpc.advances.delete.useMutation({
    retry: shouldRetryMutation,
    retryDelay: getRetryDelay,
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setShowDeleteConfirm(false);
      setShowDeleteStrategy(false);
      setDeletePassword("");
      setDeleteStrategy("delete_with_invoices");
      setTargetAdvanceId("");
      onOpenChange(false);
      // Invalidate all related queries
      utils.advances.getAll.invalidate();
      utils.advances.getById.invalidate();
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.myInvoices.invalidate();
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

  const handleInitiateDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmFirstStep = () => {
    if (!deletePassword.trim()) {
      toast({
        title: "Błąd",
        description: "Hasło jest wymagane",
        variant: "destructive",
      });
      return;
    }
    setShowDeleteConfirm(false);
    setShowDeleteStrategy(true);
  };

  const handleFinalDelete = () => {
    if (!advance) return;
    
    if (deleteStrategy === "reassign_invoices" && advance.relatedInvoices && advance.relatedInvoices.length > 0 && !targetAdvanceId) {
      toast({
        title: "Błąd",
        description: "Wybierz docelową zaliczkę",
        variant: "destructive",
      });
      return;
    }

    deleteMutation.mutate({
      id: advance.id,
      password: deletePassword,
      strategy: deleteStrategy,
      targetAdvanceId: targetAdvanceId || undefined,
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setShowDeleteStrategy(false);
    setDeletePassword("");
    setDeleteStrategy("delete_with_invoices");
    setTargetAdvanceId("");
  };

  const isAccountantOrAdmin = currentUser?.role === "accountant" || currentUser?.role === "admin";
  const availableAdvances = allAdvancesData?.items?.filter(adv => adv.id !== advanceId) || [];

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
               <div className="flex w-full justify-between items-center">
                 <div>
                   {isAccountantOrAdmin && (
                     <Button 
                       variant="destructive"
                       onClick={handleInitiateDelete}
                       disabled={deleteMutation.isPending}
                       size="sm"
                     >
                       <Trash2 className="mr-2 h-4 w-4" />
                       Usuń zaliczkę
                     </Button>
                   )}
                 </div>
                 <div className="flex gap-2">
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
                 </div>
               </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>

      {/* First Delete Confirmation Dialog - Password */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !open && handleCancelDelete()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Potwierdzenie usunięcia zaliczki
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Czy na pewno chcesz usunąć zaliczkę na kwotę <strong>{advance?.amount.toFixed(2)} PLN</strong> dla użytkownika <strong>{advance?.userName}</strong>?
            </p>
            <p className="text-sm font-semibold text-destructive">
              ⚠️ Ta operacja jest NIEODWRACALNA.
            </p>
            {advance?.relatedInvoices && advance.relatedInvoices.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                Ta zaliczka ma powiązane faktury ({advance.relatedInvoices.length}). W następnym kroku wybierzesz co z nimi zrobić.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Twoje hasło</Label>
              <Input
                id="deletePassword"
                type="password"
                placeholder="Wprowadź hasło aby potwierdzić"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deletePassword.trim()) {
                    handleConfirmFirstStep();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmFirstStep}
              disabled={!deletePassword.trim()}
            >
              Kontynuuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Second Delete Dialog - Strategy Selection */}
      <Dialog open={showDeleteStrategy} onOpenChange={(open) => !open && handleCancelDelete()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Wybierz strategię usuwania
            </DialogTitle>
            <DialogDescription>
              {advance?.relatedInvoices && advance.relatedInvoices.length > 0
                ? `Ta zaliczka ma ${advance.relatedInvoices.length} powiązanych faktur. Wybierz co zrobić z fakturami.`
                : "Ta zaliczka nie ma powiązanych faktur. Zostanie usunięta bezpośrednio."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {advance?.relatedInvoices && advance.relatedInvoices.length > 0 && (
              <>
                <div className="space-y-3">
                  <div 
                    className={`p-4 border-2 rounded-md cursor-pointer transition-colors ${
                      deleteStrategy === "delete_with_invoices" 
                        ? "border-red-500 bg-red-50 dark:bg-red-950/20" 
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setDeleteStrategy("delete_with_invoices")}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={deleteStrategy === "delete_with_invoices"}
                        onChange={() => setDeleteStrategy("delete_with_invoices")}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-sm">Usuń wraz z fakturami</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Wszystkie {advance.relatedInvoices.length} powiązane faktury zostaną trwale usunięte wraz z zaliczką.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`p-4 border-2 rounded-md cursor-pointer transition-colors ${
                      deleteStrategy === "reassign_invoices" 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setDeleteStrategy("reassign_invoices")}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={deleteStrategy === "reassign_invoices"}
                        onChange={() => setDeleteStrategy("reassign_invoices")}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Pozostaw faktury, przenieś do innej zaliczki</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Faktury zostaną przypisane do wybranej zaliczki. Wybierz docelową zaliczkę poniżej.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {deleteStrategy === "reassign_invoices" && (
                  <div className="space-y-2">
                    <Label htmlFor="targetAdvance">Docelowa zaliczka</Label>
                    <Select value={targetAdvanceId} onValueChange={setTargetAdvanceId}>
                      <SelectTrigger id="targetAdvance">
                        <SelectValue placeholder="Wybierz zaliczkę..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAdvances.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Brak dostępnych zaliczek
                          </SelectItem>
                        ) : (
                          availableAdvances.map((adv) => (
                            <SelectItem key={adv.id} value={adv.id}>
                              {adv.userName} - {adv.amount} PLN ({adv.status}) - {format(new Date(adv.createdAt), "dd.MM.yyyy", { locale: pl })}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {(!advance?.relatedInvoices || advance.relatedInvoices.length === 0) && (
              <p className="text-sm text-muted-foreground">
                Zaliczka zostanie usunięta natychmiast.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinalDelete}
              disabled={
                deleteMutation.isPending ||
                (deleteStrategy === "reassign_invoices" && 
                 advance?.relatedInvoices && 
                 advance.relatedInvoices.length > 0 && 
                 !targetAdvanceId)
              }
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Usuń definitywnie
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}