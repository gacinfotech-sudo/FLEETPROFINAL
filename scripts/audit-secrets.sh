#!/bin/bash

# Audit script to find potential secrets in codebase
# Scans for common secret patterns

echo "🔍 FleetPro Secrets Audit"
echo "=============================="
echo ""

# Files to exclude from search
EXCLUDE_DIRS="node_modules|\.git|dist|build|ssl"
EXCLUDE_FILES="\.(png|jpg|gif|pdf|ttf|woff|woff2)$"

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

found_issues=0

echo "📝 Scanning for hardcoded secrets..."
echo ""

# Check for common secret patterns
patterns=(
    'password\s*[:=]\s*["\047][^"'\'']*["\047]'
    'api[_-]?key\s*[:=]\s*["\047][^"'\'']*["\047]'
    'secret\s*[:=]\s*["\047][^"'\'']*["\047]'
    'token\s*[:=]\s*["\047][^"'\'']*["\047]'
    'DATABASE_URL\s*[:=]\s*["\047]'
    'AWS_SECRET'
    'PRIVATE_KEY'
    'MONGODB_URI\s*[:=]\s*["\047]mongodb.*'
)

# Scan TypeScript/JavaScript files
echo "🔎 Scanning .ts and .js files..."
for pattern in "${patterns[@]}"; do
    matches=$(grep -r "$pattern" \
        --include="*.ts" \
        --include="*.js" \
        --include="*.tsx" \
        --include="*.jsx" \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=dist \
        --exclude-dir=build \
        . 2>/dev/null | grep -v "process.env" | grep -v "example" | head -5)

    if [ ! -z "$matches" ]; then
        echo -e "${RED}⚠️  Found potential secret pattern: $pattern${NC}"
        echo "$matches" | head -3
        echo ""
        ((found_issues++))
    fi
done

# Check .env files
echo "🔎 Scanning .env files..."
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file exists - ensure it's in .gitignore${NC}"
    echo "   File: .env"
    grep -v "^#" .env | grep -v "^$" | while read line; do
        key=$(echo "$line" | cut -d= -f1)
        if [[ $key == *"PASSWORD"* ]] || [[ $key == *"SECRET"* ]] || [[ $key == *"KEY"* ]] || [[ $key == *"TOKEN"* ]]; then
            echo "   ⚠️  Sensitive key found: $key"
        fi
    done
    echo ""
    ((found_issues++))
fi

# Check for .env in git
echo "🔎 Checking git history for .env files..."
if git ls-files --others --exclude-standard | grep -E "\.env" > /dev/null 2>&1; then
    echo -e "${RED}❌ .env file is tracked in git!${NC}"
    echo "   Add to .gitignore immediately and run: git rm --cached .env"
    echo ""
    ((found_issues++))
fi

# Check package.json for sensitive data
echo "🔎 Checking package.json..."
if grep -E '"password"|"secret"|"api_key"|"private_key"' package.json > /dev/null 2>&1; then
    echo -e "${RED}⚠️  Found sensitive fields in package.json${NC}"
    ((found_issues++))
fi

# Check for AWS credentials pattern
echo "🔎 Scanning for AWS credential patterns..."
if grep -r "AKIA[0-9A-Z]\{16\}" --include="*.ts" --include="*.js" . 2>/dev/null | head -1; then
    echo -e "${RED}❌ Found AWS access key format${NC}"
    ((found_issues++))
fi

# Check MongoDB connection strings with credentials
echo "🔎 Scanning for MongoDB URIs with credentials..."
if grep -r "mongodb.*@" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v "example" | head -1; then
    echo -e "${RED}⚠️  Found MongoDB URI with possible credentials${NC}"
    ((found_issues++))
fi

# Summary
echo ""
echo "=============================="
if [ $found_issues -eq 0 ]; then
    echo -e "${GREEN}✅ No obvious secrets found${NC}"
else
    echo -e "${YELLOW}⚠️  Found $found_issues potential issue(s)${NC}"
fi

echo ""
echo "📋 Recommendations:"
echo "   1. Never commit .env files - add to .gitignore"
echo "   2. Use environment variables for all secrets"
echo "   3. Rotate any exposed credentials immediately"
echo "   4. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)"
echo "   5. Use npm audit to check dependencies"
echo ""
echo "🔐 If secrets were found:"
echo "   1. Rotate credentials immediately"
echo "   2. Remove from git history: git filter-branch or git-filter-repo"
echo "   3. Review who has access to the secret"
echo "   4. Update deployment secrets"
echo ""

exit $found_issues
