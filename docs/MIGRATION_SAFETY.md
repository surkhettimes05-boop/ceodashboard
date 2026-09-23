# Database Migration Safety Procedures

## Overview
This document outlines safe procedures for database migrations in production to ensure data integrity and minimize downtime.

## Pre-Migration Checklist

### 1. Preparation
- [ ] Review migration script thoroughly
- [ ] Test migration in staging environment
- [ ] Verify backup exists before migration
- [ ] Document rollback plan
- [ ] Schedule maintenance window
- [ ] Notify stakeholders of planned downtime
- [ ] Prepare hotfix rollback script

### 2. Backup Verification
```bash
# Verify latest backup exists and is valid
ls -lt /var/backups/ceodashboard/postgresql/backup_daily_*.sql.gz | head -1

# Test backup integrity
gunzip -c /var/backups/ceodashboard/postgresql/backup_daily_latest.sql.gz | head -100

# Record backup file for potential rollback
export BACKUP_FILE="/var/backups/ceodashboard/postgresql/backup_daily_latest.sql.gz"
```

### 3. Migration Script Review
- [ ] Script is idempotent (can be run multiple times safely)
- [ ] Script includes transaction wrapping
- [ ] Script has proper error handling
- [ ] Script includes data validation after migration
- [ ] Script estimated runtime is documented
- [ ] Script impact on application is documented

## Migration Procedure

### Phase 1: Pre-Migration (30 minutes before)

#### 1.1 Application Maintenance Mode
```bash
# Put application in maintenance mode
pm2 stop ceodashboard

# Or use maintenance page
# Update Nginx to serve maintenance page
```

#### 1.2 Final Backup
```bash
# Create immediate pre-migration backup
./scripts/backup-database.sh pre-migration

# Verify backup completed successfully
ls -lt /var/backups/ceodashboard/postgresql/backup_pre-migration_*.sql.gz
```

#### 1.3 Database Connection Check
```bash
# Verify no active connections
psql -h localhost -U postgres -d ceodashboard -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ceodashboard'"

# Terminate any remaining connections if needed
psql -h localhost -U postgres -d ceodashboard -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ceodashboard' AND pid <> pg_backend_pid();"
```

### Phase 2: Migration Execution

#### 2.1 Dry Run
```bash
# Test migration in transaction without committing
psql -h localhost -U postgres -d ceodashboard -f migration.sql -v ON_ERROR_STOP=1 --single-transaction --set AUTOCOMMIT=off

# Rollback dry run
psql -h localhost -U postgres -d ceodashboard -c "ROLLBACK;"
```

#### 2.2 Execute Migration
```bash
# Execute migration with transaction
psql -h localhost -U postgres -d ceodashboard -f migration.sql -v ON_ERROR_STOP=1 --single-transaction

# Capture exit code
MIGRATION_EXIT_CODE=$?
```

#### 2.3 Verify Migration
```bash
# Check exit code
if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "Migration successful"
else
    echo "Migration failed with exit code: $MIGRATION_EXIT_CODE"
    # Trigger rollback
fi
```

### Phase 3: Post-Migration Validation

#### 3.1 Schema Validation
```bash
# Verify schema changes applied
psql -h localhost -U postgres -d ceodashboard -c "\d table_name"

# Verify indexes created
psql -h localhost -U postgres -d ceodashboard -c "\di index_name"

# Verify constraints added
psql -h localhost -U postgres -d ceodashboard -c "\d+ table_name"
```

#### 3.2 Data Validation
```bash
# Run data integrity checks
psql -h localhost -U postgres -d ceodashboard -c "SELECT COUNT(*) FROM table_name"

# Verify no data loss
psql -h localhost -U postgres -d ceodashboard -c "SELECT SUM(amount) FROM sales"

# Verify referential integrity
psql -h localhost -U postgres -d ceodashboard -c "SELECT COUNT(*) FROM sale_items WHERE sale_id NOT IN (SELECT id FROM sales)"
```

#### 3.3 Application Validation
```bash
# Start application
pm2 start ceodashboard

# Check application logs
pm2 logs ceodashboard --lines 50

# Verify health endpoint
curl http://localhost:3001/api/health

# Verify database connectivity
curl http://localhost:3001/ready
```

### Phase 4: Rollback Procedure (If Needed)

#### 4.1 Stop Application
```bash
pm2 stop ceodashboard
```

#### 4.2 Restore from Backup
```bash
# Restore from pre-migration backup
./scripts/restore-database.sh $BACKUP_FILE production
```

#### 4.3 Verify Restore
```bash
# Verify data integrity
psql -h localhost -U postgres -d ceodashboard -c "SELECT COUNT(*) FROM sales"

# Start application
pm2 start ceodashboard
```

## Migration Types

### Type 1: Non-Breaking Schema Changes
**Examples**: Adding new columns, adding new tables, adding indexes

**Procedure**:
1. Can be done without maintenance window
2. Use `CONCURRENTLY` for index creation
3. No application changes required
4. Minimal risk

```sql
-- Example: Add new column
ALTER TABLE products ADD COLUMN new_field VARCHAR(255);

-- Example: Add index concurrently
CREATE INDEX CONCURRENTLY idx_products_new_field ON products(new_field);
```

### Type 2: Breaking Schema Changes
**Examples**: Dropping columns, changing column types, renaming tables

**Procedure**:
1. Requires maintenance window
2. Requires application code changes
3. Must be deployed with application update
4. Higher risk

