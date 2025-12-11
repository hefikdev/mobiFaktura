#!/bin/bash

# MinIO Backup Script for mobiFaktura
# This script mirrors MinIO buckets to a backup location

set -e

# Configuration
BACKUP_DIR="/backups/minio"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# MinIO connection info from environment variables
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mobifaktura_minio}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-mobifaktura_minio_secret}"
MINIO_BUCKET="${MINIO_BUCKET:-invoices}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting MinIO backup..."

# Configure mc (MinIO Client) alias
mc alias set source http://${MINIO_ENDPOINT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} --api S3v4 > /dev/null 2>&1

# Check if bucket exists
if ! mc ls source/${MINIO_BUCKET} > /dev/null 2>&1; then
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✗ Bucket '${MINIO_BUCKET}' not found!"
  exit 1
fi

# Create timestamped backup directory
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
mkdir -p "${BACKUP_PATH}"

# Mirror bucket to backup location
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Syncing bucket '${MINIO_BUCKET}' to ${BACKUP_PATH}..."
mc mirror source/${MINIO_BUCKET} ${BACKUP_PATH} --overwrite

if [ $? -eq 0 ]; then
  # Count files and calculate size
  FILE_COUNT=$(find "${BACKUP_PATH}" -type f | wc -l)
  BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✓ Backup completed successfully: ${FILE_COUNT} files (${BACKUP_SIZE})"
  
  # Create a metadata file
  cat > "${BACKUP_PATH}/.backup_info" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date +"%Y-%m-%d %H:%M:%S")",
  "bucket": "${MINIO_BUCKET}",
  "file_count": ${FILE_COUNT},
  "size": "${BACKUP_SIZE}"
}
EOF

else
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✗ Backup failed!"
  rm -rf "${BACKUP_PATH}"
  exit 1
fi

# Remove old backups
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Cleaning up old backups (retention: ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \;

# Count remaining backups
BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "20*" | wc -l)
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Total backups: ${BACKUP_COUNT}"

# List last 5 backups
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Recent backups:"
find "${BACKUP_DIR}" -maxdepth 1 -type d -name "20*" -printf "%T@ %Tc %p\n" | sort -rn | head -5 | cut -d' ' -f2-

echo "[$(date +"%Y-%m-%d %H:%M:%S")] MinIO backup process completed."
