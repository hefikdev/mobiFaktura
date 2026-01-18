# Invoice Types - Quick Reference

## Invoice Types

| Type | Polish Name | KSeF Required? | Who Creates? | Description |
|------|-------------|----------------|--------------|-------------|
| `einvoice` | E-Faktura | Optional | Users | Standard electronic invoice with optional KSeF |
| `paragon` | Paragon | No (❌ Forbidden) | Users | Receipt without KSeF number |
| `correction` | Faktura Korygująca | N/A | Accountants/Admins | Correction invoice (auto-accepted) |

## User Actions

### Upload Invoice (Users)

**URL**: `/a/upload`

**Steps**:
1. Select type: E-Faktura or Paragon
2. Upload image
3. Enter invoice number
4. (E-Faktura only) Optionally add KSeF number
5. Enter amount and justification
6. Submit

### Create Correction (Accountants/Admins)

**URL**: `/a/korekty`

**Steps**:
1. Click "Dodaj fakturę korygującą"
2. Search for original invoice (must be accepted)
3. Upload correction image
4. Enter positive correction amount
5. Add justification (≥10 chars)
6. Submit → Balance increased automatically

## Key Validations

### Upload
- ✅ Paragon without KSeF
- ✅ E-Faktura with/without KSeF
- ❌ Paragon with KSeF → Error

### Correction
- ✅ Original invoice must be accepted
- ✅ Amount must be positive
- ❌ Cannot correct a correction
- ❌ Cannot correct rejected/pending invoices

## API Quick Reference

```typescript
// Upload invoice
trpc.invoice.create.mutate({
  invoiceType: "einvoice" | "paragon",
  ksefNumber?: string, // Only for einvoice
  // ... other fields
});

// Create correction (accountant/admin only)
trpc.invoice.createCorrection.mutate({
  originalInvoiceId: string,
  correctionAmount: number, // Positive
  imageDataUrl: string,
  justification: string,
});

// Get correctable invoices (accountant/admin only)
trpc.invoice.getCorrectableInvoices.useQuery({
  searchQuery?: string,
  companyId?: string,
});

// Get corrections (accountant/admin only)
trpc.invoice.getCorrectionInvoices.useInfiniteQuery({
  limit: number,
  cursor?: string,
  companyId?: string,
  searchQuery?: string,
});
```

## Database Fields

```typescript
interface Invoice {
  // ... existing fields
  invoiceType: "einvoice" | "paragon" | "correction";
  originalInvoiceId?: string; // For corrections only
  correctionAmount?: number; // For corrections only
}
```

## UI Components

```tsx
import { InvoiceTypeBadge } from "@/components/invoice-type-badge";

<InvoiceTypeBadge type="einvoice" variant="compact" />
```

## Navigation

- **Accountant/Admin Menu**: Added "Korekty" link
- **Invoices Page**: Automatically filters out corrections
- **Corrections Page**: Shows only corrections

## Balance Impact

| Event | Balance Change |
|-------|----------------|
| Regular invoice accepted (with kwota) | -kwota (decrease) |
| Correction created | +correction_amount (increase) |

## Migration

```bash
# Apply database changes
npm run db:push

# Or
npm run db:migrate
```

Migration file: `drizzle/0030_add_invoice_types.sql`

## Common Tasks

### View All Corrections
1. Login as accountant/admin
2. Navigate to `/a/korekty`
3. Use filters to search

### Correct an Invoice
1. Go to `/a/korekty`
2. Click "Dodaj fakturę korygującą"
3. Search for invoice by number
4. Fill form and submit

### Check Invoice Type
- Look for colored badge next to invoice number
- Blue = E-Faktura
- Purple = Paragon
- Green = Korekta

## Authorization

| Page/Action | User | Accountant | Admin |
|-------------|------|------------|-------|
| Upload einvoice/paragon | ✅ | ✅ | ✅ |
| View /korekty | ❌ | ✅ | ✅ |
| Create correction | ❌ | ✅ | ✅ |
| View all invoices | ❌ | ✅ | ✅ |

## Troubleshooting

**Q: KSeF field not showing for E-Faktura?**
A: Check invoice type selector, refresh page, clear cache

**Q: Cannot create correction?**
A: Ensure original invoice is accepted, user is accountant/admin

**Q: Paragon rejection with KSeF?**
A: Expected behavior - paragon cannot have KSeF

**Q: Balance not updating after correction?**
A: Check saldo_transactions table, verify correction_amount is positive

## Files Modified

### Backend
- `src/server/db/schema.ts` - Added invoice types
- `src/server/trpc/routers/invoice.ts` - Added correction endpoints
- `drizzle/0030_add_invoice_types.sql` - Database migration

### Frontend
- `src/app/a/upload/page.tsx` - Invoice type selector
- `src/app/a/korekty/page.tsx` - New corrections page
- `src/app/a/invoices/page.tsx` - Type badges & filtering
- `src/components/invoice-type-badge.tsx` - New component
- `src/components/accountant-header.tsx` - Added korekty link
- `src/components/admin-header.tsx` - Added korekty link

## Contact

For questions or issues, refer to:
- Full documentation: `docs/INVOICE_TYPES_IMPLEMENTATION.md`
- Schema: `src/server/db/schema.ts`
- API: `src/server/trpc/routers/invoice.ts`
