#!/bin/bash

# Database Restore Script for CEO Dashboard ERP
# Usage: ./restore-database.sh <backup_file> [test|production]

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ceodashboard}"
DB_USER="${DB_USER:-postgres}"
RESTORE_MODE="${2:-test}"

# Validate arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file> [test|production]"
    echo "Example: $0 /var/backups/ceodashboard/postgresql/backup_daily_20240119_020000.sql.gz test"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Safety check for production restore
if [ "$RESTORE_MODE" = "production" ]; then
    log "WARNING: PRODUCTION RESTORE MODE"
    echo "This will replace the production database. Are you sure? (yes/no)"
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
fi

# Determine target database
if [ "$RESTORE_MODE" = "test" ]; then
    TEST_DB_NAME="${DB_NAME}_restore_test"
    log "Restore mode: TEST (target: $TEST_DB_NAME)"
else
    TEST_DB_NAME="$DB_NAME"
    log "Restore mode: PRODUCTION (target: $TEST_DB_NAME)"
fi

log "Starting restore from: $BACKUP_FILE"

# Stop application if production restore
if [ "$RESTORE_MODE" = "production" ]; then
    log "Stopping application..."
    pm2 stop ceodashboard || true
fi

# Drop test database if it exists
if [ "$RESTORE_MODE" = "test" ]; then
    log "Dropping existing test database if exists..."
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB_NAME" 2>/dev/null || true
fi

# Create fresh database
log "Creating database: $TEST_DB_NAME"
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB_NAME"

# Restore from backup
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log "Restoring from compressed backup..."
    gunzip -c "$BACKUP_FILE" | pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -v
else
    log "Restoring from uncompressed backup..."
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -v "$BACKUP_FILE"
fi

log "Restore completed successfully"

# Run post-restore verification
if [ "$RESTORE_MODE" = "test" ]; then
    log "Running post-restore verification..."
    
    # Check table counts
    log "Verifying table counts..."
    PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_rows
        FROM pg_stat_user_tables 
        ORDER BY schemaname, tablename;
    "
    
    # Check critical tables
    log "Checking critical tables exist..."
    CRITICAL_TABLES=("users" "products" "sales" "purchases" "journal_entries" "inventory_transactions")
    for table in "${CRITICAL_TABLES[@]}"; do
        count=$(PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB_NAME" -tAc "SELECT COUNT(*) FROM $table" 2>/dev/null || echo "0")
        log "Table $table: $count rows"
    done
    
    log "Verification completed"
fi

# Restart application if production restore
if [ "$RESTORE_MODE" = "production" ]; then
    log "Restarting application..."
    pm2 start ceodashboard
    log "Application restarted"
fi

log "Restore process completed successfully"

# Send notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    if [ "$RESTORE_MODE" = "production" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🔄 PRODUCTION database restored from ${BACKUP_FILE}\"}" \
            "$SLACK_WEBHOOK_URL"
    else
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Test restore completed successfully from ${BACKUP_FILE}\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
fi
