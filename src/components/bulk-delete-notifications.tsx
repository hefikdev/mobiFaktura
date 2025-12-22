"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, AlertTriangle, Bell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkDeleteNotificationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkDeleteNotifications({ 
  open, 
  onOpenChange,
  onSuccess 
}: BulkDeleteNotificationsProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");

  const bulkDeleteMutation = trpc.admin.bulkDeleteAllNotifications.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Sukces",
        description: data.message,
      });
      setPassword("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (!password) {
      toast({
        title: "Błąd",
        description: "Hasło jest wymagane",
        variant: "destructive",
      });
      return;
    }

    bulkDeleteMutation.mutate({ password });
  };

  const handleCancel = () => {
    setPassword("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Usuń wszystkie powiadomienia
          </DialogTitle>
          <DialogDescription>
            Ta operacja usunie wszystkie powiadomienia dla wszystkich użytkowników z bazy danych
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>UWAGA:</strong> Ta operacja jest nieodwracalna i usunie WSZYSTKIE powiadomienia
              z całego systemu dla wszystkich użytkowników.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Twoje hasło administratora</Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="Wprowadź hasło aby potwierdzić"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !bulkDeleteMutation.isPending) {
                  handleDelete();
                }
              }}
              disabled={bulkDeleteMutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={bulkDeleteMutation.isPending}
          >
            Anuluj
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={bulkDeleteMutation.isPending || !password}
          >
            {bulkDeleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Usuń wszystkie powiadomienia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
