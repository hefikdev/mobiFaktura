# System Rules & Validation Reference

**mobiFaktura Invoice Management System**  
**Version:** 2.0  
**Last Updated:** January 30, 2026

---

## Overview

This document consolidates all system-wide rules, validation requirements, and business logic constraints. Use this as the authoritative reference for ensuring consistency across the application.

---

## 🔐 **Authentication & Security Rules**

### **Password Requirements**
- **Minimum Length**: 8 characters
- **Must Contain**:
  - At least 1 uppercase letter (A-Z)
  - At least 1 lowercase letter (a-z)
  - At least 1 number (0-9)
- **Hashing**: Argon2id with 64MB memory, 3 iterations, 4 parallelism
- **Validation Message**: "Hasło musi mieć minimum 8 znaków" / "Hasło musi zawierać wielką literę" / etc.

### **Login Attempt Rules**
- **Maximum Attempts**: 3 failed attempts per identifier (email/IP)
- **Lockout Duration**: 30 seconds after 3 failed attempts
- **Identifier Tracking**: Email address or IP address
- **Reset**: Successful login resets attempt counter
- **Cleanup**: Old attempts (>30 days) automatically cleaned up

### **Session Security**
- **JWT Expiration**: 60 days maximum
- **Storage**: Database-backed sessions (not just cookies)
- **Invalidation**: Automatic cleanup of expired sessions
- **CSRF Protection**: Origin header validation on all mutations

### **Rate Limiting Rules**
- **Global Limit**: 300 requests/minute per IP
- **Auth Limit**: 50 requests/minute per IP (login/register)
- **Write Limit**: 100 requests/minute per IP+UserID (create/update/delete)
- **Read Limit**: 500 requests/minute per IP+UserID (queries)
- **Headers**: Include rate limit status in responses

---

## 📄 **Invoice Rules**

### **Amount Validation**
- **Must Be**: Positive number (> 0)
- **Cannot Be**: Zero or negative
- **Decimal Precision**: Maximum 2 decimal places
- **Maximum Value**: 999,999.99
- **Automatic Deduction**: Reduces user saldo when invoice submitted

### **Date Validation**
- **Cannot Be**: Future dates
- **Can Be**: Today or past dates
- **Age Limit**: Cannot be older than 6 months
- **Format**: ISO date string

### **Number Generation**
- **Format**: PREFIX/YYYY/NNNNNN (e.g., INV/2025/000001)
- **Uniqueness**: Must be unique across all invoices
- **Padding**: 6-digit zero-padded counter
- **Year**: Current year included

### **Status Workflow**
**Required Statuses** (full lifecycle):
- `pending` - Initial state after submission
- `in_review` - Under accountant review (auto-assigned or manual)
- `accepted` - Approved by accountant, awaiting payment
- `rejected` - Rejected by accountant with reason
- `transferred` - Money has been transferred to user (manual confirmation)
- `settled` - Final state, invoice reconciled/settled (e.g., against advance)

**Status Transitions**:
- Pending → In Review → Accepted → Transferred → Settled
- Pending → In Review → Rejected (terminal state)
- Auto-settlement: Accepted invoices linked to settled advances auto-transition to Settled

### **Invoice Types**
**Supported Types**:
- `einvoice` - Electronic invoice (e-faktura) - default, supports KSeF number
- `receipt` - Receipt/paragon - does not support KSeF number
- `correction` - Correction invoice - automatically created from existing invoice, adjusts saldo

**Type Rules**:
- Receipts cannot have KSeF numbers (validation enforced)
- Corrections cannot be corrected (prevents correction chains)
- Corrections automatically adjust user saldo (reverse original amount, apply correction amount)
- Corrections reference original invoice via `correctionForId` field

### **Assignment Rules**
- **Can Assign**: Accountants can assign invoices to themselves
- **Unassignment**: Can set assignedTo to null
- **Permission**: Only accountants can assign/unassign
- **Auto-assignment**: Claiming review automatically assigns invoice to accountant

### **Payment Tracking Rules**
- **Mark as Transferred**: Only accountants/admins can mark accepted invoices as transferred
  - Records `transferredBy` (user ID) and `transferredAt` (timestamp)
  - Indicates money has been sent to user
- **Mark as Settled**: Only accountants/admins can mark invoices as settled
  - Records `settledBy` (user ID) and `settledAt` (timestamp)
  - Final reconciliation state (e.g., settled against advance)
  - Auto-settlement: If invoice is linked to a settled advance, auto-marks as settled on acceptance
- **Deletion Restrictions**: Users cannot delete transferred or settled invoices (protection against data loss)

