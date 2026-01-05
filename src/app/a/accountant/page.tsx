"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { InvoiceListItem } from "@/components/invoice-list-item";
import dynamic from "next/dynamic";
const BudgetRequestReviewDialog = dynamic(() => import("@/components/budget-request-review-dialog").then(m => m.BudgetRequestReviewDialog));
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Unauthorized } from "@/components/unauthorized";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowUpDown,
  Clock,
  CheckCircle,
  Wallet,
  DollarSign,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { BudgetRequest } from "@/types";

export default function AccountantPage() {
  const router = useRouter();
  const [lastInvoiceSync, setLastInvoiceSync] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "accepted" | "rejected" | "re_review">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedBudgetRequest, setSelectedBudgetRequest] = useState<BudgetRequest | null>(null);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);

  // Refs for infinite scroll
  const pendingObserver = useRef<IntersectionObserver>();
  const reviewedObserver = useRef<IntersectionObserver>();
  const pendingLoadMoreRef = useRef<HTMLDivElement>(null);
  const reviewedLoadMoreRef = useRef<HTMLDivElement>(null);

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Pending invoices with infinite query
  const {
    data: pendingData,
    isLoading: loadingPending,
    fetchNextPage: fetchNextPending,
    hasNextPage: hasNextPending,
    isFetchingNextPage: isFetchingNextPending,
    dataUpdatedAt: pendingUpdatedAt,
  } = trpc.invoice.pendingInvoices.useInfiniteQuery(
    { limit: 50 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 2000, // 2 seconds - fast enough for heartbeat monitoring
      refetchOnWindowFocus: true,
      staleTime: 0,
    }
  );

  // Reviewed invoices with infinite query (only 10 first)
  const {
    data: reviewedData,
    isLoading: loadingReviewed,
    fetchNextPage: fetchNextReviewed,
    hasNextPage: hasNextReviewed,
    isFetchingNextPage: isFetchingNextReviewed,
  } = trpc.invoice.reviewedInvoices.useInfiniteQuery(
    { limit: 10 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 3000, // 3 seconds - balanced for performance
      refetchOnWindowFocus: true,
      staleTime: 20000,
    }
  );
  
  // Budget requests - pending
  const { data: budgetRequestsData, isLoading: loadingBudgetRequests, refetch: refetchBudgetRequests } = trpc.budgetRequest.getAll.useQuery(
    { status: "pending", limit: 10, cursor: 0 },
    {
      refetchInterval: 10000, // 10 seconds - prevent rate limiting
      refetchOnWindowFocus: true,
      staleTime: 20000,
    }
  );

  // Budget requests - reviewed (approved/rejected)
  const { data: reviewedBudgetRequestsData, refetch: refetchReviewedBudgetRequests } = trpc.budgetRequest.getAll.useQuery(
    { status: "all", limit: 10, cursor: 0 },
    {
      refetchInterval: 10000, // 10 seconds - prevent rate limiting
      refetchOnWindowFocus: true,
      staleTime: 20000,
    }
  );

  // Flatten paginated data
  const pendingInvoices = pendingData?.pages.flatMap((page) => page.items) || [];
  const reviewedInvoices = reviewedData?.pages.flatMap((page) => page.items) || [];
  const budgetRequests = budgetRequestsData?.items || [];
  
  // Filter and sort reviewed budget requests
  const sortedReviewedBudgetRequests = (reviewedBudgetRequestsData?.items || [])
    .filter((req) => req.status === "approved" || req.status === "rejected")
    .sort((a, b) => {
      const dateA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
      const dateB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

  // Update last sync time whenever pending invoices are fetched
  useEffect(() => {
    if (pendingUpdatedAt) {
      const date = new Date(pendingUpdatedAt);
      setLastInvoiceSync(date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, [pendingUpdatedAt]);

  // Intersection observer for pending invoices
  const lastPendingElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPending) return;
      if (pendingObserver.current) pendingObserver.current.disconnect();
      pendingObserver.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPending) {
          fetchNextPending();
        }
      });
      if (node) pendingObserver.current.observe(node);
    },
    [isFetchingNextPending, hasNextPending, fetchNextPending]
  );

  // Intersection observer for reviewed invoices
  const lastReviewedElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextReviewed) return;
      if (reviewedObserver.current) reviewedObserver.current.disconnect();
      reviewedObserver.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextReviewed) {
          fetchNextReviewed();
        }
      });
      if (node) reviewedObserver.current.observe(node);
    },
    [isFetchingNextReviewed, hasNextReviewed, fetchNextReviewed]
  );

  // Filter and sort reviewed invoices
  const filteredAndSortedInvoices = reviewedInvoices 
    ? [...reviewedInvoices]
        .filter((invoice) => {
          if (filterStatus === "all") return true;
          return invoice.status === filterStatus;
        })
        .sort((a, b) => {
          const dateA = a.reviewedAt ? new Date(a.reviewedAt).getTime() : 0;
          const dateB = b.reviewedAt ? new Date(b.reviewedAt).getTime() : 0;
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        })
    : [];

  // Sort pending invoices - oldest first (ascending order)
  const sortedPendingInvoices = pendingInvoices 
    ? [...pendingInvoices].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB; // Oldest first
      })
    : [];

  // Role-based access control - after all hooks
  if (loadingUser) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader lastInvoiceSync={lastInvoiceSync} />}
      <main className="flex-1 p-6 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(98vh-120px)] min-h-0">
          {/* Pending invoices */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Do zatwierdzenia
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  ({(pendingInvoices?.length || 0) + (budgetRequests?.length || 0)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
              {loadingPending ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (sortedPendingInvoices && sortedPendingInvoices.length > 0) || (budgetRequests && budgetRequests.length > 0) ? (
                <ScrollArea className="flex-1">
                  <div>
                    {/* Budget Requests */}
                    {budgetRequests && budgetRequests.length > 0 && (
                      <div className="border-b-2 border-orange-200 dark:border-orange-900/50">
                        {budgetRequests.map((request) => (
                          <div
                            key={`budget-${request.id}`}
                            className="py-4 px-4 border-b last:border-b-0 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedBudgetRequest(request);
                              setShowBudgetDialog(true);
                            }}
                          >
                            <div className="flex items-center gap-4">
                              {/* Left side - User Name and Date */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-base truncate mb-2">{request.userName}</p>
                                <p className="text-sm text-muted-foreground mb-1.5">
                                  {format(new Date(request.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
   
                              </p>
                            </div>
                              
                              {/* Right side - Amount info */}
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                                  +{request.requestedAmount.toFixed(2)} PLN
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Saldo: {request.currentBalanceAtRequest.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Invoices */}
                    {sortedPendingInvoices.map((invoice, index) => {
                      if (index === sortedPendingInvoices.length - 1) {
                        return (
                          <div key={invoice.id} ref={lastPendingElementRef}>
                            <InvoiceListItem
                              id={invoice.id}
                              invoiceNumber={invoice.invoiceNumber}
                              userName={invoice.userName}
                              companyName={invoice.companyName}
                              createdAt={invoice.createdAt}
                              status={invoice.status}
                              currentReviewerName={invoice.currentReviewerName}
                              variant="accountant"
                            />
                          </div>
                        );
                      }
                      return (
                        <InvoiceListItem
                          key={invoice.id}
                          id={invoice.id}
                          invoiceNumber={invoice.invoiceNumber}
                          userName={invoice.userName}
                          companyName={invoice.companyName}
                          createdAt={invoice.createdAt}
                          status={invoice.status}
                          currentReviewerName={invoice.currentReviewerName}
                          variant="accountant"
                        />
                      );
                    })}
                    {isFetchingNextPending && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                  <Clock className="h-12 w-12 mb-4" />
                  <p>Brak faktur i prośb do zatwierdzenia</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviewed invoices */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Rozpatrzone
                </CardTitle>
                
                {/* Filter and Sorting controls */}
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | "accepted" | "rejected" | "re_review")}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie</SelectItem>
                      <SelectItem value="accepted">Zaakceptowane</SelectItem>
                      <SelectItem value="rejected">Odrzucone</SelectItem>
                      <SelectItem value="re_review">Ponowna weryfikacja</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    title={sortOrder === "asc" ? "Najstarsze" : "Najnowsze"}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-0">
              {loadingReviewed ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAndSortedInvoices && filteredAndSortedInvoices.length > 0 || sortedReviewedBudgetRequests.length > 0 ? (
                <>
                  <ScrollArea className="flex-1">
                    <div>                      {/* Reviewed Budget Requests */}
                      {sortedReviewedBudgetRequests.length > 0 && (
                        <div className="border-b-2 border-muted">
                          {sortedReviewedBudgetRequests.map((request) => (
                            <div
                              key={`reviewed-budget-${request.id}`}
                              className="py-4 px-4 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedBudgetRequest(request);
                                setShowBudgetDialog(true);
                              }}
                            >
                              <div className="flex items-center gap-4">
                                {/* Status icon on far left */}
                                <div className="flex items-center shrink-0">
                                  {request.status === "approved" ? (
                                    <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                                  )}
                                </div>
                                
                                {/* Left side - User Name and Date */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-base truncate mb-2">{request.userName}</p>
                                  <p className="text-sm text-muted-foreground mb-1.5">
                                    {format(new Date(request.reviewedAt || request.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70 truncate">{request.userEmail}</p>
                                </div>
                                
                                {/* Right side - Amount info */}
                                <div className="shrink-0 text-right">
                                  <p className={`text-sm font-bold ${
                                    request.status === "approved" 
                                      ? "text-green-600 dark:text-green-500" 
                                      : "text-red-600 dark:text-red-500"
                                  }`}>
                                    {request.status === "approved" ? "+" : ""}{request.requestedAmount.toFixed(2)} PLN
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {request.status === "approved" ? "Przyznano" : "Odrzucono"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reviewed Invoices */}                      {filteredAndSortedInvoices.map((invoice, index) => {
                        if (index === filteredAndSortedInvoices.length - 1) {
                          return (
                            <div key={invoice.id} ref={lastReviewedElementRef}>
                              <InvoiceListItem
                                id={invoice.id}
                                invoiceNumber={invoice.invoiceNumber}
                                userName={invoice.userName}
                                companyName={invoice.companyName}
                                createdAt={invoice.createdAt}
                                status={invoice.status}
                                reviewerName={invoice.reviewerName}
                                reviewedAt={invoice.reviewedAt}
                                variant="accountant"
                              />
                            </div>
                          );
                        }
                        return (
                          <InvoiceListItem
                            key={invoice.id}
                            id={invoice.id}
                            invoiceNumber={invoice.invoiceNumber}
                            userName={invoice.userName}
                            companyName={invoice.companyName}
                            createdAt={invoice.createdAt}
                            status={invoice.status}
                            reviewerName={invoice.reviewerName}
                            reviewedAt={invoice.reviewedAt}
                            variant="accountant"
                          />
                        );
                      })}
                      {isFetchingNextReviewed && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  {/* Zobacz wszystkie button */}
                  <div className="p-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        router.push('/a/invoices');
                        router.refresh();
                      }}
                    >
                      Zobacz wszystkie
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                  <CheckCircle className="h-12 w-12 mb-4" />
                  <p>Brak rozpatrzonych faktur</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="hidden md:block">
          <Footer />
        </div>
      </main>
      <div className="md:hidden">
        <Footer />
      </div>

      <BudgetRequestReviewDialog
        request={selectedBudgetRequest}
        open={showBudgetDialog}
        onOpenChange={setShowBudgetDialog}
        onSuccess={() => {
          refetchBudgetRequests();
          refetchReviewedBudgetRequests();
        }}
      />
    </div>
  );
}
