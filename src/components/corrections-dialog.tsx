"use client";

import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilePen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CorrectionsDialogProps {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CorrectionsDialog({
  invoiceId,
  open,
  onOpenChange,
}: CorrectionsDialogProps) {
  const router = useRouter();
  const { data: corrections, isLoading } = trpc.invoice.getCorrectionsForInvoice.useQuery(
    { invoiceId },
    { enabled: open }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePen className="h-5 w-5 text-amber-600" />
            Faktury korygujące
          </DialogTitle>
          <DialogDescription>
            Lista wszystkich faktur korygujących do tej faktury
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : corrections && corrections.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer korekty</TableHead>
                    <TableHead className="text-right">Kwota</TableHead>
                    <TableHead>Uzasadnienie</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Sprawdzone przez</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((correction) => (
                    <TableRow
                      key={correction.id}
                      className="cursor-pointer hover:bg-muted/10"
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(`/a/invoice/${correction.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/a/invoice/${correction.id}`);
                        }
                      }}
                    >
                      <TableCell className="font-medium">
                        {correction.invoiceNumber || "Brak numeru"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        +{correction.correctionAmount.toFixed(2)} PLN
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {correction.justification || "Brak uzasadnienia"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(correction.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {correction.reviewerName || "Auto"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FilePen className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Brak faktur korygujących dla tej faktury</p>
            </div>
          )}

          {corrections && corrections.length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Łączna kwota korekt:</span>
                <span className="text-lg font-bold text-green-600">
                  +{corrections.reduce((sum, c) => sum + c.correctionAmount, 0).toFixed(2)} PLN
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
