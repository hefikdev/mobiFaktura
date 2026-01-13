"use client";

import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { SearchInput } from "@/components/search-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { ErrorDisplay } from "@/components/error-display";
import { SectionLoader } from "@/components/section-loader";
import { ShieldCheck, Save, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserPermissionsState {
  [userId: string]: Set<string>; // userId -> Set of companyIds
}

export default function PermissionsPage() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionsState, setPermissionsState] = useState<UserPermissionsState>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Check user authorization
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();

  // Fetch data
  const {
    data: usersData,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = trpc.permissions.getAllUserPermissions.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // Initialize permissions state from server data
  useEffect(() => {
    if (usersData) {
      const initialState: UserPermissionsState = {};
      usersData.forEach((userData) => {
        initialState[userData.id] = new Set(
          userData.permissions.map((p) => p.companyId)
        );
      });
      setPermissionsState(initialState);
      setHasChanges(false);
    }
  }, [usersData]);

  const { data: companies, isLoading: loadingCompanies } =
    trpc.permissions.getAllCompanies.useQuery(undefined, {
      enabled: user?.role === "admin",
    });

  // Filter users and companies based on search (declared early to preserve hook order)
  const filteredUsers = useMemo(() => {
    if (!usersData) return [];
    if (!searchQuery) return usersData;
    
    const query = searchQuery.toLowerCase();
    return usersData.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [usersData, searchQuery]);

  // We intentionally do NOT filter the companies list by searchQuery so the matrix columns stay stable
  // Companies remain in full view while search filters only the user rows.

  // Mutation for updating permissions
  const updatePermissionsMutation = trpc.permissions.bulkUpdatePermissions.useMutation({
    onSuccess: () => {
      toast({
        title: "Uprawnienia zapisane",
        description: "Uprawnienia użytkowników zostały pomyślnie zaktualizowane.",
      });
      setHasChanges(false);
      refetchUsers();
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać uprawnień.",
        variant: "destructive",
      });
    },
  });

  // Authorization check
  if (loadingUser) {
    return <SectionLoader />;
  }

  if (!user || user.role !== "admin") {
    return <Unauthorized />;
  }

  // Loading state
  if (loadingUsers || loadingCompanies) {
    return (
      <div>
        <AdminHeader />
        <main className="min-h-screen flex items-center justify-center">
          <SectionLoader />
        </main>
        <div className="hidden md:block">
          <Footer />
        </div>
        <div className="md:hidden">
          <Footer />
        </div>
      </div>
    );
  }

  // Error state
  if (!usersData || !companies) {
    return (
      <div>
        <AdminHeader />
        <main className="container mx-auto px-4 py-8">
          <ErrorDisplay
            title="Błąd ładowania danych"
            message="Nie udało się załadować listy użytkowników lub firm."
          />
        </main>
        <div className="hidden md:block">
          <Footer />
        </div>
        <div className="md:hidden">
          <Footer />
        </div>
      </div>
    );
  }

  // Handle permission toggle
  const togglePermission = (userId: string, companyId: string) => {
    setPermissionsState((prev) => {
      const newState = { ...prev };
      if (!newState[userId]) {
        newState[userId] = new Set();
      }
      const userPermissions = new Set(newState[userId]);
      
      if (userPermissions.has(companyId)) {
        userPermissions.delete(companyId);
      } else {
        userPermissions.add(companyId);
      }
      
      newState[userId] = userPermissions;
      setHasChanges(true);
      return newState;
    });
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(permissionsState).map(([userId, companyIds]) => ({
        userId,
        companyIds: Array.from(companyIds),
      }));

      await updatePermissionsMutation.mutateAsync({ updates });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    // Reset to server data
    const initialState: UserPermissionsState = {};
    usersData.forEach((userData) => {
      initialState[userData.id] = new Set(
        userData.permissions.map((p) => p.companyId)
      );
    });
    setPermissionsState(initialState);
    setHasChanges(false);
    toast({
      title: "Zmiany anulowane",
      description: "Przywrócono oryginalne uprawnienia.",
    });
  };



  // Calculate statistics
  const totalUsers = usersData.length;
  const usersWithPermissions = Object.values(permissionsState).filter(
    (permissions) => permissions.size > 0
  ).length;
  const usersWithoutPermissions = totalUsers - usersWithPermissions;

  return (
    <div>
      <AdminHeader />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Uprawnienia</h1>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Wszyscy użytkownicy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Z uprawnieniami
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {usersWithPermissions}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bez uprawnień
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {usersWithoutPermissions}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Changes alert */}
        {hasChanges && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Masz niezapisane zmiany. Pamiętaj aby zapisać uprawnienia.
            </AlertDescription>
          </Alert>
        )}

        {/* Permissions table */}
        <Card>
          <CardHeader>
            <div className="flex gap-2 flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center">
              <div className="flex-1 min-w-[200px]">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="w-full"
                  placeholder="Szukaj użytkownika (imię lub email)..."
                />
              </div>
              <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Zapisz zmiany
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleReset}
                  disabled={!hasChanges || isSaving}
                  variant="outline"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Anuluj zmiany
                </Button>
              </div>
            </div>
          </div>
          </CardHeader>
          <CardContent>
            {(!companies || companies.length === 0) ? (
              <Alert>
                <AlertDescription>
                  Brak aktywnych firm w systemie. Dodaj firmy aby móc przyznawać uprawnienia.
                </AlertDescription>
              </Alert>
            ) : filteredUsers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  {searchQuery ? "Nie znaleziono użytkowników pasujących do wyszukiwania." : "Brak zwykłych użytkowników w systemie. Administratorzy i księgowi mają dostęp do wszystkich firm."}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px] sticky left-0 bg-background z-10 border-r">
                          Użytkownik
                        </TableHead>
                          {companies.map((company) => (
                          <TableHead key={company.id} className="text-center min-w-[120px] sm:min-w-[150px]">
                            <div className="font-semibold text-xs sm:text-sm">{company.name}</div>
                            {company.nip && (
                              <div className="text-xs text-muted-foreground font-normal hidden sm:block">
                                NIP: {company.nip}
                              </div>
                            )}
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[80px]">
                          Suma
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((userData) => {
                        const userPermissions = permissionsState[userData.id] || new Set();
                        const permissionCount = userPermissions.size;

                        return (
                          <TableRow key={userData.id}>
                            <TableCell className="sticky left-0 bg-background z-10 border-r">
                              <div>
                                <div className="font-medium text-sm">{userData.name}</div>
                              </div>
                            </TableCell>
                            {companies.map((company) => {
                              const hasPermission = userPermissions.has(company.id);
                              return (
                                <TableCell key={company.id} className="text-center">
                                  <div className="flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={hasPermission}
                                      onChange={() =>
                                        togglePermission(userData.id, company.id)
                                      }
                                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                  </div>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              <Badge
                                variant={permissionCount > 0 ? "default" : "secondary"}
                              >
                                {permissionCount}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info box */}
        <Alert className="mt-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Ważne:</strong> Administratorzy i księgowi automatycznie mają dostęp do
            wszystkich firm i nie wymagają przyznawania uprawnień. Uprawnienia dotyczą tylko
            zwykłych użytkowników.
          </AlertDescription>
        </Alert>

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
