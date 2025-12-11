#!/bin/bash

# PostgreSQL Backup Script for mobiFaktura
# This script creates compressed backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="/backups/postgres"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="mobifaktura_backup_${TIMESTAMP}.sql.gz"

# Database connection info from environment variables
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-mobifaktura}"
DB_USER="${POSTGRES_USER:-mobifaktura}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting PostgreSQL backup..."

# Create backup with pg_dump and compress with gzip
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup was successful
if [ $? -eq 0 ]; then
  BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✓ Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✗ Backup failed!"
  exit 1
fi

# Remove old backups
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "mobifaktura_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "mobifaktura_backup_*.sql.gz" | wc -l)
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Total backups: ${BACKUP_COUNT}"

# List last 5 backups
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Recent backups:"
find "${BACKUP_DIR}" -name "mobifaktura_backup_*.sql.gz" -type f -printf "%T@ %Tc %p\n" | sort -rn | head -5 | cut -d' ' -f2-

echo "[$(date +"%Y-%m-%d %H:%M:%S")] PostgreSQL backup process completed."
