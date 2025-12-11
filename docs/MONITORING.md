# Application Monitoring

This document explains the application health monitoring setup for mobiFaktura.

## Overview

The application includes monitoring with:
- **Health Checks**: `/api/health` endpoint for load balancers and uptime monitoring
- **Docker Health Checks**: Container-level health verification
- **Error Boundaries**: React error catching with user-friendly fallbacks
- **Structured Logging**: Pino logger for error tracking and debugging

## Architecture

```
┌─────────────────────────────────────────────┐
│         Monitoring Stack                    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐                          │
│  │ /api/health  │◄─── Load Balancers       │
│  │   Endpoint   │     Uptime Monitors      │
│  └──────────────┘                          │
│                                             │
│  ┌──────────────┐                          │
│  │   Docker     │◄─── Container Health     │
│  │ Healthcheck  │     Auto-restart         │
│  └──────────────┘                          │
│                                             │
│  ┌──────────────┐                          │
│  │   Logging    │◄─── Error Tracking       │
│  │  (Pino)      │     Performance          │
│  └──────────────┘                          │
│                                             │
└─────────────────────────────────────────────┘
```

## Features

### 1. Health Check Endpoint

**URL**: `/api/health`

**Purpose**: 
- Load balancer health checks
- Uptime monitoring
- Service status verification
- Infrastructure monitoring

**Response** (Healthy):
```json
{
  "status": "healthy",
  "timestamp": "2025-12-11T10:30:00.000Z",
  "uptime": 3600,
  "responseTime": "15ms",
  "checks": {
    "database": "healthy",
    "storage": "healthy"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

**Response** (Unhealthy):
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-11T10:30:00.000Z",
  "error": "Connection refused",
  "checks": {
    "database": "failed"
  }
}
```

**HTTP Status Codes**:
- `200` - All systems operational
- `503` - Service unavailable (database connection failed)

**Usage Examples**:

```bash
# Manual check
curl http://localhost:3000/api/health

# With load balancer (nginx example)
upstream mobifaktura {
  server app:3000;
  health_check uri=/api/health interval=30s;
}

# Uptime monitoring (UptimeRobot, Pingdom, etc.)
# Monitor: http://yourdomain.com/api/health
# Expected status: 200
# Check interval: 5 minutes
```

### 2. Docker Health Checks

**Configuration** (docker-compose.yml):
```yaml
app:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

**Behavior**:
- Checks health every 30 seconds
- Waits 40 seconds after container start before first check
- Fails after 3 consecutive failures
- Auto-restarts unhealthy containers (with `restart: unless-stopped`)

**Commands**:
```bash
# Check container health
docker ps
# Look for "healthy" or "unhealthy" in STATUS column

# View health check logs
docker inspect mobifaktura_app | grep -A 10 Health

# Manual health check
docker exec mobifaktura_app wget --spider http://localhost:3000/api/health
```

### 3. Error Logging

**Features**:
- ✅ Structured JSON logging with Pino
- ✅ Separate error logs
- ✅ Request/response logging
- ✅ Performance tracking
- ✅ User action tracking
- ✅ File-based persistence

**What Gets Logged**:
- JavaScript errors (client-side)
- Server errors (API routes, tRPC)
- React component errors (via Error Boundary)
- Performance metrics (request duration)
- Authentication events
- Database operations
- Cron job execution

See `docs/LOGGING.md` for complete logging documentation.

## Setup

### Health Check Endpoint

**No configuration needed** - works out of the box!

The `/api/health` endpoint is automatically available when you start the application.

The health endpoint is available at `/api/health` immediately after deployment.

## Monitoring Integrations

### Load Balancer Integration

**Nginx Example**:
```nginx
upstream mobifaktura_backend {
  server app:3000 max_fails=3 fail_timeout=30s;
  
  # Health check (requires nginx-plus or third-party module)
  health_check uri=/api/health interval=30s;
}

server {
  listen 443 ssl;
  server_name yourdomain.com;
  
  location / {
    proxy_pass http://mobifaktura_backend;
    proxy_set_header Host $host;
  }
}
```

**HAProxy Example**:
```haproxy
backend mobifaktura
  option httpchk GET /api/health
  http-check expect status 200
  server app1 app:3000 check inter 30s
```

### Uptime Monitoring Services

**UptimeRobot**:
1. Add new monitor
2. Type: HTTP(s)
3. URL: `https://yourdomain.com/api/health`
4. Interval: 5 minutes
5. Alert: Email/SMS when down

