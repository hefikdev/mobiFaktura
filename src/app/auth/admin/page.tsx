"use client";

import { useState } from "react";
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

  // Export states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportPeriod, setExportPeriod] = useState<"last30" | "specificMonth" | "last3Months" | "last6Months" | "thisYear" | "all">("last30");
  const [exportMonth, setExportMonth] = useState(new Date().getMonth().toString());
  const [exportYear, setExportYear] = useState(new Date().getFullYear().toString());
  const [exportCompany, setExportCompany] = useState<string>("all");
  const [exportStatus, setExportStatus] = useState<string>("all");

  // Sorting states
  const [sortBy, setSortBy] = useState<"date" | "number" | "company" | "user" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  // Queries
  const { data: stats, isLoading: loadingStats } = trpc.admin.getStats.useQuery();
  const { data: users, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 20000, // Consider data fresh for 20 seconds
  });
  const { data: companies, refetch: refetchCompanies } = trpc.company.listAll.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 20000,
  });
  const { data: invoices } = trpc.admin.getAllInvoices.useQuery();

  // Login logs query
  const { data: loginLogs } = trpc.admin.getLoginLogs.useQuery({
    userId: loginLogsUserId,
    days: loginLogsDays,
  });

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
      toast({ title: "Użytkownik usunięty" });
      refetchUsers();
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

  const handleExport = () => {
    // Calculate date range based on selected period
    const now = new Date();
    let startDate: Date | undefined;
    
    switch (exportPeriod) {
      case "last30":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "specificMonth":
        const month = parseInt(exportMonth);
        const year = parseInt(exportYear);
        startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        break;
      case "last3Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case "last6Months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case "thisYear":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "all":
        startDate = undefined;
        break;
    }

    // Filter invoices by date, company, and status
    const filteredInvoices = invoices?.filter(inv => {
      const isReviewed = inv.status === "accepted" || inv.status === "rejected";
      if (!isReviewed) return false;
      
      // Filter by company
      if (exportCompany !== "all" && inv.companyId !== exportCompany) return false;
      
      // Filter by status
      if (exportStatus !== "all" && inv.status !== exportStatus) return false;
      
      // Filter by date
      if (!startDate) return true;
      
      const invDate = new Date(inv.reviewedAt || inv.createdAt);
      
      if (exportPeriod === "specificMonth") {
        const month = parseInt(exportMonth);
        const year = parseInt(exportYear);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        return invDate >= startDate && invDate <= endDate;
      }
      
      return invDate >= startDate;
    }) || [];

    // Convert to table format
    const headers = ["Data przesłania", "Data decyzji", "Numer faktury", "Użytkownik", "Firma", "Status", "Księgowy", "Opis"];
    const rows = filteredInvoices.map(inv => [
      inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("pl-PL") : "",
      inv.reviewedAt ? new Date(inv.reviewedAt).toLocaleDateString("pl-PL") : "",
      inv.invoiceNumber || "",
      inv.userName || "",
      inv.companyName || "",
      inv.status === "accepted" ? "Zaakceptowana" : "Odrzucona",
      inv.reviewerName || "",
      inv.description || ""
    ]);

    if (exportFormat === "csv") {
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Download CSV
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // PDF Export using jsPDF
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text("Raport Faktur", 14, 15);
      
      // Add metadata
      doc.setFontSize(10);
      doc.text(`Data: ${new Date().toLocaleDateString("pl-PL")}`, 14, 22);
      let periodText = "Okres: ";
      switch (exportPeriod) {
        case "last30": periodText += "Ostatnie 30 dni"; break;
        case "specificMonth": periodText += `${parseInt(exportMonth) + 1}/${exportYear}`; break;
        case "last3Months": periodText += "Ostatnie 3 miesiące"; break;
        case "last6Months": periodText += "Ostatnie 6 miesięcy"; break;
        case "thisYear": periodText += "Bieżący rok"; break;
        case "all": periodText += "Wszystkie"; break;
      }
      doc.text(periodText, 14, 28);
      if (exportCompany !== "all") {
        const companyName = companies?.find(c => c.id === exportCompany)?.name || "";
        doc.text(`Firma: ${companyName}`, 14, 34);
      }
      if (exportStatus !== "all") {
        doc.text(`Status: ${exportStatus === "accepted" ? "Zaakceptowane" : "Odrzucone"}`, 14, exportCompany !== "all" ? 40 : 34);
      }
      doc.text(`Liczba faktur: ${filteredInvoices.length}`, 14, exportCompany !== "all" && exportStatus !== "all" ? 46 : exportCompany !== "all" || exportStatus !== "all" ? 40 : 34);
      
      // Add table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: exportCompany !== "all" && exportStatus !== "all" ? 52 : exportCompany !== "all" || exportStatus !== "all" ? 46 : 40,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 22 },
          6: { cellWidth: 22 },
          7: { cellWidth: "auto" }
        },
        didParseCell: function(data) {
          // Color status column
          if (data.column.index === 5 && data.section === "body") {
            if (data.cell.text[0] === "Zaakceptowana") {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.text[0] === "Odrzucona") {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });
      
      // Download PDF
      doc.save(`faktury_${exportPeriod}_${new Date().toISOString().split("T")[0]}.pdf`);
    }

    setExportDialogOpen(false);
    toast({ title: "Wyeksportowano", description: `Wyeksportowano ${filteredInvoices.length} faktur` });
  };

  // Sorting function
  const sortedInvoices = invoices ? [...invoices].sort((a, b) => {
    let compareA: any;
    let compareB: any;

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

  // Filter invoices by search query, company, and status
  const filteredInvoices = sortedInvoices.filter(inv => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (inv.invoiceNumber?.toLowerCase().includes(query)) ||
        (inv.userName?.toLowerCase().includes(query)) ||
        (inv.companyName?.toLowerCase().includes(query)) ||
        (inv.description?.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }
    
    // Company filter
    if (filterCompany !== "all" && inv.companyId !== filterCompany) {
      return false;
    }
    
    // Status filter
    if (filterStatus !== "all" && inv.status !== filterStatus) {
      return false;
    }
    
    return true;
  });

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

        {/* Tabs for different management sections */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="users">Użytkownicy</TabsTrigger>
              <TabsTrigger value="companies">Firmy</TabsTrigger>
              <TabsTrigger value="invoices">Faktury</TabsTrigger>
              <TabsTrigger value="logs">Logi logowania</TabsTrigger>
            </TabsList>
            
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Eksportuj faktury
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Eksport faktur</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                      <SelectTrigger id="format">
                        <SelectValue placeholder="Wybierz format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV (Excel)</SelectItem>
                        <SelectItem value="pdf">PDF (do druku)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period">Okres</Label>
                    <Select value={exportPeriod} onValueChange={(value: any) => setExportPeriod(value)}>
                      <SelectTrigger id="period">
                        <SelectValue placeholder="Wybierz okres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last30">Ostatnie 30 dni</SelectItem>
                        <SelectItem value="specificMonth">Wybrany miesiąc</SelectItem>
                        <SelectItem value="last3Months">Ostatnie 3 miesiące</SelectItem>
                        <SelectItem value="last6Months">Ostatnie 6 miesięcy</SelectItem>
                        <SelectItem value="thisYear">Ten rok</SelectItem>
                        <SelectItem value="all">Wszystkie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {exportPeriod === "specificMonth" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="month">Miesiąc</Label>
                        <Select value={exportMonth} onValueChange={setExportMonth}>
                          <SelectTrigger id="month">
                            <SelectValue placeholder="Miesiąc" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Styczeń</SelectItem>
                            <SelectItem value="1">Luty</SelectItem>
                            <SelectItem value="2">Marzec</SelectItem>
                            <SelectItem value="3">Kwiecień</SelectItem>
                            <SelectItem value="4">Maj</SelectItem>
                            <SelectItem value="5">Czerwiec</SelectItem>
                            <SelectItem value="6">Lipiec</SelectItem>
                            <SelectItem value="7">Sierpień</SelectItem>
                            <SelectItem value="8">Wrzesień</SelectItem>
                            <SelectItem value="9">Październik</SelectItem>
                            <SelectItem value="10">Listopad</SelectItem>
                            <SelectItem value="11">Grudzień</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="year">Rok</Label>
                        <Select value={exportYear} onValueChange={setExportYear}>
                          <SelectTrigger id="year">
                            <SelectValue placeholder="Rok" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="exportCompany">Firma (opcjonalne)</Label>
                    <Select value={exportCompany} onValueChange={setExportCompany}>
                      <SelectTrigger id="exportCompany">
                        <SelectValue placeholder="Wszystkie firmy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie firmy</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exportStatus">Status (opcjonalny)</Label>
                    <Select value={exportStatus} onValueChange={setExportStatus}>
                      <SelectTrigger id="exportStatus">
                        <SelectValue placeholder="Wszystkie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        <SelectItem value="accepted">Zaakceptowane</SelectItem>
                        <SelectItem value="rejected">Odrzucone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleExport} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Eksportuj do {exportFormat.toUpperCase()}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                      <Select value={userRole} onValueChange={(v: any) => setUserRole(v)}>
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
                    {users?.map((user) => (
                      <TableRow key={user.id}>
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
                          {new Date(user.createdAt).toLocaleDateString("pl-PL")}
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
                    ))}
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
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                {/* Search and Filter Controls */}
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Szukaj faktur..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Select value={filterCompany} onValueChange={setFilterCompany}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Wszystkie firmy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie firmy</SelectItem>
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Wszystkie statusy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie</SelectItem>
                      <SelectItem value="pending">Oczekuje</SelectItem>
                      <SelectItem value="in_review">W trakcie</SelectItem>
                      <SelectItem value="accepted">Zaakceptowane</SelectItem>
                      <SelectItem value="rejected">Odrzucone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numer</TableHead>
                      <TableHead>Użytkownik</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Data przesłania</TableHead>
                      <TableHead>Data decyzji</TableHead>
                      <TableHead>Księgowy</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices?.map((invoice) => (
                      <TableRow 
                        key={invoice.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/auth/invoice/${invoice.id}`)}
                      >
                        <TableCell>{invoice.invoiceNumber || "-"}</TableCell>
                        <TableCell>{invoice.userName}</TableCell>
                        <TableCell>{invoice.companyName}</TableCell>
                        <TableCell>
                          {new Date(invoice.createdAt).toLocaleDateString("pl-PL", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {invoice.reviewedAt 
                            ? new Date(invoice.reviewedAt).toLocaleDateString("pl-PL", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>{invoice.reviewerName || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              invoice.status === "accepted"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : invoice.status === "rejected"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : invoice.status === "in_review"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }`}
                          >
                            {invoice.status === "accepted"
                              ? "Zaakceptowana"
                              : invoice.status === "rejected"
                              ? "Odrzucona"
                              : invoice.status === "in_review"
                              ? "W trakcie"
                              : "Oczekuje"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Login Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex gap-4 mt-4">
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
                    {loginLogs?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {new Date(log.createdAt).toLocaleString("pl-PL", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
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
                    ))}
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
              <DialogTitle>Potwierdzenie usunięcia</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm">
                Czy na pewno chcesz usunąć użytkownika <span className="font-semibold">{deleteUserName}</span>?
              </p>
              <p className="text-sm text-muted-foreground">
                Ta operacja jest nieodwracalna.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteUserOpen(false)}
                >
                  Anuluj
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteUserMutation.mutate({ id: deleteUserId });
                    setDeleteUserOpen(false);
                  }}
                  disabled={deleteUserMutation.isPending}
                >
                  Usuń
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
           Jeśli baza danych / plików jest za duża, skontaktuj się z administratorem lub projektantem systemu w celu oczyszczenia.
        </p>
        <div className="text-center mt-6">
          <Footer />
        </div>
      </main>
    </div>
  );
}
