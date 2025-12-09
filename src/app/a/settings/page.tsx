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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, LogOut, KeyRound, Globe, Clock, Bell, Volume2 } from "lucide-react";
import { formatDateTime } from "@/lib/date-utils";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Hasło zmienione",
        description: "Twoje hasło zostało pomyślnie zmienione",
      });
      setPasswordDialogOpen(false);
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
  
  const updatePreferencesMutation = trpc.auth.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast({
        title: "Zapisano",
        description: "Preferencje powiadomień zostały zaktualizowane",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
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

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Błąd",
        description: "Nowe hasła nie są identyczne",
        variant: "destructive",
      });
      return;
    }
    
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

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
        <h2 className="text-xl font-semibold mb-4">Ustawienia</h2>

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
                <CardTitle>Profil</CardTitle>
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

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="rereview" className="text-sm font-medium">
                      Ponowna weryfikacja
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Powiadom o fakturach wymagających ponownej weryfikacji
                    </p>
                  </div>
                  <Switch
                    id="rereview"
                    checked={user?.notificationInvoiceReReview ?? true}
                    onCheckedChange={(checked) => {
                      updatePreferencesMutation.mutate({
                        notificationInvoiceReReview: checked,
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

            {/* Password Change Card */}
            <Card>
              <CardHeader>
                <CardTitle>Bezpieczeństwo</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Zmień hasło
                </Button>
              </CardContent>
            </Card>

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

        {/* Password Change Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zmiana hasła</DialogTitle>
              <DialogDescription>
                Wprowadź obecne hasło i nowe hasło. Nowe hasło musi mieć minimum 8 znaków.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Obecne hasło</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Wprowadź obecne hasło"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nowe hasło</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Wprowadź nowe hasło"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Potwierdź nowe hasło</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Potwierdź nowe hasło"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline"
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={changePasswordMutation.isPending}
              >
                Anuluj
              </Button>
              <Button 
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? "Zmieniam..." : "Zmień hasło"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
