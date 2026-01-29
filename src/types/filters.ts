// Common filter types used across the application

export interface AdvancedFilters {
  amountMin?: string;
  amountMax?: string;
  userName?: string;
  companyName?: string;
  fromDate?: Date;
  toDate?: Date;
  sourceType?: string;
  invoiceType?: string;
  ksefNumber?: string;
  description?: string;
  justification?: string;
  transactionType?: string;
  status?: string;
  [key: string]: string | Date | undefined;
}

export type FilterValue = string | number | Date | [Date | undefined, Date | undefined] | undefined | null;
