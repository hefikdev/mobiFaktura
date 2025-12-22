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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus } from "lucide-react";

export function RequestBudgetDialog() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");

  const utils = trpc.useUtils();

  const createRequestMutation = trpc.budgetRequest.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsOpen(false);
      setAmount("");
      setJustification("");
      // Refresh requests list
      utils.budgetRequest.myRequests.invalidate();
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
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Błąd",
        description: "Wprowadź prawidłową kwotę większą od zera",
        variant: "destructive",
      });
      return;
    }

    if (!justification || justification.trim().length < 5) {
      toast({
        title: "Błąd",
        description: "Uzasadnienie musi zawierać minimum 5 znaków",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate({
      requestedAmount: numAmount,
      justification: justification.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Poproś o zwiększenie budżetu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Poproś o zwiększenie budżetu</DialogTitle>
          <DialogDescription>
            Wypełnij formularz aby poprosić księgowego o zwiększenie Twojego budżetu na faktury
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Kwota (PLN)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="np. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              Kwota o jaką chcesz zwiększyć swój budżet
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="justification">Uzasadnienie</Label>
            <Textarea
              id="justification"
              placeholder="Opisz dlaczego potrzebujesz zwiększenia budżetu..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={6}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              Minimum 5 znaków - opisz szczegółowo powód swojej prośby
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={createRequestMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createRequestMutation.isPending}
          >
            {createRequestMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Wyślij prośbę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
