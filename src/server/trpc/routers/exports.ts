import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, type Context } from "../init";
import { db } from "@/server/db";
import { eq, desc, asc, and, gte, lte, sql, inArray, type SQL } from "drizzle-orm";
import { invoices, users, companies, advances, budgetRequests, saldoTransactions } from "@/server/db/schema";
import type { PgColumn } from "drizzle-orm/pg-core";
import ExcelJS from "exceljs";

// Type definitions for data structures
type ColumnConfig = z.infer<typeof columnConfigSchema>;
type ReportConfig = z.infer<typeof reportConfigSchema>;
type InvoiceReportParams = z.infer<typeof invoiceReportParamsSchema>;
type AdvancesReportParams = z.infer<typeof advancesReportParamsSchema>;
type BudgetRequestsReportParams = z.infer<typeof budgetRequestsReportParamsSchema>;
type SaldoReportParams = z.infer<typeof saldoReportParamsSchema>;
type CorrectionsReportParams = z.infer<typeof correctionsReportParamsSchema>;

type ReportParams = 
  | InvoiceReportParams 
  | AdvancesReportParams 
  | BudgetRequestsReportParams 
  | SaldoReportParams 
  | CorrectionsReportParams;

interface InvoiceData {
  id: string;
  invoiceNumber: string | null;
  companyId: string | null;
  companyName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  kwota: string | null;
  status: string;
  ksefNumber: string | null;
  invoiceType: string;
  description: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

interface AdvanceData {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  amount: string;
  status: string;
  description: string | null;
  createdAt: Date;
  transferDate: Date | null;
  settledAt: Date | null;
}

interface BudgetRequestData {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyName: string | null;
  requestedAmount: string;
  currentBalanceAtRequest: string;
  status: string;
  justification: string;
  createdAt: Date;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
}

interface SaldoData {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  transactionType: string;
  type: string;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
  balance: number;
  companyName: string;
  companyId: string | null;
}

interface CorrectionData {
  id: string;
  invoiceNumber: string | null;
  originalInvoiceId: string | null;
  companyId: string | null;
  companyName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  correctionAmount: string | null;
  status: string;
  description: string | null;
  createdAt: Date;
  originalInvoiceNumber: string;
}

type ExportData = InvoiceData | AdvanceData | BudgetRequestData | SaldoData | CorrectionData;

interface SortableItem {
  [key: string]: unknown;
}

// Column configuration schema
const columnConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean(),
});

// Base report params schema
const baseReportParamsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  includeUUIDs: z.boolean().optional(),
  columns: z.array(columnConfigSchema).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  currencyFormat: z.enum(["PLN", "EUR", "USD"]).optional(),
  showCurrencySymbol: z.boolean().optional(),
  fileName: z.string().optional(),
  sheetName: z.string().optional(),
  includeTimestamp: z.boolean().optional(),
});

// Invoice-specific params
const invoiceReportParamsSchema = baseReportParamsSchema.extend({
  status: z.string().optional(),
  includeKSeF: z.boolean().optional(),
  invoiceType: z.string().optional(),
  ksefNumber: z.string().optional(),
});

// Advances-specific params
const advancesReportParamsSchema = baseReportParamsSchema.extend({
  status: z.string().optional(),
});

// Budget requests-specific params
const budgetRequestsReportParamsSchema = baseReportParamsSchema.extend({
  status: z.string().optional(),
});

// Saldo-specific params
const saldoReportParamsSchema = baseReportParamsSchema.extend({
  transactionTypes: z.string().optional(),
});

// Corrections-specific params
const correctionsReportParamsSchema = baseReportParamsSchema;

// Report configuration schema
const reportConfigSchema = z.object({
  type: z.enum(["invoices", "advances", "budgetRequests", "saldo", "corrections"]),
  enabled: z.boolean(),
  params: z.union([
    invoiceReportParamsSchema,
    advancesReportParamsSchema,
    budgetRequestsReportParamsSchema,
    saldoReportParamsSchema,
    correctionsReportParamsSchema,
  ]),
});

// Helper function to format date
function formatDate(date: Date | string, format: string = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "yyyy-MM-dd":
      return `${year}-${month}-${day}`;
    case "dd.MM.yyyy":
      return `${day}.${month}.${year}`;
    case "dd/MM/yyyy":
    default:
      return `${day}/${month}/${year}`;
  }
}

