import { Clock, CheckCircle, XCircle, RefreshCw, DollarSign, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

type InvoiceStatus = "pending" | "in_review" | "accepted" | "rejected" | "re_review" | "money_transferred" | "transferred" | "settled";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus | string;
  variant?: "default" | "compact";
}

export function InvoiceStatusBadge({ status, variant = "default" }: InvoiceStatusBadgeProps) {
  const config = {
    pending: {
      label: "Oczekuje",
      icon: Clock,
      className: "text-orange-600 dark:text-orange-400",
      bgClassName: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    },
    in_review: {
      label: "W trakcie",
      icon: Clock,
      className: "text-orange-600 dark:text-orange-400",
      bgClassName: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    },
    accepted: {
      label: "Zaakceptowana",
      icon: CheckCircle,
      className: "text-green-600 dark:text-green-400",
      bgClassName: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    money_transferred: {
      label: "Przelew wykonany",
      icon: DollarSign,
      className: "text-blue-600 dark:text-blue-400",
      bgClassName: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    },
    transferred: {
      label: "Wpłynęła",
      icon: Receipt,
      className: "text-cyan-600 dark:text-cyan-400",
      bgClassName: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    },
    settled: {
      label: "Rozliczono",
      icon: CheckCircle,
      className: "text-purple-600 dark:text-purple-400",
      bgClassName: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    },
    rejected: {
      label: "Odrzucona",
      icon: XCircle,
      className: "text-red-600 dark:text-red-400",
      bgClassName: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
    re_review: {
      label: "Ponowna weryfikacja",
      icon: RefreshCw,
      className: "text-orange-600 dark:text-orange-400",
      bgClassName: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.pending;
  const Icon = statusConfig.icon;

  if (variant === "compact") {
    return (
      <span className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
        statusConfig.bgClassName
      )}>
        {statusConfig.label}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-sm", statusConfig.className)}>
      <Icon className="h-4 w-4" />
      <span>{statusConfig.label}</span>
    </div>
  );
}
