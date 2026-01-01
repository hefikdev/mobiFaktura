"use client";

import { useState, useRef } from "react";
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
import { BudgetRequest } from "@/types";
import { 
  Loader2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Info,
  CalendarIcon,
  User,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface BulkDeleteBudgetRequestsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LogEntry = {
  id: number;
  timestamp: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
};

type DeletionStep = "idle" | "password" | "preview" | "deleting" | "complete";

export function BulkDeleteBudgetRequests({ open, onOpenChange }: BulkDeleteBudgetRequestsProps) {
  const { toast } = useToast();
  const logRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<DeletionStep>("idle");
  
  // Filter states
  const [filterType, setFilterType] = useState<"older" | "year" | "range" | "user">("older");
  const [olderThanMonths, setOlderThanMonths] = useState("2");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["all"]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // Password
  const [password, setPassword] = useState("");
  
  // Progress tracking
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [previewRequests, setPreviewRequests] = useState<BudgetRequest[]>([]);
  
  const logIdCounter = useRef(0);

  // Get users for filter
  const { data: usersData } = trpc.admin.getUsers.useQuery({ limit: 100 }, {
    enabled: open,
  });
  const users = usersData?.items || [];

  // Mutations
  const bulkDeleteMutation = trpc.budgetRequest.bulkDelete.useMutation({
    onSuccess: (data) => {
      addLog("success", `✓ Usunięto ${data.deletedCount} próśb o budżet`);
      setDeletedCount(data.deletedCount);
      setStep("complete");
      setProgress(100);
      toast({
        title: "Sukces",
        description: `Usunięto ${data.deletedCount} próśb o budżet`,
      });
    },
    onError: (error) => {
      addLog("error", `✗ Błąd: ${error.message}`);
      setFailedCount(prev => prev + 1);
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
      setStep("idle");
    },
  });

  interface FilterParams {
    statuses: ("all" | "pending" | "approved" | "rejected" | "rozliczono")[];
    olderThanMonths?: number;
    year?: number;
    month?: number;
    dateRange?: {
      start: string;
      end: string;
    };
    userId?: string;
  }

  function buildFilters(): FilterParams {
    const filters: FilterParams = {
      statuses: selectedStatuses as ("all" | "pending" | "approved" | "rejected")[],
    };

    if (filterType === "user" && selectedUserId) {
      filters.userId = selectedUserId;
    } else if (filterType === "older") {
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

  function handleStartDeletion() {
    const filters = buildFilters();
    
    // Validation
    if (filterType === "range" && (!startDate || !endDate)) {
      toast({
        title: "Błąd",
        description: "Wybierz zakres dat",
        variant: "destructive",
      });
      return;
    }

    if (filterType === "user" && !selectedUserId) {
      toast({
        title: "Błąd",
        description: "Wybierz użytkownika",
        variant: "destructive",
      });
      return;
    }

    setStep("password");
  }

  function handleConfirmPassword() {
    if (!password) {
      toast({
        title: "Błąd",
        description: "Wprowadź hasło administratora",
        variant: "destructive",
      });
      return;
    }

    setStep("deleting");
    setProgress(10);
    addLog("info", "⚙ Rozpoczynanie usuwania próśb o budżet...");

    const filters = buildFilters();
    bulkDeleteMutation.mutate({
      filters,
      adminPassword: password,
    });
  }

  function handleReset() {
    setStep("idle");
    setPassword("");
    setLogs([]);
    setProgress(0);
    setDeletedCount(0);
    setFailedCount(0);
    setPreviewRequests([]);
    logIdCounter.current = 0;
  }

  function handleClose() {
    if (step === "deleting") {
      toast({
        title: "Uwaga",
        description: "Operacja w toku, poczekaj na zakończenie",
        variant: "destructive",
      });
      return;
    }
    handleReset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Masowe usuwanie próśb o budżet
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="space-y-6 pr-4">
            {/* Warning Banner */}
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">
                      Operacja nieodwracalna
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prośby o budżet zostaną trwale usunięte z bazy danych. Tej operacji nie można cofnąć.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                      ⚠️ Zalecane wykonanie gdy brak aktywności innych użytkowników w celu uniknięcia konfliktów.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 1: Filter Selection */}
            {step === "idle" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Typ filtra</Label>
                  <Select value={filterType} onValueChange={(value: "older" | "year" | "range" | "user") => setFilterType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="older">Starsze niż X miesięcy</SelectItem>
                      <SelectItem value="year">Konkretny rok/miesiąc</SelectItem>
                      <SelectItem value="range">Zakres dat</SelectItem>
                      <SelectItem value="user">Konkretny użytkownik</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Type: Older */}
                {filterType === "older" && (
                  <div className="space-y-2">
                    <Label>Usuń prośby starsze niż (miesiące)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={olderThanMonths}
                      onChange={(e) => setOlderThanMonths(e.target.value)}
                      placeholder="np. 6"
                    />
                  </div>
                )}

                {/* Filter Type: Year */}
                {filterType === "year" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Rok</Label>
                      <Input
                        type="number"
                        min="2020"
                        max={new Date().getFullYear()}
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Miesiąc (opcjonalnie)</Label>
                      <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger>
                          <SelectValue placeholder="Wszystkie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Wszystkie</SelectItem>
                          <SelectItem value="1">Styczeń</SelectItem>
                          <SelectItem value="2">Luty</SelectItem>
                          <SelectItem value="3">Marzec</SelectItem>
                          <SelectItem value="4">Kwiecień</SelectItem>
                          <SelectItem value="5">Maj</SelectItem>
                          <SelectItem value="6">Czerwiec</SelectItem>
                          <SelectItem value="7">Lipiec</SelectItem>
                          <SelectItem value="8">Sierpień</SelectItem>
                          <SelectItem value="9">Wrzesień</SelectItem>
                          <SelectItem value="10">Październik</SelectItem>
                          <SelectItem value="11">Listopad</SelectItem>
                          <SelectItem value="12">Grudzień</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Filter Type: Range */}
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
                            {startDate ? format(startDate, "PPP", { locale: pl }) : "Wybierz datę"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
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
                            {endDate ? format(endDate, "PPP", { locale: pl }) : "Wybierz datę"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
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

                {/* Filter Type: User */}
                {filterType === "user" && (
                  <div className="space-y-2">
                    <Label>Użytkownik</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz użytkownika" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user: { id: string; name: string; email: string }) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label>Status próśb</Label>
                  <Select
                    value={selectedStatuses[0]}
                    onValueChange={(value) => setSelectedStatuses([value])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie</SelectItem>
                      <SelectItem value="approved">Zatwierdzone</SelectItem>
                      <SelectItem value="rejected">Odrzucone</SelectItem>
                      <SelectItem value="pending">Oczekujące</SelectItem>
                      <SelectItem value="rozliczono">Rozliczono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleStartDeletion} variant="destructive" className="flex-1">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Rozpocznij usuwanie
                  </Button>
                  <Button onClick={handleClose} variant="outline">
                    Anuluj
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Password Confirmation */}
            {step === "password" && (
              <div className="space-y-4">
                <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                          Potwierdź usuwanie
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Wprowadź swoje hasło administratora aby potwierdzić usunięcie próśb o budżet.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Hasło administratora</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Wprowadź hasło"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && password) {
                        handleConfirmPassword();
                      }
                    }}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleConfirmPassword}
                    variant="destructive"
                    className="flex-1"
                    disabled={!password}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Potwierdź i usuń
                  </Button>
                  <Button onClick={handleReset} variant="outline">
                    Wstecz
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Deleting */}
            {step === "deleting" && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Usuwanie w toku...
                    </div>
                    <Progress value={progress} className="h-2" />
                  </CardContent>
                </Card>

                {/* Logs */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <Label>Logi operacji</Label>
                      <ScrollArea className="h-[300px] w-full rounded border bg-muted/50 p-4" ref={logRef}>
                        <div className="space-y-1 font-mono text-xs">
                          {logs.map((log) => (
                            <div
                              key={log.id}
                              className={cn(
                                "flex gap-2",
                                log.type === "error" && "text-destructive",
                                log.type === "success" && "text-green-600 dark:text-green-400",
                                log.type === "warning" && "text-amber-600 dark:text-amber-400",
                                log.type === "info" && "text-muted-foreground"
                              )}
                            >
                              <span className="text-muted-foreground">[{log.timestamp}]</span>
                              <span>{log.message}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 4: Complete */}
            {step === "complete" && (
              <div className="space-y-4">
                <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                          Operacja zakończona
                        </p>
                        <p className="text-xs text-green-800 dark:text-green-200">
                          Usunięto {deletedCount} próśb o budżet
                          {failedCount > 0 && ` (${failedCount} błędów)`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Logs */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <Label>Logi operacji</Label>
                      <ScrollArea className="h-[300px] w-full rounded border bg-muted/50 p-4" ref={logRef}>
                        <div className="space-y-1 font-mono text-xs">
                          {logs.map((log) => (
                            <div
                              key={log.id}
                              className={cn(
                                "flex gap-2",
                                log.type === "error" && "text-destructive",
                                log.type === "success" && "text-green-600 dark:text-green-400",
                                log.type === "warning" && "text-amber-600 dark:text-amber-400",
                                log.type === "info" && "text-muted-foreground"
                              )}
                            >
                              <span className="text-muted-foreground">[{log.timestamp}]</span>
                              <span>{log.message}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleClose} className="flex-1">
                    Zamknij
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
