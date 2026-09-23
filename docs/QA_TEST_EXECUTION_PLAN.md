# QA Test Execution Plan

**Date**: 2024-01-19  
**Purpose**: Comprehensive test execution plan for staging environment testing  
**Test Plan Reference**: docs/FINAL_PRODUCTION_TEST_PLAN.md  
**Execution Script**: scripts/run-staging-tests.sh

---

## Test Execution Overview

### Objective
Verify all production readiness implementations work correctly in the staging environment before production deployment.

### Test Environment
- **Environment**: Staging
- **API Base URL**: http://staging.ceodashboard.com:3001 (or configured URL)
- **Database**: ceodashboard_staging
- **Test Duration**: 2-3 days

### Test Categories
1. Automated Tests
2. Manual Functional Tests
3. Integration Tests
4. Performance Tests
5. Security Tests

---

## Pre-Test Checklist

### Environment Setup
- [ ] Staging server is accessible
- [ ] Application is deployed and running
- [ ] Database migrations completed successfully
- [ ] Environment variables configured
- [ ] Test data available
- [ ] Test user accounts created

### Test Tools
- [ ] Postman or similar API testing tool
- [ ] Browser with developer tools
- [ ] Database access (psql)
- [ ] Terminal access for script execution

### Test Data
- [ ] Admin user account (for MFA testing)
- [ ] Regular user account
- [ ] Test products
- [ ] Test customers
- [ ] Test suppliers

---

## Automated Tests

### 1. Run Automated Test Script
```bash
# Navigate to project root
cd /opt/ceodashboard

# Set API base URL
export API_BASE_URL=http://staging.ceodashboard.com:3001

# Run test script
./scripts/run-staging-tests.sh
```

### Expected Results
- Health endpoint returns 200 OK
- Readiness endpoint returns 200 OK
- Build succeeds without errors
- Integration tests pass
- Rate limiting is active

### Test Results Location
- `test-results/staging/health_*.json`
- `test-results/staging/ready_*.json`
- `test-results/staging/build_*.txt`
- `test-results/staging/integration_*.txt`
- `test-results/staging/test_report_*.md`

---

## Manual Functional Tests

### 2. Health & Readiness Endpoints

#### Test 2.1: Health Endpoint
**Endpoint**: GET /api/health

**Steps**:
1. Open browser or use curl
2. Navigate to http://staging.ceodashboard.com:3001/api/health
3. Verify response

**Expected Results**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-19T...",
  "uptime": <number>,
  "version": "1.0.0",
  "environment": "staging",
  "database": "connected",
  "redis": "not_configured",
  "memory": {
    "used": <number>,
    "total": <number>
  }
}
```

**Pass Criteria**: Status is "healthy", database is "connected"

---

#### Test 2.2: Readiness Endpoint
**Endpoint**: GET /ready

**Steps**:
1. Open browser or use curl
2. Navigate to http://staging.ceodashboard.com:3001/ready
3. Verify response

**Expected Results**:
```json
{
  "ready": true,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "external_apis": "ok"
  },
  "timestamp": "2024-01-19T..."
}
```

**Pass Criteria**: ready is true, all checks are "ok"

---

### 3. MFA Implementation Tests

#### Test 3.1: MFA Setup
**Endpoint**: POST /api/auth/mfa/setup

**Prerequisites**: Authenticated admin user

**Steps**:
1. Login as admin user
2. Get JWT token
3. Call POST /api/auth/mfa/setup with Authorization header
4. Save response (secret, qrCode, backupCodes)

**Expected Results**:
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,...",
    "backupCodes": ["ABC12345", "DEF67890", ...]
  }
}
```

**Pass Criteria**: Success is true, secret, qrCode, and backupCodes are present

---

#### Test 3.2: MFA Enable
**Endpoint**: POST /api/auth/mfa/enable

**Prerequisites**: MFA setup completed, TOTP token from authenticator app

**Steps**:
1. Scan QR code with Google Authenticator or similar
2. Get 6-digit TOTP token
3. Call POST /api/auth/mfa/enable with token
4. Verify MFA is enabled

**Expected Results**:
```json
{
  "success": true,
  "message": "MFA enabled successfully"
}
```

**Pass Criteria**: Success is true

---

#### Test 3.3: MFA Status
**Endpoint**: GET /api/auth/mfa/status

