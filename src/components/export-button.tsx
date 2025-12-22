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
}: ExportButtonProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (data.length === 0) {
      toast({
        title: "Brak danych",
        description: "Nie ma danych do eksportu",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      exportToCSV({
        data,
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
      disabled={disabled || isExporting || data.length === 0}
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