// Helper function to format currency
function formatCurrency(amount: number | string, currencyFormat: string = "PLN", showSymbol: boolean = true): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = num.toFixed(2);
  
  if (!showSymbol) return formatted;
  
  switch (currencyFormat) {
    case "EUR":
      return `€${formatted}`;
    case "USD":
      return `$${formatted}`;
    case "PLN":
    default:
      return `${formatted} zł`;
  }
}

// Helper function to calculate optimal column widths
function calculateColumnWidth(values: string[], minWidth: number = 10, maxWidth: number = 50): number {
  if (values.length === 0) return minWidth;
  
  // Calculate max length considering Polish characters take more space
  const maxLength = Math.max(...values.map(val => {
    if (!val) return 0;
    const str = String(val);
    // Polish characters like ą, ę, ż, etc. are slightly wider
    const polishChars = (str.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
    return str.length + (polishChars * 0.2);
  }));
  
  // Add padding (15% extra space for comfort)
  const width = maxLength * 1.15;
  
  // Clamp between min and max
  return Math.min(Math.max(width, minWidth), maxWidth);
}

// Helper function to auto-fit columns in worksheet
function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth: number = 10, maxWidth: number = 50) {
  worksheet.columns.forEach((column, index) => {
    if (!column.eachCell) return;
    
    const values: string[] = [];
    column.eachCell({ includeEmpty: false }, (cell) => {
      values.push(String(cell.value || ''));
    });
    
    if (values.length > 0) {
      column.width = calculateColumnWidth(values, minWidth, maxWidth);
    } else {
      column.width = minWidth;
    }
  });
}

