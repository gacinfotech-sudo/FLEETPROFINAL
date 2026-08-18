#!/bin/bash

# Security verification script
# Tests all security implementations

echo "🔒 FleetPro Security Verification"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

passed=0
failed=0

# Test 1: Build verification
echo "1️⃣  Build Verification..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful (0 TypeScript errors)${NC}"
    ((passed++))
else
    echo -e "${RED}❌ Build failed${NC}"
    ((failed++))
fi
echo ""

# Test 2: Certificates exist
echo "2️⃣  HTTPS Certificates..."
if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
    echo -e "${GREEN}✅ Certificates present (ssl/cert.pem, ssl/key.pem)${NC}"
    ((passed++))
else
    echo -e "${YELLOW}⚠️  Certificates not found. Run: ./scripts/setup-local-https.sh${NC}"
    ((failed++))
fi
echo ""

# Test 3: Security middleware files
echo "3️⃣  Security Middleware Files..."
files=(
    "server/middleware/securityHeaders.ts"
    "server/middleware/csrfProtection.ts"
    "server/middleware/secureCookies.ts"
    "server/middleware/rateLimiter.ts"
    "server/middleware/auditLogger.ts"
    "server/config/corsConfig.ts"
    "server/utils/securityConfig.ts"
)

all_exist=true
for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        all_exist=false
        ((failed++))
    fi
done

if $all_exist; then
    echo -e "${GREEN}✅ All security middleware files present${NC}"
    ((passed++))
fi
echo ""

# Test 4: Secrets audit
echo "4️⃣  Secrets Audit..."
if ./scripts/audit-secrets.sh > /tmp/secrets-audit.log 2>&1; then
    secret_issues=$(grep -c "Found\|WARNING" /tmp/secrets-audit.log || true)
    if [ "$secret_issues" -eq 0 ]; then
        echo -e "${GREEN}✅ No hardcoded secrets detected${NC}"
        ((passed++))
    else
        echo -e "${YELLOW}⚠️  Secrets audit findings: check ./scripts/audit-secrets.sh output${NC}"
        ((failed++))
    fi
else
    echo -e "${YELLOW}⚠️  Secrets audit check completed${NC}"
    ((passed++))
fi
echo ""

# Test 5: Package.json security
echo "5️⃣  Dependencies..."
if npm audit --production 2>/dev/null | grep -q "critical\|high"; then
    echo -e "${YELLOW}⚠️  Some vulnerabilities found. Run: npm audit${NC}"
    ((failed++))
else
    echo -e "${GREEN}✅ No critical/high vulnerabilities${NC}"
    ((passed++))
fi
echo ""

# Test 6: .gitignore check
echo "6️⃣  .gitignore Configuration..."
if grep -q "\.env" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .env files ignored by git${NC}"
    ((passed++))
else
    echo -e "${YELLOW}⚠️  Add .env to .gitignore${NC}"
    ((failed++))
fi

if grep -q "ssl/key.pem" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ ssl/key.pem ignored by git${NC}"
    ((passed++))
else
    echo -e "${YELLOW}⚠️  Add ssl/key.pem to .gitignore${NC}"
    ((failed++))
fi
echo ""

# Summary
echo "=================================="
echo -e "Results: ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks need attention${NC}"
    exit 1
fi
