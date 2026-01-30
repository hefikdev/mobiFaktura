# mobiFaktura - Deployment Guide

**Version:** 1.0  
**Last Updated:** January 29, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Development Setup](#development-setup)
4. [Production Deployment](#production-deployment)
5. [Docker Configuration](#docker-configuration)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [SeaweedFS S3 Setup](#seaweedfs-s3-setup)
9. [Health Checks & Monitoring](#health-checks--monitoring)
10. [Backup & Recovery](#backup--recovery)
11. [Troubleshooting](#troubleshooting)
12. [Performance Tuning](#performance-tuning)

---

## Overview

mobiFaktura is deployed using Docker Compose with three main services:
- **Next.js Application** (app)
- **PostgreSQL Database** (postgres)
- **SeaweedFS S3 Object Storage** (seaweedfs cluster)

The application is designed to be production-ready with health checks, automatic restarts, and comprehensive logging.

---

## Prerequisites

### Required Software

- **Docker**: 24.0+ with Docker Compose V2
- **Node.js**: 20+ (for local development)
- **npm**: 10+ (comes with Node.js)

### System Requirements

**Minimum:**
- 2 CPU cores
- 4 GB RAM
- 20 GB storage

**Recommended:**
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB SSD storage

### Network Requirements

**Ports:**
- 3000: Next.js application
- 5432: PostgreSQL (can be firewalled)
- 9000: SeaweedFS S3 API (internal)
- 9333: SeaweedFS Master (internal)
- 8080: SeaweedFS Volume (internal)
- 8888: SeaweedFS Filer (internal)

**Domain Requirements (Production):**
- Valid domain name
- SSL certificate (Let's Encrypt recommended)
- DNS configured

---

## Development Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd mobiFaktura
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` file in project root:

```env
# Node Environment
NODE_ENV=development

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://mobifaktura:mobifaktura@postgres:5432/mobifaktura

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-secure-random-secret-here-min-32-chars

# Cookie Configuration
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# SeaweedFS S3 Configuration
S3_ENDPOINT=seaweedfs-s3
S3_PORT=9000
S3_ACCESS_KEY=mobifaktura_s3_internal
S3_SECRET_KEY=mobifaktura_s3_secret_key_2026
S3_USE_SSL=false
S3_BUCKET=invoices

# Logging
LOG_LEVEL=info
```

### 4. Start Services

```bash
# Start database and SeaweedFS
docker-compose -f docker-compose.dev.yaml up -d postgres seaweedfs-master seaweedfs-volume seaweedfs-filer seaweedfs-s3

# Wait for services to be ready (30 seconds)
sleep 30

# Push database schema
npm run db:push

# Seed test data (optional)
npm run db:seed

# Start development server
npm run dev
```

### 5. Access Application

- **Application**: http://localhost:3000
- **SeaweedFS Master UI**: http://localhost:9333
  - Access via S3-compatible tools or API

### Test Accounts (After Seeding)

- **User**: `user@test.pl` / `TestUser123!`
- **Accountant**: `ksiegowy@test.pl` / `TestAccountant123!`
- **Admin**: `admin@test.pl` / `TestAdmin123!`

---

## Production Deployment

### 1. Server Setup

**Recommended:**
- Ubuntu 22.04 LTS or newer
- Docker installed
- Firewall configured (UFW)
- Fail2ban for brute force protection
- Reverse proxy (Nginx or Traefik) for SSL

### 2. Production Environment File

Create `.env.production`:

```env
# Node Environment
NODE_ENV=production

# Application URL (MUST be your domain)
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Database (use strong password!)
DATABASE_URL=postgresql://mobifaktura:<STRONG_PASSWORD>@postgres:5432/mobifaktura
POSTGRES_USER=mobifaktura
POSTGRES_PASSWORD=<STRONG_PASSWORD>
POSTGRES_DB=mobifaktura

# JWT Secret (CRITICAL: Generate secure value)
# Generate with: openssl rand -base64 64
JWT_SECRET=<YOUR_SECURE_64_CHAR_RANDOM_STRING>

# Cookie Configuration
COOKIE_DOMAIN=yourdomain.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax

# SeaweedFS S3 Configuration (use strong credentials!)
S3_ENDPOINT=seaweedfs-s3
S3_PORT=9000
S3_ACCESS_KEY=<STRONG_USERNAME>
S3_SECRET_KEY=<STRONG_PASSWORD>
S3_USE_SSL=false
S3_BUCKET=invoices

# Logging
LOG_LEVEL=warn
LOG_FILE=/app/logs/app.log

# Optional: Sentry for error tracking
# SENTRY_DSN=your-sentry-dsn
```

**Security Checklist:**
- ✅ Use strong, unique passwords (20+ chars)
- ✅ JWT_SECRET must be cryptographically random
- ✅ Never commit `.env.production` to git
- ✅ Set proper file permissions: `chmod 600 .env.production`
- ✅ Enable COOKIE_SECURE=true in production
- ✅ Use proper domain (not localhost)

### 3. Build and Deploy

```bash
# Copy production env
cp .env.production .env

# Start services
docker-compose up -d

# Wait for database to be ready
docker-compose exec postgres pg_isready -U mobifaktura

# Run migrations (first time only)
docker-compose exec app npm run db:push

# Check health
docker-compose ps
docker-compose logs -f app
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# Should show:
# ✓ app (healthy)
# ✓ postgres (healthy)
# ✓ seaweedfs (healthy)

# Test application
curl https://yourdomain.com/api/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

---

## Docker Configuration

### docker-compose.yml (Production)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: mobifaktura_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - mobifaktura_network

  # SeaweedFS Master
  seaweedfs-master:
    image: chrislusf/seaweedfs:4.07
    container_name: mobifaktura_seaweedfs_master
    restart: unless-stopped
    command: "master -ip=seaweedfs-master -port=9333"
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:9333/cluster/status"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mobifaktura_network

  # SeaweedFS Volume
  seaweedfs-volume:
    image: chrislusf/seaweedfs:4.07
    container_name: mobifaktura_seaweedfs_volume
    restart: unless-stopped
    command: "volume -mserver=seaweedfs-master:9333 -port=8080 -max=100"
    depends_on:
      - seaweedfs-master
    volumes:
      - seaweedfs_data:/data
    networks:
      - mobifaktura_network

  # SeaweedFS Filer
  seaweedfs-filer:
    image: chrislusf/seaweedfs:4.07
    container_name: mobifaktura_seaweedfs_filer
    restart: unless-stopped
    command: "filer -master=seaweedfs-master:9333"
    depends_on:
      - seaweedfs-master
      - seaweedfs-volume
    networks:
      - mobifaktura_network

  # SeaweedFS S3
  seaweedfs-s3:
    image: chrislusf/seaweedfs:4.07
    container_name: mobifaktura_seaweedfs_s3
    restart: unless-stopped
    command: "s3 -filer=seaweedfs-filer:8888 -config=/etc/seaweedfs/s3.config.json"
    depends_on:
      - seaweedfs-filer
    volumes:
      - ./dev_data/seaweedfs/s3.config.json:/etc/seaweedfs/s3.config.json:ro
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:9000/"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mobifaktura_network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: mobifaktura_app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      seaweedfs-s3:
        condition: service_healthy
    environment:
      NODE_ENV: ${NODE_ENV}
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_PORT: ${S3_PORT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_USE_SSL: ${S3_USE_SSL}
      S3_BUCKET: ${S3_BUCKET}
    ports:
      - "3000:3000"
    volumes:
      - app_logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - mobifaktura_network

volumes:
  postgres_data:
  seaweedfs_data:
  app_logs:

networks:
  mobifaktura_network:
    driver: bridge
```

### Dockerfile (Multi-stage Build)

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create logs directory
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
```

---

## Environment Variables

### Critical Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | ✅ | Environment mode | `production` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public application URL | `https://yourdomain.com` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | ✅ | Session encryption key (32+ chars) | Generated with `openssl` |
| `COOKIE_DOMAIN` | ✅ | Cookie domain | `yourdomain.com` |
| `S3_ACCESS_KEY` | ✅ | SeaweedFS S3 username | `mobifaktura_s3_internal` |
| `S3_SECRET_KEY` | ✅ | SeaweedFS S3 password | Strong password |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `COOKIE_SECURE` | `true` | HTTPS-only cookies |
| `COOKIE_SAMESITE` | `lax` | Cookie SameSite policy |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `LOG_FILE` | - | Log file path |
| `S3_USE_SSL` | `false` | Enable SSL for SeaweedFS |

### Generating Secrets

```bash
# JWT Secret (64 chars recommended)
openssl rand -base64 64

# Strong password (32 chars)
openssl rand -base64 32

# UUID (for reference IDs)
uuidgen
```

---

## Database Setup

### Initial Setup

```bash
# Push schema (first time)
docker-compose exec app npm run db:push

# Or run migrations
docker-compose exec app npm run db:migrate
```

### Create Seed Data

```bash
# Run seed script
docker-compose exec app npm run db:seed
```

Creates:
- 1 admin user
- 1 accountant user
- 5 regular users
- 3 companies
- Sample invoices and budget requests

### Database Management

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U mobifaktura -d mobifaktura

# Backup database
docker-compose exec postgres pg_dump -U mobifaktura mobifaktura > backup.sql

# Restore database
docker-compose exec -T postgres psql -U mobifaktura mobifaktura < backup.sql

# View database size
docker-compose exec postgres psql -U mobifaktura -d mobifaktura -c "
  SELECT pg_size_pretty(pg_database_size('mobifaktura')) AS size;
"
```

### Database Maintenance

**Automated Cleanup (Runs Daily at 1:00 AM):**
- Expired sessions
- Old login logs (30+ days)
- Old login attempts (30+ days)
- Read notifications (2+ days)

**Manual Maintenance:**
```bash
# Vacuum database (reclaim space)
docker-compose exec postgres psql -U mobifaktura -d mobifaktura -c "VACUUM ANALYZE;"

# Reindex (improve performance)
docker-compose exec postgres psql -U mobifaktura -d mobifaktura -c "REINDEX DATABASE mobifaktura;"
```

---

## SeaweedFS S3 Setup

### Initial Configuration

SeaweedFS is auto-configured on first start:
1. Creates bucket: `invoices`
2. Sets bucket policy: private with authentication
3. Configured via s3.config.json

### Accessing SeaweedFS Master UI

**URL:** http://your-server:9333

**Features:**
- Cluster status and monitoring
- Volume management
- System topology

### Backup SeaweedFS Data

```bash
# Backup all S3 data using volume backup
docker run --rm -v mobifaktura_seaweedfs_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/seaweedfs-backup.tar.gz /data
```

### Restore SeaweedFS Data

```bash
# Restore from volume backup
docker run --rm -v mobifaktura_seaweedfs_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/seaweedfs-backup.tar.gz -C /
```

---

## Health Checks & Monitoring

### Application Health Endpoint

**URL:** `/api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "storage": "connected"
}
```

### Docker Health Checks

```bash
# Check all services health
docker-compose ps

# View health check logs
docker inspect mobifaktura_app | grep -A10 Health

# Manual health check
curl http://localhost:3000/api/health
```

### Logging

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 app

# Application logs (in container)
docker-compose exec app tail -f /app/logs/app.log
```

**Log Rotation:**

Configure in Docker Compose:
```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Monitoring Tools (Optional)

**Recommended:**
- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **Loki**: Log aggregation
- **cAdvisor**: Container metrics
- **Uptime Kuma**: Uptime monitoring

---

## Backup & Recovery

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups
COMPOSE_FILE=/path/to/mobiFaktura/docker-compose.yml

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f $COMPOSE_FILE exec -T postgres \
  pg_dump -U mobifaktura mobifaktura | \
  gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Backup SeaweedFS S3 data
docker run --rm \
  -v mobifaktura_seaweedfs_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/seaweedfs_backup_$DATE.tar.gz /data

# Backup .env file
cp /path/to/mobiFaktura/.env $BACKUP_DIR/env_backup_$DATE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*backup*" -mtime +30 -delete

echo "Backup completed: $DATE"
```

**Schedule with Cron:**
```bash
# Edit crontab
crontab -e

# Run daily at 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/mobifaktura-backup.log 2>&1
```

### Recovery Procedure

```bash
# 1. Stop application
docker-compose down

# 2. Restore database
gunzip -c db_backup_20260129_020000.sql.gz | \
  docker-compose exec -T postgres psql -U mobifaktura mobifaktura

# 3. Restore SeaweedFS S3 data
docker run --rm \
  -v mobifaktura_seaweedfs_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/seaweedfs_backup_20260129_020000.tar.gz -C /

# 4. Restore environment
cp env_backup_20260129_020000 .env

# 5. Start application
docker-compose up -d

# 6. Verify
docker-compose ps
curl http://localhost:3000/api/health
```

---

## Troubleshooting

### Application Won't Start

**Check logs:**
```bash
docker-compose logs app
```

**Common issues:**
- JWT_SECRET missing or too short
- DATABASE_URL incorrect
- SeaweedFS credentials mismatch
- Port 3000 already in use

**Solutions:**
```bash
# Verify environment
docker-compose config

# Restart services
docker-compose restart

# Rebuild if needed
docker-compose build --no-cache app
docker-compose up -d
```

### Database Connection Errors

**Check PostgreSQL:**
```bash
# Is it running?
docker-compose ps postgres

# Can we connect?
docker-compose exec postgres pg_isready -U mobifaktura

# Check logs
docker-compose logs postgres
```

**Test connection:**
```bash
docker-compose exec app npx tsx -e "
const { db } = require('./src/server/db');
db.select().from(require('./src/server/db/schema').users).limit(1).then(console.log);
"
```

### SeaweedFS Issues

**Check SeaweedFS:**
```bash
# Is it running?
docker-compose ps seaweedfs-s3

# Access master UI
# Open http://localhost:9333

# Check bucket exists using AWS CLI
aws s3 ls --endpoint-url http://localhost:9000
```

**Recreate bucket:**
```bash
aws s3 mb s3://invoices --endpoint-url http://localhost:9000
```

### Session/Cookie Issues

**Symptoms:**
- Can't log in
- Logged out immediately
- "Unauthorized" errors

**Fixes:**
1. Check COOKIE_DOMAIN matches your domain
2. Clear browser cookies
3. Verify JWT_SECRET is set
4. Check session expiration in database:
```sql
SELECT * FROM sessions WHERE expires_at < NOW();
DELETE FROM sessions WHERE expires_at < NOW();
```

### Performance Issues

**Check resource usage:**
```bash
docker stats

# Should show CPU, memory, network for each container
```

**Optimize:**
1. Increase Docker memory limit
2. Add database indexes (see Performance Tuning)
3. Enable caching
4. Review slow queries in logs

### Disk Space Issues

**Check usage:**
```bash
# Docker volumes
docker system df -v

# Specific volumes
du -sh /var/lib/docker/volumes/mobifaktura_*

# SeaweedFS storage
docker exec mobifaktura_seaweedfs_master wget -qO- http://localhost:9333/vol/status
```

**Clean up:**
```bash
# Remove old logs
docker-compose exec app rm -f /app/logs/*.log.old

# Prune Docker
docker system prune -a --volumes

# Database vacuum
docker-compose exec postgres psql -U mobifaktura -d mobifaktura -c "VACUUM FULL;"
```

---

## Performance Tuning

### Database Optimization

**PostgreSQL Configuration:**

Create `postgres/postgresql.conf`:
```conf
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 64MB

# Checkpoints
checkpoint_timeout = 10min
checkpoint_completion_target = 0.9

# WAL
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB

# Query Planning
random_page_cost = 1.1
effective_io_concurrency = 200
```

Mount in docker-compose.yml:
```yaml
postgres:
  volumes:
    - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### Application Optimization

**Next.js Production Build:**
```json
// next.config.ts
{
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  swcMinify: true,
}
```

**Enable Caching:**
```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      cacheTime: 10 * 60 * 1000,     // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

### Reverse Proxy (Nginx)

**nginx.conf:**
```nginx
upstream mobifaktura {
  server localhost:3000;
  keepalive 64;
}

server {
  listen 80;
  server_name yourdomain.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  client_max_body_size 10M;

  location / {
    proxy_pass http://mobifaktura;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  # Cache static assets
  location /_next/static/ {
    proxy_pass http://mobifaktura;
    proxy_cache_valid 200 60m;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## Security Best Practices

### 1. Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct access to services
ufw deny 5432/tcp
ufw deny 3900/tcp
ufw deny 3902/tcp

# Enable firewall
ufw enable
```

### 2. Fail2Ban

Install and configure:
```bash
apt install fail2ban

# Create jail for app
cat > /etc/fail2ban/jail.d/mobifaktura.conf <<EOF
[mobifaktura]
enabled = true
port = 80,443
filter = mobifaktura
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
EOF
```

### 3. Regular Updates

```bash
# Update system packages
apt update && apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Rebuild app
docker-compose build app
docker-compose up -d app
```

### 4. SSL Certificates

**Using Let's Encrypt:**
```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d yourdomain.com

# Auto-renewal (already configured)
systemctl status certbot.timer
```

---

## Scaling

### Horizontal Scaling

For high traffic, deploy multiple app instances behind a load balancer.

**Requirements:**
- Shared PostgreSQL database
- Shared SeaweedFS storage
- Session store in database (already configured)
- Load balancer (Nginx/HAProxy/Traefik)

### Vertical Scaling

Increase resources:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
  
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

---

## Conclusion

You now have a comprehensive guide to deploying and managing mobiFaktura in production.

**Key Takeaways:**
- Always use strong, unique secrets
- Enable HTTPS in production
- Set up automated backups
- Monitor application health
- Keep software updated
- Review logs regularly

For support, refer to:
- [FEATURES.md](FEATURES.md) - Feature documentation
- [API.md](API.md) - API reference
- [MONITORING.md](MONITORING.md) - Monitoring details

**Happy deploying! 🚀**
