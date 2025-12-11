# Logging System - README Snippet

Add this section to your main README.md:

---

## 📊 Logging

### Structured Logging

The application uses **Pino** for fast, structured JSON logging.

**Features:**
- 🔍 JSON logs in production for machine parsing
- 🎨 Pretty-formatted logs in development
- 🔒 Automatic redaction of sensitive data
- 📦 Module-based loggers
- ⚡ < 1ms per log overhead
- 💾 Persistent file storage

### Log Output

- **Console** - Real-time via `docker logs`
- **Files** - Persistent in `/app/logs` directory
  - `app.log` - All logs
  - `error.log` - Errors only

### Quick Start

```bash
# View real-time logs
docker logs mobifaktura_app -f

# View log files
docker exec mobifaktura_app cat /app/logs/app.log
docker exec mobifaktura_app cat /app/logs/error.log

# Copy logs to host
docker cp mobifaktura_app:/app/logs ./logs
```

### Using the Logger

```typescript
import { logger, authLogger, dbLogger } from '@/lib/logger';

// Basic logging
logger.info('User created invoice');
logger.error('Payment processing failed');

// Structured logging
logger.info({
  userId: '123',
  action: 'create_invoice',
  invoiceId: 'INV-001',
  amount: 1500.50,
});

// Module-specific loggers
authLogger.info({ action: 'login', userId: '123' });
dbLogger.info({ operation: 'insert', table: 'invoices' });
```

### Searching Logs

```bash
# Find errors
docker exec mobifaktura_app grep '"level":"error"' /app/logs/app.log

# Find user activity
docker exec mobifaktura_app grep '"userId":"123"' /app/logs/app.log

# Check log size
docker exec mobifaktura_app du -sh /app/logs
```

### Environment Variables

```env
# Logging configuration
LOG_LEVEL=info  # debug, info, warn, error
```

### Documentation

- **Full Guide**: [`docs/LOGGING.md`](docs/LOGGING.md)
- **Quick Reference**: [`docs/LOGGING_QUICKREF.md`](docs/LOGGING_QUICKREF.md)

---
