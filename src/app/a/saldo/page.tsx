"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
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
  DialogTrigger,
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
import { Loader2, Plus, Minus, TrendingUp, TrendingDown, DollarSign, Users, Search, PlusCircle, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";

export default function SaldoManagementPage() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddAmount, setQuickAddAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Check user role
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Fetch all users with saldo
  const { data: usersData, isLoading, refetch } = trpc.saldo.getAllUsersSaldo.useQuery();

  // Fetch saldo statistics
  const { data: stats } = trpc.saldo.getSaldoStats.useQuery();

  // Refetch data when page becomes visible (same as invoices page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also refetch when the window regains focus
    const handleFocus = () => {
      refetch();
    };
    
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
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

    adjustSaldoMutation.mutate({
      userId: selectedUserId,
      amount: numAmount,
      notes,
    });
  };

  const openAdjustDialog = (userId: string) => {
    setSelectedUserId(userId);
    setAmount("");
    setNotes("");
    setIsDialogOpen(true);
  };

  const openQuickAddDialog = (userId: string) => {
    setSelectedUserId(userId);
    setQuickAddAmount("");
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

    adjustSaldoMutation.mutate({
      userId: selectedUserId,
      amount: numAmount,
      notes: `Dodanie środków: ${numAmount.toFixed(2)} PLN`,
    });
    setIsQuickAddOpen(false);
    setQuickAddAmount("");
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!usersData) return [];
    if (!searchQuery.trim()) return usersData;

    const query = searchQuery.toLowerCase();
    return usersData.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [usersData, searchQuery]);

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
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
              <CardTitle className="text-sm font-medium">Dodatnie</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.positiveBalance}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ujemne</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.negativeBalance}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj użytkownika..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "user" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold ${
                            user.saldo > 0
                              ? "text-green-600"
                              : user.saldo < 0
                              ? "text-red-600"
                              : "text-gray-600"
                          }`}
                        >
                          {user.saldo.toFixed(2)} PLN
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openQuickAddDialog(user.id)}
                          >
                            <PlusCircle className="h-4 w-4 mr-1" />
                            Dodaj środki
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAdjustDialog(user.id)}
                          >
                            Dostosuj
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Nie znaleziono użytkowników" : "Brak użytkowników"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Adjust Saldo Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Dostosuj Saldo</DialogTitle>
            <DialogDescription>
              Zmień saldo użytkownika. Użyj dodatniej wartości aby zwiększyć saldo, ujemnej aby zmniejszyć.
            </DialogDescription>
          </DialogHeader>
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
                Dodatnia wartość zwiększy saldo, ujemna zmniejszy
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notatka</Label>
              <Textarea
                id="notes"
                placeholder="Powód zmiany saldo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Minimum 5 znaków
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
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Dodaj środki</DialogTitle>
            <DialogDescription>
              Szybko dodaj środki do budżetu użytkownika
            </DialogDescription>
          </DialogHeader>
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
              className="bg-green-600 hover:bg-green-700"
            >
              {adjustSaldoMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>

      <Footer />
    </div>
  );
}
