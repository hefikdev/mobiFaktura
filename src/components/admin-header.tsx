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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Settings, Shield, User, Calculator, LayoutDashboard, BarChart3, Plus, FileIcon } from "lucide-react";

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
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/auth/admin" className="font-bold text-lg">
          mobiFaktura
          <span className="text-xs font-normal text-muted-foreground ml-2">
            Panel administratora
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {showAddButton && (
            <Button asChild size="icon" variant="ghost">
              <Link href="/auth/upload">
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
            <Link href="/auth/dashboard">
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
            <Link href="/auth/accountant">
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
            <Link href="/auth/invoices">
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
            <Link href="/auth/admin">
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
            <Link href="/auth/analytics">
              <BarChart3 className="mr-1 h-3 w-3" />
              Analityka
            </Link>
          </Button>
          
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
                <Link href="/auth/settings" className="cursor-pointer">
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
