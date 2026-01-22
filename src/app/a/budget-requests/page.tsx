"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { SearchInput } from "@/components/search-input";
import { ExportButton } from "@/components/export-button";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import { AdvancedFilters, FilterConfig } from "@/components/advanced-filters";
import dynamic from "next/dynamic";
const BudgetRequestReviewDialog = dynamic(() => import("@/components/budget-request-review-dialog").then(m => m.BudgetRequestReviewDialog));
import { AdvanceDetailsDialog } from "@/components/advance-details-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Check, X, Filter, DollarSign, User, Calendar, Building2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { BudgetRequest } from "@/types";

type BudgetRequestStatus = "all" | "pending" | "approved" | "rejected";

export default function BudgetRequestsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<BudgetRequestStatus>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<BudgetRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"review" | "details">("details");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({});

  // Check user role
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Fetch companies for filter
  const { data: companies } = trpc.company.listAll.useQuery(undefined, {
    enabled: !!user && (user.role === "accountant" || user.role === "admin"),
  });

  const openAdvanceDialog = (advanceId: string) => {
    setSelectedAdvanceId(advanceId);
    setIsAdvanceDialogOpen(true);
  };


  // Fetch budget requests with infinite query
  const {
    data: requestsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = trpc.budgetRequest.getAll.useInfiniteQuery(
    {
      status: statusFilter,
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!user && (user.role === "accountant" || user.role === "admin"),
      refetchInterval: 10000, // Auto-refresh every 10 seconds
      refetchOnWindowFocus: true,
      staleTime: 2000,
    }
  );

  const allRequests = requestsData?.pages.flatMap((page) => page.items) || [];

  // Prepare company options for SearchableSelect
  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    if (!companies) return [{ value: "all", label: "Wszystkie firmy", searchableText: "wszystkie" }];
    return [
      { value: "all", label: "Wszystkie firmy", searchableText: "wszystkie" },
      ...companies.map((company) => ({
        value: company.id,
        label: company.name,
        searchableText: `${company.name} ${company.nip || ''} ${company.id}`.toLowerCase(),
      }))
    ];
  }, [companies]);

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
  ];

  // Filter requests based on search and company
  const filteredRequests = useMemo(() => {
    if (!allRequests) return [];
    
    let filtered = [...allRequests];

    // Company filter
    if (companyFilter && companyFilter !== "all") {
      filtered = filtered.filter((req) => req.companyId === companyFilter);
    }

    // Enhanced search filter - includes UUIDs, emails, amounts
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.id.toLowerCase().includes(query) || // Request UUID
          req.userId.toLowerCase().includes(query) || // User UUID
          req.companyId?.toLowerCase().includes(query) || // Company UUID
          req.userName.toLowerCase().includes(query) ||
          req.userEmail.toLowerCase().includes(query) ||
          req.justification.toLowerCase().includes(query) ||
          req.requestedAmount?.toString().includes(query) || // Amount
          req.currentBalanceAtRequest?.toString().includes(query) || // Balance
          (req.companyName && req.companyName.toLowerCase().includes(query))
      );
    }

    // Advanced filters
    if (advancedFilters.dateFrom) {
      const fromDate = new Date(advancedFilters.dateFrom);
      filtered = filtered.filter((req) => new Date(req.createdAt) >= fromDate);
    }
    if (advancedFilters.dateTo) {
      const toDate = new Date(advancedFilters.dateTo);
      filtered = filtered.filter((req) => new Date(req.createdAt) <= toDate);
    }
    if (advancedFilters.amountMin) {
      filtered = filtered.filter((req) => (req.requestedAmount || 0) >= parseFloat(advancedFilters.amountMin));
    }
    if (advancedFilters.amountMax) {
      filtered = filtered.filter((req) => (req.requestedAmount || 0) <= parseFloat(advancedFilters.amountMax));
    }

    // Sort by date descending (newest first) - same as invoices page
    filtered.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [allRequests, searchQuery, companyFilter, advancedFilters]);

  const { data: pendingCount } = trpc.budgetRequest.getPendingCount.useQuery();

  // Ref for infinite scroll
  const observer = useRef<IntersectionObserver>();
  const lastRequestElementRef = useCallback(
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

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  // Handle openRequest URL parameter
  useEffect(() => {
    const openRequestId = searchParams.get("openRequest");
    if (openRequestId && allRequests.length > 0 && !isDialogOpen) {
      const request = allRequests.find(req => req.id === openRequestId);
      if (request) {
        setSelectedRequest(request);
        setDialogMode("details");
        setIsDialogOpen(true);
      }
    }
  }, [searchParams, allRequests, isDialogOpen]);

  // Review mutation
  const reviewMutation = trpc.budgetRequest.review.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
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

  const openReviewDialog = (request: BudgetRequest, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setRejectionReason("");
    setDialogMode("review");
    setIsDialogOpen(true);
  };

  const handleReview = () => {
    if (!selectedRequest) return;
    if (reviewAction === "reject" && (!rejectionReason || rejectionReason.trim().length < 10)) {
      toast({
        title: "Błąd",
        description: "Powód odrzucenia musi zawierać minimum 10 znaków",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      requestId: selectedRequest.id,
      action: reviewAction,
      rejectionReason: reviewAction === "reject" ? rejectionReason : undefined,
    });
  };

  const getStatusBadge = (status: string, request?: BudgetRequest) => {
    const handleStatusClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (request) {
        setSelectedRequest(request);
        setDialogMode("details");
        setIsDialogOpen(true);
      }
    };

    // Map budget request statuses to invoice status badge types for consistent color coding
    const badgeStatus = 
      status === "approved" ? "accepted" : 
      status === "rejected" ? "rejected" : 
      "pending";

    if (status === "pending") {
      return <InvoiceStatusBadge status={badgeStatus} variant="compact" />;
    }

    return (
      <div className="cursor-pointer" onClick={handleStatusClick}>
        <InvoiceStatusBadge status={badgeStatus} variant="compact" />
      </div>
    );
  };

  if (userLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Prośby o zwiększenie budżetu</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              data={filteredRequests}
              filename={`prosBy-o-budzet-${format(new Date(), "yyyy-MM-dd")}`}
              columns={[
                { key: "userName", header: "Użytkownik" },
                { key: "companyName", header: "Firma", formatter: (val: unknown): string => (val ? String(val) : "-") },
                { key: "currentBalanceAtRequest", header: "Saldo (PLN)", formatter: (val: unknown) => typeof val === "number" ? val.toFixed(2) : "0.00" },
                { key: "requestedAmount", header: "Kwota (PLN)", formatter: (val: unknown) => typeof val === "number" ? val.toFixed(2) : "0.00" },
                { key: "status", header: "Status", formatter: (val: unknown) => {
                  const statusLabels: Record<string, string> = {
                    pending: "Oczekujące",
                    approved: "Zatwierdzone",
                    rejected: "Odrzucone"
                  };
                  return statusLabels[String(val)] || String(val);
                }},
                { key: "justification", header: "Uzasadnienie" },
                { key: "createdAt", header: "Złożono", formatter: (val: unknown) => {
                  const date = val instanceof Date ? val : new Date(String(val));
                  return format(date, "dd.MM.yyyy HH:mm", { locale: pl });
                }},
                { key: "reviewedAt", header: "Decyzja", formatter: (val: unknown) => {
                  if (!val) return "-";
                  const date = val instanceof Date ? val : new Date(String(val));
                  return format(date, "dd.MM.yyyy HH:mm", { locale: pl });
                }},
                { key: "rejectionReason", header: "Powód odrzucenia", formatter: (val: unknown): string => (val ? String(val) : "-") },
              ]}
              label="Eksportuj"
              pdfTitle="Prośby o zwiększenie budżetu - Wszyscy użytkownicy"
              pdfSubtitle={`Wygenerowano: ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: pl })}`}
            />
          </div>
        </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap">
            <div className="flex gap-2 items-center flex-1 min-w-[200px]">
              <AdvancedFilters
                filters={advancedFilterConfig}
                values={advancedFilters}
                onChange={setAdvancedFilters}
                onReset={() => setAdvancedFilters({})}
              />
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                className="w-full flex-1"
                placeholder="Szukaj"
                showIcon
              />
            </div>
            <div className="flex flex-row items-center gap-4">
              <Select value={statusFilter} onValueChange={(value: BudgetRequestStatus) => setStatusFilter(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="pending">Oczekujące</SelectItem>
                  <SelectItem value="approved">Zatwierdzone</SelectItem>
                  <SelectItem value="rejected">Odrzucone</SelectItem>
                </SelectContent>
              </Select>
              <SearchableSelect
                options={companyOptions}
                value={companyFilter}
                onValueChange={setCompanyFilter}
                placeholder="Wszystkie firmy"
                emptyText="Nie znaleziono firm"
                className="w-[200px]"
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
                  <TableHead>Firma</TableHead>
                  <TableHead>Stan salda przy złożeniu</TableHead>
                  <TableHead>Wnioskowana kwota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data złożenia</TableHead>
                  <TableHead>Data decyzji</TableHead>
                  <TableHead>Uzasadnienie</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  <>
                    {filteredRequests.map((request, index) => {
                      const isLastElement = index === filteredRequests.length - 1;
                      const handleRowClick = () => {
                        setSelectedRequest(request);
                        setDialogMode("details");
                        setIsDialogOpen(true);
                      };
                      return (
                        <TableRow 
                          key={request.id} 
                          ref={isLastElement ? lastRequestElementRef : null}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={handleRowClick}
                        >
                          <TableCell>
                            <div className="font-medium">{request.userName}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {request.companyName || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${
                              (request.currentBalanceAtRequest ?? 0) > 0 ? "text-green-600" : 
                              (request.currentBalanceAtRequest ?? 0) < 0 ? "text-red-600" : "text-gray-600"
                            }`}>
                              {(request.currentBalanceAtRequest ?? 0).toFixed(2)} PLN
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-blue-600">
                              +{(request.requestedAmount ?? 0).toFixed(2)} PLN
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status, request)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(request.createdAt), "dd MMM yyyy HH:mm", { locale: pl })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {request.reviewedAt ? format(new Date(request.reviewedAt), "dd MMM yyyy HH:mm", { locale: pl }) : "-"}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={request.justification}>
                              {request.justification}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {request.status === "pending" ? (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700 text-white dark:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(request, "approve");
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Zatwierdź
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(request, "reject");
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Odrzuć
                                </Button>
                              </div>
                            ) : request.status === "approved" ? (
                              <div className="flex gap-2 justify-end items-center">
                                {request.advanceId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAdvanceDialog(request.advanceId as string);
                                    }}
                                  >
                                    Zaliczka
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isFetchingNextPage && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Nie znaleziono próśb" : (statusFilter === "pending" ? "Brak oczekujących próśb" : "Brak próśb")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {filteredRequests.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
          Wyświetlono {filteredRequests.length} z {allRequests.length} próśb
        </div>
      )}

      {/* Unified Budget Request Dialog */}
      <BudgetRequestReviewDialog
        request={selectedRequest}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
          setSelectedRequest(null);
          setRejectionReason("");
          refetch();
        }}
        mode={dialogMode}
        initialAction={reviewAction}
      />

      <AdvanceDetailsDialog
        advanceId={selectedAdvanceId}
        open={isAdvanceDialogOpen}
        onOpenChange={setIsAdvanceDialogOpen}
        onSuccess={() => refetch()}
      />

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
