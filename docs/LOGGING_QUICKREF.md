# Logging Quick Reference

## View Logs

**Real-time (console):**
```bash
docker logs mobifaktura_app -f
```

**Log files:**
```bash
# All logs
docker exec mobifaktura_app cat /app/logs/app.log

# Errors only
docker exec mobifaktura_app cat /app/logs/error.log

# Last 100 lines
docker exec mobifaktura_app tail -n 100 /app/logs/app.log
```

## Search Logs

```bash
# Find errors
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log

# Find specific user
docker exec mobifaktura_app grep '"userId":"123"' /app/logs/app.log

# Auth events
docker exec mobifaktura_app grep '"module":"auth"' /app/logs/app.log

# Last 50 errors
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log | tail -n 50
```

## Use Logger

```typescript
import { logger } from '@/lib/logger';

// Basic
logger.info('Message');
logger.error('Error occurred');

// With context
logger.info({
  userId: '123',
  action: 'create_invoice',
  invoiceId: 'INV-001',
});
```

## Module Loggers

```typescript
import { authLogger, dbLogger, apiLogger } from '@/lib/logger';

authLogger.info({ action: 'login', userId: '123' });
dbLogger.info({ operation: 'insert', table: 'invoices' });
apiLogger.info({ method: 'POST', path: '/api/invoices' });
```

## Helper Functions

```typescript
import { logError, logRequest, logAuth } from '@/lib/logger';

// Errors
try {
  await operation();
} catch (error) {
  logError(error, { context: 'value' });
}

// Requests
logRequest('POST', '/api/invoices', 150, 201);

// Auth
logAuth('login', 'user-123', { ip: '1.2.3.4' });
```

## Set Log Level

```bash
# .env
LOG_LEVEL=info  # debug, info, warn, error
```

## Log Management

```bash
# Copy logs to host
docker cp mobifaktura_app:/app/logs ./logs

# Check log size
docker exec mobifaktura_app du -sh /app/logs

# Clear logs
docker exec mobifaktura_app sh -c "> /app/logs/app.log"
docker exec mobifaktura_app sh -c "> /app/logs/error.log"

# Backup logs
docker cp mobifaktura_app:/app/logs ./logs_backup_$(date +%Y%m%d)
```

## Quick Commands

```bash
# Start app
docker-compose up -d

# View real-time logs
docker logs mobifaktura_app -f

# Tail log file
docker exec mobifaktura_app tail -f /app/logs/app.log

# Count errors
docker exec mobifaktura_app grep -c '"level":"error"' /app/logs/app.log
```

---

📖 **Full Guide:** See `docs/LOGGING.md`
