# Automated Backup System - mobiFaktura

This document describes the automated backup system for PostgreSQL database and MinIO object storage.

## Overview

The backup system consists of:
- **PostgreSQL Backup**: Daily compressed SQL dumps
- **MinIO Backup**: Daily mirror of file storage buckets
- **Automated Scheduling**: Cron-based execution
- **Retention Policy**: 30 days (configurable)
- **Docker Integration**: Dedicated backup service container

## Architecture

```
┌─────────────────────────────────────────────┐
│         Docker Compose Stack                │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐    ┌──────────┐             │
│  │PostgreSQL│◄───│  Backup  │             │
│  │   DB     │    │ Service  │             │
│  └──────────┘    │          │             │
│                  │  (cron)  │             │
│  ┌──────────┐    │          │             │
│  │  MinIO   │◄───│          │             │
│  │ Storage  │    └────┬─────┘             │
│  └──────────┘         │                    │
│                       │                    │
│                       ▼                    │
│              ┌─────────────────┐           │
│              │  /backups/      │           │
│              │  - postgres/    │           │
│              │  - minio/       │           │
│              └─────────────────┘           │
└─────────────────────────────────────────────┘
```

## Features

### PostgreSQL Backup
- ✅ **Compressed Backups**: gzip compression for space efficiency
- ✅ **Incremental Naming**: Timestamp-based file names
- ✅ **Metadata**: Includes backup size and file count
- ✅ **Health Checks**: Verifies backup success
- ✅ **Automatic Cleanup**: Removes backups older than retention period

### MinIO Backup
- ✅ **Full Bucket Mirror**: Complete bucket replication
- ✅ **Metadata Tracking**: JSON metadata for each backup
- ✅ **Integrity**: Mirrors all files and folders
- ✅ **Efficient Storage**: Only changed files are updated
- ✅ **Automatic Cleanup**: Removes old backup directories

### Automation
- ✅ **Cron Scheduling**: Configurable via environment variables
- ✅ **Initial Backup**: Runs immediately on container startup
- ✅ **Logging**: Detailed logs for troubleshooting
- ✅ **Container Health**: Auto-restart on failure
- ✅ **No Downtime**: Backups run without affecting services

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Backup Configuration (Optional)
BACKUP_CRON_SCHEDULE=0 2 * * *  # Default: 2 AM daily
BACKUP_RETENTION_DAYS=30        # Default: 30 days
```

### Cron Schedule Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7) (Sunday is 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `0 2 * * *` - Every day at 2:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Every Sunday at midnight
- `0 3 * * 1-5` - Weekdays at 3:00 AM

## Usage

### Starting Backup Service

```bash
# Start all services including backup
docker-compose up -d

# Check backup service logs
docker logs mobifaktura_backup

# Follow backup logs in real-time
docker logs -f mobifaktura_backup
```

### Manual Backups

```bash
# Backup PostgreSQL
npm run backup:postgres

# Backup MinIO
npm run backup:minio

# Backup both
npm run backup:all

# List all backups
npm run backup:list
```

### Restore Operations

#### Restore PostgreSQL

```bash
# List available backups
npm run restore:postgres

# Follow prompts to select backup file
# Example: mobifaktura_backup_20251211_020000.sql.gz
```

#### Restore MinIO

```bash
# List available backups
npm run restore:minio

# Follow prompts to select backup timestamp
# Example: 20251211_020000
```

**⚠️ Warning:** Restore operations will **OVERWRITE** existing data. Always confirm before proceeding.

## Backup Storage

### Directory Structure

```
/backups/
├── postgres/
│   ├── mobifaktura_backup_20251211_020000.sql.gz
│   ├── mobifaktura_backup_20251210_020000.sql.gz
│   └── mobifaktura_backup_20251209_020000.sql.gz
└── minio/
    ├── 20251211_020000/
    │   ├── .backup_info
    │   ├── invoice_001.pdf
    │   └── invoice_002.pdf
    ├── 20251210_020000/
    └── 20251209_020000/
```

### Docker Volume

Backups are stored in a dedicated Docker volume:

```bash
# Inspect backup volume
docker volume inspect mobifaktura_backup_data

# Access backup directory
docker exec -it mobifaktura_backup ls -lah /backups

# Copy backups to host
docker cp mobifaktura_backup:/backups ./local-backups
```

## Monitoring

### Check Backup Status

```bash
# View recent backup logs
docker exec mobifaktura_backup tail -50 /var/log/backup-postgres.log
docker exec mobifaktura_backup tail -50 /var/log/backup-minio.log

# Check cron jobs
docker exec mobifaktura_backup crontab -l

