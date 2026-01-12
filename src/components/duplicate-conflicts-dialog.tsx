"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Eye, User, Building2, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { formatDateTime } from "@/lib/date-utils";
import { useRouter } from "next/navigation";

interface DuplicateGroup {
  kwota: string | null;
  ksefNumber: string | null;
  companyId: string | null;
  companyName: string | null;
  count: number;
  invoices: Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    companyId: string | null;
    companyName: string | null;
    invoiceNumber: string;
    ksefNumber: string | null;
    kwota: string | null;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewedBy: string | null;
    imageKey: string;
  }>;
}

interface DuplicateConflictsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateGroup[];
  totalConflicts: number;
}

export function DuplicateConflictsDialog({
  open,
  onOpenChange,
  duplicates,
  totalConflicts,
}: DuplicateConflictsDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Wykryte konflikty - Duplikaty faktur
          </DialogTitle>
          <DialogDescription>
            Znaleziono {totalConflicts} {totalConflicts === 1 ? "konflikt" : totalConflicts > 4 ? "konfliktów" : "konflikty"} - faktury z identycznymi danymi zostały zatwierdzone wielokrotnie
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <div className="space-y-4 pr-4">
            {duplicates.map((group, groupIndex) => (
              <Card key={groupIndex} className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Konflikt #{groupIndex + 1}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      {group.count} duplikatów
                    </Badge>
                  </CardTitle>
                  <div className="text-sm space-y-1 text-muted-foreground mt-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>Kwota: <strong className="text-foreground">{group.kwota ? `${parseFloat(group.kwota).toFixed(2)} PLN` : "N/A"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Numer KSeF: <strong className="text-foreground">{group.ksefNumber || "N/A"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>Firma: <strong className="text-foreground">{group.companyName || "N/A"}</strong></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.invoices.map((invoice) => (
                    <Card key={invoice.id} className="bg-background">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                <strong>{invoice.userName || "Nieznany"}</strong>
                                <span className="text-muted-foreground ml-1">({invoice.userEmail})</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-3.5 w-3.5" />
                              <span>Numer faktury: {invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Utworzono: {formatDateTime(invoice.createdAt)}</span>
                            </div>
                            {invoice.reviewedAt && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Zatwierdzono: {formatDateTime(invoice.reviewedAt)}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              router.push(`/a/invoice/${invoice.id}`);
                              onOpenChange(false);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Zobacz
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
