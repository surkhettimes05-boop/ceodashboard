# Disaster Recovery Runbook

## Overview
This document provides step-by-step procedures for recovering the CEO Dashboard ERP system from various disaster scenarios.

## Recovery Objectives

### RPO (Recovery Point Objective)
- **Daily Backup**: 24 hours maximum data loss
- **WAL Archiving**: 15 minutes maximum data loss (if configured)
- **Point-in-Time Recovery**: 15 minutes maximum data loss

### RTO (Recovery Time Objective)
- **Full Restore from Backup**: 2-4 hours
- **Point-in-Time Recovery**: 4-6 hours
- **Application Restart**: 5-10 minutes
- **Critical Services Only**: 30 minutes

## Disaster Scenarios

### Scenario 1: Database Corruption
**Severity**: High  
**Detection**: Database errors, failed queries, data inconsistencies

**Recovery Steps**:
1. **Assess Damage**
   ```bash
   # Check database status
   psql -h localhost -U postgres -d ceodashboard -c "SELECT 1"
   
   # Check for corruption
   psql -h localhost -U postgres -d ceodashboard -c "VACUUM FULL VERBOSE"
   ```

2. **Stop Application**
   ```bash
   pm2 stop ceodashboard
   ```

3. **Identify Last Good Backup**
   ```bash
   # List available backups
   ls -lt /var/backups/ceodashboard/postgresql/backup_daily_*.sql.gz | head -5
   ```

4. **Restore Database**
   ```bash
   ./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_daily_20240119_020000.sql.gz production
   ```

5. **Verify Restore**
   ```bash
   # Check table counts
   psql -h localhost -U postgres -d ceodashboard -c "SELECT COUNT(*) FROM sales"
   
   # Verify trial balance
   psql -h localhost -U postgres -d ceodashboard -c "SELECT SUM(debit), SUM(credit) FROM ledger_entries"
   ```

6. **Restart Application**
   ```bash
   pm2 start ceodashboard
   ```

7. **Monitor Logs**
   ```bash
   pm2 logs ceodashboard
   ```

### Scenario 2: Server Hardware Failure
**Severity**: Critical  
**Detection**: Server unresponsive, hardware alerts, power failure

**Recovery Steps**:
1. **Assess Situation**
   - Determine if hardware is recoverable
   - Check if data can be salvaged from failed server
   - Identify replacement hardware or cloud instance

2. **Provision New Infrastructure**
   ```bash
   # If using cloud provider
   aws ec2 run-instances --image-id ami-xxx --instance-type t3.large --count 1
   
   # Or provision new physical server
   ```

3. **Install Required Software**
   ```bash
   # Install PostgreSQL
   apt-get install postgresql-14
   
   # Install Node.js
   apt-get install nodejs npm
   
   # Clone application
   git clone https://github.com/yourorg/ceodashboard.git
   cd ceodashboard/backend
   npm install
   ```

4. **Configure Database**
   ```bash
   # Create database
   createdb -U postgres ceodashboard
   
   # Configure PostgreSQL settings
   # Edit /etc/postgresql/14/main/postgresql.conf
   ```

5. **Restore from Backup**
   ```bash
   # Download latest backup from S3
   aws s3 cp s3://ceodashboard-backups/postgresql/backup_daily_20240119_020000.sql.gz /tmp/
   
   # Restore
   ./scripts/restore-database.sh /tmp/backup_daily_20240119_020000.sql.gz production
   ```

6. **Configure Application**
   ```bash
   # Set environment variables
   export DATABASE_URL="postgresql://postgres:password@localhost:5432/ceodashboard"
   export JWT_SECRET="your-secret"
   
   # Start application
   pm2 start ceodashboard
   ```

7. **Update DNS**
   ```bash
   # Update DNS to point to new server IP
   # Or update load balancer configuration
   ```

8. **Verify System**
   ```bash
   curl https://api.ceodashboard.com/api/health
   curl https://api.ceodashboard.com/ready
   ```

### Scenario 3: Data Center Outage
**Severity**: Critical  
**Detection**: Data center unreachable, network outage, power failure

**Recovery Steps**:
1. **Activate Disaster Recovery Site**
   - Switch to secondary data center or cloud region
   - Update DNS to point to DR site
   - Notify stakeholders of switchover

2. **Provision DR Infrastructure**
   ```bash
   # If using AWS, switch to DR region
   aws ec2 run-instances --region us-west-2 --image-id ami-xxx
   
   # Or activate standby servers
   ```

3. **Restore Database from Offsite Backup**
   ```bash
   # Download backup from S3 (multi-region)
   aws s3 cp s3://ceodashboard-backups-dr/postgresql/backup_daily_20240119_020000.sql.gz /tmp/
   
   # Restore to DR database
   ./scripts/restore-database.sh /tmp/backup_daily_20240119_020000.sql.gz production
   ```

4. **Start Application Services**
   ```bash
   pm2 start ceodashboard
   ```

5. **Verify DR Site**
   ```bash
   curl https://api-dr.ceodashboard.com/api/health
   ```

6. **Monitor Performance**
   - Check application logs
   - Monitor database performance
   - Verify data integrity

### Scenario 4: Ransomware Attack
**Severity**: Critical  
**Detection**: File encryption, ransom notes, unusual file activity

