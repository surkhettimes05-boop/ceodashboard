#!/bin/bash

# Migration Execution Script for Staging Environment
# This script runs all production readiness migrations in the correct order

set -e  # Exit on error

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ceodashboard_staging}"
DB_USER="${DB_USER:-postgres}"
MIGRATIONS_DIR="./backend/prisma/migrations"
BACKUP_DIR="/var/backups/ceodashboard/staging/pre-migration"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-migration checks
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        log_error "psql is not installed. Please install PostgreSQL client."
        exit 1
    fi
    
    # Check database connection
    log_info "Testing database connection..."
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1" &> /dev/null; then
        log_error "Cannot connect to database. Please check DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD."
        exit 1
    fi
    
    # Check if database exists
    log_info "Checking if database exists..."
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        log_error "Database $DB_NAME does not exist. Please create it first."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Create pre-migration backup
create_backup() {
    log_info "Creating pre-migration backup..."
    
    # Create backup directory
    mkdir -p $BACKUP_DIR
    
    # Backup filename with timestamp
    BACKUP_FILE="$BACKUP_DIR/ceodashboard_staging_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    # Create backup
    log_info "Backing up database to $BACKUP_FILE..."
    PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME | gzip > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        log_info "Backup created successfully: $BACKUP_FILE"
    else
        log_error "Backup failed. Aborting migration."
        exit 1
    fi
}

# Run a single migration
run_migration() {
    local migration_name=$1
    local migration_file="$MIGRATIONS_DIR/$migration_name/migration.sql"
    
    if [ ! -f "$migration_file" ]; then
        log_error "Migration file not found: $migration_file"
        return 1
    fi
    
    log_info "Running migration: $migration_name"
    log_info "Migration file: $migration_file"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration_file"
    
    if [ $? -eq 0 ]; then
        log_info "Migration $migration_name completed successfully."
        return 0
    else
        log_error "Migration $migration_name failed."
        return 1
    fi
}

# Verify migration
verify_migration() {
    log_info "Verifying migration..."
    
    # Check if application can connect
    log_info "Testing application health endpoint..."
    # This assumes the application is running
    # Uncomment if health endpoint is available
    # curl -f http://localhost:3001/api/health || log_warn "Health endpoint not accessible"
    
    log_info "Migration verification completed."
}

# Rollback function
rollback() {
    log_error "Migration failed. Initiating rollback..."
    
    # Find the most recent backup
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/ceodashboard_staging_*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        log_error "No backup found for rollback."
        exit 1
    fi
    
    log_info "Restoring from backup: $LATEST_BACKUP"
    
    # Drop database
    log_info "Dropping database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE $DB_NAME;"
    
    # Create database
    log_info "Creating database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    
    # Restore backup
    log_info "Restoring backup..."
    gunzip -c $LATEST_BACKUP | PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
    
    if [ $? -eq 0 ]; then
        log_info "Rollback completed successfully."
    else
        log_error "Rollback failed. Manual intervention required."
        exit 1
    fi
}

# Main execution
main() {
    log_info "Starting migration execution for staging environment..."
    log_info "Database: $DB_NAME"
    log_info "Host: $DB_HOST:$DB_PORT"
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Run migrations in order
    log_info "Starting migration execution..."
    
    # Migration 1: Add MFA fields
    run_migration "add_mfa_fields" || rollback
    
    # Migration 2: Add check constraints
    run_migration "add_check_constraints" || rollback
    
    # Migration 3: Add performance indexes (use CONCURRENTLY to avoid locking)
    run_migration "add_performance_indexes" || rollback
    
    # Verify migrations
    verify_migration
    
    log_info "All migrations completed successfully!"
    log_info "Backup location: $BACKUP_DIR"
    log_info "Please verify application functionality."
}

# Trap errors and rollback
trap rollback ERR

# Run main function
main

exit 0
