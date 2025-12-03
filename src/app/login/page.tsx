"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Zalogowano pomyślnie",
        description: `Witaj, ${data.user.name}!`,
      });
      // Redirect based on role
      if (data.user.role === "admin") {
        // Redirect admin to admin login page
        toast({
          title: "Użyj panelu administratora",
          description: "Zaloguj się przez /admlogin",
          variant: "destructive",
        });
        return;
      } else if (data.user.role === "accountant") {
        router.push("/auth/accountant");
      } else {
        router.push("/auth/dashboard");
      }
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Błąd logowania",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">mobiFaktura</h1>
          <p className="text-muted-foreground mt-2">
            System zarządzania fakturami
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Logowanie</CardTitle>
            <CardDescription>
              Wprowadź swoje dane, aby się zalogować
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jan@example.com"
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
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logowanie...
                  </>
                ) : (
                  "Zaloguj się"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Dostęp ograniczony. Próby nieautoryzowanego dostępu są monitorowane.
        </p>
        <div className="text-center mt-4">
          <Footer />
        </div>
      </div>
    </div>
  );
}
