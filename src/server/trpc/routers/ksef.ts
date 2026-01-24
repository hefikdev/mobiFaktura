import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { parseStringPromise } from "xml2js";
import { apiLogger, logError } from "@/lib/logger";
import { db } from "@/server/db";
import { invoices, companies } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { KSeFInvoiceData } from "@/types";
import { parseKsefQRCode, getKsefApiUrl, detectKsefEnvironment } from "@/lib/ksef-utils";

const KSEF_URL = "https://ksef.mf.gov.pl";

// KSeF number validation - 18-36 characters, alphanumeric with special chars
const ksefNumberSchema = z.string()
  .min(18, "KSeF number must be at least 18 characters")
  .max(36, "KSeF number must be at most 36 characters")
  .regex(/^[A-Z0-9\-]+$/, "Invalid KSeF number format");

// authenticateWithKSeF function - checks env variables only
async function authenticateWithKSeF(nip: string | null): Promise<string> {
  // Try to get company-specific token first
  let token = nip ? process.env[`KSEF_TOKEN_${nip.replace(/[^0-9]/g, "")}`] : null;
  
  // Fallback to default token
  if (!token) {
    token = process.env.KSEF_TOKEN;
  }

  if (!token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: nip 
        ? `KSeF token not configured for company with NIP ${nip}. Please add KSEF_TOKEN_${nip.replace(/[^0-9]/g, "")} to .env file.` 
        : "KSeF token not configured in .env file",
    });
  }

  try {
    const res = await fetch(`${KSEF_URL}/api/online/Session/AuthorisationToken`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "mobiFaktura/1.0"
      },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!res.ok) {
      apiLogger.error({
        type: "ksef_auth_failed",
        status: res.status,
        message: `KSeF authentication failed with status ${res.status}`,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to authenticate with KSeF system",
      });
    }

    const data = await res.json();
    if (!data.sessionToken?.token) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid KSeF authentication response",
      });
    }

    return data.sessionToken.token;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    
    logError(error, {
      type: "ksef_auth_error",
      message: "Error authenticating with KSeF",
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to authenticate with KSeF system",
    });
  }
}

async function getInvoiceFromKSeF(
  sessionToken: string,
  ksefNumber: string
): Promise<string> {
  try {
    const res = await fetch(
      `${KSEF_URL}/api/online/Invoice/Get?ksefReferenceNumber=${encodeURIComponent(ksefNumber)}`,
      {
        method: "GET",
        headers: {
          "Session-Token": sessionToken,
          "Accept": "application/octet-stream",
          "User-Agent": "mobiFaktura/1.0"
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (!res.ok) {
      if (res.status === 404) {
        apiLogger.warn({
          type: "ksef_invoice_not_found",
          ksefNumber,
        });
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found in KSeF system",
        });
      }

      if (res.status === 401 || res.status === 403) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No access to this invoice in KSeF system",
        });
      }

      apiLogger.error({
        type: "ksef_invoice_fetch_failed",
        status: res.status,
        ksefNumber,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch invoice from KSeF",
      });
    }

    return await res.text();
  } catch (error) {
    if (error instanceof TRPCError) throw error;

    logError(error, {
      type: "ksef_invoice_fetch_error",
      ksefNumber,
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch invoice from KSeF",
    });
  }
}

async function parseInvoiceXML(xmlData: string): Promise<KSeFInvoiceData> {
  try {
    const parsed = await parseStringPromise(xmlData, { 
      explicitArray: false,
      mergeAttrs: true,
    });
    return parsed as KSeFInvoiceData;
  } catch (error) {
    logError(error, {
      type: "ksef_xml_parse_error",
    });

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to parse invoice XML from KSeF",
    });
  }
}

