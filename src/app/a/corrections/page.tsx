"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AdvancedFilters, type FilterConfig, type FilterValue } from "@/components/advanced-filters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import {
  Loader2,
  FilePen,
  Plus,
  Building2,
  User,
  Calendar,
} from "lucide-react";
import { SectionLoader } from "@/components/section-loader";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useRouter } from "next/navigation";

// Type for correction invoice data
type CorrectionInvoice = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  companyId: string;
  companyName: string | null;
  invoiceNumber: string;
  imageKey: string;
  originalInvoiceId: string | null;
  originalInvoiceNumber: string | null;
  correctionAmount: string | null;
  justification: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Type for correctable invoice data
type CorrectableInvoice = {
  id: string;
  invoiceNumber: string;
  companyName: string;
  userName: string;
  kwota: string | null;
  createdAt: Date;
};

export default function CorrectionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("__all__");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, FilterValue>>({});

  // Correction form dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceSearchCompanyId, setInvoiceSearchCompanyId] = useState<string>("__all__");

  // Data fetching with infinite query
  const {
    data: correctionsData,
    isLoading: loadingCorrections,
    isFetchingNextPage,
    refetch: refetchCorrections,
  } = trpc.invoice.getCorrectionInvoices.useInfiniteQuery(
    {
      limit: 100,
      companyId: filterCompany !== "__all__" ? filterCompany : undefined,
      searchQuery,
    },
    {
      getNextPageParam: (lastPage: { nextCursor?: string }) => lastPage.nextCursor,
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
      refetchInterval: 10000, // Auto-refresh every 10 seconds
      refetchOnWindowFocus: true,
      staleTime: 2000,
    }
  );

  const allCorrections = (correctionsData?.pages.flatMap((page) => page.items) || []) as CorrectionInvoice[];

  const { data: companies } = trpc.company.list.useQuery();

  // Company options for SearchableSelect
  const companyOptions = useMemo(() => {
    if (!companies) return [{ value: "__all__", label: "Wszystkie firmy", searchableText: "wszystkie firmy" }];
    return [
      { value: "__all__", label: "Wszystkie firmy", searchableText: "wszystkie firmy" },
      ...companies.map(c => ({
        value: c.id,
        label: c.name,
        searchableText: `${c.name} ${c.nip || ""} ${c.id}`.toLowerCase()
      }))
    ];
  }, [companies]);

  // Advanced filter configuration
  const advancedFilterConfig: FilterConfig[] = [
    {
      field: "dateFrom",
      type: "date",
      label: "Data od",
      placeholder: "Wybierz datę początkową"
    },
    {
      field: "dateTo",
      type: "date",
      label: "Data do",
      placeholder: "Wybierz datę końcową"
    },
    {
      field: "amountMin",
      type: "number",
      label: "Kwota min",
      placeholder: "0.00"
    },
    {
      field: "amountMax",
      type: "number",
      label: "Kwota max",
      placeholder: "0.00"
    },
  ];

  // Fetch correctable invoices when searching
  const { data: correctableInvoicesData, isLoading: loadingCorrectableInvoices } =
    trpc.invoice.getCorrectableInvoices.useQuery(
      {
        searchQuery: invoiceSearchQuery,
        companyId: invoiceSearchCompanyId !== "__all__" ? invoiceSearchCompanyId : undefined,
      },
      {
        enabled: showAddDialog && !!user && (user.role === "accountant" || user.role === "admin"),
      }
    );

  const correctableInvoices = (correctableInvoicesData || []) as CorrectableInvoice[];
  const selectedCorrectableInvoice = useMemo(
    () => correctableInvoices.find((invoice) => invoice.id === selectedInvoiceId),
    [correctableInvoices, selectedInvoiceId]
  );

  const createCorrectionMutation = trpc.invoice.createCorrection.useMutation({
    onSuccess: () => {
      toast({
        title: "Correction created",
        description: "The correction invoice has been successfully created",
      });
      setShowAddDialog(false);
      resetForm();
      refetchCorrections();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refetch data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchCorrections();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    const handleFocus = () => {
      refetchCorrections();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchCorrections]);

  // Filter corrections
  const filteredCorrections = useMemo(() => {
    let filtered = [...allCorrections];

    // Search filter - enhanced to include UUIDs, amounts, dates
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (corr) =>
          // Basic fields
          corr.id.toLowerCase().includes(query) ||
          corr.invoiceNumber.toLowerCase().includes(query) ||
          corr.originalInvoiceNumber?.toLowerCase().includes(query) ||
          corr.companyName?.toLowerCase().includes(query) ||
          corr.userName?.toLowerCase().includes(query) ||
          corr.userEmail?.toLowerCase().includes(query) ||
          // UUIDs
          corr.userId?.toLowerCase().includes(query) ||
          corr.companyId?.toLowerCase().includes(query) ||
          corr.originalInvoiceId?.toLowerCase().includes(query) ||
          // Amount
          corr.correctionAmount?.toString().includes(query) ||
          // Justification
          corr.justification?.toLowerCase().includes(query) ||
          // Date
          (corr.createdAt && format(new Date(corr.createdAt), "dd/MM/yyyy", { locale: pl }).includes(query))
      );
    }

    // Company filter
    if (filterCompany !== "__all__") {
      filtered = filtered.filter((corr) => corr.companyId === filterCompany);
    }

    // Apply advanced filters
    if (advancedFilters.dateFrom) {
      const dateFrom = advancedFilters.dateFrom instanceof Date 
        ? advancedFilters.dateFrom 
        : new Date(String(advancedFilters.dateFrom));
      filtered = filtered.filter(corr => new Date(corr.createdAt) >= dateFrom);
    }
    if (advancedFilters.dateTo) {
      const dateTo = advancedFilters.dateTo instanceof Date 
        ? advancedFilters.dateTo 
        : new Date(String(advancedFilters.dateTo));
      dateTo.setHours(23, 59, 59, 999);
      filtered = filtered.filter(corr => new Date(corr.createdAt) <= dateTo);
    }
    if (advancedFilters.amountMin) {
      const amountMin = parseFloat(String(advancedFilters.amountMin));
      filtered = filtered.filter(corr => corr.correctionAmount && parseFloat(corr.correctionAmount) >= amountMin);
    }
    if (advancedFilters.amountMax) {
      const amountMax = parseFloat(String(advancedFilters.amountMax));
      filtered = filtered.filter(corr => corr.correctionAmount && parseFloat(corr.correctionAmount) <= amountMax);
    }

    return filtered;
  }, [allCorrections, searchQuery, filterCompany, advancedFilters]);

  const resetForm = () => {
    setSelectedInvoiceId("");
    setCorrectionAmount("");
    setJustification("");
    setInvoiceSearchQuery("");
    setInvoiceSearchCompanyId("__all__");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoiceId) {
      toast({
        title: "Error",
        description: "Please select the original invoice",
        variant: "destructive",
      });
      return;
    }

    const normalizedAmount = parseFloat(correctionAmount.replace(/,/g, ".").replace(/\s/g, ""));
    if (!normalizedAmount || normalizedAmount <= 0) {
      toast({
        title: "Error",
        description: "Correction amount must be greater than zero",
        variant: "destructive",
      });
      return;
    }

    if (justification.trim().length < 10) {
      toast({
        title: "Error",
        description: "Justification must contain at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    createCorrectionMutation.mutate({
      originalInvoiceId: selectedInvoiceId,
      correctionAmount: normalizedAmount,
      justification: justification.trim(),
    });
  };

  // Loading state
  if (loadingUser) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <SectionLoader />
        </div>
      </div>
    );
  }

  // Authorization check
  if (!user || (user.role !== "accountant" && user.role !== "admin")) {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <FilePen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Faktury korygujące</h1>
            </div>
          </div>

          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj korektę
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap">
              <div className="flex-1 flex gap-2 items-end min-w-0">
                <div className="self-center shrink-0">
                  <AdvancedFilters
                    filters={advancedFilterConfig}
                    values={advancedFilters}
                    onChange={setAdvancedFilters}
                    onReset={() => setAdvancedFilters({})}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    className="w-full"
                    showIcon
                  />
                </div>
              </div>
              <SearchableSelect
                value={filterCompany}
                onValueChange={setFilterCompany}
                options={companyOptions}
                placeholder="Wybierz firmę"
                className="w-full sm:w-[200px]"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Suspense fallback={<SectionLoader className="p-8" />}>
              {loadingCorrections ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCorrections.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <FilePen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Brak faktur korygujących do wyświetlenia</p>
                  {(searchQuery || filterCompany !== "__all__") && (
                    <p className="text-sm mt-2">Spróbuj zmienić filtry</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile View - Cards */}
                  <div className="md:hidden divide-y">
                    {filteredCorrections.map((correction) => (
                      <div
                        key={correction.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/a/invoice/${correction.id}`)}
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-semibold truncate">
                                {correction.invoiceNumber || "Brak numeru"}
                              </div>
                              <div className="font-medium text-green-600 text-sm">
                                +{parseFloat(correction.correctionAmount || "0").toFixed(2)} PLN
                              </div>
                            </div>
                            {correction.originalInvoiceNumber && (
                              <div className="text-xs text-muted-foreground mb-2">
                                Oryginał: {correction.originalInvoiceNumber}
                              </div>
                            )}
                            <div className="space-y-1 text-sm text-muted-foreground">
                              {correction.companyName && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3" />
                                  <span className="truncate">{correction.companyName}</span>
                                </div>
                              )}
                              {correction.userName && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{correction.userName}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span className="truncate">{format(new Date(correction.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</span>
                              </div>
                              {correction.reviewerName && (
                                <div className="text-xs">
                                  Utworzona przez: {correction.reviewerName}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}  
                  </div>

                  {/* Desktop View - Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Numer korekty</TableHead>
                          <TableHead>Faktura oryginalna</TableHead>
                          <TableHead>Firma</TableHead>
                          <TableHead>Użytkownik</TableHead>
                          <TableHead className="text-right">Kwota korekty</TableHead>
                          <TableHead>Utworzona</TableHead>
                          <TableHead>Utworzona przez</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCorrections.map((correction) => (
                          <TableRow
                            key={correction.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push(`/a/invoice/${correction.id}`)}
                          >
                            <TableCell className="font-medium">
                              {correction.invoiceNumber || "Brak numeru"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {correction.originalInvoiceNumber || "-"}
                            </TableCell>
                            <TableCell>{correction.companyName}</TableCell>
                            <TableCell>{correction.userName}</TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              +{parseFloat(correction.correctionAmount || "0").toFixed(2)} PLN
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(correction.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                            </TableCell>
                            <TableCell className="text-sm">
                              {correction.reviewerName || "-"}
                            </TableCell>
                          </TableRow>
                        ))}

                        {isFetchingNextPage && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Suspense>

            {isFetchingNextPage && (
              <div className="p-4 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
              </div>
            )}
          </CardContent>
        </Card>

        {filteredCorrections.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
            Wyświetlono {filteredCorrections.length} z {allCorrections?.length || 0} faktur korygujących
          </div>
        )}

        {/* Add Correction Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Utwórz fakturę korygującą</DialogTitle>
            </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invoice Search */}
            <div className="space-y-2">
              <div className="flex gap-2 items-end min-w-0">
                <div className="flex-1 min-w-0">
                  <SearchInput
                    placeholder="Podaj UUID"
                    value={invoiceSearchQuery}
                    onChange={setInvoiceSearchQuery}
                    className="w-full"
                  />
                </div>
                <div className="shrink-0">
                  <Select value={invoiceSearchCompanyId} onValueChange={setInvoiceSearchCompanyId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Firma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Wszystkie</SelectItem>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Invoice Selection */}
            <div className="space-y-2">
              <Label htmlFor="invoice">
                Faktura oryginalna <span className="text-red-500">*</span>
              </Label>
              {loadingCorrectableInvoices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ładowanie faktur...
                </div>
              ) : correctableInvoices && correctableInvoices.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Kliknij na fakturę z listy poniżej, aby ją wybrać.
                  </div>
                  <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                    {correctableInvoices.map((invoice) => {
                      const isSelected = selectedInvoiceId === invoice.id;
                      return (
                        <button
                          key={invoice.id}
                          type="button"
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                            isSelected ? "bg-muted" : ""
                          }`}
                        >
                          <div className="font-medium">
                            {invoice.invoiceNumber} • {invoice.companyName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.userName} • {format(new Date(invoice.createdAt), "dd.MM.yyyy", { locale: pl })} •{" "}
                            {invoice.kwota ? `${parseFloat(invoice.kwota).toFixed(2)} PLN` : "Brak kwoty"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedCorrectableInvoice && (
                    <div className="text-xs text-muted-foreground">
                      Wybrano: <span className="font-medium">{selectedCorrectableInvoice.invoiceNumber}</span> •{" "}
                      {selectedCorrectableInvoice.companyName}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {invoiceSearchQuery || invoiceSearchCompanyId !== "__all__"
                    ? "Nie znaleziono faktur spełniających kryteria"
                    : "Wprowadź numer faktury lub wybierz firmę, aby wyszukać faktury"}
                </p>
              )}
            </div>

            {/* Correction Amount */}
            <div className="space-y-2">
              <Label htmlFor="correctionAmount">
                Kwota korekty (dodatnia) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="correctionAmount"
                type="text"
                inputMode="decimal"
                value={correctionAmount}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.,\s]/g, "");
                  setCorrectionAmount(value);
                }}
                placeholder="np. 100.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Kwota, która zostanie dodana do salda użytkownika
              </p>
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <Label htmlFor="justification">
                Uzasadnienie <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setJustification(e.target.value)
                }
                placeholder="Powód utworzenia faktury korygującej..."
                className="min-h-[100px]"
                required
              />
              <p className="text-xs text-muted-foreground">
                {justification.length}/10 znaków minimum
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={
                  createCorrectionMutation.isPending ||
                  !selectedInvoiceId ||
                  !correctionAmount ||
                  justification.trim().length < 10
                }
              >
                {createCorrectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Tworzenie...
                  </>
                ) : (
                  "Utwórz fakturę korygującą"
                )}
              </Button>
            </div>
          </form>
          </DialogContent>
        </Dialog>
        <div className="hidden md:block">
          <Footer />
        </div>
      </main>
      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
}
