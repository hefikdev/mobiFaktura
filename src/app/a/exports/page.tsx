"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { AdminHeader } from "@/components/admin-header";
import { AccountantHeader } from "@/components/accountant-header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, FileSpreadsheet, FileText, Download, Calendar as CalendarIcon, Settings2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Unauthorized } from "@/components/unauthorized";

type ReportType = "invoices" | "advances" | "budgetRequests" | "saldo" | "corrections";

interface ColumnConfig {
  id: string;
  label: string;
  enabled: boolean;
}

interface ReportConfig {
  type: ReportType;
  enabled: boolean;
  params: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    includeUUIDs?: boolean;
    includeKSeF?: boolean;
    transactionTypes?: string;
    // Column selection
    columns?: ColumnConfig[];
    // Sorting
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    // Grouping
    groupBy?: string;
    // Formatting
    currencyFormat?: "PLN" | "EUR" | "USD";
    showCurrencySymbol?: boolean;
    // File options
    fileName?: string;
    sheetName?: string;
    includeTimestamp?: boolean;
  };
}

export default function ExportsPage() {
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();
  
  const generateReportMutation = trpc.exports.generateMixedReport.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.fileName || `raport_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Sukces!",
          description: "Raport został wygenerowany i pobrany.",
        });
        
        // Reset to step 1
        setStep(1);
        setIsGenerating(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wygenerować raportu.",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reportConfigs, setReportConfigs] = useState<Record<ReportType, ReportConfig>>({
    invoices: {
      type: "invoices",
      enabled: false,
      params: {
        dateFrom: undefined,
        dateTo: undefined,
        status: "all",
        includeUUIDs: true,
        includeKSeF: true,
        columns: [
          { id: "invoiceNumber", label: "Numer faktury", enabled: true },
          { id: "companyName", label: "Firma", enabled: true },
          { id: "userName", label: "Użytkownik", enabled: true },
          { id: "kwota", label: "Kwota", enabled: true },
          { id: "status", label: "Status", enabled: true },
          { id: "ksefNumber", label: "Numer KSeF", enabled: true },
          { id: "createdAt", label: "Data utworzenia", enabled: true },
          { id: "reviewedAt", label: "Data weryfikacji", enabled: false },
          { id: "description", label: "Opis", enabled: false },
          { id: "id", label: "UUID", enabled: false },
          { id: "companyId", label: "UUID firmy", enabled: false },
          { id: "userId", label: "UUID użytkownika", enabled: false },
        ],
        sortBy: "createdAt",
        sortOrder: "desc",
        groupBy: "none",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
        fileName: "faktury",
        sheetName: "Faktury",
        includeTimestamp: true,
      },
    },
    advances: {
      type: "advances",
      enabled: false,
      params: {
        dateFrom: undefined,
        dateTo: undefined,
        status: "all",
        includeUUIDs: true,
        columns: [
          { id: "userName", label: "Użytkownik", enabled: true },
          { id: "companyName", label: "Firma", enabled: true },
          { id: "amount", label: "Kwota", enabled: true },
          { id: "status", label: "Status", enabled: true },
          { id: "createdAt", label: "Data utworzenia", enabled: true },
          { id: "transferDate", label: "Data przelewu", enabled: true },
          { id: "settledAt", label: "Data rozliczenia", enabled: false },
          { id: "description", label: "Opis", enabled: false },
          { id: "id", label: "UUID", enabled: false },
          { id: "userId", label: "UUID użytkownika", enabled: false },
          { id: "companyId", label: "UUID firmy", enabled: false },
        ],
        sortBy: "createdAt",
        sortOrder: "desc",
        groupBy: "none",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
        fileName: "zaliczki",
        sheetName: "Zaliczki",
        includeTimestamp: true,
      },
    },
    budgetRequests: {
      type: "budgetRequests",
      enabled: false,
      params: {
        dateFrom: undefined,
        dateTo: undefined,
        status: "all",
        includeUUIDs: true,
        columns: [
          { id: "userName", label: "Wnioskujący", enabled: true },
          { id: "companyName", label: "Firma", enabled: true },
          { id: "requestedAmount", label: "Kwota", enabled: true },
          { id: "status", label: "Status", enabled: true },
          { id: "createdAt", label: "Data wniosku", enabled: true },
          { id: "approvedAt", label: "Data akceptacji", enabled: false },
          { id: "description", label: "Opis", enabled: false },
          { id: "id", label: "UUID", enabled: false },
          { id: "userId", label: "UUID użytkownika", enabled: false },
          { id: "companyId", label: "UUID firmy", enabled: false },
        ],
        sortBy: "createdAt",
        sortOrder: "desc",
        groupBy: "none",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
        fileName: "wnioski_budzetowe",
        sheetName: "Wnioski budżetowe",
        includeTimestamp: true,
      },
    },
    saldo: {
      type: "saldo",
      enabled: false,
      params: {
        dateFrom: undefined,
        dateTo: undefined,
        transactionTypes: "all",
        includeUUIDs: true,
        columns: [
          { id: "userName", label: "Użytkownik", enabled: true },
          { id: "companyName", label: "Firma", enabled: true },
          { id: "amount", label: "Kwota", enabled: true },
          { id: "type", label: "Typ", enabled: true },
          { id: "balance", label: "Saldo po operacji", enabled: true },
          { id: "createdAt", label: "Data", enabled: true },
          { id: "description", label: "Opis", enabled: false },
          { id: "id", label: "UUID transakcji", enabled: false },
          { id: "userId", label: "UUID użytkownika", enabled: false },
          { id: "companyId", label: "UUID firmy", enabled: false },
        ],
        sortBy: "createdAt",
        sortOrder: "desc",
        groupBy: "none",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
        fileName: "transakcje_saldo",
        sheetName: "Saldo",
        includeTimestamp: true,
      },
    },
    corrections: {
      type: "corrections",
      enabled: false,
      params: {
        dateFrom: undefined,
        dateTo: undefined,
        includeUUIDs: true,
        columns: [
          { id: "invoiceNumber", label: "Numer korekty", enabled: true },
          { id: "originalInvoiceNumber", label: "Faktura oryginalna", enabled: true },
          { id: "companyName", label: "Firma", enabled: true },
          { id: "userName", label: "Użytkownik", enabled: true },
          { id: "correctionAmount", label: "Kwota korekty", enabled: true },
          { id: "status", label: "Status", enabled: true },
          { id: "createdAt", label: "Data utworzenia", enabled: true },
          { id: "description", label: "Opis", enabled: false },
          { id: "id", label: "UUID", enabled: false },
          { id: "originalInvoiceId", label: "UUID faktury oryginalnej", enabled: false },
        ],
        sortBy: "createdAt",
        sortOrder: "desc",
        groupBy: "none",
        currencyFormat: "PLN",
        showCurrencySymbol: true,
        fileName: "korekty",
        sheetName: "Korekty",
        includeTimestamp: true,
      },
    },
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "pdf">("xlsx");

  const reportTypeLabels: Record<ReportType, string> = {
    invoices: "Faktury",
    advances: "Zaliczki",
    budgetRequests: "Wnioski budżetowe",
    saldo: "Transakcje saldo",
    corrections: "Faktury korygujące",
  };

  const reportDescriptions: Record<ReportType, string> = {
    invoices: "Wszystkie faktury z numerami, statusami, kwotami, numerami KSeF i UUID",
    advances: "Zaliczki użytkowników z datami, kwotami, statusami i UUID",
    budgetRequests: "Wnioski o zasilenie salda ze statusami i historią",
    saldo: "Transakcje saldo wszystkich użytkowników z typami operacji",
    corrections: "Faktury korygujące z oryginaln ymi fakturami i kwotami korekty",
  };

  const toggleReport = (type: ReportType) => {
    setReportConfigs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        enabled: !prev[type].enabled,
      },
    }));
  };

  const updateReportParam = (type: ReportType, param: string, value: unknown) => {
    setReportConfigs((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        params: {
          ...prev[type].params,
          [param]: value,
        },
      },
    }));
  };

  const toggleColumn = (type: ReportType, columnId: string) => {
    setReportConfigs((prev) => {
      const columns = prev[type].params.columns || [];
      const updatedColumns = columns.map((col) =>
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      );
      return {
        ...prev,
        [type]: {
          ...prev[type],
          params: {
            ...prev[type].params,
            columns: updatedColumns,
          },
        },
      };
    });
  };

  const handleGenerate = async () => {
    const enabledReports = Object.values(reportConfigs).filter((config) => config.enabled);
    
    if (enabledReports.length === 0) {
      toast({
        title: "Błąd",
        description: "Wybierz przynajmniej jeden raport",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    toast({
      title: "Generowanie raportu",
      description: `Tworzenie raportu z ${enabledReports.length} arkuszy...`,
    });

    // Call TRPC endpoint to generate the report
    generateReportMutation.mutate({
      reports: enabledReports,
      exportFormat: exportFormat,
    });
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || (user.role !== "accountant" && user.role !== "admin")) {
    return <Unauthorized />;
  }

  const enabledReportsCount = Object.values(reportConfigs).filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className={cn("flex items-center gap-2", step >= 1 && "text-primary")}>
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold",
              step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              1
            </div>
            <span className="hidden sm:inline">Wybór raportów</span>
          </div>
          <Separator className="w-12" />
          <div className={cn("flex items-center gap-2", step >= 2 && "text-primary")}>
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold",
              step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              2
            </div>
            <span className="hidden sm:inline">Konfiguracja</span>
          </div>
          <Separator className="w-12" />
          <div className={cn("flex items-center gap-2", step >= 3 && "text-primary")}>
            <div className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold",
              step >= 3 ? "border-primary bg-primary text-primary-foreground" : "border-muted"
            )}>
              3
            </div>
            <span className="hidden sm:inline">Generowanie</span>
          </div>
        </div>

        {/* Step 1: Select Report Types */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Wybierz typy raportów</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {(Object.keys(reportTypeLabels) as ReportType[]).map((type) => (
                  <div
                    key={type}
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                      reportConfigs[type].enabled
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() => toggleReport(type)}
                  >
                    <Checkbox
                      checked={reportConfigs[type].enabled}
                      onCheckedChange={() => toggleReport(type)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label className="text-base font-semibold cursor-pointer">
                        {reportTypeLabels[type]}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {reportDescriptions[type]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Wybrano: {enabledReportsCount} {enabledReportsCount === 1 ? "raport" : "raporty"}
                </div>
                <Button
                  onClick={() => setStep(2)}
                  disabled={enabledReportsCount === 0}
                >
                  Dalej <Settings2 className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Configure Reports */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Konfiguracja raportów</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={Object.keys(reportConfigs).find((k) => reportConfigs[k as ReportType].enabled) || "invoices"}>
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {(Object.keys(reportConfigs) as ReportType[])
                    .filter((type) => reportConfigs[type].enabled)
                    .map((type) => (
                      <TabsTrigger key={type} value={type} className="text-xs sm:text-sm">
                        {reportTypeLabels[type]}
                      </TabsTrigger>
                    ))}
                </TabsList>
                
                {(Object.keys(reportConfigs) as ReportType[])
                  .filter((type) => reportConfigs[type].enabled)
                  .map((type) => (
                    <TabsContent key={type} value={type} className="space-y-4 mt-4">
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label>Zakres dat</Label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "flex-1 justify-start text-left font-normal",
                                    !reportConfigs[type].params.dateFrom && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {reportConfigs[type].params.dateFrom ? (
                                    format(new Date(reportConfigs[type].params.dateFrom), "PPP", { locale: pl })
                                  ) : (
                                    <span>Od</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={reportConfigs[type].params.dateFrom ? new Date(reportConfigs[type].params.dateFrom) : undefined}
                                  onSelect={(date) => updateReportParam(type, "dateFrom", date?.toISOString())}
                                  locale={pl}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "flex-1 justify-start text-left font-normal",
                                    !reportConfigs[type].params.dateTo && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {reportConfigs[type].params.dateTo ? (
                                    format(new Date(reportConfigs[type].params.dateTo), "PPP", { locale: pl })
                                  ) : (
                                    <span>Do</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={reportConfigs[type].params.dateTo ? new Date(reportConfigs[type].params.dateTo) : undefined}
                                  onSelect={(date) => updateReportParam(type, "dateTo", date?.toISOString())}
                                  locale={pl}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {type !== "corrections" && type !== "saldo" && (
                          <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select
                              value={reportConfigs[type].params.status}
                              onValueChange={(value) => updateReportParam(type, "status", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Wszystkie</SelectItem>
                                {type === "invoices" && (
                                  <>
                                    <SelectItem value="pending">Oczekujące</SelectItem>
                                    <SelectItem value="in_review">W trakcie</SelectItem>
                                    <SelectItem value="accepted">Zaakceptowane</SelectItem>
                                    <SelectItem value="rejected">Odrzucone</SelectItem>
                                  </>
                                )}
                                {type === "advances" && (
                                  <>
                                    <SelectItem value="pending">Oczekujące</SelectItem>
                                    <SelectItem value="transferred">Przelane</SelectItem>
                                    <SelectItem value="settled">Rozliczone</SelectItem>
                                  </>
                                )}
                                {type === "budgetRequests" && (
                                  <>
                                    <SelectItem value="pending">Oczekujące</SelectItem>
                                    <SelectItem value="approved">Zatwierdzone</SelectItem>
                                    <SelectItem value="rejected">Odrzucone</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${type}-uuids`}
                            checked={reportConfigs[type].params.includeUUIDs}
                            onCheckedChange={(checked: boolean | 'indeterminate') => updateReportParam(type, "includeUUIDs", checked === true)}
                          />
                          <Label htmlFor={`${type}-uuids`} className="font-normal cursor-pointer">
                            Uwzględnij UUID w raporcie
                          </Label>
                        </div>

                        {type === "invoices" && (
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="includeKSeF"
                              checked={reportConfigs[type].params.includeKSeF}
                              onCheckedChange={(checked: boolean | 'indeterminate') => updateReportParam(type, "includeKSeF", checked === true)}
                            />
                            <Label htmlFor="includeKSeF" className="font-normal cursor-pointer">
                              Uwzględnij numery KSeF
                            </Label>
                          </div>
                        )}

                        <Separator className="my-4" />

                        {/* Column Selection */}
                        <div className="grid gap-2">
                          <Label className="text-base font-semibold">Wybór kolumn</Label>
                          <p className="text-sm text-muted-foreground">Zaznacz kolumny do uwzględnienia w raporcie</p>
                          <ScrollArea className="h-[200px] rounded-md border p-4">
                            <div className="space-y-2">
                              {reportConfigs[type].params.columns?.map((column) => (
                                <div key={column.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`${type}-col-${column.id}`}
                                    checked={column.enabled}
                                    onCheckedChange={() => toggleColumn(type, column.id)}
                                  />
                                  <Label
                                    htmlFor={`${type}-col-${column.id}`}
                                    className="font-normal cursor-pointer"
                                  >
                                    {column.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        <Separator className="my-4" />

                        {/* Sorting Options */}
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Sortuj według</Label>
                            <Select
                              value={reportConfigs[type].params.sortBy}
                              onValueChange={(value) => updateReportParam(type, "sortBy", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {reportConfigs[type].params.columns
                                  ?.filter((col) => col.enabled)
                                  .map((col) => (
                                    <SelectItem key={col.id} value={col.id}>
                                      {col.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label>Kolejność sortowania</Label>
                            <Select
                              value={reportConfigs[type].params.sortOrder}
                              onValueChange={(value) => updateReportParam(type, "sortOrder", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="asc">Rosnąco</SelectItem>
                                <SelectItem value="desc">Malejąco</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        {/* Formatting Options */}
                        <div className="grid gap-4">
                          <Label className="text-base font-semibold">Opcje formatowania</Label>
                          
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>Waluta</Label>
                              <Select
                                value={reportConfigs[type].params.currencyFormat}
                                onValueChange={(value) => updateReportParam(type, "currencyFormat", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PLN">PLN (zł)</SelectItem>
                                  <SelectItem value="EUR">EUR (€)</SelectItem>
                                  <SelectItem value="USD">USD ($)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${type}-currency-symbol`}
                              checked={reportConfigs[type].params.showCurrencySymbol}
                              onCheckedChange={(checked: boolean | 'indeterminate') => 
                                updateReportParam(type, "showCurrencySymbol", checked === true)
                              }
                            />
                            <Label htmlFor={`${type}-currency-symbol`} className="font-normal cursor-pointer">
                              Pokazuj symbol waluty
                            </Label>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        {/* File Naming Options */}
                        <div className="grid gap-4">
                          <Label className="text-base font-semibold">Opcje pliku</Label>
                          
                          <div className="grid gap-2">
                            <Label>Nazwa pliku</Label>
                            <Input
                              value={reportConfigs[type].params.fileName}
                              onChange={(e) => updateReportParam(type, "fileName", e.target.value)}
                              placeholder="nazwa_pliku"
                            />
                            <p className="text-xs text-muted-foreground">
                              Format: nazwa_pliku_RRRR-MM-DD.xlsx
                            </p>
                          </div>

                          <div className="grid gap-2">
                            <Label>Nazwa arkusza</Label>
                            <Input
                              value={reportConfigs[type].params.sheetName}
                              onChange={(e) => updateReportParam(type, "sheetName", e.target.value)}
                              placeholder="Nazwa arkusza"
                            />
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`${type}-timestamp`}
                              checked={reportConfigs[type].params.includeTimestamp}
                              onCheckedChange={(checked: boolean | 'indeterminate') => 
                                updateReportParam(type, "includeTimestamp", checked === true)
                              }
                            />
                            <Label htmlFor={`${type}-timestamp`} className="font-normal cursor-pointer">
                              Dodaj znacznik czasu do nazwy pliku
                            </Label>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
              </Tabs>

              <div className="flex justify-between pt-6 border-t mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                >
                  Wstecz
                </Button>
                <Button
                  onClick={() => setStep(3)}
                >
                  Dalej <CheckCircle2 className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Generate */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Podsumowanie i generowanie</CardTitle>
              <CardDescription>
                Zawsze sprawdzaj poprawnosc danych po wygenerowaniu raportu !
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base mb-2">Format eksportu</Label>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <Button
                      variant={exportFormat === "xlsx" ? "default" : "outline"}
                      onClick={() => setExportFormat("xlsx")}
                      className="flex-1"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel (XLSX)
                    </Button>
                    <Button
                      variant={exportFormat === "pdf" ? "default" : "outline"}
                      onClick={() => setExportFormat("pdf")}
                      className="flex-1"
                      disabled
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF (wkrótce)
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-base mb-2">Wybrane raporty</Label>
                  <div className="space-y-2 mt-2">
                    {(Object.keys(reportConfigs) as ReportType[])
                      .filter((type) => reportConfigs[type].enabled)
                      .map((type) => (
                        <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                          <div>
                            <p className="font-medium">{reportTypeLabels[type]}</p>
                            <p className="text-sm text-muted-foreground">
                              {reportConfigs[type].params.dateFrom && reportConfigs[type].params.dateTo
                                ? `${format(new Date(reportConfigs[type].params.dateFrom), "dd.MM.yyyy")} - ${format(new Date(reportConfigs[type].params.dateTo), "dd.MM.yyyy")}`
                                : "Wszystkie daty"}
                            </p>
                          </div>
                          <Badge variant="outline">{reportConfigs[type].params.status === "all" ? "Wszystkie" : reportConfigs[type].params.status}</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={isGenerating}
                >
                  Wstecz
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generowanie...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Generuj raport
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Footer />
      </main>
    </div>
  );
}
