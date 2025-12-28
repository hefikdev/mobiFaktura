"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, DollarSign, User, Mail, Wallet, FileText, XCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";

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
    rejectionReason?: string | null;
    lastBudgetRequestStatus?: string | null;
    lastBudgetRequestAmount?: number | null;
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

  // Sync internal state with initialAction prop
  useEffect(() => {
    setReviewAction(initialAction);
  }, [initialAction]);

  const reviewMutation = trpc.budgetRequest.review.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      onOpenChange(false);
      setRejectionReason("");
      utils.budgetRequest.getAll.invalidate();
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
        <DialogContent className="sm:max-w-[600px]">
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

          <div className="space-y-4 py-4">
            {/* User Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="font-medium text-white">{request.userName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="font-medium text-white">{request.userEmail}</span>
                </div>
            </div>

            {/* Financial Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Stan salda przy złożeniu</span>
                </div>
                <p className={`text-lg font-bold ${request.currentBalanceAtRequest < 0 ? "text-red-600 dark:text-red-500" : "text-foreground"}`}>
                  {request.currentBalanceAtRequest.toFixed(2)} PLN
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">Prosi o</span>
                </div>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  +{request.requestedAmount.toFixed(2)} PLN
                </p>
              </div>
            </div>

            {/* Result calculation */}
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900 dark:text-green-100">
                  Saldo pracownika po zatwierdzeniu:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {(request.currentBalanceAtRequest + request.requestedAmount).toFixed(2)} PLN
                </span>
              </div>
            </div>

            {/* Last Budget Request Status */}
            {request.lastBudgetRequestStatus && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Status i wartość ostatniej zaliczki:
                  </span>
                  <div className="text-right">
                    <div className="mb-2">
                      <InvoiceStatusBadge 
                        status={request.lastBudgetRequestStatus === 'approved' ? 'accepted' : request.lastBudgetRequestStatus === 'rejected' ? 'rejected' : 'pending'} 
                        variant="compact" 
                      />
                    </div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {request.lastBudgetRequestAmount?.toFixed(2)} PLN
                    </div>
                  </div>
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

            {/* Rejection Reason (if rejected) */}
            {request.status === "rejected" && request.rejectionReason && (
              <div className="space-y-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-red-900 dark:text-red-100">
                  <XCircle className="h-4 w-4" />
                  Powód odrzucenia
                </div>
                <p className="text-sm text-red-800 dark:text-red-200">{request.rejectionReason}</p>
              </div>
            )}

            {/* Request Date */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Złożono: {format(new Date(request.createdAt), "dd MMM yyyy, HH:mm", { locale: pl })}</div>
              {request.reviewedAt && (
                <div>
                  {request.status === "approved" ? "Przyznano" : "Odrzucono"}: {format(new Date(request.reviewedAt), "dd MMM yyyy, HH:mm", { locale: pl })}
                </div>
              )}
            </div>
          </div>

          {mode === "review" && request.status === "pending" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={reviewMutation.isPending}
              >
                Anuluj
              </Button>
              {reviewAction === "approve" ? (
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
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={reviewMutation.isPending || rejectionReason.length < 10}
                >
                  {reviewMutation.isPending && reviewMutation.variables?.action === "reject" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Odrzuć
                </Button>
              )}
            </DialogFooter>
          )}

          {mode === "details" && (
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>
                Zamknij
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
