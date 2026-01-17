import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PasswordConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  warningMessage?: string;
  onConfirm: (password: string) => void;
  isPending?: boolean;
  confirmButtonText?: string;
}

export function PasswordConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  warningMessage = "⚠️ Ta operacja jest NIEODWRACALNA.",
  onConfirm,
  isPending = false,
  confirmButtonText = "Potwierdź",
}: PasswordConfirmationDialogProps) {
  const [password, setPassword] = useState("");

  const handleConfirm = () => {
    if (password) {
      onConfirm(password);
    }
  };

  const handleClose = () => {
    setPassword("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <p className="text-sm">{description}</p>
          <p className="text-sm font-semibold text-destructive">
            {warningMessage}
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Twoje hasło administratora</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Wprowadź hasło aby potwierdzić"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !isPending) {
                  handleConfirm();
                }
              }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isPending}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending || !password}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Przetwarzanie...
                </>
              ) : (
                confirmButtonText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
