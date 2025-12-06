"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { InvoiceListItem } from "@/components/invoice-list-item";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText } from "lucide-react";

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
                      <InvoiceListItem
                        id={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        description={invoice.description}
                        status={invoice.status}
                        createdAt={invoice.createdAt}
                        companyName={invoice.companyName}
                        variant="user"
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
