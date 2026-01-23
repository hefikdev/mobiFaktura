# Saldo (Balance) System Documentation

## Overview

The Saldo system allows administrators and accountants to manage user budgets. Users have a balance (saldo) that is automatically reduced when they submit invoices. The saldo can be negative, allowing users to exceed their budget.

## Features

### 1. **Balance Management**
- Admins/accountants can assign budgets to users
- View all users with their current balance
- Adjust balance with positive or negative amounts
- Add notes for each adjustment

### 2. **Automatic Deduction**
- When a user submits an invoice with a `kwota` (amount), their saldo is automatically reduced
- Deduction happens in a database transaction to ensure data consistency
- Each deduction is logged in the transaction history

### 3. **Transaction History**
- Complete audit trail of all balance changes
- Shows adjustments, invoice deductions, and refunds
- Links to related invoices for invoice deductions
- Records who made each change

### 4. **Statistics Dashboard**
- Total users
- Total saldo across all users
- Average saldo
- Count of users with positive, negative, and zero balance

## Database Schema

### Users Table Changes
```sql
ALTER TABLE "users" ADD COLUMN "saldo" numeric(12, 2) NOT NULL DEFAULT 0;
```

### Saldo Transactions Table
```sql
CREATE TABLE "saldo_transactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" numeric(12, 2) NOT NULL,
    "balance_before" numeric(12, 2) NOT NULL,
    "balance_after" numeric(12, 2) NOT NULL,
    "transaction_type" VARCHAR(50) NOT NULL,
    "reference_id" UUID,
    "notes" TEXT,
    "created_by" UUID NOT NULL REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

#### Transaction Types
- `adjustment` - Manual balance adjustment by admin/accountant
- `invoice_deduction` - Automatic deduction when invoice is submitted
- `invoice_refund` - Refund when invoice is rejected/deleted (optional)
- `invoice_delete_refund` - Automatic refund when invoice is deleted by user/accountant/admin

## API Endpoints (tRPC)

### User Endpoints

#### `saldo.getMySaldo`
Get the current user's balance.

**Returns:**
```typescript
{
  saldo: number
}
```

#### `saldo.getSaldoHistory`
Get transaction history for current user or specific user (accountants only).

**Input:**
```typescript
{
  userId?: string,  // Optional, defaults to current user
  limit?: number,   // Default: 50, Max: 100
  offset?: number   // Default: 0
}
```

**Returns:**
```typescript
{
  id: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  transactionType: string,
  referenceId: string | null,
  notes: string | null,
  createdAt: Date,
  createdByName: string,
  createdByEmail: string
}[]
```

### Accountant/Admin Endpoints

#### `saldo.getUserSaldo`
Get specific user's balance (accountant/admin only).

**Input:**
```typescript
{
  userId: string
}
```

#### `saldo.getAllUsersSaldo`
Get all users with their balances (accountant/admin only).

**Returns:**
```typescript
{
  id: string,
  name: string,
  email: string,
  role: string,
  saldo: number
}[]
```

#### `saldo.adjustSaldo`
Adjust a user's balance (accountant/admin only).

**Input:**
```typescript
{
  userId: string,
  amount: number,    // Positive to increase, negative to decrease
  notes: string      // Minimum 5 characters, required
}
```

**Returns:**
```typescript
{
  success: boolean,
  newSaldo: number,
  message: string
}
```

#### `saldo.getSaldoStats`
Get overall statistics (accountant/admin only).

**Returns:**
```typescript
{
  totalUsers: number,
  totalSaldo: number,
  avgSaldo: number,
  positiveBalance: number,
  negativeBalance: number,
  zeroBalance: number
}
```

## Pages

### 1. `/a/saldo` - Saldo Management (Admin/Accountant Only)
- View all users with their balances
- Search and filter users
- Adjust user balances
- View statistics dashboard
- Color-coded balance indicators (green: positive, red: negative)

### 2. `/a/saldo-history` - Transaction History
- View complete transaction history
- Filter by user (users see only their own)
- See balance before and after each transaction
- Link to related invoices
- Export-ready table format

### 3. `/a/dashboard` - User Dashboard
- Displays current saldo in a prominent card
- Color-coded indicators
- Visual feedback for positive/negative/zero balance
- Link to history page

## UI Components

### `<SaldoDisplay />`
Component that displays the current user's balance with visual indicators.

**Features:**
- Large, prominent display
- Color-coded text (green/red/gray)
- Status badges
- Icon indicators
- Responsive design

**Usage:**
```tsx
import { SaldoDisplay } from "@/components/saldo-display";

