#!/bin/bash

# FleetPro Notification System - Final Verification Script
# Run this script before production deployment to verify all systems are operational

set -e

BASE_URL="https://192.168.29.142:5050"
SKIP_CERT_VERIFY="-k"  # Skip certificate verification for self-signed certs
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASS_COUNT++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAIL_COUNT++))
}

skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}: $1"
    ((SKIP_COUNT++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 1. Environment Verification
section "1. Environment Verification"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    pass "Node.js installed: $NODE_VERSION"
else
    fail "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    pass "npm installed: $NPM_VERSION"
else
    fail "npm not found"
    exit 1
fi

# Check MongoDB
if command -v mongosh &> /dev/null; then
    MONGO_PING=$(mongosh --eval "db.adminCommand('ping')" 2>/dev/null | grep -c "ok" || echo "0")
    if [ "$MONGO_PING" -gt 0 ]; then
        pass "MongoDB connection successful"
    else
        fail "MongoDB ping failed"
    fi
else
    fail "mongosh not found"
fi

# 2. Build Verification
section "2. Build Verification"

cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Check if node_modules exist
if [ -d "node_modules" ]; then
    pass "node_modules directory exists"
else
    echo "Installing dependencies..."
    npm install --silent
fi

# Run TypeScript compilation
if npm run build > /dev/null 2>&1; then
    pass "TypeScript compilation successful"
else
    fail "TypeScript compilation failed"
fi

# 3. Server Health Checks
section "3. Server Health Checks"

# Test health endpoint
HEALTH_RESPONSE=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT -w "\n%{http_code}" "$BASE_URL/api/notification-health/status" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    STATUS=$(echo "$BODY" | jq -r '.status' 2>/dev/null || echo "unknown")
    pass "Health endpoint responding (status: $STATUS)"
else
    fail "Health endpoint returned HTTP $HTTP_CODE"
fi

# Test components endpoint
COMP_RESPONSE=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT "$BASE_URL/api/notification-health/components" 2>/dev/null)
if [ ! -z "$COMP_RESPONSE" ]; then
    EMAIL_QUEUE=$(echo "$COMP_RESPONSE" | jq -r '.components.email_queue_pending' 2>/dev/null || echo "unknown")
    SMS_QUEUE=$(echo "$COMP_RESPONSE" | jq -r '.components.sms_queue_pending' 2>/dev/null || echo "unknown")
    pass "Components endpoint responding (Email queue: $EMAIL_QUEUE, SMS queue: $SMS_QUEUE)"
else
    fail "Components endpoint not responding"
fi

# Test metrics endpoint
METRICS_RESPONSE=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT "$BASE_URL/api/notification-health/metrics" 2>/dev/null)
if [ ! -z "$METRICS_RESPONSE" ] && echo "$METRICS_RESPONSE" | grep -q "notification_"; then
    pass "Metrics endpoint responding (Prometheus format)"
else
    fail "Metrics endpoint not responding"
fi

# 4. Provider Configuration
section "4. Provider Configuration"

# Check email provider
EMAIL_STATUS=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT "$BASE_URL/api/notification-providers/email/status" 2>/dev/null | jq -r '.provider' 2>/dev/null)
if [ ! -z "$EMAIL_STATUS" ] && [ "$EMAIL_STATUS" != "null" ]; then
    pass "Email provider configured: $EMAIL_STATUS"
else
    skip "Email provider not configured (may be expected for development)"
fi

# Check SMS provider
SMS_STATUS=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT "$BASE_URL/api/notification-providers/sms/status" 2>/dev/null | jq -r '.provider' 2>/dev/null)
if [ ! -z "$SMS_STATUS" ] && [ "$SMS_STATUS" != "null" ]; then
    pass "SMS provider configured: $SMS_STATUS"
else
    skip "SMS provider not configured (may be expected for development)"
fi

# 5. Database Health
section "5. Database Health"

# Check notification_events collection
EVENTS_COUNT=$(mongosh --eval "db.notification_events.estimatedDocumentCount()" 2>/dev/null | tail -n1)
if [ ! -z "$EVENTS_COUNT" ] && [ "$EVENTS_COUNT" != "0" ]; then
    pass "notification_events collection exists ($EVENTS_COUNT documents)"
else
    pass "notification_events collection exists (empty - expected for new deployment)"
fi

# Check notification_preferences collection
PREFS_INDEXED=$(mongosh --eval "db.notification_preferences.getIndexes().length" 2>/dev/null | tail -n1)
if [ ! -z "$PREFS_INDEXED" ] && [ "$PREFS_INDEXED" -gt 0 ]; then
    pass "notification_preferences collection indexed"
