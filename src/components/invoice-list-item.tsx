import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { FileText, Building2, User, Eye, CheckCircle, XCircle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { formatDate, formatDateTime } from "@/lib/date-utils";

interface InvoiceListItemProps {
  id: string;
  invoiceNumber: string | null;
  description?: string | null;
  status: string;
  createdAt: Date;
  companyName?: string | null;
  userName?: string | null;
  currentReviewerName?: string | null;
  reviewerName?: string | null;
  reviewedAt?: Date | null;
  variant?: "user" | "accountant";
  href?: string;
  budgetRequest?: {
    id: string;
    requestedAmount: number;
    status: string;
  } | null;
}

export function InvoiceListItem({
  id,
  invoiceNumber,
  description,
  status,
  createdAt,
  companyName,
  userName,
  currentReviewerName,
  reviewerName,
  reviewedAt,
  variant = "user",
  href,
  budgetRequest,
}: InvoiceListItemProps) {
  const linkHref = href || (variant === "user" ? `/a/user-invoice/${id}` : `/a/invoice/${id}`);
  
  const date = variant === "user" 
    ? formatDate(createdAt)
    : formatDateTime(createdAt);

  const reviewDate = reviewedAt ? formatDateTime(reviewedAt) : null;

  const isInReview = status === "in_review";
  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";

  // User variant (dashboard)
  if (variant === "user") {
    return (
      <Link href={linkHref} className="block py-4 hover:bg-accent/50 transition-colors -mx-4 px-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{invoiceNumber || "Brak numeru"}</p>
              {companyName && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground truncate">
                    {companyName}
                  </p>
                </div>
              )}
              {description && (
                <p className="text-sm text-muted-foreground truncate mt-1">
                  {description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{date}</p>
            </div>
          </div>
          <InvoiceStatusBadge status={status} />
        </div>
      </Link>
    );
  }

  // Accountant variant
  return (
    <Link href={linkHref}>
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
            {companyName && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className="text-xs text-muted-foreground/70 truncate">
                  {companyName}
                </span>
              </div>
            )}
          </div>
          
          {/* Right side - User icon + name + status */}
          <div className="shrink-0 flex items-center gap-4">
            {/* User info with icon and status badge */}
            {userName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground whitespace-nowrap">
                  {userName}
                </span>
                {isInReview && currentReviewerName && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 shrink-0">
                    <Eye className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" /> {currentReviewerName}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
