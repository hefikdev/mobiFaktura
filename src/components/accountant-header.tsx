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
import { LogOut, Settings, Menu, Plus, FileText, User, BookCheck } from "lucide-react";

interface AccountantHeaderProps {
  lastInvoiceSync?: string;
}

export function AccountantHeader({ lastInvoiceSync }: AccountantHeaderProps) {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  
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
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/a/accountant" className="font-bold text-lg">
          mobiFaktura
          <span className="text-xs font-normal text-muted-foreground ml-2 hidden sm:inline">
            Panel księgowego
          </span>
        </Link>

        {/* Mobile Menu */}
        <div className="flex items-center gap-2 md:hidden">
          <Button asChild size="icon" variant="ghost">
            <Link href="/a/upload">
              <Plus className="h-5 w-5" />
              <span className="sr-only">Dodaj fakturę</span>
            </Link>
          </Button>
          
          <NotificationBell />
          <ThemeToggle />
          
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
                    <AvatarFallback>{initials || "K"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Księgowy</p>
                  </div>
                </div>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/upload">
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj fakturę
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/accountant">
                    <BookCheck className="mr-2 h-4 w-4" />
                    Widok
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Moje faktury
                  </Link>
                </Button>
                
                <Button asChild variant="outline" className="justify-start">
                  <Link href="/a/invoices">
                    <FileText className="mr-2 h-4 w-4" />
                    Wszystkie faktury
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
                
                {lastInvoiceSync && (
                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Ostatnia synchronizacja: {lastInvoiceSync}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link href="/a/upload">
              <Plus className="h-6 w-6" />
              <span className="sr-only">Dodaj fakturę</span>
            </Link>
          </Button>
          
          <Button asChild variant="ghost">
            <Link href="/a/accountant">
              <BookCheck className="mr-2 h-4 w-4" />
              Widok
            </Link>
          </Button>
          
          <Button asChild variant="ghost">
            <Link href="/a/invoices">
              <FileText className="mr-2 h-4 w-4" />
              Faktury
            </Link>
          </Button>

          <Button asChild variant="ghost">
            <Link href="/a/dashboard">
              <User className="mr-2 h-4 w-4" />
              Moje faktury
            </Link>
          </Button>
          
          <NotificationBell />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{initials || "K"}</AvatarFallback>
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
                  Księgowy
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
              {lastInvoiceSync && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Ostatnia synchronizacja: {lastInvoiceSync}
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
