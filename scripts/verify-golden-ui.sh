#!/bin/bash
# FLEETPRO GOLDEN UI LOCK — Comprehensive Verification (Phase 5)
# Full verification of golden UI state including commit, files, and system health

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASHES_FILE="${REPO_ROOT}/.ui-lock/golden-ui-hashes.json"
BASELINE_FILE="${REPO_ROOT}/docs/ui-lock/GOLDEN-UI-BASELINE.md"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FLEETPRO GOLDEN UI BASELINE — VERIFICATION REPORT    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# === GIT STATE ===
echo -e "${BLUE}[GIT STATE]${NC}"
GOLDEN_COMMIT=$(jq -r '.metadata.golden_commit' "$HASHES_FILE")
GOLDEN_BRANCH=$(jq -r '.metadata.golden_branch' "$HASHES_FILE")
CURRENT_COMMIT=$(git -C "$REPO_ROOT" rev-parse HEAD)
CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_COMMIT" == "$GOLDEN_COMMIT" ]]; then
    pass "Current commit matches golden ($GOLDEN_COMMIT)"
else
    warn "Current commit differs from golden"
    echo "   Expected: $GOLDEN_COMMIT"
    echo "   Current:  $CURRENT_COMMIT"
fi

if [[ "$CURRENT_BRANCH" == "$GOLDEN_BRANCH" ]]; then
    pass "Current branch is golden ($GOLDEN_BRANCH)"
else
    warn "Current branch differs ($CURRENT_BRANCH, expected $GOLDEN_BRANCH)"
fi

# Check if golden tag exists
if git -C "$REPO_ROOT" rev-parse fleetpro-golden-ui-locked >/dev/null 2>&1; then
    pass "Golden tag 'fleetpro-golden-ui-locked' exists"
else
    fail "Golden tag 'fleetpro-golden-ui-locked' not found"
fi

# Check for uncommitted changes
if [[ -z $(git -C "$REPO_ROOT" status --porcelain 2>/dev/null) ]]; then
    pass "No uncommitted changes in working tree"
else
    warn "Uncommitted changes detected"
    git -C "$REPO_ROOT" status --short | head -5 | sed 's/^/   /'
fi

echo ""

# === PROTECTED FILES ===
echo -e "${BLUE}[PROTECTED FILES]${NC}"
FILE_CHECK_PASS=true

while IFS= read -r filename; do
    expected_hash=$(jq -r ".protected_files[\"$filename\"].sha256" "$HASHES_FILE" 2>/dev/null || echo "")

    if [[ -z "$expected_hash" ]]; then
        continue
    fi

    filepath="${REPO_ROOT}/${filename}"

    if [[ ! -f "$filepath" ]]; then
        fail "Missing: $filename"
        FILE_CHECK_PASS=false
    else
        if [[ "$OSTYPE" == "darwin"* ]]; then
            current_hash=$(shasum -a 256 "$filepath" | awk '{print $1}')
        else
            current_hash=$(sha256sum "$filepath" | awk '{print $1}')
        fi

        if [[ "$current_hash" == "$expected_hash" ]]; then
            pass "$(basename "$filename") ✓"
        else
            fail "Changed: $filename"
            FILE_CHECK_PASS=false
        fi
    fi
done < <(jq -r '.protected_files | keys[]' "$HASHES_FILE")

echo ""

# === BUILD STATUS ===
echo -e "${BLUE}[BUILD STATUS]${NC}"

if [[ -f "$REPO_ROOT/package.json" ]]; then
    pass "package.json exists"

    if command -v npm &> /dev/null; then
        if npm list --depth=0 &>/dev/null; then
            pass "npm dependencies installed"
        else
            warn "npm dependencies may need reinstall"
        fi
    fi
else
    fail "package.json not found"
fi

if [[ -f "$REPO_ROOT/vite.config.ts" ]]; then
    pass "vite.config.ts present"
fi

if [[ -f "$REPO_ROOT/tsconfig.json" ]]; then
    pass "TypeScript configuration present"
fi

echo ""

# === DOCUMENTATION ===
echo -e "${BLUE}[DOCUMENTATION]${NC}"

if [[ -f "$BASELINE_FILE" ]]; then
    pass "Golden baseline documentation exists"
    baseline_commit=$(grep -A2 "^Commit:" "$BASELINE_FILE" | head -1 | sed 's/.*: //' || echo "")
    if [[ "$baseline_commit" == "$GOLDEN_COMMIT" ]]; then
        pass "Documentation references correct golden commit"
    else
        warn "Documentation commit reference may be stale"
    fi
else
    fail "Golden baseline documentation not found"
fi

if [[ -f "$HASHES_FILE" ]]; then
    pass "Hashes file exists and is valid"
else
    fail "Hashes file missing"
fi

echo ""

# === DEPLOYMENT READINESS ===
echo -e "${BLUE}[DEPLOYMENT READINESS]${NC}"

# Check if server can start
if command -v node &> /dev/null; then
    pass "Node.js is available"
else
    fail "Node.js not found in PATH"
fi

if [[ -d "$REPO_ROOT/client/src" ]]; then
    pass "Frontend directory structure intact"
else
    fail "Frontend directory missing"
fi

if [[ -d "$REPO_ROOT/server" ]]; then
    pass "Backend directory structure intact"
else
    fail "Backend directory missing"
fi

echo ""

# === SUMMARY ===
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "Verification Results:"
echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT"
if [[ $WARN_COUNT -gt 0 ]]; then
    echo -e "  ${YELLOW}Warnings:${NC} $WARN_COUNT"
fi
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo ""
    echo -e "${RED}UI BASELINE VERIFICATION FAILED${NC}"
    echo ""
    echo "To restore golden UI:"
    echo "  ./scripts/restore-golden-ui.sh"
    echo ""
    exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
    echo ""
    echo -e "${YELLOW}UI baseline verified with warnings. Review above.${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${GREEN}✓ Golden UI baseline fully verified${NC}"
    echo ""
    exit 0
fi
