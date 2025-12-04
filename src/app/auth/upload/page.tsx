"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { UserHeader } from "@/components/user-header";
import { AdminHeader } from "@/components/admin-header";
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
import { useToast } from "@/components/ui/use-toast";
import { Unauthorized } from "@/components/unauthorized";
import { Camera, Loader2, X, QrCode, SwitchCamera } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [ksefNumber, setKsefNumber] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [justification, setJustification] = useState("");
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrCameras, setQrCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);

  // All hooks must be called before any conditional returns
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: companies, isLoading: loadingCompanies } = trpc.company.list.useQuery();
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      toast({
        title: "Faktura wysłana",
        description: "Twoja faktura została przesłana do weryfikacji",
      });
      router.push("/auth/dashboard");
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
          // Successfully scanned
          setKsefNumber(decodedText);
          toast({
            title: "Zeskanowano QR kod",
            description: "Numer KSEF został wypełniony",
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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Błąd",
          description: "Proszę wybrać plik graficzny",
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

  const handleClearImage = useCallback(() => {
    setImageDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

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

      if (justification.trim().length < 10) {
        toast({
          title: "Błąd",
          description: "Uzasadnienie musi zawierać minimum 10 znaków",
          variant: "destructive",
        });
        return;
      }

      createMutation.mutate({
        imageDataUrl,
        invoiceNumber: invoiceNumber.trim(),
        ksefNumber: ksefNumber.trim() || undefined,
        companyId,
        justification: justification.trim(),
      });
    },
    [imageDataUrl, invoiceNumber, ksefNumber, companyId, justification, createMutation, toast]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {user?.role === "admin" ? <AdminHeader /> : <UserHeader showAddButton={false} />}

      <main className="flex-1 p-4">
        <h2 className="text-xl font-semibold mb-4">Dodaj fakturę</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Zrób zdjęcie faktury aparatem i uzupełnij dane.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* KSEF Number */}
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
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={toggleQrScanner}
                title="Skanuj kod QR"
              >
                {showQrScanner ? <X className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
              </Button>
            </div>

            {/* QR Scanner */}
            {showQrScanner && (
              <Card className="mt-4">
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
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
              <Select value={companyId} onValueChange={setCompanyId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              placeholder="Podaj powód przesłania faktury (min. 10 znaków)..."
              className="min-h-[100px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              {justification.length}/10 znaków minimum
            </p>
          </div>

          {/* Image capture area */}
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
                className="border-dashed border-2 cursor-pointer hover:border-primary transition-colors"
                onClick={handleImageCapture}
              >
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Zrób zdjęcie faktury</p>
                  <p className="text-sm text-muted-foreground">
                    Kliknij, aby aktywować aparat
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={createMutation.isPending || !imageDataUrl || !invoiceNumber.trim() || !companyId || justification.trim().length < 10}
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
      </main>
    </div>
  );
}
