"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Users, PlusCircle, Wallet, Plus, PencilIcon } from "lucide-react";
import { SectionLoader } from "@/components/section-loader";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";
import { ExportButton } from "@/components/export-button";
import { formatters } from "@/lib/export";

export default function SaldoManagementPage() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserSaldo, setSelectedUserSaldo] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddAmount, setQuickAddAmount] = useState("");
  const [quickAddJustification, setQuickAddJustification] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Check user role
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

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
  
  // Fetch saldo statistics
  const { data: stats } = trpc.saldo.getSaldoStats.useQuery();
  const queryClient = useQueryClient();

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
      setIsQuickAddOpen(false);
      setSelectedUserId(null);
      setAmount("");
      setNotes("");
      setQuickAddAmount("");
      setQuickAddJustification("");
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

    adjustSaldoMutation.mutate({
      userId: selectedUserId,
      amount: numAmount,
      notes,
      transactionType: "korekta",
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
    setAmount("");
    setNotes("");
    setIsDialogOpen(true);
  };

  const openQuickAddDialog = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUserSaldo(fetchUserSaldo(userId));
    setQuickAddAmount("");
    setQuickAddJustification("");
    setIsQuickAddOpen(true);
  };

  const handleQuickAdd = () => {
    const numAmount = parseFloat(quickAddAmount);
    
    if (!selectedUserId || !quickAddAmount || isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Błąd",
        description: "Wprowadź prawidłową dodatnią kwotę",
        variant: "destructive",
      });
      return;
    }

    if (!quickAddJustification || quickAddJustification.trim().length < 5) {
      toast({
        title: "Błąd",
        description: "Uzasadnienie musi zawierać minimum 5 znaków",
        variant: "destructive",
      });
      return;
    }

    adjustSaldoMutation.mutate({
      userId: selectedUserId,
      amount: numAmount,
      notes: quickAddJustification.trim(),
      transactionType: "zasilenie",
    });
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

  if (!user || user.role === "user") {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Zarządzanie Saldo</h1>
            </div>
          </div>
        </div>

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <ExportButton
                data={exportData || []}
                columns={[
                  { key: 'name', header: 'Imię i nazwisko' },
                  { key: 'email', header: 'Email' },
                  { key: 'saldo', header: 'Saldo', formatter: formatters.currency },
                  { key: 'role', header: 'Rola', formatter: (value: string) => value === 'admin' ? 'Administrator' : value === 'accountant' ? 'Księgowy' : 'Użytkownik' },
                  { key: 'createdAt', header: 'Data rejestracji', formatter: formatters.date },
                ]}
                filename="saldo-uzytkownikow"
                label="Eksportuj saldo"
                size="sm"
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
                                onClick={() => openQuickAddDialog(user.id)}
                              >
                                <PlusCircle className="h-4 w-4 mr-1" />
                                Dodaj
                              </Button>
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
      </Card>      )}
      {filteredUsers.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
          Wyświetlono {filteredUsers.length} z {allUsers.length} użytkowników
        </div>
      )}

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
              Aktualne saldo użytkownika: <span className={selectedUserSaldo > 0 ? "text-green-600" : selectedUserSaldo < 0 ? "text-red-600" : "text-gray-600"}>{selectedUserSaldo.toFixed(2)} PLN</span>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Kwota (PLN)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="np. 1000 lub -500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Dodatnie wartości dodają, ujemne odejmują
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notatka (minimum 5 znaków)</Label>
              <Textarea
                id="notes"
                placeholder="Powód korekty saldo"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
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
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Dodaj środki</DialogTitle>
            <DialogDescription>
              Szybko dodaj środki do budżetu użytkownika
            </DialogDescription>
          </DialogHeader>
          {selectedUserSaldo !== null && (
            <div className="mb-2 text-sm text-muted-foreground">
              Aktualne saldo użytkownika: <span className={selectedUserSaldo > 0 ? "text-green-600" : selectedUserSaldo < 0 ? "text-red-600" : "text-gray-600"}>{selectedUserSaldo.toFixed(2)} PLN</span>
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="quickAmount">Kwota (PLN)</Label>
              <Input
                id="quickAmount"
                type="number"
                step="0.01"
                placeholder="np. 1000"
                value={quickAddAmount}
                onChange={(e) => setQuickAddAmount(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Tylko dodatnie wartości
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quickJustification">Uzasadnienie</Label>
              <Textarea
                id="quickJustification"
                placeholder="Powod dodania środków (minimum 5 znaków)"
                value={quickAddJustification}
                onChange={(e) => setQuickAddJustification(e.target.value)}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                {quickAddJustification.length}/5 znaków minimum
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsQuickAddOpen(false)}
              disabled={adjustSaldoMutation.isPending}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={adjustSaldoMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white dark:text-white"
            >
              {adjustSaldoMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
