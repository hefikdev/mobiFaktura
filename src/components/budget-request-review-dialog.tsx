"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Wallet, XCircle, CheckCircle, Clock, Building2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { generateSingleBudgetRequestExcel } from "@/lib/excel-utils";

interface BudgetRequestReviewDialogProps {
  request: {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    currentBalanceAtRequest: number;
    requestedAmount: number;
    justification: string;
    status: string;
    createdAt: Date;
    reviewedAt?: Date | null;
    reviewerName?: string | null;
    settledAt?: Date | null;
    settledBy?: string | null;
    settledByName?: string | null;
    transferNumber?: string | null;
    transferDate?: Date | null;
    transferConfirmedBy?: string | null;
    transferConfirmedAt?: Date | null;
    transferConfirmedByName?: string | null;
    rejectionReason?: string | null;
    lastBudgetRequestStatus?: string | null;
    lastBudgetRequestAmount?: number | null;
    companyId?: string | null;
    companyName?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode?: "review" | "details";
  initialAction?: "approve" | "reject";
}

export function BudgetRequestReviewDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
  mode = "review",
  initialAction = "approve",
}: BudgetRequestReviewDialogProps) {
  const { toast } = useToast();
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">(initialAction);
  const [rejectionReason, setRejectionReason] = useState("");
  const utils = trpc.useUtils();

  // Export states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExportBudgetRequest = async () => {
    if (!request) return;

    try {
      setIsExporting(true);
      setExportProgress(10);
      
      setExportProgress(30);
      await generateSingleBudgetRequestExcel(request, {
        dateFormat: "dd/MM/yyyy",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
      });

      setExportProgress(100);
      toast({
        title: "Sukces",
        description: "Eksport wniosku budżetowego zakończony pomyślnie",
      });
      setExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się wyeksportować wniosku budżetowego",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 500);
    }
  };

  // Sync internal state with initialAction prop
  useEffect(() => {
    setReviewAction(initialAction);
  }, [initialAction]);

  const reviewMutation = trpc.budgetRequest.review.useMutation({
    retry: shouldRetryMutation,
    retryDelay: getRetryDelay,
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      onOpenChange(false);
      setRejectionReason("");
      // Invalidate all related queries
      utils.budgetRequest.getAll.invalidate();
      utils.budgetRequest.myRequests.invalidate();
      utils.advances.getAll.invalidate();
      utils.saldo.getMySaldo.invalidate();
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

  const handleApprove = () => {
    if (!request) return;
    
    reviewMutation.mutate({
      requestId: request.id,
      action: "approve",
    });
  };

  const handleReject = () => {
    if (!request) return;
    
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      toast({
        title: "Błąd",
        description: "Powód odrzucenia musi zawierać minimum 10 znaków",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      requestId: request.id,
      action: "reject",
      rejectionReason: rejectionReason.trim(),
    });
  };

  if (!request) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-orange-600" />
              {mode === "details" ? "Szczegóły prośby o budżet" : "Prośba o zwiększenie budżetu"}
              {request.status === "approved" && (
                <span className="text-sm font-normal text-green-600 dark:text-green-500">
                  (Przyznano)
                </span>
              )}
              {request.status === "rejected" && (
                <span className="text-sm font-normal text-red-600 dark:text-red-500">
                  (Odrzucono)
                </span>
              )}
            </DialogTitle>
            {mode === "review" && (
              <DialogDescription>
                {reviewAction === "approve" 
                  ? "Po zatwierdzeniu saldo użytkownika zostanie automatycznie zwiększone" 
                  : "Podaj powód odrzucenia prośby"}
              </DialogDescription>
            )}

          </DialogHeader>

          <div className="space-y-3 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
            {/* UUID Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identyfikator</h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">UUID</p>
                <p className="text-sm font-mono text-foreground break-all">{request.id}</p>
              </div>
            </div>

            {/* Basic Info Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informacje podstawowe</h3>
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md">
                <div>
                  <p className="font-medium">{request.userName}</p>
                </div>
                {request.companyName && (
                  <div>
                    <p className="text-xs text-muted-foreground"></p>
                    <p className="font-medium">Dla: {request.companyName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kwoty</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Stan salda</p>
                  <p className={`text-lg font-bold ${request.currentBalanceAtRequest < 0 ? "text-red-600" : "text-foreground"}`}>
                    {request.currentBalanceAtRequest.toFixed(2)} PLN
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Wnioskowana kwota</p>
                  <p className="text-lg font-bold text-orange-600">
                    +{request.requestedAmount.toFixed(2)} PLN
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">Po zatwierdzeniu</p>
                  <p className="text-lg font-bold text-green-600">
                    {(request.currentBalanceAtRequest + request.requestedAmount).toFixed(2)} PLN
                  </p>
                </div>
              </div>
            </div>

            {/* Previous Budget Request Info */}
            {request.lastBudgetRequestAmount !== null && request.lastBudgetRequestStatus && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Poprzednia zaliczka</h3>
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-md">
                  <div>
                    <p className="font-medium text-sm">{request.lastBudgetRequestAmount?.toFixed(2) ?? "0.00"} PLN</p>
                  </div>
                  <div>
                    <InvoiceStatusBadge status={request.lastBudgetRequestStatus === "approved" ? "accepted" : request.lastBudgetRequestStatus === "settled" ? "settled" : request.lastBudgetRequestStatus === "rejected" ? "rejected" : request.lastBudgetRequestStatus === "money_transferred" ? "transferred" : "pending"} variant="compact" />
                  </div>
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Uzasadnienie</h3>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{request.justification}</p>
              </div>
            </div>

            {/* Timeline Section */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historia</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Złożono</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(request.createdAt), "dd MMMM yyyy, HH:mm", { locale: pl })}
                    </p>
                  </div>
                </div>

                {request.reviewedAt && (
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                    {request.status === "rejected" ? (
                      <XCircle className="h-4 w-4 mt-0.5 text-red-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {request.status === "rejected" ? "Odrzucono" : "Przyznano"}
                        {request.reviewerName && <span className="text-muted-foreground"> przez {request.reviewerName}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(request.reviewedAt), "dd MMMM yyyy, HH:mm", { locale: pl })}
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Rejection Reason */}
            {request.status === "rejected" && request.rejectionReason && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Powód odrzucenia</h3>
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-md">
                  <p className="text-sm text-red-900 dark:text-red-100">{request.rejectionReason}</p>
                </div>
              </div>
            )}

            {/* Rejection Reason Input (for review mode when rejecting) */}
            {mode === "review" && reviewAction === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">
                  Powód odrzucenia <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="Wyjaśnij użytkownikowi dlaczego prośba została odrzucona..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {rejectionReason.length}/10 znaków (minimum)
                </p>
              </div>
            )}
          </div>

          {mode === "review" && request.status === "pending" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setExportDialogOpen(true)}
                  size="sm"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Eksportuj
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewAction(initialAction);
                    onOpenChange(false);
                  }}
                  disabled={reviewMutation.isPending}
                >
                  Anuluj
                </Button>

              {/* Approve button (always visible) */}
              <Button
                onClick={handleApprove}
                disabled={reviewMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white dark:text-white"
              >
                {reviewMutation.isPending && reviewMutation.variables?.action === "approve" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Przyznaj
              </Button>

              {/* Reject button: first click toggles reject mode (shows textarea), second click submits */}
              <Button
                variant={reviewAction === "reject" ? "destructive" : "outline"}
                onClick={() => {
                  if (reviewAction === "reject") {
                    handleReject();
                  } else {
                    setReviewAction("reject");
                  }
                }}
                disabled={reviewMutation.isPending || (reviewAction === "reject" && rejectionReason.length < 10)}
              >
                {reviewMutation.isPending && reviewMutation.variables?.action === "reject" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Odrzuć
              </Button>
              </div>
            </DialogFooter>
          )}

          {mode === "details" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Eksportuj
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Zamknij
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eksportuj wniosek budżetowy do Excel</DialogTitle>
            <DialogDescription>
              Wybierz format daty dla eksportu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isExporting && (
              <div className="space-y-2">
                <Label>Generowanie Excel...</Label>
                <Progress value={exportProgress} className="w-full" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleExportBudgetRequest} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eksportowanie...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Eksportuj
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
