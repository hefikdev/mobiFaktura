# Data Lifecycle & Retention Strategy
**mobiFaktura Invoice Management System**  
**Version:** 1.0  
**Last Updated:** December 27, 2025

---

## Overview

This document outlines the comprehensive data lifecycle and retention policies for the mobiFaktura system to ensure optimal database performance, legal compliance, and cost-effective storage management.

## Automated Cleanup Schedule

All automated cleanup tasks run **daily at 1:00 AM** server time.

### Active Cleanup Policies

| Data Type | Retention Period | Cleanup Method | Status |
|-----------|-----------------|----------------|--------|
| **Sessions** | Until expiration | Automatic daily | ✅ Active |
| **Login Logs** | 30 days | Automatic daily | ✅ Active |
| **Login Attempts** | 30 days | Automatic daily | ✅ Active |
| **Notifications** | 2 days | Automatic daily | ✅ Active |
| **Orphaned Files** | N/A | Daily audit (log only) | ✅ Active |

---

## Data Retention by Category

### 1. Session Data

**Table:** `sessions`

**Retention Policy:** Expire based on `expiresAt` timestamp

**Cleanup Function:** `cleanExpiredSessions()`

**Rationale:**
- Sessions are ephemeral by nature
- No business or legal requirement to retain
- Expired sessions have no functional value

**Implementation:**
```typescript
// Runs daily at 1 AM
DELETE FROM sessions WHERE expires_at < NOW()
```

**Expected Impact:**
- Reduces session table by 90%+ after first cleanup
- Prevents index bloat
- Improves authentication query performance

---

### 2. Security Logs

#### Login Logs

**Table:** `login_logs`

**Retention Policy:** 30 days

**Cleanup Function:** `cleanOldLoginLogs()`

**Rationale:**
- Security audit trail for recent activity
- 30 days sufficient for incident investigation
- GDPR compliance - minimal data retention

**Implementation:**
```typescript
// Runs daily at 1 AM
DELETE FROM login_logs WHERE created_at < NOW() - INTERVAL '30 days'
```

**Contains:**
- User email (PII)
- IP addresses (PII)
- User agent strings
- Login timestamps
- Success/failure status

**Privacy Considerations:**
- Consider anonymizing email/IP after 7 days for extended retention
- Right to be forgotten: User deletion cascades to login logs

---

#### Login Attempts (Rate Limiting)

**Table:** `login_attempts`

**Retention Policy:** 30 days

**Cleanup Function:** `cleanOldLoginAttempts()`

**Rationale:**
- Tracks failed login attempts for security
- Rate limiting data becomes stale
- 30 days sufficient for security analysis

**Implementation:**
```typescript
// Runs daily at 1 AM
DELETE FROM login_attempts WHERE updated_at < NOW() - INTERVAL '30 days'
```

**Contains:**
- Identifier (email or IP address)
- Attempt count
- Lock timestamps

---

### 3. User Notifications

**Table:** `notifications`

**Retention Policy:** 2 days

**Cleanup Function:** `cleanOldNotifications()`

**Rationale:**
- Notifications are transient by nature
- Users should respond to notifications quickly
- Reduces database bloat significantly

**Implementation:**
```typescript
// Runs daily at 1 AM
DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '2 days'
```

**Volume:**
- High-volume table (5-20 per user action)
- 2-day retention prevents excessive growth

---

### 4. Business Data (Long-term Retention)

#### Invoices

**Table:** `invoices`

**Retention Policy:** **Indefinite** (No automated deletion)

**Manual Deletion:** Available via admin bulk delete feature

**Rationale:**
- Legal requirement: Tax/accounting records (typically 7-10 years)
- Business critical data
- Audit trail necessity

**Associated Data:**
- Invoice images in MinIO storage
- Edit history (cascades on invoice deletion)
- Notifications (cascades on invoice deletion)

**Archival Strategy (Future Consideration):**
- Move invoices older than 7 years to cold storage
- Separate `archived_invoices` table
- Migrate MinIO images to cheaper storage tier
- Maintain references for compliance

---

#### Invoice Edit History

**Table:** `invoice_edit_history`

**Retention Policy:** Same as parent invoice (indefinite)

**Cleanup Method:** Cascade delete when invoice deleted

**Rationale:**
- Audit trail for invoice modifications
- Legal/compliance requirement
- Matches invoice retention period

**Volume:**
- 1-5 records per invoice edit
- Grows with invoice modifications

---

#### Companies

**Table:** `companies`

**Retention Policy:** Soft delete with `active` flag

**Cleanup Method:** Manual only (RESTRICT on delete)

**Rationale:**
- Business critical reference data
- Foreign key integrity
- Low growth rate

---

#### Users

**Table:** `users`

**Retention Policy:** Manual deletion only

