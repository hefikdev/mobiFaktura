export interface BudgetRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentBalanceAtRequest: number;
  requestedAmount: number;
  justification: string;
  status: string;
  createdAt: Date;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  settledAt?: Date | null;
  rejectionReason?: string | null;
  lastBudgetRequestStatus?: string | null;
  lastBudgetRequestAmount?: number | null;
}

export interface Invoice {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string | null;
  companyName: string | null;
  invoiceNumber: string;
  ksefNumber: string | null;
  imageKey: string;
  amount: number;
  status: string;
  justification: string;
  rejectionReason: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KSeFInvoiceData {
  Faktura?: {
    Fa?: {
      NrFa?: string;
    };
    Podmiot1?: {
      DaneIdentyfikacyjne?: {
        Nazwa?: string;
      };
    };
    Podmiot2?: {
      DaneIdentyfikacyjne?: {
        Nazwa?: string;
      };
    };
    FaPodsumowanie?: {
      KwotaBrutto?: string;
      DataWystawienia?: string;
    };
  };
}
