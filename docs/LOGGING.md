# Logging System - mobiFaktura

Simple, structured logging system for production monitoring and debugging.

## Overview

The application uses **Pino** for fast, structured JSON logging with file-based persistence.

### Architecture

```
┌─────────────┐
│   Next.js   │ ──> Pino Logger
│     App     │
└─────────────┘
       │
       ├──> Console (stdout)
       │
       └──> Log Files
            ├─ logs/app.log (all logs)
            └─ logs/error.log (errors only)
```

## Features

### ✅ Structured Logging
- **JSON format** in production for machine parsing
- **Pretty format** in development for human readability
- **Automatic redaction** of sensitive data (passwords, tokens)
- **Module-based loggers** for different parts of the app

### ✅ Log Levels
- `debug` - Detailed debugging information
- `info` - General information
- `warn` - Warning messages
- `error` - Error messages with stack traces
- `fatal` - Fatal errors causing shutdown

### ✅ Automatic Context
- Request ID
- User ID
- IP address
- Module name
- Timestamp (ISO 8601)
- Environment (production/development)

### ✅ Log Persistence
- **Console output** - Real-time monitoring via `docker logs`
- **File output** - Persistent logs in `/app/logs` directory
- **Separate error logs** - Quick access to errors only

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. View Logs

**Real-time logs (console):**
```bash
docker logs mobifaktura_app -f
```

**Log files (persistent):**
```bash
# All logs
docker exec mobifaktura_app cat /app/logs/app.log

# Errors only
docker exec mobifaktura_app cat /app/logs/error.log

# Tail last 100 lines
docker exec mobifaktura_app tail -n 100 /app/logs/app.log
```

**Copy logs to host:**
```bash
docker cp mobifaktura_app:/app/logs ./logs
```

## Using the Logger

### Basic Logging

```typescript
import { logger } from '@/lib/logger';

// Different log levels
logger.info('User logged in');
logger.warn('High memory usage detected');
logger.error('Failed to save invoice');
logger.debug('Processing invoice data');
```

### Structured Logging

```typescript
import { logger } from '@/lib/logger';

logger.info({
  userId: '123',
  action: 'create_invoice',
  invoiceId: 'INV-001',
  amount: 1500.50,
});
```

### Module Loggers

```typescript
import { authLogger, dbLogger, apiLogger } from '@/lib/logger';

// Auth events
authLogger.info({
  action: 'login',
  userId: '123',
  ip: '192.168.1.1',
});

// Database operations
dbLogger.info({
  operation: 'insert',
  table: 'invoices',
  duration: '15ms',
});

// API requests
apiLogger.info({
  method: 'POST',
  path: '/api/invoices',
  statusCode: 201,
});
```

### Helper Functions

```typescript
import { logError, logRequest, logAuth, logEvent } from '@/lib/logger';

// Log errors with context
try {
  await dangerousOperation();
} catch (error) {
  logError(error, {
    operation: 'create_invoice',
    userId: '123',
  });
}

// Log HTTP requests
logRequest('POST', '/api/invoices', 150, 201, {
  userId: '123',
});

// Log auth events
logAuth('login', '123', {
  ip: '192.168.1.1',
  success: true,
});

// Log business events
logEvent('invoice_created', '123', {
  invoiceId: 'INV-001',
  amount: 1500.50,
});
```

### Performance Logging

```typescript
import { logPerformance } from '@/lib/logger';

const start = Date.now();
await slowOperation();
const duration = Date.now() - start;

logPerformance('slow_operation', duration, {
  operation: 'generate_pdf',
});
```

## Log Levels

### Setting Log Level

**Environment variable:**
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

**Docker Compose:**
```yaml
environment:
  LOG_LEVEL: ${LOG_LEVEL:-info}
```

### Production Recommendations

| Environment | Level | Reason |
|-------------|-------|--------|
| Development | `debug` | See everything |
| Staging | `info` | Normal operations |
| Production | `info` | Balance detail/noise |
| High Traffic | `warn` | Reduce log volume |

## Searching Logs

### Using grep (simple text search)