**Cleanup Method:** Cascade to related data

**Cascades to:**
- Sessions (deleted automatically)
- Invoices (deleted automatically)
- Notifications (deleted automatically)

**GDPR "Right to be Forgotten":**
- Admin can delete user account
- All personal data is removed via cascade
- Consider anonymizing rather than deleting for audit trail

---

### 5. File Storage (MinIO)

#### Invoice Images

**Storage:** MinIO object storage

**Retention Policy:** Tied to invoice lifecycle

**Cleanup Method:** Manual via admin bulk delete

**Automated Audit:** `auditOrphanedFiles()` (daily, read-only)

**Rationale:**
- Images must match database records
- No automated deletion to prevent data loss
- Audit function logs orphaned files for manual review

**Implementation:**
```typescript
// Daily audit at 1 AM (logs only, doesn't delete)
1. List all files in MinIO bucket
2. Compare with invoice.imageKey in database
3. Log any orphaned files for manual review
```

**Orphan Prevention:**
- Bulk delete UI properly removes MinIO files
- Tight coupling between DB and storage operations
- Transaction-based deletions

**Future Enhancement:**
- Lifecycle policies for automatic archival
- Compression for older images
- Tiered storage (hot/cold)

---

## Monitoring & Alerting

### Database Health Monitoring

**Endpoint:** `admin.getDatabaseStats()`

**Available Metrics:**
- Total database size (bytes, MB, GB)
- Individual table sizes
- Row counts per table
- Cleanup candidates (rows pending deletion)

**Alert Thresholds:**

| Condition | Alert Level | Threshold |
|-----------|-------------|-----------|
| Expired sessions count | Warning | > 1,000 |
| Old login logs count | Warning | > 10,000 |
| Old login attempts count | Info | > 5,000 |
| Total sessions count | Critical | > 50,000 |
| Database size | Warning | > 10 GB |

**Alert Response:**
- **Info:** Log for awareness
- **Warning:** Review cleanup job logs
- **Critical:** Investigate cleanup job failure immediately

---

### Monitoring Dashboard (Recommended)

Create an admin dashboard page showing:

1. **Storage Overview**
   - Total database size
   - Growth rate (daily/weekly/monthly)
   - MinIO storage usage

2. **Table Statistics**
   - Row counts for all tables
   - Size per table
   - Growth trends

3. **Cleanup Status**
   - Last cleanup run timestamp
   - Records cleaned per run
   - Pending cleanup counts

4. **Alerts Panel**
   - Active warnings/errors
   - Historical alert trends

---

## Growth Projections

### Expected Database Growth (With Cleanup Active)

| Organization Size | Users | Invoices/Month | 1 Year | 3 Years | 5 Years |
|-------------------|-------|----------------|--------|---------|---------|
| **Small** | 100 | 50 | 200 MB | 500 MB | 800 MB |
| **Medium** | 1,000 | 500 | 3 GB | 8 GB | 15 GB |
| **Large** | 10,000 | 5,000 | 25 GB | 80 GB | 150 GB |

### Growth Factors

**Low-growth Tables (with cleanup):**
- Sessions: ~1,000-5,000 rows (stable)
- Login logs: ~10,000-50,000 rows (stable)
- Login attempts: ~1,000-10,000 rows (stable)
- Notifications: ~5,000-50,000 rows (stable)

**High-growth Tables (business data):**
- Invoices: Linear growth with business activity
- Invoice edit history: Proportional to invoice edits
- Companies: Very slow growth

---

## Compliance & Legal Considerations

### Tax & Accounting Law

**Invoice Retention:** Most jurisdictions require 7-10 years

**Recommendation:**
- Retain all invoices for minimum 7 years
- Implement archival after 7 years (move to cold storage)
- Never auto-delete invoices without legal review

### GDPR & Privacy

**Personal Data:**
- User accounts (name, email)
- Login logs (email, IP addresses)
- Login attempts (email/IP identifiers)

**Right to be Forgotten:**
- User deletion cascades properly ✅
- Login logs deleted within 30 days ✅
- Consider anonymization for extended audit trail

**Data Minimization:**
- 2-day notification retention ✅
- 30-day security log retention ✅
- Expired sessions cleaned immediately ✅

### Audit Trail Requirements

**What to Keep:**
- Invoice edit history (matches invoice retention)
- User actions on invoices (via edit history)
- Admin actions (consider separate admin audit log)

**What to Delete:**
- Transient notifications
- Expired sessions
- Old rate-limiting data

---

## Implementation Checklist

### Phase 1: Critical Cleanup (✅ Completed)
- [x] Implement `cleanExpiredSessions()`
- [x] Implement `cleanOldLoginAttempts()`
- [x] Implement `auditOrphanedFiles()`
- [x] Update cron scheduler to run all cleanups daily
- [x] Test in development environment

