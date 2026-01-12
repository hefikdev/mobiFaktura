"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConflictsBannerProps {
  totalConflicts: number;
  onShowDetails: () => void;
  className?: string;
}

export function ConflictsBanner({
  totalConflicts,
  onShowDetails,
  className,
}: ConflictsBannerProps) {
  if (totalConflicts === 0) return null;

  return (
    <div
      className={cn(
        "bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800",
        className
      )}
    >
      <div className="container max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Wykryto {totalConflicts} {totalConflicts === 1 ? "konflikt" : totalConflicts > 4 ? "konfliktów" : "konflikty"}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Znaleziono duplikaty faktur - te same dane KSeF zostały zatwierdzone wielokrotnie
              </p>
            </div>
          </div>
          <Button
            onClick={onShowDetails}
            variant="outline"
            size="sm"
            className="bg-white dark:bg-gray-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex-shrink-0"
          >
            Zobacz szczegóły
          </Button>
        </div>
      </div>
    </div>
  );
}
