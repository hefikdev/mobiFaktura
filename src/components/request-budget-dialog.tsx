"use client";

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { shouldRetryMutation, getRetryDelay } from "@/lib/trpc/mutation-config";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";

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

  // Memoize query type to prevent recalculation on every render
  const queryType = useMemo(() => 
    currentUser?.role === "admin" || currentUser?.role === "accountant" ? "listAll" : "list",
    [currentUser?.role]
  );

  // Fetch companies - all companies for admins/accountants, user's accessible companies for regular users
  const companiesQuery = trpc.company[queryType].useQuery(
    undefined,
    { enabled: !!currentUser }
  );

  // Prepare company options for SearchableSelect
  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return (companiesQuery.data || []).map((company: { id: string; name: string; nip?: string | null }) => ({
      value: company.id,
      label: company.name,
      searchableText: `${company.name} ${company.nip || ""} ${company.id}`,
    }));
  }, [companiesQuery.data]);

  const createRequestMutation = trpc.budgetRequest.create.useMutation({
    retry: shouldRetryMutation,
    retryDelay: getRetryDelay,
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsOpen(false);
      setAmount("");
      setJustification("");
      setSelectedCompanyId("");
      // Invalidate all related queries
      utils.budgetRequest.myRequests.invalidate();
      utils.budgetRequest.getAll.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = useCallback(() => {
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
  }, [amount, justification, selectedCompanyId, toast, createRequestMutation]);
  
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);
  
  const handleJustificationChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJustification(e.target.value);
  }, []);
  
  const handleDialogClose = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const charCountText = useMemo(() => 
    `${justification.length}/5 znaków minimum`,
    [justification.length]
  );

  return (
    <Dialog open={controlledOpen} onOpenChange={setControlledOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Poproś o zasilenie salda</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid gap-2">
            <Label htmlFor="company">Firma</Label>
            <SearchableSelect
              options={companyOptions}
              value={selectedCompanyId}
              onValueChange={setSelectedCompanyId}
              placeholder="Wybierz firmę..."
              searchPlaceholder="Szukaj"
              emptyText="Brak dostępnych firm"
              disabled={createRequestMutation.isPending || companiesQuery.isLoading}
            />
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
              onChange={handleAmountChange}
              disabled={createRequestMutation.isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="justification">Uzasadnienie</Label>
            <Textarea
              id="justification"
              placeholder=""
              value={justification}
              onChange={handleJustificationChange}
              rows={6}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              {charCountText}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleDialogClose}
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
