#!/bin/bash

# Backup Cleanup Script for CEO Dashboard ERP
# Enforces retention policy for database backups

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ceodashboard/postgresql}"
S3_BUCKET="${S3_BUCKET:-ceodashboard-backups}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Retention periods (in days)
DAILY_RETENTION=7
WEEKLY_RETENTION=28
MONTHLY_RETENTION=365

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup cleanup process"

# Function to delete old local backups
cleanup_local_backups() {
    local backup_type=$1
    local retention_days=$2
    
    log "Cleaning up ${backup_type} backups older than ${retention_days} days..."
    
    local deleted_count=0
    while IFS= read -r -d '' file; do
        log "Deleting: $file"
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "backup_${backup_type}_*.sql.gz" -type f -mtime +${retention_days} -print0)
    
    log "Deleted ${deleted_count} ${backup_type} backup(s)"
}

# Function to delete old S3 backups
cleanup_s3_backups() {
    local backup_type=$1
    local retention_days=$2
    
    if [ -z "$S3_BUCKET" ] || ! command -v aws &> /dev/null; then
        log "S3 cleanup skipped (not configured or AWS CLI not available)"
        return
    fi
    
    log "Cleaning up ${backup_type} backups from S3 older than ${retention_days} days..."
    
    local cutoff_date=$(date -d "${retention_days} days ago" +%Y%m%d)
    local deleted_count=0
    
    # List and delete old backups
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            log "Deleting from S3: $file"
            aws s3 rm "$file" --region "$AWS_REGION"
            ((deleted_count++))
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/postgresql/" --recursive --region "$AWS_REGION" | \
             grep "backup_${backup_type}_" | \
             awk '{print $4}' | \
             while read -r key; do
                 file_date=$(echo "$key" | grep -oP 'backup_[^_]+_\K[0-9]{8}')
                 if [ "$file_date" -lt "$cutoff_date" ]; then
                     echo "s3://${S3_BUCKET}/postgresql/${key}"
                 fi
             done)
    
    log "Deleted ${deleted_count} ${backup_type} backup(s) from S3"
}

# Check disk space
check_disk_space() {
    local threshold=20  # 20% threshold
    local usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -gt "$((100 - threshold))" ]; then
        log "WARNING: Disk space usage is ${usage}% (threshold: ${threshold}% free)"
        log "Consider immediate cleanup or expanding storage"
    else
        log "Disk space usage: ${usage}% (OK)"
    fi
}

# Execute cleanup
check_disk_space
cleanup_local_backups "daily" "$DAILY_RETENTION"
cleanup_local_backups "weekly" "$WEEKLY_RETENTION"
cleanup_local_backups "monthly" "$MONTHLY_RETENTION"

cleanup_s3_backups "daily" "$DAILY_RETENTION"
cleanup_s3_backups "weekly" "$WEEKLY_RETENTION"
cleanup_s3_backups "monthly" "$MONTHLY_RETENTION"

log "Backup cleanup process completed"

# Send notification if disk space is critical
if [ "$usage" -gt 90 ]; then
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 CRITICAL: Disk space at ${usage}% on backup volume\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
fi
