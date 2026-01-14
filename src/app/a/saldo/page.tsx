"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { SearchInput } from "@/components/search-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users, Wallet, PencilIcon, History, User, ShieldCheck, Clock, XCircle, CheckCircle2, Receipt, FileText } from "lucide-react";
import { SectionLoader } from "@/components/section-loader";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";
import { ExportButton } from "@/components/export-button";
import { formatters } from "@/lib/export";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";

export default function SaldoManagementPage() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserSaldo, setSelectedUserSaldo] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<number | undefined>(undefined);
  const [allHistoryItems, setAllHistoryItems] = useState<any[]>([]);

  // Check user role
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Fetch all companies for company selection
  const { data: companies } = trpc.company.listAll.useQuery(undefined, {
    enabled: !!user && (user.role === "accountant" || user.role === "admin"),
  });

  // Fetch users with infinite query
  const {
    data: usersData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = trpc.saldo.getAllUsersSaldo.useInfiniteQuery(
    {
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
    }
  );

  const allUsers = usersData?.pages.flatMap((page) => page.items) || [];

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!searchQuery) return allUsers;

    const query = searchQuery.toLowerCase();
    return allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  // Filter users for history tab
  const filteredHistoryUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!historySearchQuery) return allUsers;

    const query = historySearchQuery.toLowerCase();
    return allUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [allUsers, historySearchQuery]);

  // Reset show all users when search changes
  useEffect(() => {
    setShowAllUsers(false);
  }, [historySearchQuery]);
  
  // Fetch saldo statistics
  const { data: stats } = trpc.saldo.getSaldoStats.useQuery();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch export data
  const { data: exportData } = trpc.saldo.exportAllUsersSaldo.useQuery(
    {
      search: searchQuery,
      sortBy: "name",
      sortOrder: "asc",
    },
    {
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
    }
  );

  // User specific data for history tab
  const { data: userStats, isLoading: statsLoading } = trpc.saldo.getUserStats.useQuery(
    { userId: historyUserId! },
    { enabled: !!historyUserId }
  );

  const { data: userGraphData } = trpc.saldo.getUserSaldoHistoryForGraph.useQuery(
    { userId: historyUserId! },
    { enabled: !!historyUserId }
  );

  const { data: userHistory, isLoading: historyLoading, fetchNextPage: fetchNextHistory } = trpc.saldo.getSaldoHistory.useInfiniteQuery(
    {
      userId: historyUserId!,
      limit: 50,
    },
    {
      enabled: !!historyUserId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { data: userBudgetRequests } = trpc.budgetRequest.getAll.useQuery(
    {
      userId: historyUserId!,
      limit: 100, // Load all budget requests since there are usually fewer
    },
    {
      enabled: !!historyUserId,
    }
  );

  // Combine and sort history
  const combinedHistory = useMemo(() => {
    if (!userHistory?.pages && !userBudgetRequests?.items) return [];
    
    const saldoItems = (userHistory?.pages.flatMap(page => page.items) || []).map(item => ({
      ...item,
      type: 'saldo' as const,
      date: new Date(item.createdAt)
    }));

    const budgetItems = (userBudgetRequests?.items || []).map(item => ({
      ...item,
      type: 'budget' as const,
      date: new Date(item.createdAt)
    }));

    return [...saldoItems, ...budgetItems].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [userHistory, userBudgetRequests]);

  // Check if there are more items to load
  const hasNextHistoryPage = userHistory?.pages[userHistory.pages.length - 1]?.nextCursor;
  const isLoadingMore = historyLoading;

  // Export data for user history
  const userHistoryExportData = useMemo(() => {
    if (!combinedHistory) return [];
    return combinedHistory.map(item => {
      const status = item.type === 'saldo' 
        ? formatters.transactionType(item.transactionType)
        : formatters.status(item.status);
      
      return {
        date: format(item.date, "dd.MM.yyyy HH:mm", { locale: pl }),
        type: item.type === 'saldo' ? 'Transakcja' : 'Prośba',
        amount: item.type === 'saldo' ? item.amount.toFixed(2) + ' PLN' : item.requestedAmount.toFixed(2) + ' PLN',
        status,
        notes: item.type === 'saldo' ? item.notes : item.justification,
      };
    });
  }, [combinedHistory]);

  // Export raw data for ExportButton (dialog will show filter controls)
  const userHistoryExportRaw = useMemo(() => {
    return combinedHistory.map(item => ({
      date: item.date,
      type: item.type === 'saldo' ? 'Transakcja' : 'Prośba',
      amount: item.type === 'saldo' ? item.amount : item.requestedAmount,
      status: item.type === 'saldo' ? item.transactionType : item.status,
      notes: item.type === 'saldo' ? item.notes : item.justification,
    }));
  }, [combinedHistory]);

  // Ref for infinite scroll - callback ref pattern like invoices page
  const observer = useRef<IntersectionObserver>();
  const lastUserElementRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Refetch data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", () => refetch());

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", () => refetch());
    };
  }, [refetch]);

  // Adjust saldo mutation
  const adjustSaldoMutation = trpc.saldo.adjustSaldo.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsDialogOpen(false);
      setSelectedUserId(null);
      setAmount("");
      setNotes("");
      refetch();
      // Refresh statistics after saldo adjustment
      queryClient.invalidateQueries({ queryKey: [["saldo", "getSaldoStats"]] });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdjustSaldo = () => {
    if (!selectedUserId || !amount || !notes) {
      toast({
        title: "Błąd",
        description: "Wszystkie pola są wymagane",
        variant: "destructive",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      toast({
        title: "Błąd",
        description: "Nieprawidłowa kwota",
        variant: "destructive",
      });
      return;
    }

    if (notes.trim().length < 5) {
      toast({
        title: "Błąd",
        description: "Notatka musi zawierać minimum 5 znaków",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCompanyId) {
      toast({
        title: "Błąd",
        description: "Wybierz firmę",
        variant: "destructive",
      });
      return;
    }

    adjustSaldoMutation.mutate({
      userId: selectedUserId,
      amount: numAmount,
      notes,
      transactionType: "adjustment",
    });
  };


  // Helper to get saldo for a user
  const fetchUserSaldo = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    return user ? user.saldo : null;
  };

  const openAdjustDialog = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUserSaldo(fetchUserSaldo(userId));
    setSelectedCompanyId(companies && companies.length > 0 ? companies[0]?.id || null : null);
    setAmount("");
    setNotes("");
    setIsDialogOpen(true);
  };

  if (userLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Helper to get transaction type label
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "adjustment":
        return "Korekta";
      case "invoice_deduction":
        return "Odliczenie faktury";
      case "invoice_refund":
        return "Zwrot za fakturę";
      case "advance_credit":
        return "Przyznana przez księgowego";
      case "zasilenie":
        return "Zasilenie";
      case "korekta":
        return "Korekta";
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        <Tabs defaultValue="management" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Zarządzanie Saldo</h1>
              </div>
            </div>
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="management">Aktualne</TabsTrigger>
              <TabsTrigger value="history">Historia użytkownika</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="management" className="space-y-6">
            {/* Statistics Cards */}
            {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wszyscy użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Całkowite Saldo</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalSaldo.toFixed(2)} PLN
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dodatnie Saldo</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.positiveBalance.toFixed(2)} PLN
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ujemne Saldo</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.negativeBalance.toFixed(2)} PLN
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center">
            <SectionLoader />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                />
              </div>
              <ExportButton
                data={exportData || []}
                columns={[
                  { key: 'name', header: 'Imię i nazwisko' },
                  { key: 'email', header: 'Email' },
                  { key: 'saldo', header: 'Saldo', formatter: (value: unknown) => formatters.currency(value as number) },
                  { key: 'role', header: 'Rola', formatter: (value: unknown) => (value === 'admin' ? 'Administrator' : value === 'accountant' ? 'Księgowy' : 'Użytkownik') },
                  { key: 'createdAt', header: 'Data rejestracji', formatter: (value: unknown) => formatters.date(value as Date | string) },
                ]}
                filename="saldo-uzytkownikow"
                label="Eksportuj saldo"
                size="sm"
                filters={[{
                  key: 'createdAt',
                  label: 'Data rejestracji',
                  options: [
                    { value: 'all', label: 'Wszystkie' },
                    { value: '30', label: 'Ostatnie 30 dni' },
                    { value: '__specific_month__', label: 'Konkretne miesiąc' }
                  ]
                }]}
              />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  <>
                    {filteredUsers.map((user, index) => {
                      const isLastUser = index === filteredUsers.length - 1;
                      return (
                        <TableRow key={user.id} ref={isLastUser ? lastUserElementRef : null}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${
                                  user.saldo > 0
                                    ? "text-green-600"
                                    : user.saldo < 0
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {user.saldo.toFixed(2)} PLN
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openAdjustDialog(user.id)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isFetchingNextPage && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Brak użytkowników
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}
      {filteredUsers.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
          Wyświetlono {filteredUsers.length} z {allUsers.length} użytkowników
        </div>
      )}
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Historia salda użytkowników</CardTitle>
              {historyUserId && (
                <ExportButton
                  data={userHistoryExportRaw || []}
                  filters={[
                    { key: 'date', label: 'Zakres dat', options: [
                      { value: 'all', label: 'Wszystkie daty' },
                      { value: '7', label: 'Ostatnie 7 dni' },
                      { value: '30', label: 'Ostatnie 30 dni' },
                      { value: '365', label: 'Ostatni rok' },
                      { value: '__specific_month__', label: 'Konkretne miesiąc' },
                    ] },
                    { key: 'status', label: 'Status', options: [
                      { value: 'all', label: 'Wszystkie' },
                      { value: 'approved', label: 'Zatwierdzone' },
                      { value: 'pending', label: 'Oczekujące' },
                      { value: 'rejected', label: 'Odrzucone' },
                    ] },
                  ]}
                  columns={[
                    { key: 'date', header: 'Data', formatter: (v: unknown) => formatters.date(v as Date) },
                    { key: 'type', header: 'Typ' },
                    { key: 'amount', header: 'Kwota', formatter: (v: unknown) => formatters.currency(v as number) },
                    { key: 'status', header: 'Status / Szczegóły' },
                    { key: 'notes', header: 'Notatka / Uzasadnienie' },
                  ]}
                  filename={`historia-${userStats?.userName?.replace(/\s+/g, '_') || 'uzytkownik'}`}
                  label="Eksportuj historię"
                  size="sm"
                  enablePdf={true}
                  pdfTitle={`Historia Salda`}
                  userName={userStats?.userName}
                />
              )} 
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-md space-y-2">
                <Label>Wyszukaj użytkownika</Label>
                <SearchInput
                  value={historySearchQuery}
                  onChange={setHistorySearchQuery}
                  placeholder="np. Jan Kowalski"
                />
              </div>
            </div>
            {filteredHistoryUsers.length > 0 && (
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(showAllUsers ? filteredHistoryUsers : filteredHistoryUsers.slice(0, 6)).map((u) => (
                    <Button
                      key={u.id}
                      variant={historyUserId === u.id ? "default" : "outline"}
                      onClick={() => setHistoryUserId(u.id)}
                      className="justify-start h-auto p-4"
                    >
                      <div className="text-left w-full">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                        <div className={`text-sm font-semibold mt-1 ${u.saldo > 0 ? 'text-green-600' : u.saldo < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {u.saldo.toFixed(2)} PLN
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
                {filteredHistoryUsers.length > 6 && !showAllUsers && (
                  <div className="text-center mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowAllUsers(true)}
                    >
                      Załaduj więcej ({filteredHistoryUsers.length - 6} pozostałych)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {historyUserId && userStats && (
          <>
            {/* User Statistics Boxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aktualne Saldo</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${userStats.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {userStats.saldo.toFixed(2)} PLN
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prośby (Zatwierdzone)</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userStats.approvedRequests} / {userStats.totalRequests}</div>
                  <p className="text-xs text-muted-foreground">Łącznie wszystkich próśb</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Odrzucone / Oczekujące</CardTitle>
                  <div className="flex gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userStats.rejectedRequests} / {userStats.pendingRequests}</div>
                  <p className="text-xs text-muted-foreground">Nieudane lub w toku</p>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Trust Score</CardTitle>
                  <ShieldCheck className={`h-4 w-4 ${userStats.trustScore > 80 ? 'text-green-500' : userStats.trustScore > 50 ? 'text-yellow-500' : 'text-red-500'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${userStats.trustScore > 80 ? 'text-green-600' : userStats.trustScore > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {userStats.trustScore}%
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${userStats.trustScore > 80 ? 'bg-green-500' : userStats.trustScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${userStats.trustScore}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Graph Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Historia zmian salda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  {userGraphData && userGraphData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={userGraphData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(str) => format(new Date(str), "dd.MM", { locale: pl })}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `${value} zł`}
                        />
                        <Tooltip 
                          labelFormatter={(label) => format(new Date(label), "PPP HH:mm", { locale: pl })}
                          formatter={(value: number) => [`${value.toFixed(2)} PLN`, "Saldo"]}
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                        />
                        <ReferenceLine y={0} stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'right', value: '0 zł', fill: '#f97316', fontSize: 12 }} />
                        <Line 
                          type="monotone" 
                          dataKey="balance" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground dark:text-muted-foreground/70">
                      Brak danych do wyświetlenia wykresu
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Combined History Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Pełna historia (Saldo i Prośby)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Kwota</TableHead>
                        <TableHead>Status / Szczegóły</TableHead>
                        <TableHead>Notatka / Uzasadnienie</TableHead>
                      <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {combinedHistory.length > 0 ? (
                        combinedHistory.map((item, idx) => (
                          <TableRow key={`${item.type}-${item.id}-${idx}`}>
                            <TableCell className="whitespace-nowrap">
                              {format(item.date, "dd.MM.yyyy HH:mm", { locale: pl })}
                            </TableCell>
                            <TableCell>
                              {item.type === 'saldo' ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                                  Transakcja
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                                  Prośba
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.type === 'saldo' ? (
                                <span className={item.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                                  {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)} PLN
                                </span>
                              ) : (
                                <span>{item.requestedAmount.toFixed(2)} PLN</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.type === 'saldo' ? (
                                <div className="flex items-center gap-2">
                                  <span className="capitalize text-sm">{getTransactionTypeLabel(item.transactionType)}</span>
                                  {item.transactionType === 'invoice_deduction' && item.referenceId && (
                                    // inline invoice button removed — icon-only column is used on the right
                                    null
                                  )}
                                </div>
                              ) : (
                                <Badge 
                                  variant={
                                    item.status === 'approved' ? 'default' : 
                                    item.status === 'pending' ? 'secondary' : 'destructive'
                                  }
                                  className="capitalize"
                                >
                                  {item.status === 'approved' ? 'Zatwierdzona' : 
                                   item.status === 'pending' ? 'Oczekująca' : 'Odrzucona'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground dark:text-muted-foreground/70" title={(item.type === 'saldo' ? item.notes : item.justification) ?? ""}>
                              {item.type === 'saldo' ? item.notes : item.justification}
                            </TableCell>
                            <TableCell className="text-right w-20">
                              {item.type === 'saldo' && item.transactionType === 'invoice_deduction' && item.referenceId && (
                                <Link href={`/a/user-invoice/${item.referenceId}`}>
                                  <Button variant="ghost" size="sm" className="p-1">
                                    <Receipt className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </TableCell> 
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground dark:text-muted-foreground/70">
                            Brak historii dla tego użytkownika
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {combinedHistory.length > 0 && (
                  <>
                    <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
                      Wyświetlono {combinedHistory.length} z {(userHistory?.pages?.flatMap(p => p.items).length || 0) + (userBudgetRequests?.items?.length || 0)} pozycji
                    </div>
                    {hasNextHistoryPage && (
                      <div className="mt-2 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            fetchNextHistory();
                          }}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Ładowanie...
                            </>
                          ) : (
                            'Załaduj więcej'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!historyUserId && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground dark:text-muted-foreground/70 border-2 border-dashed rounded-lg">
            <User className="h-12 w-12 mb-4 opacity-20" />
            <p>Wybierz użytkownika z listy powyżej, aby zobaczyć szczegóły</p>
          </div>
        )}
      </TabsContent>
      </Tabs>

      {/* Adjust Saldo Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Korekta Saldo</DialogTitle>
            <DialogDescription>
              Dodaj lub odejmij środki z budżetu użytkownika
            </DialogDescription>
          </DialogHeader>
          {selectedUserSaldo !== null && (
            <div className="mb-2 text-sm text-muted-foreground">
              Aktualne saldo {user?.name ?? 'użytkownik'}: <span className={selectedUserSaldo > 0 ? "text-green-600" : selectedUserSaldo < 0 ? "text-red-600" : "text-gray-600"}>{selectedUserSaldo.toFixed(2)} PLN</span>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company">Firma</Label>
              <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              />
              <p className="text-sm text-muted-foreground/40 dark:text-muted-foreground/70">
                Dodatnie wartości dodają, ujemne odejmują
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notatka</Label>
              <Textarea
                id="notes"
                placeholder=""
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground dark:text-muted-foreground/70">
                {notes.length}/5 znaków minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={adjustSaldoMutation.isPending}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleAdjustSaldo}
              disabled={adjustSaldoMutation.isPending}
            >
              {adjustSaldoMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Funds Dialog */}
      <div className="hidden md:block">
        <Footer />
      </div>
      <div className="md:hidden">
        <Footer />
      </div>
    </main>
  </div>
  );
}