export const ksefRouter = createTRPCRouter({
  // Fetch invoice data from QR code for auto-filling form
  fetchInvoiceData: protectedProcedure
    .input(z.object({
      qrCode: z.string().optional(),
      ksefNumber: ksefNumberSchema.optional(),
      companyId: z.string().uuid(),
    }).refine((data) => data.qrCode || data.ksefNumber, {
      message: "Either qrCode or ksefNumber must be provided",
    }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      try {
        let ksefNumber: string | undefined;
        let qrData = null;

        // Parse QR code if provided
        if (input.qrCode) {
          qrData = parseKsefQRCode(input.qrCode);
          if (!qrData || qrData.type !== 'invoice') {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid KSeF QR code format",
            });
          }
          
          apiLogger.info({
            type: "ksef_qr_parsed",
            userId: ctx.user.id,
            nip: qrData.nip,
            date: qrData.date,
          });
        }

        // Use KSeF number from QR or direct input
        ksefNumber = input.ksefNumber;

        // Get company NIP for authentication
        const [companyData] = await db
          .select({
            nip: companies.nip,
          })
          .from(companies)
          .where(eq(companies.id, input.companyId))
          .limit(1);

        const nip = companyData?.nip || null;

        apiLogger.info({
          type: "ksef_fetch_start",
          userId: ctx.user.id,
          ksefNumber,
          companyId: input.companyId,
        });

        // Authenticate with KSeF
        const sessionToken = await authenticateWithKSeF(nip);

        // Fetch invoice XML - either by KSeF number or by QR data
        let xmlData: string;
        if (ksefNumber) {
          xmlData = await getInvoiceFromKSeF(sessionToken, ksefNumber);
        } else if (qrData?.nip && qrData?.date && qrData?.hash) {
          // For QR codes without KSeF number, we need to search by hash
          // This is for invoices not yet assigned a KSeF number
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "Fetching by QR hash not yet implemented. Please wait for KSeF number to be assigned.",
          });
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid identifier for fetching invoice",
          });
        }

        // Parse XML to JSON
        const invoice = await parseInvoiceXML(xmlData);

        // Extract key data for form auto-fill
        const invoiceNumber = invoice.Faktura?.Fa?.NrFa || "";
        const kwota = invoice.Faktura?.FaPodsumowanie?.KwotaBrutto 
          ? parseFloat(invoice.Faktura.FaPodsumowanie.KwotaBrutto)
          : null;
        const seller = invoice.Faktura?.Podmiot1?.DaneIdentyfikacyjne?.Nazwa || "";
        const buyer = invoice.Faktura?.Podmiot2?.DaneIdentyfikacyjne?.Nazwa || "";
        const date = invoice.Faktura?.FaPodsumowanie?.DataWystawienia || "";

        const duration = Date.now() - startTime;

        apiLogger.info({
          type: "ksef_fetch_success",
          userId: ctx.user.id,
          ksefNumber,
          duration: `${duration}ms`,
        });

        return {
          success: true,
          data: {
            invoiceNumber,
            kwota,
            seller,
            buyer,
            date,
            ksefNumber,
          },
          fullInvoice: invoice,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TRPCError) {
          apiLogger.warn({
            type: "ksef_fetch_failed",
            userId: ctx.user.id,
            error: error.message,
            duration: `${duration}ms`,
          });
          throw error;
        }

        logError(error, {
          type: "ksef_fetch_error",
          userId: ctx.user.id,
          duration: `${duration}ms`,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch invoice data from KSeF",
        });
      }
    }),

  // Verify invoice in KSeF system
  verifyInvoice: protectedProcedure
    .input(z.object({
      ksefNumber: ksefNumberSchema,
      invoiceId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();

      try {
        apiLogger.info({
          type: "ksef_verification_start",
          userId: ctx.user.id,
          ksefNumber: input.ksefNumber,
          invoiceId: input.invoiceId,
        });

        // Get company NIP if invoiceId is provided
        let nip: string | null = null;
        if (input.invoiceId) {
          const [invoiceData] = await db
            .select({
              nip: companies.nip,
            })
            .from(invoices)
            .innerJoin(companies, eq(invoices.companyId, companies.id))
            .where(eq(invoices.id, input.invoiceId))
            .limit(1);
          
          if (invoiceData) {
            nip = invoiceData.nip;
          }
        }

        // Authenticate with KSeF using company-specific token if available
        const sessionToken = await authenticateWithKSeF(nip);

        // Fetch invoice XML
        const xmlData = await getInvoiceFromKSeF(sessionToken, input.ksefNumber);

        // Parse XML to JSON
        const invoice = await parseInvoiceXML(xmlData);

        const duration = Date.now() - startTime;

        apiLogger.info({
          type: "ksef_verification_success",
          userId: ctx.user.id,
          ksefNumber: input.ksefNumber,
          duration: `${duration}ms`,
        });

        return {
          valid: true,
          invoice,
          ksefNumber: input.ksefNumber,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TRPCError) {
          apiLogger.warn({
            type: "ksef_verification_failed",
            userId: ctx.user.id,
            ksefNumber: input.ksefNumber,
            error: error.message,
            duration: `${duration}ms`,
          });
          throw error;
        }

        logError(error, {
          type: "ksef_verification_error",
          userId: ctx.user.id,
          ksefNumber: input.ksefNumber,
          duration: `${duration}ms`,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to verify invoice in KSeF system",
        });
      }
    }),
});
