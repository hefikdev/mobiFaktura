# Invoice Delete Refund Implementation

## Overview

This document describes the implementation of automatic saldo refunds when invoices are deleted in the mobiFaktura system.

## Feature Description

When any invoice (faktura) with a `kwota` value is deleted, the system automatically refunds the amount back to the user's saldo. This ensures that the user's balance is correctly maintained when invoices are removed from the system.

## Implementation Details

### 1. New Transaction Type

Added `invoice_delete_refund` to the `SaldoTransactionType`:

```typescript
export type SaldoTransactionType = 
  | "adjustment" 
  | "invoice_deduction" 
  | "invoice_refund" 
  | "advance_credit" 
  | "invoice_delete_refund";
```

### 2. Affected Endpoints

The following endpoints now include saldo refund logic:

#### A. User/Accountant Invoice Delete (`invoice.delete`)
**Location:** `src/server/trpc/routers/invoice.ts`

- Users can delete their own invoices (except transferred/settled ones)
- Accountants/admins can delete any invoice
- Automatically refunds kwota if present

#### B. Admin Invoice Delete (`admin.deleteInvoice`)
**Location:** `src/server/trpc/routers/admin.ts`

- Requires admin password verification
- Refunds kwota before deletion
- Used for direct invoice deletion by admins

#### C. Admin Bulk Invoice Delete (`admin.deleteSingleInvoice`)
**Location:** `src/server/trpc/routers/admin.ts`

- Part of the bulk delete operation
- Refunds kwota for each deleted invoice
- Used during admin cleanup operations

#### D. Advance Delete with Invoices (`advances.delete`)
**Location:** `src/server/trpc/routers/advances.ts`

- When deleting a zaliczka (advance) with `delete_with_invoices` strategy
- Refunds kwota for all associated invoices before deletion
- Ensures users get their balance back when advance and its invoices are removed

### 3. Transaction Logic

All deletion operations follow this pattern:

```typescript
await db.transaction(async (tx) => {
  // 1. Check if invoice has kwota
  if (invoice.kwota && parseFloat(invoice.kwota) > 0) {
    const refundAmount = parseFloat(invoice.kwota);
    
    // 2. Get current user saldo
    const [invoiceUser] = await tx
      .select({ saldo: users.saldo, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, invoice.userId))
      .limit(1);

    // 3. Calculate new balance
    const balanceBefore = invoiceUser.saldo ? parseFloat(invoiceUser.saldo) : 0;
    const balanceAfter = balanceBefore + refundAmount;

    // 4. Update user saldo with optimistic locking
    await tx
      .update(users)
      .set({ 
        saldo: balanceAfter.toFixed(2),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, invoice.userId),
          eq(users.updatedAt, lastUpdatedAt)
        )
      );

    // 5. Create refund transaction record
    await tx.insert(saldoTransactions).values({
      userId: invoice.userId,
      amount: refundAmount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      transactionType: "invoice_delete_refund",
      referenceId: invoice.id,
      notes: `Zwrot z usuniętej faktury ${invoice.invoiceNumber}`,
      createdBy: ctx.user.id,
    });
  }

  // 6. Delete the invoice
  await tx.delete(invoices).where(eq(invoices.id, input.id));
});
```

### 4. UI Updates

Updated transaction type labels in the following components:

#### A. Saldo Management Page
**File:** `src/app/a/saldo/page.tsx`

Added label: "Zwrot z usuniętej faktury"

#### B. Saldo History Page
**File:** `src/app/a/saldo-history/page.tsx`

Added label: "Zwrot z usuniętej faktury"

#### C. Transaction Details Dialog
**File:** `src/components/saldo-transaction-details-dialog.tsx`

Added label: "Zwrot z usuniętej faktury"

### 5. Documentation Updates

Updated the following documentation files:

- `docs/SALDO_SYSTEM.md` - Added transaction type and workflow example
- `docs/LOGIC.md` - Added invoice deletion refund flow description

## Testing Checklist

