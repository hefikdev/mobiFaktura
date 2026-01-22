"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, FileSpreadsheet, Settings2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface ColumnConfig {
  id: string;
  label: string;
  enabled: boolean;
}

interface AdvancedExportDialogProps {
  reportType: "advances" | "invoices" | "budgetRequests";
  defaultColumns: ColumnConfig[];
  defaultFileName: string;
  defaultSheetName: string;
  statusOptions?: Array<{ value: string; label: string }>;
  additionalFilters?: React.ReactNode;
  onExport: (config: {
    columns: ColumnConfig[];
    sortBy: string;
    sortOrder: "asc" | "desc";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName: string;
    sheetName: string;
    includeTimestamp: boolean;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => Promise<void>;
  trigger?: React.ReactNode;
  disabled?: boolean;
}

export function AdvancedExportDialog({
  reportType,
  defaultColumns,
  defaultFileName,
  defaultSheetName,
  statusOptions = [],
  additionalFilters,
  onExport,
  trigger,
  disabled = false,
}: AdvancedExportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Configuration state
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [sortBy, setSortBy] = useState(defaultColumns[0]?.id || "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currencyFormat, setCurrencyFormat] = useState<"PLN" | "EUR" | "USD">("PLN");
  const [showCurrencySymbol, setShowCurrencySymbol] = useState(true);
  const [fileName, setFileName] = useState(defaultFileName);
  const [sheetName, setSheetName] = useState(defaultSheetName);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setColumns(defaultColumns);
      setSortBy(defaultColumns[0]?.id || "createdAt");
      setSortOrder("desc");
      setCurrencyFormat("PLN");
      setShowCurrencySymbol(true);
      setFileName(defaultFileName);
      setSheetName(defaultSheetName);
      setIncludeTimestamp(true);
      setStatus("all");
      setDateFrom("");
      setDateTo("");
      setStep(1);
    }
  }, [open, defaultColumns, defaultFileName, defaultSheetName]);

  const toggleColumn = (columnId: string) => {
    setColumns(prev =>
      prev.map(col => (col.id === columnId ? { ...col, enabled: !col.enabled } : col))
    );
  };

  const toggleAllColumns = () => {
    const allEnabled = columns.every(col => col.enabled);
    setColumns(prev => prev.map(col => ({ ...col, enabled: !allEnabled })));
  };

  const enabledColumnsCount = columns.filter(col => col.enabled).length;

  const handleExport = async () => {
    if (enabledColumnsCount === 0) {
      toast({
        title: "Błąd",
        description: "Wybierz przynajmniej jedną kolumnę do eksportu",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      await onExport({
        columns,
        sortBy,
        sortOrder,
        currencyFormat,
        showCurrencySymbol,
        fileName,
        sheetName,
        includeTimestamp,
        status: status !== "all" ? status : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setOpen(false);
      toast({
        title: "Sukces!",
        description: "Raport został wygenerowany i pobrany.",
      });
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wygenerować raportu.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const sortableColumns = columns.filter(col => col.enabled);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="default" disabled={disabled}>
            <Download className="h-4 w-4 mr-2" />
            Eksportuj
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Zaawansowany eksport
          </DialogTitle>
          <DialogDescription>
            Skonfiguruj opcje eksportu i wygeneruj raport Excel
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {step === 1 && (
            <div className="space-y-6">
              {/* Filters Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <h3 className="font-semibold">Filtry</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {statusOptions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Wszystkie</SelectItem>
                          {statusOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Data od</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data do</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </div>

                {additionalFilters}
              </div>

              <Separator />

              {/* Column Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Kolumny</h3>
                    <Badge variant="secondary">{enabledColumnsCount} z {columns.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllColumns}
                  >
                    {columns.every(col => col.enabled) ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {columns.map(column => (
                    <div key={column.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={column.id}
                        checked={column.enabled}
                        onCheckedChange={() => toggleColumn(column.id)}
                      />
                      <Label
                        htmlFor={column.id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {column.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Sorting */}
              <div className="space-y-3">
                <h3 className="font-semibold">Sortowanie</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sortuj według</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortableColumns.map(col => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Kolejność</Label>
                    <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as "asc" | "desc")}>
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
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Formatting Options */}
              <div className="space-y-3">
                <h3 className="font-semibold">Formatowanie</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Waluta</Label>
                    <Select value={currencyFormat} onValueChange={(val) => setCurrencyFormat(val as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLN">PLN</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showCurrencySymbol"
                    checked={showCurrencySymbol}
                    onCheckedChange={(checked) => setShowCurrencySymbol(checked as boolean)}
                  />
                  <Label htmlFor="showCurrencySymbol" className="cursor-pointer">
                    Pokaż symbol waluty
                  </Label>
                </div>
              </div>

              <Separator />

              {/* File Options */}
              <div className="space-y-3">
                <h3 className="font-semibold">Opcje pliku</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileName">Nazwa pliku</Label>
                    <Input
                      id="fileName"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder={defaultFileName}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sheetName">Nazwa arkusza</Label>
                    <Input
                      id="sheetName"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder={defaultSheetName}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTimestamp"
                      checked={includeTimestamp}
                      onCheckedChange={(checked) => setIncludeTimestamp(checked as boolean)}
                    />
                    <Label htmlFor="includeTimestamp" className="cursor-pointer">
                      Dodaj znacznik czasu do nazwy pliku
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button
              variant={step === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setStep(1)}
            >
              1. Dane
            </Button>
            <Button
              variant={step === 2 ? "default" : "outline"}
              size="sm"
              onClick={() => setStep(2)}
            >
              2. Format
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isExporting}>
              Anuluj
            </Button>
            <Button onClick={handleExport} disabled={isExporting || enabledColumnsCount === 0}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generowanie...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Eksportuj
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
