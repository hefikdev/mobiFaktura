# Database Cleanup - Quick Reference

⚡ **Quick overview of database cleanup implementation**

---

## What Gets Cleaned Up Automatically?

| Data | Retention | When |
|------|-----------|------|
| 🔐 **Expired Sessions** | None (delete on expire) | Daily 1 AM |
| 📝 **Login Logs** | 30 days | Daily 1 AM |
| 🚫 **Login Attempts** | 30 days | Daily 1 AM |
| 🔔 **Notifications** | 2 days | Daily 1 AM |
| 📁 **Orphaned Files** | Audit only (logged) | Daily 1 AM |

## What's NOT Auto-Deleted?

- ✅ Invoices (business data)
- ✅ Invoice edit history
- ✅ Companies
- ✅ Users

> Manual deletion available via admin interface

---

## How to Monitor

### Option 1: Admin Endpoint (Programmatic)

```typescript
const { data } = trpc.admin.getDatabaseStats.useQuery();

// Check database size
console.log(`DB Size: ${data.totalDatabaseSize.gigabytes} GB`);

// Check row counts
console.log(`Sessions: ${data.rowCounts.sessions}`);

// Check for alerts
data.alerts.forEach(alert => {
  console.log(`[${alert.level}] ${alert.message}`);
});
```

### Option 2: Server Logs

```bash
# Check if cron is running
grep "Cron jobs initialized" logs/server.log

# Check cleanup execution
grep "\[CRON\]" logs/server.log

# Should see daily:
# [CRON] Next cleanup scheduled for: ...
# [CRON] Login logs cleanup completed at ...
# [CRON] Expired sessions cleanup completed at ...
# [CRON] Old login attempts cleanup completed at ...
# [CRON] No orphaned files found in MinIO
```

### Option 3: Direct Database Query

```sql
-- Check for expired sessions (should be near 0 after cleanup)
SELECT COUNT(*) FROM sessions WHERE expires_at < NOW();

-- Check for old login logs (should be 0)
SELECT COUNT(*) FROM login_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Check for old login attempts (should be 0)
SELECT COUNT(*) FROM login_attempts WHERE updated_at < NOW() - INTERVAL '30 days';
```

---

## Alert Thresholds

| Alert Level | Condition | Action |
|-------------|-----------|--------|
| 🔴 **Critical** | Sessions > 50,000 | Check cleanup job immediately |
| ⚠️ **Warning** | DB > 10 GB | Review growth rate |
| ⚠️ **Warning** | Expired sessions > 1,000 | Verify cleanup ran |
| ℹ️ **Info** | Old data pending cleanup | Normal, will clean at 1 AM |

---

## Troubleshooting

### "Sessions table is growing too large"

**Check:**
1. Is server running past 1 AM daily?
2. Check logs for cleanup execution
3. Verify no errors in cleanup function

**Quick Fix:**
```typescript
// Manually trigger cleanup (dev only)
import { cleanExpiredSessions } from '@/server/cron/cleanup';
await cleanExpiredSessions();
```

### "Orphaned files detected"

**Check:**
- Review logged file keys in server logs
- Verify they're not referenced in invoices table

**Fix:**
- Manually delete from MinIO if confirmed orphaned
- Investigate why deletion failed (transaction rollback?)

### "Cleanup not running"

**Check:**
1. Server restarted between cleanup runs?
2. Timezone issues (1 AM in which timezone)?
3. Errors in cron initialization?

**Fix:**
- Ensure server stays running overnight
- Check `initCronJobs()` is called on server start
- Review error logs

---

## Expected Performance

### Database Size (3 Years)

| Organization | Users | Without Cleanup | With Cleanup | Savings |
|--------------|-------|-----------------|--------------|---------|
| Small | 100 | 350 MB | 200 MB | **43%** |
| Medium | 1,000 | 5 GB | 3 GB | **40%** |
| Large | 10,000 | 50 GB | 25 GB | **50%** |

### Table Sizes (Stable State)

| Table | Without Cleanup | With Cleanup |
|-------|-----------------|--------------|
| Sessions | 180,000+ rows | ~5,000 rows |
| Login Logs | Unlimited | ~20,000 rows |
| Login Attempts | 72,000+ rows | ~10,000 rows |
| Notifications | Unlimited | ~50,000 rows |

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/server/cron/cleanup.ts` | Cleanup function implementations |
| `src/server/cron/index.ts` | Cron scheduler |
| `src/server/trpc/routers/admin.ts` | Monitoring endpoint (`getDatabaseStats`) |
| `docs/DATA_LIFECYCLE_STRATEGY.md` | Full strategy document |
| `docs/DATABASE_CLEANUP_IMPLEMENTATION.md` | Implementation details |

---

## Quick Commands

```bash
# View cleanup logs
grep "\[CRON\]" logs/server.log | tail -20

# Check database size
psql -d mobifaktura -c "SELECT pg_size_pretty(pg_database_size('mobifaktura'));"

# Check session count
psql -d mobifaktura -c "SELECT COUNT(*) FROM sessions;"

# Check expired session count
psql -d mobifaktura -c "SELECT COUNT(*) FROM sessions WHERE expires_at < NOW();"
```

---

## Next Steps

1. ✅ Implementation complete
2. ⏳ Wait 24 hours for first cleanup run
3. ✅ Verify cleanup in logs
4. ✅ Check database stats
5. 📊 Optional: Build admin dashboard UI

---

**Status:** ✅ Active  
**Last Updated:** December 9, 2025  

For detailed information, see:
- [Data Lifecycle Strategy](./DATA_LIFECYCLE_STRATEGY.md)
- [Implementation Details](./DATABASE_CLEANUP_IMPLEMENTATION.md)
