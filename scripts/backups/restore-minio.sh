#!/bin/bash

# MinIO Restore Script for mobiFaktura
# This script restores a MinIO backup

set -e

# Configuration
BACKUP_DIR="/backups/minio"

# MinIO connection info from environment variables
MINIO_ENDPOINT="${MINIO_ENDPOINT:-minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-mobifaktura_minio}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-mobifaktura_minio_secret}"
MINIO_BUCKET="${MINIO_BUCKET:-invoices}"

# Check if backup timestamp is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_timestamp>"
  echo ""
  echo "Available backups:"
  find "${BACKUP_DIR}" -maxdepth 1 -type d -name "20*" -printf "%T@ %Tc %f\n" | sort -rn | cut -d' ' -f2-
  exit 1
fi

BACKUP_TIMESTAMP="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_TIMESTAMP}"

# Check if backup exists
if [ ! -d "${BACKUP_PATH}" ]; then
  echo "Error: Backup not found: ${BACKUP_PATH}"
  exit 1
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting MinIO restore..."
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup: ${BACKUP_TIMESTAMP}"

# Show backup info if available
if [ -f "${BACKUP_PATH}/.backup_info" ]; then
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup info:"
  cat "${BACKUP_PATH}/.backup_info"
fi

# Confirm before restoring
read -p "⚠️  This will OVERWRITE the current bucket. Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Configure mc (MinIO Client) alias
mc alias set target http://${MINIO_ENDPOINT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} --api S3v4 > /dev/null 2>&1

# Ensure bucket exists
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Ensuring bucket '${MINIO_BUCKET}' exists..."
mc mb target/${MINIO_BUCKET} --ignore-existing > /dev/null 2>&1

# Remove all existing objects in the bucket
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Removing existing objects..."
mc rm target/${MINIO_BUCKET} --recursive --force > /dev/null 2>&1 || true

# Mirror backup to bucket
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Restoring backup..."
mc mirror ${BACKUP_PATH} target/${MINIO_BUCKET} --overwrite

if [ $? -eq 0 ]; then
  # Count restored files
  FILE_COUNT=$(mc ls target/${MINIO_BUCKET} --recursive | wc -l)
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✓ Restore completed successfully: ${FILE_COUNT} files"
else
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✗ Restore failed!"
  exit 1
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] MinIO restore process completed."
