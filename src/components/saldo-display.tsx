"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RequestBudgetDialog } from "@/components/request-budget-dialog";
import { useEffect, useState } from "react";

export function SaldoDisplay() {
  const { data, isLoading } = trpc.saldo.getMySaldo.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const [cachedSaldo, setCachedSaldo] = useState<number | null>(null);

  // Cache saldo in localStorage for offline access
  useEffect(() => {
    if (data?.saldo !== undefined) {
      localStorage.setItem("cached_saldo", data.saldo.toString());
      setCachedSaldo(data.saldo);
    } else {
      // Load from cache if online data not available
      const cached = localStorage.getItem("cached_saldo");
      if (cached !== null) {
        setCachedSaldo(parseFloat(cached));
      }
    }
  }, [data]);

  const saldo = data?.saldo ?? cachedSaldo ?? 0;
  const isOffline = data === undefined && cachedSaldo !== null;

  if (isLoading && cachedSaldo === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Twoje Saldo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = saldo > 0;
  const isNegative = saldo < 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Twoje Saldo
          {isOffline && (
            <Badge variant="outline" className="ml-2 text-xs">
              Tryb offline
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Dostępny budżet na faktury
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPositive && <TrendingUp className="h-8 w-8 text-green-500" />}
            {isNegative && <TrendingDown className="h-8 w-8 text-red-500" />}
            {saldo === 0 && <Wallet className="h-8 w-8 text-gray-400" />}
            <div>
              <div
                className={`text-3xl font-bold ${
                  isPositive
                    ? "text-green-600"
                    : isNegative
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {saldo.toFixed(2)} PLN
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {isPositive && "Saldo dodatnie"}
                {isNegative && "Saldo ujemne - przekroczono budżet"}
                {saldo === 0 && "Saldo zerowe"}
              </div>
            </div>
          </div>
          <div>
            {isPositive && <Badge variant="default" className="bg-green-500">Dostępne</Badge>}
            {isNegative && <Badge variant="destructive">Przekroczone</Badge>}
            {saldo === 0 && <Badge variant="secondary">Wyczerpane</Badge>}
          </div>
        </div>
        <div className="mt-4">
          <RequestBudgetDialog />
        </div>
      </CardContent>
    </Card>
  );
}
