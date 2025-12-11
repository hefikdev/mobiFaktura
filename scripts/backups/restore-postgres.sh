#!/bin/bash

# PostgreSQL Restore Script for mobiFaktura
# This script restores a PostgreSQL backup

set -e

# Configuration
BACKUP_DIR="/backups/postgres"

# Database connection info from environment variables
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-mobifaktura}"
DB_USER="${POSTGRES_USER:-mobifaktura}"

# Check if backup file is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Available backups:"
  find "${BACKUP_DIR}" -name "mobifaktura_backup_*.sql.gz" -type f -printf "%T@ %Tc %p\n" | sort -rn | cut -d' ' -f2-
  exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ] && [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# Use full path if only filename provided
if [ ! -f "${BACKUP_FILE}" ]; then
  BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting PostgreSQL restore..."
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup file: ${BACKUP_FILE}"

# Confirm before restoring
read -p "⚠️  This will OVERWRITE the current database. Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Drop existing connections
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Terminating existing connections..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
  > /dev/null 2>&1 || true

# Drop and recreate database
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Dropping database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${DB_NAME};"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Creating database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d postgres \
  -c "CREATE DATABASE ${DB_NAME};"

# Restore backup
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Restoring backup..."
gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  > /dev/null

if [ $? -eq 0 ]; then
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✓ Restore completed successfully!"
else
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] ✗ Restore failed!"
  exit 1
fi

# Verify restore
TABLES_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Database restored with ${TABLES_COUNT} tables."
echo "[$(date +"%Y-%m-%d %H:%M:%S")] PostgreSQL restore process completed."
