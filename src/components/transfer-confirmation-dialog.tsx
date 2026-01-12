"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, DollarSign } from "lucide-react";
import { BudgetRequest } from "@/types";

interface TransferConfirmationDialogProps {
  request: BudgetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransferConfirmationDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: TransferConfirmationDialogProps) {
  const { toast } = useToast();
  const [transferNumber, setTransferNumber] = useState("");

  const confirmTransferMutation = trpc.budgetRequest.confirmTransfer.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setTransferNumber("");
      onOpenChange(false);
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

  const handleConfirmTransfer = () => {
    if (!request) return;
    
    if (!transferNumber || transferNumber.trim().length < 3) {
      toast({
        title: "Błąd",
        description: "Numer transferu musi zawierać minimum 3 znaki",
        variant: "destructive",
      });
      return;
    }

    confirmTransferMutation.mutate({
      requestId: request.id,
      transferNumber: transferNumber.trim(),
    });
  };

  const handleClose = () => {
    setTransferNumber("");
    onOpenChange(false);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            Potwierdź wykonanie przelewu
          </DialogTitle>
          <DialogDescription>
            Wprowadź numer transferu bankowego dla prośby użytkownika {request.userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Użytkownik:</span>
              <span className="font-medium">{request.userName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{request.userEmail}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kwota:</span>
              <span className="font-bold text-blue-600">
                +{request.requestedAmount.toFixed(2)} PLN
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transferNumber">
              Numer transferu <span className="text-red-500">*</span>
            </Label>
            <Input
              id="transferNumber"
              placeholder="np. 2024/01/12345 lub REF123456"
              value={transferNumber}
              onChange={(e) => setTransferNumber(e.target.value)}
              disabled={confirmTransferMutation.isPending}
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">
              Wprowadź numer referencyjny przelewu bankowego
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={confirmTransferMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleConfirmTransfer}
            disabled={confirmTransferMutation.isPending || !transferNumber.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {confirmTransferMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Potwierdzam...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Potwierdź przelew
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