```bash
# Search for errors
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log

# Search for specific user
docker exec mobifaktura_app grep '"userId":"123"' /app/logs/app.log

# Search for auth events
docker exec mobifaktura_app grep '"module":"auth"' /app/logs/app.log

# Last 50 errors
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log | tail -n 50
```

### Using jq (JSON parsing)

```bash
# Pretty print recent logs
docker exec mobifaktura_app tail -n 100 /app/logs/app.log | jq '.'

# Filter by log level
docker exec mobifaktura_app cat /app/logs/app.log | jq 'select(.level == "error")'

# Filter by module
docker exec mobifaktura_app cat /app/logs/app.log | jq 'select(.module == "auth")'

# Filter by user
docker exec mobifaktura_app cat /app/logs/app.log | jq 'select(.userId == "123")'

# Get all error messages
docker exec mobifaktura_app cat /app/logs/error.log | jq -r '.msg'
```

### Using PowerShell (Windows)

```powershell
# View logs
docker exec mobifaktura_app cat /app/logs/app.log | ConvertFrom-Json | Format-Table

# Filter errors
docker exec mobifaktura_app cat /app/logs/app.log | ConvertFrom-Json | Where-Object level -eq 'error'

# Search for user
docker exec mobifaktura_app cat /app/logs/app.log | ConvertFrom-Json | Where-Object userId -eq '123'
```

## Log Analysis

### Common Tasks

**Count errors in last hour:**
```bash
# Linux/Mac
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log | \
  grep "$(date -u -d '1 hour ago' '+%Y-%m-%d')" | wc -l

# Windows PowerShell
(docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log).Count
```

**Find slowest requests:**
```bash
docker exec mobifaktura_app cat /app/logs/app.log | \
  jq 'select(.type == "request") | {duration, procedure, userId}' | \
  sort -k1 -r | head -n 10
```

**Track user activity:**
```bash
docker exec mobifaktura_app grep '"userId":"123"' /app/logs/app.log | \
  jq '{time, action: .type, procedure}'
```

**Monitor failed logins:**
```bash
docker exec mobifaktura_app grep '"action":"failed-login"' /app/logs/app.log | \
  jq '{time, ip, userId}'
```

## Log Retention & Rotation

### Manual Log Rotation

Logs grow over time. Rotate them periodically:

```bash
# Backup current logs
docker exec mobifaktura_app cp /app/logs/app.log /app/logs/app.log.$(date +%Y%m%d)
docker exec mobifaktura_app cp /app/logs/error.log /app/logs/error.log.$(date +%Y%m%d)

# Clear current logs
docker exec mobifaktura_app sh -c "> /app/logs/app.log"
docker exec mobifaktura_app sh -c "> /app/logs/error.log"
```

### Automatic Rotation (Linux cron)

Add to host crontab:
```bash
# Rotate logs daily at 2 AM
0 2 * * * docker exec mobifaktura_app sh -c "cp /app/logs/app.log /app/logs/app.log.\$(date +\%Y\%m\%d) && > /app/logs/app.log"

# Delete logs older than 30 days
0 3 * * * docker exec mobifaktura_app find /app/logs -name "*.log.*" -mtime +30 -delete
```

### Check Log Size

```bash
# Check log file sizes
docker exec mobifaktura_app du -h /app/logs

# Monitor disk usage
docker exec mobifaktura_app df -h /app/logs
```

## Performance Impact

### Pino Logger

- **Latency**: < 1ms per log
- **Memory**: ~10-20 MB
- **CPU**: Negligible (async I/O)
- **Disk**: ~10-50 MB per day (typical usage)

### Optimization Tips

1. **Use appropriate log levels** - Don't log debug in production
2. **Avoid logging in loops** - Aggregate data first
3. **Use sampling** - Log 1 in N high-volume events
4. **Set retention limits** - Don't keep logs forever

## Troubleshooting

### No Logs Appearing

**Check app is running:**
```bash
docker ps | grep mobifaktura_app
```

**Check log directory exists:**
```bash
docker exec mobifaktura_app ls -la /app/logs
```

**Check permissions:**
```bash
docker exec mobifaktura_app ls -la /app/logs/app.log
```

### High Disk Usage

