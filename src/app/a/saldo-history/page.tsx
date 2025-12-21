"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
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

export default function SaldoHistoryPage() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Check user
  const { data: user } = trpc.auth.me.useQuery();

  // Fetch current user's saldo
  const { data: saldoData } = trpc.saldo.getMySaldo.useQuery();

  // Fetch transaction history
  const { data: transactions, isLoading, refetch } = trpc.saldo.getSaldoHistory.useQuery({
    limit,
    offset,
  });

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
      default:
        return type;
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
      default:
        return <Badge>{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : user?.role === "accountant" ? <AccountantHeader /> : <UserHeader />}

      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Historia Saldo</h1>
            </div>
          </div>
        </div>

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

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Historia Transakcji</CardTitle>
          <CardDescription>
            Wszystkie zmiany Twojego saldo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md border">
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
                {transactions && transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Brak transakcji
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </main>

      <Footer />
    </div>
  );
}
