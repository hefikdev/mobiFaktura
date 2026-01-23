import ExcelJS from "exceljs";

// Helper function to format date
export function formatDate(date: Date | string, format: string = "dd/MM/yyyy"): string {
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
export function formatCurrency(
  amount: number | string,
  currencyFormat: string = "PLN",
  showSymbol: boolean = true
): string {
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
  const maxLength = Math.max(
    ...values.map((val) => {
      if (!val) return 0;
      const str = String(val);
      // Polish characters like ą, ę, ż, etc. are slightly wider
      const polishChars = (str.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
      return str.length + polishChars * 0.2;
    })
  );

  // Add padding (15% extra space for comfort)
  const width = maxLength * 1.15;

  // Clamp between min and max
  return Math.min(Math.max(width, minWidth), maxWidth);
}

// Helper function to auto-fit columns in worksheet
export function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth: number = 10, maxWidth: number = 50) {
  worksheet.columns.forEach((column) => {
    if (!column.eachCell) return;

    const values: string[] = [];
    column.eachCell({ includeEmpty: false }, (cell) => {
      values.push(String(cell.value || ""));
    });

    if (values.length > 0) {
      column.width = calculateColumnWidth(values, minWidth, maxWidth);
    } else {
      column.width = minWidth;
    }
  });
}

// Generate Excel for single invoice
export async function generateSingleInvoiceExcel(
  invoice: any,
  options: {
    dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName?: string;
  }
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Faktura");

  // Status translation
  const statusLabels: Record<string, string> = {
    pending: "Oczekuje",
    in_review: "W trakcie weryfikacji",
    accepted: "Zaakceptowana",
    rejected: "Odrzucona",
  };

  // Create vertical layout (label-value pairs)
  worksheet.addRow(["Szczegóły faktury"]);
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.addRow([]);

  worksheet.addRow(["Numer faktury:", invoice.invoiceNumber || "-"]);
  worksheet.addRow(["Użytkownik:", invoice.userName || "-"]);
  worksheet.addRow(["Firma:", invoice.companyName || "-"]);
  worksheet.addRow([
    "Kwota:",
    invoice.kwota ? formatCurrency(parseFloat(invoice.kwota), options.currencyFormat, options.showCurrencySymbol) : "-",
  ]);
  worksheet.addRow(["Status:", statusLabels[invoice.status as string] || invoice.status]);
  worksheet.addRow(["Data utworzenia:", formatDate(invoice.createdAt, options.dateFormat)]);
  worksheet.addRow(["Opis:", invoice.description || "-"]);

  // Style the labels column
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(1).font = { bold: true };
  worksheet.getColumn(2).width = 40;

  // Add borders
  for (let i = 3; i <= 10; i++) {
    worksheet.getRow(i).eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `faktura_${invoice.invoiceNumber || "export"}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Excel for single advance
export async function generateSingleAdvanceExcel(
  advance: any,
  budgetRequest: any,
  options: {
    dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName?: string;
  }
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Zaliczka");

  // Status translation
  const statusLabels: Record<string, string> = {
    pending: "Oczekująca",
    transferred: "Przelana",
    settled: "Rozliczona",
  };

  // Source type translation
  const sourceTypeLabel = budgetRequest ? "Wniosek budżetowy" : "Przyznana przez księgowego";

  // Create vertical layout (label-value pairs)
  worksheet.addRow(["Szczegóły zaliczki"]);
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.addRow([]);

  worksheet.addRow(["Użytkownik:", advance.userName || "-"]);
  worksheet.addRow(["Email:", advance.userEmail || "-"]);
  worksheet.addRow(["Firma:", advance.companyName || "-"]);
  worksheet.addRow([
    "Kwota:",
    advance.amount ? formatCurrency(advance.amount, options.currencyFormat, options.showCurrencySymbol) : "-",
  ]);
  worksheet.addRow(["Status:", statusLabels[advance.status] || advance.status]);
  worksheet.addRow(["Źródło:", sourceTypeLabel]);
  worksheet.addRow(["Data utworzenia:", formatDate(advance.createdAt, options.dateFormat)]);
  worksheet.addRow(["Data przelewu:", advance.transferDate ? formatDate(advance.transferDate, options.dateFormat) : "-"]);
  worksheet.addRow(["Data rozliczenia:", advance.settledAt ? formatDate(advance.settledAt, options.dateFormat) : "-"]);
  worksheet.addRow(["Opis:", advance.description || "-"]);
  if (budgetRequest) {
    worksheet.addRow(["Uzasadnienie wniosku:", budgetRequest.justification || "-"]);
  }

  // Style the labels column
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(1).font = { bold: true };
  worksheet.getColumn(2).width = 40;

  // Add borders
  const lastRow = budgetRequest ? 13 : 12;
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

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `zaliczka_${advance.userName?.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Excel for single budget request
export async function generateSingleBudgetRequestExcel(
  budgetRequest: any,
  options: {
    dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName?: string;
  }
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Wniosek Budżetowy");

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

  worksheet.addRow(["Użytkownik:", budgetRequest.userName || "-"]);
  worksheet.addRow(["Firma:", budgetRequest.companyName || "-"]);
  worksheet.addRow([
    "Wnioskowana kwota:",
    budgetRequest.requestedAmount
      ? formatCurrency(budgetRequest.requestedAmount, options.currencyFormat, options.showCurrencySymbol)
      : "-",
  ]);
  worksheet.addRow([
    "Saldo w momencie wniosku:",
    budgetRequest.currentBalanceAtRequest !== null && budgetRequest.currentBalanceAtRequest !== undefined
      ? formatCurrency(budgetRequest.currentBalanceAtRequest, options.currencyFormat, options.showCurrencySymbol)
      : "-",
  ]);
  worksheet.addRow(["Status:", statusLabels[budgetRequest.status] || budgetRequest.status]);
  worksheet.addRow(["Data utworzenia:", formatDate(budgetRequest.createdAt, options.dateFormat)]);
  worksheet.addRow([
    "Data weryfikacji:",
    budgetRequest.reviewedAt ? formatDate(budgetRequest.reviewedAt, options.dateFormat) : "-",
  ]);
  worksheet.addRow(["Weryfikujący:", budgetRequest.reviewerName || "-"]);
  worksheet.addRow(["Uzasadnienie:", budgetRequest.justification || "-"]);
  worksheet.addRow(["Powód odrzucenia:", budgetRequest.rejectionReason || "-"]);

  // Style the labels column
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(1).font = { bold: true };
  worksheet.getColumn(2).width = 50;

  // Add borders
  for (let i = 3; i <= 12; i++) {
    worksheet.getRow(i).eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `wniosek_budzetowy_${budgetRequest.userName?.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Excel for invoices list
export async function generateInvoicesExcel(
  invoices: any[],
  options: {
    dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName?: string;
  }
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Faktury");

  // Headers
  const headers = ["Nr faktury", "Użytkownik", "Firma", "Kwota", "Status", "Data utworzenia", "Opis"];
  worksheet.addRow(headers);

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Status translation
  const statusLabels: Record<string, string> = {
    pending: "Oczekuje",
    in_review: "W trakcie weryfikacji",
    accepted: "Zaakceptowana",
    rejected: "Odrzucona",
  };

  // Add data rows
  invoices.forEach((invoice) => {
    worksheet.addRow([
      invoice.invoiceNumber || "-",
      invoice.userName || "-",
      invoice.companyName || "-",
      invoice.kwota ? formatCurrency(parseFloat(invoice.kwota), options.currencyFormat, options.showCurrencySymbol) : "-",
      statusLabels[invoice.status] || invoice.status,
      formatDate(invoice.createdAt, options.dateFormat),
      invoice.description || "-",
    ]);
  });

  // Auto-fit columns
  autoFitColumns(worksheet);

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `faktury_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Generate Excel for advances list
export async function generateAdvancesExcel(
  advances: any[],
  options: {
    dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd.MM.yyyy";
    currencyFormat: "PLN" | "EUR" | "USD";
    showCurrencySymbol: boolean;
    fileName?: string;
  }
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Zaliczki");

  // Headers
  const headers = ["Użytkownik", "Firma", "Kwota", "Status", "Data utworzenia", "Data przelewu", "Data rozliczenia"];
  worksheet.addRow(headers);

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Status translation
  const statusLabels: Record<string, string> = {
    pending: "Oczekująca",
    transferred: "Przelana",
    settled: "Rozliczona",
  };

  // Add data rows
  advances.forEach((advance) => {
    worksheet.addRow([
      advance.userName || "-",
      advance.companyName || "-",
      advance.amount ? formatCurrency(advance.amount, options.currencyFormat, options.showCurrencySymbol) : "-",
      statusLabels[advance.status] || advance.status,
      formatDate(advance.createdAt, options.dateFormat),
      advance.transferDate ? formatDate(advance.transferDate, options.dateFormat) : "-",
      advance.settledAt ? formatDate(advance.settledAt, options.dateFormat) : "-",
    ]);
  });

  // Auto-fit columns
  autoFitColumns(worksheet);

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.fileName || `zaliczki_${formatDate(new Date(), "yyyy-MM-dd")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
