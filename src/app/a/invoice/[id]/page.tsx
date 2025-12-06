"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { AccountantHeader } from "@/components/accountant-header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Check, 
  X, 
  ZoomIn, 
  FileText,
  Building2,
  AlertCircle,
  AlertTriangle,
  User,
  Download,
  Printer,
  ArrowLeft,
  UserIcon,
  UserCircleIcon,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function InvoiceReviewPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invoiceId = params.id as string;
  const { data: user } = trpc.auth.me.useQuery();

  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictReviewerName, setConflictReviewerName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isEditingInvoiceNumber, setIsEditingInvoiceNumber] = useState(false);
  const invoiceNumberInputRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");

  const { data: invoice, isLoading, refetch } = trpc.invoice.getById.useQuery(
    { id: invoiceId },
    {
      enabled: !!invoiceId,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
    }
  );

  // Release review when leaving page
  const releaseReviewMutation = trpc.invoice.releaseReview.useMutation();
  const heartbeatMutation = trpc.invoice.reviewHeartbeat.useMutation();
  const hasReleasedRef = useRef(false);

  // Send heartbeat every 5 seconds while viewing
  useEffect(() => {
    if (!invoiceId || !invoice || invoice.status !== "in_review" || !invoice.isCurrentUserReviewing) {
      return;
    }

    // Send initial heartbeat
    heartbeatMutation.mutate({ id: invoiceId });

    // Setup interval for heartbeat
    const heartbeatInterval = setInterval(() => {
      if (!document.hidden) {
        heartbeatMutation.mutate({ id: invoiceId });
      }
    }, 800); // Send ping every 800 milliseconds

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [invoiceId, invoice?.status, invoice?.isCurrentUserReviewing]);

  // Handle cleanup - release review
  useEffect(() => {
    hasReleasedRef.current = false;

    const releaseReview = () => {
      if (invoiceId && !hasReleasedRef.current) {
        hasReleasedRef.current = true;
        releaseReviewMutation.mutate({ id: invoiceId });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseReview();
      }
    };

    const handleBeforeUnload = () => {
      releaseReview();
    };

    // Listen to visibility and unload
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      releaseReview();
    };
  }, [invoiceId]); // Removed releaseReviewMutation from deps to prevent infinite loop

  // Check for conflict when invoice loads
  useEffect(() => {
    if (invoice && invoice.status === "in_review" && invoice.currentReviewer) {
      // Only show warning if SOMEONE ELSE is reviewing (check by ID)
      // isCurrentUserReviewing is set by backend comparing currentReviewer with ctx.user.id
      if (!invoice.isCurrentUserReviewing) {
        setConflictReviewerName(invoice.currentReviewer.name || "Inny księgowy");
        setShowConflictWarning(true);
      }
    }
  }, [invoice?.id, invoice?.isCurrentUserReviewing]);

  // Pre-fill form when invoice loads
  useEffect(() => {
    if (invoice) {
      setInvoiceNumber(invoice.invoiceNumber || "");
      setDescription(invoice.description || "");
    }
  }, [invoice]);

  // Handle click outside to exit edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditingInvoiceNumber && 
          invoiceNumberInputRef.current && 
          !invoiceNumberInputRef.current.contains(event.target as Node)) {
        setIsEditingInvoiceNumber(false);
        handleSave();
      }
    };

    if (isEditingInvoiceNumber) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditingInvoiceNumber, invoiceNumber, description]);

  const updateMutation = trpc.invoice.updateInvoiceData.useMutation({
    onSuccess: async (data) => {
      await refetch(); // Force immediate refetch
      // Only show toast if changes were actually saved
      if (!data?.noChanges) {
        toast({
          title: "Zapisano",
          description: "Zmiany zostały zapisane",
        });
      }
    },
  });

  const finalizeMutation = trpc.invoice.finalizeReview.useMutation({
    onSuccess: async () => {
      await refetch(); // Force immediate refetch
      toast({
        title: "Przegląd zakończony",
        description: "Faktura została rozpatrzona",
      });
      router.push("/a/accountant");
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

  const handleSave = () => {
    // Only save if there are actual changes
    const hasInvoiceNumberChange = invoiceNumber !== invoice?.invoiceNumber;
    const hasDescriptionChange = description !== invoice?.description;
    
    if (hasInvoiceNumberChange || hasDescriptionChange) {
      updateMutation.mutate({
        id: invoiceId,
        invoiceNumber: hasInvoiceNumberChange ? (invoiceNumber || undefined) : undefined,
        description: hasDescriptionChange ? (description || undefined) : undefined,
      });
    }
  };

  const handleAccept = async () => {
    if (!invoice) return;
    
    // Safety check: verify invoice status before accepting
    const { data: currentInvoice } = await refetch();
    if (currentInvoice?.status === "accepted" || currentInvoice?.status === "rejected") {
      toast({
        title: "Faktura już rozpatrzona",
        description: "Ta faktura została już rozpatrzona przez innego księgowego",
        variant: "destructive",
      });
      router.refresh();
      return;
    }
    
    // Auto-save current changes first
    if (invoiceNumber !== invoice.invoiceNumber || description !== invoice.description) {
      await updateMutation.mutateAsync({
        id: invoiceId,
        invoiceNumber: invoiceNumber || undefined,
        description: description || undefined,
      });
    }
    
    finalizeMutation.mutate({
      id: invoiceId,
      status: "accepted",
    });
  };

  const handleReject = () => {
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!invoice) return;
    
    if (!rejectionReason.trim()) {
      toast({
        title: "Błąd",
        description: "Powód odrzucenia jest wymagany",
        variant: "destructive",
      });
      return;
    }
    
    // Safety check: verify invoice status before rejecting
    const { data: currentInvoice } = await refetch();
    if (currentInvoice?.status === "accepted" || currentInvoice?.status === "rejected") {
      toast({
        title: "Faktura już rozpatrzona",
        description: "Ta faktura została już rozpatrzona przez innego księgowego",
        variant: "destructive",
      });
      setShowRejectDialog(false);
      setRejectionReason("");
      router.refresh();
      return;
    }
    
    finalizeMutation.mutate({
      id: invoiceId,
      status: "rejected",
      rejectionReason: rejectionReason,
    });
    setShowRejectDialog(false);
    setRejectionReason("");
  };

  const handlePrint = () => {
    if (!invoice) return;
    
    // Create a hidden iframe to load and print the image
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; }
              img { width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${invoice.imageUrl}" onload="window.print(); setTimeout(() => document.body.parentElement.remove(), 100);" />
          </body>
        </html>
      `);
      iframeDoc.close();
    }
    
    // Clean up iframe after printing
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  const handleDownload = async () => {
    if (!invoice) return;
    
    try {
      // Fetch the image as a blob
      const response = await fetch(invoice.imageUrl);
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `faktura_${invoice.invoiceNumber || invoiceId}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Pobrano",
        description: "Faktura została pobrana",
      });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać faktury",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {user?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Faktura nie została znaleziona</p>
        </main>
      </div>
    );
  }

  const isReviewing = invoice.status === "in_review";
  const isCompleted = invoice.status === "accepted" || invoice.status === "rejected";
  const canEdit = isReviewing && !isCompleted;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-row items-center gap-2 md:gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => router.push(user?.role === "admin" ? "/a/invoices" : "/a/accountant")}
                title="Powrót"
                className="h-8 w-8 md:h-10 md:w-10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl md:text-2xl font-semibold">Przegląd faktury</h2>
            </div>
            {/* Status badge */}
            <div className="text-right">
              {invoice.status === "pending" && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  Oczekuje
                </span>
              )}
              {invoice.status === "in_review" && invoice.currentReviewer && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    W trakcie przeglądu
                  </span>
                </div>
              )}
              {invoice.status === "accepted" && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Zaakceptowana
                  </span>
                  {invoice.reviewer && invoice.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      przez {invoice.reviewer.name}
                      <br />
                      {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                    </p>
                  )}
                </div>
              )}
              {invoice.status === "rejected" && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                    Odrzucona
                  </span>
                  {invoice.reviewer && invoice.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      przez {invoice.reviewer.name}
                      <br />
                      {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Horizontal layout: Image + Info in middle, Buttons on right */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Left: Image */}
          <div className="w-full lg:w-2/5">
            <Card className="h-full">
              <CardContent className="pt-6">
                <div
                  className="relative cursor-pointer border rounded-lg overflow-hidden"
                  onClick={() => setImageZoomed(true)}
                >
                  <img
                    src={invoice.imageUrl}
                    alt="Faktura"
                    className="w-full h-auto"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle: Form and Info */}
          <div className="w-full lg:w-2/5">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2" ref={invoiceNumberInputRef}>
                  {isEditingInvoiceNumber ? (
                    <Input
                      id="invoiceNumber"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="text-xl md:text-2xl font-bold h-auto py-1"
                      placeholder="Numer faktury"
                      autoFocus
                    />
                  ) : (
                    <CardTitle className="text-xl md:text-2xl">{invoiceNumber || "Brak numeru"}</CardTitle>
                  )}
                  {invoice.ksefNumber && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://www.ksef.gov.pl/${invoice.ksefNumber}`, '_blank')}
                      title="Zobacz KSEF"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>KSeF</span>
                    </Button>
                  )}
                </div>
                <div className="pt-2">
                  {invoice.company && (
                    <p className="text-sm">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      {invoice.company.name}
                    </p>
                  )}
                </div>
                
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-7">
                  {/* Justification (read-only) */}
                  {invoice.justification && (
                    <>
                    <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Uzasadnienie</p>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>{invoice.submitter?.name}</span>
                                </div>
                              </div>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-md min-h-[120px]">
                      <p className="text-sm">
                      {invoice.justification}
                      </p>
                    </div>
                    </>
                  )}

                  <Separator />

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Uwagi</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canEdit}
                      placeholder=""
                      className="h-20"
                    />
                  </div>

                  {/* Edit tracking info */}
                  {invoice.editHistory && invoice.editHistory.length > 0 && (
                    <>
                    <p className="text-sm font-medium">Historia edycji</p>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-md max-h-[120px] overflow-y-auto">
                      <div className="space-y-2">
                        {invoice.editHistory.map((edit: { editor: { name: string } | null; editedAt: Date }, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{edit.editor?.name || "Nieznany"}</span>
                            <span className="text-muted-foreground text-xs">{format(new Date(edit.editedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    </>
                  )}
                  {(!invoice.editHistory || invoice.editHistory.length === 0) && invoice.lastEditor && invoice.lastEditedAt && (
                    <>
                    <p className="text-sm font-medium">Ostatnia edycja</p>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{invoice.lastEditor.name}</span>
                        <span className="text-muted-foreground text-xs">{format(new Date(invoice.lastEditedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}</span>
                      </div>
                    </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-muted-foreground text-sm">
                  Faktura wysłana: {format(new Date(invoice.createdAt), "dd MMM yyyy, HH:mm", { locale: pl })}
                </p>
              </CardFooter>
            </Card>
          </div>

          {/* Right: BIG Action Buttons */}
          {isReviewing && !isCompleted && (user?.role === "accountant" || user?.role === "admin") && (
            <div className="w-full lg:w-48 flex flex-row lg:flex-col gap-3 lg:gap-4">
              <Button
                onClick={handleAccept}
                size="lg"
                disabled={finalizeMutation.isPending}
                className="flex-1 lg:h-32 h-24 text-lg md:text-xl font-bold flex-col gap-2 bg-green-600 hover:bg-green-700"
              >
                {finalizeMutation.isPending ? (
                  <>
                    <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin" />
                    <span className="text-xs md:text-sm font-bold">Przetwarzanie...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-8 w-8 md:h-12 md:w-12 stroke-[3] text-white" />
                    <span className="font-bold text-white text-sm md:text-base">Zaakceptuj</span>
                  </>
                )}
              </Button>

              <Button
                onClick={handleReject}
                variant="destructive"
                size="lg"
                disabled={finalizeMutation.isPending}
                className="flex-1 lg:h-32 h-24 text-lg md:text-xl font-bold flex-col gap-2"
              >
                <X className="h-8 w-8 md:h-12 md:w-12 stroke-[3]" />
                <span className="font-bold text-sm md:text-base">Odrzuć</span>
              </Button>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditingInvoiceNumber) {
                      setIsEditingInvoiceNumber(false);
                      handleSave();
                    } else {
                      setIsEditingInvoiceNumber(true);
                      // Scroll to invoice number input
                      setTimeout(() => {
                        invoiceNumberInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }
                  }}
                  className="hidden lg:flex w-full items-center gap-1 mt-3"
                >
                  <span>{isEditingInvoiceNumber ? 'Zapisz' : 'Edytuj'}</span>
                </Button>
              )}
              <div className="hidden lg:flex flex-row gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrint}
                  title="Drukuj"
                  className="flex items-center gap-1"
                >
                  <Printer className="h-4 w-4" />
                  <span>Drukuj</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownload}
                  title="Pobierz"
                  className="flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Pobierz</span>
                </Button>
              </div>
            </div>
          )}

          {isCompleted && (user?.role === "accountant" || user?.role === "admin") && (
            <div className="w-full lg:w-48">
              <Button
                onClick={() => router.push("/a/invoices")}
                variant="outline"
                size="lg"
                className="w-full h-24 lg:h-32 text-base md:text-lg flex-col gap-2"
              >
                Powrót do listy
              </Button>
            </div>
          )}
        </div>
        
        {/* Mobile action buttons row */}
        {isReviewing && !isCompleted && (user?.role === "accountant" || user?.role === "admin") && (
          <div className="lg:hidden flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrint}
              title="Drukuj"
              className="flex-1 flex items-center justify-center gap-1"
            >
              <Printer className="h-4 w-4" />
              <span>Drukuj</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDownload}
              title="Pobierz"
              className="flex-1 flex items-center justify-center gap-1"
            >
              <Download className="h-4 w-4" />
              <span>Pobierz</span>
            </Button>
            {invoice.ksefNumber && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://www.ksef.gov.pl/${invoice.ksefNumber}`, '_blank')}
                title="Zobacz KSEF"
                className="flex-1 flex items-center justify-center gap-1"
              >
                <FileText className="h-4 w-4" />
                <span>KSeF</span>
              </Button>
            )}
          </div>
        )}
        
        <div className="hidden md:block">
          <Footer />
        </div>
      </main>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Odrzuć fakturę</DialogTitle>
            <DialogDescription>
              Podaj powód odrzucenia. Użytkownik zobaczy tę wiadomość.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Numer faktury:</strong> {invoice.invoiceNumber || "Brak numeru"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Użytkownik:</strong> {invoice.submitter?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Firma:</strong> {invoice.company?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Powód odrzucenia *</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Np. Brak wymaganych dokumentów, nieprawidłowy numer faktury..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectionReason("");
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={finalizeMutation.isPending || !rejectionReason.trim()}
            >
              {finalizeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Odrzucam...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Odrzuć fakturę
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict warning dialog */}
      <Dialog open={showConflictWarning} onOpenChange={setShowConflictWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Ostrzeżenie
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Ta faktura jest już przeglądana przez: <strong>{conflictReviewerName}</strong>
              <br /><br />
              Możesz kontynuować, ale mogą wystąpić konflikty przy jednoczesnej edycji.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowConflictWarning(false)}>
              Rozumiem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image zoom dialog with scrolling */}
      <Dialog open={imageZoomed} onOpenChange={(open) => {
        setImageZoomed(open);
        if (!open) {
          setImageScale(1);
          setImagePosition({ x: 0, y: 0 });
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[95vh] p-2">
          <DialogTitle className="sr-only">Powiększony skan faktury</DialogTitle>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm"
            onClick={() => setImageZoomed(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="relative w-full h-[85vh] overflow-auto scrollbar-hide flex items-start justify-center">
            <img
              src={invoice.imageUrl}
              alt="Faktura - powiększenie"
              className="max-w-full h-auto object-contain cursor-zoom-in transition-transform duration-100 ease-out hidden sm:block"
              style={{
                transform: `scale(${imageScale})`,
                transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`
              }}
              onMouseEnter={() => setImageScale(2.5)}
              onMouseLeave={() => {
                setImageScale(1);
                setImagePosition({ x: 50, y: 50 });
              }}
              onMouseMove={(e) => {
                if (imageScale > 1) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setImagePosition({ x, y });
                }
              }}
            />
            <img
              src={invoice.imageUrl}
              alt="Faktura - powiększenie"
              className="max-w-full h-auto object-contain sm:hidden"
            />
          </div>
        </DialogContent>
      </Dialog>
      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
}
