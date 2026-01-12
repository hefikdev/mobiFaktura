# Budget Requests UX Improvements & Code Refactoring

## Summary
This document describes the comprehensive improvements made to the budget requests (prośby o zwiększenie budżetu) system including sorting, export, better data display, status color-coding, and code refactoring from Polish to English while preserving Polish UI.

**Implementation Date:** January 2024  
**Migration:** 0025_rename_wplynela_to_transferred.sql  

---

## 1. ✅ Sorting Options for Budget Requests

### What Was Added
- **Sorting dropdown** with three options:
  - **Data złożenia** (Date submitted) - default, newest first
  - **Kwota** (Amount) - highest to lowest
  - **Status** - by workflow order (pending → approved → money_transferred → settled → rejected)

### Implementation
- Added `sortBy` state with type: `"date" | "amount" | "status"`
- Updated `filteredRequests` useMemo to include sorting logic
- Added Select component in CardHeader next to status filter

**File Modified:** [src/app/a/budget-requests/page.tsx](../src/app/a/budget-requests/page.tsx)

```typescript
const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");

// In filteredRequests useMemo:
filtered = [...filtered].sort((a, b) => {
  if (sortBy === "date") {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  } else if (sortBy === "amount") {
    return (b.requestedAmount ?? 0) - (a.requestedAmount ?? 0);
  } else if (sortBy === "status") {
    const statusOrder = { pending: 0, approved: 1, money_transferred: 2, settled: 3, rejected: 4 };
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
    return aOrder - bOrder;
  }
  return 0;
});
```

---

## 2. ✅ Export Functionality for Budget Requests

### What Was Added
- **Export button** using ExportButton component
- Dynamic filename: `prosBy-o-budzet-YYYY-MM-DD.csv/pdf`
- Full column mapping with Polish headers
- PDF export with proper title and subtitle

### Exported Columns
1. Użytkownik (User name)
2. Email
3. Saldo przy złożeniu (PLN) - Balance at request time
4. Wnioskowana kwota (PLN) - Requested amount
5. Status (translated to Polish)
6. Uzasadnienie (Justification)
7. Data złożenia (Submission date)
8. Data decyzji (Decision date)
9. Data transferu (Transfer date)
10. Data rozliczenia (Settlement date)
11. Powód odrzucenia (Rejection reason)

**File Modified:** [src/app/a/budget-requests/page.tsx](../src/app/a/budget-requests/page.tsx)

```typescript
<ExportButton
  data={filteredRequests}
  filename={`prosBy-o-budzet-${format(new Date(), "yyyy-MM-dd")}`}
  columns={[
    { key: "userName", header: "Użytkownik" },
    { key: "status", header: "Status", formatter: (val: any) => {
      const statusLabels: Record<string, string> = {
        pending: "Oczekujące",
        approved: "Zatwierdzone",
        money_transferred: "Przelew wykonany",
        settled: "Rozliczono",
        rejected: "Odrzucone"
      };
      return statusLabels[String(val)] || String(val);
    }},
    // ... more columns
  ]}
  pdfTitle="Prośby o zwiększenie budżetu"
  pdfSubtitle={`Wygenerowano: ${format(new Date(), "dd.MM.yyyy HH:mm")}`}
  userName={user?.name}
/>
```

---

## 3. ✅ Code Refactoring: 'wplynela' → 'transferred'

### What Changed
Renamed all internal code references from Polish "wplynela" (wpłynęła) to English "transferred" while **keeping Polish UI labels** ("Wpłynęła").

### Database Migration: 0025_rename_wplynela_to_transferred.sql

```sql
-- Rename columns
ALTER TABLE "invoices" RENAME COLUMN "wplynela_by" TO "transferred_by";
ALTER TABLE "invoices" RENAME COLUMN "wplynela_at" TO "transferred_at";

-- Update enum
ALTER TYPE invoice_status RENAME TO invoice_status_old;
CREATE TYPE invoice_status AS ENUM ('pending', 'in_review', 'accepted', 'transferred', 'settled', 'rejected', 're_review');

-- Migrate existing data
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE invoice_status USING (
  CASE 
    WHEN "status"::text = 'wplynela' THEN 'transferred'::invoice_status
    ELSE "status"::text::invoice_status
  END
);

DROP TYPE invoice_status_old;
```

