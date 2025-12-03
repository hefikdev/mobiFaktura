# Changelog - OCR Removal & Dynamic Updates

## Date: November 28, 2025

## Summary
Removed all OCR-related legacy code and implemented dynamic real-time updates throughout the application. The verification process is now automatic when accountants view invoices, and tracking has been enhanced to show who accepted/rejected invoices and when.

## Database Schema Changes

### Removed Fields from `invoices` table:
- `invoice_date` - No longer needed
- `supplier_name` - Removed obsolete field
- `supplier_nip` - Removed obsolete field  
- `total_amount` - Removed obsolete field

### Added Fields to `invoices` table:
- `last_edited_by` (uuid, FK to users) - Tracks who last edited the invoice (admin)
- `last_edited_at` (timestamp) - Tracks when the invoice was last edited

### Existing Tracking Fields (kept):
- `reviewed_by` - Tracks who accepted/rejected the invoice
- `reviewed_at` - Tracks when the invoice was accepted/rejected (to seconds precision)
- `current_reviewer` - Tracks who is currently reviewing
- `review_started_at` - When the review started

## Backend Changes

### `src/server/db/schema.ts`
- Removed obsolete invoice fields
- Added `lastEditedBy` and `lastEditedAt` tracking fields
- Added relation for `lastEditor`

### `src/server/trpc/routers/invoice.ts`
1. **Removed `startReview` mutation** - Review now starts automatically when accountant views invoice
2. **Updated `getById` query** - Automatically starts review when accountant views pending invoice
3. **Updated `updateInvoiceData` mutation** - Now tracks edits with `lastEditedBy` and `lastEditedAt`
4. **Enhanced queries** - Added company information to all invoice queries
5. **Added reviewer tracking** - `reviewedBy` and `reviewedAt` are now returned with full details

### Query Enhancements:
- `myInvoices` - Now includes `companyId`
- `pendingInvoices` - Now includes `companyName` and enhanced reviewer info
- `reviewedInvoices` - Now includes `companyName`, `reviewerName`, and `reviewedAt`
- `getById` - Now includes `company`, `reviewer`, `lastEditor` details

## Frontend Changes

### `src/app/auth/invoice/[id]/page.tsx` (Invoice Review Page)
**Major Refactor:**
- Removed all OCR-related UI (confirmation dialogs, OCR status indicators)
- Removed manual "Start Review" button - review starts automatically on page load
- Removed obsolete form fields: `invoiceDate`, `supplierName`, `supplierNip`, `totalAmount`
- Kept only essential fields: `invoiceNumber`, `currency`, `description`
- Added company name display in header
- Added acceptance tracking display (who and when with seconds precision)
- Added last edit tracking display
- Added auto-refresh every 3 seconds for real-time updates
- Simplified form state management

### `src/app/auth/dashboard/page.tsx` (User Dashboard)
- Removed "Przetwarzanie OCR..." fallback text
- Changed refresh interval from 15s to 5s for faster updates
- Invoice list now updates automatically

### `src/app/auth/accountant/page.tsx` (Accountant Dashboard)
**Enhanced:**
- Changed pending invoices refresh interval from 10s to 5s
- Added `companyName` display for each invoice
- Added `reviewerName` and `reviewedAt` display for reviewed invoices (with seconds)
- Removed `totalAmount` display (obsolete field)
- Enhanced InvoiceListItem to show company information
- Real-time updates for both pending and reviewed lists

### `src/app/auth/admin/page.tsx` (Admin Panel)
- Added auto-refresh every 10 seconds for user and company lists
- Lists now update automatically when changes occur

## Docker & Infrastructure

### Removed:
- `docker/paddleocr/` folder (empty, OCR-related)
- All references to OCR services in docker-compose files

## Migration

### Created: `drizzle/0002_remove_ocr_fields.sql`
SQL migration file to:
1. Drop obsolete columns: `invoice_date`, `supplier_name`, `supplier_nip`, `total_amount`
2. Add new tracking columns: `last_edited_by`, `last_edited_at`

**To apply migration:**
```bash
# Run the migration SQL against your database
psql -U mobifaktura -d mobifaktura -f drizzle/0002_remove_ocr_fields.sql
```

Or using drizzle-kit:
```bash
npm run db:push
```

## Key Features Implemented

### 1. Automatic Verification Process
- ✅ When accountant opens invoice details page, status automatically changes from `pending` to `in_review`
- ✅ No manual "Start Review" button needed
- ✅ Accountant is automatically assigned as `current_reviewer`

### 2. Dynamic Real-Time Updates
- ✅ User invoice list: refreshes every 5 seconds
- ✅ Accountant pending list: refreshes every 5 seconds
- ✅ Accountant reviewed list: refreshes every 10 seconds
- ✅ Admin user/company lists: refresh every 10 seconds
- ✅ Invoice detail page: refreshes every 3 seconds
- ✅ All lists refetch on window focus

### 3. Enhanced Tracking
- ✅ Shows who accepted/rejected invoice (name displayed)
- ✅ Shows exact date/time of acceptance/rejection (down to seconds)
- ✅ Tracks and displays last edit by admin
- ✅ Shows company name for each invoice on accountant side

### 4. Simplified Invoice Data
- ✅ Removed unnecessary fields that were OCR-specific
- ✅ Kept only essential fields: invoice number, currency, description, justification
- ✅ Cleaner, more focused UI

## Testing Checklist

- [ ] Test automatic review start when accountant opens invoice
- [ ] Verify dynamic updates work for all lists
- [ ] Check acceptance tracking shows correct user and timestamp
- [ ] Verify company name displays on accountant invoices
- [ ] Test edit tracking for admin edits
- [ ] Confirm OCR references are completely removed
- [ ] Test migration on staging database
- [ ] Verify no breaking changes in production

## Breaking Changes

⚠️ **Data Loss Warning**: The migration will permanently delete data from these columns:
- `invoice_date`
- `supplier_name`
- `supplier_nip`
- `total_amount`

Make sure to backup your database before running the migration if you need this data.

## Notes

- The system no longer relies on OCR for data extraction
- Users must manually enter invoice numbers during upload
- Accountants view and verify invoices manually without OCR assistance
- All verification is now human-driven, not AI/OCR-driven
- Real-time updates ensure all users see the latest data without manual refresh
