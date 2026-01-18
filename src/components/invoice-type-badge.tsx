import { Badge } from "@/components/ui/badge";
import { FileText, Receipt, FilePen } from "lucide-react";

type InvoiceType = "einvoice" | "receipt" | "correction";

interface InvoiceTypeBadgeProps {
  type: InvoiceType;
  variant?: "default" | "compact";
}

export function InvoiceTypeBadge({ type, variant = "default" }: InvoiceTypeBadgeProps) {
  const config = {
    einvoice: {
      label: "E-Faktura",
      icon: FileText,
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20",
    },
    receipt: {
      label: "Paragon",
      icon: Receipt,
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20",
    },
    correction: {
      label: "Korekta",
      icon: FilePen,
      className: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20",
    },
  };

  const { label, icon: Icon, className } = config[type] || config.einvoice;

  if (variant === "compact") {
    return (
      <Badge variant="outline" className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-4 w-4 mr-1.5" />
      {label}
    </Badge>
  );
}
