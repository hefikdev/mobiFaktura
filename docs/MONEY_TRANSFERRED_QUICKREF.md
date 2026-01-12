# Money Transferred Status - Quick Reference

## New Status: "money_transferred"
Polish: **wykonano przelew**  
English: **money_transferred**

## Status Flow
```
pending → approved → money_transferred → rozliczono
                  ↘ rejected
```

## Quick Actions

### As Accountant/Admin:

#### 1. Approve Request (existing)
- Click "Zatwierdź" on pending request
- User's saldo is increased immediately
- Status: `pending` → `approved`

#### 2. Confirm Transfer (NEW)
- Click "Potwierdź przelew" on approved request  
- Enter transfer number in dialog (mandatory, min 3 chars)
- Example: "2024/01/12345" or "REF123456"
- Status: `approved` → `money_transferred`
- User gets notification with transfer details

#### 3. Settle/Reconcile (modified)
- Click "Rozlicz" on money_transferred request
- Status: `money_transferred` → `rozliczono`
- Marks the zaliczka as complete

## Database Fields

### New Columns in budget_requests
```sql
transfer_number          VARCHAR(255)           -- Transfer reference
transfer_date            TIMESTAMP WITH TZ      -- When transfer was made
transfer_confirmed_by    UUID                   -- Who confirmed
transfer_confirmed_at    TIMESTAMP WITH TZ      -- When confirmed in system
```

## API Usage

### Confirm Transfer
```typescript
const result = await trpc.budgetRequest.confirmTransfer.mutate({
  requestId: "uuid-here",
  transferNumber: "2024/01/12345"
});
```

### Validation Rules
- Transfer number: 3-255 characters
- Only works on `approved` status
- Requires accountant/admin role

## UI Components

### Transfer Confirmation Dialog
```tsx
import { TransferConfirmationDialog } from "@/components/transfer-confirmation-dialog";

<TransferConfirmationDialog
  request={selectedRequest}
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={() => refetch()}
/>
```

### Status Badge
```tsx
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";

<InvoiceStatusBadge status="money_transferred" variant="compact" />
// Displays: "Przelew wykonany" (blue badge)
```

## Page Filters

### Budget Requests Page
Default filter: **"Wszystkie"** (changed from "Oczekujące")

Available filters:
- Wszystkie (all)
- Oczekujące (pending)
- Zatwierdzone (approved)
- **Przelew wykonany (money_transferred)** ← NEW
- Odrzucone (rejected)
- Rozliczono (rozliczono)

## Table Columns

### Budget Requests Table
| Column | Description |
|--------|-------------|
| Użytkownik | User name and email |
| Stan salda przy złożeniu | Balance at request time |
| Wnioskowana kwota | Requested amount |
| Status | Current status |
| Data złożenia | Submission date |
| Data decyzji | Approval/rejection date |
| **Data transferu** | Transfer date ← NEW |
| Uzasadnienie | Justification |
| Akcje | Action buttons |

## Notifications

### User Notifications
When transfer is confirmed:
```
Title: "Przelew wykonany"
Message: "Przelew na kwotę 1000.00 PLN został wykonany. 
          Numer transferu: 2024/01/12345"
```

## Common Scenarios

### Scenario 1: Normal Flow
1. User submits → `pending`
2. Accountant approves → `approved` (saldo +1000)
3. Accountant makes bank transfer
4. Accountant confirms in system → `money_transferred`
5. Accountant settles → `rozliczono`

### Scenario 2: Rejection
1. User submits → `pending`
2. Accountant rejects → `rejected` (terminal)

### Scenario 3: Bulk Operations
- Bulk delete now supports `money_transferred` status
- Can filter by transfer date range
- All audit logs preserved

## Migration

### Apply Migration
```bash
npm run db:push
```

### Migration File
`drizzle/0023_add_money_transferred_status.sql`

## Backward Compatibility

- Old `approved` requests can still be settled directly
- Recommended flow: always confirm transfer before settling
- No breaking changes to existing functionality

## Best Practices

1. ✅ Always enter accurate transfer numbers
2. ✅ Confirm transfers promptly after bank transfer
3. ✅ Use consistent transfer number format (e.g., YYYY/MM/NNNNN)
4. ✅ Settle requests only after confirming transfers
5. ⚠️ Don't skip the transfer confirmation step

## Troubleshooting

### "Only approved requests can be marked as transferred"
- Check request status is `approved`
- Request may have been rejected or already transferred

### Transfer number validation error
- Must be at least 3 characters
- Maximum 255 characters
- Cannot be empty

### Cannot settle request
- Must confirm transfer first (`money_transferred` status)
- Previous flow (approve → settle) updated to include transfer step

## Code References

### Backend
- Router: `src/server/trpc/routers/budgetRequest.ts`
- Schema: `src/server/db/schema.ts`
- Procedure: `confirmTransfer`

### Frontend
- Page: `src/app/a/budget-requests/page.tsx`
- Dialog: `src/components/transfer-confirmation-dialog.tsx`
- Badge: `src/components/invoice-status-badge.tsx`

### Database
- Table: `budget_requests`
- Migration: `0023_add_money_transferred_status.sql`
