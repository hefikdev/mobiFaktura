"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AccountantHeader } from "@/components/accountant-header";
import { AdminHeader } from "@/components/admin-header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { useToast } from "@/components/ui/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import { Camera, Loader2, X, QrCode, SwitchCamera, FileText, Receipt } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useOnline } from "@/lib/use-online";
import { OfflineUploadDialog } from "@/components/offline-banner";

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isOnline, refresh } = useOnline();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scanHandledRef = useRef<boolean>(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceType, setInvoiceType] = useState<"einvoice" | "receipt">("einvoice");
  const [ksefNumber, setKsefNumber] = useState("");
  const [kwota, setKwota] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [justification, setJustification] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrCameras, setQrCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [showOfflineDialog, setShowOfflineDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFetchingKsef, setIsFetchingKsef] = useState(false);

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: companies, isLoading: loadingCompanies } = trpc.company.list.useQuery();
  
  // KSeF data fetch mutation
  const fetchKsefMutation = trpc.ksef.fetchInvoiceData.useMutation({
    onSuccess: (data) => {
      if (data.success && data.data) {
        // Auto-fill form fields
        if (data.data.invoiceNumber) setInvoiceNumber(data.data.invoiceNumber);
        if (data.data.kwota) setKwota(data.data.kwota.toString());
        if (data.data.ksefNumber) setKsefNumber(data.data.ksefNumber);
        
        toast({
          title: "Dane pobrane z KSeF",
          description: `Numer faktury: ${data.data.invoiceNumber}, Kwota: ${data.data.kwota} PLN`,
        });
      }
      setIsFetchingKsef(false);
    },
    onError: (error) => {
      toast({
        title: "Błąd pobierania danych KSeF",
        description: error.message,
        variant: "destructive",
      });
      setIsFetchingKsef(false);
    },
  });

  // Prepare company options for SearchableSelect
  const companyOptions: SearchableSelectOption[] = useMemo(() => {
    return (companies || []).map((company) => ({
      value: company.id,
      label: company.name,
      searchableText: `${company.name} ${company.nip || ""} ${company.id}`,
    }));
  }, [companies]);
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Faktura wysłana",
        description: "Twoja faktura została przesłana do weryfikacji",
      });
      router.push("/a/dashboard");
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

  // Get available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const cameras = devices.map((device) => ({
            id: device.id,
            label: device.label || `Camera ${device.id}`,
          }));
          setQrCameras(cameras);
          // Select back camera by default (usually has "back" or "rear" in label)
          const backCamera = cameras.find(
            (cam) =>
              cam.label.toLowerCase().includes("back") ||
              cam.label.toLowerCase().includes("rear") ||
              cam.label.toLowerCase().includes("environment")
          );
          setSelectedCamera(backCamera?.id || cameras[cameras.length - 1]?.id || "");
        }
      })
      .catch((err) => {
        console.error("Error getting cameras:", err);
      });
  }, []);

  // Start QR scanner
  const startQrScanner = useCallback(async () => {
    if (!selectedCamera) {
      toast({
        title: "Błąd",
        description: "Nie wykryto kamery",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    // Reset duplicate-scan guard on (re)start
    scanHandledRef.current = false;

    try {
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;

      await scanner.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Prevent duplicate scans firing multiple times
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          // Successfully scanned
          setKsefNumber(decodedText);
          
          // Try to auto-fetch data from KSeF
          if (companyId) {
            setIsFetchingKsef(true);
            fetchKsefMutation.mutate({
              qrCode: decodedText,
              companyId: companyId,
            });
          }
          
          toast({
            title: "Zeskanowano QR kod",
            description: companyId ? "Pobieranie danych z KSeF..." : "Wybierz firmę aby pobrać dane",
          });
          stopQrScanner();
        },
        (errorMessage) => {
          // Scanning in progress, ignore error messages
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      toast({
        title: "Błąd",
        description: "Nie udało się uruchomić skanera",
        variant: "destructive",
      });
      setIsScanning(false);
    }
  }, [selectedCamera, toast]);

  // Stop QR scanner
  const stopQrScanner = useCallback(async () => {
    if (qrScannerRef.current && isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
        qrScannerRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
    setShowQrScanner(false);
  }, [isScanning]);

  // Change camera
  const changeCamera = useCallback(async () => {
    if (isScanning) {
      await stopQrScanner();
    }
    
    // Find next camera
    const currentIndex = qrCameras.findIndex((cam) => cam.id === selectedCamera);
    const nextIndex = (currentIndex + 1) % qrCameras.length;
    const nextCamera = qrCameras[nextIndex];
    
    if (nextCamera) {
      setSelectedCamera(nextCamera.id);
      
      // Restart scanner with new camera
      setTimeout(() => {
        startQrScanner();
      }, 100);
    }
  }, [isScanning, qrCameras, selectedCamera, stopQrScanner, startQrScanner]);

  // Toggle QR scanner
  const toggleQrScanner = useCallback(() => {
    if (showQrScanner) {
      stopQrScanner();
    } else {
      setShowQrScanner(true);
      setTimeout(() => {
        startQrScanner();
      }, 100);
    }
  }, [showQrScanner, startQrScanner, stopQrScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const handleImageCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const processFile = useCallback(
    (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Błąd",
          description: "Proszę wybrać plik graficzny",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (10MB limit)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast({
          title: "Błąd",
          description: "Plik jest za duży. Maksymalny rozmiar to 10MB",
          variant: "destructive",
        });
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImageDataUrl(result);
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0 && files[0]) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleClearImage = useCallback(() => {
    setImageDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Check if online before submitting
      if (!isOnline) {
        setShowOfflineDialog(true);
        return;
      }

      if (!imageDataUrl) {
        toast({
          title: "Błąd",
          description: "Proszę zrobić zdjęcie faktury",
          variant: "destructive",
        });
        return;
      }

      if (!invoiceNumber.trim()) {
        toast({
          title: "Błąd",
          description: "Proszę podać numer faktury",
          variant: "destructive",
        });
        return;
      }

      if (!companyId) {
        toast({
          title: "Błąd",
          description: "Proszę wybrać firmę",
          variant: "destructive",
        });
        return;
      }

      if (!kwota || !kwota.trim()) {
        toast({
          title: "Błąd",
          description: "Proszę podać kwotę",
          variant: "destructive",
        });
        return;
      }

      if (justification.trim().length < 10) {
        toast({
          title: "Błąd",
          description: "Uzasadnienie musi zawierać minimum 10 znaków",
          variant: "destructive",
        });
        return;
      }

      // Normalize kwota: replace comma with dot, remove spaces, parse to float
      const normalizedKwota = parseFloat(kwota.replace(/,/g, '.').replace(/\s/g, ''));
      
      createMutation.mutate({
        imageDataUrl,
        invoiceNumber: invoiceNumber.trim(),
        invoiceType,
        ksefNumber: ksefNumber.trim() || undefined,
        kwota: normalizedKwota,
        companyId,
        justification: justification.trim(),
      });
    },
    [isOnline, imageDataUrl, invoiceNumber, invoiceType, ksefNumber, kwota, companyId, justification, createMutation, toast]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : user?.role === "accountant" ? <AccountantHeader /> : <UserHeader showAddButton={false} />}

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Invoice Type - MOVED TO TOP */}
          <div className="space-y-2">
            <Label htmlFor="invoiceType">
              Typ dokumentu <span className="text-red-500">*</span>
            </Label>
            
            {/* Mobile: Large square buttons */}
            <div className="grid grid-cols-2 gap-3 md:hidden">
              <button
                type="button"
                onClick={() => {
                  setInvoiceType("einvoice");
                }}
                className={`
                  aspect-square flex flex-col items-center justify-center gap-2 rounded-lg border-2 transition-all
                  ${invoiceType === "einvoice" 
                    ? "border-primary bg-primary/10 text-primary font-semibold" 
                    : "border-muted-foreground/20 hover:border-muted-foreground/40"
                  }
                `}
              >
                <FileText className="h-8 w-8" />
                <span className="text-sm text-center px-2">E-faktura<br/>(z KSeF)</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setInvoiceType("receipt");
                  setKsefNumber("");
                }}
                className={`
                  aspect-square flex flex-col items-center justify-center gap-2 rounded-lg border-2 transition-all
                  ${invoiceType === "receipt" 
                    ? "border-primary bg-primary/10 text-primary font-semibold" 
                    : "border-muted-foreground/20 hover:border-muted-foreground/40"
                  }
                `}
              >
                <Receipt className="h-8 w-8" />
                <span className="text-sm text-center px-2">Paragon<br/>(bez KSeF)</span>
              </button>
            </div>
            
            {/* Desktop: Standard dropdown */}
            <Select 
              value={invoiceType} 
              onValueChange={(value: "einvoice" | "receipt") => {
                setInvoiceType(value);
                // Clear KSeF number when switching to receipt
                if (value === "receipt") {
                  setKsefNumber("");
                }
              }}
            >
              <SelectTrigger className="hidden md:flex">
                <SelectValue placeholder="Wybierz typ dokumentu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="einvoice">E-faktura (z KSeF)</SelectItem>
                <SelectItem value="receipt">Paragon (bez KSeF)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* KSEF Number - only show for einvoice - MOVED BEFORE IMAGE */}
          {invoiceType === "einvoice" && (
            <div className="space-y-2">
              <Label htmlFor="ksefNumber">
                Nr KSEF
              </Label>
              <div className="flex gap-2">
                <Input
                  id="ksefNumber"
                  value={ksefNumber}
                  onChange={(e) => setKsefNumber(e.target.value)}
                  placeholder="np. 1234567890-ABC-XYZ"
                  className="flex-1"
                  disabled={isFetchingKsef}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={toggleQrScanner}
                  title="Skanuj kod QR"
                  disabled={isFetchingKsef}
                >
                  {showQrScanner ? <X className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                </Button>
                {ksefNumber && companyId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsFetchingKsef(true);
                      fetchKsefMutation.mutate({
                        ksefNumber: ksefNumber,
                        companyId: companyId,
                      });
                    }}
                    disabled={isFetchingKsef}
                    title="Pobierz dane z KSeF"
                  >
                    {isFetchingKsef ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Pobierz dane"
                    )}
                  </Button>
                )}
              </div>
              
              {isFetchingKsef && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pobieranie danych z KSeF...
                </p>
              )}
              
              {!companyId && ksefNumber && (
                <p className="text-xs text-amber-600">
                  Wybierz firmę aby automatycznie pobrać dane z KSeF
                </p>
              )}

              {/* QR Scanner */}
              {showQrScanner && (
                <Card className="mt-4">
                  <CardContent className="p-3 md:p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <Label>Skaner kodów QR</Label>
                      {qrCameras.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={changeCamera}
                          disabled={!isScanning}
                        >
                          <SwitchCamera className="h-4 w-4 mr-2" />
                          Zmień kamerę
                        </Button>
                      )}
                    </div>
                    
                    <div 
                      id="qr-reader" 
                      className="w-full rounded-lg overflow-hidden border-2 border-primary"
                      style={{ minHeight: "300px" }}
                    />
                    
                    <div className="text-sm text-muted-foreground text-center">
                      Skieruj kamerę na kod QR z numerem KSEF
                    </div>
                    
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full"
                      onClick={stopQrScanner}
                    >
                      Anuluj skanowanie
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Image capture area - MOVED AFTER KSEF */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {imageDataUrl ? (
              <Card className="relative overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={imageDataUrl}
                    alt="Podgląd faktury"
                    className="w-full h-auto max-h-[50vh] object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleClearImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card
                className={`border-dashed border-2 cursor-pointer hover:border-primary transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : ""
                }`}
                onClick={handleImageCapture}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                  <Camera className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                  <p className="text-base sm:text-lg font-medium text-center">Zrób zdjęcie faktury</p>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    Kliknij, aby aktywować aparat
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2">
                    lub przeciągnij i upuść plik
                  </p>
                  <p className="text-xs text-muted-foreground/70 text-center mt-1">
                    (maks. 10MB)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Invoice Number */}
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">
              Numer faktury <span className="text-red-500">*</span>
            </Label>
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="np. FV/2024/001"
              required
            />
          </div>

          {/* Kwota (Amount) */}
          <div className="space-y-2">
            <Label htmlFor="kwota">
              Kwota <span className="text-red-500">*</span>
            </Label>
            <Input
              id="kwota"
              type="text"
              inputMode="decimal"
              value={kwota}
              onChange={(e) => {
                // Allow only numbers, comma, dot, and spaces
                const value = e.target.value.replace(/[^0-9.,\s]/g, '');
                setKwota(value);
              }}
              placeholder="np. 123.45"
              required
            />
          </div>

          {/* Company Selection */}
          <div className="space-y-2">
            <Label htmlFor="company">
              Firma <span className="text-red-500">*</span>
            </Label>
            {loadingCompanies ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Ładowanie firm...
              </div>
            ) : (
              <SearchableSelect
                options={companyOptions}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Wybierz firmę"
                searchPlaceholder="Szukaj po nazwie, NIP lub UUID..."
                emptyText="Nie znaleziono firm"
                required
              />
            )}
          </div>

          {/* Justification field */}
          <div className="space-y-2">
            <Label htmlFor="justification">
              Uzasadnienie <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJustification(e.target.value)}
              placeholder=""
              className="min-h-[100px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              {justification.length}/10 znaków minimum
            </p>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={createMutation.isPending || !imageDataUrl || !invoiceNumber.trim() || !kwota.trim() || !companyId || justification.trim().length < 10}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wysyłanie...
              </>
            ) : (
              "Wyślij fakturę"
            )}
          </Button>
        </form>
        <div className="hidden md:block">
          <Footer />
        </div>
      </main>
      <div className="md:hidden">
        <Footer />
      </div>
      
      <OfflineUploadDialog
        open={showOfflineDialog}
        onClose={() => setShowOfflineDialog(false)}
        onRefresh={refresh}
      />
    </div>
  );
}
