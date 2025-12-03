"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/footer";
import { Loader2, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: {
      label: "Oczekuje",
      icon: Clock,
      className: "text-yellow-600 dark:text-yellow-400",
    },
    accepted: {
      label: "Zaakceptowana",
      icon: CheckCircle,
      className: "text-green-600 dark:text-green-400",
    },
    rejected: {
      label: "Odrzucona",
      icon: XCircle,
      className: "text-red-600 dark:text-red-400",
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.pending;
  const Icon = statusConfig.icon;

  return (
    <div className={cn("flex items-center gap-1 text-sm", statusConfig.className)}>
      <Icon className="h-4 w-4" />
      <span>{statusConfig.label}</span>
    </div>
  );
}

// Invoice list item
function InvoiceItem({
  id,
  invoiceNumber,
  description,
  status,
  createdAt,
}: {
  id: string;
  invoiceNumber: string;
  description: string;
  status: string;
  createdAt: Date;
}) {
  const date = new Date(createdAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Link href={`/auth/user-invoice/${id}`} className="block py-4 hover:bg-accent/50 transition-colors -mx-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{invoiceNumber}</p>
            <p className="text-sm text-muted-foreground truncate">
              {description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{date}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: invoices, isLoading } = trpc.invoice.myInvoices.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchOnWindowFocus: true,
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

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
      {user.role === "admin" ? <AdminHeader /> : <UserHeader />}

      <main className="flex-1 p-4">
        <h2 className="text-xl font-semibold mb-4">Moje faktury</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : invoices && invoices.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="px-4">
                  {invoices.map((invoice, index) => (
                    <div key={invoice.id}>
                      <InvoiceItem
                        id={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        description={invoice.description || ""}
                        status={invoice.status}
                        createdAt={invoice.createdAt}
                      />
                      {index < invoices.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nie masz jeszcze żadnych faktur
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Kliknij + w nagłówku, aby dodać pierwszą fakturę
              </p>
            </CardContent>
          </Card>
        )}
        <div className="text-center mt-6">
          <Footer />
        </div>
      </main>
    </div>
  );
}
