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
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Loader2, Plus, ArrowRightLeft, Wallet, Calendar, User, Building2, CheckCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { AdvanceDetailsDialog } from "@/components/advance-details-dialog";
import { useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { ExportButton } from "@/components/export-button";
import { formatters } from "@/lib/export";

export default function AdvancesPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
    const [userSearch, setUserSearch] = useState("");

  const [createForm, setCreateForm] = useState({ userId: "", companyId: "", amount: "", description: "" });
  
  const { data: currentUser } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
    const searchParams = useSearchParams();

    const { data: advancesData, isLoading, refetch } = trpc.advances.getAll.useInfiniteQuery(
        { status: statusFilter as any, search },
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

    useEffect(() => {
        const advanceId = searchParams?.get("advanceId");
        if (advanceId) {
            setSelectedAdvance({ id: advanceId });
            setIsDetailsOpen(true);
        }
    }, [searchParams]);

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
                    description,
      });
  };

    const filteredUsers = useMemo(() => {
        const query = userSearch.trim().toLowerCase();
        if (!query) return usersData?.items || [];
        return (usersData?.items || []).filter((user: { name?: string; email?: string }) =>
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query)
        );
    }, [userSearch, usersData?.items]);

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
                                <ExportButton
                                    data={advances}
                                    filename="zaliczki"
                                    columns={[
                                        { key: "createdAt", header: "Data", formatter: (value: unknown) => formatters.date(value as Date | string) },
                                        { key: "userName", header: "Użytkownik" },
                                        { key: "companyName", header: "Firma" },
                                        { key: "amount", header: "Kwota", formatter: (value) => formatters.currency(Number(value)) },
                                        { key: "status", header: "Status", formatter: (value) => statusLabels[value as string] || String(value) },
                                        { key: "sourceType", header: "Źródło", formatter: (value) => value === "budget_request" ? "Wniosek budżetowy" : "Przyznana przez księgowego" },
                                    ]}
                                    filters={[
                                        {
                                            key: "createdAt",
                                            label: "Okres",
                                            options: [
                                                { value: "all", label: "Wszystko" },
                                                { value: "7", label: "Ostatnie 7 dni" },
                                                { value: "30", label: "Ostatnie 30 dni" },
                                                { value: "90", label: "Ostatnie 90 dni" },
                                                { value: "__specific_month__", label: "Wybierz miesiąc" },
                                            ],
                                        },
                                        {
                                            key: "status",
                                            label: "Status",
                                            options: [
                                                { value: "all", label: "Wszystkie" },
                                                { value: "pending", label: "Oczekujące" },
                                                { value: "transferred", label: "Przelane" },
                                                { value: "settled", label: "Rozliczone" },
                                            ],
                                        },
                                        {
                                            key: "sourceType",
                                            label: "Źródło",
                                            options: [
                                                { value: "all", label: "Wszystkie" },
                                                { value: "budget_request", label: "Wniosek budżetowy" },
                                                { value: "manual", label: "Przyznana przez księgowego" },
                                            ],
                                        },
                                        {
                                            key: "companyId",
                                            label: "Firma",
                                            options: [
                                                { value: "all", label: "Wszystkie" },
                                                ...(companiesData || []).map((company: { id: string; name: string }) => ({
                                                    value: company.id,
                                                    label: company.name,
                                                })),
                                            ],
                                        },
                                        {
                                            key: "userId",
                                            label: "Użytkownik",
                                            options: [
                                                { value: "all", label: "Wszyscy" },
                                                ...((usersData?.items || []).map((user: { id: string; name: string; email?: string }) => ({
                                                    value: user.id,
                                                    label: user.email ? `${user.name} (${user.email})` : user.name,
                                                }))),
                                            ],
                                        },
                                    ]}
                                />
                                <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
                                        <Plus className="h-4 w-4" /> Dodaj zaliczkę
                                </Button>
                        </div>
        </div>

        <Card>
                    <CardHeader>
             <div className="flex flex-col md:flex-row gap-3 md:items-center w-full">
                <div className="w-full md:flex-1">
                  <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Szukaj: użytkownik, email, firma, opis"
                      className="w-full"
                  />
                </div>
                <div className="shrink-0">
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
                            {advances.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Brak zaliczek</TableCell></TableRow>}
                            {advances.map((advance) => (
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
                            <Select onValueChange={(value) => setCreateForm({ ...createForm, userId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz użytkownika" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[240px]">
                                    <div className="p-2">
                                      <Input
                                        value={userSearch}
                                        onChange={(event) => setUserSearch(event.target.value)}
                                        placeholder="Szukaj użytkownika..."
                                      />
                                    </div>
                                    {filteredUsers.map((user: { id: string; name: string; email: string }) => (
                                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Firma</Label>
                        <div className="col-span-3">
                            <Select onValueChange={(value) => setCreateForm({ ...createForm, companyId: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz firmę" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companiesData?.map((company: { id: string; name: string }) => (
                                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

    </main>
  </div>
  );
}