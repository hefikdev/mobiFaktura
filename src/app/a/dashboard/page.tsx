"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { SectionLoader } from "@/components/section-loader";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { InvoiceListItem } from "@/components/invoice-list-item";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Plus, Filter } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useOnline } from "@/lib/use-online";
import { OfflineUploadDialog } from "@/components/offline-banner";

export default function DashboardPage() {
  const router = useRouter();
  const { isOnline, refresh } = useOnline();
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: invoices, isLoading } = trpc.invoice.myInvoices.useQuery(undefined, {
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    let filtered = [...invoices];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.id.toLowerCase().includes(query) ||
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.companyName?.toLowerCase().includes(query) ||
          inv.description?.toLowerCase().includes(query) ||
          inv.status.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((inv) => inv.status === filterStatus);
    }

    return filtered;
  }, [invoices, searchQuery, filterStatus]);

  // Role-based access control - after all hooks
  if (loadingUser) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex-1 flex items-center justify-center">
          <SectionLoader />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : user.role === "accountant" ? <AccountantHeader /> : <UserHeader />}

      <main className="flex-1 container mx-auto px-4 py-4">
        {user.role === "user" && (
          <>
            <div className="mb-6 max-w-4xl mx-auto">
            </div>
            <div className="mb-6 max-w-4xl mx-auto">
              {isOnline ? (
                <Button asChild size="lg" className="w-full h-20 text-lg font-semibold">
                  <Link href="/a/upload">
                    <Plus className="mr-2 h-6 w-6" />
                    Dodaj fakturę
                  </Link>
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full h-20 text-lg font-semibold"
                  onClick={() => setShowOfflineDialog(true)}
                >
                  <Plus className="mr-2 h-6 w-6" />
                  Dodaj fakturę
                </Button>
              )}
            </div>
          </>
        )}

        {/* Search and Filter Controls - only show when there are invoices */}
        {invoices && invoices.length > 0 && (
          <div className="mb-4 w-full px-4">
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="flex-1">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Szukaj"
                  className="w-full"
                  showIcon={true}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Wszystkie statusy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="pending">Oczekuje</SelectItem>
                  <SelectItem value="in_review">W trakcie</SelectItem>
                  <SelectItem value="accepted">Zaakceptowane</SelectItem>
                  <SelectItem value="rejected">Odrzucone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInvoices && filteredInvoices.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="px-4">
                  {filteredInvoices.map((invoice, index) => (
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
                      {index < filteredInvoices.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : invoices && invoices.length > 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Brak faktur spełniających kryteria wyszukiwania
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Spróbuj zmienić filtry lub wyszukiwanie
              </p>
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
      
      <OfflineUploadDialog
        open={showOfflineDialog}
        onClose={() => setShowOfflineDialog(false)}
        onRefresh={refresh}
      />
    </div>
  );
}