### Files Modified

#### Database Schema
**File:** [src/server/db/schema.ts](../src/server/db/schema.ts)
- Enum: `"wplynela"` → `"transferred"`
- Fields: `wpłynęłaBy` → `transferredBy`, `wpłynęłaAt` → `transferredAt`

#### TypeScript Types
**File:** [src/types/index.ts](../src/types/index.ts)
- Fields: `wpłynęłaBy?: string | null` → `transferredBy?: string | null`
- Fields: `wpłynęłaAt?: Date | null` → `transferredAt?: Date | null`

#### Status Badge Component
**File:** [src/components/invoice-status-badge.tsx](../src/components/invoice-status-badge.tsx)
- Type: `"wplynela"` → `"transferred"`
- Config key: `wplynela:` → `transferred:`
- **Polish label preserved:** `label: "Wpłynęła"`

### Before vs After

| Aspect | Before (Polish) | After (English Code, Polish UI) |
|--------|----------------|----------------------------------|
| **Enum value** | `'wplynela'` | `'transferred'` |
| **DB columns** | `wplynela_by`, `wplynela_at` | `transferred_by`, `transferred_at` |
| **TypeScript fields** | `wpłynęłaBy`, `wpłynęłaAt` | `transferredBy`, `transferredAt` |
| **UI Label** | "Wpłynęła" | **"Wpłynęła"** (unchanged) |
| **Status badge config** | `wplynela: { label: "Wpłynęła" }` | `transferred: { label: "Wpłynęła" }` |

---

## 4. ✅ Justification Display Fixed

### What Was Fixed
The justification field was defined in the budget request interface but **not displayed** in the accountant review dialog.

### Implementation
Added justification display section between "Result calculation" and "Last Budget Request Status".

**File Modified:** [src/components/budget-request-review-dialog.tsx](../src/components/budget-request-review-dialog.tsx)

```tsx
{/* Justification */}
<div className="p-3 bg-muted border rounded-lg">
  <Label className="text-sm font-medium">Uzasadnienie</Label>
  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
    {request.justification}
  </p>
</div>
```

**Key Features:**
- Gray background with border for visual separation
- `whitespace-pre-wrap` to preserve line breaks and formatting
- Displays between financial info and related invoices

---

## 5. ✅ Improved Related Invoices Display

### What Was Improved
Previously: Simple flex-wrap with buttons (poor UX for 50+ invoices)  
Now: **Scrollable table** with proper columns and structure

### Implementation
**File Modified:** [src/components/budget-request-review-dialog.tsx](../src/components/budget-request-review-dialog.tsx)

```tsx
<div className="p-3 bg-muted rounded-lg border">
  <Label>Powiązane faktury ({relatedInvoicesQuery.data.length})</Label>
  <div className="mt-2 max-h-60 overflow-y-auto border rounded-md">
    <table className="w-full text-sm">
      <thead className="bg-muted/50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Numer faktury</th>
          <th className="text-left p-2 font-medium">Kwota</th>
          <th className="text-left p-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {relatedInvoicesQuery.data.map((inv) => (
          <tr key={inv.id} className="border-t hover:bg-muted/30">
            <td className="p-2">
              <Link href={`/a/invoice/${inv.id}`} className="text-blue-600 underline">
                {inv.invoiceNumber}
              </Link>
            </td>
            <td className="p-2">
              {inv.kwota ? `${Number(inv.kwota).toFixed(2)} PLN` : "-"}
            </td>
            <td className="p-2">
              <InvoiceStatusBadge status={inv.status as any} variant="compact" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**Key Features:**
- **Scrollable:** `max-h-60 overflow-y-auto` (240px max height)
- **Sticky header:** Header stays visible while scrolling
- **Three columns:** Invoice number, Amount, Status
- **Clickable links:** Each invoice number links to detail page
- **Status badges:** Color-coded status indicators
- **Count display:** Shows total number of related invoices
- **Hover effect:** Row highlighting on hover

### Backend Update
Updated `getRelatedInvoices` query to return additional fields:

**File Modified:** [src/server/trpc/routers/budgetRequest.ts](../src/server/trpc/routers/budgetRequest.ts)

```typescript
const related = await db
  .select({ 
    id: invoices.id, 
    invoiceNumber: invoices.invoiceNumber,
    kwota: invoices.kwota,        // NEW
    status: invoices.status       // NEW
  })
  .from(invoices)
  // ... rest of query
  
