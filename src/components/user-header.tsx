"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notification-bell";
import { Plus, User, LogOut, Settings, Menu, Moon, Sun, Wallet } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";

interface UserHeaderProps {
  showAddButton?: boolean;
}

export function UserHeader({ showAddButton = true }: UserHeaderProps) {
  const router = useRouter();
  const { data: user, dataUpdatedAt } = trpc.auth.me.useQuery();
  const { data: saldoData } = trpc.saldo.getMySaldo.useQuery();
  const [lastSync, setLastSync] = useState<string>("");
  const { theme, setTheme } = useTheme();
  
  useEffect(() => {
    if (dataUpdatedAt) {
      const date = new Date(dataUpdatedAt);
      setLastSync(date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
  }, [dataUpdatedAt]);
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
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

  const saldo = saldoData?.saldo || 0;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/a/dashboard" className="font-bold text-lg">
          mobiFaktura
          <span className="text-xs font-normal text-muted-foreground ml-2 hidden sm:inline">
            Panel użytkownika
          </span>
        </Link>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Saldo Badge */}
          <Link href="/a/saldo-history">
            <Badge
              variant={saldo > 0 ? "default" : saldo < 0 ? "destructive" : "secondary"}
              className="cursor-pointer"
            >
              <Wallet className="h-3 w-3 mr-1" />
              {saldo.toFixed(2)} PLN
            </Badge>
          </Link>
          <NotificationBell />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Ustawienia
                  </Link>
                </Button>
                
                <div className="border-t border-b py-2 space-y-1">
                  <p className="text-sm font-medium px-2 mb-2">Motyw</p>
                  <Button
                    variant={theme === "light" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Jasny
                  </Button>
                  <Button
                    variant={theme === "dark" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Ciemny
                  </Button>
                  <Button
                    variant={theme === "system" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setTheme("system")}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Systemowy
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  className="justify-start mt-auto"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Wyloguj się
                </Button>
                
                {lastSync && (
                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Ostatnia synchronizacja: {lastSync}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          {/* Saldo Badge */}
          <Link href="/a/saldo-history">
            <Badge
              variant={saldo > 0 ? "default" : saldo < 0 ? "destructive" : "secondary"}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Wallet className="h-3 w-3 mr-1" />
              {saldo.toFixed(2)} PLN
            </Badge>
          </Link>

          {showAddButton && (
            <Button asChild size="icon" variant="ghost">
              <Link href="/a/upload">
                <Plus className="h-6 w-6" />
                <span className="sr-only">Dodaj fakturę</span>
              </Link>
            </Button>
          )}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.name}
                <p className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/a/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Ustawienia
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Motyw</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Jasny
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Ciemny
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Settings className="mr-2 h-4 w-4" />
                Systemowy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Wyloguj się
              </DropdownMenuItem>
              {lastSync && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Ostatnia synchronizacja: {lastSync}
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