**Recovery Steps**:
1. **IMMEDIATE ACTIONS**
   - Disconnect affected systems from network
   - Do NOT pay ransom
   - Preserve forensic evidence
   - Notify security team and management

2. **Assess Scope**
   - Identify affected systems
   - Determine data encryption status
   - Check if backups are compromised

3. **Isolate Systems**
   ```bash
   # Shut down all affected servers
   # Disconnect from network
   # Preserve system state for forensics
   ```

4. **Verify Backup Integrity**
   ```bash
   # Check if backups are encrypted
   # Test restore from isolated backup
   ./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_daily_20240119_020000.sql.gz test
   ```

5. **Wipe and Rebuild Systems**
   ```bash
   # Rebuild from scratch on clean hardware
   # Use known-good OS images
   # Reinstall all software
   ```

6. **Restore from Clean Backups**
   ```bash
   # Only restore from pre-attack backups
   ./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_daily_20240118_020000.sql.gz production
   ```

7. **Patch Vulnerabilities**
   - Update all software to latest versions
   - Apply security patches
   - Review access controls

8. **Enhance Security**
   - Implement MFA everywhere
   - Review and restrict admin access
   - Enable advanced threat detection

9. **Gradual Rollout**
   - Start with non-critical systems
   - Monitor for suspicious activity
   - Gradually restore full operations

### Scenario 5: Human Error (Accidental Data Deletion)
**Severity**: Medium  
**Detection**: User reports, missing data, audit log anomalies

**Recovery Steps**:
1. **Assess Impact**
   ```bash
   # Check audit logs for deletion events
   psql -h localhost -U postgres -d ceodashboard -c "SELECT * FROM audit_logs WHERE action LIKE '%DELETE%' ORDER BY created_at DESC LIMIT 20"
   ```

2. **Identify Affected Data**
   - Determine what was deleted
   - Identify time of deletion
   - Assess business impact

3. **Point-in-Time Recovery (if WAL archiving enabled)**
   ```bash
   # Restore to point before deletion
   pg_restore -h localhost -U postgres -d ceodashboard -j 4 --recovery-target-time="2024-01-19 10:30:00" backup.dump
   ```

4. **Or Restore from Backup**
   ```bash
   # Restore from backup before deletion
   ./scripts/restore-database.sh /var/backups/ceodashboard/postgresql/backup_daily_20240118_020000.sql.gz production
   ```

5. **Reapply Changes Since Backup**
   - Re-enter transactions manually if needed
   - Or use application logs to replay changes

6. **Prevent Future Occurrences**
   - Implement soft deletes
   - Add confirmation dialogs
   - Improve user training

## Communication Plan

### Internal Communication
- **IT Team**: Immediate notification
- **Management**: Within 15 minutes
- **All Staff**: Within 30 minutes (if major outage)

### External Communication
- **Customers**: Within 1 hour (if service affected)
- **Partners**: As needed
- **Public**: Only if major incident

### Communication Channels
- **Primary**: Slack/Teams
- **Secondary**: Email
- **Emergency**: Phone call tree

## Post-Recovery Steps

### 1. Verification
- Run full system health check
- Verify data integrity
- Test critical business functions
- Compare with expected state

### 2. Documentation
- Document incident timeline
- Record recovery actions taken
- Note any deviations from procedure
- Identify lessons learned

### 3. Root Cause Analysis
- Investigate root cause
- Identify contributing factors
- Determine preventive measures

### 4. Process Improvement
- Update runbook based on lessons learned
- Improve monitoring and alerting
- Enhance backup/restore procedures
- Conduct post-mortem meeting

### 5. Testing
- Test improved procedures
- Schedule additional DR drills
- Update RPO/RTO targets if needed

## Emergency Contacts

### Primary Contacts
- **CTO**: [Name] - [Phone] - [Email]
- **DBA**: [Name] - [Phone] - [Email]
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Security Lead**: [Name] - [Phone] - [Email]

### Secondary Contacts
- **CEO**: [Name] - [Phone] - [Email]
- **IT Manager**: [Name] - [Phone] - [Email]

### Vendor Contacts
- **Cloud Provider**: AWS Support - 1-800-XXX-XXXX
- **Database Support**: PostgreSQL Support - [Contact]
- **Security Vendor**: [Contact]

## Regular Drills

### Monthly
- Review runbook updates
- Check backup integrity
- Verify contact information

### Quarterly
- Tabletop exercise with IT team
- Test notification procedures
- Review RPO/RTO compliance

### Annually
- Full DR drill (simulate major outage)
- Test complete restore procedure
- Update runbook based on findings

## Appendix

### Quick Reference Card
```
EMERGENCY STEPS:
1. Assess situation
2. Notify team
3. Stop affected services
4. Identify last good backup
5. Restore from backup
6. Verify restore
7. Restart services
8. Monitor systems
```

### Backup Locations
- **Local**: /var/backups/ceodashboard/postgresql/
- **S3 Primary**: s3://ceodashboard-backups/postgresql/
- **S3 DR**: s3://ceodashboard-backups-dr/postgresql/

### Critical Systems Priority
1. Database (PostgreSQL)
2. Application API (Node.js)
3. Frontend (React)
4. Monitoring/Logging
5. Backup Services
