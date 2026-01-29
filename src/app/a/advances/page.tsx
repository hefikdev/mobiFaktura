"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Loader2, Plus, ArrowRightLeft, Calendar, User, Building2, CheckCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { AdvanceDetailsDialog } from "@/components/advance-details-dialog";
import { useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { AdvancedExportDialog } from "@/components/advanced-export-dialog";
import { Footer } from "@/components/footer";
import { AdvancedFilters } from "@/components/advanced-filters";
import type { FilterConfig, FilterValue } from "@/components/advanced-filters";

type AdvanceItem = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyNip?: string | null;
  amount: number;
  status: string;
  description?: string | null;
  createdAt: Date | string;
  sourceType?: string;
};

export default function AdvancesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, FilterValue>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<AdvanceItem | null>(null);
  const [createForm, setCreateForm] = useState({ userId: "", companyId: "", amount: "", description: "" });
  
  const { data: currentUser } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
    const searchParams = useSearchParams();

    const { data: advancesData, isLoading, refetch } = trpc.advances.getAll.useInfiniteQuery(
        { status: statusFilter, search },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 10000, // Auto-refresh every 10 seconds
      refetchOnWindowFocus: true,
      staleTime: 2000,
    }
  );

  const advances = advancesData?.pages.flatMap((page) => page.items) || [];

  const { data: companiesData } = trpc.company.listAll.useQuery();
  const { data: usersData } = trpc.admin.getUsers.useQuery({});

  const createMutation = trpc.advances.createManual.useMutation({
    onSuccess: () => {
      toast({ title: "Sukces", description: "Zaliczka utworzona" });
      setIsCreateOpen(false);
      setCreateForm({ userId: "", companyId: "", amount: "", description: "" });
            utils.advances.getAll.invalidate();
            refetch();
    },
    onError: (err) => toast({ variant: "destructive", title: "Błąd", description: err.message }),
  });

  // Export mutation
  const exportMutation = trpc.exports.generateAdvancesExcel.useMutation();

    useEffect(() => {
        const advanceId = searchParams?.get("advanceId");
        if (advanceId && advances) {
            const advance = advances.find((a: AdvanceItem) => a.id === advanceId);
            if (advance) {
                setSelectedAdvance(advance as AdvanceItem);
                setIsDetailsOpen(true);
            }
        }
    }, [searchParams, advances]);


  // Prepare user options for SearchableSelect
  const userOptions: SearchableSelectOption[] = useMemo(() => {
    return (usersData?.items || []).map((user: { id: string; name: string; email: string }) => ({
      value: user.id,
      label: `${user.name} (${user.email})`,
      searchableText: `${user.name} ${user.email} ${user.id}`, // Include UUID for searching
    }));
  }, [usersData?.items]);

  // Prepare company options for SearchableSelect
  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return (companiesData || []).map((company: { id: string; name: string; nip?: string | null }) => ({
      value: company.id,
      label: company.name,
      searchableText: `${company.name} ${company.nip || ""} ${company.id}`, // Include NIP and UUID for searching
    }));
  }, [companiesData]);

  // Export columns configuration
  const exportColumns = [
    { id: "userName", label: "Użytkownik", enabled: true },
    { id: "companyName", label: "Firma", enabled: true },
    { id: "amount", label: "Kwota", enabled: true },
    { id: "status", label: "Status", enabled: true },
    { id: "sourceType", label: "Źródło", enabled: true },
    { id: "createdAt", label: "Data utworzenia", enabled: true },
    { id: "transferDate", label: "Data przelewu", enabled: false },
    { id: "settledAt", label: "Data rozliczenia", enabled: false },
    { id: "description", label: "Opis", enabled: false },
    { id: "id", label: "UUID", enabled: false },
    { id: "userId", label: "UUID użytkownika", enabled: false },
    { id: "companyId", label: "UUID firmy", enabled: false },
  ];

  // Export handler
  const handleAdvancedExport = async (config: {
    columns: Array<{ id: string; label: string; enabled: boolean }>;
    sortBy: string;
    sortOrder: "asc" | "desc";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName: string;
    sheetName: string;
    includeTimestamp: boolean;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    // Call TRPC mutation with parameters
    const result = await exportMutation.mutateAsync({
      columns: config.columns,
      sortBy: config.sortBy,
      sortOrder: config.sortOrder,
      currencyFormat: config.currencyFormat,
      showCurrencySymbol: config.showCurrencySymbol,
      fileName: config.fileName,
      sheetName: config.sheetName,
      includeTimestamp: config.includeTimestamp,
      status: config.status,
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      includeUUIDs: config.columns.some(c => c.id.toLowerCase().includes('id') && c.enabled),
    });

    if (result.success && result.data) {
      // Convert base64 to blob and download
      const byteCharacters = atob(result.data as string);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.fileName || 'zaliczki.xlsx';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      throw new Error("Nie udało się wygenerować raportu");
    }
  };

  const statusLabels: Record<string, string> = {
      pending: "Oczekująca",
      transferred: "Przelana",
      settled: "Rozliczona",
  };

  const statusClasses: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/20 dark:text-yellow-400",
      transferred: "bg-blue-100 text-blue-800 dark:bg-blue-600/20 dark:text-blue-400",
      settled: "bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-400",
  };

  // Define advanced filter configuration
  const advancedFilterConfig: FilterConfig[] = [
    {
      label: "Zakres dat",
      type: "dateRange",
      field: "date",
    },
    {
      label: "Kwota",
      type: "amount",
      field: "amount",
    },
    {
      label: "Źródło",
      type: "select",
      field: "sourceType",
      options: [
        { value: "__all__", label: "Wszystkie" },
        { value: "budget_request", label: "Wniosek budżetowy" },
        { value: "manual", label: "Przyznana przez księgowego" },
      ],
    },
  ];

  // Enhanced search that includes all fields
  const filteredAdvances = useMemo(() => {
    let filtered = advances || [];

    // Global search across all fields
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter((advance: AdvanceItem) => {
        return (
          advance.userName?.toLowerCase().includes(query) ||
          advance.userEmail?.toLowerCase().includes(query) ||
          advance.companyName?.toLowerCase().includes(query) ||
          advance.companyNip?.toLowerCase().includes(query) ||
          advance.description?.toLowerCase().includes(query) ||
          advance.amount?.toString().includes(query) ||
          advance.id?.toLowerCase().includes(query) ||
          advance.userId?.toLowerCase().includes(query) ||
          advance.companyId?.toLowerCase().includes(query) ||
          statusLabels[advance.status]?.toLowerCase().includes(query)
        );
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((advance: AdvanceItem) => advance.status === statusFilter);
    }

    // Advanced filters
    if (advancedFilters.dateFrom) {
      const fromDate = advancedFilters.dateFrom instanceof Date 
        ? advancedFilters.dateFrom 
        : new Date(String(advancedFilters.dateFrom));
      filtered = filtered.filter((advance: AdvanceItem) => new Date(advance.createdAt) >= fromDate);
    }
    if (advancedFilters.dateTo) {
      const toDate = advancedFilters.dateTo instanceof Date 
        ? advancedFilters.dateTo 
        : new Date(String(advancedFilters.dateTo));
      filtered = filtered.filter((advance: AdvanceItem) => new Date(advance.createdAt) <= toDate);
    }
    if (advancedFilters.amountMin) {
      filtered = filtered.filter((advance: AdvanceItem) => advance.amount >= parseFloat(String(advancedFilters.amountMin)));
    }
    if (advancedFilters.amountMax) {
      filtered = filtered.filter((advance: AdvanceItem) => advance.amount <= parseFloat(String(advancedFilters.amountMax)));
    }
    if (advancedFilters.sourceType && advancedFilters.sourceType !== "__all__") {
      filtered = filtered.filter((advance: AdvanceItem) => advance.sourceType === advancedFilters.sourceType);
    }

    return filtered;
  }, [advances, search, statusFilter, advancedFilters, statusLabels]);

  const handleCreate = () => {
    const description = createForm.description.trim();
    if (!createForm.userId || !createForm.companyId || !createForm.amount) return;
    if (description.length < 5) {
      toast({
        title: "Błąd",
        description: "Opis musi mieć co najmniej 5 znaków",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({
      userId: createForm.userId,
      companyId: createForm.companyId,
      amount: parseFloat(createForm.amount),
      description: description,
    });
  };

  const openDetails = (advance: { id: string; userId: string; companyId: string; amount: number; status: string; createdAt: Date; transferDate: Date | null; settledAt: Date | null }) => {
    setSelectedAdvance(advance);
    setIsDetailsOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {currentUser?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
            <div className="flex items-center gap-3">
                <ArrowRightLeft className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Zaliczki</h1>
            </div>
                        <div className="flex items-center gap-2">
                                <AdvancedExportDialog
                                    reportType="advances"
                                    defaultColumns={exportColumns}
                                    defaultFileName="zaliczki"
                                    defaultSheetName="Zaliczki"
                                    statusOptions={[
                                        { value: "pending", label: "Oczekująca" },
                                        { value: "transferred", label: "Przelana" },
                                        { value: "settled", label: "Rozliczona" },
                                    ]}
                                    onExport={handleAdvancedExport}
                                />
                                <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
                                        <Plus className="h-4 w-4" /> Dodaj zaliczkę
                                </Button>
                        </div>
        </div>

        <Card>
                    <CardHeader>
             <div className="flex flex-col md:flex-row gap-3 md:items-center w-full">
                <div className="flex gap-2 items-center w-full md:flex-1">
                  <AdvancedFilters
                    filters={advancedFilterConfig}
                    values={advancedFilters}
                    onChange={setAdvancedFilters}
                    onReset={() => setAdvancedFilters({})}
                  />
                  <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Szukaj"
                      className="w-full flex-1"
                      showIcon
                  />
                </div>
                <div className="shrink-0 flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Wszystkie</SelectItem>
                          <SelectItem value="pending">Oczekujące</SelectItem>
                          <SelectItem value="transferred">Przelane</SelectItem>
                          <SelectItem value="settled">Rozliczone</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
               <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
            ) : (
                <div className="w-full">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Użytkownik</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Kwota</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Źródło</TableHead>
                                <TableHead className="text-right">Akcje</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAdvances.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak zaliczek</TableCell></TableRow>}
                            {filteredAdvances.map((advance) => (
                                <TableRow key={advance.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetails(advance)}>
                                    <TableCell className="whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            {format(new Date(advance.createdAt), "dd MMM yyyy", { locale: pl })}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <div className="font-medium text-sm">{advance.userName}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                         <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            {advance.companyName}
                                         </div>
                                    </TableCell>
                                    <TableCell className="font-bold">{Number(advance.amount).toFixed(2)} PLN</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${statusClasses[advance.status]} border-0`}>
                                            {statusLabels[advance.status] || advance.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {advance.sourceType === "budget_request" ? "Wniosek budżetowy" : "Przyznana przez księgowego"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end" onClick={(event) => event.stopPropagation()}>
                                            {(advance.status === "pending" || advance.status === "transferred") ? (
                                                <Button size="sm" 
                                                    className={advance.status === "pending" ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"}
                                                    onClick={(event) => { event.stopPropagation(); openDetails(advance); }}>
                                                    {advance.status === "pending" ? (
                                                        <>
                                                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                                                            Przelew
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Rozlicz
                                                        </>
                                                    )}
                                                </Button>
                                            ) : (
                                                 <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); openDetails(advance); }}>
                                                      <Info className="h-4 w-4 text-muted-foreground" />
                                                 </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Utwórz nową zaliczkę</DialogTitle>
                    <DialogDescription>Manualne dodanie zaliczki dla użytkownika.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Użytkownik</Label>
                        <div className="col-span-3">
                            <SearchableSelect
                                options={userOptions}
                                value={createForm.userId}
                                onValueChange={(value) => setCreateForm({ ...createForm, userId: value })}
                                placeholder="Wybierz użytkownika"
                                searchPlaceholder="Szukaj"
                                emptyText="Nie znaleziono użytkowników"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Firma</Label>
                        <div className="col-span-3">
                            <SearchableSelect
                                options={companyOptions}
                                value={createForm.companyId}
                                onValueChange={(value) => setCreateForm({ ...createForm, companyId: value })}
                                placeholder="Wybierz firmę"
                                searchPlaceholder="Szukaj"
                                emptyText="Nie znaleziono firm"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Kwota (PLN)</Label>
                        <Input className="col-span-3" type="number" 
                            value={createForm.amount} 
                            onChange={(event) => setCreateForm({ ...createForm, amount: event.target.value })} 
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Opis</Label>
                        <Input className="col-span-3" 
                            value={createForm.description} 
                            onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })} 
                            placeholder="Wymagane (min. 5 znaków)"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Anuluj</Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Utwórz
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AdvanceDetailsDialog
             advanceId={selectedAdvance?.id || null}
             open={isDetailsOpen}
             onOpenChange={setIsDetailsOpen}
               onSuccess={() => {
                  utils.advances.getAll.invalidate();
                  refetch();
               }}
        />

        <Footer />
    </main>
  </div>
  );
}