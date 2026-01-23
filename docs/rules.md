# System Rules & Validation Reference

**mobiFaktura Invoice Management System**  
**Version:** 1.0  
**Last Updated:** December 27, 2025

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
**Required Statuses** (cannot be changed):
- `pending` - Initial state
- `in_review` - Under accountant review
- `accepted` - Approved by accountant
- `rejected` - Rejected by accountant

### **Assignment Rules**
- **Can Assign**: Accountants can assign invoices to themselves
- **Unassignment**: Can set assignedTo to null
- **Permission**: Only accountants can assign/unassign

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

## 🖼️ **Image & File Rules**

### **Upload Validation**
- **Format**: Must be data URL (base64 encoded)
- **Compression**: Automatic JPEG compression to 80% quality
- **Size**: No explicit size limit (handled by browser/database constraints)
- **Type**: Images only (validated by data URL format)

### **Storage Rules**
- **Naming**: UUID-based filenames
- **Cleanup**: Orphaned files audited daily
- **Backup**: Included in MinIO backup procedures

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
- **Sessions**: Automatic cleanup when expired
- **Login Logs**: 30 days retention
- **Login Attempts**: 30 days retention
- **Notifications**: 2 days retention
- **Audit Trail**: Permanent retention for critical operations

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
| View Own Invoices | ✅ | ✅ | ✅ |
| Review Invoices | ❌ | ✅ | ✅ |
| Assign Invoices | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| Bulk Delete | ❌ | ❌ | ✅ |
| View All Saldo | ❌ | ✅ | ✅ |
| Adjust Saldo | ❌ | ✅ | ✅ |

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
- `MINIO_ACCESS_KEY`: MinIO storage access key
- `MINIO_SECRET_KEY`: MinIO storage secret key
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

## ✅ **Validation Checklist**

Use this checklist to ensure new features follow system rules:

- [ ] Password validation follows security requirements
- [ ] Invoice amounts are positive and properly validated
- [ ] Dates cannot be in the future
- [ ] User permissions checked before operations
- [ ] Rate limiting applied to new endpoints
- [ ] CSRF protection on state-changing operations
- [ ] Input sanitization and validation
- [ ] Error messages user-friendly and consistent
- [ ] Audit logging for security-relevant operations
- [ ] Database transactions for multi-step operations

---

## 🔧 **Implementation Notes**

### **Consistent Error Messages**
- Use Polish language for user-facing messages
- Include specific validation failure reasons
- Maintain consistent error response format

### **Database Constraints**
- Foreign key relationships properly defined
- Unique constraints on critical fields
- Index optimization for query performance

### **API Design**
- tRPC procedures for type safety
- Input validation using Zod schemas
- Proper error handling and logging
- Rate limiting on all public endpoints

This document serves as the single source of truth for system behavior. All code changes must comply with these rules to maintain consistency and security.</content>
<parameter name="filePath">c:\Users\update\Desktop\mobiFaktura\docs\rules.md