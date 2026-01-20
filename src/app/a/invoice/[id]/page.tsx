"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
import { AccountantHeader } from "@/components/accountant-header";
import { Footer } from "@/components/footer";
import { ErrorDisplay } from "@/components/error-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ExternalLink,
  RefreshCw,
  Trash2,
  ImageOff
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceTypeBadge } from "@/components/invoice-type-badge";
import { BudgetRequestReviewDialog } from "@/components/budget-request-review-dialog";
import dynamic from "next/dynamic";
import Link from "next/link";

const KsefInvoicePopup = dynamic(() => import("@/components/ksef-invoice-popup").then(m => m.KsefInvoicePopup));

export default function InvoiceReviewPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const invoiceId = params.id as string;
  const { data: user } = trpc.auth.me.useQuery();

  const [imageZoomed, setImageZoomed] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [conflictReviewerName, setConflictReviewerName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReReviewDialog, setShowReReviewDialog] = useState(false);
  const [reReviewReason, setReReviewReason] = useState("");
  const [showAdminStatusDialog, setShowAdminStatusDialog] = useState(false);
  const [newAdminStatus, setNewAdminStatus] = useState<"pending" | "accepted" | "rejected">("pending");
  const [adminStatusReason, setAdminStatusReason] = useState("");
  const [isEditingInvoiceNumber, setIsEditingInvoiceNumber] = useState(false);
  const [isEditingKwota, setIsEditingKwota] = useState(false);
  const [ksefPopupOpen, setKsefPopupOpen] = useState(false);
  const [budgetRequestDialogOpen, setBudgetRequestDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const invoiceNumberInputRef = useRef<HTMLDivElement>(null);
  const kwotaInputRef = useRef<HTMLDivElement>(null);
  
  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [kwota, setKwota] = useState("");

  const { data: invoice, isLoading, refetch, error } = trpc.invoice.getById.useQuery(
    { id: invoiceId },
    {
      enabled: !!invoiceId,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
      refetchInterval: 2000, // 2 seconds - fast enough for heartbeat monitoring
    }
  );

  // Query for corrections of this invoice
  const { data: corrections } = trpc.invoice.getCorrectionsForInvoice.useQuery(
    { invoiceId },
    {
      enabled: !!invoiceId && !!user && (user.role === "accountant" || user.role === "admin"),
    }
  );

  const canViewAdvance = user?.role === "admin" || user?.role === "accountant";

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
      setKwota(invoice.kwota || "");
    }
  }, [invoice]);

  // Calculate canEdit
  const isReviewing = invoice?.status === "in_review";
  const isCompleted = invoice?.status === "accepted" || invoice?.status === "rejected";
  const isCorrection = invoice?.invoiceType === "correction";
  const canChangeStatus = !isCorrection;
  const canEdit = isReviewing && !isCompleted;

  // Handle click outside to exit edit mode (only for invoice number and kwota)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditingInvoiceNumber && 
          invoiceNumberInputRef.current && 
          !invoiceNumberInputRef.current.contains(event.target as Node)) {
        setIsEditingInvoiceNumber(false);
        handleSave();
      }
      if (isEditingKwota && 
          kwotaInputRef.current && 
          !kwotaInputRef.current.contains(event.target as Node)) {
        setIsEditingKwota(false);
        handleSave();
      }
    };

    if (isEditingInvoiceNumber || isEditingKwota) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isEditingInvoiceNumber, isEditingKwota, invoiceNumber, description, kwota]);

  // Auto-save description when it changes (with debounce)
  useEffect(() => {
    if (!invoice) return;
    
    // Don't auto-save if description matches current invoice description
    if (description === invoice.description) return;
    
    // Only auto-save if editing is allowed
    if (!canEdit) return;
    
    const timer = setTimeout(() => {
      if (description.trim() && description !== invoice.description) {
        updateMutation.mutate({
          id: invoiceId,
          description: description || undefined,
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [description, invoice, invoiceId, canEdit]);

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
      // Invalidate all relevant queries
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.pendingInvoices.invalidate();
      utils.invoice.reviewedInvoices.invalidate();
      utils.invoice.myInvoices.invalidate();
      utils.advances.getAll.invalidate();
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

  const reReviewMutation = trpc.invoice.requestReReview.useMutation({
    onSuccess: async () => {
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.pendingInvoices.invalidate();
      utils.invoice.reviewedInvoices.invalidate();
      await refetch();
      toast({
        title: "Wysłano prośbę",
        description: "Faktura została przekazana do ponownej weryfikacji przez administratora",
      });
      setShowReReviewDialog(false);
      setReReviewReason("");
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminChangeStatusMutation = trpc.admin.changeInvoiceStatus.useMutation({
    onSuccess: async () => {
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.pendingInvoices.invalidate();
      utils.invoice.reviewedInvoices.invalidate();
      utils.invoice.myInvoices.invalidate();
      await refetch();
      toast({
        title: "Status zmieniony",
        description: "Status faktury został zaktualizowany",
      });
      setShowAdminStatusDialog(false);
      setAdminStatusReason("");
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => {
      utils.invoice.getAllInvoices.invalidate();
      utils.invoice.pendingInvoices.invalidate();
      utils.invoice.reviewedInvoices.invalidate();
      utils.invoice.myInvoices.invalidate();
      const _title = invoice?.invoiceType === 'receipt' ? 'Paragon usunięty' : invoice?.invoiceType === 'correction' ? 'Korekta usunięta' : 'Faktura usunięta';
      const _desc = invoice?.invoiceType === 'receipt' ? 'Paragon został trwale usunięty' : invoice?.invoiceType === 'correction' ? 'Korekta została trwale usunięta' : 'Faktura została trwale usunięta';
      toast({
        title: _title,
        description: _desc,
      });
      router.push(user?.role === "accountant" ? "/a/accountant" : "/a/dashboard");
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
    const hasKwotaChange = kwota !== invoice?.kwota;
    
    if (hasInvoiceNumberChange || hasDescriptionChange || hasKwotaChange) {
      updateMutation.mutate({
        id: invoiceId,
        invoiceNumber: hasInvoiceNumberChange ? (invoiceNumber || undefined) : undefined,
        description: hasDescriptionChange ? (description || undefined) : undefined,
        kwota: hasKwotaChange ? (kwota || undefined) : undefined,
      });
    }
  };

  const handleAccept = async () => {
    if (!invoice) return;
    
    // Validate dekretacja is filled
    if (!description.trim()) {
      toast({
        title: "Błąd",
        description: "Dekretacja jest wymagana",
        variant: "destructive",
      });
      return;
    }
    
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
    if (invoiceNumber !== invoice.invoiceNumber || description !== invoice.description || kwota !== invoice.kwota) {
      await updateMutation.mutateAsync({
        id: invoiceId,
        invoiceNumber: invoiceNumber || undefined,
        description: description || undefined,
        kwota: kwota || undefined,
      });
    }
    
    finalizeMutation.mutate({
      id: invoiceId,
      status: "accepted",
      rejectionReason: description,
    });
  };

  const handleReject = () => {
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!invoice) return;
    
    // Validate dekretacja is filled
    if (!description.trim()) {
      toast({
        title: "Błąd",
        description: "Dekretacja jest wymagana przed odrzuceniem faktury",
        variant: "destructive",
      });
      return;
    }
    
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
    
    // Auto-save description before rejecting
    if (description !== invoice.description) {
      await updateMutation.mutateAsync({
        id: invoiceId,
        description: description || undefined,
      });
    }
    
    finalizeMutation.mutate({
      id: invoiceId,
      status: "rejected",
      rejectionReason: rejectionReason,
    });
    setShowRejectDialog(false);
    setRejectionReason("");
  };

  const handleRequestReReview = () => {
    setShowReReviewDialog(true);
  };

  const confirmReReview = () => {
    if (!reReviewReason.trim()) {
      toast({
        title: "Błąd",
        description: "Powód prośby o edycję jest wymagany",
        variant: "destructive",
      });
      return;
    }

    reReviewMutation.mutate({
      id: invoiceId,
      reason: reReviewReason,
    });
  };

  const handleAdminStatusChange = () => {
    setShowAdminStatusDialog(true);
    if (invoice) {
      setNewAdminStatus(invoice.status as "pending" | "accepted" | "rejected");
    }
  };

  const confirmAdminStatusChange = () => {
    if (newAdminStatus === "rejected" && !adminStatusReason.trim()) {
      toast({
        title: "Błąd",
        description: "Powód odrzucenia jest wymagany",
        variant: "destructive",
      });
      return;
    }

    adminChangeStatusMutation.mutate({
      id: invoiceId,
      newStatus: newAdminStatus,
      reason: adminStatusReason || undefined,
    });
  };

  const handlePrint = () => {
    if (!invoice || !invoice.imageUrl) {
      toast({
        title: "Brak obrazu",
        description: "Nie można wydrukować faktury bez obrazu",
        variant: "destructive",
      });
      return;
    }
    
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
    if (!invoice || !invoice.imageUrl) {
      toast({
        title: "Brak obrazu",
        description: "Nie można pobrać faktury bez obrazu",
        variant: "destructive",
      });
      return;
    }

    const imageUrl = invoice.imageUrl;
    
    try {
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
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

  const handleExportCSV = () => {
    if (!invoice) return;

    // Prepare CSV data
    const csvData = [
      ['Pole', 'Wartość'],
      ['Numer faktury', invoice.invoiceNumber || ''],
      ['Typ', invoice.invoiceType === 'receipt' ? 'Paragon' : invoice.invoiceType === 'correction' ? 'Korekta' : 'Faktura'],
      ['Status', invoice.status],
      ['Kwota', invoice.kwota || ''],
      ['Dekretacja', invoice.description || ''],
      ['Firma', invoice.company?.name || ''],
      ['NIP', invoice.company?.nip || ''],
      ['Użytkownik', invoice.submitter?.name || ''],
      ['Email użytkownika', invoice.submitter?.email || ''],
      ['Data utworzenia', format(new Date(invoice.createdAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })],
      ['Data przeglądu', invoice.reviewedAt ? format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl }) : ''],
      ['Recenzent', invoice.reviewer?.name || ''],
      ['Data rozliczenia', invoice.settledAt ? format(new Date(invoice.settledAt), "dd.MM.yyyy HH:mm:ss", { locale: pl }) : ''],
      ['Rozliczył', invoice.settledByUser?.name || ''],
      ['Numer KSeF', invoice.ksefNumber || ''],
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faktura_${invoice.invoiceNumber || invoiceId}_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Wyeksportowano",
      description: "Dane faktury zostały wyeksportowane do CSV",
    });
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
        <main className="flex-1 p-6">
          {error ? (
            <ErrorDisplay
              title="Błąd podczas ładowania faktury"
              message={error.message}
              error={error}
            />
          ) : (
            <p className="text-muted-foreground">Faktura nie została znaleziona</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <AccountantHeader />}
      
      {/* KSeF Invoice Popup */}
      {invoice.ksefNumber && (
        <KsefInvoicePopup
          ksefNumber={invoice.ksefNumber}
          invoiceId={invoiceId}
          open={ksefPopupOpen}
          onOpenChange={setKsefPopupOpen}
        />
      )}

      {/* Budget Request Review Dialog */}
      {invoice.budgetRequest && (
        <BudgetRequestReviewDialog
          request={{
            id: invoice.budgetRequest.id,
            userId: "",
            userName: invoice.budgetRequest.userName || "",
            userEmail: invoice.submitter?.email || "",
            currentBalanceAtRequest: 0,
            requestedAmount: invoice.budgetRequest.requestedAmount,
            justification: "",
            status: invoice.budgetRequest.status,
            createdAt: invoice.budgetRequest.createdAt,
            reviewedAt: invoice.budgetRequest.reviewedAt,
            companyId: invoice.budgetRequest.companyId,
            companyName: invoice.budgetRequest.companyName,
          }}
          open={budgetRequestDialogOpen}
          onOpenChange={setBudgetRequestDialogOpen}
          onSuccess={() => {
            refetch();
          }}
          mode="details"
        />
      )}

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-row items-center gap-2 md:gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => {
                  router.back();
                  router.refresh();
                }}
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
              {invoice.status === "re_review" && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                    Ponowna weryfikacja
                  </span>
                  {invoice.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(invoice.reviewedAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                    </p>
                  )}
                </div>
              )}
              {invoice.status === "settled" && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Rozliczona
                  </span>
                  {invoice.settledByUser && invoice.settledAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      przez {invoice.settledByUser.name}
                      <br />
                      {format(new Date(invoice.settledAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
                    </p>
                  )}
                </div>
              )}
              {invoice.status === "transferred" && (
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Przelana
                  </span>
                  {invoice.settledByUser && invoice.settledAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      przez {invoice.settledByUser.name}
                      <br />
                      {format(new Date(invoice.settledAt), "dd.MM.yyyy HH:mm:ss", { locale: pl })}
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
                <div className="relative border rounded-lg overflow-hidden">
                  {invoice.imageUrl && !imageLoadError ? (
                    <div
                      className="cursor-pointer"
                      onClick={() => setImageZoomed(true)}
                    >
                      <img
                        src={invoice.imageUrl}
                        alt="Faktura"
                        className="w-full h-auto"
                        onError={() => setImageLoadError(true)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                      <ImageOff className="h-8 w-8" />
                      <p className="text-sm">Brak obrazu faktury</p>
                      <p className="text-xs">Nie znaleziono pliku lub jest niedostępny</p>
                    </div>
                  )}
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
                    <div className="flex flex-col gap-2">
                      <CardTitle className="text-xl md:text-2xl">{invoiceNumber || "Brak numeru"}</CardTitle>
                      <InvoiceTypeBadge type={invoice.invoiceType || "einvoice"} />
                    </div>
                  )}
                  {invoice.ksefNumber && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setKsefPopupOpen(true)}
                      title="Weryfikuj w KSeF"
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
                  <div className="mt-1" ref={kwotaInputRef}>
                    {isEditingKwota ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Kwota:</span>
                        <Input
                          type="text"
                          value={kwota}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only numbers and decimal point
                            if (/^\d*\.?\d{0,2}$/.test(value)) {
                              setKwota(value);
                            }
                          }}
                          className="w-32 h-7 text-sm font-semibold"
                          placeholder="0.00"
                          autoFocus
                        />
                        <span className="text-sm font-semibold">PLN</span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold">
                        Kwota: {kwota ? parseFloat(kwota).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',') : '0,00'} PLN
                      </p>
                    )}
                  </div>
                  {isCorrection && (
                    <p className="text-sm font-semibold mt-1 text-green-700">
                      Kwota korekty: {invoice.correctionAmount ? parseFloat(invoice.correctionAmount).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',') : '0,00'} PLN
                    </p>
                  )}
                </div>
                
              </CardHeader>
              <CardContent>
                <div className="space-y-4 mt-7">
                  {/* Correction Info */}
                  {corrections && corrections.length > 0 && (
                    <div className="space-y-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Ta faktura posiada korekty</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link href={`/a/corrections?original=${invoiceId}`}>
                            Zobacz korekty
                          </Link>
                        </Button>
                      </div>
                      <div className="text-xs text-amber-800 dark:text-amber-200">
                        Liczba korekt: {corrections.length}
                      </div>
                    </div>
                  )}

                  {/* Justification (read-only) */}
                  {/* Budget Request Info */}
                  {invoice.budgetRequest && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Zaliczka</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBudgetRequestDialogOpen(true)}
                        >
                          Zobacz szczegóły
                        </Button>
                      </div>
                      <div 
                        className="space-y-2 bg-muted/30 p-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setBudgetRequestDialogOpen(true)}
                      >
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Użytkownik</p>
                            <p className="font-medium">{invoice.budgetRequest.userName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Firma</p>
                            <p className="font-medium">{invoice.budgetRequest.companyName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Kwota zaliczki</p>
                            <p className="font-medium">{invoice.budgetRequest.requestedAmount.toFixed(2)} PLN</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <InvoiceStatusBadge status={invoice.budgetRequest.status === "approved" ? "accepted" : invoice.budgetRequest.status === "rejected" ? "rejected" : "pending"} variant="compact" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Data złożenia</p>
                            <p className="font-medium">{format(new Date(invoice.budgetRequest.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                          </div>
                          {invoice.budgetRequest.reviewedAt && (
                            <div>
                              <p className="text-xs text-muted-foreground">Data decyzji</p>
                              <p className="font-medium">{format(new Date(invoice.budgetRequest.reviewedAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                            </div>
                          )}
                        </div>
                        {invoice.budgetRequest.relatedInvoices && invoice.budgetRequest.relatedInvoices.length > 0 && (
                          <div className="pt-2 mt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Inne faktury powiązane z tą zaliczką:</p>
                            <div className="space-y-1">
                              {invoice.budgetRequest.relatedInvoices.map((relInv) => (
                                <div
                                  key={relInv.id}
                                  className="flex items-center justify-between text-xs p-1.5 bg-background rounded hover:bg-muted"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/a/invoice/${relInv.id}`);
                                  }}
                                >
                                  <span className="font-medium">{relInv.invoiceNumber || "Brak numeru"}</span>
                                  <div className="flex items-center gap-2">
                                    {relInv.kwota && <span>{relInv.kwota.toFixed(2)} PLN</span>}
                                    <InvoiceStatusBadge status={relInv.status} variant="compact" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {canViewAdvance && invoice.advance && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Powiązana zaliczka</p>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/a/advances?advanceId=${invoice.advance.id}`}>
                            Zobacz zaliczkę
                          </Link>
                        </Button>
                      </div>
                      <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Kwota</p>
                            <p className="font-medium">{invoice.advance.amount.toFixed(2)} PLN</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <p className="font-medium">
                              {invoice.advance.status === "pending" ? "Oczekująca" :
                               invoice.advance.status === "transferred" ? "Przelana" :
                               invoice.advance.status === "settled" ? "Rozliczona" : invoice.advance.status}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Data utworzenia</p>
                            <p className="font-medium">{format(new Date(invoice.advance.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                          </div>
                          {invoice.advance.transferDate && (
                            <div>
                              <p className="text-xs text-muted-foreground">Data przelewu</p>
                              <p className="font-medium">{format(new Date(invoice.advance.transferDate), "dd.MM.yyyy HH:mm", { locale: pl })}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                    <Label htmlFor="description">Dekretacja *</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canEdit}
                      placeholder={canEdit ? "Wprowadź dekretację..." : ""}
                      className="min-h-[80px]"
                      required
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
            <div className="w-full lg:w-48 flex flex-col gap-3 lg:gap-4">
              {canChangeStatus && (
                <div className="flex flex-row lg:flex-col gap-3 lg:gap-4">
                  <Button
                    onClick={handleAccept}
                    size="lg"
                    disabled={finalizeMutation.isPending}
                    className="flex-1 lg:h-32 h-24 text-lg md:text-xl font-bold flex-col gap-2 bg-green-600 hover:bg-green-700 text-white dark:text-white"
                  >
                    {finalizeMutation.isPending ? (
                      <>
                        <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin" />
                        <span className="text-xs md:text-sm font-bold">Przetwarzanie...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-8 w-8 md:h-12 md:w-12 stroke-[3]" />
                        <span className="font-bold text-sm md:text-base">Zaakceptuj</span>
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
                </div>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditingInvoiceNumber || isEditingKwota) {
                      setIsEditingInvoiceNumber(false);
                      setIsEditingKwota(false);
                      handleSave();
                    } else {
                      setIsEditingInvoiceNumber(true);
                      setIsEditingKwota(true);
                      // Scroll to invoice number input
                      setTimeout(() => {
                        invoiceNumberInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }
                  }}
                  className="hidden lg:flex w-full items-center gap-1"
                >
                  <span>{(isEditingInvoiceNumber || isEditingKwota) ? 'Zapisz' : 'Edytuj'}</span>
                </Button>
              )}
              <div className="hidden lg:flex flex-col gap-2">
                <div className="flex flex-row gap-2">
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
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportCSV}
                  title="Eksportuj do CSV"
                  className="w-full flex items-center justify-center gap-1"
                >
                  <FileText className="h-4 w-4" />
                  <span>Eksportuj</span>
                </Button>
              </div>
            </div>
          )}

          {isCompleted && (user?.role === "accountant" || user?.role === "admin") && (
            <div className="w-full lg:w-48 flex flex-col gap-3">
              {user?.role === "admin" && canChangeStatus && (
                <Button
                  onClick={handleAdminStatusChange}
                  variant="outline"
                  size="lg"
                  className="w-full h-24 lg:h-32 text-base md:text-lg flex-col gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  <RefreshCw className="h-8 w-8" />
                  <span className="font-bold text-sm">Zmień status</span>
                </Button>
              )}
              {user?.role === "accountant" && invoice.status !== "re_review" && canChangeStatus && (
                <Button
                  onClick={handleRequestReReview}
                  variant="outline"
                  size="lg"
                  disabled={reReviewMutation.isPending}
                  className="w-full h-24 lg:h-32 text-base md:text-lg flex-col gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                >
                  {reReviewMutation.isPending ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-xs font-bold">Przetwarzanie...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-8 w-8" />
                      <span className="font-bold text-sm">Poproś o edycję</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="outline"
                size="lg"
                className="w-full h-24 lg:h-32 text-base md:text-lg flex-col gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-8 w-8" />
                <span className="font-bold text-sm">{`Usuń ${invoice?.invoiceType === 'receipt' ? 'paragon' : invoice?.invoiceType === 'correction' ? 'korektę' : 'fakturę'}`}</span>
              </Button>
              <Button
                onClick={() => {
                  router.push("/a/invoices");
                  router.refresh();
                }}
                variant="outline"
                size="lg"
                className="w-full h-24 lg:h-32 text-base md:text-lg flex-col gap-2"
              >
                Powrót do listy
              </Button>
              <div className="hidden lg:flex flex-col gap-2 mt-3">
                <div className="flex flex-row gap-2">
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
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleExportCSV}
                  title="Eksportuj do CSV"
                  className="w-full flex items-center justify-center gap-1"
                >
                  <FileText className="h-4 w-4" />
                  <span>Eksportuj</span>
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Mobile action buttons row */}
        {(isReviewing || isCompleted) && (user?.role === "accountant" || user?.role === "admin") && (
          <div className="lg:hidden flex gap-2 mt-4 flex-wrap">
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
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExportCSV}
              title="Eksportuj do CSV"
              className="flex-1 flex items-center justify-center gap-1"
            >
              <FileText className="h-4 w-4" />
              <span>Eksportuj</span>
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
        <DialogContent className="max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Odrzuć fakturę</DialogTitle>
            <DialogDescription>
              Podaj powód odrzucenia. Użytkownik zobaczy tę wiadomość.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
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

      {/* Re-Review Request Dialog */}
      <Dialog open={showReReviewDialog} onOpenChange={setShowReReviewDialog}>
        <DialogContent className="max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Poproś o edycję</DialogTitle>
            <DialogDescription>
              Poproś administratora o ponowną weryfikację tej faktury. Opisz powód prośby.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
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
              <p className="text-sm text-muted-foreground">
                <strong>Obecny status:</strong> {invoice.status === "accepted" ? "Zaakceptowana" : "Odrzucona"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reReviewReason">Powód prośby o edycję *</Label>
              <Textarea
                id="reReviewReason"
                value={reReviewReason}
                onChange={(e) => setReReviewReason(e.target.value)}
                placeholder="Np. Pomyłka w numerze faktury, należy zweryfikować ponownie..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReReviewDialog(false);
                setReReviewReason("");
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={confirmReReview}
              disabled={reReviewMutation.isPending || !reReviewReason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {reReviewMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wysyłam...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Poproś o edycję
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Status Change Dialog */}
      <Dialog open={showAdminStatusDialog} onOpenChange={setShowAdminStatusDialog}>
        <DialogContent className="max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Zmień status faktury</DialogTitle>
            <DialogDescription>
              Jako administrator możesz ręcznie zmienić status faktury. Ta zmiana zostanie zapisana w historii edycji.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
            <div className="space-y-2 p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Numer faktury:</strong> {invoice.invoiceNumber || "Brak numeru"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Użytkownik:</strong> {invoice.submitter?.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Obecny status:</strong> {
                  invoice.status === "accepted" ? "Zaakceptowana" :
                  invoice.status === "rejected" ? "Odrzucona" :
                  invoice.status === "in_review" ? "W trakcie" :
                  invoice.status === "re_review" ? "Ponowna weryfikacja" :
                  "Oczekuje"
                }
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newStatus">Nowy status *</Label>
              <Select value={newAdminStatus} onValueChange={(value) => setNewAdminStatus(value as "pending" | "accepted" | "rejected")}>
                <SelectTrigger id="newStatus">
                  <SelectValue placeholder="Wybierz nowy status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Oczekuje</SelectItem>
                  <SelectItem value="accepted">Zaakceptowana</SelectItem>
                  <SelectItem value="rejected">Odrzucona</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newAdminStatus === "rejected" && (
              <div className="space-y-2">
                <Label htmlFor="adminStatusReason">Powód odrzucenia *</Label>
                <Textarea
                  id="adminStatusReason"
                  value={adminStatusReason}
                  onChange={(e) => setAdminStatusReason(e.target.value)}
                  placeholder="Opisz powód odrzucenia..."
                  className="min-h-[100px]"
                />
              </div>
            )}
            {(newAdminStatus === "accepted" || newAdminStatus === "pending") && (
              <div className="space-y-2">
                <Label htmlFor="adminStatusReason">Dekretacja (opcjonalne)</Label>
                <Textarea
                  id="adminStatusReason"
                  value={adminStatusReason}
                  onChange={(e) => setAdminStatusReason(e.target.value)}
                  placeholder="Dodatkowa dekretacja (opcjonalne)..."
                  className="min-h-[80px]"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAdminStatusDialog(false);
                setAdminStatusReason("");
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={confirmAdminStatusChange}
              disabled={adminChangeStatusMutation.isPending || (newAdminStatus === "rejected" && !adminStatusReason.trim())}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {adminChangeStatusMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zmieniam...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Zmień status
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict warning dialog */}
      <Dialog open={showConflictWarning} onOpenChange={setShowConflictWarning}>
        <DialogContent className="max-w-md max-h-[90vh]">
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
            {invoice.imageUrl && !imageLoadError ? (
              <>
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
                  onError={() => setImageLoadError(true)}
                />
                <img
                  src={invoice.imageUrl}
                  alt="Faktura - powiększenie"
                  className="max-w-full h-auto object-contain sm:hidden"
                  onError={() => setImageLoadError(true)}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">Brak obrazu faktury</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{`Usuń ${invoice?.invoiceType === 'receipt' ? 'paragon' : invoice?.invoiceType === 'correction' ? 'korektę' : 'fakturę'}`}</DialogTitle>
            <DialogDescription>
              Ta operacja jest NIEODWRACALNA. {invoice?.invoiceType === 'receipt' ? 'Paragon' : invoice?.invoiceType === 'correction' ? 'Korekta' : 'Faktura'} i plik zostaną trwale usunięte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
            <div className="space-y-2 p-3 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Numer faktury:</strong> {invoice.invoiceNumber || "Brak numeru"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Firma:</strong> {invoice.company?.name}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Twoje hasło *</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Wprowadź hasło aby potwierdzić"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletePassword("");
              }}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // Validate dekretacja is filled
                if (!isCorrection && !description.trim()) {
                  toast({
                    title: "Błąd",
                    description: "Dekretacja jest wymagana przed usunięciem dokumentu",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (!deletePassword.trim()) {
                  toast({
                    title: "Błąd",
                    description: "Hasło jest wymagane",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Auto-save description before deleting
                if (!isCorrection && description !== invoice.description) {
                  updateMutation.mutate({
                    id: invoiceId,
                    description: description || undefined,
                  });
                }
                
                deleteInvoiceMutation.mutate({
                  id: invoiceId,
                  password: deletePassword,
                });
                setShowDeleteDialog(false);
                setDeletePassword("");
              }}
              disabled={deleteInvoiceMutation.isPending || !deletePassword.trim()}
            >
              {deleteInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                <>{`Usuń ${invoice?.invoiceType === 'receipt' ? 'paragon' : invoice?.invoiceType === 'correction' ? 'korektę' : 'fakturę'} definitywnie`}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
}