**Two-Phase Approach**:

**Phase 1 (Pre-Deployment)**:
```sql
-- Add new column alongside old
ALTER TABLE products ADD COLUMN new_price DECIMAL(12,2);
UPDATE products SET new_price = old_price;
```

**Phase 2 (Post-Deployment)**:
```sql
-- After application updated to use new column
ALTER TABLE products DROP COLUMN old_price;
```

### Type 3: Data Migrations
**Examples**: Data transformations, bulk updates, data cleanup

**Procedure**:
1. Requires maintenance window
2. Test on staging with production-like data
3. Batch large updates to avoid locking
4. Monitor performance during migration

```sql
-- Example: Batch update
BEGIN;
UPDATE products SET category_id = 'new-category' WHERE category_id = 'old-category' LIMIT 1000;
COMMIT;

-- Repeat until all records updated
```

## Prisma Migration Best Practices

### 1. Development
```bash
# Create migration
npx prisma migrate dev --name migration_name

# Review generated SQL
cat prisma/migrations/*/migration.sql
```

### 2. Testing
```bash
# Test migration on shadow database
npx prisma migrate resolve --applied migration_name

# Verify schema
npx prisma studio
```

### 3. Production Deployment
```bash
# Generate migration SQL for review
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# Review and test SQL manually
# Apply migration
npx prisma migrate deploy
```

### 4. Rollback
```bash
# Mark migration as rolled back
npx prisma migrate resolve --rolled-back migration_name

# Create rollback migration
npx prisma migrate dev --name rollback_migration_name
```

## Emergency Procedures

### 1. Migration Stuck
```bash
# Check for long-running queries
psql -h localhost -U postgres -d ceodashboard -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;"

# Cancel long-running query
psql -h localhost -U postgres -d ceodashboard -c "SELECT pg_cancel_backend(pid);"

# Terminate if necessary
psql -h localhost -U postgres -d ceodashboard -c "SELECT pg_terminate_backend(pid);"
```

### 2. Lock Contention
```bash
# Check for locks
psql -h localhost -U postgres -d ceodashboard -c "SELECT relation::regclass, mode, pid FROM pg_locks WHERE relation IS NOT NULL;"

# Identify blocking queries
psql -h localhost -U postgres -d ceodashboard -c "SELECT blocked_locks.pid AS blocked_pid, blocked_activity.usename AS blocked_user, blocking_locks.pid AS blocking_pid, blocking_activity.usename AS blocking_user, blocked_activity.query AS blocked_statement, blocking_activity.query AS current_statement_in_blocking_process FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.GRANTED;"
```

### 3. Data Corruption
```bash
# Immediate restore from backup
./scripts/restore-database.sh $BACKUP_FILE production

# If backup also corrupted, restore from older backup
./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_daily_previous.sql.gz production
```

## Monitoring During Migration

### 1. Database Metrics
```bash
# Monitor connection count
watch -n 1 'psql -h localhost -U postgres -d ceodashboard -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '\''ceodashboard'\'';"'

# Monitor query performance
psql -h localhost -U postgres -d ceodashboard -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Monitor disk usage
df -h /var/lib/postgresql
```

### 2. Application Metrics
```bash
# Monitor application logs
pm2 logs ceodashboard

# Monitor error rate
pm2 show ceodashboard
```

## Post-Migration Tasks

### 1. Cleanup
```bash
# Remove old columns if safe
ALTER TABLE products DROP COLUMN old_field;

# Remove temporary indexes
DROP INDEX CONCURRENTLY idx_temp_index;
```

### 2. Documentation
- Update schema documentation
- Record migration in database changelog
- Update API documentation if needed
- Document any data transformations

### 3. Monitoring
- Monitor query performance for 24 hours
- Monitor error rates
- Monitor application response times
- Check for any unexpected behavior

## Communication Plan

### Pre-Migration
- **24 hours before**: Notify all stakeholders
- **2 hours before**: Send reminder notification
- **30 minutes before**: Final confirmation

### During Migration
- Update status every 15 minutes
- Alert immediately if issues arise
- Provide estimated completion time

### Post-Migration
- Notify completion
- Provide summary of changes
- Document any issues encountered

## Approval Process

### Required Approvals
1. **DBA**: Review migration script
2. **Tech Lead**: Review impact on application
3. **Product Owner**: Review business impact
4. **CTO**: Final approval for production

### Approval Checklist
- [ ] Migration script reviewed and approved
- [ ] Staging test successful
- [ ] Backup verified
- [ ] Rollback plan documented
- [ ] Maintenance window approved
- [ ] Stakeholders notified
- [ ] On-call engineer available

## Appendix

### Migration Template
```sql
-- Migration: [Description]
-- Date: [Date]
-- Author: [Author]
-- Ticket: [Ticket Number]

BEGIN;

-- Add comments
COMMENT ON MIGRATION IS 'Description of migration';

-- Schema changes
-- ALTER TABLE ...

-- Data changes
-- UPDATE ...

-- Validation queries
-- SELECT COUNT(*) FROM ...

COMMIT;

-- Post-migration cleanup (run after validation)
-- BEGIN;
-- DROP COLUMN ...
-- COMMIT;
```

### Contact Information
- **DBA**: [Contact]
- **Tech Lead**: [Contact]
- **On-Call Engineer**: [Contact]
- **CTO**: [Contact]
