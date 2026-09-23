# Database Restore Test Procedure

## Overview
This document outlines the procedure for testing database backups to ensure they can be successfully restored when needed.

## Test Schedule

### Weekly Automated Tests
- **Frequency**: Every Monday at 1:00 AM UTC
- **Type**: Automated restore to test database
- **Verification**: Automated table count and integrity checks

### Monthly Manual Tests
- **Frequency**: First Monday of each month
- **Type**: Full manual restore test
- **Verification**: Comprehensive data validation and application smoke tests

## Test Environment Setup

### Test Database
- **Name**: `ceodashboard_restore_test`
- **Purpose**: Non-production environment for restore testing
- **Resources**: Same specifications as production (or scaled down for cost efficiency)

### Prerequisites
1. Test PostgreSQL instance running
2. Sufficient disk space for restore (2x backup file size)
3. Network access to backup storage (local or S3)
4. Database user with CREATE/DROP database privileges

## Automated Test Procedure

### Step 1: Select Backup
```bash
# Get latest daily backup
LATEST_BACKUP=$(ls -t /var/backups/ceodashboard/postgresql/backup_daily_*.sql.gz | head -1)
```

### Step 2: Run Automated Restore Test
```bash
./scripts/restore-database.sh $LATEST_BACKUP test
```

### Step 3: Verify Results
The script automatically:
- Drops existing test database
- Creates fresh database
- Restores from backup
- Verifies table counts
- Checks critical tables exist
- Reports results

### Step 4: Cleanup
```bash
# Drop test database after verification
dropdb -h localhost -U postgres ceodashboard_restore_test
```

## Manual Test Procedure

### Step 1: Prepare Test Environment
```bash
# Stop test application if running
pm2 stop ceodashboard-test

# Ensure test database is clean
dropdb -h localhost -U postgres ceodashboard_test || true
createdb -h localhost -U postgres ceodashboard_test
```

### Step 2: Select Backup to Test
Choose a backup from:
- Latest daily backup (quick test)
- Latest weekly backup (standard test)
- Oldest monthly backup (long-term retention test)

### Step 3: Perform Restore
```bash
# For local backup
./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_weekly_20240114_030000.sql.gz test

# For S3 backup
aws s3 cp s3://ceodashboard-backups/postgresql/backup_monthly_20240101_040000.sql.gz /tmp/
./scripts/restore-database.sh /tmp/backup_monthly_20240101_040000.sql.gz test
```

### Step 4: Comprehensive Verification

#### Data Integrity Checks
```sql
-- Connect to test database
psql -h localhost -U postgres -d ceodashboard_test

-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check row counts for critical tables
SELECT 
    'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'journal_entries', COUNT(*) FROM journal_entries
UNION ALL
SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions;
```

#### Financial Data Verification
```sql
-- Verify trial balance (debits must equal credits)
SELECT 
    SUM(debit) as total_debit,
    SUM(credit) as total_credit,
    SUM(debit) - SUM(credit) as difference
FROM ledger_entries;

-- Should return difference = 0
```

#### Application Smoke Tests
```bash
# Start test application with test database
export DATABASE_URL="postgresql://postgres:password@localhost:5432/ceodashboard_test"
pm2 start ceodashboard-test

# Run health check
curl http://localhost:3001/api/health

# Run readiness check
curl http://localhost:3001/ready

# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test123"}'

# Stop test application
pm2 stop ceodashboard-test
```

### Step 5: Document Results
Record in restore test log:
- Backup file used
- Restore duration
- Table counts
- Financial verification results
- Application test results
- Any issues encountered
- Test pass/fail status

## Success Criteria

### Automated Test
- Restore completes without errors
- All critical tables exist
- Table counts are reasonable (> 0 for critical tables)
- No data corruption warnings

### Manual Test
- All automated test criteria pass
- Trial balance is balanced (debits = credits)
- Application health checks pass
- Authentication works correctly
- Sample API endpoints respond correctly
- No application errors in logs

## Failure Handling

### Restore Failure
1. Check backup file integrity
2. Verify PostgreSQL version compatibility
3. Check disk space availability
4. Review PostgreSQL error logs
5. Try with a different backup file
6. Escalate to DBA if unresolved

### Verification Failure
1. Compare with production database
2. Check for schema changes
3. Verify backup was taken during consistent state
4. Review application logs for data issues
5. Consider re-taking backup if data corruption suspected

## Reporting

### Weekly Report
- Automated test results
- Backup file tested
- Restore duration
- Pass/fail status

### Monthly Report
- Manual test results
- Comprehensive verification results
- Application smoke test results
- Any issues or concerns
- Recommendations

## Emergency Restore Procedure

If production restore is needed urgently:

1. **Stop Application**: `pm2 stop ceodashboard`
2. **Select Most Recent Backup**: Use latest daily backup
3. **Perform Production Restore**: `./scripts/restore-database.sh <backup> production`
4. **Verify**: Run critical verification checks
5. **Start Application**: `pm2 start ceodashboard`
6. **Monitor**: Watch application logs for errors
7. **Notify**: Alert stakeholders of restore completion

## Contact Information

- **Primary DBA**: [Contact]
- **Secondary DBA**: [Contact]
- **DevOps Lead**: [Contact]
- **On-Call Engineer**: [Contact]