return related; // Return full objects instead of mapping to just id and invoiceNumber
```

---

## 6. ✅ Color-Coded Budget Request Statuses

### What Was Improved
The budget requests table already used `InvoiceStatusBadge`, but the mapping was incomplete - `money_transferred` status was not properly mapped.

### Implementation
Updated `getStatusBadge` function to properly map all budget request statuses to invoice status badge types.

**File Modified:** [src/app/a/budget-requests/page.tsx](../src/app/a/budget-requests/page.tsx)

```typescript
const getStatusBadge = (status: string, request?: BudgetRequest) => {
  // ... click handler

  // Map budget request statuses to invoice status badge types for consistent color coding
  const badgeStatus = 
    status === "approved" ? "accepted" : 
    status === "settled" ? "settled" : 
    status === "rejected" ? "rejected" : 
    status === "money_transferred" ? "transferred" :  // NEW MAPPING
    "pending";

  // ... render badge
};
```

### Status Color Scheme (from invoice-status-badge.tsx)

| Budget Request Status | Maps To | Color | Light Mode | Dark Mode |
|----------------------|---------|-------|------------|-----------|
| **pending** | pending | 🟠 Orange | `bg-orange-100 text-orange-800` | `bg-orange-900/30 text-orange-300` |
| **approved** | accepted | 🟢 Green | `bg-green-100 text-green-800` | `bg-green-900/30 text-green-300` |
| **money_transferred** | **transferred** | 🔷 Cyan | `bg-cyan-100 text-cyan-800` | `bg-cyan-900/30 text-cyan-300` |
| **settled** | settled | 🟣 Purple | `bg-purple-100 text-purple-800` | `bg-purple-900/30 text-purple-300` |
| **rejected** | rejected | 🔴 Red | `bg-red-100 text-red-800` | `bg-red-900/30 text-red-300` |

---

## 7. ✅ Documentation Updated

All documentation files have been updated to reflect the `wplynela` → `transferred` refactoring:

### Primary Documentation File
**File:** [docs/SYSTEM_IMPROVEMENTS_SUMMARY.md](SYSTEM_IMPROVEMENTS_SUMMARY.md)

**Changes:**
- Database column names updated throughout
- Enum value references changed from `'wplynela'` to `'transferred'`
- TypeScript field names updated
- Migration references updated to include 0025
- Polish UI label "Wpłynęła" properly preserved in all contexts
- Status color table updated with correct enum values
- Code examples updated with correct field names

### Migration References
- Original migration: `0024_add_settled_by_and_wplynela.sql` (kept for history)
- New migration: `0025_rename_wplynela_to_transferred.sql` (code consistency)

---

## Testing Checklist

### Frontend Testing
- [ ] ✅ Budget requests page loads without errors
- [ ] ✅ Sorting dropdown works (date, amount, status)
- [ ] ✅ Export button generates CSV with correct Polish headers
- [ ] ✅ Export button generates PDF with correct title
- [ ] ✅ All budget request statuses show correct colors
- [ ] ✅ money_transferred status shows cyan color
- [ ] ✅ Clicking status badge opens detail dialog
- [ ] ✅ Justification displays in review dialog
- [ ] ✅ Related invoices show in scrollable table
- [ ] ✅ Related invoices table shows invoice number, amount, and status
- [ ] ✅ Scrolling works when 50+ related invoices exist

### Backend Testing
- [ ] ✅ Database migration 0025 applied successfully
- [ ] ✅ Old 'wplynela' enum values converted to 'transferred'
- [ ] ✅ Columns renamed: `wplynela_by` → `transferred_by`, `wplynela_at` → `transferred_at`
- [ ] ✅ getRelatedInvoices query returns kwota and status
- [ ] ✅ All tRPC queries work without errors

### TypeScript Validation
- [ ] ✅ No TypeScript errors in budget-requests/page.tsx
- [ ] ✅ No TypeScript errors in budget-request-review-dialog.tsx
- [ ] ✅ No TypeScript errors in budgetRequest.ts router
- [ ] ✅ ExportButton columns use correct types (header, formatter)

---

## File Modifications Summary

### Created
1. `drizzle/0025_rename_wplynela_to_transferred.sql` - Database migration
2. `docs/BUDGET_REQUESTS_UX_IMPROVEMENTS.md` - This document

### Modified
1. [src/app/a/budget-requests/page.tsx](../src/app/a/budget-requests/page.tsx)
   - Added sorting dropdown and state management
   - Added ExportButton integration
   - Fixed status badge mapping for money_transferred
   - Added ExportButton import

2. [src/components/budget-request-review-dialog.tsx](../src/components/budget-request-review-dialog.tsx)
   - Added justification display section
   - Replaced button list with scrollable table for related invoices

3. [src/server/db/schema.ts](../src/server/db/schema.ts)
   - Changed enum: `"wplynela"` → `"transferred"`
   - Renamed fields: `wpłynęłaBy` → `transferredBy`, `wpłynęłaAt` → `transferredAt`

4. [src/types/index.ts](../src/types/index.ts)
   - Updated TypeScript interface fields from wpłynęła to transferred

5. [src/components/invoice-status-badge.tsx](../src/components/invoice-status-badge.tsx)
   - Updated type: `"wplynela"` → `"transferred"`
   - Updated config key while preserving Polish label "Wpłynęła"

6. [src/server/trpc/routers/budgetRequest.ts](../src/server/trpc/routers/budgetRequest.ts)
   - Extended getRelatedInvoices query to return kwota and status

7. [drizzle/meta/_journal.json](../drizzle/meta/_journal.json)
   - Added migration 0025 entry

8. [docs/SYSTEM_IMPROVEMENTS_SUMMARY.md](SYSTEM_IMPROVEMENTS_SUMMARY.md)
   - Updated all wplynela references to transferred
   - Preserved Polish UI label contexts
   - Added migration 0025 references

---

## Key Achievements

1. **✅ Improved UX**: Sorting and export make budget requests much more manageable
2. **✅ Code Quality**: Internal code now uses consistent English naming
3. **✅ UI Consistency**: Polish labels preserved for end users
4. **✅ Better Data Display**: Scrollable table handles 50+ related invoices gracefully
5. **✅ Complete Information**: Justification now visible to accountants
6. **✅ Visual Clarity**: All statuses properly color-coded including money_transferred
7. **✅ Documentation**: All docs updated to reflect new structure

---

## Status Workflow (Updated)

### Budget Requests
```
pending (🟠 Orange)
  ↓
approved (🟢 Green)
  ↓
money_transferred (🔷 Cyan)
  ↓
settled (🟣 Purple)

OR

pending (🟠 Orange)
  ↓
rejected (🔴 Red)
```

### Related Invoices
The related invoices are those created between:
- **Start**: Budget request `reviewedAt` (approval time)
- **End**: Budget request `settledAt` (or current time if not settled)

This helps accountants see which invoices were paid using the approved budget increase.

---

## Notes

### Internal Code vs UI Labels
- **Internal code** (database, TypeScript, enums): Uses **English** (`transferred`, `transferredBy`, `transferredAt`)
- **User interface** (labels, exports): Uses **Polish** ("Wpłynęła")
- **This separation** improves code maintainability while preserving user experience

### Why This Matters
- Consistent English naming makes code easier to maintain
- Polish labels make system accessible to users
- Database columns follow standard naming conventions
- TypeScript types are self-documenting

---

**Implementation completed:** January 2024  
**All tasks completed successfully** ✅
