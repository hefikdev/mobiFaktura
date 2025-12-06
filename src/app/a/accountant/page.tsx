"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { InvoiceListItem } from "@/components/invoice-list-item";
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
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function AccountantPage() {
  const router = useRouter();
  const [lastInvoiceSync, setLastInvoiceSync] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "accepted" | "rejected">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
      refetchInterval: 1000,
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
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
      staleTime: 20000,
    }
  );

  // Flatten paginated data
  const pendingInvoices = pendingData?.pages.flatMap((page) => page.items) || [];
  const reviewedInvoices = reviewedData?.pages.flatMap((page) => page.items) || [];

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader lastInvoiceSync={lastInvoiceSync} />}
      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(98vh-120px)]">
          {/* Pending invoices */}
          <Card className="flex flex-col">
            <CardHeader className="shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Do zatwierdzenia
                {pendingInvoices && (
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    ({pendingInvoices.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {loadingPending ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sortedPendingInvoices && sortedPendingInvoices.length > 0 ? (
                <ScrollArea className="h-full">
                  <div>
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
                  <p>Brak faktur do zatwierdzenia</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviewed invoices */}
          <Card className="flex flex-col">
            <CardHeader className="shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Rozpatrzone
                  {reviewedInvoices && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({filteredAndSortedInvoices.length}/{reviewedInvoices.length})
                    </span>
                  )}
                </CardTitle>
                
                {/* Filter and Sorting controls */}
                <div className="flex items-center gap-2">
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | "accepted" | "rejected")}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie</SelectItem>
                      <SelectItem value="accepted">Zaakceptowane</SelectItem>
                      <SelectItem value="rejected">Odrzucone</SelectItem>
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
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
              {loadingReviewed ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAndSortedInvoices && filteredAndSortedInvoices.length > 0 ? (
                <>
                  <ScrollArea className="flex-1">
                    <div>
                      {filteredAndSortedInvoices.map((invoice, index) => {
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
    </div>
  );
}
