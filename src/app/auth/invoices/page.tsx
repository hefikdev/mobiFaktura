"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { InvoiceExportDialog } from "@/components/invoice-export-dialog";
import {
  Loader2,
  FileText,
  ExternalLink,
  Building2,
  User,
  Calendar,
  FileCheck,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Data fetching
  const { data: allInvoices, isLoading: loadingInvoices } = trpc.invoice.getAllInvoices.useQuery(
    undefined,
    { enabled: !!user && (user.role === "accountant" || user.role === "admin") }
  );
  
  const { data: companies } = trpc.company.list.useQuery();
  const { data: users } = trpc.admin.getUsers.useQuery(
    undefined,
    { enabled: !!user && (user.role === "admin" || user.role === "accountant") }
  );

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];

    let filtered = [...allInvoices];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.companyName?.toLowerCase().includes(query) ||
          inv.userName?.toLowerCase().includes(query) ||
          inv.ksefNumber?.toLowerCase().includes(query) ||
          inv.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((inv) => inv.status === filterStatus);
    }

    // Company filter
    if (filterCompany !== "all") {
      filtered = filtered.filter((inv) => inv.companyId === filterCompany);
    }

    return filtered;
  }, [allInvoices, searchQuery, filterStatus, filterCompany]);

  // Loading state
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Authorization check
  if (!user || (user.role !== "accountant" && user.role !== "admin")) {
    return <Unauthorized />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Oczekuje</span>;
      case "in_review":
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">W trakcie</span>;
      case "accepted":
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Zaakceptowana</span>;
      case "rejected":
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Odrzucona</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Faktury</h1>
              <p className="text-muted-foreground text-sm">Tylko do przeglądania a nie pracy na żywo, ryzyko wystąpienia niespójności danych.</p>
            </div>
          </div>

          <InvoiceExportDialog invoices={allInvoices} companies={companies} />
        </div>

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
            {loadingInvoices ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Brak faktur do wyświetlenia</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer faktury</TableHead>
                    <TableHead>KSeF</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Użytkownik</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data przesłania</TableHead>
                    <TableHead>Data decyzji</TableHead>
                    <TableHead>Księgowy</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/auth/invoice/${invoice.id}`)}
                    >
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invoice.ksefNumber || "-"}</TableCell>
                      <TableCell>{invoice.companyName}</TableCell>
                      <TableCell>{invoice.userName}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {invoice.reviewedAt
                          ? format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.reviewerName || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (invoice.ksefNumber) {
                              window.open(`https://www.gov.pl/web/kas/szukaj-faktury?q=${invoice.ksefNumber}`, "_blank");
                            } else {
                              toast({
                                title: "Brak numeru KSeF",
                                description: "Ta faktura nie ma przypisanego numeru KSeF",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={!invoice.ksefNumber}
                        >
                          Zobacz KSEF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {filteredInvoices.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Wyświetlono {filteredInvoices.length} z {allInvoices?.length || 0} faktur
          </div>
        )}
      </main>
    </div>
  );
}