**Check log size:**
```bash
docker exec mobifaktura_app du -sh /app/logs
```

**Clear logs:**
```bash
docker exec mobifaktura_app sh -c "> /app/logs/app.log"
docker exec mobifaktura_app sh -c "> /app/logs/error.log"
```

### Can't Read Logs

**If jq not installed in container:**
```bash
# Copy logs to host first
docker cp mobifaktura_app:/app/logs ./logs

# Then use jq locally
cat logs/app.log | jq '.'
```

## Production Checklist

- [ ] Set `LOG_LEVEL=info` or `warn` in production
- [ ] Set up log rotation (manual or automated)
- [ ] Monitor disk usage regularly
- [ ] Back up important logs
- [ ] Set up alerts for critical errors (external monitoring)
- [ ] Document log file locations for team
- [ ] Test log access and search commands
- [ ] Plan log retention policy (e.g., 30 days)

## Security

### Sensitive Data Redaction

Automatically redacted fields:
- `password`
- `token`
- `accessToken`
- `refreshToken`
- `authorization`
- `cookie`

**Add custom redactions** in `src/lib/logger.ts`:

```typescript
redact: {
  paths: [
    'password',
    'ssn',
    'creditCard',
    // Add more sensitive fields
  ],
  censor: '[REDACTED]',
}
```

### Access Control

**Log files are accessible via:**
- Docker exec (requires Docker access)
- Volume mounts (requires host file system access)
- Copy to host (docker cp command)

**Security notes:**
- Logs contain sensitive data - restrict access
- Use `docker cp` to share logs with authorized personnel
- Consider encrypting log backups

## Backup Logs

### Copy Logs to Host

```bash
# Copy entire logs directory
docker cp mobifaktura_app:/app/logs ./logs_backup_$(date +%Y%m%d)

# Copy specific log file
docker cp mobifaktura_app:/app/logs/app.log ./app_log_backup.json
```

### Backup Log Volume

```bash
# Backup entire log volume
docker run --rm \
  -v mobifaktura_app_logs:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/logs_backup_$(date +%Y%m%d).tar.gz /data

# Windows PowerShell
docker run --rm -v mobifaktura_app_logs:/data -v ${PWD}:/backup alpine tar czf /backup/logs_backup.tar.gz /data
```

### Restore Logs

```bash
# Extract backup to volume
docker run --rm \
  -v mobifaktura_app_logs:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/logs_backup.tar.gz -C /
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |
| `NODE_ENV` | - | Environment (production/development) - affects log format |

## Architecture Details

### Log Flow

1. **Application** → Writes logs via Pino
2. **Development** → Pretty formatted to console
3. **Production** → JSON to console + file destinations
   - All logs → `/app/logs/app.log`
   - Errors → `/app/logs/error.log`

### Storage

- **Log files**: `/app/logs` inside container
- **Docker volume**: `mobifaktura_app_logs`
- **Host access**: Via `docker cp` or `docker exec`

### Log Format

**Development (console):**
```
[14:23:45] INFO: User logged in
    userId: "123"
    action: "login"
```

**Production (JSON):**
```json
{"level":"info","time":"2025-12-11T14:23:45.123Z","service":"mobifaktura","env":"production","userId":"123","action":"login","msg":"User logged in"}
```

## Resources

- [Pino Documentation](https://getpino.io)
- [JSON Query with jq](https://stedolan.github.io/jq/)
- [Docker Logs](https://docs.docker.com/engine/reference/commandline/logs/)

## Quick Commands Reference

```bash
# View real-time logs
docker logs mobifaktura_app -f

# View log files
docker exec mobifaktura_app cat /app/logs/app.log
docker exec mobifaktura_app cat /app/logs/error.log

# Search logs
docker exec mobifaktura_app grep "error" /app/logs/app.log

# Copy logs to host
docker cp mobifaktura_app:/app/logs ./logs

# Check log size
docker exec mobifaktura_app du -sh /app/logs

# Clear logs
docker exec mobifaktura_app sh -c "> /app/logs/app.log"
```

---

📖 **See Also**:
- `docs/MONITORING.md` - Health checks and Sentry
- `docs/LOGGING_QUICKREF.md` - Quick reference
