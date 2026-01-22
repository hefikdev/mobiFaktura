import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db } from "@/server/db";
import { eq, desc, asc, and, gte, lte, sql } from "drizzle-orm";
import { invoices, users, companies, advances, budgetRequests, saldoTransactions } from "@/server/db/schema";
import ExcelJS from "exceljs";

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

// Helper function to apply filters to query
function applyDateFilters(query: any, params: any, dateColumn: any) {
  if (params.dateFrom) {
    query = query.where(gte(dateColumn, new Date(params.dateFrom)));

  }
  if (params.dateTo) {
    query = query.where(lte(dateColumn, new Date(params.dateTo)));
  }
  return query;
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
    .mutation(async ({ ctx, input }: any) => {
      // Only accountants and admins can generate reports
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      // Process each enabled report
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const report of input.reports.filter((r: any) => r.enabled)) {
        let data: any[] = [];
        let sheetName = report.params.sheetName || report.type;

        switch (report.type) {
          case "invoices":
            data = await generateInvoicesData(ctx, report.params as any);
            break;
          case "advances":
            data = await generateAdvancesData(ctx, report.params as any);
            break;
          case "budgetRequests":
            data = await generateBudgetRequestsData(ctx, report.params as any);
            break;
          case "saldo":
            data = await generateSaldoData(ctx, report.params as any);
            break;
          case "corrections":
            data = await generateCorrectionsData(ctx, report.params as any);
            break;
        }

        // Create worksheet
        const worksheet = workbook.addWorksheet(sheetName);

        if (data.length > 0) {
          // Get enabled columns
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const enabledColumns = report.params.columns?.filter((c: any) => c.enabled) || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const headers = enabledColumns.map((c: any) => c.label);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const columnKeys = enabledColumns.map((c: any) => c.id);

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = columnKeys.map((key: any) => {
              let value = item[key];

              // Format dates
              if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt" || key === "transferDate" || key === "settledAt") {
                if (value) {
                  value = formatDate(value, "dd/MM/yyyy");
                }
              }

              // Format currency
              if (key.includes("amount") || key.includes("Amount") || key === "kwota" || key === "balance") {
                if (value !== null && value !== undefined) {
                  value = formatCurrency(value, report.params.currencyFormat || "PLN", report.params.showCurrencySymbol !== false);
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
    .query(async ({ ctx, input }: any) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateInvoicesData(ctx, input);
      return { success: true, data };
    }),

  // Generate single advances report
  generateAdvancesReport: protectedProcedure
    .input(advancesReportParamsSchema)
    .query(async ({ ctx, input }: any) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateAdvancesData(ctx, input);
      return { success: true, data };
    }),

  // Generate budget requests report
  generateBudgetRequestsReport: protectedProcedure
    .input(budgetRequestsReportParamsSchema)
    .query(async ({ ctx, input }: any) => {
      if (ctx.user.role !== "accountant" && ctx.user.role !== "admin") {
        throw new Error("Unauthorized");
      }

      const data = await generateBudgetRequestsData(ctx, input);
      return { success: true, data };
    }),

  // Generate single advances Excel report
  generateAdvancesExcel: protectedProcedure
    .input(advancesReportParamsSchema)
    .mutation(async ({ ctx, input }: any) => {
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
        const enabledColumns = input.columns?.filter((c: any) => c.enabled) || [
          { id: "userName", label: "Użytkownik" },
          { id: "companyName", label: "Firma" },
          { id: "amount", label: "Kwota" },
          { id: "status", label: "Status" },
          { id: "createdAt", label: "Data utworzenia" },
        ];
        const headers = enabledColumns.map((c: any) => c.label);
        const columnKeys = enabledColumns.map((c: any) => c.id);

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
        data.forEach((item: any) => {
          const row = columnKeys.map((key: any) => {
            let value = item[key];

            // Format dates
            if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt" || key === "transferDate" || key === "settledAt") {
              if (value) {
                value = formatDate(value, "dd/MM/yyyy");
              }
            }

            // Format currency
            if (key.includes("amount") || key.includes("Amount") || key === "kwota" || key === "balance") {
              if (value !== null && value !== undefined) {
                value = formatCurrency(value, input.currencyFormat || "PLN", input.showCurrencySymbol !== false);
              }
            }

            // Format status
            if (key === "status" && value && statusLabels[value]) {
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
    .mutation(async ({ ctx, input }: any) => {
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
        const enabledColumns = input.columns?.filter((c: any) => c.enabled) || [
          { id: "invoiceNumber", label: "Numer faktury" },
          { id: "companyName", label: "Firma" },
          { id: "userName", label: "Użytkownik" },
          { id: "kwota", label: "Kwota" },
          { id: "status", label: "Status" },
          { id: "createdAt", label: "Data utworzenia" },
        ];
        const headers = enabledColumns.map((c: any) => c.label);
        const columnKeys = enabledColumns.map((c: any) => c.id);

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
          re_review: "Do ponownej weryfikacji",
          settled: "Rozliczona",
        };

        // Invoice type translations
        const invoiceTypeLabels: Record<string, string> = {
          einvoice: "E-faktura",
          paragon: "Paragon",
          correction: "Korekta",
        };

        // Add data rows
        data.forEach((item: any) => {
          const row = columnKeys.map((key: any) => {
            let value = item[key];

            // Format dates
            if (key.includes("At") || key.includes("Date") || key === "createdAt" || key === "reviewedAt") {
              if (value) {
                value = formatDate(value, "dd/MM/yyyy");
              }
            }

            // Format currency
            if (key.includes("amount") || key.includes("Amount") || key === "kwota") {
              if (value !== null && value !== undefined) {
                value = formatCurrency(value, input.currencyFormat || "PLN", input.showCurrencySymbol !== false);
              }
            }

            // Format status
            if (key === "status" && value && statusLabels[value]) {
              value = statusLabels[value];
            }

            // Format invoice type
            if (key === "invoiceType" && value && invoiceTypeLabels[value]) {
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
    .mutation(async ({ ctx, input }: any) => {
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

      const workbook = new ExcelJS.Workbook();
      workbook.creator = ctx.user.name;
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Faktura");
      const data = invoice[0];

      // Status translations
      const statusLabels: Record<string, string> = {
        pending: "Oczekująca",
        approved: "Zaakceptowana",
        rejected: "Odrzucona",
        re_review: "Do ponownej weryfikacji",
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
async function generateInvoicesData(ctx: any, params: any): Promise<any[]> {
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

  // Apply filters
  if (params.dateFrom) {
    query = query.where(gte(invoices.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where(lte(invoices.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    query = query.where(eq(invoices.status, params.status));
  }

  const results = await query;

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a: any, b: any) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results;
}

async function generateAdvancesData(ctx: any, params: any): Promise<any[]> {
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

  // Apply filters
  if (params.dateFrom) {
    query = query.where(gte(advances.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where(lte(advances.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    query = query.where(eq(advances.status, params.status));
  }

  const results = await query;

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a: any, b: any) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results;
}

async function generateBudgetRequestsData(ctx: any, params: any): Promise<any[]> {
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
      rejectionReason: budgetRequests.rejectionReason,
    })
    .from(budgetRequests)
    .leftJoin(users, eq(budgetRequests.userId, users.id))
    .leftJoin(companies, eq(budgetRequests.companyId, companies.id));

  // Apply filters
  if (params.dateFrom) {
    query = query.where(gte(budgetRequests.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where(lte(budgetRequests.createdAt, new Date(params.dateTo)));
  }
  if (params.status && params.status !== "all") {
    query = query.where(eq(budgetRequests.status, params.status));
  }

  const results = await query;

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a: any, b: any) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results;
}

async function generateSaldoData(ctx: any, params: any): Promise<any[]> {
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

  // Apply filters
  if (params.dateFrom) {
    query = query.where(gte(saldoTransactions.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where(lte(saldoTransactions.createdAt, new Date(params.dateTo)));
  }

  const results = await query;

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a: any, b: any) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results;
}

async function generateCorrectionsData(ctx: any, params: any): Promise<any[]> {
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
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .where(eq(invoices.invoiceType, "correction"));

  // Apply filters
  if (params.dateFrom) {
    query = query.where(gte(invoices.createdAt, new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where(lte(invoices.createdAt, new Date(params.dateTo)));
  }

  const results = await query;

  // Apply sorting
  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";
  
  results.sort((a: any, b: any) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return results;
}

// Generate filename based on reports
function generateFileName(reports: any[]): string {
  const enabledReports = reports.filter((r) => r.enabled);
  if (enabledReports.length === 1) {
    const report = enabledReports[0];
    const baseName = report.params.fileName || report.type;
    const timestamp = report.params.includeTimestamp !== false 
      ? `_${formatDate(new Date(), "yyyy-MM-dd")}`
      : "";
    return `${baseName}${timestamp}.xlsx`;
  }
  return `raport_mieszany_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
}
