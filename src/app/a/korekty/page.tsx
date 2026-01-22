"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SearchInput } from "@/components/search-input";
import { AdvancedFilters, type FilterConfig } from "@/components/advanced-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
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
import { Camera, Loader2, X, Plus, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";

// Type for correction invoice data
type CorrectionInvoice = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  companyName: string;
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
};

export default function KorektyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("__all__");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({});

  // Correction form dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceSearchCompanyId, setInvoiceSearchCompanyId] = useState<string>("__all__");

  // Data fetching
  const {
    data: correctionsData,
    isLoading: loadingCorrections,
    refetch: refetchCorrections,
  } = trpc.invoice.getCorrectionInvoices.useInfiniteQuery(
    { limit: 50, companyId: filterCompany !== "__all__" ? filterCompany : undefined, searchQuery },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    }
  );

  const { data: companies, isLoading: loadingCompanies } = trpc.company.list.useQuery(undefined, {
    enabled: !!user && (user.role === "accountant" || user.role === "admin"),
  });

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

  const createCorrectionMutation = trpc.invoice.createCorrection.useMutation({
    onSuccess: () => {
      toast({
        title: "Faktura korygująca utworzona",
        description: "Faktura korygująca została pomyślnie utworzona",
      });
      setShowAddDialog(false);
      resetForm();
      refetchCorrections();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const allCorrections = (correctionsData?.pages.flatMap((page) => page.items) || []) as CorrectionInvoice[];

  // Filter corrections with enhanced search
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
      const dateFrom = new Date(advancedFilters.dateFrom);
      filtered = filtered.filter(corr => new Date(corr.createdAt) >= dateFrom);
    }
    if (advancedFilters.dateTo) {
      const dateTo = new Date(advancedFilters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      filtered = filtered.filter(corr => new Date(corr.createdAt) <= dateTo);
    }
    if (advancedFilters.amountMin) {
      const amountMin = parseFloat(advancedFilters.amountMin);
      filtered = filtered.filter(corr => corr.correctionAmount && parseFloat(corr.correctionAmount) >= amountMin);
    }
    if (advancedFilters.amountMax) {
      const amountMax = parseFloat(advancedFilters.amountMax);
      filtered = filtered.filter(corr => corr.correctionAmount && parseFloat(corr.correctionAmount) <= amountMax);
    }

    return filtered;
  }, [allCorrections, searchQuery, filterCompany, advancedFilters]);

  // Authorization check
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "accountant" && user.role !== "admin")) {
    return <Unauthorized />;
  }

  const handleImageCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Błąd",
        description: "Proszę wybrać plik graficzny",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({
        title: "Błąd",
        description: "Plik jest za duży. Maksymalny rozmiar to 10MB",
        variant: "destructive",
      });
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setImageDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setImageDataUrl(null);
    setSelectedInvoiceId("");
    setCorrectionAmount("");
    setJustification("");
    setInvoiceSearchQuery("");
    setInvoiceSearchCompanyId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoiceId) {
      toast({
        title: "Błąd",
        description: "Proszę wybrać oryginalną fakturę",
        variant: "destructive",
      });
      return;
    }

    const normalizedAmount = parseFloat(correctionAmount.replace(/,/g, ".").replace(/\s/g, ""));
    if (!normalizedAmount || normalizedAmount <= 0) {
      toast({
        title: "Błąd",
        description: "Kwota korekty musi być większa od zera",
        variant: "destructive",
      });
      return;
    }

    if (justification.trim().length < 10) {
      toast({
        title: "Błąd",
        description: "Uzasadnienie musi zawierać minimum 10 znaków",
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl md:text-2xl font-semibold">Faktury korygujące</h2>
          <Button onClick={() => setShowAddDialog(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Dodaj fakturę korygującą
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search with Advanced Filters (filter button moved to the left) */}
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
                  <Label htmlFor="search">Szukaj po numerze faktury</Label>
                  <div className="relative mt-2">
                    <SearchInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Szukaj"
                      className="w-full"
                      showIcon
                    />
                  </div>
                </div>
              </div>

              {/* Company Filter */}
              <div className="w-full md:w-64">
                <Label htmlFor="company-filter">Firma</Label>
                <SearchableSelect
                  value={filterCompany}
                  onValueChange={setFilterCompany}
                  options={companyOptions}
                  placeholder="Wybierz firmę"
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Corrections Table */}
        {loadingCorrections ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredCorrections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-center">Brak faktur korygujących</p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                {searchQuery || filterCompany !== "__all__"
                  ? "Nie znaleziono faktur korygujących dla podanych kryteriów"
                  : "Kliknij przycisk powyżej, aby dodać fakturę korygującą"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numer korekty</TableHead>
                      <TableHead>Oryginalna faktura</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Użytkownik</TableHead>
                      <TableHead className="text-right">Kwota korekty</TableHead>
                      <TableHead>Data utworzenia</TableHead>
                      <TableHead>Utworzył</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCorrections.map((correction) => (
                      <TableRow
                        key={correction.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/a/invoice/${correction.id}`)}
                      >
                        <TableCell className="font-medium">{correction.invoiceNumber}</TableCell>
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
                        <TableCell className="text-sm">{correction.reviewerName || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/a/invoice/${correction.id}`);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Zobacz
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Footer />
      </main>

      {/* Add Correction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj fakturę korygującą</DialogTitle>
            <DialogDescription>
              Wybierz oryginalną fakturę i dodaj kwotę korekty (dodatnią - zwiększającą saldo użytkownika)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invoice Search */}
            <div className="space-y-2">
              <Label>Wyszukaj oryginalną fakturę</Label>
              <div className="flex flex-col sm:flex-row gap-2 items-end min-w-0">
                <div className="flex-1 min-w-0">
                  <SearchInput
                    placeholder="Szukaj"
                    value={invoiceSearchQuery}
                    onChange={setInvoiceSearchQuery}
                    className="w-full"
                    showIcon
                  />
                </div>
                <div className="shrink-0 w-full sm:w-48">
                  <Select value={invoiceSearchCompanyId} onValueChange={setInvoiceSearchCompanyId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Wszystkie firmy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Wszystkie firmy</SelectItem>
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
                Oryginalna faktura <span className="text-red-500">*</span>
              </Label>
              {loadingCorrectableInvoices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ładowanie faktur...
                </div>
              ) : correctableInvoices && correctableInvoices.length > 0 ? (
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz fakturę do korekty" />
                  </SelectTrigger>
                  <SelectContent>
                    {correctableInvoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} - {invoice.companyName} - {invoice.userName} -{" "}
                        {invoice.kwota ? `${parseFloat(invoice.kwota).toFixed(2)} PLN` : "Brak kwoty"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  {invoiceSearchQuery || invoiceSearchCompanyId
                    ? "Nie znaleziono faktur spełniających kryteria"
                    : "Wpisz numer faktury lub wybierz firmę, aby wyszukać faktury"}
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
                  // Allow only numbers, comma, dot, and spaces
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
    </div>
  );
}