**Steps**:
1. Call GET /api/auth/mfa/status with Authorization header
2. Verify MFA status

**Expected Results**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "required": true,
    "verifiedAt": "2024-01-19T..."
  }
}
```

**Pass Criteria**: enabled is true, required is true for admin users

---

#### Test 3.4: MFA Disable
**Endpoint**: POST /api/auth/mfa/disable

**Steps**:
1. Call POST /api/auth/mfa/disable with Authorization header
2. Verify MFA is disabled

**Expected Results**:
```json
{
  "success": true,
  "message": "MFA disabled successfully"
}
```

**Pass Criteria**: Success is true

---

### 4. Rate Limiting Tests

#### Test 4.1: Auth Endpoint Rate Limiting
**Endpoint**: POST /api/auth/login

**Steps**:
1. Make 6 login attempts within 15 minutes
2. Observe response on 6th attempt

**Expected Results**:
- First 5 attempts: Normal response (success or failure based on credentials)
- 6th attempt: Rate limit error

**Pass Criteria**: 6th attempt returns rate limit error

---

#### Test 4.2: API Endpoint Rate Limiting
**Endpoint**: GET /api/health

**Steps**:
1. Make 101 requests within 15 minutes
2. Observe response on 101st attempt

**Expected Results**:
- First 100 attempts: 200 OK
- 101st attempt: Rate limit error

**Pass Criteria**: 101st attempt returns rate limit error

---

### 5. Database Indexes Verification

#### Test 5.1: Verify Indexes Exist
**Steps**:
1. Connect to database: `psql -U postgres -d ceodashboard_staging`
2. Run: `\d sales`
3. Verify indexes are listed

**Expected Indexes**:
- idx_sales_created_at
- idx_sales_status
- idx_sales_branch_id
- idx_sales_cashier_id
- idx_sales_customer_id

**Pass Criteria**: All expected indexes are present

---

#### Test 5.2: Verify Index Usage
**Steps**:
1. Run a query that should use the index
2. Check query plan

**Example**:
```sql
EXPLAIN ANALYZE SELECT * FROM sales ORDER BY created_at DESC LIMIT 10;
```

**Pass Criteria**: Query uses index (Index Scan instead of Seq Scan)

---

### 6. Database Constraints Verification

#### Test 6.1: Sale Item Quantity Constraint
**Steps**:
1. Attempt to insert sale item with quantity <= 0
2. Verify constraint error

**SQL**:
```sql
INSERT INTO sale_items (quantity, unit_price) VALUES (0, 10.00);
```

**Expected Results**: Constraint violation error

**Pass Criteria**: Error message mentions constraint

---

#### Test 6.2: Ledger Entry Debit/Credit Constraint
**Steps**:
1. Attempt to insert ledger entry with negative debit
2. Verify constraint error

**SQL**:
```sql
INSERT INTO ledger_entries (debit, credit) VALUES (-1, 0);
```

**Expected Results**: Constraint violation error

**Pass Criteria**: Error message mentions constraint

---

### 7. Secret Management Tests

#### Test 7.1: Environment Variable Secret Loading
**Steps**:
1. Set SECRET_SOURCE=env
2. Restart application
3. Verify application starts
4. Check logs for "Secrets loaded successfully"

**Pass Criteria**: Application starts, logs show secret loading success

---

#### Test 7.2: AWS Secrets Manager (Optional)
**Prerequisites**: AWS credentials configured

**Steps**:
1. Set SECRET_SOURCE=aws
2. Configure AWS credentials
3. Restart application
4. Verify application starts

**Pass Criteria**: Application starts, secrets loaded from AWS

---

## Integration Tests

### 8. End-to-End Workflow Tests

#### Test 8.1: Complete Sales Flow with MFA
**Steps**:
1. Enable MFA for admin user
2. Login with MFA
3. Create a sale
4. Verify sale is created
5. Disable MFA

**Pass Criteria**: All steps complete successfully

---

#### Test 8.2: Inventory Adjustment Flow
**Steps**:
1. Login
2. Create stock adjustment
3. Verify stock balance updated
4. Verify inventory transaction created

**Pass Criteria**: Stock balance and transaction are correct

---

## Performance Tests

### 9. Query Performance Tests

#### Test 9.1: Sales Query Performance
**Steps**:
1. Run query: `SELECT * FROM sales ORDER BY created_at DESC LIMIT 100`
2. Measure execution time
3. Compare with pre-index baseline

**Pass Criteria**: Query time < 100ms (or 50% improvement)

---

#### Test 9.2: Journal Entry Query Performance
**Steps**:
1. Run query: `SELECT * FROM journal_entries WHERE status = 'POSTED'`
2. Measure execution time
3. Compare with pre-index baseline

**Pass Criteria**: Query time < 100ms (or 50% improvement)

---

## Security Tests

### 10. Security Verification Tests

#### Test 10.1: Rate Limiting Headers
**Steps**:
1. Make API request
2. Check response headers

**Expected Headers**:
- RateLimit-Limit
- RateLimit-Remaining
- RateLimit-Reset

**Pass Criteria**: Rate limit headers are present

---

#### Test 10.2: Security Headers
**Steps**:
1. Make API request
2. Check response headers

**Expected Headers**:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (in production)

**Pass Criteria**: Security headers are present

---

## Test Results Documentation

### Test Report Template

```markdown
# Staging Test Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: Staging
**API Base URL**: [URL]

