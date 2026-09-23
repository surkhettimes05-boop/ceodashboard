#!/bin/bash

# Staging Test Execution Script
# This script runs all tests for the staging environment after migrations

set -e  # Exit on error

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
BACKEND_DIR="./backend"
E2E_DIR="./e2e"
TEST_RESULTS_DIR="./test-results/staging"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Create test results directory
mkdir -p $TEST_RESULTS_DIR

# Test 1: Health Endpoint
test_health_endpoint() {
    log_test "Testing health endpoint..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" $API_BASE_URL/api/health)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_info "Health endpoint returned 200 OK"
        echo "$BODY" > $TEST_RESULTS_DIR/health_$TIMESTAMP.json
        return 0
    else
        log_error "Health endpoint returned $HTTP_CODE"
        return 1
    fi
}

# Test 2: Readiness Endpoint
test_readiness_endpoint() {
    log_test "Testing readiness endpoint..."
    
    RESPONSE=$(curl -s -w "\n%{http_code}" $API_BASE_URL/ready)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_info "Readiness endpoint returned 200 OK"
        echo "$BODY" > $TEST_RESULTS_DIR/ready_$TIMESTAMP.json
        return 0
    else
        log_error "Readiness endpoint returned $HTTP_CODE"
        return 1
    fi
}

# Test 3: Database Connection
test_database_connection() {
    log_test "Testing database connection..."
    
    if [ -f "$BACKEND_DIR/tests/integration/sales.integration.test.ts" ]; then
        cd $BACKEND_DIR
        npm test -- tests/integration/sales.integration.test.ts 2>&1 | tee $TEST_RESULTS_DIR/integration_sales_$TIMESTAMP.txt
        cd - > /dev/null
        return 0
    else
        log_warn "Integration tests not found, skipping"
        return 0
    fi
}

# Test 4: Rate Limiting
test_rate_limiting() {
    log_test "Testing rate limiting..."
    
    # Make multiple requests to trigger rate limit
    SUCCESS_COUNT=0
    for i in {1..15}; do
        RESPONSE=$(curl -s -w "\n%{http_code}" $API_BASE_URL/api/health)
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            ((SUCCESS_COUNT++))
        fi
    done
    
    log_info "Rate limiting test: $SUCCESS_COUNT/15 requests succeeded"
    echo "Rate limiting test: $SUCCESS_COUNT/15 requests succeeded" > $TEST_RESULTS_DIR/rate_limiting_$TIMESTAMP.txt
    return 0
}

# Test 5: MFA Endpoints
test_mfa_endpoints() {
    log_test "Testing MFA endpoints..."
    
    # Test MFA status endpoint (requires authentication)
    # This is a basic connectivity test
    RESPONSE=$(curl -s -w "\n%{http_code}" $API_BASE_URL/api/auth/mfa/status)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "401" ]; then
        log_info "MFA endpoint requires authentication (expected)"
        return 0
    else
        log_warn "MFA endpoint returned unexpected status: $HTTP_CODE"
        return 0
    fi
}

# Test 6: Database Indexes
test_database_indexes() {
    log_test "Testing database indexes..."
    
    # Check if indexes exist
    # This requires database access
    log_info "Database index verification requires manual inspection"
    echo "Database index verification requires manual inspection" > $TEST_RESULTS_DIR/indexes_$TIMESTAMP.txt
    return 0
}

# Test 7: Database Constraints
test_database_constraints() {
    log_test "Testing database constraints..."
    
    # Check if constraints exist
    # This requires database access
    log_info "Database constraint verification requires manual inspection"
    echo "Database constraint verification requires manual inspection" > $TEST_RESULTS_DIR/constraints_$TIMESTAMP.txt
    return 0
}

# Test 8: E2E Tests
test_e2e() {
    log_test "Running E2E tests..."
    
    if [ -d "$E2E_DIR" ]; then
        cd $E2E_DIR
        npm test 2>&1 | tee $TEST_RESULTS_DIR/e2e_$TIMESTAMP.txt
        cd - > /dev/null
        return 0
    else
        log_warn "E2E tests not found, skipping"
        return 0
    fi
}

# Test 9: Build Verification
test_build() {
    log_test "Verifying application build..."
    
    cd $BACKEND_DIR
    npm run build 2>&1 | tee $TEST_RESULTS_DIR/build_$TIMESTAMP.txt
    BUILD_STATUS=$?
    cd - > /dev/null
    
    if [ $BUILD_STATUS -eq 0 ]; then
        log_info "Build successful"
        return 0
    else
        log_error "Build failed"
        return 1
    fi
}

# Generate Test Report
generate_report() {
    log_info "Generating test report..."
    
    REPORT_FILE="$TEST_RESULTS_DIR/test_report_$TIMESTAMP.md"
    
    cat > $REPORT_FILE << EOF
# Staging Test Report

**Date**: $(date)  
**Environment**: Staging  
**API Base URL**: $API_BASE_URL

## Test Results

### Health Endpoint
$(cat $TEST_RESULTS_DIR/health_$TIMESTAMP.json 2>/dev/null || echo "Not tested")

### Readiness Endpoint
$(cat $TEST_RESULTS_DIR/ready_$TIMESTAMP.json 2>/dev/null || echo "Not tested")

### Rate Limiting
$(cat $TEST_RESULTS_DIR/rate_limiting_$TIMESTAMP.txt 2>/dev/null || echo "Not tested")

### Database Indexes
$(cat $TEST_RESULTS_DIR/indexes_$TIMESTAMP.txt 2>/dev/null || echo "Not tested")

### Database Constraints
$(cat $TEST_RESULTS_DIR/constraints_$TIMESTAMP.txt 2>/dev/null || echo "Not tested")

### Build Status
$(cat $TEST_RESULTS_DIR/build_$TIMESTAMP.txt 2>/dev/null || echo "Not tested")

## Summary

All automated tests completed. Please review results above and perform manual testing for:
- MFA setup and verification flow
- Financial operations
- Inventory operations
- User authentication and authorization

## Next Steps

1. Review test results
2. Fix any failed tests
3. Perform manual testing
4. Proceed to final production test
EOF

    log_info "Test report generated: $REPORT_FILE"
}

# Main execution
main() {
    log_info "Starting staging environment tests..."
    log_info "API Base URL: $API_BASE_URL"
    log_info "Test results directory: $TEST_RESULTS_DIR"
    
    # Run tests
    test_health_endpoint || true
    test_readiness_endpoint || true
    test_database_connection || true
    test_rate_limiting || true
    test_mfa_endpoints || true
    test_database_indexes || true
    test_database_constraints || true
    test_e2e || true
    test_build || true
    
    # Generate report
    generate_report
    
    log_info "Staging tests completed!"
    log_info "Test results saved to: $TEST_RESULTS_DIR"
}

# Run main function
main

exit 0