### **Correction Invoice Rules**
- **Creation**: Can create correction invoice from any non-correction invoice
- **Status Requirement**: Original invoice must be accepted
- **Saldo Adjustment**: 
  - Reverses original invoice amount (refunds saldo)
  - Applies correction amount (deducts new amount)
  - Net effect: saldo adjusted by difference
- **Automatic Assignment**: Correction uses same `advanceId` as original invoice
- **Cannot Correct**: Correction invoices cannot be corrected (prevents chains)

---

## 💰 **Saldo (Budget) Rules**

### **Transaction Types**
- **Adjustment**: Admin/accountant can increase/decrease user budget
- **Deduction**: Automatic reduction when user submits invoice
- **Refund**: Can restore saldo (positive transaction)

### **Validation Rules**
- **Amount**: Can be positive or negative
- **Notes**: Required, minimum 5 characters for adjustments
- **Transaction Atomicity**: All operations must succeed or all rollback

### **Balance Rules**
- **Can Be Negative**: Users can exceed budget (saldo goes negative)
- **No Upper Limit**: No maximum budget restriction
- **Precision**: 2 decimal places maintained

### **Permission Rules**
- **View**: Users can view their own saldo, admins/accountants can view all
- **Modify**: Only admins and accountants can adjust budgets
- **Statistics**: Only admins/accountants can view system-wide statistics

---

## � **Advances (Zaliczki) Rules**

### **Status Workflow**
- `pending` - Initial request state
- `transferred` - Money transferred to user (with transfer date)
- `settled` - User has submitted invoices covering the advance amount

### **Creation Rules**
- **Amount**: Must be positive, maximum 2 decimal places
- **Justification**: Required, minimum 10 characters
- **Automatic Saldo Addition**: When marked as transferred, advance amount added to user saldo

### **Transfer Rules**
- **Permission**: Only accountants/admins can mark as transferred
- **Transfer Date**: Required when marking as transferred
- **Saldo Impact**: Advance amount immediately added to user's saldo
- **One-time**: Once transferred, cannot be un-transferred (data integrity)

### **Settlement Rules**
- **Criteria**: Sum of accepted invoices linked to advance >= advance amount
- **Auto-settlement**: System automatically marks as settled when criteria met
- **Manual Settlement**: Accountants can manually mark as settled
- **Invoice Linking**: New invoices auto-link to latest transferred (unsettled) advance

### **Deletion Rules**
- **Pending**: Can be deleted by admins
- **Transferred/Settled**: Cannot be deleted (maintains financial audit trail)
- **Saldo Reversal**: If deleted, reverses any saldo transactions

---

## 📊 **Budget Request Rules**

### **Status Workflow**
- `pending` - Initial request state
- `approved` - Approved by accountant
- `rejected` - Rejected by accountant
- `money_transferred` - Money has been sent to user
- `settled` - Request fully processed and reconciled

### **Creation Rules**
- **Amount**: Must be positive
- **Justification**: Required, describes reason for budget increase
- **Company Association**: Can be linked to specific company
- **Current Balance**: Records user's balance at time of request

### **Approval Rules**
- **Permission**: Only accountants/admins can approve
- **Saldo Impact**: No immediate saldo change (only informational)
- **One-time**: Once approved/rejected, decision is final

### **Settlement Rules**
- **Money Transfer**: Mark when funds actually sent to user
- **Final Settlement**: Mark when fully processed and reconciled
- **Deletion**: Can only delete if in final state (approved/rejected/settled)

---

## �🖼️ **Image & File Rules**

### **Upload Validation**
- **Format**: Must be data URL (base64 encoded)
- **Compression**: Automatic JPEG compression to 80% quality
- **Size**: No explicit size limit (handled by browser/database constraints)
- **Type**: Images only (validated by data URL format)

### **Storage Rules**
- **System**: SeaweedFS S3-compatible object storage
- **Naming**: UUID-based filenames (userId/timestamp.jpg format)
- **Cleanup**: Orphaned files audited daily via cron job
- **Backup**: Included in SeaweedFS S3 backup procedures
- **Deletion**: Files deleted from storage when invoice deleted (transactional)
- **Presigned URLs**: 1-hour expiration for secure temporary access

---

## 📱 **PWA & Caching Rules**

### **Service Worker Caching**
- **StaleWhileRevalidate**: Fonts, CSS, JavaScript, images
- **NetworkFirst**: API calls, JSON data
- **CacheFirst**: Google Fonts
- **Disabled**: In development mode for debugging

### **Offline Mode Rules**
- **View Data**: Cached invoices can be viewed offline
- **Upload Restriction**: Cannot upload new invoices offline
- **UI Indicators**: Clear offline warnings and disabled buttons
- **Sync**: Manual refresh required when back online