## Test Results Summary

| Test Category | Total | Passed | Failed | Blocked |
|---------------|-------|--------|--------|---------|
| Automated     | [N]   | [N]    | [N]    | [N]     |
| Manual        | [N]   | [N]    | [N]    | [N]     |
| Integration   | [N]   | [N]    | [N]    | [N]     |
| Performance   | [N]   | [N]    | [N]    | [N]     |
| Security      | [N]   | [N]    | [N]    | [N]     |

## Failed Tests

### [Test Name]
- **Expected**: [Expected result]
- **Actual**: [Actual result]
- **Severity**: [Critical/High/Medium/Low]
- **Screenshot**: [Link]
- **Logs**: [Link]

## Blocked Tests

### [Test Name]
- **Reason**: [Reason]
- **Blocker**: [Blocker]

## Recommendations

[Recommendations for fixes or improvements]

## Sign-Off

- **QA Lead**: [Name] [Date]
- **Tech Lead**: [Name] [Date]
```

---

## Issue Reporting

### Issue Severity Levels
- **Critical**: Blocks production deployment
- **High**: Should be fixed before production
- **Medium**: Can be deferred with workaround
- **Low**: Nice to have fix

### Issue Template
```markdown
## Issue Title
[Brief description]

### Environment
- Staging
- API Version: [Version]
- Date: [Date]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Screenshots/Logs
[Attach screenshots or logs]

### Severity
[Critical/High/Medium/Low]
```

---

## Test Execution Timeline

### Day 1: Environment Setup & Automated Tests
- **Morning**: Environment setup, test data preparation
- **Afternoon**: Run automated test script, review results

### Day 2: Manual Functional Tests
- **Morning**: MFA tests, rate limiting tests
- **Afternoon**: Database verification tests, secret management tests

### Day 3: Integration & Performance Tests
- **Morning**: Integration tests, end-to-end workflows
- **Afternoon**: Performance tests, security tests
- **End of Day**: Compile test report

---

## Success Criteria

### Must Pass (Critical)
- [ ] All automated tests pass
- [ ] Health and readiness endpoints work
- [ ] MFA setup and verification works
- [ ] Rate limiting is active
- [ ] Database indexes are present
- [ ] Database constraints are active

### Should Pass (Important)
- [ ] Performance meets requirements
- [ ] Security headers are present
- [ ] Integration tests pass
- [ ] No critical issues found

### Nice to Have (Optional)
- [ ] All manual tests pass
- [ ] No high-severity issues
- [ ] Performance improvement > 50%

---

## Contact Information

### QA Team
- **QA Lead**: [Contact]
- **QA Engineer**: [Contact]

### Support
- **Backend Lead**: [Contact]
- **DevOps Lead**: [Contact]
- **DBA**: [Contact]

---

## References

- **Test Plan**: docs/FINAL_PRODUCTION_TEST_PLAN.md
- **Execution Script**: scripts/run-staging-tests.sh
- **Deployment Checklist**: docs/FINAL_DEPLOYMENT_CHECKLIST.md
- **Implementation Progress**: docs/IMPLEMENTATION_PROGRESS.md
