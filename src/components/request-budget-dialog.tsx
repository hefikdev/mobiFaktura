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
import { Loader2, Plus, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RequestBudgetDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const controlledOpen = open !== undefined ? open : isOpen;
  const setControlledOpen = onOpenChange || setIsOpen;

  const utils = trpc.useUtils();

  // Fetch user info to determine role
  const { data: currentUser } = trpc.auth.me.useQuery();

  // Fetch companies - all companies for admins/accountants, user's accessible companies for regular users
  const companiesQuery = trpc.company[currentUser?.role === "admin" || currentUser?.role === "accountant" ? "listAll" : "list"].useQuery(
    undefined,
    { enabled: !!currentUser }
  );

  const createRequestMutation = trpc.budgetRequest.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsOpen(false);
      setAmount("");
      setJustification("");
      setSelectedCompanyId("");
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

    if (!selectedCompanyId) {
      toast({
        title: "Błąd",
        description: "Wybierz firmę, dla której prosisz o zasilenie",
        variant: "destructive",
      });
      return;
    }

    createRequestMutation.mutate({
      requestedAmount: numAmount,
      justification: justification.trim(),
      companyId: selectedCompanyId,
    });
  };

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Poproś o zasilenie salda</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="company">Firma</Label>
            <Select
              value={selectedCompanyId}
              onValueChange={setSelectedCompanyId}
              disabled={createRequestMutation.isPending || companiesQuery.isLoading}
            >
              <SelectTrigger id="company">
                <SelectValue placeholder="Wybierz firmę..." />
              </SelectTrigger>
              <SelectContent>
                {companiesQuery.data && companiesQuery.data.length > 0 ? (
                  companiesQuery.data.map((company: { id: string; name: string }) => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{company.name}</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-companies" disabled>
                    Brak dostępnych firm
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {companiesQuery.data && companiesQuery.data.length === 0 && (
              <p className="text-sm text-red-500">
                Nie masz dostępu do żadnej firmy. Skontaktuj się z administratorem.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Kwota (PLN)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder=""
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={createRequestMutation.isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="justification">Uzasadnienie</Label>
            <Textarea
              id="justification"
              placeholder=""
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={6}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              {justification.length}/5 znaków minimum
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
            disabled={createRequestMutation.isPending || companiesQuery.data?.length === 0}
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
