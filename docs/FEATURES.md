# mobiFaktura - Complete Feature Documentation

**Version:** 1.0  
**Last Updated:** January 29, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Invoice Management](#invoice-management)
4. [Budget Request System](#budget-request-system)
5. [Advance Payments (Zaliczki)](#advance-payments-zaliczki)
6. [Balance System (Saldo)](#balance-system-saldo)
7. [Correction Invoices](#correction-invoices)
8. [KSeF Integration](#ksef-integration)
9. [Export & Reporting](#export--reporting)
10. [Analytics Dashboard](#analytics-dashboard)
11. [Admin Panel](#admin-panel)
12. [Notification System](#notification-system)
13. [Settings & Preferences](#settings--preferences)

---

## Overview

mobiFaktura is a comprehensive financial management system designed for Polish businesses. It handles the complete lifecycle of invoice processing, budget management, advance payments, and balance tracking with full audit trails and KSeF e-invoicing integration.

### Key Design Principles

- **Role-based access control**: Clear separation between users, accountants, and admins
- **Audit trail**: Every action is tracked with who, when, and what
- **Type safety**: Full TypeScript with tRPC for end-to-end type checking
- **Security first**: Argon2id hashing, CSRF protection, secure sessions
- **Polish compliance**: KSeF integration, proper invoice numbering, currency formats

---

## User Roles & Permissions

### User (Role: `user`)

**Primary Tasks:**
- Upload invoices (e-invoices, receipts)
- Track invoice status
- Request budget increases
- View personal balance (saldo) and transaction history
- Manage advances
- View personal analytics

**Access:**
- `/a/dashboard` - Personal dashboard
- `/a/upload` - Upload new invoices
- `/a/user-invoice/[id]` - View own invoices
- `/a/saldo` - View balance
- `/a/saldo-history` - Transaction history
- `/a/advances` - View advances
- `/a/budget-requests` - View own requests
- `/a/settings` - Account settings

### Accountant (Role: `accountant`)

**Primary Tasks:**
- Review and process invoices
- Approve/reject budget requests
- Manage advances
- Create correction invoices
- Generate reports
- View all company data

**Access:**
- All user pages plus:
- `/a/accountant` - Unified review dashboard
- `/a/invoices` - All invoices view
- `/a/corrections` - Correction invoices
- `/a/korekty` - Alternative corrections view
- `/a/budget-requests` - All budget requests
- `/a/exports` - Advanced export system
- `/a/analytics` - System-wide analytics

### Admin (Role: `admin`)

**Primary Tasks:**
- All accountant tasks
- Manage users and companies
- Assign permissions
- Bulk delete operations
- System monitoring
- Emergency access

**Access:**
- All accountant pages plus:
- `/a/admin` - Admin panel
- `/a/permissions` - User-company permissions

---

## Invoice Management

### Invoice Types

#### 1. E-Invoice (e-faktura)
- Standard electronic invoice
- Can be uploaded to KSeF
- Full company details required
- Net/VAT/Gross amounts

#### 2. Receipt (Paragon)
- Simplified invoice (no VAT details)
- Often from retail purchases
- Simpler information requirements

#### 3. Correction Invoice (Faktura korygująca)
- Corrects errors in original invoices
- Only accountants/admins can create
- Automatically adjusts user balance
- Links to original invoice

### Invoice Status Workflow

```
Pending → In Review → Accepted → Transferred → Settled
                   ↓
                Rejected
```

**Status Details:**

- **Pending**: Just uploaded, waiting for review
- **In Review**: Claimed by accountant for review
- **Accepted**: Approved by accountant, added to user saldo
- **Rejected**: Declined with reason, not added to saldo
- **Transferred**: Money has been transferred to user (manual confirmation)
- **Settled**: Final status, invoice is completely processed (settled with another transaction)

### Invoice Submission (User)

**URL:** `/a/upload`

**Process:**
1. Select invoice type (e-invoice or receipt)
2. Select company
3. Take photo or upload image
4. (Optional) Scan KSeF QR code for e-invoices
5. Enter invoice details:
   - Invoice number
   - Amount (kwota)
   - Description (optional)
   - KSeF number (optional, auto-filled from QR)
6. Submit

**Validation:**
- Image required
- Invoice number required
- Amount must be positive
- Company must be assigned to user

### Invoice Review (Accountant/Admin)

**URLs:** 
- `/a/accountant` - Unified dashboard
- `/a/invoice/[id]` - Individual review

**Review Actions:**

#### Accept Invoice
1. Click "Akceptuj" button
2. Optionally add comment
3. Confirm action
4. **System automatically:**
   - Updates invoice status to "accepted"
   - Increases user saldo by invoice amount
   - Creates saldo transaction record
   - Sends notification to user
   - Records reviewer ID and timestamp

#### Reject Invoice
1. Click "Odrzuć" button
2. Enter rejection reason (required)
3. Confirm action
4. **System automatically:**
   - Updates invoice status to "rejected"
   - Does NOT change user saldo
   - Records rejection reason
   - Sends notification to user
   - Records reviewer ID and timestamp

#### Mark as Transferred
- Available after acceptance
- Confirms money has been sent to user
- Updates status to "transferred"
- Records transfer date and confirmer

#### Mark as Settled (Rozliczono)
- Final status after payment
- Usually means invoice was reconciled with another transaction
- Updates status to "settled"
- Records settlement date and who settled

### Bulk Operations

**URL:** `/a/accountant`

**Features:**
- Select multiple invoices with checkboxes
- Bulk accept with optional comment
- Bulk reject with reason
- Bulk status changes

**Concurrency Protection:**
- System checks if invoice was already processed
- Shows conflict warning if status changed
- Prevents double-processing

### Invoice Search & Filters

**Available Filters:**
- **Text search**: Invoice number, company name, user name
- **Company**: Filter by specific company
- **Status**: All, Pending, In Review, Accepted, Rejected, Transferred, Settled
- **Date range**: From/to dates
- **Amount range**: Min/max
- **Type**: E-invoice, Receipt, Correction
- **KSeF number**: Search by KSeF ID

**Advanced Filters:**
- Sort by date, amount, status
- Filter by reviewer
- Filter by submission date vs review date

### Invoice Details Dialog

**Features:**
- Full invoice information
- Image preview with zoom
- Status history
- Related corrections (if any)
- Budget request link (if created)
- Edit history
- Download/print options

### Invoice Edit History

**Tracked Changes:**
- Status changes (who, when, old/new status)
- Amount changes
- Description updates
- Reviewer assignments
- Comments added

---

## Budget Request System

### What is a Budget Request?

Budget requests (prośby o zwiększenie budżetu) allow users to request an increase in their saldo balance. This is typically used when a user needs to make purchases but doesn't have sufficient balance.

### Budget Request Workflow

```
User Creates → Pending → Accountant Reviews
                           ↓
                 Approved/Rejected
                           ↓
                    Money Transferred
                           ↓
                      Settled (Rozliczono)
```

### Creating a Budget Request (User)

**URL:** Any page with "Zwiększ budżet" button

**Process:**
1. Click "Zwiększ budżet" in user menu
2. Enter requested amount
3. Enter justification (minimum 10 characters)
4. Submit
5. System records current balance at time of request
6. Accountants are notified

**Validation:**
- Amount must be positive
- Can only have one pending request at a time
- Justification required

### Reviewing Budget Requests (Accountant/Admin)

**URLs:**
- `/a/accountant` - Unified dashboard
- `/a/budget-requests` - Dedicated view

**Review Actions:**

#### Approve Request
1. Click "Zatwierdź" button
2. Confirm action
3. **System automatically:**
   - Increases user saldo by requested amount
   - Creates saldo transaction
   - Updates request status to "approved"
   - Records reviewer and timestamp
   - Sends notification to user

#### Reject Request
1. Click "Odrzuć" button
2. Enter rejection reason
3. Confirm action
4. **System automatically:**
   - Does NOT change saldo
   - Updates request status to "rejected"
   - Records rejection reason
   - Sends notification to user

#### Confirm Transfer (Wpłynęła)
- After approval, mark when money actually arrived
- Updates status to "money_transferred"
- Records transfer date

#### Settle Request (Rozlicz)
- Final step after processing related invoices
- Updates status to "settled" (rozliczono)
- Records settlement date
- Links to related invoices submitted after approval

**Transaction Safety:**
All saldo changes happen in database transactions. If any step fails, the entire operation is rolled back.

### Budget Request Details

**Information Displayed:**
- Requested amount
- Current balance at time of request
- Justification
- Status with color coding
- Submission date
- Review date (if reviewed)
- Reviewer name
- Transfer date (if applicable)
- Settlement date (if settled)
- Related invoices (submitted between approval and settlement)

### Budget Request Filters

- Status: All, Pending, Approved, Rejected, Transferred, Settled
- Company
- Date range
- Amount range
- User name search

---

## Advance Payments (Zaliczki)

### What are Advances?

Advances (zaliczki) are prepayments given to users before expenses are incurred. They work similarly to budget requests but are typically used for planned expenses.

**URL:** `/a/advances`

### Advance Workflow

```
Request → Approved → Transfer Date Set → Settled
```

### Advance Status

- **Pending**: Awaiting approval
- **Approved**: Approved, waiting for transfer
- **Transferred**: Money has been transferred to user
- **Settled**: User has submitted invoices covering the advance

### Advance Management

**Features:**
- Create advance requests
- Set transfer dates
- Track settlement status
- Link to related invoices
- View advance history

**Advance Details:**
- Amount
- Purpose/description
- Request date
- Approval date
- Transfer date
- Settlement date
- Related invoices

---

## Balance System (Saldo)

### Overview

The saldo system tracks each user's financial balance. It increases when invoices are accepted or budget requests are approved, and serves as an audit trail for all financial transactions.

**URLs:**
- `/a/saldo` - Current balance view
- `/a/saldo-history` - Full transaction history

### Saldo Balance

**Display:**
```
Saldo: 1,234.56 zł
```

**Color Coding:**
- Green: Positive balance
- Red: Negative balance (if applicable)
- Gray: Zero balance

### Saldo Transactions

Every balance change creates a transaction record:

**Transaction Types:**
- **Invoice Accepted**: `+amount` (reference: invoice ID)
- **Budget Request Approved**: `+amount` (reference: request ID)
- **Correction Invoice**: `+/- amount` (reference: correction ID)
- **Manual Adjustment**: Admin-initiated changes
- **Refund**: Returned funds

**Transaction Details:**
- Amount (with +/- sign)
- Type/description
- Date and time
- Reference ID (links to source)
- Balance before
- Balance after
- Created by (user/system)

### Transaction History

**Features:**
- Chronological list of all transactions
- Filter by date range
- Filter by transaction type
- Search by reference ID
- Export to Excel/PDF

### Balance Reconciliation

System ensures balance integrity:
- All transactions are immutable
- Balance is calculated from transactions
- Verification queries check consistency
- Audit logs track all changes

---

## Correction Invoices

### Purpose

Correction invoices (faktury korygujące) are used to correct errors in previously submitted invoices. They can adjust amounts up or down and automatically update user balances.

**URL:** `/a/corrections` or `/a/korekty`

### Creating Corrections (Accountant/Admin Only)

**Process:**
1. Navigate to corrections page
2. Click "Dodaj fakturę korygującą"
3. Search for original invoice (must be accepted)
4. Upload correction invoice image
5. Enter correction amount (positive for increase)
6. Add justification (minimum 10 characters)
7. Submit

**Automatic Actions:**
- Correction is auto-accepted (no review needed)
- User balance is adjusted by correction amount
- Saldo transaction is created
- Invoice number: `{ORIGINAL_NUMBER}-KOREKTA`
- Links to original invoice
- User is notified

### Correction Details

**Information:**
- Original invoice reference
- Original invoice number
- Correction amount (+/-)
- Justification
- Date created
- Created by (accountant/admin)
- Status (usually auto-accepted)

### Correction Constraints

- Can only correct accepted invoices
- Must provide justification
- Amount can be positive or negative
- Creates permanent audit trail
- Cannot be deleted (only voided with another correction)

---

## KSeF Integration

### Polish E-Invoicing System

KSeF (Krajowy System e-Faktur) is Poland's national e-invoicing system. mobiFaktura integrates with KSeF to streamline invoice submission.

**Full Documentation:** [KSEF_QUICKREF.md](KSEF_QUICKREF.md)

### Features

#### QR Code Scanning
- Scan KSeF QR code with camera
- Auto-fills invoice details:
  - Invoice number
  - KSeF number (UUID)
  - Amount (if available)
  - Company details

#### Manual Entry
- Enter KSeF number manually
- Format validation (UUID)
- Links invoice to KSeF system

#### KSeF Search
- Search invoices by KSeF number
- Filter invoices with/without KSeF numbers
- View KSeF status

### KSeF Workflow

1. Receive invoice from vendor
2. Vendor uploads to KSeF (generates QR code)
3. User scans QR code in mobiFaktura
4. mobiFaktura auto-fills invoice details
5. User reviews and submits
6. Accountant reviews (can verify KSeF number)
7. Invoice processed normally

---

## Export & Reporting

### Advanced Export System

**URL:** `/a/exports`

Comprehensive multi-report generator with customizable parameters.

### Available Reports

#### 1. Invoices Report
**Data Included:**
- Invoice ID
- Invoice number
- User name
- Company name
- Amount
- Status
- Type (e-invoice/receipt/correction)
- KSeF number
- Submission date
- Review date
- Reviewer name
- Comments

**Filters:**
- Date range
- Company
- Status
- Type
- Reviewer
- Amount range

#### 2. Advances Report
**Data Included:**
- Advance ID
- User name
- Company
- Amount
- Status
- Request date
- Approval date
- Transfer date
- Settlement date
- Related invoices

**Filters:**
- Date range
- Company
- Status
- User

#### 3. Budget Requests Report
**Data Included:**
- Request ID
- User name
- Company
- Requested amount
- Current balance (at time of request)
- Status
- Justification
- Submission date
- Review date
- Reviewer name
- Transfer date
- Settlement date
- Rejection reason (if rejected)

**Filters:**
- Date range
- Company
- Status
- User

#### 4. Saldo Transactions Report
**Data Included:**
- Transaction ID
- User name
- Transaction type
- Amount
- Balance before
- Balance after
- Reference ID
- Reference type
- Date
- Description

**Filters:**
- Date range
- User
- Transaction type

#### 5. Corrections Report
**Data Included:**
- Correction ID
- Original invoice number
- User name
- Company
- Correction amount
- Justification
- Created by
- Date created
- Status

**Filters:**
- Date range
- Company
- User

### Export Formats

#### Excel (.xlsx)
- Multiple sheets (one per report)
- Formatted headers
- Auto-sized columns
- Totals row
- Polish formatting (currency, dates)

#### PDF
- Professional formatting
- Headers and footers
- Page numbers
- Totals summary

### Export Process

1. Select reports to include
2. Configure filters for each report
3. Choose export format (Excel/PDF)
4. Generate report
5. Download file

---

## Analytics Dashboard

**URL:** `/a/analytics`

### Overview Charts

#### Invoice Analytics
- **Total invoices**: Count by status
- **Invoice value**: Total amounts by status
- **Submission rate**: Invoices per day/week/month
- **Acceptance rate**: % accepted vs rejected
- **Average processing time**: Time from submission to review
- **By company**: Breakdown by company
- **By type**: E-invoices vs receipts vs corrections

#### Budget Request Analytics
- **Total requests**: Count by status
- **Total amount requested**: Sum of all requests
- **Approval rate**: % approved vs rejected
- **Average request amount**
- **Pending vs resolved**

#### Saldo Analytics
- **Current balance**: Overall system balance
- **Balance distribution**: Per user/company
- **Transaction volume**: Transactions over time
- **Balance trends**: How balances change

#### User Activity
- **Most active users**: By invoice count
- **Submission patterns**: Time of day/week
- **Company activity**: Which companies are most active

### Chart Types

- **Line charts**: Trends over time
- **Bar charts**: Comparisons between categories
- **Pie charts**: Distribution percentages
- **Tables**: Detailed breakdowns

### Filters

- Date range selector
- Company filter
- User filter
- Status filter

---

## Admin Panel

**URL:** `/a/admin`

### Dashboard Overview

**Statistics:**
- Total users (active/inactive)
- Total companies
- Total invoices (by status)
- Total budget requests (by status)
- System storage usage
- Recent activity

### User Management

#### Create User
1. Enter email
2. Enter name
3. Set password
4. Assign role (user/accountant/admin)
5. (Optional) Assign companies
6. Submit

**Validation:**
- Email must be unique
- Password must meet policy (8+ chars, uppercase, lowercase, number, special char)
- Role required

#### Edit User
- Change name
- Change email
- Reset password
- Change role
- Activate/deactivate account
- View login history

#### User Permissions
**URL:** `/a/permissions`

Assign users to companies:
- Select user
- Select companies (multi-select)
- Save
- User can only upload invoices for assigned companies

### Company Management

#### Create Company
- Company name (required)
- NIP (optional)
- Address (optional)
- Active status

#### Edit Company
- Update name/details
- Activate/deactivate
- View assigned users
- View company statistics

### Bulk Delete Operations

**Safety Features:**
- Password confirmation required
- Shows count of items to be deleted
- Irreversible warning
- Confirmation dialog

#### Delete Old Invoices
- Select date threshold
- Deletes invoices older than date
- Also deletes associated files from MinIO
- Creates audit log entry

#### Delete Old Budget Requests
- Select date threshold
- Only deletes requests in final status (approved/rejected/settled)
- Preserves saldo transaction records

#### Delete Old Notifications
- Auto-cleanup runs daily
- Manually trigger cleanup
- Deletes notifications older than 2 days
- System notifications preserved

### System Notifications

Create system-wide announcements:
- Title
- Message
- (Optional) Link
- Send to all users
- Appears in notification bell

---

## Notification System

### Notification Types

1. **Invoice Submitted** - User uploaded invoice
2. **Invoice Assigned** - Invoice claimed for review
3. **Invoice Accepted** - Invoice was approved
4. **Invoice Rejected** - Invoice was declined
5. **Budget Request Submitted** - New budget request
6. **Budget Request Approved** - Request was approved
7. **Budget Request Rejected** - Request was declined
8. **Saldo Adjusted** - Balance was changed
9. **System Message** - Admin announcement
10. **Company Updated** - Company details changed
11. **Password Changed** - Security notification

### Notification UI

**Location:** Bell icon in header

**Features:**
- Real-time count badge
- Sound alert (optional)
- Dropdown list
- Mark as read
- Mark all as read
- Auto-refresh

**Notification Card:**
- Icon (based on type)
- Title
- Message
- Timestamp
- (Optional) Action button
- Read/unread status

### Notification Preferences

**URL:** `/a/settings`

Users can toggle each notification type:
- Enable/disable per type
- Enable/disable sound
- Changes saved automatically

### Notification Cleanup

- Read notifications older than 2 days are auto-deleted
- Unread preserved longer
- System messages preserved
- Runs daily at 1:00 AM

---

## Settings & Preferences

**URL:** `/a/settings`

### Account Information

**Display:**
- User name
- Email
- Role
- Account creation date
- Current saldo balance

### Change Password

**Requirements:**
- Current password verification
- New password requirements:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- Password confirmation
- Cannot reuse old password

### Notification Preferences

**Options:**
- Master sound toggle
- Per-notification-type toggles
- Preview of each notification type

### Theme Selection

- **Light mode**
- **Dark mode**
- **System** (follows OS preference)

### Assigned Companies

**Display:**
- List of companies user can submit invoices for
- Read-only (managed by admin)

### Session Information

- Current session details
- Logout button
- Session expiration date

---

## Additional Features

### Search Functionality

**Global Search:**
- Invoice numbers
- Company names
- User names
- KSeF numbers

**Search Locations:**
- Header search bar (some pages)
- Dedicated search inputs on list pages
- Advanced filter dialogs

### Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Mobile Features:**
- Hamburger menu
- Touch-optimized buttons
- Swipe gestures
- Camera integration
- Simplified layouts

### Offline Support (PWA)

**Features:**
- Install as native app
- Offline page access
- Service worker caching
- Offline banner notification

### Error Handling

**User-Friendly Errors:**
- Clear error messages
- Suggested actions
- Retry buttons
- Help links

**Developer Errors:**
- Structured logging
- Error boundaries
- Stack traces (dev mode)
- Sentry integration (optional)

### Performance Optimizations

- **Image optimization**: Next.js Image component
- **Code splitting**: Dynamic imports
- **Lazy loading**: Off-screen components
- **Caching**: React Query
- **Database indexes**: Optimized queries
- **Pagination**: Infinite scroll on long lists

---

## Summary

mobiFaktura provides a complete financial management solution with:

✅ **Comprehensive invoice management** with multiple types  
✅ **Budget request system** with approval workflow  
✅ **Advance payment tracking**  
✅ **Balance system** with full transaction history  
✅ **KSeF integration** for Polish e-invoicing  
✅ **Advanced reporting** with Excel/PDF export  
✅ **Real-time analytics** with visual charts  
✅ **Role-based access control** with granular permissions  
✅ **Complete audit trail** for compliance  
✅ **Mobile-first responsive design** with PWA support  
✅ **Secure architecture** with modern best practices  

For technical implementation details, see [ARCHITECTURE.md](ARCHITECTURE.md).  
For API documentation, see [API.md](API.md).  
For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
