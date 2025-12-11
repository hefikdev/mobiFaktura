# mobiFaktura Backup Quick Reference

## Quick Commands

```bash
# Manual Backups
npm run backup:postgres    # Backup PostgreSQL only
npm run backup:minio      # Backup MinIO only
npm run backup:all        # Backup everything

# List Backups
npm run backup:list       # Show all backups

# Restore
npm run restore:postgres  # Restore PostgreSQL (interactive)
npm run restore:minio    # Restore MinIO (interactive)
```

## Service Management

```bash
# Start backup service
docker-compose up -d backup

# View logs
docker logs -f mobifaktura_backup

# Check cron schedule
docker exec mobifaktura_backup crontab -l

# Access backup directory
docker exec -it mobifaktura_backup ls -lah /backups
```

## Configuration

**Default Schedule:** Daily at 2:00 AM  
**Default Retention:** 30 days  

To change, add to `.env`:
```bash
BACKUP_CRON_SCHEDULE=0 2 * * *  # Cron format
```

## Emergency Restore

```bash
# 1. List available backups
npm run restore:postgres

# 2. Enter backup filename when prompted
# Example: mobifaktura_backup_20251211_020000.sql.gz

# 3. Confirm with "yes"

# 4. Restart app
docker-compose restart app
```

## Offsite Backup

```bash
# Copy to external storage
docker cp mobifaktura_backup:/backups ./local-backups

# Or mount external volume in docker-compose.yml:
# volumes:
#   - /mnt/external:/backups
```

## Troubleshooting

```bash
# Manual backup test
docker exec mobifaktura_backup /scripts/backup-postgres.sh
docker exec mobifaktura_backup /scripts/backup-minio.sh

# Check logs
docker exec mobifaktura_backup cat /var/log/backup-postgres.log
docker exec mobifaktura_backup cat /var/log/backup-minio.log

# Check disk space
docker exec mobifaktura_backup df -h /backups
```

---

📖 **Full Documentation:** See `docs/BACKUP_SYSTEM.md`
