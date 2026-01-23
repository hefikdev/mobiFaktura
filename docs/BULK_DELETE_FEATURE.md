# Bulk Invoice Deletion Feature

## Overview
A comprehensive, secure bulk invoice deletion feature for admin users that allows filtering and deleting invoices with real-time progress tracking and verification.

## Features

### 1. **Password Protection**
- Requires admin password verification before preview
- Prevents unauthorized deletions
- Password is validated against the admin's hashed password in the database

### 2. **Flexible Filtering Options**
The system supports multiple filter types:

#### Older Than X Months
- Delete all invoices older than a specified number of months
- Example: Delete all invoices older than 2 months

#### Specific Year/Month
- Delete all invoices from a specific year
- Optionally filter by specific month within that year
- Example: Delete all invoices from 2024 or January 2024

#### Date Range
- Delete invoices within a custom date range
- Specify start and end dates
- Example: Delete invoices from 2024-01-01 to 2024-03-31

#### Status Filter
- Filter by invoice status:
  - All statuses
  - Pending
  - In Review
  - Accepted
  - Rejected

### 3. **Safe Deletion Process**

The deletion process follows a strict verification workflow:

1. **Preview Phase**
   - Shows total number of invoices matching criteria
   - Displays sample invoices (first 5) with details
   - No deletion occurs at this stage

2. **Deletion Phase**
   - Deletes invoices one by one
   - For each invoice:
     - Deletes file from MinIO storage
     - Verifies MinIO deletion
     - Deletes record from PostgreSQL
     - Verifies database deletion
   - Continues even if individual deletions fail (logs errors)

3. **Verification Phase**
   - Re-queries database with same filters
   - Confirms all matching invoices are gone
   - Reports any remaining invoices

4. **Completion**
   - Shows final statistics
   - Success/failure status
   - Detailed log of entire operation

### 4. **Progress Tracking**

Real-time progress display includes:
- Progress bar (0-100%)
- Count: Deleted / Total
- Failed count (if any)
- Statistics cards:
  - Found: Total invoices matching criteria
  - Deleted: Successfully deleted count
  - Errors: Failed deletion count

### 5. **Log Terminal**

A terminal-like log window shows:
- Timestamp for each operation
- Operation type (info, success, error, warning)
- Detailed messages for each step:
  - File deletions from MinIO
  - Database deletions
  - Verification checks
  - Error messages
- Auto-scrolls to show latest entries
- Color-coded by severity:
  - Blue (Info): General information
  - Green (Success): Successful operations
  - Yellow (Warning): Warnings
  - Red (Error): Errors and failures

### 6. **User Interface**

The feature is hidden by default in admin settings:
1. Navigate to Settings page (as admin)
2. Find "Danger Zone" section
3. Click "Show admin options"
4. Click "Bulk Delete Invoices"

This ensures accidental access is prevented.

## Technical Implementation

### Backend (TRPC)

Three main procedures in `src/server/trpc/routers/admin.ts`:

1. **bulkDeleteInvoices** - Password verification and invoice lookup
2. **deleteSingleInvoice** - Single invoice deletion with verification
3. **verifyDeletion** - Final verification query

### Frontend

Main component: `src/components/bulk-delete-invoices.tsx`
- Material Design UI
- Real-time progress updates
- Step-by-step wizard interface
- Terminal-style logging

### Database

Works with existing schema:
- `invoices` table
- `users` table (for password verification)

### Storage

Deletes files from:
- MinIO object storage
- PostgreSQL database

## Security Considerations

1. **Admin-only access** - Protected by `adminProcedure` middleware
2. **Password verification** - Requires valid admin password
3. **Irreversible warning** - Clear warnings throughout UI
4. **Hidden by default** - Requires explicit action to reveal
5. **Audit trail** - Complete log of all operations
6. **Transaction safety** - Each deletion is verified before proceeding

## Usage Example

### Scenario: Delete old accepted invoices

1. Open Settings → Danger Zone → Show admin options → Bulk Delete Invoices
2. Select filter: "Older than X months"
3. Enter: 2 months
4. Select status: "Accepted"
5. Enter admin password
6. Click "Search invoices"
7. Review preview (shows count and samples)
8. Click "Delete all (X)" to confirm
9. Watch progress bar and log
10. Wait for verification
11. See success status

## Error Handling

The system handles various error scenarios:
- Invalid password → Shows error, returns to idle
- No invoices found → Shows warning message
- MinIO deletion fails → Logs error, continues to next
- Database deletion fails → Logs error, continues to next
- Verification fails → Shows warning with remaining count

## Performance

- Processes invoices sequentially to prevent overwhelming the system
- Small delay (100ms) between deletions for stability
- Progress updates in real-time
- Logs are buffered and auto-scrolled

## Future Enhancements

Possible improvements:
- Export deletion log to file
- Schedule deletions for later
- Batch size configuration
- Rollback capability (if technically feasible)
- Email notification on completion
- Multi-admin approval requirement

## API Reference

### TRPC Procedures

#### bulkDeleteInvoices
```typescript
input: {
  password: string;
  filters: {
    olderThanMonths?: number;
    year?: number;
    month?: number;
    dateRange?: { start: string; end: string };
    statuses?: Array<"pending" | "in_review" | "accepted" | "rejected" | "all">;
  };
}
output: {
  success: boolean;
  totalFound: number;
  invoices?: Array<Invoice>;
}
```

#### deleteSingleInvoice
```typescript
input: {
  invoiceId: string;
}
output: {
  success: boolean;
  invoiceId: string;
  invoiceNumber: string;
}
```

#### verifyDeletion
```typescript
input: {
  filters: { /* same as bulkDeleteInvoices */ };
}
output: {
  remaining: number;
  allDeleted: boolean;
}
```

## Testing Checklist

- [ ] Admin can access bulk delete from settings
- [ ] Non-admin users cannot see the option
- [ ] Password verification works correctly
- [ ] Invalid password shows error
- [ ] Preview shows correct invoice count
- [ ] All filter types work (older, year, range)
- [ ] Status filters work correctly
- [ ] Progress bar updates during deletion
- [ ] Log shows all operations
- [ ] Failed deletions are logged
- [ ] Verification confirms all deleted
- [ ] Success status shows on completion
- [ ] Can close dialog after completion
- [ ] Cannot close during deletion
- [ ] Files deleted from MinIO
- [ ] Records deleted from PostgreSQL

## Troubleshooting

### Invoices not deleting
- Check MinIO connection
- Verify database connection
- Check admin password
- Review error logs in terminal

### Progress stuck
- Check browser console for errors
- Verify TRPC endpoints are responding
- Check network connection

### Verification fails
- Some invoices may have deletion protection
- Check database constraints
- Review individual error messages in log
