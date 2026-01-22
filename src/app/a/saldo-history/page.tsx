"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { SearchInput } from "@/components/search-input";
import { AdvancedFilters, type FilterConfig } from "@/components/advanced-filters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowUp, ArrowDown, FileText, RefreshCw, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";
import { ExportButton } from "@/components/export-button";
import { RequestBudgetDialog } from "@/components/request-budget-dialog";
import { formatters } from "@/lib/export";
import { SaldoTransactionDetailsDialog } from "@/components/saldo-transaction-details-dialog";

export default function SaldoHistoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showRequestBudget, setShowRequestBudget] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, any>>({});
  
  // Dialog states for transaction details
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);

  // Check user
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Fetch current user's saldo
  const { data: saldoData } = trpc.saldo.getMySaldo.useQuery();

  // Fetch transaction history with infinite query
  const {
    data: transactionsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.saldo.getSaldoHistory.useInfiniteQuery(
    { limit: 50 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!user,
    }
  );

  // Export query
  const exportQuery = trpc.saldo.exportSaldoHistory.useQuery(undefined, {
    enabled: false,
  });

  // Export columns
  const exportColumns = [
    { key: "createdAt", header: "Data", formatter: (value: unknown) => formatters.date(value as Date | string) },
    { key: "transactionType", header: "Typ", formatter: (value: unknown) => formatters.transactionType(value as string) },
    { key: "amount", header: "Kwota", formatter: (value: unknown) => formatters.currency(value as number) },
    { key: "balanceBefore", header: "Saldo przed", formatter: (value: unknown) => formatters.currency(value as number) },
    { key: "balanceAfter", header: "Saldo po", formatter: (value: unknown) => formatters.currency(value as number) },
    { key: "notes", header: "Notatka" },
    { key: "createdByName", header: "Wykonane przez" },
  ];

  const allTransactions = transactionsData?.pages.flatMap((page) => page.items) || [];

  // Advanced filter configuration
  const advancedFilterConfig: FilterConfig[] = [
    {
      field: "dateFrom",
      type: "date",
      label: "Data od",
      placeholder: "Wybierz datę początkową"
    },
    {
      field: "dateTo",
      type: "date",
      label: "Data do",
      placeholder: "Wybierz datę końcową"
    },
    {
      field: "amountMin",
      type: "number",
      label: "Kwota min",
      placeholder: "0.00"
    },
    {
      field: "amountMax",
      type: "number",
      label: "Kwota max",
      placeholder: "0.00"
    },
    {
      field: "balanceMin",
      type: "number",
      label: "Saldo min",
      placeholder: "0.00"
    },
    {
      field: "balanceMax",
      type: "number",
      label: "Saldo max",
      placeholder: "0.00"
    },
  ];

  // Filter transactions based on search and advanced filters
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];
    
    let filtered = allTransactions;

    // Apply search filter - enhanced to search UUIDs, amounts, balances, dates
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          // Search in text fields
          tx.transactionType.toLowerCase().includes(query) ||
          tx.notes?.toLowerCase().includes(query) ||
          tx.createdByName?.toLowerCase().includes(query) ||
          // Search in UUIDs
          tx.id?.toLowerCase().includes(query) ||
          tx.referenceId?.toLowerCase().includes(query) ||
          // Search in amounts and balances (convert to string)
          tx.amount?.toString().includes(query) ||
          tx.balanceBefore?.toString().includes(query) ||
          tx.balanceAfter?.toString().includes(query) ||
          // Search in formatted date
          (tx.createdAt && format(new Date(tx.createdAt), "dd/MM/yyyy", { locale: pl }).includes(query))
      );
    }

    // Apply advanced filters
    if (advancedFilters.dateFrom) {
      const dateFrom = new Date(advancedFilters.dateFrom);
      filtered = filtered.filter(tx => new Date(tx.createdAt) >= dateFrom);
    }
    if (advancedFilters.dateTo) {
      const dateTo = new Date(advancedFilters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => new Date(tx.createdAt) <= dateTo);
    }
    if (advancedFilters.amountMin) {
      const amountMin = parseFloat(advancedFilters.amountMin);
      filtered = filtered.filter(tx => tx.amount >= amountMin);
    }
    if (advancedFilters.amountMax) {
      const amountMax = parseFloat(advancedFilters.amountMax);
      filtered = filtered.filter(tx => tx.amount <= amountMax);
    }
    if (advancedFilters.balanceMin) {
      const balanceMin = parseFloat(advancedFilters.balanceMin);
      filtered = filtered.filter(tx => tx.balanceAfter >= balanceMin);
    }
    if (advancedFilters.balanceMax) {
      const balanceMax = parseFloat(advancedFilters.balanceMax);
      filtered = filtered.filter(tx => tx.balanceAfter <= balanceMax);
    }

    return filtered;
  }, [allTransactions, searchQuery, advancedFilters]);

  // Ref for infinite scroll
  const observer = useRef<IntersectionObserver>();
  const lastTransactionElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    // dependencies
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "adjustment":
        return <RefreshCw className="h-4 w-4" />;
      case "invoice_deduction":
        return <ArrowDown className="h-4 w-4 text-red-500" />;
      case "invoice_refund":
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "adjustment":
        return "Korekta";
      case "invoice_deduction":
        return "Odliczenie faktury";
      case "invoice_refund":
        return "Zwrot za fakturę";
      case "advance_credit":
        return "Zaliczka";
      default:
        return type;
    }
  };
  
  // Handle clicking on a transaction
  const handleTransactionClick = (tx: any) => {
    if (tx.transactionType === 'adjustment') {
      // Open popup with transaction details
      setSelectedTransaction(tx);
      setIsTransactionDialogOpen(true);
    } else if (tx.transactionType === 'invoice_deduction' && tx.referenceId) {
      // Navigate to invoice page
      router.push(`/a/user-invoice/${tx.referenceId}`);
    } else if (tx.transactionType === 'invoice_refund' && tx.referenceId) {
      // Navigate to correction invoice page (correction that credited the user)
      router.push(`/a/user-invoice/${tx.referenceId}`);
    } else if (tx.transactionType === 'advance_credit' && tx.referenceId) {
      // Could navigate to advance details if we had such a page
      // For now, show transaction details popup
      setSelectedTransaction(tx);
      setIsTransactionDialogOpen(true);
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case "adjustment":
        return <Badge variant="secondary">Korekta</Badge>;
      case "invoice_deduction":
        return <Badge variant="destructive">Odliczenie</Badge>;
      case "invoice_refund":
        return <Badge variant="default" className="bg-green-500">Zwrot</Badge>;
      case "advance_credit":
        return <Badge variant="default">Zaliczka</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : user?.role === "accountant" ? <AccountantHeader /> : <UserHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
              {/* Current Saldo Card */}
      {saldoData && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Aktualne Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-4xl font-bold ${
                saldoData.saldo > 0
                  ? "text-green-600"
                  : saldoData.saldo < 0
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {saldoData.saldo.toFixed(2)} PLN
            </div>
          </CardContent>
        </Card>
      )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Historia Saldo</h1>
            </div>
          </div>
          {/* Mobile: center button, Desktop: right align */}
          <div className="flex w-full md:w-auto justify-center md:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRequestBudget(true)}
              className="flex items-center gap-2"
            >
              <ArrowUp className="h-4 w-4" />
              Prośba o zwiększenie budżetu
            </Button>
          </div>
        </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap">
            <div className="flex-1 min-w-[200px] flex gap-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                className="flex-1"
                showIcon
              />
              <AdvancedFilters
                filters={advancedFilterConfig}
                values={advancedFilters}
                onChange={setAdvancedFilters}
                onReset={() => setAdvancedFilters({})}
              />
            </div>
            <div className="hidden md:block">
              <ExportButton
          data={[]}
          columns={exportColumns}
          filename="historia-saldo"
          userName={user?.name}
          filters={[{
            key: 'createdAt',
            label: 'Zakres dat',
            options: [
              { value: 'all', label: 'Wszystkie' },
              { value: '7', label: 'Ostatnie 7 dni' },
              { value: '30', label: 'Ostatnie 30 dni' },
              { value: '365', label: 'Ostatnie 365 dni' },
              { value: '__specific_month__', label: 'Konkretne miesiąc' },
            ]
          }]}
          onExport={async (filters) => {
            // Call the server export with parsed filter input (filters may include dateFrom or specificMonth)
            // Use a safe any-cast to call the client-side fetch implementation (type definitions sometimes don't expose fetch)
            try {
              const fn = (trpc.saldo.exportSaldoHistory as any).fetch;
              if (typeof fn === 'function') {
                const data = await fn(filters || {});
                return data || [];
              }
            } catch (e) {
              console.warn('trpc fetch failed, falling back to refetch', e);
            }

            // Fallback: if fetch isn't available on the client, use the refetch helper (if available)
            try {
              const result = await exportQuery.refetch();
              return result.data || [];
            } catch (e) {
              console.error('Export fallback failed', e);
              return [];
            }
          }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length > 0 ? (
            <>
              {/* Mobile View - Cards */}
              <div className="md:hidden divide-y">
                {filteredTransactions.map((tx, index) => {
                  const isLastElement = index === filteredTransactions.length - 1;
                  return (
                    <div
                      key={tx.id}
                      ref={isLastElement ? lastTransactionElementRef : null}
                      className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleTransactionClick(tx)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getTransactionIcon(tx.transactionType)}
                          <div>
                            <div className="font-semibold">{getTransactionTypeLabel(tx.transactionType)}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm", { locale: pl })}
                            </div>
                          </div>
                        </div>
                        <div className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)} PLN
                        </div>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Saldo przed:</span>
                          <span className="font-mono">{tx.balanceBefore.toFixed(2)} PLN</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Saldo po:</span>
                          <span className="font-mono font-bold">{tx.balanceAfter.toFixed(2)} PLN</span>
                        </div>
                        {tx.notes && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Notatka:</span>
                            <span className="truncate max-w-xs">{tx.notes}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wykonane przez:</span>
                          <span>{tx.createdByName || "System"}</span>
                        </div>
                      </div>

                      {tx.referenceId && tx.transactionType === "invoice_deduction" && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/a/user-invoice/${tx.referenceId}`}>
                            <Button variant="outline" size="sm" className="w-full">
                              <Receipt className="h-4 w-4 mr-2" />
                              Zobacz fakturę
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
                {isFetchingNextPage && (
                  <div className="p-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
                  </div>
                )}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Kwota</TableHead>
                      <TableHead>Saldo przed</TableHead>
                      <TableHead>Saldo po</TableHead>
                      <TableHead>Notatka</TableHead>
                      <TableHead>Wykonane przez</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx, index) => {
                      const isLastElement = index === filteredTransactions.length - 1;
                      return (
                        <TableRow 
                          key={tx.id} 
                          ref={isLastElement ? lastTransactionElementRef : null}
                          className="cursor-pointer hover:bg-muted/70 transition-colors"
                          onClick={() => handleTransactionClick(tx)}
                        >
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm", {
                              locale: pl,
                            })}
                          </TableCell>
                          <TableCell>{getTransactionTypeBadge(tx.transactionType)}</TableCell>
                          <TableCell>
                            <div
                              className={`flex items-center gap-1 font-semibold ${
                                tx.amount > 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {tx.amount > 0 ? (
                                <ArrowUp className="h-4 w-4" />
                              ) : (
                                <ArrowDown className="h-4 w-4" />
                              )}
                              {Math.abs(tx.amount).toFixed(2)} PLN
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {tx.balanceBefore.toFixed(2)} PLN
                          </TableCell>
                          <TableCell className="font-mono font-bold">
                            {tx.balanceAfter.toFixed(2)} PLN
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {tx.notes || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {tx.createdByName || "System"}
                          </TableCell>
                          <TableCell>
                            {tx.referenceId && tx.transactionType === "invoice_deduction" && (
                              <Link href={`/a/user-invoice/${tx.referenceId}`}>
                                <Button variant="ghost" size="sm">
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              </Link>
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
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "Nie znaleziono transakcji" : "Brak transakcji"}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredTransactions.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center dark:text-gray-300">
          Wyświetlono {filteredTransactions.length} z {allTransactions.length} transakcji
        </div>
      )}
      <div className="hidden md:block">
        <Footer />
      </div>
      <div className="md:hidden">
        <Footer />
      </div>
    </main>

    <RequestBudgetDialog
      open={showRequestBudget}
      onOpenChange={setShowRequestBudget}
    />
    
    {/* Saldo Transaction Details Dialog */}
    <SaldoTransactionDetailsDialog
      transaction={selectedTransaction}
      open={isTransactionDialogOpen}
      onOpenChange={setIsTransactionDialogOpen}
    />
  </div>
  );
}