# View all backups with sizes
docker exec mobifaktura_backup du -sh /backups/*
```

### Backup Health

The backup service runs health checks:
- ✅ Verifies PostgreSQL connection before backup
- ✅ Validates MinIO bucket accessibility
- ✅ Confirms backup file creation
- ✅ Logs success/failure status

## Disaster Recovery

### Complete System Restore

1. **Restore PostgreSQL Database:**
   ```bash
   npm run restore:postgres
   # Select latest backup file
   ```

2. **Restore MinIO Storage:**
   ```bash
   npm run restore:minio
   # Select latest backup timestamp
   ```

3. **Restart Application:**
   ```bash
   docker-compose restart app
   ```

### Offsite Backup Strategy

**Recommended:** Copy backups to external storage regularly:

```bash
# Backup to external drive
docker cp mobifaktura_backup:/backups /mnt/external/mobifaktura-backups

# Backup to cloud storage (example with rclone)
docker exec mobifaktura_backup sh -c "cd /backups && rclone sync . mycloud:mobifaktura-backups"

# Backup via rsync
docker exec mobifaktura_backup sh -c "rsync -avz /backups/ user@remote-server:/backups/"
```

## Troubleshooting

### Backup Service Won't Start

```bash
# Check logs
docker logs mobifaktura_backup

# Verify scripts are executable
docker exec mobifaktura_backup ls -l /scripts

# Manually run backup
docker exec mobifaktura_backup /scripts/backup-postgres.sh
```

### Backups Not Running on Schedule

```bash
# Check cron is running
docker exec mobifaktura_backup ps aux | grep crond

# Verify cron schedule
docker exec mobifaktura_backup cat /etc/crontabs/root

# Check cron logs
docker exec mobifaktura_backup cat /var/log/backup-postgres.log
```

### Insufficient Disk Space

```bash
# Check available space
docker exec mobifaktura_backup df -h /backups

# Manually clean old backups
docker exec mobifaktura_backup find /backups/postgres -name "*.sql.gz" -mtime +30 -delete
docker exec mobifaktura_backup find /backups/minio -maxdepth 1 -type d -name "20*" -mtime +30 -exec rm -rf {} \;
```

### Restore Fails

```bash
# Verify backup file integrity
docker exec mobifaktura_backup gzip -t /backups/postgres/mobifaktura_backup_XXXXXX.sql.gz

# Test PostgreSQL connection
docker exec mobifaktura_backup psql -h postgres -U mobifaktura -d postgres -c "SELECT 1"

# Check MinIO connectivity
docker exec mobifaktura_backup mc alias list
```

## Security Considerations

### Access Control
- ✅ Backup volume is only accessible to backup container
- ✅ Credentials inherited from environment variables
- ✅ No external ports exposed
- ✅ Read-only mount for backup scripts

### Best Practices
1. **Encrypt backups** before storing offsite
2. **Test restore procedures** regularly
3. **Store credentials** securely (use Docker secrets in production)
4. **Monitor backup success** via logs or alerting
5. **Keep offsite copies** for disaster recovery

## Advanced Configuration

### Custom Retention Period

Edit `docker-compose.yml`:

```yaml
environment:
  BACKUP_RETENTION_DAYS: 60  # Keep 60 days
```

### Custom Backup Schedule

Edit `.env`:

```bash
# Multiple backups per day
BACKUP_CRON_SCHEDULE=0 */12 * * *  # Every 12 hours

# Weekly backups only
BACKUP_CRON_SCHEDULE=0 2 * * 0  # Sundays at 2 AM
```

### External Backup Storage

Mount external directory:

```yaml
volumes:
  - /mnt/external/backups:/backups
  - ./scripts/backups:/scripts:ro
```

## Performance Impact

### Resource Usage
- **CPU**: Minimal (only during backup execution)
- **Memory**: ~50MB for backup container
- **Disk I/O**: Moderate during backup (depends on data size)
- **Network**: Internal only (no external traffic)

### Backup Duration
Typical durations:
- **PostgreSQL**: 5-30 seconds (depends on DB size)
- **MinIO**: 10-60 seconds (depends on file count/size)
- **Total**: < 2 minutes for small-medium installations

### Scheduled Execution
Default schedule runs backups at 2 AM to minimize impact on production users.

## Support

For issues or questions:
1. Check logs: `docker logs mobifaktura_backup`
2. Review this documentation
3. Test manual backups: `npm run backup:all`
4. Verify disk space and permissions

## Summary

✅ **Automated**: Backups run daily via cron  
✅ **Comprehensive**: Both database and files backed up  
✅ **Reliable**: Health checks and error logging  
✅ **Configurable**: Adjust schedule and retention  
✅ **Easy Restore**: Simple CLI commands  
✅ **Production Ready**: Tested and documented  

The backup system provides robust data protection with minimal configuration required. Always test restore procedures before relying on backups in production.
