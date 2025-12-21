"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { 
  Loader2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Info,
  Clock,
  CalendarIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";

interface BulkDeleteInvoicesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LogEntry = {
  id: number;
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
};

type DeletionStep = "idle" | "password" | "preview" | "deleting" | "verifying" | "complete";

export function BulkDeleteInvoices({ open, onOpenChange }: BulkDeleteInvoicesProps) {
  const { toast } = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<DeletionStep>("idle");
  
  // Filter states
  const [filterType, setFilterType] = useState<"older" | "year" | "range">("older");
  const [olderThanMonths, setOlderThanMonths] = useState("2");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["all"]);
  
  // Password
  const [password, setPassword] = useState("");
  
  // Progress tracking
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [previewInvoices, setPreviewInvoices] = useState<any[]>([]);
  const [isDeletionComplete, setIsDeletionComplete] = useState(false);
  
  const logIdCounter = useRef(0);

  // Mutations
  const bulkDeleteMutation = trpc.admin.bulkDeleteInvoices.useMutation();
  const deleteSingleMutation = trpc.admin.deleteSingleInvoice.useMutation();
  const verifyDeletionQuery = trpc.admin.verifyDeletion.useQuery(
    {
      filters: buildFilters(),
    },
    {
      enabled: false,
    }
  );

  interface FilterParams {
    statuses: ("all" | "pending" | "in_review" | "accepted" | "rejected" | "re_review")[];
    olderThanMonths?: number;
    year?: number;
    month?: number;
    dateRange?: {
      start: string;
      end: string;
    };
    companyId?: string;
  }

  function buildFilters(): FilterParams {
    const filters: FilterParams = {
      statuses: selectedStatuses as ("all" | "pending" | "in_review" | "accepted" | "rejected" | "re_review")[],
    };

    if (filterType === "older") {
      filters.olderThanMonths = parseInt(olderThanMonths);
    } else if (filterType === "year") {
      filters.year = parseInt(year);
      if (month) {
        filters.month = parseInt(month);
      }
    } else if (filterType === "range") {
      if (startDate && endDate) {
        filters.dateRange = {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        };
      }
    }

    return filters;
  }

  function addLog(type: LogEntry["type"], message: string) {
    const newLog: LogEntry = {
      id: logIdCounter.current++,
      timestamp: new Date().toLocaleTimeString("pl-PL"),
      type,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 50);
  }

  async function handlePreview() {
    if (!password) {
      toast({
        title: "Błąd",
        description: "Wprowadź hasło administratora",
        variant: "destructive",
      });
      return;
    }

    setStep("preview");
    setLogs([]);
    addLog("info", "Rozpoczynam wyszukiwanie faktur do usunięcia...");

    try {
      const result = await bulkDeleteMutation.mutateAsync({
        password,
        filters: buildFilters(),
      });

      if (result.totalFound === 0) {
        addLog("warning", "Nie znaleziono faktur spełniających kryteria");
        toast({
          title: "Brak faktur",
          description: "Nie znaleziono faktur do usunięcia",
        });
        setStep("idle");
        return;
      }

      setPreviewInvoices(result.invoices || []);
      setTotalToDelete(result.totalFound);
      addLog("success", `Znaleziono ${result.totalFound} faktur do usunięcia`);
      
      interface PreviewInvoice {
        id: string;
        invoiceNumber: string;
        status: string;
        createdAt: Date;
      }
      
      result.invoices?.slice(0, 5).forEach((inv: PreviewInvoice) => {
        addLog("info", `  - ${inv.invoiceNumber} (${inv.status}) - ${formatDate(inv.createdAt)}`);
      });
      
      if (result.invoices && result.invoices.length > 5) {
        addLog("info", `  ... i ${result.invoices.length - 5} więcej`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      addLog("error", `Błąd: ${errorMessage}`);
      toast({
        title: "Błąd",
        description: errorMessage || "Nie udało się pobrać listy faktur",
        variant: "destructive",
      });
      setStep("idle");
    }
  }

  async function handleDeleteAll() {
    if (previewInvoices.length === 0) return;

    setStep("deleting");
    setProgress(0);
    setDeletedCount(0);
    setFailedCount(0);
    
    addLog("warning", "⚠️ ROZPOCZYNAM USUWANIE FAKTUR ⚠️");
    addLog("info", `Liczba faktur do usunięcia: ${previewInvoices.length}`);

    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < previewInvoices.length; i++) {
      const invoice = previewInvoices[i];
      
      addLog("info", `[${i + 1}/${previewInvoices.length}] Usuwam: ${invoice.invoiceNumber}`);
      
      try {
        // Delete from MinIO and PostgreSQL
        addLog("info", `  → Usuwam plik z MinIO: ${invoice.imageKey}`);
        await deleteSingleMutation.mutateAsync({
          invoiceId: invoice.id,
        });
        
        addLog("info", `  → Weryfikuję usunięcie z MinIO...`);
        addLog("info", `  → Usuwam z bazy danych PostgreSQL...`);
        addLog("info", `  → Weryfikuję usunięcie z bazy danych...`);
        addLog("success", `  ✓ Faktura ${invoice.invoiceNumber} została pomyślnie usunięta`);
        
        deleted++;
        setDeletedCount(deleted);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        addLog("error", `  ✗ BŁĄD: ${errorMessage}`);
        addLog("error", `  ✗ Faktura ${invoice.invoiceNumber} NIE została usunięta`);
        failed++;
        setFailedCount(failed);
      }
      
      // Update progress
      const currentProgress = ((i + 1) / previewInvoices.length) * 100;
      setProgress(currentProgress);
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification
    setStep("verifying");
    addLog("info", "Rozpoczynam końcową weryfikację...");
    
    try {
      const verification = await verifyDeletionQuery.refetch();
      
      if (verification.data?.allDeleted) {
        addLog("success", "✓ Weryfikacja potwierdzona: Wszystkie faktury zostały usunięte");
        setStep("complete");
        setIsDeletionComplete(true);
        
        toast({
          title: "Sukces!",
          description: `Usunięto ${deleted} faktur. Niepowodzeń: ${failed}`,
        });
      } else {
        addLog("warning", `⚠️ Pozostało ${verification.data?.remaining} faktur w systemie`);
        addLog("error", "Niektóre faktury mogły nie zostać usunięte");
        setStep("complete");
        
        toast({
          title: "Ostrzeżenie",
          description: `Usunięto ${deleted} faktur, ale ${verification.data?.remaining} nadal istnieje`,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      addLog("error", `Błąd weryfikacji: ${errorMessage}`);
      setStep("complete");
    }
    
    addLog("info", "═══════════════════════════════════════");
    addLog("info", `PODSUMOWANIE USUWANIA`);
    addLog("info", `Znaleziono: ${previewInvoices.length}`);
    addLog("success", `Usunięto pomyślnie: ${deleted}`);
    if (failed > 0) {
      addLog("error", `Niepowodzeń: ${failed}`);
    }
    addLog("info", "═══════════════════════════════════════");
  }

  function handleClose() {
    if (step === "deleting" || step === "verifying") {
      toast({
        title: "Operacja w toku",
        description: "Poczekaj na zakończenie usuwania",
        variant: "destructive",
      });
      return;
    }
    
    setStep("idle");
    setPassword("");
    setLogs([]);
    setProgress(0);
    setTotalToDelete(0);
    setDeletedCount(0);
    setFailedCount(0);
    setPreviewInvoices([]);
    setIsDeletionComplete(false);
    setStartDate(undefined);
    setEndDate(undefined);
    onOpenChange(false);
  }

  function getLogIcon(type: LogEntry["type"]) {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
      case "error":
        return <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />;
      default:
        return <Info className="h-3 w-3 text-blue-500 flex-shrink-0" />;
    }
  }

  function getLogColor(type: LogEntry["type"]) {
    switch (type) {
      case "success":
        return "text-green-600";
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      default:
        return "text-muted-foreground";
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    { value: "1", label: "Styczeń" },
    { value: "2", label: "Luty" },
    { value: "3", label: "Marzec" },
    { value: "4", label: "Kwiecień" },
    { value: "5", label: "Maj" },
    { value: "6", label: "Czerwiec" },
    { value: "7", label: "Lipiec" },
    { value: "8", label: "Sierpień" },
    { value: "9", label: "Wrzesień" },
    { value: "10", label: "Październik" },
    { value: "11", label: "Listopad" },
    { value: "12", label: "Grudzień" },
  ];

  const isDeleting = step === "deleting" || step === "verifying";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Masowe usuwanie faktur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Banner */}
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">
                    OSTRZEŻENIE: Ta operacja jest NIEODWRACALNA
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Faktury zostaną trwale usunięte z bazy danych PostgreSQL oraz systemu MinIO.
                    Proces zostanie zweryfikowany po każdym usunięciu.
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
                    ⚠️ Zalecane wykonanie gdy brak aktywności innych użytkowników w celu uniknięcia konfliktów.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters Section */}
          {(step === "idle" || step === "preview") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Typ filtra</Label>
                <Select value={filterType} onValueChange={(v: "older" | "year" | "range") => setFilterType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="older">Starsze niż X miesięcy</SelectItem>
                    <SelectItem value="year">Konkretny rok/miesiąc</SelectItem>
                    <SelectItem value="range">Zakres dat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterType === "older" && (
                <div className="space-y-2">
                  <Label>Usuń faktury starsze niż (miesiące)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={olderThanMonths}
                    onChange={(e) => setOlderThanMonths(e.target.value)}
                    placeholder="np. 2"
                  />
                </div>
              )}

              {filterType === "year" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rok</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Miesiąc (opcjonalnie)</Label>
                    <Select value={month || "none"} onValueChange={(v) => setMonth(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cały rok" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Cały rok</SelectItem>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {filterType === "range" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data od</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? (
                            format(startDate, "PPP", { locale: pl })
                          ) : (
                            <span>Wybierz datę</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Data do</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? (
                            format(endDate, "PPP", { locale: pl })
                          ) : (
                            <span>Wybierz datę</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Status faktur</Label>
                <Select
                  value={selectedStatuses[0]}
                  onValueChange={(v) => setSelectedStatuses([v])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie statusy</SelectItem>
                    <SelectItem value="pending">Oczekujące</SelectItem>
                    <SelectItem value="in_review">W trakcie przeglądu</SelectItem>
                    <SelectItem value="accepted">Zaakceptowane</SelectItem>
                    <SelectItem value="rejected">Odrzucone</SelectItem>
                    <SelectItem value="re_review">Do ponownej oceny</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {step === "idle" && (
                <div className="space-y-2">
                  <Label>Hasło administratora</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wprowadź hasło aby kontynuować"
                  />
                </div>
              )}
            </div>
          )}

          {/* Progress Section */}
          {(step === "deleting" || step === "verifying" || step === "complete") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {step === "complete" ? "Zakończono" : step === "verifying" ? "Weryfikacja..." : "Usuwanie w toku..."}
                  </span>
                  <span>
                    {deletedCount} / {totalToDelete}
                    {failedCount > 0 && (
                      <span className="text-destructive ml-2">
                        ({failedCount} błędów)
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{totalToDelete}</div>
                    <div className="text-xs text-muted-foreground">Znaleziono</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{deletedCount}</div>
                    <div className="text-xs text-muted-foreground">Usunięto</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                    <div className="text-xs text-muted-foreground">Błędów</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Log Terminal */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <Label>Log operacji</Label>
              <Card className="bg-slate-950 border-slate-800">
                <CardContent className="p-0">
                  <ScrollArea className="h-64 w-full">
                    <div ref={logRef} className="p-4 font-mono text-xs space-y-1">
                      {logs.map((log) => (
                        <div key={log.id} className="flex gap-2 items-start">
                          <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                          {getLogIcon(log.type)}
                          <span className={`${getLogColor(log.type)} flex-1`}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Success Status */}
          {step === "complete" && isDeletionComplete && (
            <Card className="border-green-500 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="flex gap-3 items-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-600">
                      Operacja zakończona pomyślnie!
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Wszystkie faktury zostały usunięte i zweryfikowane.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {step === "idle" && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Anuluj
                </Button>
                <Button
                  onClick={handlePreview}
                  disabled={!password || bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wyszukiwanie...
                    </>
                  ) : (
                    "Wyszukaj faktury"
                  )}
                </Button>
              </>
            )}

            {step === "preview" && (
              <>
                <Button variant="outline" onClick={() => setStep("idle")}>
                  Wstecz
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={previewInvoices.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Usuń wszystkie ({totalToDelete})
                </Button>
              </>
            )}

            {(step === "deleting" || step === "verifying") && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {step === "verifying" ? "Weryfikacja..." : "Usuwanie..."}
              </Button>
            )}

            {step === "complete" && (
              <Button onClick={handleClose}>
                Zamknij
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