### Basic Functionality
- [ ] User deletes their own invoice with kwota → saldo increases
- [ ] Accountant deletes user invoice with kwota → user saldo increases
- [ ] Admin deletes invoice with kwota → user saldo increases
- [ ] Delete invoice without kwota → no saldo change
- [ ] Transaction record created with type "invoice_delete_refund"
- [ ] Transaction notes include invoice number

### Advanced Scenarios
- [ ] Admin bulk delete multiple invoices → all kwota amounts refunded
- [ ] Delete advance with "delete_with_invoices" strategy → all invoice amounts refunded
- [ ] Delete advance with "reassign_invoices" strategy → no refunds (invoices not deleted)
- [ ] User tries to delete transferred/settled invoice → blocked (no refund)

### UI Display
- [ ] Refund transaction shows "Zwrot z usuniętej faktury" in saldo page
- [ ] Refund transaction shows "Zwrot z usuniętej faktury" in history page
- [ ] Refund transaction shows "Zwrot z usuniętej faktury" in transaction details dialog
- [ ] Refund amount is positive (green) in transaction history
- [ ] Balance before and after are correctly displayed

### Data Integrity
- [ ] Deletion + refund happens in single transaction (atomic)
- [ ] If refund fails, deletion is rolled back
- [ ] If deletion fails, refund is rolled back
- [ ] Optimistic locking prevents concurrent saldo modifications
- [ ] Transaction references deleted invoice ID

## Example Scenarios

### Scenario 1: User Deletes Own Invoice

**Initial State:**
- User saldo: 1000.00 PLN
- Invoice kwota: 250.00 PLN

**Action:**
User deletes the invoice

**Result:**
- User saldo: 1250.00 PLN
- Saldo transaction created:
  - Type: invoice_delete_refund
  - Amount: +250.00 PLN
  - Balance before: 1000.00 PLN
  - Balance after: 1250.00 PLN
  - Notes: "Zwrot z usuniętej faktury INV-001"

### Scenario 2: Admin Deletes Advance with Invoices

**Initial State:**
- User saldo: 500.00 PLN
- Advance: 2000.00 PLN
- Associated invoices: 
  - Invoice 1: 300.00 PLN
  - Invoice 2: 450.00 PLN
  - Invoice 3: 180.00 PLN

**Action:**
Admin deletes advance with "delete_with_invoices" strategy

**Result:**
- User saldo: 1430.00 PLN (500 + 300 + 450 + 180)
- Three saldo transactions created (one for each invoice)
- All invoices deleted
- Advance deleted
- Advance saldo adjustment (if transferred)

## Error Handling

### Concurrent Modifications
If the user's saldo is modified by another operation while processing the deletion:
- Optimistic locking detects the conflict
- Transaction is rolled back
- Error message: "Saldo zostało zmodyfikowane podczas usuwania faktury. Spróbuj ponownie."

### User Not Found
If the invoice owner is not found (deleted user):
- Gracefully handle in bulk operations
- Skip refund but continue with invoice deletion
- Log warning for audit purposes

### Zero or Null Kwota
If invoice has no kwota or kwota is 0:
- Skip refund logic entirely
- Delete invoice normally
- No transaction record created

## Benefits

1. **Data Consistency:** Ensures saldo always reflects current invoices
2. **User Transparency:** Users can see refund in transaction history
3. **Audit Trail:** Complete history of all saldo changes
4. **Atomic Operations:** Deletion and refund happen together or not at all
5. **Automatic:** No manual intervention required

## Future Enhancements

1. **Rejection Refunds:** Automatically refund saldo when invoice is rejected (not just deleted)
2. **Notification:** Notify users when they receive a refund from deleted invoice
3. **Batch Refund Report:** Generate reports showing all refunds in a period
4. **Refund Approval:** Require approval for refunds above certain threshold

## Maintenance Notes

- The transaction type "invoice_delete_refund" should not be renamed without database migration
- All invoice deletion code paths must include refund logic for consistency
- UI labels can be updated in the component files without backend changes
- Always test deletion operations in a transaction to ensure rollback works correctly