### Phase 2: Monitoring (✅ Completed)
- [x] Create `getDatabaseStats()` endpoint
- [x] Implement automated alerting thresholds
- [ ] Build admin dashboard UI for monitoring
- [ ] Set up email/Slack alerts for critical issues

### Phase 3: Long-term Strategy (Future)
- [ ] Implement invoice archival strategy (7+ years)
- [ ] Create cold storage tier in MinIO
- [ ] Add compression for archived images
- [ ] Consider data warehouse for analytics (separate from operational DB)
- [ ] Implement admin audit log (separate table)

---

## Backup & Recovery

### Backup Strategy

**Database Backups:**
- Daily full backups (retain 30 days)
- Weekly full backups (retain 3 months)
- Monthly full backups (retain 1 year)

**MinIO Backups:**
- Daily incremental backups
- Weekly full backups
- Versioning enabled on bucket

**Recovery Time Objective (RTO):** < 4 hours  
**Recovery Point Objective (RPO):** < 24 hours

### Disaster Recovery

**Critical Data Priority:**
1. Invoices + images (highest priority)
2. User accounts
3. Companies
4. Invoice edit history
5. Sessions (can regenerate)
6. Notifications (transient)

---

## Performance Optimization

### Index Strategy

**Critical Indexes (Already in place):**
- `sessions.expiresAt` - For cleanup queries
- `loginLogs.createdAt` - For cleanup queries
- `loginAttempts.updatedAt` - For cleanup queries
- `notifications.createdAt` - For cleanup queries
- `invoices.status` - For dashboard queries
- `invoices.userId` - For user queries

**Query Performance:**
- Cleanup queries use indexed columns
- Expected execution time: < 100ms for indexed deletes
- No table scans on large tables

### Vacuum Strategy

**PostgreSQL VACUUM:**
- Auto-vacuum enabled (default)
- Consider manual VACUUM ANALYZE after large cleanups
- Monitor table bloat with `pg_stat_user_tables`

---

## Troubleshooting

### Cleanup Job Not Running

**Check:**
1. Cron job initialization in server logs
2. Next scheduled run timestamp
3. Server timezone configuration

**Verify:**
```bash
# Check if initCronJobs() was called
grep "Cron jobs initialized" server.log

# Check cleanup execution
grep "\[CRON\]" server.log
```

### Database Growing Too Fast

**Investigate:**
1. Check `getDatabaseStats()` for unusual table sizes
2. Verify cleanup jobs are running successfully
3. Look for orphaned files in MinIO
4. Check for failed cleanup job logs

**Common Causes:**
- Cleanup job not running (server restart interrupted cron)
- High business activity (expected growth)
- Orphaned files accumulating
- Failed cascading deletes

### High Session Count

**Likely Causes:**
- Cleanup job failing silently
- Sessions not expiring (check `expiresAt` logic)
- High user activity with long session duration

**Solution:**
1. Manually run cleanup: Call `cleanExpiredSessions()`
2. Check error logs for failures
3. Verify `expiresAt` is being set correctly

---

## Maintenance Schedule

### Daily (Automated)
- Run all cleanup functions (1 AM)
- Audit orphaned files
- Log cleanup statistics

### Weekly (Manual)
- Review database stats dashboard
- Check alert history
- Verify cleanup job success

### Monthly (Manual)
- Review growth trends
- Analyze table size changes
- Plan capacity if needed
- Review and clean orphaned files (if any)

### Quarterly (Strategic)
- Review retention policies
- Update growth projections
- Plan archival strategy
- Capacity planning for next 6-12 months

---

## Cost Optimization

### Database Costs
- Cleanup reduces storage by **40-50%**
- Smaller database = lower hosting costs
- Faster queries = less compute usage

### Storage Costs (MinIO)
- Current: Hot storage for all files
- Future: Tiered storage (hot/cold)
- Compression for images > 1 year old
- Archive tier for invoices > 7 years

### Expected Savings
- Small org: $10-20/month
- Medium org: $100-200/month
- Large org: $1,000-2,000/month

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Dec 9, 2025 | Initial document creation | System |

---

## References

- [Database Growth Audit Report](./DATABASE_GROWTH_AUDIT.md)
- [Bulk Delete Feature Documentation](./BULK_DELETE_FEATURE.md)
- GDPR Compliance Guidelines
- PostgreSQL Performance Tuning Best Practices

---

## Contact & Support

For questions about data lifecycle policies:
- Technical: Review `src/server/cron/cleanup.ts`
- Business: Consult with legal/accounting team for retention requirements
- Monitoring: Access admin dashboard at `/a/admin` (admin role required)

---

**Document Status:** ✅ Active  
**Next Review Date:** March 9, 2026 (Quarterly review)