export const exportsRouter = createTRPCRouter({
  // Generate mixed report with multiple worksheets
  generateMixedReport: protectedProcedure
    .input(
      z.object({
        reports: z.array(reportConfigSchema),
        exportFormat: z.enum(["xlsx", "pdf"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only accountants and admins can generate reports
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      // Process each enabled report
      for (const report of input.reports.filter((r) => r.enabled)) {
        let data: ExportData[] = [];
        let sheetName = report.params.sheetName || report.type;

        switch (report.type) {
          case "invoices":
            data = await generateInvoicesData(ctx, report.params as InvoiceReportParams);
            break;
          case "advances":
            data = await generateAdvancesData(ctx, report.params as AdvancesReportParams);
            break;
          case "budgetRequests":
            data = await generateBudgetRequestsData(ctx, report.params as BudgetRequestsReportParams);
            break;
          case "saldo":
            data = await generateSaldoData(ctx, report.params as SaldoReportParams);
            break;
          case "corrections":
            data = await generateCorrectionsData(ctx, report.params as CorrectionsReportParams);
            break;
        }

        // Create worksheet
        const worksheet = workbook.addWorksheet(sheetName);

        if (data.length > 0) {
          // Get enabled columns
          const enabledColumns = report.params.columns?.filter((c) => c.enabled) || [];
          const headers = enabledColumns.map((c) => c.label);
          const columnKeys = enabledColumns.map((c) => c.id);

          // Add header row
          worksheet.addRow(headers);
          const headerRow = worksheet.getRow(1);
          headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
          headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" },
          };
          headerRow.alignment = { vertical: "middle", horizontal: "center" };

          // Add data rows
          data.forEach((item) => {
            const row = columnKeys.map((key) => {
              const itemRecord = item as unknown as Record<string, unknown>;
              let value = itemRecord[key];

              // Format dates
              if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt" || key === "transferDate" || key === "settledAt") {
                if (value) {
                  value = formatDate(value as Date | string, "dd/MM/yyyy");
                }
              }

              // Format currency
              if (key.includes("amount") || key.includes("Amount") || key === "kwota" || key === "balance") {
                if (value !== null && value !== undefined) {
                  value = formatCurrency(value as number | string, report.params.currencyFormat || "PLN", report.params.showCurrencySymbol !== false);
                }
              }

              return value ?? "-";
            });
            worksheet.addRow(row);
          });

          // Auto-fit columns with improved width calculation
          autoFitColumns(worksheet, 12, 60);

          // Add borders to all cells
          worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            });
          });
        }
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      return {
        success: true,
        data: base64,
        fileName: generateFileName(input.reports),
      };
    }),

  // Generate single invoice report
  generateInvoiceReport: protectedProcedure
    .input(invoiceReportParamsSchema)
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateInvoicesData(ctx, input);
      return { success: true, data };
    }),

  // Generate single advances report
  generateAdvancesReport: protectedProcedure
    .input(advancesReportParamsSchema)
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateAdvancesData(ctx, input);
      return { success: true, data };
    }),

  // Generate budget requests report
  generateBudgetRequestsReport: protectedProcedure
    .input(budgetRequestsReportParamsSchema)
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateBudgetRequestsData(ctx, input);
      return { success: true, data };
    }),

  // Generate single advances Excel report
  generateAdvancesExcel: protectedProcedure
    .input(advancesReportParamsSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      const data = await generateAdvancesData(ctx, input);
      const sheetName = input.sheetName || "Zaliczki";
      const worksheet = workbook.addWorksheet(sheetName);

      if (data.length > 0) {
        // Get enabled columns or use all columns
        const enabledColumns = input.columns?.filter((c) => c.enabled) || [
          { id: "userName", label: "Użytkownik" },
          { id: "companyName", label: "Firma" },
          { id: "amount", label: "Kwota" },
          { id: "status", label: "Status" },
          { id: "createdAt", label: "Data utworzenia" },
        ];
        const headers = enabledColumns.map((c) => c.label);
        const columnKeys = enabledColumns.map((c) => c.id);

        // Add header row
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };

        // Status translations
        const statusLabels: Record<string, string> = {
          pending: "Oczekująca",
          transferred: "Przelana",
          settled: "Rozliczona",
        };

        // Add data rows
        data.forEach((item) => {
          const row = columnKeys.map((key) => {
            const itemRecord = item as unknown as Record<string, unknown>;
            let value = itemRecord[key];

            // Format dates
            if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt" || key === "transferDate" || key === "settledAt") {
              if (value) {
                value = formatDate(value as Date | string, "dd/MM/yyyy");
              }
            }

            // Format currency
            if (key.includes("amount") || key.includes("Amount") || key === "kwota" || key === "balance") {
              if (value !== null && value !== undefined) {
                value = formatCurrency(value as number | string, input.currencyFormat || "PLN", input.showCurrencySymbol !== false);
              }
            }

            // Format status
            if (key === "status" && value && typeof value === "string" && statusLabels[value]) {
              value = statusLabels[value];
            }

            // Format sourceType
            if (key === "sourceType") {
              value = value === "budget_request" ? "Wniosek budżetowy" : "Przyznana przez księgowego";
            }

            return value ?? "-";
          });
          worksheet.addRow(row);
        });

        // Auto-fit columns with improved width calculation
        autoFitColumns(worksheet, 12, 60);

        // Add borders to all cells
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Generate filename
      let fileName = input.fileName || "zaliczki";
      if (input.includeTimestamp !== false) {
        fileName += `_${new Date().toISOString().split('T')[0]}`;
      }

      return {
        success: true,
        data: base64,
        fileName: `${fileName}.xlsx`,
      };
    }),

  // Generate single invoices Excel report
  generateInvoicesExcel: protectedProcedure
    .input(invoiceReportParamsSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      const data = await generateInvoicesData(ctx, input);
      const sheetName = input.sheetName || "Faktury";
      const worksheet = workbook.addWorksheet(sheetName);

      if (data.length > 0) {
        // Get enabled columns or use all columns
        const enabledColumns = input.columns?.filter((c) => c.enabled) || [
          { id: "invoiceNumber", label: "Numer faktury" },
          { id: "companyName", label: "Firma" },
          { id: "userName", label: "Użytkownik" },
          { id: "kwota", label: "Kwota" },
          { id: "status", label: "Status" },
          { id: "createdAt", label: "Data utworzenia" },
        ];
        const headers = enabledColumns.map((c) => c.label);
        const columnKeys = enabledColumns.map((c) => c.id);

        // Add header row
        worksheet.addRow(headers);
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };

        // Status translations
        const statusLabels: Record<string, string> = {
          pending: "Oczekująca",
          approved: "Zaakceptowana",
          rejected: "Odrzucona",
          settled: "Rozliczona",
        };

        // Invoice type translations
        const invoiceTypeLabels: Record<string, string> = {
          einvoice: "E-faktura",
          paragon: "Paragon",
          correction: "Korekta",
        };

        // Add data rows
        data.forEach((item) => {
          const row = columnKeys.map((key) => {
            const itemRecord = item as unknown as Record<string, unknown>;
            let value = itemRecord[key];

            // Format dates
            if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt") {
              if (value) {
                value = formatDate(value as Date | string, "dd/MM/yyyy");
              }
            }

            // Format currency
            if (key.includes("amount") || key.includes("Amount") || key === "kwota") {
              if (value !== null && value !== undefined) {
                value = formatCurrency(value as number | string, input.currencyFormat || "PLN", input.showCurrencySymbol !== false);
              }
            }

            // Format status
            if (key === "status" && value && typeof value === "string" && statusLabels[value]) {
              value = statusLabels[value];
            }

            // Format invoice type
            if (key === "invoiceType" && value && typeof value === "string" && invoiceTypeLabels[value]) {
              value = invoiceTypeLabels[value];
            }

            return value ?? "-";
          });
          worksheet.addRow(row);
        });

        // Auto-fit columns with improved width calculation
        autoFitColumns(worksheet, 12, 60);

        // Add borders to all cells
        worksheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Generate filename
      let fileName = input.fileName || "faktury";
      if (input.includeTimestamp !== false) {
        fileName += `_${new Date().toISOString().split('T')[0]}`;
      }

      return {
        success: true,
        data: base64,
        fileName: `${fileName}.xlsx`,
      };
    }),

  // Generate single item invoice Excel (for detail pages)
  generateSingleInvoiceExcel: protectedProcedure
    .input(z.object({
      invoiceId: z.string(),
      dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"]).optional(),
      currencyFormat: z.enum(["PLN", "EUR", "USD"]).optional(),
      showCurrencySymbol: z.boolean().optional(),
      fileName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user || (ctx.user.role !== "user" && ctx.user.role !== "accountant" && ctx.user.role !== "admin")) {
        throw new Error("Unauthorized");
      }

      // Fetch single invoice
      const invoice = await ctx.db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          companyId: invoices.companyId,
          companyName: companies.name,
          userId: invoices.userId,
          userName: users.name,
          userEmail: users.email,
          kwota: invoices.kwota,
          status: invoices.status,
          ksefNumber: invoices.ksefNumber,
          invoiceType: invoices.invoiceType,
          description: invoices.description,
          createdAt: invoices.createdAt,
          reviewedAt: invoices.reviewedAt,
        })
        .from(invoices)
        .leftJoin(users, eq(invoices.userId, users.id))
        .leftJoin(companies, eq(invoices.companyId, companies.id))
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!invoice || invoice.length === 0) {
        throw new Error("Invoice not found");
      }

      const data = invoice[0];
      if (!data) {
        throw new Error("Invoice not found");
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Faktura");

      // Status translations
      const statusLabels: Record<string, string> = {
        pending: "Oczekująca",
        approved: "Zaakceptowana",
        rejected: "Odrzucona",
        settled: "Rozliczona",
      };

      // Invoice type translations
      const invoiceTypeLabels: Record<string, string> = {
        einvoice: "E-faktura",
        paragon: "Paragon",
        correction: "Korekta",
      };

      // Create vertical layout (label-value pairs)
      worksheet.addRow(["Szczegóły faktury"]);
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.addRow([]);

      worksheet.addRow(["Numer faktury:", data.invoiceNumber || "-"]);
      worksheet.addRow(["Firma:", data.companyName || "-"]);
      worksheet.addRow(["Użytkownik:", data.userName || "-"]);
      worksheet.addRow(["Email:", data.userEmail || "-"]);
      worksheet.addRow(["Kwota:", data.kwota ? formatCurrency(parseFloat(data.kwota), input.currencyFormat || "PLN", input.showCurrencySymbol !== false) : "-"]);
      worksheet.addRow(["Status:", statusLabels[data.status] || data.status]);
      worksheet.addRow(["Typ faktury:", data.invoiceType ? (invoiceTypeLabels[data.invoiceType] || data.invoiceType) : "-"]);
      worksheet.addRow(["Numer KSeF:", data.ksefNumber || "-"]);
      worksheet.addRow(["Data utworzenia:", formatDate(data.createdAt, "dd/MM/yyyy")]);
      worksheet.addRow(["Data weryfikacji:", data.reviewedAt ? formatDate(data.reviewedAt, "dd/MM/yyyy") : "-"]);
      worksheet.addRow(["Opis:", data.description || "-"]);

      // Style the labels column
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(1).font = { bold: true };
      worksheet.getColumn(2).width = 40;

      // Add borders
      for (let i = 3; i <= 13; i++) {
        worksheet.getRow(i).eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Generate filename
      const fileName = input.fileName || `faktura_${data.invoiceNumber?.replace(/\//g, "_")}`;

      return {
        success: true,
        data: base64,
        fileName: `${fileName}.xlsx`,
      };
    }),

  // Generate Excel for single advance
  generateSingleAdvanceExcel: protectedProcedure
    .input(
      z.object({
        advanceId: z.string(),
        dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"]).default("dd/MM/yyyy"),
        currencyFormat: z.enum(["PLN", "EUR", "USD"]).default("PLN"),
        showCurrencySymbol: z.boolean().default(true),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch single advance with user and company info
      const data = await ctx.db.query.advances.findFirst({
        where: eq(advances.id, input.advanceId),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          company: {
            columns: {
              name: true,
            },
          },
        },
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Advance not found",
        });
      }

      // Fetch budget request if sourceId exists and sourceType is budget_request
      let budgetRequestData = null;
      if (data.sourceId && data.sourceType === "budget_request") {
        budgetRequestData = await ctx.db.query.budgetRequests.findFirst({
          where: eq(budgetRequests.id, data.sourceId),
          columns: {
            id: true,
            requestedAmount: true,
            justification: true,
          },
        });
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Zaliczka");

      // Status translation
      const statusLabels: Record<string, string> = {
        pending: "Oczekująca",
        transferred: "Przelana",
        settled: "Rozliczona",
      };

      // Source type translation
      const sourceTypeLabel = budgetRequestData
        ? "Wniosek budżetowy" 
        : "Przyznana przez księgowego";

      // Create vertical layout (label-value pairs)
      worksheet.addRow(["Szczegóły zaliczki"]);
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.addRow([]);

      worksheet.addRow(["Użytkownik:", data.user?.name || "-"]);
      worksheet.addRow(["Email:", data.user?.email || "-"]);
      worksheet.addRow(["Firma:", data.company?.name || "-"]);
      worksheet.addRow(["Kwota:", data.amount ? formatCurrency(parseFloat(data.amount), input.currencyFormat || "PLN", input.showCurrencySymbol !== false) : "-"]);
      worksheet.addRow(["Status:", statusLabels[data.status] || data.status]);
      worksheet.addRow(["Źródło:", sourceTypeLabel]);
      worksheet.addRow(["Data utworzenia:", formatDate(data.createdAt, "dd/MM/yyyy")]);
      worksheet.addRow(["Data przelewu:", data.transferDate ? formatDate(data.transferDate, "dd/MM/yyyy") : "-"]);
      worksheet.addRow(["Data rozliczenia:", data.settledAt ? formatDate(data.settledAt, "dd/MM/yyyy") : "-"]);
      worksheet.addRow(["Opis:", data.description || "-"]);
      if (budgetRequestData) {
        worksheet.addRow(["Uzasadnienie wniosku:", budgetRequestData.justification || "-"]);
      }

      // Style the labels column
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(1).font = { bold: true };
      worksheet.getColumn(2).width = 40;

      // Add borders
      const lastRow = budgetRequestData ? 13 : 12;
      for (let i = 3; i <= lastRow; i++) {
        worksheet.getRow(i).eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Generate filename
      const fileName = input.fileName || `zaliczka_${data.user?.name?.replace(/\s+/g, "_")}_${formatDate(data.createdAt, "yyyy-MM-dd")}`;

      return {
        success: true,
        data: base64,
        fileName: `${fileName}.xlsx`,
      };
    }),

  // Generate Excel for single budget request
  generateSingleBudgetRequestExcel: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd", "dd.MM.yyyy"]).default("dd/MM/yyyy"),
        currencyFormat: z.enum(["PLN", "EUR", "USD"]).default("PLN"),
        showCurrencySymbol: z.boolean().default(true),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch single budget request with user and company info
      const data = await ctx.db.query.budgetRequests.findFirst({
        where: eq(budgetRequests.id, input.requestId),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            },
          },
          company: {
            columns: {
              name: true,
            },
          },
          reviewer: {
            columns: {
              name: true,
            },
          },
        },
      });

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Budget request not found",
        });
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Wniosek budżetowy");

      // Status translation
      const statusLabels: Record<string, string> = {
        pending: "Oczekujący",
        approved: "Zatwierdzony",
        rejected: "Odrzucony",
      };

      // Create vertical layout (label-value pairs)
      worksheet.addRow(["Szczegóły wniosku budżetowego"]);
      worksheet.getRow(1).font = { bold: true, size: 14 };
      worksheet.addRow([]);

      worksheet.addRow(["Użytkownik:", data.user?.name || "-"]);
      worksheet.addRow(["Email:", data.user?.email || "-"]);
      worksheet.addRow(["Firma:", data.company?.name || "-"]);
      worksheet.addRow(["Stan salda:", data.currentBalanceAtRequest ? formatCurrency(parseFloat(data.currentBalanceAtRequest), input.currencyFormat || "PLN", input.showCurrencySymbol !== false) : "-"]);
      worksheet.addRow(["Wnioskowana kwota:", data.requestedAmount ? formatCurrency(parseFloat(data.requestedAmount), input.currencyFormat || "PLN", input.showCurrencySymbol !== false) : "-"]);
      worksheet.addRow(["Status:", statusLabels[data.status] || data.status]);
      worksheet.addRow(["Uzasadnienie:", data.justification || "-"]);
      worksheet.addRow(["Data utworzenia:", formatDate(data.createdAt, "dd/MM/yyyy")]);
      worksheet.addRow(["Data weryfikacji:", data.reviewedAt ? formatDate(data.reviewedAt, "dd/MM/yyyy") : "-"]);
      worksheet.addRow(["Księgowy:", data.reviewer?.name || "-"]);
      if (data.status === "rejected" && data.rejectionReason) {
        worksheet.addRow(["Powód odrzucenia:", data.rejectionReason]);
      }

      // Style the labels column
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(1).font = { bold: true };
      worksheet.getColumn(2).width = 40;

      // Add borders
      const lastRow = data.status === "rejected" && data.rejectionReason ? 13 : 12;
      for (let i = 3; i <= lastRow; i++) {
        worksheet.getRow(i).eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Generate filename
      const fileName = input.fileName || `wniosek_${data.user?.name?.replace(/\s+/g, "_")}_${formatDate(data.createdAt, "yyyy-MM-dd")}`;

      return {
        success: true,
        data: base64,
        fileName: `${fileName}.xlsx`,
      };
    }),
});

