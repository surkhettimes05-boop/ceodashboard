# Database Backup Strategy

## Overview
This document outlines the automated backup strategy for the CEO Dashboard ERP PostgreSQL database.

## Backup Schedule

### Daily Backups
- **Frequency**: Once daily at 2:00 AM UTC
- **Retention**: 7 days
- **Type**: Full database dump
- **Compression**: gzip

### Weekly Backups
- **Frequency**: Every Sunday at 3:00 AM UTC
- **Retention**: 4 weeks
- **Type**: Full database dump
- **Compression**: gzip

### Monthly Backups
- **Frequency**: First day of each month at 4:00 AM UTC
- **Retention**: 12 months
- **Type**: Full database dump
- **Compression**: gzip

## Backup Storage

### Local Storage
- **Location**: `/var/backups/ceodashboard/postgresql/`
- **Format**: `backup_<type>_<timestamp>.sql.gz`

### Offsite Storage (Recommended for Production)
- **S3 Bucket**: `s3://ceodashboard-backups/postgresql/`
- **Retention**: Matches local retention policy
- **Encryption**: AES-256
- **Lifecycle Rules**: Transition to Glacier after 90 days

## Backup Commands

### Manual Full Backup
```bash
pg_dump -h localhost -U postgres -d ceodashboard -F c -f /var/backups/ceodashboard/postgresql/manual_$(date +%Y%m%d_%H%M%S).dump
gzip /var/backups/ceodashboard/postgresql/manual_*.dump
```

### Automated Backup Script
See `scripts/backup-database.sh`

## Restoration Procedure

### From Local Backup
```bash
# Stop application
pm2 stop ceodashboard

# Drop existing database (optional, for full restore)
dropdb -h localhost -U postgres ceodashboard

# Create fresh database
createdb -h localhost -U postgres ceodashboard

# Restore from backup
gunzip -c /var/backups/ceodashboard/postgresql/backup_daily_20240119_020000.sql.gz | psql -h localhost -U postgres -d ceodashboard

# Restart application
pm2 start ceodashboard
```

### From S3 Backup
```bash
# Download backup
aws s3 cp s3://ceodashboard-backups/postgresql/backup_monthly_20240101_040000.sql.gz /tmp/

# Restore (same as local)
gunzip -c /tmp/backup_monthly_20240101_040000.sql.gz | psql -h localhost -U postgres -d ceodashboard
```

## Retention Policy Enforcement

### Automated Cleanup
- Daily backups: Delete files older than 7 days
- Weekly backups: Delete files older than 28 days
- Monthly backups: Delete files older than 365 days

### Cleanup Script
See `scripts/cleanup-backups.sh`

## Monitoring and Alerts

### Backup Success Metrics
- Backup completion time
- Backup file size
- Backup integrity check (pg_restore --check)

### Alert Conditions
- Backup failure
- Backup file size anomaly (>50% deviation from average)
- Disk space < 20% on backup volume
- Backup not completed within expected time window

## Security Considerations

### Backup Encryption
- All backups encrypted at rest (AES-256)
- Encryption keys stored in AWS KMS or HashiCorp Vault
- Never store encryption keys in code repositories

### Access Control
- Backup directory: 700 permissions (owner only)
- Backup files: 600 permissions (owner only)
- Only database admin and backup service user have access

### Backup Verification
- Weekly restore test to non-production environment
- Verify data integrity after restore
- Compare row counts between production and restored database

## Disaster Recovery

### RPO (Recovery Point Objective)
- Maximum data loss: 24 hours (daily backup)
- With WAL archiving: 15 minutes

### RTO (Recovery Time Objective)
- Full restore from backup: 2-4 hours
- Point-in-time recovery: 4-6 hours

## Configuration

### Environment Variables
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ceodashboard
DB_USER=postgres
BACKUP_DIR=/var/backups/ceodashboard/postgresql
S3_BUCKET=ceodashboard-backups
AWS_REGION=us-east-1
```

### Cron Jobs
```bash
# Daily backup at 2 AM UTC
0 2 * * * /opt/ceodashboard/scripts/backup-database.sh daily

# Weekly backup on Sunday at 3 AM UTC
0 3 * * 0 /opt/ceodashboard/scripts/backup-database.sh weekly

# Monthly backup on 1st at 4 AM UTC
0 4 1 * * /opt/ceodashboard/scripts/backup-database.sh monthly

# Cleanup old backups daily at 5 AM UTC
0 5 * * * /opt/ceodashboard/scripts/cleanup-backups.sh
```
