"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportToCSV, ExportOptions } from "@/lib/export";
import { useToast } from "@/components/ui/use-toast";

interface ExportButtonProps {
  data: any[];
  columns: ExportOptions['columns'];
  filename: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
  onExport?: () => Promise<any[]> | any[];
}

export function ExportButton({
  data,
  columns,
  filename,
  label = "Eksportuj do CSV",
  variant = "outline",
  size = "default",
  disabled = false,
  className = "",
  onExport,
}: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let exportData = data;

      if (onExport) {
        const result = onExport();
        if (result instanceof Promise) {
          exportData = await result;
        } else {
          exportData = result;
        }
      }

      if (exportData.length === 0) {
        toast({
          title: "Brak danych",
          description: "Nie ma danych do eksportu",
          variant: "destructive",
        });
        return;
      }

      exportToCSV({
        data: exportData,
        columns,
        filename,
      });

      toast({
        title: "Sukces",
        description: "Dane zostały wyeksportowane do pliku CSV",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas eksportu danych",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || isExporting || (!onExport && data.length === 0)}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {isExporting ? "Eksportowanie..." : label}
    </Button>
  );
}