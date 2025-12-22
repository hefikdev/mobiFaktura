"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SaldoBadge() {
  const { data: saldoData } = trpc.saldo.getMySaldo.useQuery(undefined, {
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds for more frequent updates
  });
  const [cachedSaldo, setCachedSaldo] = useState<number | null>(null);

  // Cache saldo for offline access
  useEffect(() => {
    if (saldoData?.saldo !== undefined) {
      localStorage.setItem("cached_saldo", saldoData.saldo.toString());
      setCachedSaldo(saldoData.saldo);
    } else {
      const cached = localStorage.getItem("cached_saldo");
      if (cached !== null) {
        setCachedSaldo(parseFloat(cached));
      }
    }
  }, [saldoData]);

  const displaySaldo = saldoData?.saldo ?? cachedSaldo;

  if (displaySaldo === null || displaySaldo === undefined) {
    return null;
  }

  const isPositive = displaySaldo > 0;
  const isNegative = displaySaldo < 0;

  return (
    <Link href="/a/saldo-history">
      <Badge
        variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"}
        className={`cursor-pointer ${isPositive ? "bg-green-600 hover:bg-green-700 text-white" : "text-white"}`}
      >
        {displaySaldo.toFixed(2)} PLN
      </Badge>
    </Link>
  );
}
