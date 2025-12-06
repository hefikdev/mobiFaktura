"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { Loader2, FileText, AlignCenter } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => {
        setLockoutSeconds(lockoutSeconds - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockoutSeconds === 0) {
      setIsLocked(false);
    }
  }, [lockoutSeconds, isLocked]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Reset lockout state on success
      setIsLocked(false);
      setLockoutSeconds(0);
      
      // Check if user is admin
      if (data.user.role !== "admin") {
        toast({
          title: "Brak dostępu",
          description: "To konto nie ma uprawnień administratora.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Zalogowano pomyślnie",
        description: `Witaj, ${data.user.name}!`,
      });
      
      router.push("/a/admin");
      router.refresh();
    },
    onError: (error) => {
      // Check if error is due to too many attempts
      if (error.data?.code === "TOO_MANY_REQUESTS") {
        // Extract seconds from error message
        const match = error.message.match(/za (\d+) sekund/);
        if (match && match[1]) {
          const seconds = parseInt(match[1]);
          setIsLocked(true);
          setLockoutSeconds(seconds);
        }
      }
      
      toast({
        title: "Błąd logowania",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const devAdminLoginMutation = trpc.auth.devAdminLogin.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Zalogowano jako Dev Admin",
        description: "Tryb developerski aktywny",
      });
      router.push("/a/admin");
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLocked) {
      loginMutation.mutate({ email, password });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">mobiFaktura</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Panel Administracyjny
          </p>
        </div>

        <Card className="border-primary/20">
        <CardHeader/>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending || isLocked}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logowanie...
                  </>
                ) : isLocked ? (
                  `Poczekaj (${lockoutSeconds}s)`
                ) : (
                  <>
                    Zaloguj
                  </>
                )}
              </Button>
              {isLocked && (
                <p className="text-sm text-destructive text-center">
                  Zbyt wiele nieudanych prób logowania.
                </p>
              )}
              
              {process.env.NODE_ENV === "development" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => devAdminLoginMutation.mutate()}
                  disabled={devAdminLoginMutation.isPending}
                >
                  {devAdminLoginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logowanie...
                    </>
                  ) : (
                    <>
                      🔧 Test Login (Development Only)
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
