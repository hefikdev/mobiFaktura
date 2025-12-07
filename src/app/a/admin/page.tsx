"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { BulkDeleteInvoices } from "@/components/bulk-delete-invoices";
import { formatDate, formatDateTimeWithSeconds } from "@/lib/date-utils";
import {
  Users,
  FileText,
  TrendingUp,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Download,
  HardDrive,
  KeyRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);

  // Form states
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<"user" | "accountant" | "admin">("user");

  const [companyName, setCompanyName] = useState("");
  const [companyNip, setCompanyNip] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");

  // Sorting states
  const [sortBy, setSortBy] = useState<"date" | "number" | "company" | "user" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Login logs states
  const [loginLogsDays, setLoginLogsDays] = useState(30);
  const [loginLogsUserId, setLoginLogsUserId] = useState<string | undefined>(undefined);

  // Reset password states
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserName, setResetUserName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Delete user dialog states
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteUserName, setDeleteUserName] = useState("");
  const [deleteUserPassword, setDeleteUserPassword] = useState("");

  // Delete invoice dialog states
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState("");
  const [deleteInvoiceNumber, setDeleteInvoiceNumber] = useState("");
  const [deleteInvoicePassword, setDeleteInvoicePassword] = useState("");

  // Bulk delete dialog state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Delete all logs dialog state
  const [deleteAllLogsOpen, setDeleteAllLogsOpen] = useState(false);
  const [deleteAllLogsPassword, setDeleteAllLogsPassword] = useState("");

  // Queries
  const { data: stats, isLoading: loadingStats } = trpc.admin.getStats.useQuery();
  
  // Users with infinite query
  const {
    data: usersData,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
    refetch: refetchUsers,
  } = trpc.admin.getUsers.useInfiniteQuery(
    { limit: 50 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
      staleTime: 20000,
    }
  );

  const users = usersData?.pages.flatMap((page) => page.items) || [];

  const { data: companies, refetch: refetchCompanies } = trpc.company.listAll.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 20000,
  });
  const { data: invoices } = trpc.admin.getAllInvoices.useQuery();

  // Login logs with infinite query
  const {
    data: loginLogsData,
    fetchNextPage: fetchNextLogs,
    hasNextPage: hasNextLogs,
    isFetchingNextPage: isFetchingNextLogs,
  } = trpc.admin.getLoginLogs.useInfiniteQuery(
    {
      userId: loginLogsUserId,
      days: loginLogsDays,
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const loginLogs = loginLogsData?.pages.flatMap((page) => page.items) || [];

  // Intersection observer for users
  const usersObserver = useRef<IntersectionObserver>();
  const lastUserElementRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (isFetchingNextUsers) return;
      if (usersObserver.current) usersObserver.current.disconnect();
      usersObserver.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextUsers) {
          fetchNextUsers();
        }
      });
      if (node) usersObserver.current.observe(node);
    },
    [isFetchingNextUsers, hasNextUsers, fetchNextUsers]
  );

  // Intersection observer for login logs
  const logsObserver = useRef<IntersectionObserver>();
  const lastLogElementRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (isFetchingNextLogs) return;
      if (logsObserver.current) logsObserver.current.disconnect();
      logsObserver.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextLogs) {
          fetchNextLogs();
        }
      });
      if (node) logsObserver.current.observe(node);
    },
    [isFetchingNextLogs, hasNextLogs, fetchNextLogs]
  );

  // Mutations
  const createUserMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast({ title: "Użytkownik utworzony", description: "Nowy użytkownik został dodany" });
      setCreateUserOpen(false);
      setUserName("");
      setUserEmail("");
      setUserPassword("");
      setUserRole("user");
      refetchUsers();
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const createCompanyMutation = trpc.company.create.useMutation({
    onSuccess: () => {
      toast({ title: "Firma utworzona", description: "Nowa firma została dodana" });
      setCreateCompanyOpen(false);
      setCompanyName("");
      setCompanyNip("");
      setCompanyAddress("");
      refetchCompanies();
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast({ title: "Użytkownik usunięty", description: "Użytkownik został trwale usunięty" });
      setDeleteUserOpen(false);
      setDeleteUserId("");
      setDeleteUserName("");
      setDeleteUserPassword("");
      refetchUsers();
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = trpc.admin.deleteInvoice.useMutation({
    onSuccess: () => {
      toast({ 
        title: "Faktura usunięta", 
        description: "Faktura została trwale usunięta z bazy danych i serwera plików"
      });
      setDeleteInvoiceOpen(false);
      setDeleteInvoiceId("");
      setDeleteInvoiceNumber("");
      setDeleteInvoicePassword("");
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast({ title: "Hasło zmienione", description: "Hasło użytkownika zostało zresetowane" });
      setResetPasswordOpen(false);
      setResetUserId("");
      setResetUserName("");
      setNewPassword("");
      setConfirmPassword("");
      setAdminPassword("");
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const cleanLoginLogsMutation = trpc.admin.cleanOldLoginLogs.useMutation({
    onSuccess: () => {
      toast({ title: "Logi wyczyszczone", description: "Stare logi logowania (30+ dni) zostały usunięte" });
      window.location.reload(); // Refresh to update the logs list
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  const deleteAllLogsMutation = trpc.admin.deleteAllLoginLogs.useMutation({
    onSuccess: () => {
      toast({ title: "Logi usunięte", description: "Wszystkie logi logowania zostały usunięte" });
      setDeleteAllLogsOpen(false);
      setDeleteAllLogsPassword("");
      window.location.reload(); // Refresh to update the logs list
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
      setDeleteAllLogsPassword("");
    },
  });

  const handleResetPassword = (userId: string, userName: string) => {
    setResetUserId(userId);
    setResetUserName(userName);
    setResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetPasswordMutation.mutate({
      userId: resetUserId,
      newPassword,
      confirmPassword,
      adminPassword,
    });
  };

  // Role-based access control - after all hooks
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return <Unauthorized />;
  }

  // Sorting function
  const sortedInvoices = invoices ? [...invoices].sort((a, b) => {
    let compareA: number | string;
    let compareB: number | string;

    switch (sortBy) {
      case "date":
        compareA = new Date(a.createdAt).getTime();
        compareB = new Date(b.createdAt).getTime();
        break;
      case "number":
        compareA = a.invoiceNumber || "";
        compareB = b.invoiceNumber || "";
        break;
      case "company":
        compareA = a.companyName || "";
        compareB = b.companyName || "";
        break;
      case "user":
        compareA = a.userName || "";
        compareB = b.userName || "";
        break;
      case "status":
        compareA = a.status;
        compareB = b.status;
        break;
      default:
        return 0;
    }

    if (compareA < compareB) return sortOrder === "asc" ? -1 : 1;
    if (compareA > compareB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  }) : [];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <main className="container mx-auto px-4 py-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : stats?.users || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Baza danych</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "..." : `${stats?.databaseGB || 0} GB`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Postgres
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faktury</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loadingStats ? "..." : stats?.invoices || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Oczekujących: {stats?.pending || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zaakceptowane</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loadingStats ? "..." : stats?.accepted || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Odrzucone: {stats?.rejected || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pliki</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "..." : `${stats?.storageGB || 0} GB`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Magazyn plików MinIO
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Delete Button */}
        <div className="mb-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-destructive">Strefa Zagrożenia</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Masowe usuwanie faktur z bazy danych i MinIO
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Masowe usuwanie faktur
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different management sections */}
        <Tabs defaultValue="users" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="users">Użytkownicy</TabsTrigger>
              <TabsTrigger value="companies">Firmy</TabsTrigger>
              <TabsTrigger value="logs">Logi logowania</TabsTrigger>
            </TabsList>
          </div>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Zarządzanie użytkownikami</h2>
              <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj użytkownika
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nowy użytkownik</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Imię i nazwisko</Label>
                      <Input
                        id="name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Jan Kowalski"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="jan@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Hasło</Label>
                      <Input
                        id="password"
                        type="password"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Rola</Label>
                      <Select value={userRole} onValueChange={(v: string) => setUserRole(v as "user" | "accountant" | "admin")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Użytkownik</SelectItem>
                          <SelectItem value="accountant">Księgowy</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        createUserMutation.mutate({
                          name: userName,
                          email: userEmail,
                          password: userPassword,
                          role: userRole,
                        });
                      }}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Tworzenie...
                        </>
                      ) : (
                        "Utwórz użytkownika"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imię i nazwisko</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rola</TableHead>
                      <TableHead>Data utworzenia</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user, index) => {
                      const isLastElement = index === users.length - 1;
                      return (
                        <TableRow key={user.id} ref={isLastElement ? lastUserElementRef : null}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                user.role === "admin"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                  : user.role === "accountant"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {user.role === "admin"
                                ? "Administrator"
                                : user.role === "accountant"
                                ? "Księgowy"
                                : "Użytkownik"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleResetPassword(user.id, user.name)}
                                title="Resetuj hasło"
                              >
                                <KeyRound className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteUserId(user.id);
                                  setDeleteUserName(user.name);
                                  setDeleteUserOpen(true);
                                }}
                                title="Usuń użytkownika"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isFetchingNextUsers && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reset Password Dialog */}
          <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Resetuj hasło użytkownika</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Użytkownik</Label>
                  <Input value={resetUserName} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nowe hasło</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Minimum 6 znaków"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Potwierdź nowe hasło</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Powtórz nowe hasło"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Twoje hasło administratora</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    placeholder="Wprowadź swoje hasło"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Wymagane do potwierdzenia zmiany hasła
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setResetPasswordOpen(false)}
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetowanie...
                      </>
                    ) : (
                      "Resetuj hasło"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Zarządzanie firmami</h2>
              <Dialog open={createCompanyOpen} onOpenChange={setCreateCompanyOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj firmę
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nowa firma</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nazwa firmy</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Firma Sp. z o.o."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyNip">NIP</Label>
                      <Input
                        id="companyNip"
                        value={companyNip}
                        onChange={(e) => setCompanyNip(e.target.value)}
                        placeholder="1234567890"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Adres</Label>
                      <Input
                        id="companyAddress"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="ul. Przykładowa 1, 00-000 Warszawa"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => {
                        createCompanyMutation.mutate({
                          name: companyName,
                          nip: companyNip,
                          address: companyAddress,
                        });
                      }}
                      disabled={createCompanyMutation.isPending}
                    >
                      {createCompanyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Tworzenie...
                        </>
                      ) : (
                        "Utwórz firmę"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead>NIP</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies?.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>{company.name}</TableCell>
                        <TableCell>{company.nip || "-"}</TableCell>
                        <TableCell>{company.address || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              company.active
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {company.active ? "Aktywna" : "Nieaktywna"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          {/* Login Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div>
                      <Label>Okres</Label>
                      <Select 
                        value={loginLogsDays.toString()} 
                        onValueChange={(value) => setLoginLogsDays(parseInt(value))}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Ostatnie 7 dni</SelectItem>
                          <SelectItem value="14">Ostatnie 14 dni</SelectItem>
                          <SelectItem value="30">Ostatnie 30 dni</SelectItem>
                          <SelectItem value="60">Ostatnie 60 dni</SelectItem>
                          <SelectItem value="90">Ostatnie 90 dni</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Użytkownik</Label>
                      <Select 
                        value={loginLogsUserId || "all"} 
                        onValueChange={(value) => setLoginLogsUserId(value === "all" ? undefined : value)}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Wszyscy użytkownicy</SelectItem>
                          {users?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => cleanLoginLogsMutation.mutate()}
                      disabled={cleanLoginLogsMutation.isPending}
                      variant="outline"
                      size="sm"
                    >
                      {cleanLoginLogsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Czyszczenie...
                        </>
                      ) : (
                        "Usuń stare logi (30+ dni)"
                      )}
                    </Button>
                    <Button 
                      onClick={() => setDeleteAllLogsOpen(true)}
                      disabled={deleteAllLogsMutation.isPending}
                      variant="destructive"
                      size="sm"
                    >
                      Usuń wszystkie logi
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data i czas</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Użytkownik</TableHead>
                      <TableHead>Adres IP</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginLogs?.map((log, index) => {
                      const isLastElement = index === loginLogs.length - 1;
                      return (
                        <TableRow key={log.id} ref={isLastElement ? lastLogElementRef : null}>
                          <TableCell>
                            {formatDateTimeWithSeconds(log.createdAt)}
                          </TableCell>
                          <TableCell>{log.email}</TableCell>
                          <TableCell>{log.userName || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                log.success
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              }`}
                            >
                              {log.success ? "Sukces" : "Błąd"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isFetchingNextLogs && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {loginLogs && loginLogs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Brak logów logowania w wybranym okresie
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Potwierdzenie usunięcia użytkownika</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                Czy na pewno chcesz usunąć użytkownika <span className="font-semibold">{deleteUserName}</span>?
              </p>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Ta operacja jest NIEODWRACALNA. Użytkownik zostanie trwale usunięty.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deleteUserPassword">Twoje hasło administratora</Label>
                <Input
                  id="deleteUserPassword"
                  type="password"
                  placeholder="Wprowadź hasło aby potwierdzić"
                  value={deleteUserPassword}
                  onChange={(e) => setDeleteUserPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteUserOpen(false);
                    setDeleteUserPassword("");
                  }}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteUserPassword) {
                      toast({ 
                        title: "Błąd", 
                        description: "Hasło administratora jest wymagane", 
                        variant: "destructive" 
                      });
                      return;
                    }
                    deleteUserMutation.mutate({ 
                      id: deleteUserId,
                      adminPassword: deleteUserPassword 
                    });
                  }}
                  disabled={deleteUserMutation.isPending || !deleteUserPassword}
                >
                  {deleteUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Usuwanie...
                    </>
                  ) : (
                    "Usuń definitywnie"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Invoice Confirmation Dialog */}
        <Dialog open={deleteInvoiceOpen} onOpenChange={setDeleteInvoiceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Potwierdzenie usunięcia faktury</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                Czy na pewno chcesz usunąć fakturę <span className="font-semibold">{deleteInvoiceNumber}</span>?
              </p>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Ta operacja jest NIEODWRACALNA. Faktura i plik zostaną trwale usunięte z bazy danych i serwera plików.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deleteInvoicePassword">Twoje hasło administratora</Label>
                <Input
                  id="deleteInvoicePassword"
                  type="password"
                  placeholder="Wprowadź hasło aby potwierdzić"
                  value={deleteInvoicePassword}
                  onChange={(e) => setDeleteInvoicePassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteInvoiceOpen(false);
                    setDeleteInvoicePassword("");
                  }}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteInvoicePassword) {
                      toast({ 
                        title: "Błąd", 
                        description: "Hasło administratora jest wymagane", 
                        variant: "destructive" 
                      });
                      return;
                    }
                    deleteInvoiceMutation.mutate({ 
                      id: deleteInvoiceId,
                      adminPassword: deleteInvoicePassword 
                    });
                  }}
                  disabled={deleteInvoiceMutation.isPending || !deleteInvoicePassword}
                >
                  {deleteInvoiceMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Usuwanie...
                    </>
                  ) : (
                    "Usuń definitywnie"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Dialog */}
        <BulkDeleteInvoices
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
        />

        {/* Delete All Logs Dialog */}
        <Dialog open={deleteAllLogsOpen} onOpenChange={setDeleteAllLogsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń wszystkie logi logowania</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                Ta operacja usunie <strong>WSZYSTKIE</strong> logi logowania z bazy danych.
              </p>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Ta operacja jest NIEODWRACALNA.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deleteAllLogsPassword">Twoje hasło administratora</Label>
                <Input
                  id="deleteAllLogsPassword"
                  type="password"
                  placeholder="Wprowadź hasło aby potwierdzić"
                  value={deleteAllLogsPassword}
                  onChange={(e) => setDeleteAllLogsPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deleteAllLogsPassword && !deleteAllLogsMutation.isPending) {
                      deleteAllLogsMutation.mutate({ adminPassword: deleteAllLogsPassword });
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDeleteAllLogsOpen(false);
                    setDeleteAllLogsPassword("");
                  }} 
                  disabled={deleteAllLogsMutation.isPending}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteAllLogsMutation.mutate({ adminPassword: deleteAllLogsPassword })}
                  disabled={deleteAllLogsMutation.isPending || !deleteAllLogsPassword}
                >
                  {deleteAllLogsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Usuwanie...
                    </>
                  ) : (
                    "Usuń wszystkie logi"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
           Jeśli baza danych / plików jest za duża, skontaktuj się z administratorem lub projektantem systemu w celu oczyszczenia.
        </p>
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
