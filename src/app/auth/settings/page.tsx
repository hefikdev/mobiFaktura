"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import packageJson from "../../../../package.json";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Footer } from "@/components/footer";
import { User, Mail, Shield, LogOut, KeyRound } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  
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
                        {new Date(user.createdAt).toLocaleDateString("pl-PL", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
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
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Skontaktuj się z administratorem w celu zmiany hasła
              </p>
              <Button 
                className="w-full" 
                onClick={() => setPasswordDialogOpen(false)}
              >
                Rozumiem
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="text-center mt-6">
          <Footer />
        </div>
      </main>
    </div>
  );
}