// Helper functions to generate data for each report type
async function generateInvoicesData(ctx: Context, params: InvoiceReportParams): Promise<InvoiceData[]> {
  let query = ctx.db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      companyId: invoices.companyId,
      companyName: companies.name,
      userId: invoices.userId,
      userName: users.name,
      userEmail: users.email,
      kwota: invoices.kwota,
      status: invoices.status,
      ksefNumber: invoices.ksefNumber,
      invoiceType: invoices.invoiceType,
      description: invoices.description,
      createdAt: invoices.createdAt,
      reviewedAt: invoices.reviewedAt,
    })
    .from(invoices)
    .leftJoin(users, eq(invoices.userId, users.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id));

  // Apply filters - build all conditions upfront
  const conditions = [];
  if (params.dateFrom) {
    conditions.push(gte(invoices.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(invoices.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    conditions.push(eq(invoices.status, params.status as "pending" | "in_review" | "accepted" | "transferred" | "settled" | "rejected"));
  }

  // Apply all conditions at once if any exist
  let results;
  if (conditions.length > 0) {
    results = await query.where(and(...conditions));
  } else {
    results = await query;
  }

  // Apply sorting
  const sortBy = (params.sortBy || "createdAt") as keyof InvoiceData;
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    // Handle null values - put them at the end
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results as InvoiceData[];
}

async function generateAdvancesData(ctx: Context, params: AdvancesReportParams): Promise<AdvanceData[]> {
  let query = ctx.db
    .select({
      id: advances.id,
      userId: advances.userId,
      userName: users.name,
      userEmail: users.email,
      companyId: advances.companyId,
      companyName: companies.name,
      amount: advances.amount,
      status: advances.status,
      description: advances.description,
      createdAt: advances.createdAt,
      transferDate: advances.transferDate,
      settledAt: advances.settledAt,
    })
    .from(advances)
    .leftJoin(users, eq(advances.userId, users.id))
    .leftJoin(companies, eq(advances.companyId, companies.id));

  // Apply filters - build all conditions upfront
  const conditions = [];
  if (params.dateFrom) {
    conditions.push(gte(advances.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(advances.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    conditions.push(eq(advances.status, params.status));
  }

  // Apply all conditions at once if any exist
  let results;
  if (conditions.length > 0) {
    results = await query.where(and(...conditions));
  } else {
    results = await query;
  }

  // Apply sorting
  const sortBy = (params.sortBy || "createdAt") as keyof AdvanceData;
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    // Handle null/undefined values
    if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results as AdvanceData[];
}

async function generateBudgetRequestsData(ctx: Context, params: BudgetRequestsReportParams): Promise<BudgetRequestData[]> {
  let query = ctx.db
    .select({
      id: budgetRequests.id,
      userId: budgetRequests.userId,
      userName: users.name,
      userEmail: users.email,
      companyId: budgetRequests.companyId,
      companyName: companies.name,
      requestedAmount: budgetRequests.requestedAmount,
      currentBalanceAtRequest: budgetRequests.currentBalanceAtRequest,
      status: budgetRequests.status,
      justification: budgetRequests.justification,
      createdAt: budgetRequests.createdAt,
      reviewedAt: budgetRequests.reviewedAt,
      // alias expected by export UI
      approvedAt: budgetRequests.reviewedAt,
      rejectionReason: budgetRequests.rejectionReason,
    })
    .from(budgetRequests)
    .leftJoin(users, eq(budgetRequests.userId, users.id))
    .leftJoin(companies, eq(budgetRequests.companyId, companies.id));

  // Apply filters - build all conditions upfront
  const conditions = [];
  if (params.dateFrom) {
    conditions.push(gte(budgetRequests.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(budgetRequests.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    conditions.push(eq(budgetRequests.status, params.status));
  }

  // Apply all conditions at once if any exist
  let results;
  if (conditions.length > 0) {
    results = await query.where(and(...conditions));
  } else {
    results = await query;
  }

  // Apply sorting
  const sortBy = (params.sortBy || "createdAt") as keyof BudgetRequestData;
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    // Handle null/undefined values - put them at the end
    if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results as BudgetRequestData[];
}

async function generateSaldoData(ctx: Context, params: SaldoReportParams): Promise<SaldoData[]> {
  let query = ctx.db
    .select({
      id: saldoTransactions.id,
      userId: saldoTransactions.userId,
      userName: users.name,
      userEmail: users.email,
      amount: saldoTransactions.amount,
      balanceBefore: saldoTransactions.balanceBefore,
      balanceAfter: saldoTransactions.balanceAfter,
      transactionType: saldoTransactions.transactionType,
      referenceId: saldoTransactions.referenceId,
      notes: saldoTransactions.notes,
      createdAt: saldoTransactions.createdAt,
    })
    .from(saldoTransactions)
    .leftJoin(users, eq(saldoTransactions.userId, users.id));

  // Apply filters - build all conditions upfront
  const conditions = [];
  if (params.dateFrom) {
    conditions.push(gte(saldoTransactions.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(saldoTransactions.createdAt, new Date(params.dateTo)));
  }

  // Apply all conditions at once if any exist
  let results;
  if (conditions.length > 0) {
    results = await query.where(and(...conditions));
  } else {
    results = await query;
  }

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a, b) => {
    const aVal = a[sortBy as keyof typeof a];
    const bVal = b[sortBy as keyof typeof b];
    // Handle null/undefined values - put them at the end
    if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Enrich saldo rows so mixed export includes company and UI-friendly fields
  const refIds = results.filter((r) => r.referenceId).map((r) => r.referenceId as string);
  const uniqueRefIds = Array.from(new Set(refIds));

  interface CompanyReference {
    id: string;
    companyId: string | null;
  }

  const invoicesById: Record<string, CompanyReference> = {};
  const advancesById: Record<string, CompanyReference> = {};
  const requestsById: Record<string, CompanyReference> = {};

  if (uniqueRefIds.length > 0) {
    const invs = await ctx.db
      .select({ id: invoices.id, companyId: invoices.companyId })
      .from(invoices)
      .where(inArray(invoices.id, uniqueRefIds));
    invs.forEach((i) => { invoicesById[i.id] = i; });

    const advs = await ctx.db
      .select({ id: advances.id, companyId: advances.companyId })
      .from(advances)
      .where(inArray(advances.id, uniqueRefIds));
    advs.forEach((a) => { advancesById[a.id] = a; });

    const reqs = await ctx.db
      .select({ id: budgetRequests.id, companyId: budgetRequests.companyId })
      .from(budgetRequests)
      .where(inArray(budgetRequests.id, uniqueRefIds));
    reqs.forEach((r) => { requestsById[r.id] = r; });
  }

  const companyIds = Array.from(new Set([
    ...Object.values(invoicesById).map((v) => v.companyId).filter(Boolean) as string[],
    ...Object.values(advancesById).map((v) => v.companyId).filter(Boolean) as string[],
    ...Object.values(requestsById).map((v) => v.companyId).filter(Boolean) as string[],
  ]));

  interface CompanyInfo {
    id: string;
    name: string | null;
  }

  const companiesById: Record<string, CompanyInfo> = {};
  if (companyIds.length > 0) {
    const comps = await ctx.db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, companyIds));
    comps.forEach((c) => { companiesById[c.id] = c; });
  }

  const typeLabels: Record<string, string> = {
    adjustment: 'Korekta',
    invoice_deduction: 'Potrącenie faktury',
    invoice_refund: 'Zwrot za fakturę',
    advance_credit: 'Nadwyżka zaliczki',
    invoice_delete_refund: 'Zwrot (usunięcie faktury)'
  } as const;

  return results.map((tx): SaldoData => {
    let resolvedCompanyId: string | null = null;
    let resolvedCompanyName: string | null = null;

    if (tx.referenceId) {
      const inv = invoicesById[tx.referenceId];
      const adv = advancesById[tx.referenceId];
      const req = requestsById[tx.referenceId];
      const cid = inv?.companyId || adv?.companyId || req?.companyId || null;
      if (cid) {
        resolvedCompanyId = cid;
        resolvedCompanyName = companiesById[cid]?.name || null;
      }
    }

    return {
      id: tx.id,
      userId: tx.userId,
      userName: tx.userName,
      userEmail: tx.userEmail,
      amount: tx.amount ? parseFloat(tx.amount) : 0,
      balanceBefore: tx.balanceBefore ? parseFloat(tx.balanceBefore) : 0,
      balanceAfter: tx.balanceAfter ? parseFloat(tx.balanceAfter) : 0,
      transactionType: tx.transactionType,
      type: typeLabels[tx.transactionType] || tx.transactionType,
      referenceId: tx.referenceId,
      notes: tx.notes,
      createdAt: tx.createdAt,
      // aliases used by frontend/export UI
      balance: tx.balanceAfter ? parseFloat(tx.balanceAfter) : 0,
      companyName: resolvedCompanyName || '-',
      companyId: resolvedCompanyId,
    };
  });
}

async function generateCorrectionsData(ctx: Context, params: CorrectionsReportParams): Promise<CorrectionData[]> {
  let query = ctx.db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      originalInvoiceId: invoices.originalInvoiceId,
      companyId: invoices.companyId,
      companyName: companies.name,
      userId: invoices.userId,
      userName: users.name,
      userEmail: users.email,
      correctionAmount: invoices.correctionAmount,
      status: invoices.status,
      description: invoices.description,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(users, eq(invoices.userId, users.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id));

  // Apply filters - build all conditions upfront (including correction type filter)
  const conditions = [eq(invoices.invoiceType, "correction")];
  if (params.dateFrom) {
    conditions.push(gte(invoices.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    conditions.push(lte(invoices.createdAt, new Date(params.dateTo)));
  }

  // Apply all conditions at once
  type QueryResult = {
    id: string;
    invoiceNumber: string | null;
    originalInvoiceId: string | null;
    companyId: string | null;
    companyName: string | null;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    correctionAmount: string | null;
    status: string;
    description: string | null;
    createdAt: Date;
  };
  const results: QueryResult[] = await query.where(and(...conditions));

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a, b) => {
    const aVal = a[sortBy as keyof typeof a];
    const bVal = b[sortBy as keyof typeof b];
    // Handle null/undefined values
    if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Resolve original invoice numbers in batch and expose `originalInvoiceNumber` for exports
  const originalIds = results.filter((r) => r.originalInvoiceId).map((r) => r.originalInvoiceId as string);
  const uniqueOriginalIds = Array.from(new Set(originalIds));
  
  interface OriginalInvoice {
    id: string;
    invoiceNumber: string | null;
  }
  
  const originalsById: Record<string, OriginalInvoice> = {};
  if (uniqueOriginalIds.length > 0) {
    const originals = await ctx.db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(inArray(invoices.id, uniqueOriginalIds));
    originals.forEach((o) => { originalsById[o.id] = o; });
  }

  return results.map((r): CorrectionData => ({
    ...r,
    originalInvoiceNumber: r.originalInvoiceId ? (originalsById[r.originalInvoiceId]?.invoiceNumber || '-') : '-',
  }));
}

// Generate filename based on reports
function generateFileName(reports: ReportConfig[]): string {
  const enabledReports = reports.filter((r) => r.enabled);
  if (enabledReports.length === 1) {
    const report = enabledReports[0];
    if (!report) return `raport_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
    const baseName = report.params.fileName || report.type;
    const timestamp = report.params.includeTimestamp !== false 
      ? `_${formatDate(new Date(), "yyyy-MM-dd")}`
      : "";
    return `${baseName}${timestamp}.xlsx`;
  }
  return `raport_mieszany_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
}