---

## 🗂️ **Data Lifecycle Rules**

### **Retention Periods**
- **Sessions**: Automatic cleanup when expired (60-day max)
- **Login Logs**: 30 days retention
- **Login Attempts**: 30 days retention (resets on successful login)
- **Notifications**: 2 days retention (configurable per user)
- **Audit Trail**: Permanent retention for critical operations
- **Invoice Edit History**: Permanent retention for compliance

### **Notification Types**
- **Invoice Status Changes**: accepted, rejected, transferred, settled
- **Budget Request Status**: approved, rejected, settled
- **Advance Status**: transferred, settled
- **System Announcements**: Admin-initiated broadcasts
- **User Preferences**: Users can enable/disable notification types
- **Sound Alerts**: Optional audio notifications (can be disabled)

### **Cleanup Schedule**
- **Frequency**: Daily at 1:00 AM server time
- **Method**: Automatic database cleanup procedures
- **Logging**: Cleanup operations logged for monitoring

---

## 👥 **User Role & Permission Rules**

### **Role Hierarchy**
- **User**: Can submit invoices, view own data
- **Accountant**: Can review invoices, manage assignments, view user budgets
- **Admin**: Full system access, user management, bulk operations

### **Permission Matrix**
| Operation | User | Accountant | Admin |
|-----------|------|------------|-------|
| Submit Invoice | ✅ | ✅ | ✅ |
| Create Correction | ✅ | ✅ | ✅ |
| View Own Invoices | ✅ | ✅ | ✅ |
| Delete Own Pending Invoice | ✅ | ✅ | ✅ |
| Review Invoices | ❌ | ✅ | ✅ |
| Assign Invoices | ❌ | ✅ | ✅ |
| Mark as Transferred | ❌ | ✅ | ✅ |
| Mark as Settled | ❌ | ✅ | ✅ |
| Request Budget Increase | ✅ | ✅ | ✅ |
| Approve Budget Requests | ❌ | ✅ | ✅ |
| Request Advance | ✅ | ✅ | ✅ |
| Approve Advances | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Manage Companies | ❌ | ❌ | ✅ |
| Bulk Delete | ❌ | ❌ | ✅ |
| View All Saldo | ❌ | ✅ | ✅ |
| Adjust Saldo | ❌ | ✅ | ✅ |
| System Settings | ❌ | ❌ | ✅ |

---

## 🔄 **System Integration Rules**

### **KSeF Integration**
- **Number Format**: 18-36 characters, alphanumeric + special chars
- **Validation**: Length and character set validation
- **Rate Limiting**: Subject to global rate limits
- **Error Handling**: Comprehensive error logging

### **Multi-Company Support**
- **Token Mapping**: Environment-based company token selection
- **Isolation**: Company data properly segregated
- **Configuration**: Per-company settings via .env variables

---

## 📊 **Monitoring & Logging Rules**

### **Log Levels**
- **error**: System errors, failed operations
- **warn**: Warning conditions, rate limit hits
- **info**: Normal operations, user actions
- **debug**: Detailed debugging information

### **Sensitive Data Rules**
- **Redaction**: Passwords, tokens automatically redacted
- **IP Logging**: User IPs logged for security audit
- **PII Handling**: Personal data logged only when necessary

### **Performance Monitoring**
- **Health Checks**: `/api/health` endpoint for load balancer
- **Metrics**: Response times, error rates tracked
- **Database**: Connection pool monitoring

---

## 🚀 **Deployment & Environment Rules**

### **Environment Variables** (Required)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Cryptographically secure secret (32+ chars)
- `S3_ENDPOINT`: SeaweedFS S3 server hostname (default: seaweedfs-s3)
- `S3_PORT`: SeaweedFS S3 API port (default: 9000)
- `S3_ACCESS_KEY`: SeaweedFS S3 storage access key
- `S3_SECRET_KEY`: SeaweedFS S3 storage secret key
- `S3_BUCKET`: SeaweedFS S3 bucket name (default: invoices)
- `S3_USE_SSL`: Enable SSL for SeaweedFS (default: false)
- `SUPER_ADMIN_EMAIL`: Emergency admin email
- `SUPER_ADMIN_PASSWORD`: Emergency admin password

### **Database Connection**
- **Pool Size**: Maximum 50 connections
- **Timeout**: 2 seconds connection timeout
- **Idle Cleanup**: 30 seconds idle timeout

### **Security Headers**
- **CSP**: Content Security Policy configured
- **HSTS**: HTTP Strict Transport Security
- **XSS Protection**: Enabled
- **Frame Options**: DENY
- **Referrer Policy**: Strict origin when cross-origin

---