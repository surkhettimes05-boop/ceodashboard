#!/bin/bash

# Database Backup Script for CEO Dashboard ERP
# Usage: ./backup-database.sh [daily|weekly|monthly]

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ceodashboard}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ceodashboard/postgresql}"
S3_BUCKET="${S3_BUCKET:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKUP_TYPE="${1:-daily}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${BACKUP_TYPE}_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting ${BACKUP_TYPE} backup for database: ${DB_NAME}"

# Perform backup
if PGPASSWORD="${DB_PASSWORD}" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$BACKUP_PATH"; then
    log "Backup completed successfully: ${BACKUP_PATH}"
else
    log "ERROR: Backup failed"
    exit 1
fi

# Compress backup
log "Compressing backup..."
gzip "$BACKUP_PATH"
BACKUP_PATH="${BACKUP_PATH}.gz"

# Get file size
FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log "Backup file size: ${FILE_SIZE}"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
    if ! command -v aws &> /dev/null; then
        log "ERROR: S3_BUCKET is configured but AWS CLI is not installed"
        exit 1
    fi

    log "Uploading to S3: s3://${S3_BUCKET}/postgresql/${BACKUP_FILE}.gz"
    if aws s3 cp "$BACKUP_PATH" "s3://${S3_BUCKET}/postgresql/${BACKUP_FILE}.gz" --region "$AWS_REGION"; then
        log "S3 upload completed successfully"
    else
        log "ERROR: S3 upload failed"
        exit 1
    fi
fi

# Verify backup integrity
log "Verifying backup integrity..."
if pg_restore --clean --if-exists -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --list "$BACKUP_PATH" > /dev/null 2>&1; then
    log "Backup integrity check passed"
else
    log "ERROR: Backup integrity check failed"
    exit 1
fi

log "Backup process completed successfully"

# Send notification (optional)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ ${BACKUP_TYPE^} backup completed for ${DB_NAME}\\nSize: ${FILE_SIZE}\\nFile: ${BACKUP_FILE}.gz\"}" \
        "$SLACK_WEBHOOK_URL"
fi
