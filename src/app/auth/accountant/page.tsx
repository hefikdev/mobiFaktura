"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
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
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
  User,
  Building2,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface InvoiceListItemProps {
  id: string;
  invoiceNumber: string | null;
  userName: string;
  companyName: string;
  createdAt: Date;
  status?: string;
  currentReviewerName?: string | null;
  reviewerName?: string | null;
  reviewedAt?: Date | null;
}

function InvoiceListItem({
  id,
  invoiceNumber,
  userName,
  companyName,
  createdAt,
  status,
  currentReviewerName,
  reviewerName,
  reviewedAt,
}: InvoiceListItemProps) {
  const date = format(new Date(createdAt), "dd.MM.yyyy HH:mm", { locale: pl });
  const reviewDate = reviewedAt ? format(new Date(reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl }) : null;

  // Determine icon and status display
  const isInReview = status === "in_review";
  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";

  return (
    <Link href={`/auth/invoice/${id}`}>
      <div
        className={cn(
          "py-4 px-4 cursor-pointer transition-colors hover:bg-muted/50 border-b border-muted"
        )}
      >
        <div className="flex items-center gap-4">
          {/* Status icon on far left for reviewed invoices */}
          {(isAccepted || isRejected) && (
            <div className="flex items-center shrink-0">
              {isAccepted && (
                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              )}
              {isRejected && (
                <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              )}
            </div>
          )}

          {/* Left side - Invoice Number, Date and Company */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate mb-2">
              {invoiceNumber || (
                <span className="text-muted-foreground italic">
                  Brak numeru
                </span>
              )}
            </p>

            {/* Date */}
            <p className="text-sm text-muted-foreground mb-1.5">{date}</p>

            {/* Company info */}
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="text-xs text-muted-foreground/70 truncate">
                {companyName}
              </span>
            </div>
          </div>
          
          {/* Right side - User icon + name + status */}
          <div className="shrink-0 flex items-center gap-4">
            {/* User info with icon and status badge */}
            <div className="flex items-center gap-2">
              {isInReview && currentReviewerName ? (
                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm text-foreground whitespace-nowrap">
                {userName}
              </span>
              {isInReview && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 shrink-0">
                  W trakcie
                </span>
              )}
            </div>

            {/* For in-review, show current reviewer name if different from submitter */}
            {isInReview && currentReviewerName && (
              <div className="text-xs text-blue-600 dark:text-blue-400 text-right">
                Przegląda: {currentReviewerName}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function AccountantPage() {
  const router = useRouter();
  const [lastInvoiceSync, setLastInvoiceSync] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "accepted" | "rejected">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: pendingInvoices, isLoading: loadingPending, dataUpdatedAt: pendingUpdatedAt } =
    trpc.invoice.pendingInvoices.useQuery(undefined, {
      refetchInterval: 1000, // Fast refresh for pending/in_review (1 second)
      refetchOnWindowFocus: true,
      staleTime: 0,
    });
    
  const { data: reviewedInvoices, isLoading: loadingReviewed } =
    trpc.invoice.reviewedInvoices.useQuery(undefined, {
      refetchInterval: 30000, // Slow refresh for completed invoices (30 seconds)
      refetchOnWindowFocus: true,
      staleTime: 20000, // Cache for 20 seconds
    });

  // Update last sync time whenever pending invoices are fetched
  useEffect(() => {
    if (pendingUpdatedAt) {
      const date = new Date(pendingUpdatedAt);
      setLastInvoiceSync(date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, [pendingUpdatedAt]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-120px)]">
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
                  {sortedPendingInvoices.map((invoice) => (
                    <InvoiceListItem
                      key={invoice.id}
                      id={invoice.id}
                      invoiceNumber={invoice.invoiceNumber}
                      userName={invoice.userName}
                      companyName={invoice.companyName}
                      createdAt={invoice.createdAt}
                      status={invoice.status}
                      currentReviewerName={invoice.currentReviewerName}
                    />
                  ))}
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
                    {filteredAndSortedInvoices.map((invoice) => (
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
                      />
                    ))}
                  </ScrollArea>
                  {/* Zobacz wszystkie button */}
                  <div className="p-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        router.push('/auth/invoices');
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
      </main>
    </div>
  );
}
