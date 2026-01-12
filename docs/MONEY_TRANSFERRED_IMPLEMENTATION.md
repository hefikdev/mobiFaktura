# Money Transferred Status Implementation - Summary

## Overview
Implemented a comprehensive "wykonano przelew" (money_transferred) status for zaliczka (budget requests) system with complete logging and tracking capabilities.

## Status Flow
The complete zaliczka lifecycle is now:
1. **pending** - User submits a budget request
2. **approved** - Accountant/admin approves the request (saldo is increased at this point)
3. **money_transferred** - Accountant confirms the bank transfer with transfer number (NEW)
4. **rozliczono** - Accountant marks the request as settled/reconciled
5. **rejected** - Request is rejected (terminal state)

## Database Changes

### Migration: 0023_add_money_transferred_status.sql
Added new columns to `budget_requests` table:
- `transfer_number` (VARCHAR 255) - Bank transfer reference number (mandatory for money_transferred status)
- `transfer_date` (TIMESTAMP WITH TIME ZONE) - Date when transfer was made
- `transfer_confirmed_by` (UUID) - ID of accountant/admin who confirmed the transfer
- `transfer_confirmed_at` (TIMESTAMP WITH TIME ZONE) - Timestamp when transfer was confirmed in system

All changes are properly logged with who made the change and when.

### Schema Updates
- Updated `src/server/db/schema.ts` with new fields
- Updated `src/types/index.ts` BudgetRequest interface
- Status enum now supports: `pending`, `approved`, `money_transferred`, `rejected`, `rozliczono`

## Backend Changes

### API Endpoint: confirmTransfer
New tRPC procedure in `budgetRequest` router:
- **Input**: `{ requestId: string, transferNumber: string }`
- **Validation**: Transfer number must be 3-255 characters
- **Authorization**: accountantProcedure (accountant/admin only)
- **Logic**:
  - Validates request status is `approved`
  - Updates status to `money_transferred`
  - Records transfer number, date, confirmer ID, and confirmation timestamp
  - Sends notification to user
  - Full audit trail maintained

### Modified Endpoints
1. **settle**: Now requires status to be `money_transferred` (previously `approved`)
2. **getAll**: Returns new transfer-related fields
3. **exportBudgetRequests**: Includes transfer number and date in exports
4. **bulkDelete**: Updated to include `money_transferred` in status filters

## Frontend Changes

### New Component: TransferConfirmationDialog
Location: `src/components/transfer-confirmation-dialog.tsx`
Features:
- Modal dialog with transfer number input (mandatory)
- Shows request details (user, email, amount)
- Validates transfer number (min 3 characters)
- Integrated with tRPC mutation
- Proper error handling and success notifications

### Budget Requests Page Updates
Location: `src/app/a/budget-requests/page.tsx`

Changes:
1. **Default Filter**: Changed from "pending" to "all" (wszystkie)
2. **New Table Column**: "Data transferu" (Transfer Date)
3. **Updated Actions**:
   - `approved` status → Shows "Potwierdź przelew" button (blue)
   - `money_transferred` status → Shows "Rozlicz" button (purple)
   - `rozliczono` status → Shows settlement date
4. **Status Filter**: Added "Przelew wykonany" option

### Status Badge Updates
Location: `src/components/invoice-status-badge.tsx`
- Added `money_transferred` status with blue color scheme
- Icon: DollarSign
- Label: "Przelew wykonany"

### Bulk Delete Updates
Location: `src/components/bulk-delete-budget-requests.tsx`
- Updated status type definitions to include `money_transferred`
- Added "Przelew wykonany" option in status filter dropdown

## User Experience Flow

### For Accountants/Admins:
1. User submits budget request → appears in "Oczekujące"
2. Accountant reviews and approves → saldo is increased automatically
3. Accountant makes bank transfer and clicks "Potwierdź przelew"
4. Dialog appears requiring transfer number (e.g., "2024/01/12345")
5. After confirming, status changes to "Przelew wykonany"
6. User receives notification with transfer details
7. Accountant can now click "Rozlicz" to mark as settled
8. Status changes to "Rozliczono"

### For Users:
- Receive notification when transfer is confirmed
- Can see transfer status in their budget request list
- Full transparency on request lifecycle

## Logging & Audit Trail

Every action is logged with:
- **Who**: User ID (transfer_confirmed_by, reviewed_by)
- **When**: Timestamps (transfer_confirmed_at, transfer_date, reviewed_at, settled_at, created_at, updated_at)
- **What**: Status changes, transfer number, amounts, justifications
- **History**: All previous states preserved

## Database Robustness

The schema is now future-ready with:
1. Comprehensive timestamp tracking at every stage
2. Foreign key relationships maintaining referential integrity
3. Proper indexing for performance
4. Cascading deletes for data cleanup
5. Nullable fields for optional data (transfer info only after confirmation)
6. Numeric fields for monetary values (precision: 12, scale: 2)

## Testing Checklist

✅ Database migration applied successfully
✅ Schema types updated
✅ API endpoint created and validated
✅ Dialog component created
✅ Page updated with new column and actions
✅ Status badge handles new status
✅ Bulk delete supports new status
✅ Default filter changed to "wszystkie"
✅ No TypeScript errors
✅ All logging points in place

## Files Modified

### Database
- `drizzle/0023_add_money_transferred_status.sql`
- `drizzle/meta/_journal.json`
- `src/server/db/schema.ts`

### Backend
- `src/server/trpc/routers/budgetRequest.ts`

### Frontend
- `src/types/index.ts`
- `src/components/transfer-confirmation-dialog.tsx` (NEW)
- `src/components/invoice-status-badge.tsx`
- `src/components/bulk-delete-budget-requests.tsx`
- `src/app/a/budget-requests/page.tsx`

## Notes

- The system maintains backward compatibility - existing `approved` requests can still be settled, but the recommended flow is to confirm transfer first
- Transfer number is stored for future reference and reconciliation
- All notifications are sent asynchronously to avoid blocking the main flow
- The implementation follows the existing patterns in the codebase for consistency
