# Invoice Review Workflow - Updated

## User Workflow

1. **Upload Invoice**
   - Click "+" button in header
   - Select invoice image
   - Enter invoice number manually
   - Select company
   - Provide justification
   - Submit

2. **Monitor Status**
   - Dashboard auto-refreshes every 5 seconds
   - Status indicators:
     - 🟡 **Oczekuje** (Pending) - Waiting for accountant
     - 🔵 **W trakcie przeglądu** (In Review) - Being processed
     - 🟢 **Zaakceptowana** (Accepted) - Approved
     - 🔴 **Odrzucona** (Rejected) - Denied

3. **View Details**
   - Click on invoice to see details
   - View image and entered data
   - See acceptance/rejection info with timestamp

## Accountant Workflow

1. **View Pending Invoices**
   - Open accountant dashboard
   - See pending invoices list (auto-refreshes every 5 seconds)
   - Each invoice shows:
     - Invoice number
     - User name
     - **Company name** (NEW!)
     - Submission date/time
     - Current reviewer (if someone is reviewing)

2. **Review Invoice** (AUTOMATIC!)
   - Click on invoice to open details
   - **Review automatically starts** (no button click needed!)
   - Status changes to "In Review"
   - You are assigned as current reviewer
   - Page auto-refreshes every 3 seconds

3. **Process Invoice**
   - View invoice image (click to zoom)
   - Verify invoice number
   - Update currency if needed
   - Add description/notes
   - Read user's justification
   - Click "Zapisz zmiany" to save edits

4. **Make Decision**
   - **Zaakceptuj** (Accept) - Approve the invoice
   - **Odrzuć** (Reject) - Deny the invoice
   - Your name and exact timestamp (to seconds) are recorded

5. **View Reviewed Invoices**
   - Reviewed tab shows all processed invoices
   - Auto-refreshes every 10 seconds
   - Shows:
     - Invoice details
     - Company name
     - **Who approved/rejected** (NEW!)
     - **Exact approval/rejection time** (NEW!)

## Admin Workflow

1. **Monitor System**
   - View statistics dashboard
   - Lists auto-refresh every 10 seconds

2. **Manage Users**
   - Create new users
   - Assign roles
   - User list updates automatically

3. **Manage Companies**
   - Create/edit companies
   - Company list updates automatically

4. **Track Edits**
   - All admin edits are tracked with:
     - Who made the edit
     - When the edit was made (to seconds)

## Key Changes from Previous Version

### Removed:
- ❌ OCR processing and status indicators
- ❌ "Start Review" button
- ❌ OCR confirmation dialogs
- ❌ Invoice date field
- ❌ Supplier name field
- ❌ Supplier NIP field
- ❌ Total amount field

### Added:
- ✅ Automatic review initiation on page view
- ✅ Company name display on all invoice lists
- ✅ Reviewer name and timestamp tracking
- ✅ Last edit tracking (who and when)
- ✅ Faster auto-refresh intervals for real-time updates

### Changed:
- 🔄 Review starts automatically when accountant opens invoice
- 🔄 All lists update dynamically without manual refresh
- 🔄 Simplified invoice form with only essential fields
- 🔄 Enhanced tracking shows who accepted/rejected and when

## Auto-Refresh Intervals

| Page | Refresh Interval |
|------|------------------|
| User Dashboard | 5 seconds |
| Accountant Pending List | 5 seconds |
| Accountant Reviewed List | 10 seconds |
| Invoice Detail Page | 3 seconds |
| Admin User List | 10 seconds |
| Admin Company List | 10 seconds |

All pages also refetch data when window gains focus.

## Tips

- **For Users**: Your dashboard updates automatically - no need to refresh!
- **For Accountants**: Just open an invoice to start reviewing - it's automatic!
- **For Admins**: Lists update in real-time as changes occur
- **Everyone**: The system shows live data, so you always see the current state
