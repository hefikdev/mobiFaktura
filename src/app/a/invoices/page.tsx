"use client";

import { useState, useMemo, useRef, useCallback, useEffect, Suspense } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/search-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
const KsefInvoicePopup = dynamic(() => import("@/components/ksef-invoice-popup").then(m => m.KsefInvoicePopup));
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
const InvoiceExportDialog = dynamic(() => import("@/components/invoice-export-dialog").then(m => m.InvoiceExportDialog));
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceTypeBadge } from "@/components/invoice-type-badge";
import {
  Loader2,
  FileText,
  ExternalLink,
  Building2,
  User,
  Calendar,
  FileCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { SectionLoader } from "@/components/section-loader";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useRouter } from "next/navigation";

// Type for enriched invoice data from getAllInvoices query
type EnrichedInvoice = {
  id: string;
  invoiceNumber: string;
  companyId: string;
  userId: string;
  ksefNumber: string | null;
  kwota: string | null; // Changed from 'amount' to 'kwota' to match schema
  status: string;
  description: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  userName: string;
  userEmail: string;
  companyName: string;
  reviewerName: string | null;
  invoiceType: "einvoice" | "paragon" | "correction" | null;
  originalInvoiceId: string | null;
  correctionAmount: string | null;
  budgetRequest: {
    id: string;
    requestedAmount: number;
    status: string;
  } | null;
};

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");

  // Delete invoice dialog states
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState("");
  const [deleteInvoiceNumber, setDeleteInvoiceNumber] = useState("");
  const [deleteInvoicePassword, setDeleteInvoicePassword] = useState("");

  // KSeF Invoice Popup states
  const [ksefPopupOpen, setKsefPopupOpen] = useState(false);
  const [ksefPopupNumber, setKsefPopupNumber] = useState<string | null>(null);
  const [ksefPopupInvoiceId, setKsefPopupInvoiceId] = useState<string | null>(null);

  // Data fetching with infinite query
  const {
    data: invoicesData,
    isLoading: loadingInvoices,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchInvoices,
  } = trpc.invoice.getAllInvoices.useInfiniteQuery(
    { limit: 100 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
      refetchInterval: 10000, // Auto-refresh every 10 seconds
      refetchOnWindowFocus: true,
      staleTime: 2000,
    }
  );

  const allInvoices = (invoicesData?.pages.flatMap((page) => page.items) || []) as EnrichedInvoice[];
  
  const { data: companies } = trpc.company.list.useQuery();
  const { data: usersData } = trpc.admin.getUsers.useQuery(
    undefined,
    { enabled: !!user && (user.role === "admin" || user.role === "accountant") }
  );



  // Refetch data when page becomes visible (e.g., when navigating back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetchInvoices();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also refetch when the window regains focus
    const handleFocus = () => {
      refetchInvoices();
    };
    
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchInvoices]);

  // Delete invoice mutation (accountants and admins)
  const deleteInvoiceMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      toast({ 
        title: "Faktura usunięta", 
        description: "Faktura została trwale usunięta z bazy danych i serwera plików"
      });
      setDeleteInvoiceOpen(false);
      setDeleteInvoiceId("");
      setDeleteInvoiceNumber("");
      setDeleteInvoicePassword("");
      refetchInvoices();
    },
    onError: (error) => {
      toast({ title: "Błąd", description: error.message, variant: "destructive" });
    },
  });

  // Get all users for the filter
  const allUsers = usersData?.items || [];

  // Ref for infinite scroll
  const observer = useRef<IntersectionObserver>();
  const lastInvoiceElementRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (loadingInvoices || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loadingInvoices, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];

    let filtered: EnrichedInvoice[] = [...allInvoices];

    // Exclude correction invoices (they have their own page /korekty)
    filtered = filtered.filter((inv) => inv.invoiceType !== "correction");

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
    if (filterStatus !== "__all__") {
      filtered = filtered.filter((inv) => inv.status === filterStatus);
    }

    // Company filter
    if (filterCompany !== "__all__") {
      filtered = filtered.filter((inv) => inv.companyId === filterCompany);
    }

    return filtered;
  }, [allInvoices, searchQuery, filterStatus, filterCompany]);


  // Loading state for user (auth) only blocks content, not whole page
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
      {/* KSeF Invoice Popup */}
      <KsefInvoicePopup
        ksefNumber={ksefPopupNumber || ""}
        invoiceId={ksefPopupInvoiceId}
        open={!!ksefPopupOpen && !!ksefPopupNumber}
        onOpenChange={(open) => {
          setKsefPopupOpen(open);
          if (!open) {
            setKsefPopupNumber(null);
            setKsefPopupInvoiceId(null);
          }
        }}
      />

      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Faktury</h1>
            </div>
          </div>

          <div className="hidden md:block">
            <InvoiceExportDialog invoices={allInvoices} companies={companies} users={allUsers} />
          </div>
        </div>

        <Card>
          <CardHeader>
            {/* Search and Filter Controls */}
            <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                />
              </div>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                        <SelectTrigger className="w-full sm:w-[200px]">
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
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Wszystkie statusy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Wszystkie</SelectItem>
                          <SelectItem value="pending">Oczekuje</SelectItem>
                          <SelectItem value="in_review">W trakcie</SelectItem>
                          <SelectItem value="accepted">Zaakceptowane</SelectItem>
                          <SelectItem value="rejected">Odrzucone</SelectItem>
                          <SelectItem value="re_review">Ponowna weryfikacja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Suspense fallback={<SectionLoader className="p-8" />}>
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
                        <>
                          {/* Mobile View - Cards */}
                          <div className="md:hidden divide-y">
                            {filteredInvoices.map((invoice, index) => {
                              const isLastElement = index === filteredInvoices.length - 1;
                              return (
                                <div
                                  key={invoice.id}
                                  ref={isLastElement ? lastInvoiceElementRef : null}
                                  className="p-4 hover:bg-muted/50 cursor-pointer"
                                  onClick={() => router.push(`/a/invoice/${invoice.id}`)}
                                >
                                  <div className="flex items-start gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="font-semibold truncate">{invoice.invoiceNumber || "Brak numeru"}</div>
                                        <div className="flex gap-1">
                                          <InvoiceTypeBadge type={(invoice.invoiceType || "einvoice") as "einvoice" | "receipt" | "correction"} variant="compact" />
                                          <InvoiceStatusBadge status={invoice.status} variant="compact" />
                                        </div>
                                      </div>
                                      <div className="space-y-1 text-sm text-muted-foreground">
                                        {invoice.companyName && (
                                          <div className="flex items-center gap-2">
                                            <Building2 className="h-3 w-3" />
                                            <span className="truncate">{invoice.companyName}</span>
                                          </div>
                                        )}

                                        {invoice.userName && (
                                          <div className="flex items-center gap-2">
                                            <User className="h-3 w-3" />
                                            <span className="truncate">{invoice.userName}</span>
                                          </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                          <Calendar className="h-3 w-3" />
                                          <span className="truncate">{format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</span>
                                        </div>

                                        {invoice.reviewerName && (
                                          <div className="flex items-center gap-2">
                                            <FileCheck className="h-3 w-3" />
                                            <span className="truncate">{invoice.reviewerName}</span>
                                            {invoice.reviewedAt && (
                                              <span className="text-xs">({format(new Date(invoice.reviewedAt), "dd.MM HH:mm", { locale: pl })})</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 mt-3">
                                    {invoice.ksefNumber && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setKsefPopupNumber(invoice.ksefNumber);
                                          setKsefPopupInvoiceId(invoice.id);
                                          setKsefPopupOpen(true);
                                        }}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        KSeF
                                      </Button>
                                    )}
                                    {user?.role === "admin" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteInvoiceId(invoice.id);
                                          setDeleteInvoiceNumber(invoice.invoiceNumber || "");
                                          setDeleteInvoiceOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1 text-red-600" />
                                        Usuń
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Desktop View - Table */}

                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Numer faktury</TableHead>
                                  <TableHead>Typ</TableHead>
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
                                {filteredInvoices.map((invoice, index) => {
                                  const isLastElement = index === filteredInvoices.length - 1;
                                  return (
                                    <TableRow
                                      key={invoice.id}
                                      ref={isLastElement ? lastInvoiceElementRef : null}
                                      className="cursor-pointer hover:bg-muted/50"
                                      onClick={() => router.push(`/a/invoice/${invoice.id}`)}
                                    >
                                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                      <TableCell><InvoiceTypeBadge type={(invoice.invoiceType || "einvoice") as "einvoice" | "receipt" | "correction"} variant="compact" /></TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{invoice.ksefNumber || "-"}</TableCell>
                                      <TableCell>{invoice.companyName}</TableCell>
                                      <TableCell>{invoice.userName}</TableCell>
                                      <TableCell><InvoiceStatusBadge status={invoice.status} variant="compact" /></TableCell>
                                      <TableCell className="text-sm">{format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</TableCell>
                                      <TableCell className="text-sm">{invoice.reviewedAt ? format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl }) : "-"}</TableCell>
                                      <TableCell className="text-sm">{invoice.reviewerName || "-"}</TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (invoice.ksefNumber) {
                                                setKsefPopupNumber(invoice.ksefNumber);
                                                setKsefPopupInvoiceId(invoice.id);
                                                setKsefPopupOpen(true);
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
                                            Weryfikuj
                                          </Button>
                                          {user?.role === "admin" && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteInvoiceId(invoice.id);
                                                setDeleteInvoiceNumber(invoice.invoiceNumber || "");
                                                setDeleteInvoiceOpen(true);
                                              }}
                                              title="Usuń fakturę (tylko admin)"
                                            >
                                              <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                {isFetchingNextPage && (
                                  <TableRow>
                                    <TableCell colSpan={9} className="text-center py-4">
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
                  
                  {isFetchingNextPage && (<div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" /></div>)}

          </CardContent>
        </Card>

        {filteredInvoices.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
            Wyświetlono {filteredInvoices.length} z {allInvoices?.length || 0} faktur
          </div>
        )}

        {/* Delete Invoice Confirmation Dialog */}
        <Dialog open={deleteInvoiceOpen} onOpenChange={setDeleteInvoiceOpen}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Potwierdzenie usunięcia faktury</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[calc(90vh-150px)] overflow-y-auto pr-2">
              <p className="text-sm">
                Czy na pewno chcesz usunąć fakturę <span className="font-semibold">{deleteInvoiceNumber}</span>?
              </p>
              <p className="text-sm font-semibold text-destructive">
                ⚠️ Ta operacja jest NIEODWRACALNA. Faktura i plik zostaną trwale usunięte z bazy danych i serwera plików.
              </p>
              <div className="space-y-2">
                <Label htmlFor="deleteInvoicePassword">Twoje hasło</Label>
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
                        description: "Hasło jest wymagane", 
                        variant: "destructive" 
                      });
                      return;
                    }
                    deleteInvoiceMutation.mutate({ 
                      id: deleteInvoiceId,
                      password: deleteInvoicePassword 
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
