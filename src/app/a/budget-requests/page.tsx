"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { SearchInput } from "@/components/search-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Check, X, Clock, Filter, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Label } from "@/components/ui/label";

type BudgetRequestStatus = "all" | "pending" | "approved" | "rejected";

export default function BudgetRequestsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<BudgetRequestStatus>("pending");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Check user role
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

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
    }
  );

  const allRequests = requestsData?.pages.flatMap((page) => page.items) || [];

  // Filter requests based on search
  const filteredRequests = useMemo(() => {
    if (!allRequests) return [];
    if (!searchQuery) return allRequests;

    const query = searchQuery.toLowerCase();
    return allRequests.filter(
      (req) =>
        req.userName.toLowerCase().includes(query) ||
        req.userEmail.toLowerCase().includes(query) ||
        req.justification.toLowerCase().includes(query)
    );
  }, [allRequests, searchQuery]);

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

  // Review mutation
  const reviewMutation = trpc.budgetRequest.review.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setIsReviewDialogOpen(false);
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

  const openReviewDialog = (request: any, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setRejectionReason("");
    setIsReviewDialogOpen(true);
  };

  const handleReview = () => {
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

  const getStatusBadge = (status: string, request?: any) => {
    const handleStatusClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (request) {
        setSelectedRequest(request);
        setIsDetailsDialogOpen(true);
      }
    };

    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Oczekuje</Badge>;
      case "approved":
        return (
          <Badge
            variant="default"
            className="bg-green-500 cursor-pointer hover:bg-green-600 text-white dark:text-white"
            onClick={handleStatusClick}
          >
            <Check className="h-3 w-3 mr-1" />Zatwierdzona
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="cursor-pointer hover:opacity-80"
            onClick={handleStatusClick}
          >
            <X className="h-3 w-3 mr-1" />Odrzucona
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
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
        </div>

      <Card>
        <CardHeader>
          <div className="flex flex-row flex-wrap justify-between items-center gap-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
            />
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Stan salda przy złożeniu</TableHead>
                  <TableHead className="text-right">Wnioskowana kwota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data złożenia</TableHead>
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
                        setIsDetailsDialogOpen(true);
                      };
                      return (
                        <TableRow 
                          key={request.id} 
                          ref={isLastElement ? lastRequestElementRef : null}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={handleRowClick}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">{request.userName}</div>
                              <div className="text-sm text-muted-foreground">{request.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-semibold ${
                              (request.currentBalanceAtRequest ?? 0) > 0 ? "text-green-600" : 
                              (request.currentBalanceAtRequest ?? 0) < 0 ? "text-red-600" : "text-gray-600"
                            }`}>
                              {(request.currentBalanceAtRequest ?? 0).toFixed(2)} PLN
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-blue-600">
                              +{(request.requestedAmount ?? 0).toFixed(2)} PLN
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status, request)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(request.createdAt), "dd MMM yyyy HH:mm", { locale: pl })}
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
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {request.reviewedAt && format(new Date(request.reviewedAt), "dd MMM yyyy", { locale: pl })}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {isFetchingNextPage && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Zatwierdź prośbę" : "Odrzuć prośbę"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve" 
                ? "Po zatwierdzeniu saldo użytkownika zostanie automatycznie zwiększone" 
                : "Podaj powód odrzucenia prośby"}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Użytkownik</Label>
                  <div className="font-medium">{selectedRequest.userName}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Stan salda przy złożeniu</Label>
                  <div className="font-medium">{(selectedRequest.currentBalanceAtRequest ?? 0).toFixed(2)} PLN</div>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Wnioskowana kwota</Label>
                <div className="text-2xl font-bold text-blue-600">
                  +{selectedRequest.requestedAmount.toFixed(2)} PLN
                </div>
              </div>
              {reviewAction === "approve" && (
                <div>
                  <Label className="text-sm text-muted-foreground">Nowe saldo po zatwierdzeniu</Label>
                  <div className="text-2xl font-bold text-green-600">
                    {((selectedRequest.currentBalanceAtRequest ?? 0) + (selectedRequest.requestedAmount ?? 0)).toFixed(2)} PLN
                  </div>
                </div>
              )}
              <div>
                <Label className="text-sm text-muted-foreground">Uzasadnienie użytkownika</Label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                  {selectedRequest.justification}
                </div>
              </div>
              {reviewAction === "reject" && (
                <div>
                  <Label htmlFor="rejection">Powód odrzucenia *</Label>
                  <Textarea
                    id="rejection"
                    placeholder="Wyjaśnij użytkownikowi dlaczego prośba została odrzucona..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum 10 znaków
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={reviewMutation.isPending}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending}
              variant={reviewAction === "approve" ? "default" : "destructive"}
              className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700 text-white dark:text-white" : ""}
            >
              {reviewMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {reviewAction === "approve" ? "Zatwierdź" : "Odrzuć"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Szczegóły prośby o budżet</DialogTitle>
            <DialogDescription>
              Szczegółowe informacje o prośbie użytkownika {selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Użytkownik</Label>
                  <div className="font-medium">{selectedRequest.userName}</div>
                  <div className="text-sm text-muted-foreground">{selectedRequest.userEmail}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Stan salda przy złożeniu</Label>
                  <div className="font-medium">{(selectedRequest.currentBalanceAtRequest ?? 0).toFixed(2)} PLN</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Wnioskowana kwota</Label>
                  <div className="text-2xl font-bold text-blue-600">
                    +{selectedRequest.requestedAmount.toFixed(2)} PLN
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Data złożenia</Label>
                <div className="font-medium">
                  {format(new Date(selectedRequest.createdAt), "dd MMMM yyyy HH:mm", { locale: pl })}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Uzasadnienie użytkownika</Label>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedRequest.justification}
                </div>
              </div>
              {selectedRequest.status === "rejected" && selectedRequest.rejectionReason && (
                <div>
                  <Label className="text-sm text-muted-foreground">Powód odrzucenia</Label>
                  <div className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md text-sm whitespace-pre-wrap text-red-800 dark:text-red-200">
                    {selectedRequest.rejectionReason}
                  </div>
                </div>
              )}
              {selectedRequest.status === "approved" && selectedRequest.reviewedAt && (
                <div>
                  <Label className="text-sm text-muted-foreground">Data zatwierdzenia</Label>
                  <div className="font-medium">
                    {format(new Date(selectedRequest.reviewedAt), "dd MMMM yyyy HH:mm", { locale: pl })}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              Zamknij
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
