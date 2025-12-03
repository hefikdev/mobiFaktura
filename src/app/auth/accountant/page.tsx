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
import { Footer } from "@/components/footer";
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  AlertCircle,
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

  return (
    <Link href={`/auth/invoice/${id}`}>
      <div
        className={cn(
          "py-3 px-4 cursor-pointer transition-colors hover:bg-muted/50 border-b last:border-b-0"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {invoiceNumber || (
                <span className="text-muted-foreground italic">
                  Brak numeru
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {userName}
            </p>
            <p className="text-sm font-medium text-primary truncate">
              {companyName}
            </p>
            <p className="text-xs text-muted-foreground">{date}</p>
            
            {currentReviewerName && (
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400">
                <Eye className="h-3 w-3" />
                <span>{currentReviewerName}</span>
              </div>
            )}
            
            {reviewerName && reviewedAt && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <span>{reviewerName} • {format(new Date(reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</span>
              </div>
            )}
          </div>
          
          <div className="shrink-0 flex flex-col items-end gap-1">
            {status === "in_review" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                W trakcie
              </span>
            )}
            {status === "accepted" && (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
            {status === "rejected" && (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
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
              ) : pendingInvoices && pendingInvoices.length > 0 ? (
                <ScrollArea className="h-full">
                  {pendingInvoices.map((invoice) => (
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
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Rozpatrzone
                {reviewedInvoices && (
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    ({reviewedInvoices.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {loadingReviewed ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : reviewedInvoices && reviewedInvoices.length > 0 ? (
                <ScrollArea className="h-full">
                  {reviewedInvoices.map((invoice) => (
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
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                  <CheckCircle className="h-12 w-12 mb-4" />
                  <p>Brak rozpatrzonych faktur</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="text-center mt-6">
          <Footer />
        </div>
      </main>
    </div>
  );
}
