# Monitoring Quick Reference

## Health Check

```bash
# Check application health
curl http://localhost:3000/api/health

# Check with headers
curl -i http://localhost:3000/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-12-11T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": "healthy",
    "storage": "healthy"
  }
}
```

## Docker Health

```bash
# View container health status
docker ps

# Inspect health checks
docker inspect mobifaktura_app | grep -A 10 Health

# View health logs
docker inspect --format='{{json .State.Health}}' mobifaktura_app | jq

# Restart unhealthy container
docker-compose restart app
```

## Sentry Setup (Optional)

**1. Get DSN from https://sentry.io**

**2. Add to `.env`:**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]
```

**3. Rebuild:**
```bash
docker-compose up -d --build
```

**4. Verify:**
- Errors appear in Sentry dashboard
- Performance data collected

## Uptime Monitoring

**Add these monitors:**
- **URL**: `https://yourdomain.com/api/health`
- **Method**: GET
- **Expected**: 200 status code
- **Expected content**: `"status":"healthy"`
- **Interval**: 5 minutes

**Recommended services:**
- UptimeRobot (free)
- Pingdom
- Better Uptime

## Load Balancer Config

**Nginx:**
```nginx
upstream backend {
  server app:3000;
  health_check uri=/api/health interval=30s;
}
```

**HAProxy:**
```haproxy
backend mobifaktura
  option httpchk GET /api/health
  http-check expect status 200
  server app1 app:3000 check inter 30s
```

## Troubleshooting

```bash
# App logs
docker logs -f mobifaktura_app

# Health check test
docker exec mobifaktura_app wget -O- http://localhost:3000/api/health

# Database test
docker exec mobifaktura_postgres psql -U mobifaktura -c "SELECT 1"

# MinIO test
docker exec mobifaktura_minio mc admin info local
```

## Quick Status Check

```bash
# All services
docker-compose ps

# Health endpoint
curl -s http://localhost:3000/api/health | jq

# Container health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

📖 **Full Documentation:** See `docs/MONITORING.md`
