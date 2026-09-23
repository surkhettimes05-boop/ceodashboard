# Deployment Architecture

## Overview
This document provides comprehensive deployment architecture for the CEO Dashboard ERP system, including infrastructure, scaling, monitoring, and operational procedures.

## Architecture Diagram

```
                    ┌─────────────────┐
                    │   DNS / CDN     │
                    │   (Cloudflare)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Load Balancer  │
                    │   (Nginx/HAProxy)│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼─────┐ ┌────▼─────┐
       │  Web Server  │ │Web Server│ │Web Server│
       │  (Node.js)   │ │(Node.js) │ │(Node.js) │
       └──────┬──────┘ └────┬─────┘ └────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │  PostgreSQL DB  │
                    │   (Primary)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  PostgreSQL DB  │
                    │   (Replica)     │
                    └─────────────────┘
```

## Infrastructure Components

### 1. Web Application Layer

#### Technology Stack
- **Runtime**: Node.js 18.x
- **Framework**: Express.js
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx

#### Server Specifications
- **CPU**: 4 vCPUs
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **OS**: Ubuntu 22.04 LTS

#### Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ceodashboard',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
  }],
};
```

### 2. Database Layer

#### PostgreSQL Configuration
- **Version**: PostgreSQL 14
- **RAM**: 16 GB
- **Storage**: 500 GB SSD
- **Replication**: Streaming replication

#### Performance Tuning
```ini
# postgresql.conf
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
```

#### Backup Configuration
- **Daily Backups**: Automated at 2 AM UTC
- **Retention**: 7 days daily, 4 weeks weekly, 12 months monthly
- **Storage**: Local + S3 offsite

### 3. Load Balancer

#### Nginx Configuration
```nginx
upstream backend {
    least_conn;
    server 10.0.1.10:3001 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3001 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.ceodashboard.com;

    ssl_certificate /etc/letsencrypt/live/api.ceodashboard.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ceodashboard.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Caching Layer

#### Redis Configuration
- **Purpose**: Session storage, caching, rate limiting
- **RAM**: 4 GB
- **Persistence**: RDB + AOF
- **Replication**: Master-Slave

## Deployment Environments

### Development
- **URL**: dev.ceodashboard.com
- **Server**: Single instance
- **Database**: Local PostgreSQL
- **Purpose**: Development and testing

### Staging
- **URL**: staging.ceodashboard.com
- **Server**: 2 instances
- **Database**: Production replica
- **Purpose**: Pre-production testing

### Production
- **URL**: api.ceodashboard.com
- **Server**: 3+ instances (auto-scaling)
- **Database**: Primary + Replica
- **Purpose**: Live production traffic

## Deployment Process

### 1. Automated Deployment (CI/CD)

#### GitHub Actions Pipeline
```yaml
deploy-production:
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to production
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.PRODUCTION_HOST }}
        username: ${{ secrets.PRODUCTION_USER }}
        key: ${{ secrets.PRODUCTION_SSH_KEY }}
        script: |
          cd /opt/ceodashboard
          git pull origin main
          npm ci --production
          npm run build
          pm2 restart ceodashboard
```

### 2. Manual Deployment

#### Step-by-Step Process
```bash
# 1. SSH to server
ssh user@production-server

# 2. Navigate to application directory
cd /opt/ceodashboard

# 3. Pull latest code
git pull origin main

# 4. Install dependencies
npm ci --production

# 5. Build application
npm run build

# 6. Run database migrations
npx prisma migrate deploy

# 7. Restart application
pm2 restart ceodashboard

# 8. Verify deployment
pm2 logs ceodashboard --lines 50
curl http://localhost:3001/api/health
```

### 3. Blue-Green Deployment

#### Process
1. Deploy new version to green environment
2. Run smoke tests on green environment
3. Switch load balancer to green environment
4. Monitor for issues
5. If issues, rollback to blue environment
6. If successful, decommission blue environment

## Scaling Strategy

### Horizontal Scaling

#### Auto-Scaling Configuration
```yaml
# AWS Auto Scaling Group
MinInstances: 3
MaxInstances: 10
TargetCPU: 70%
ScaleUpCooldown: 300s
ScaleDownCooldown: 300s
```

#### Load Balancing
- Algorithm: Least connections
- Health checks: Every 10 seconds
- Session affinity: IP hash (if needed)

### Vertical Scaling

#### When to Scale Up
- CPU consistently > 80%
- Memory consistently > 80%
- Disk I/O bottleneck

#### Scaling Steps
1. Upgrade server instance type
2. Monitor performance
3. Adjust PostgreSQL configuration
4. Restart services

## Monitoring and Observability

### 1. Application Monitoring

#### PM2 Monitoring
```bash
# Monitor PM2 processes
pm2 monit

# View logs
pm2 logs ceodashboard

# Check status
pm2 status
```

#### Health Endpoints
```typescript
// /api/health
{
  status: 'healthy',
  timestamp: '2024-01-19T10:00:00Z',
  uptime: 86400,
  version: '1.0.0',
  database: 'connected',
  redis: 'connected'
}

// /ready
{
  ready: true,
  checks: {
    database: 'ok',
    redis: 'ok',
    external_apis: 'ok'
  }
}
```

### 2. Database Monitoring

#### Key Metrics
- Connection count
- Query performance
- Replication lag
- Disk usage
- Cache hit ratio

#### Monitoring Queries
```sql
-- Connection count
SELECT count(*) FROM pg_stat_activity WHERE datname = 'ceodashboard';

-- Slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Replication lag
SELECT now() - pg_last_xact_replay_timestamp() AS lag;
```

### 3. Server Monitoring

#### Metrics to Monitor
- CPU usage
- Memory usage
- Disk I/O
- Network I/O
- Disk space

#### Tools
- Prometheus + Grafana
- CloudWatch (AWS)
- Datadog (optional)

## Security

### 1. Network Security

#### Firewall Rules
```bash
# Allow SSH from specific IPs
ufw allow from 203.0.113.0/24 to any port 22

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Deny everything else
ufw default deny incoming
ufw default allow outgoing
```

#### VPN Access
- Admin access via VPN only
- MFA required for VPN
- Session timeout: 8 hours

### 2. Application Security

#### Environment Variables
```bash
# Never commit to git
DATABASE_URL=postgresql://user:password@localhost:5432/ceodashboard
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
```

#### Secrets Management
- Use HashiCorp Vault or AWS Secrets Manager
- Rotate secrets every 90 days
- Audit secret access

## Disaster Recovery

### 1. Backup Strategy

#### Automated Backups
- Daily: Full backup at 2 AM UTC
- Weekly: Full backup on Sunday
- Monthly: Full backup on 1st of month

#### Backup Locations
- Local: `/var/backups/ceodashboard/postgresql/`
- Offsite: S3 bucket `ceodashboard-backups`
- DR Region: S3 bucket `ceodashboard-backups-dr`

### 2. Recovery Procedures

#### RPO/RTO
- **RPO**: 15 minutes (WAL archiving)
- **RTO**: 2 hours (full restore)

#### Recovery Steps
See `docs/DISASTER_RECOVERY_RUNBOOK.md`

## Maintenance Procedures

### 1. Regular Maintenance

#### Daily
- Check application logs
- Monitor error rates
- Verify backup completion

#### Weekly
- Review performance metrics
- Check disk space
- Review security logs

#### Monthly
- Apply security patches
- Review and update dependencies
- Test restore procedure

### 2. Rolling Updates

#### Process
1. Update one server at a time
2. Wait for health checks to pass
3. Update next server
4. Continue until all servers updated

#### Rollback
- If issues detected, rollback to previous version
- Use git revert or previous Docker image
- Update all servers to previous version

## Cost Optimization

### 1. Right-Sizing
- Monitor resource utilization
- Adjust instance sizes based on usage
- Use reserved instances for predictable workloads

### 2. Cost Monitoring
- Track AWS/cloud costs
- Set budget alerts
- Review costs monthly

## Documentation

### Required Documentation
- [x] Deployment Architecture (this document)
- [x] Disaster Recovery Runbook
- [x] Backup Strategy
- [x] Migration Safety Procedures
- [x] Security Audit Report
- [x] Database Integrity Report

### Runbooks
- [ ] Deployment Runbook
- [ ] Incident Response Runbook
- [ ] On-Call Procedures
- [ ] Troubleshooting Guide

## Appendix

### Contact Information
- **DevOps Lead**: [Contact]
- **DBA**: [Contact]
- **CTO**: [Contact]
- **On-Call Engineer**: [Contact]

### Emergency Contacts
- **24/7 Support**: [Phone]
- **Cloud Provider Support**: [Contact]
- **Database Support**: [Contact]

### Useful Commands
```bash
# Check server status
pm2 status

# View logs
pm2 logs ceodashboard

# Restart application
pm2 restart ceodashboard

# Check database connections
psql -h localhost -U postgres -d ceodashboard -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'ceodashboard'"

# Check disk space
df -h

# Check memory
free -h

# Check CPU
top
```
