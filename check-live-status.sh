#!/bin/bash

# Fleet Pro Live (5050) Status Check
# Run this before major work to verify all systems operational

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  FLEET PRO LIVE STATUS CHECK (Port 5050)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Helper function to print status
check_status() {
    local name="$1"
    local result="$2"

    if [ "$result" -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} $name"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

warn_status() {
    local name="$1"
    echo -e "${YELLOW}⚠${NC} $name"
    WARN_COUNT=$((WARN_COUNT + 1))
}

echo "1. PROCESS STATUS"
echo "─────────────────────────────────────────────────────────────────"

# Check if server is running on port 5050
if PID=$(lsof -i :5050 2>/dev/null | grep node | awk '{print $2}' | head -1); then
    echo -e "${GREEN}✓${NC} Server running on :5050 (PID: $PID)"
    PASS_COUNT=$((PASS_COUNT + 1))

    # Get more info about the process
    ps -p $PID -o %cpu,%mem,etime | tail -1 | awk '{print "  CPU: " $1 " | Memory: " $2 " | Uptime: " $3}'
else
    echo -e "${RED}✗${NC} Server NOT running on :5050"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "2. API CONNECTIVITY"
echo "─────────────────────────────────────────────────────────────────"

# Check if API is responding
if curl -s -m 5 http://localhost:5050 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend responding"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} Frontend not responding"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Try a simple API call
if curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:5050/api/auth/status 2>/dev/null | grep -q "200\|401\|403"; then
    echo -e "${GREEN}✓${NC} API responding"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} API not responding"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "3. DATABASE CONNECTION"
echo "─────────────────────────────────────────────────────────────────"

# Check if MongoDB connection is working
if [ -z "$MONGODB_URI" ]; then
    warn_status "MONGODB_URI not set in environment"
else
    if mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MongoDB Atlas connected"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} MongoDB Atlas connection failed"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
fi

echo ""
echo "4. ENVIRONMENT & CONFIGURATION"
echo "─────────────────────────────────────────────────────────────────"

# Check if .env exists
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file present"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} .env file missing"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check if key env vars are set
if grep -q "MONGODB_URI=" .env 2>/dev/null; then
    echo -e "${GREEN}✓${NC} MONGODB_URI configured"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} MONGODB_URI not configured"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if grep -q "SESSION_SECRET=" .env 2>/dev/null && [ $(grep "SESSION_SECRET=" .env | cut -d'=' -f2 | wc -c) -gt 33 ]; then
    echo -e "${GREEN}✓${NC} SESSION_SECRET configured (valid length)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠${NC} SESSION_SECRET may be missing or too short"
    WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""
echo "5. BUILD & BUNDLE STATUS"
echo "─────────────────────────────────────────────────────────────────"

# Check if dist exists (for production mode)
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} Production build (dist/) exists"
    PASS_COUNT=$((PASS_COUNT + 1))

    # Check freshness (within last 1 hour)
    BUILD_AGE=$(find dist -type f -name "index.js" -mmin -60 2>/dev/null | wc -l)
    if [ $BUILD_AGE -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Build is recent (< 1 hour old)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠${NC} Build is older than 1 hour (may need refresh)"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} dist/ not found (running in dev mode?)"
    WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""
echo "6. SYSTEM RESOURCES"
echo "─────────────────────────────────────────────────────────────────"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 90 ]; then
    echo -e "${GREEN}✓${NC} Disk usage: ${DISK_USAGE}% (OK)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} Disk usage: ${DISK_USAGE}% (CRITICAL)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Check memory availability (simplified for macOS)
if [ "$(uname)" = "Darwin" ]; then
    AVAIL_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/[^0-9]*//g')
    if [ -n "$AVAIL_MEM" ] && [ $AVAIL_MEM -gt 100000 ]; then
        echo -e "${GREEN}✓${NC} Memory available"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠${NC} Memory might be low"
        WARN_COUNT=$((WARN_COUNT + 1))
    fi
fi

echo ""
echo "7. GIT STATUS"
echo "─────────────────────────────────────────────────────────────────"

# Check branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "${GREEN}✓${NC} On main branch"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠${NC} On branch: $CURRENT_BRANCH (not main)"
    WARN_COUNT=$((WARN_COUNT + 1))
fi

# Check if main is clean
if git status --short | grep -q "^ M\|^??"; then
    echo -e "${YELLOW}⚠${NC} Uncommitted changes in main branch:"
    git status --short | grep -v "^??" | head -3
    WARN_COUNT=$((WARN_COUNT + 1))
else
    echo -e "${GREEN}✓${NC} Main branch clean"
    PASS_COUNT=$((PASS_COUNT + 1))
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Pass: $PASS_COUNT${NC}  ${RED}Fail: $FAIL_COUNT${NC}  ${YELLOW}Warn: $WARN_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ LIVE SYSTEM READY FOR TESTING${NC}"
    exit 0
else
    echo -e "${RED}✗ LIVE SYSTEM HAS ISSUES — FIX BEFORE PROCEEDING${NC}"
    exit 1
fi