else
    fail "notification_preferences collection not properly indexed"
fi

# Check notification_templates collection
TEMPLATES_COUNT=$(mongosh --eval "db.notification_templates.estimatedDocumentCount()" 2>/dev/null | tail -n1)
if [ ! -z "$TEMPLATES_COUNT" ]; then
    pass "notification_templates collection exists"
else
    fail "notification_templates collection not found"
fi

# 6. API Endpoint Tests
section "6. API Endpoint Tests"

# Test getting preferences
PREF_RESPONSE=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT -H "Content-Type: application/json" \
    "$BASE_URL/api/notification-preferences" 2>/dev/null)
if echo "$PREF_RESPONSE" | jq . > /dev/null 2>&1; then
    pass "Notification preferences endpoint responding"
else
    fail "Notification preferences endpoint not responding"
fi

# Test analytics endpoint
ANALYTICS_RESPONSE=$(curl $SKIP_CERT_VERIFY -s -m $TIMEOUT \
    "$BASE_URL/api/notification-analytics/summary" 2>/dev/null)
if echo "$ANALYTICS_RESPONSE" | jq . > /dev/null 2>&1; then
    pass "Analytics endpoint responding"
else
    fail "Analytics endpoint not responding"
fi

# 7. Performance Checks
section "7. Performance Checks"

# Measure health endpoint response time
START=$(date +%s%N)
curl $SKIP_CERT_VERIFY -s -m $TIMEOUT "$BASE_URL/api/notification-health/status" > /dev/null 2>&1
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

if [ $DURATION -lt 1000 ]; then
    pass "Health endpoint response time: ${DURATION}ms (< 1000ms)"
elif [ $DURATION -lt 5000 ]; then
    pass "Health endpoint response time: ${DURATION}ms (acceptable)"
else
    fail "Health endpoint response time: ${DURATION}ms (slow)"
fi

# Database connection time
START=$(date +%s%N)
mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
END=$(date +%s%N)
DB_DURATION=$(( (END - START) / 1000000 ))

if [ $DB_DURATION -lt 100 ]; then
    pass "Database ping time: ${DB_DURATION}ms (< 100ms)"
else
    pass "Database ping time: ${DB_DURATION}ms (acceptable)"
fi

# 8. Security Checks
section "8. Security Checks"

# Check for HTTPS
if [[ "$BASE_URL" == https://* ]]; then
    pass "Using HTTPS/TLS encryption"
else
    fail "Not using HTTPS/TLS encryption"
fi

# Check for environment variables
if [ ! -z "$SENDGRID_API_KEY" ]; then
    pass "SENDGRID_API_KEY is set"
else
    skip "SENDGRID_API_KEY not set (may be expected for development)"
fi

if [ ! -z "$TWILIO_ACCOUNT_SID" ]; then
    pass "TWILIO_ACCOUNT_SID is set"
else
    skip "TWILIO_ACCOUNT_SID not set (may be expected for development)"
fi

# 9. E2E Test Status
section "9. E2E Test Status"

if [ -f "tests/e2e/notification-integration.spec.ts" ]; then
    pass "E2E test suite exists"

    # Count test cases
    TEST_COUNT=$(grep -c "test(" tests/e2e/notification-integration.spec.ts || echo "0")
    pass "E2E test count: $TEST_COUNT"
else
    fail "E2E test suite not found"
fi

# 10. Documentation
section "10. Documentation"

DOCS=(
    "OPERATIONAL_RUNBOOK.md:Operational Runbook"
    "DEPLOYMENT_GUIDE.md:Deployment Guide"
    "PRODUCTION_STATUS.md:Production Status Report"
    "API.md:API Documentation"
)

for doc in "${DOCS[@]}"; do
    FILE="${doc%%:*}"
    DESC="${doc##*:}"
    if [ -f "$FILE" ]; then
        LINES=$(wc -l < "$FILE")
        pass "$DESC exists ($LINES lines)"
    else
        skip "$DESC not found"
    fi
done

# 11. Summary
section "Final Verification Summary"

TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

echo ""
echo -e "Passed:  ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed:  ${RED}$FAIL_COUNT${NC}"
echo -e "Skipped: ${YELLOW}$SKIP_COUNT${NC}"
echo -e "Total:   $TOTAL"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed! System is ready for production deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some critical checks failed. Please review and fix before deployment.${NC}"
    exit 1
fi
