import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { TRPCError } from "@trpc/server";
import { parseStringPromise } from "xml2js";
import { apiLogger, logError } from "@/lib/logger";

const KSEF_URL = "https://ksef.mf.gov.pl";
const KSEF_TOKEN = process.env.KSEF_TOKEN;

// KSeF number validation - 18-36 characters, alphanumeric with special chars
const ksefNumberSchema = z.string()
  .min(18, "KSeF number must be at least 18 characters")
  .max(36, "KSeF number must be at most 36 characters")
  .regex(/^[A-Z0-9\-]+$/, "Invalid KSeF number format");

async function authenticateWithKSeF(): Promise<string> {
  if (!KSEF_TOKEN) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "KSeF token not configured",
    });
  }

  try {
    const res = await fetch(`${KSEF_URL}/api/online/Session/AuthorisationToken`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": "mobiFaktura/1.0"
      },
      body: JSON.stringify({ token: KSEF_TOKEN }),
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

async function parseInvoiceXML(xmlData: string): Promise<any> {
  try {
    const parsed = await parseStringPromise(xmlData, { 
      explicitArray: false,
      mergeAttrs: true,
    });
    return parsed;
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
  // Verify invoice in KSeF system
  verifyInvoice: protectedProcedure
    .input(z.object({
      ksefNumber: ksefNumberSchema,
    }))
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();

      try {
        apiLogger.info({
          type: "ksef_verification_start",
          userId: ctx.user.id,
          ksefNumber: input.ksefNumber,
        });

        // Authenticate with KSeF
        const sessionToken = await authenticateWithKSeF();

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
