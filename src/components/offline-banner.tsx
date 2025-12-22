"use client";

import { AlertTriangle, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OfflineBannerProps {
  isOnline: boolean;
  showWarning: boolean;
  onDismiss: () => void;
  onRefresh: () => void;
}

export function OfflineBanner({
  isOnline,
  showWarning,
  onDismiss,
  onRefresh,
}: OfflineBannerProps) {
  if (isOnline && !showWarning) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top">
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <WifiOff className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Tryb offline</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-transparent"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <p className="text-sm">
            Aplikacja działa w trybie offline. Możesz przeglądać swoje faktury i saldo,
            ale dane mogą nie być aktualne. Aby synchronizować najnowsze dane,
            połącz się z internetem.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={onRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież aplikację
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function OfflineConnectionBanner({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
      <WifiOff className="h-16 w-16 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Brak połączenia z internetem</h3>
        <p className="text-muted-foreground max-w-md">
          Aby kontynuować, połącz się z internetem i odśwież stronę.
        </p>
      </div>
      <Button onClick={onRefresh} size="lg">
        <RefreshCw className="mr-2 h-5 w-5" />
        Odśwież
      </Button>
    </div>
  );
}

interface OfflineUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function OfflineUploadDialog({
  open,
  onClose,
  onRefresh,
}: OfflineUploadDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold">
              Wymagane połączenie z internetem
            </h3>
            <p className="text-sm text-muted-foreground">
              Aby przesłać pliki, musisz być połączony z internetem. Połącz się
              i odśwież stronę, aby kontynuować.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież
          </Button>
        </div>
      </div>
    </div>
  );
}