**Pingdom**:
1. Add new check
2. Type: HTTP
3. URL: `https://yourdomain.com/api/health`
4. Expected status: 200
5. Check interval: 1-5 minutes

**Better Uptime**:
1. Create new monitor
2. URL: `https://yourdomain.com/api/health`
3. Expected content: `"status":"healthy"`
4. Check frequency: 1 minute
5. Alert channels: Email, Slack, etc.

## Error Boundary

### How It Works

The `ErrorBoundary` component wraps the entire application and catches React errors:

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**What It Catches**:
- ✅ Render errors in React components
- ✅ Lifecycle method errors
- ✅ Constructor errors in child components
- ❌ Event handler errors (use try-catch)
- ❌ Async errors (use try-catch)
- ❌ Server-side errors (logged separately)

**When Error Occurs**:
1. Error is caught by boundary
2. Error logged to file (see `logs/error.log`)
3. User sees friendly error message
4. User can reload page to recover
5. In development: error details shown

### Custom Error UI

The default error screen shows:
- ⚠️ "Coś poszło nie tak" (Something went wrong)
- User-friendly message
- Reload button
- Error details (development only)

To customize, edit `src/components/error-boundary.tsx`.

## Monitoring Best Practices

### 1. Set Appropriate Alerts

**Uptime Monitoring Alerts**:
- Downtime: > 1 minute
- High response time: > 5 seconds
- Failed health checks: 3 consecutive failures

### 2. Monitor Key Metrics

**Application**:
- Error rate (errors/hour)
- P50, P95, P99 response times
- Uptime percentage
- Database query performance

**Infrastructure**:
- Container health status
- CPU/Memory usage
- Disk space (especially for backups)
- Network latency

### 3. Regular Health Checks

```bash
# Daily check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/api/health)

if [ "$response" != "200" ]; then
  echo "⚠️ Health check failed: HTTP $response"
  # Send alert (email, Slack, etc.)
fi
```

### 4. Review Error Trends

Weekly review:
- Most common errors
- Users most affected
- Performance bottlenecks
- Error patterns/trends

## Troubleshooting

### Health Check Fails

**Check 1: Test endpoint manually**
```bash
curl http://localhost:3000/api/health
```

**Check 2: Verify database connection**
```bash
docker exec mobifaktura_app node -e "
  const { db } = require('./dist/server/db');
  db.execute('SELECT 1').then(() => console.log('DB OK')).catch(console.error);
"
```

**Check 3: Review logs**
```bash
docker logs mobifaktura_app
# Or check log files
docker exec mobifaktura_app cat /app/logs/error.log
```

### Docker Container Unhealthy

**Check 1: View health check logs**
```bash
docker inspect --format='{{json .State.Health}}' mobifaktura_app | jq
```

**Check 2: Manual health check**
```bash
docker exec mobifaktura_app wget -O- http://localhost:3000/api/health
```

**Check 3: Restart container**
```bash
docker-compose restart app
```

## Performance Impact

### Health Checks
- **CPU**: Negligible (< 0.1%)
- **Memory**: < 1MB
- **Network**: Minimal (internal only)
- **Latency**: < 50ms per check

### Error Boundary
- **Performance**: Zero overhead when no errors
- **Bundle Size**: < 5KB

## Summary

✅ **Health Endpoint**: `/api/health` for load balancers  
✅ **Docker Health**: Auto-restart unhealthy containers  
✅ **Error Logging**: Structured logging with Pino  
✅ **Error Boundaries**: User-friendly error handling  
✅ **Production Ready**: Tested and documented  

The monitoring system provides visibility into application health and errors with minimal setup required.

## Quick Commands

```bash
# Check health
curl http://localhost:3000/api/health

# View container health
docker ps

# Check health logs
docker inspect mobifaktura_app | grep -A 10 Health

# Restart unhealthy container
docker-compose restart app

# Check error logs
docker exec mobifaktura_app cat /app/logs/error.log
```

## Next Steps

1. **Set Up Uptime Monitoring**:
   - Use UptimeRobot, Pingdom, or Better Uptime
   - Monitor `/api/health` endpoint
   - Configure alert notifications

3. **Configure Load Balancer**:
   - Add health check to nginx/HAProxy
   - Set appropriate intervals and thresholds
   - Test failover behavior

4. **Review Logs Regularly**:
   - Check error logs weekly: `docker exec mobifaktura_app cat /app/logs/error.log`
   - Monitor uptime percentage
   - Review performance metrics in logs

For more information, see [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md) for backup monitoring.
