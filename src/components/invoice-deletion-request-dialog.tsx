"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2 } from "lucide-react";

interface InvoiceDeletionRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  onSuccess?: () => void;
}

export function InvoiceDeletionRequestDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  onSuccess,
}: InvoiceDeletionRequestDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const createRequestMutation = trpc.invoiceDeletionRequest.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Prośba o usunięcie faktury została wysłana do administratora",
      });
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      toast({
        title: "Błąd",
        description: "Powód musi zawierać minimum 10 znaków",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate({
      invoiceId,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-destructive">Prośba o usunięcie faktury</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Faktura</Label>
            <div className="text-sm text-muted-foreground">{invoiceNumber}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Powód usunięcia <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Wyjaśnij dlaczego faktura powinna zostać usunięta (np. błędnie wysłana, duplikat, itp.)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/10 znaków (minimum)
            </p>
          </div>

          <div className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md border border-amber-200 dark:border-amber-900/30">
            ⚠️ Prośba zostanie wysłana do administratora. Po zatwierdzeniu, faktura zostanie trwale usunięta z systemu.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createRequestMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={createRequestMutation.isPending || reason.trim().length < 10}
          >
            {createRequestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wysyłanie...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Wyślij prośbę
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
