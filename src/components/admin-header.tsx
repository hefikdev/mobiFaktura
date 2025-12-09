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
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { LogOut, Settings, Shield, User, Calculator, LayoutDashboard, BarChart3, Plus, FileIcon, Menu } from "lucide-react";

interface AdminHeaderProps {
  showAddButton?: boolean;
}

export function AdminHeader({ showAddButton = true }: AdminHeaderProps) {
  const router = useRouter();
  const { data: user, dataUpdatedAt } = trpc.auth.me.useQuery();
  const [lastSync, setLastSync] = useState<string>("");
  
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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <Link href="/a/admin" className="font-bold text-base md:text-lg">
          mobiFaktura
          <span className="text-xs font-normal text-muted-foreground ml-2 hidden sm:inline">
            Panel administratora
          </span>
        </Link>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 lg:hidden">
          {showAddButton && (
            <Button asChild size="icon" variant="ghost">
              <Link href="/a/upload">
                <Plus className="h-5 w-5" />
                <span className="sr-only">Dodaj fakturę</span>
              </Link>
            </Button>
          )}
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-3 mt-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials || "A"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Administrator</p>
                  </div>
                </div>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Moje faktury
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/accountant">
                    <Calculator className="mr-2 h-4 w-4" />
                    Księgowy
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/invoices">
                    <FileIcon className="mr-2 h-4 w-4" />
                    Faktury
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/analytics">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analityka
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Ustawienia
                  </Link>
                </Button>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Motyw</span>
                  <ThemeToggle />
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
        <div className="hidden lg:flex items-center gap-2">
          {showAddButton && (
            <Button asChild size="icon" variant="ghost">
              <Link href="/a/upload">
                <Plus className="h-6 w-6" />
                <span className="sr-only">Dodaj fakturę</span>
              </Link>
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <Link href="/a/dashboard">
              <User className="mr-1 h-3 w-3" />
              Moje faktury
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <Link href="/a/accountant">
              <Calculator className="mr-1 h-3 w-3" />
              Księgowy
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <Link href="/a/invoices">
              <FileIcon className="mr-1 h-3 w-3" />
              Faktury
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <Link href="/a/admin">
              <Shield className="mr-1 h-3 w-3" />
              Admin
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-xs"
          >
            <Link href="/a/analytics">
              <BarChart3 className="mr-1 h-3 w-3" />
              Analityka
            </Link>
          </Button>
          
          <NotificationBell />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials || "A"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user?.name}
                <p className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </p>
                <p className="text-xs font-normal text-muted-foreground">
                  Administrator
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/a/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Ustawienia
                </Link>
              </DropdownMenuItem>
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
