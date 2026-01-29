"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import packageJson from "../../../../package.json";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Mail, Shield, LogOut, Globe, Clock, Bell, Lock, Eye, EyeOff } from "lucide-react";
import { formatDateTime } from "@/lib/date-utils";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  
  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Hasło zostało zmienione",
      });
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Błąd",
        description: "Nowe hasła nie są zgodne",
        variant: "destructive",
      });
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };
  
  const updatePreferencesMutation = trpc.auth.updateNotificationPreferences.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await utils.auth.me.cancel();
      
      // Snapshot the previous value
      const previousUser = utils.auth.me.getData();
      
      // Optimistically update to the new value
      if (previousUser) {
        utils.auth.me.setData(undefined, {
          ...previousUser,
          ...variables,
        });
      }
      
      // Return context with the snapshot
      return { previousUser };
    },
    onSuccess: () => {
      toast({
        title: "Zapisano",
        description: "Preferencje powiadomień zostały zaktualizowane",
      });
    },
    onError: (error, variables, context) => {
      // Rollback to previous value on error
      if (context?.previousUser) {
        utils.auth.me.setData(undefined, context.previousUser);
      }
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync
      utils.auth.me.invalidate();
    },
  });
  
  // Get user timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const serverTimezone = "Europe/Warsaw"; // Polish timezone
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast({
        title: "Wylogowano",
        description: "Do zobaczenia!",
      });
      router.push("/login");
      router.refresh();
    },
  });

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? (
        <AdminHeader />
      ) : user?.role === "accountant" ? (
        <AccountantHeader />
      ) : (
        <UserHeader showAddButton={false} />
      )}

      <main className="flex-1 p-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Ładowanie...</p>
            </CardContent>
          </Card>
        ) : user ? (
          <div className="space-y-4">
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <CardTitle></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg">
                      {initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-lg">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Imię i nazwisko</p>
                      <p className="text-sm text-muted-foreground">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Rola</p>
                      <p className="text-sm text-muted-foreground">
                        {user.role === "admin"
                          ? "Administrator"
                          : user.role === "accountant"
                          ? "Księgowy"
                          : "Użytkownik"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Konto utworzone</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Card - Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Bezpieczeństwo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Zmień hasło
                </Button>
              </CardContent>
            </Card>

            {/* Notification Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Preferencje powiadomień
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="disableAll" className="text-sm font-medium">
                      Wyłącz wszystkie powiadomienia
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Globalnie wyłącz wszystkie powiadomienia systemowe
                    </p>
                  </div>
                  <Switch
                    id="disableAll"
                    checked={!(user?.notificationSound ?? true)}
                    onCheckedChange={(checked) => {
                      // When disabling all, set all to false; when enabling, set all to true
                      updatePreferencesMutation.mutate({
                        notificationSound: !checked,
                        notificationInvoiceAccepted: !checked,
                        notificationInvoiceRejected: !checked,
                        notificationInvoiceSubmitted: !checked,
                        notificationInvoiceAssigned: !checked,
                        notificationBudgetRequestSubmitted: !checked,
                        notificationBudgetRequestApproved: !checked,
                        notificationBudgetRequestRejected: !checked,
                      });
                    }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sound" className="text-sm font-medium">
                      Dźwięk powiadomień
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Odtwarzaj dźwięk przy nowych powiadomieniach
                    </p>
                  </div>
                  <Switch
                    id="sound"
                    checked={user?.notificationSound ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationSound: checked,
                      });
                    }}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="accepted" className="text-sm font-medium">
                      Faktura zaakceptowana
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy faktura zostanie zaakceptowana
                    </p>
                  </div>
                  <Switch
                    id="accepted"
                    checked={user?.notificationInvoiceAccepted ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationInvoiceAccepted: checked,
                      });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="rejected" className="text-sm font-medium">
                      Faktura odrzucona
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy faktura zostanie odrzucona
                    </p>
                  </div>
                  <Switch
                    id="rejected"
                    checked={user?.notificationInvoiceRejected ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationInvoiceRejected: checked,
                      });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="submitted" className="text-sm font-medium">
                      Nowa faktura przesłana
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy użytkownik prześle fakturę (tylko księgowi)
                    </p>
                  </div>
                  <Switch
                    id="submitted"
                    checked={user?.notificationInvoiceSubmitted ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationInvoiceSubmitted: checked,
                      });
                    }}
                    disabled={user?.role === "user"}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="assigned" className="text-sm font-medium">
                      Faktura przypisana
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy faktura zostanie przypisana (tylko księgowi)
                    </p>
                  </div>
                  <Switch
                    id="assigned"
                    checked={user?.notificationInvoiceAssigned ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationInvoiceAssigned: checked,
                      });
                    }}
                    disabled={user?.role === "user"}
                  />
                </div>



                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="budgetRequested" className="text-sm font-medium">
                      Prośba o budżet wysłana
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy użytkownik wyśle prośbę o budżet
                    </p>
                  </div>
                  <Switch
                    id="budgetRequested"
                    checked={user?.notificationBudgetRequestSubmitted ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationBudgetRequestSubmitted: checked,
                      });
                    }}
                    disabled={user?.role === "user"}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="budgetApproved" className="text-sm font-medium">
                      Prośba o budżet zaakceptowana
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy Twoja prośba o budżet zostanie zaakceptowana
                    </p>
                  </div>
                  <Switch
                    id="budgetApproved"
                    checked={user?.notificationBudgetRequestApproved ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationBudgetRequestApproved: checked,
                      });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="budgetRejected" className="text-sm font-medium">
                      Prośba o budżet odrzucona
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom gdy Twoja prośba o budżet zostanie odrzucona
                    </p>
                  </div>
                  <Switch
                    id="budgetRejected"
                    checked={user?.notificationBudgetRequestRejected ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationBudgetRequestRejected: checked,
                      });
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Timezone Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Strefa czasowa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Twoja strefa czasowa</p>
                    <p className="text-sm text-muted-foreground">{userTimezone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Strefa czasowa serwera</p>
                    <p className="text-sm text-muted-foreground">{serverTimezone}</p>
                  </div>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Format daty: DD.MM.RRRR (standard polski)
                </div>
              </CardContent>
            </Card>

            {/* App Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Informacje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Aplikacja</span>
                  <span className="font-medium">mobiFaktura</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wersja</span>
                  <span className="font-medium">{packageJson.version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Środowisko</span>
                  <span className="font-medium">Produkcja</span>
                </div>
              </CardContent>
            </Card>

        {/* Password Change Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Zmień hasło</DialogTitle>
              <DialogDescription>
                Wprowadź obecne hasło i wybierz nowe hasło. Hasło musi mieć minimum 8 znaków.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Obecne hasło</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Wprowadź obecne hasło"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nowe hasło</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Wprowadź nowe hasło (min. 8 znaków)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Potwierdź nowe hasło</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Wprowadź ponownie nowe hasło"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                Anuluj
              </Button>
              <Button
                onClick={handlePasswordChange}
                disabled={
                  changePasswordMutation.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {changePasswordMutation.isPending ? "Zmieniam..." : "Zmień hasło"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

            {/* Logout Card */}
            <Card>
              <CardHeader>
                <CardTitle>Sesja</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Wyloguj się
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="hidden md:block">
          <Footer />
        </div>
      </main>
      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
}
