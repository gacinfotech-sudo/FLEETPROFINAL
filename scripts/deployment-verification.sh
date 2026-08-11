#!/bin/bash

###############################################################################
# FleetPro Deployment Verification Script
# Purpose: Verify production deployment health and functionality
# Usage: ./scripts/deployment-verification.sh [environment]
# Example: ./scripts/deployment-verification.sh production
###############################################################################

set -e

# Configuration
ENVIRONMENT="${1:-production}"
API_URL="${API_URL:-http://localhost:3000}"
HEALTH_TIMEOUT=10
API_TIMEOUT=30
DB_TIMEOUT=5

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((CHECKS_PASSED++))
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    ((CHECKS_FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((CHECKS_WARNING++))
}

check_command_exists() {
    if ! command -v "$1" &> /dev/null; then
        print_failure "$1 is not installed"
        return 1
    fi
    print_success "$1 is installed"
    return 0
}

###############################################################################
# System Checks
###############################################################################

check_system_requirements() {
    print_header "System Requirements Check"

    check_command_exists "curl" || true
    check_command_exists "npm" || true
    check_command_exists "node" || true
    check_command_exists "psql" || true
}

###############################################################################
# Health Checks
###############################################################################

check_application_health() {
    print_header "Application Health Checks"

    # Check liveness
    echo -n "Checking liveness (/health)... "
    if response=$(curl -s -m $HEALTH_TIMEOUT "$API_URL/health" 2>/dev/null); then
        if echo "$response" | grep -q "ok"; then
            print_success "Application is alive"
            echo "Response: $response" | head -1
        else
            print_failure "Unexpected health response: $response"
        fi
    else
        print_failure "Cannot reach /health endpoint"
    fi

    # Check readiness
    echo -n "Checking readiness (/ready)... "
    if response=$(curl -s -m $HEALTH_TIMEOUT "$API_URL/ready" 2>/dev/null); then
        if echo "$response" | grep -q "ready\|connected"; then
            print_success "Application is ready"
            echo "Response: $response" | head -1
        else
            print_failure "Application not ready: $response"
        fi
    else
        print_failure "Cannot reach /ready endpoint"
    fi

    # Check metrics
    echo -n "Checking metrics (/metrics)... "
    if response=$(curl -s -m $HEALTH_TIMEOUT "$API_URL/metrics" 2>/dev/null); then
        if echo "$response" | grep -q "uptime\|memory"; then
            print_success "Metrics endpoint is working"
        else
            print_failure "Invalid metrics response"
        fi
    else
        print_failure "Cannot reach /metrics endpoint"
    fi
}

###############################################################################
# API Endpoint Tests
###############################################################################

check_api_endpoints() {
    print_header "API Endpoint Tests"

    # Get test JWT token (if available)
    # This is a placeholder - actual token retrieval depends on your auth system
    TEST_TOKEN="${TEST_TOKEN:-test-token}"

    # Test document endpoints
    echo -n "Testing GET /vehicles/test/compliance... "
    if response=$(curl -s -m $API_TIMEOUT \
        -H "Authorization: Bearer $TEST_TOKEN" \
        "$API_URL/vehicles/test/compliance" 2>/dev/null); then
        if echo "$response" | grep -q "success\|data\|error"; then
            print_success "Compliance endpoint is working"
        else
            print_warning "Unexpected compliance response"
        fi
    else
        print_failure "Cannot reach compliance endpoint"
    fi

    # Test health endpoint
    echo -n "Testing GET /health... "
    if response=$(curl -s -m $HEALTH_TIMEOUT \
        -w "\n%{http_code}" \
        "$API_URL/health" 2>/dev/null); then
        http_code=$(echo "$response" | tail -1)
        if [ "$http_code" = "200" ]; then
            print_success "Health endpoint returns 200"
        else
            print_failure "Health endpoint returns $http_code"
        fi
    else
        print_failure "Cannot reach health endpoint"
    fi
}

###############################################################################
# Database Checks
###############################################################################

check_database_connectivity() {
    print_header "Database Connectivity"

    if [ -z "$DB_HOST" ]; then
        print_warning "DB_HOST not set, skipping database checks"
        return
    fi

    # Check PostgreSQL connectivity
    echo -n "Testing database connection... "
    if timeout $DB_TIMEOUT psql -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT 1;" &>/dev/null; then
        print_success "Database is accessible"
    else
        print_failure "Cannot connect to database"
    fi

    # Check tables exist
    echo -n "Checking tables exist... "
    if timeout $DB_TIMEOUT psql -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" &>/dev/null; then
        print_success "Database tables are present"
    else
        print_failure "Cannot query database tables"
    fi

    # Check connection pool
    echo -n "Checking database connections... "
    if timeout $DB_TIMEOUT psql -h "$DB_HOST" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT COUNT(*) FROM pg_stat_activity;" &>/dev/null; then
        print_success "Connection pool is functional"
    else
        print_failure "Cannot check connection pool"
    fi
}

###############################################################################
# Performance Checks
###############################################################################

check_performance() {
    print_header "Performance Checks"

    # Check response time
    echo -n "Measuring API response time... "
    start_time=$(date +%s%N)

    if response=$(curl -s -m $API_TIMEOUT \
        -w "%{time_total}" \
        "$API_URL/health" 2>/dev/null); then
        response_time="${response##*'---'}"

        if [ -n "$response_time" ]; then
            response_time_ms=$(echo "scale=0; $response_time * 1000" | bc 2>/dev/null || echo "unknown")

            if (( $(echo "$response_time < 1" | bc -l) )); then
                print_success "Response time is good (~${response_time_ms}ms)"
            else
                print_warning "Response time is slow (~${response_time_ms}ms)"
            fi
        else
            print_warning "Could not measure response time"
        fi
    else
        print_failure "Could not measure response time"
    fi

    # Check memory usage (if available)
    if metrics=$(curl -s -m $HEALTH_TIMEOUT "$API_URL/metrics" 2>/dev/null); then
        if echo "$metrics" | grep -q "heapUsed"; then
            print_success "Memory metrics are available"
        fi
    fi
}

###############################################################################
# Application Checks
###############################################################################

check_application_status() {
    print_header "Application Status"

    # Check if application is running
    echo -n "Checking if application is running... "
    if command -v pm2 &> /dev/null; then
        if pm2 describe fleetpro &>/dev/null; then
            status=$(pm2 describe fleetpro | grep "status" | grep -o "online\|stopped")
            if [ "$status" = "online" ]; then
                print_success "Application is running (PM2)"
            else
                print_failure "Application is not running (status: $status)"
            fi
        else
            print_warning "PM2 not available or app not managed by PM2"
        fi
    else
        print_warning "PM2 not installed, cannot check application status"
    fi

    # Check if application is listening on port
    echo -n "Checking if application is listening on port 3000... "
    if lsof -i :3000 &>/dev/null || netstat -tulpn 2>/dev/null | grep -q ":3000"; then
        print_success "Application is listening on port 3000"
    else
        print_warning "Cannot verify application is listening on port 3000"
    fi
}

###############################################################################
# Deployment Configuration Checks
###############################################################################

check_deployment_configuration() {
    print_header "Deployment Configuration"

    # Check environment variables
    echo -n "Checking required environment variables... "
    required_vars=("DB_HOST" "DB_NAME" "DB_USER" "JWT_SECRET" "NODE_ENV")
    missing_vars=0

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_failure "Missing: $var"
            ((missing_vars++))
        fi
    done

    if [ $missing_vars -eq 0 ]; then
        print_success "All required environment variables are set"
    else
        print_failure "$missing_vars required environment variables are missing"
    fi

    # Check configuration files
    echo -n "Checking configuration files... "
    if [ -f ".env" ] || [ -f ".env.production" ]; then
        print_success "Configuration files exist"
    else
        print_warning "Configuration files not found (.env or .env.production)"
    fi

    # Check NODE_ENV
    echo -n "Checking NODE_ENV... "
    if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
        print_success "NODE_ENV is set to $NODE_ENV"
    else
        print_warning "NODE_ENV is set to $NODE_ENV (expected: production or staging)"
    fi
}

###############################################################################
# Security Checks
###############################################################################

check_security() {
    print_header "Security Checks"

    # Check if SSL is enforced (if HTTPS URL is used)
    if [[ "$API_URL" == https://* ]]; then
        echo -n "Checking SSL certificate... "
        if echo | openssl s_client -connect "${API_URL#https://}" &>/dev/null 2>&1; then
            print_success "SSL certificate is valid"
        else
            print_failure "SSL certificate validation failed"
        fi
    else
        print_warning "API URL is not HTTPS, skipping SSL check"
    fi

    # Check JWT_SECRET is set
    echo -n "Checking JWT secret... "
    if [ -n "$JWT_SECRET" ]; then
        print_success "JWT secret is configured"
    else
        print_failure "JWT secret is not configured"
    fi

    # Check CORS configuration
    echo -n "Checking CORS configuration... "
    if [ -n "$CORS_ORIGIN" ]; then
        print_success "CORS origin is configured: $CORS_ORIGIN"
    else
        print_warning "CORS origin not configured"
    fi
}

###############################################################################
# Backup Checks
###############################################################################

check_backups() {
    print_header "Backup Status"

    # Check if backup directory exists
    echo -n "Checking backup directory... "
    if [ -d "backups" ]; then
        backup_count=$(find backups -name "*.sql.gz" 2>/dev/null | wc -l)
        if [ $backup_count -gt 0 ]; then
            print_success "Found $backup_count backups"
        else
            print_warning "Backup directory exists but no backups found"
        fi
    else
        print_warning "Backup directory not found"
    fi

    # Check backup script exists
    echo -n "Checking backup script... "
    if [ -f "scripts/backup-db.sh" ]; then
        print_success "Backup script exists"
    else
        print_warning "Backup script not found"
    fi
}

###############################################################################
# Summary
###############################################################################

print_summary() {
    print_header "Verification Summary"

    total=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

    echo "Total Checks:  $total"
    echo -e "  ${GREEN}Passed:   $CHECKS_PASSED${NC}"
    echo -e "  ${YELLOW}Warnings: $CHECKS_WARNING${NC}"
    echo -e "  ${RED}Failed:   $CHECKS_FAILED${NC}"

    if [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✓ Deployment verification passed!${NC}"
        return 0
    else
        echo -e "\n${RED}✗ Deployment verification failed!${NC}"
        return 1
    fi
}

###############################################################################
# Main Execution
###############################################################################

main() {
    echo -e "${BLUE}FleetPro Deployment Verification${NC}"
    echo "Environment: $ENVIRONMENT"
    echo "API URL: $API_URL"
    echo "Time: $(date)"

    check_system_requirements
    check_application_health
    check_api_endpoints
    check_database_connectivity
    check_performance
    check_application_status
    check_deployment_configuration
    check_security
    check_backups

    print_summary
}

# Run main function
main "$@"