<SaldoDisplay />
```

### Header Integration
All headers (user, accountant, admin) now show:
- **User header:** Clickable saldo badge that links to history
- **Accountant header:** Link to saldo management page
- **Admin header:** Link to saldo management page

## Workflow Examples

### 1. Assigning Budget to User
1. Admin/accountant goes to `/a/saldo`
2. Finds user in the table or uses search
3. Clicks "Dostosuj" (Adjust) button
4. Enters positive amount (e.g., 5000 PLN)
5. Adds note explaining the budget allocation
6. Confirms adjustment

### 2. User Submits Invoice
1. User uploads invoice with kwota = 350.50 PLN
2. System automatically:
   - Creates invoice record
   - Reduces user's saldo by 350.50 PLN
   - Creates transaction record
   - Links transaction to invoice

### 3. Viewing Transaction History
1. User clicks on saldo badge in header
2. Sees complete history of all changes
3. Can click on invoice icon to view related invoice details

### 4. Monitoring Budgets
1. Admin/accountant visits `/a/saldo`
2. Views statistics cards showing:
   - Total users
   - Total saldo
   - Users with positive/negative balances
3. Identifies users who exceeded budget (red highlight)
4. Takes appropriate action

### 5. Deleting an Invoice (Automatic Refund)
1. User/accountant/admin deletes an invoice
2. System automatically:
   - Refunds the kwota back to the user's saldo
   - Creates a `invoice_delete_refund` transaction record
   - Links the transaction to the deleted invoice ID
   - Notes the refund with invoice number

## Implementation Details

### Transaction Safety
- All balance changes use database transactions
- Ensures atomicity between balance update and transaction log
- Prevents race conditions with proper locking
- Invoice deletion includes saldo refund in the same transaction

### Automatic Refunds on Deletion
- When an invoice with `kwota` is deleted, the system automatically refunds the amount
- Applies to:
  - User deletion of their own invoices
  - Accountant/admin deletion of any invoice
  - Bulk deletion by admins
  - Deletion of advance (zaliczka) with associated invoices
- Transaction type: `invoice_delete_refund`
- UI label: "Zwrot z usuniętej faktury"

### Negative Balances
- System allows negative balances by design
- Enables users to continue submitting invoices even when budget is exceeded
- Visual warnings when balance is negative
- Accountants can see which users exceeded their budget

### Performance
- Indexed columns for fast queries:
  - `user_id` on saldo_transactions
  - `created_at` on saldo_transactions
  - `reference_id` on saldo_transactions
- Efficient pagination for transaction history

### Security
- Role-based access control (RBAC)
- Users can only view their own saldo and history
- Only accountants and admins can adjust balances
- Only accountants and admins can view other users' balances
- All changes are audited with creator information

## Testing Checklist

- [ ] Admin can assign positive budget to user
- [ ] Admin can reduce user budget with negative amount
- [ ] User sees updated saldo in header
- [ ] User sees updated saldo on dashboard
- [ ] Invoice submission reduces saldo correctly
- [ ] Invoice deletion refunds saldo correctly
- [ ] Transaction history shows correct amounts
- [ ] Transaction history shows delete refunds with proper label
- [ ] Transaction history links to invoices
- [ ] User cannot access saldo management page
- [ ] User cannot view other users' saldo
- [ ] Statistics show correct totals
- [ ] Search functionality works in user list
- [ ] Negative balances display in red
- [ ] Positive balances display in green
- [ ] Notes are required for adjustments
- [ ] Minimum note length is enforced (5 characters)
- [ ] Advance deletion with invoices refunds all invoice amounts
- [ ] Bulk invoice deletion refunds all amounts correctly

## Future Enhancements

### Potential Features
1. **Invoice Refunds**: Automatically restore saldo when invoice is rejected (in addition to delete refunds)
2. **Budget Limits**: Set hard limits to prevent exceeding budget
3. **Notifications**: Alert users when budget is low or negative
4. **Batch Operations**: Adjust multiple users' balances at once
5. **Export Functionality**: Export transaction history to CSV/PDF
6. **Budget Categories**: Assign different budgets for different invoice types
7. **Recurring Budgets**: Automatically reset budgets monthly/quarterly
8. **Approval Workflow**: Require approval for budget adjustments above threshold
9. **Budget Forecasting**: Predict when user will exhaust budget
10. **Department Budgets**: Group users by department with shared budgets

## Migration Notes

### Running the Migration
```bash
npm run db:push
```

This will:
1. Add `saldo` column to `users` table (default 0)
2. Create `saldo_transactions` table
3. Create necessary indexes

### Existing Users
- All existing users will have saldo = 0
- No data loss or disruption
- Admin should assign initial budgets after migration

## Support

For questions or issues related to the saldo system:
1. Check this documentation
2. Review the code in `/src/server/trpc/routers/saldo.ts`
3. Check the database schema in `/src/server/db/schema.ts`
4. Review migration file `/drizzle/0014_add_saldo_system.sql`

## File Structure

```
src/
├── server/
│   ├── db/
│   │   └── schema.ts                    # Database schema with saldo tables
│   └── trpc/
│       └── routers/
│           ├── saldo.ts                 # Saldo tRPC router
│           └── invoice.ts               # Updated to deduct saldo
├── app/
│   └── a/
│       ├── saldo/
│       │   └── page.tsx                 # Saldo management page
│       ├── saldo-history/
│       │   └── page.tsx                 # Transaction history page
│       └── dashboard/
│           └── page.tsx                 # Updated with saldo display
└── components/
    ├── saldo-display.tsx                # Saldo display component
    ├── user-header.tsx                  # Updated with saldo badge
    ├── accountant-header.tsx            # Updated with saldo link
    └── admin-header.tsx                 # Updated with saldo link

drizzle/
└── 0014_add_saldo_system.sql            # Database migration
```
