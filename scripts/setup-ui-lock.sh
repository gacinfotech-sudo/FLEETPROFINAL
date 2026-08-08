#!/bin/bash
# FLEETPRO UI LOCK — Setup Script (Phase 27)
# Initialize UI lock in a new environment or verify existing setup

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASHES_FILE="${REPO_ROOT}/.ui-lock/golden-ui-hashes.json"
PROTECTED_FILES_LIST="${REPO_ROOT}/.ui-lock/protected-ui-files.txt"
GOLDEN_TAG="fleetpro-golden-ui-locked"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FLEETPRO UI LOCK — Environment Setup (Phase 27)      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [[ ! -f "${REPO_ROOT}/package.json" ]]; then
    echo -e "${RED}ERROR: Not in a FleetPro repository${NC}"
    echo "Current directory: $REPO_ROOT"
    exit 1
fi

echo -e "${BLUE}[CHECKING SETUP]${NC}"
echo ""

# Check 1: Hash file exists
echo -n "✓ Hash file (.ui-lock/golden-ui-hashes.json)... "
if [[ -f "$HASHES_FILE" ]]; then
    echo -e "${GREEN}Found${NC}"
    HASHES_OK=true
else
    echo -e "${RED}Missing${NC}"
    HASHES_OK=false
fi

# Check 2: Protected files list exists
echo -n "✓ Protected files list (.ui-lock/protected-ui-files.txt)... "
if [[ -f "$PROTECTED_FILES_LIST" ]]; then
    echo -e "${GREEN}Found${NC}"
    PROTECTED_OK=true
else
    echo -e "${RED}Missing${NC}"
    PROTECTED_OK=false
fi

# Check 3: Pre-commit hook exists
echo -n "✓ Pre-commit hook (.git/hooks/pre-commit)... "
if [[ -f "${REPO_ROOT}/.git/hooks/pre-commit" ]]; then
    if [[ -x "${REPO_ROOT}/.git/hooks/pre-commit" ]]; then
        echo -e "${GREEN}Installed${NC}"
        HOOK_OK=true
    else
        echo -e "${YELLOW}Not executable${NC}"
        HOOK_OK=false
    fi
else
    echo -e "${RED}Missing${NC}"
    HOOK_OK=false
fi

# Check 4: Scripts exist
echo -n "✓ Check script (scripts/check-ui-lock.sh)... "
if [[ -f "${REPO_ROOT}/scripts/check-ui-lock.sh" ]] && [[ -x "${REPO_ROOT}/scripts/check-ui-lock.sh" ]]; then
    echo -e "${GREEN}Ready${NC}"
    SCRIPTS_OK=true
else
    echo -e "${RED}Missing or not executable${NC}"
    SCRIPTS_OK=false
fi

# Check 5: Golden tag exists
echo -n "✓ Golden tag (fleetpro-golden-ui-locked)... "
if git -C "$REPO_ROOT" rev-parse "$GOLDEN_TAG" >/dev/null 2>&1; then
    GOLDEN_COMMIT=$(git -C "$REPO_ROOT" rev-parse "$GOLDEN_TAG")
    echo -e "${GREEN}Created (${GOLDEN_COMMIT:0:7})${NC}"
    TAG_OK=true
else
    echo -e "${RED}Not created${NC}"
    TAG_OK=false
fi

# Check 6: Documentation exists
echo -n "✓ Documentation (docs/ui-lock/)... "
DOC_COUNT=$(find "${REPO_ROOT}/docs/ui-lock" -name "*.md" 2>/dev/null | wc -l)
if [[ $DOC_COUNT -gt 5 ]]; then
    echo -e "${GREEN}Complete ($DOC_COUNT files)${NC}"
    DOCS_OK=true
else
    echo -e "${YELLOW}Partial ($DOC_COUNT files)${NC}"
    DOCS_OK=false
fi

echo ""
echo -e "${BLUE}[SETUP STATUS]${NC}"
echo ""

SETUP_COMPLETE=true
[[ "$HASHES_OK" == "true" ]] && echo "  ✅ Hash file" || { echo "  ❌ Hash file"; SETUP_COMPLETE=false; }
[[ "$PROTECTED_OK" == "true" ]] && echo "  ✅ Protected files list" || { echo "  ❌ Protected files list"; SETUP_COMPLETE=false; }
[[ "$HOOK_OK" == "true" ]] && echo "  ✅ Git hook" || { echo "  ❌ Git hook"; SETUP_COMPLETE=false; }
[[ "$SCRIPTS_OK" == "true" ]] && echo "  ✅ Scripts" || { echo "  ❌ Scripts"; SETUP_COMPLETE=false; }
[[ "$TAG_OK" == "true" ]] && echo "  ✅ Golden tag" || { echo "  ❌ Golden tag"; SETUP_COMPLETE=false; }
[[ "$DOCS_OK" == "true" ]] && echo "  ✅ Documentation" || { echo "  ❌ Documentation"; SETUP_COMPLETE=false; }

echo ""

if [[ "$SETUP_COMPLETE" == "true" ]]; then
    echo -e "${GREEN}✓ UI Lock is fully set up${NC}"
    echo ""
    echo -e "${BLUE}[VERIFICATION]${NC}"
    echo ""

    # Run verification
    echo "Running full verification..."
    "${REPO_ROOT}/scripts/verify-golden-ui.sh"

    echo ""
    echo -e "${GREEN}✓ Setup verification passed${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Read: docs/ui-lock/DEVELOPER-GUIDE.md (for developers)"
    echo "  2. Read: docs/ui-lock/OPS-GUIDE.md (for operations)"
    echo "  3. Configure GitHub branch protection rules"
    echo "  4. Set up cron for health checks: crontab -e"
    echo ""
    exit 0
else
    echo -e "${RED}✗ UI Lock setup is incomplete${NC}"
    echo ""
    echo "Missing components:"
    [[ "$HASHES_OK" != "true" ]] && echo "  • Hash file needs to be created"
    [[ "$PROTECTED_OK" != "true" ]] && echo "  • Protected files list needs to be created"
    [[ "$HOOK_OK" != "true" ]] && echo "  • Git hook needs to be installed"
    [[ "$SCRIPTS_OK" != "true" ]] && echo "  • Scripts need to be created/fixed"
    [[ "$TAG_OK" != "true" ]] && echo "  • Golden tag needs to be created"
    [[ "$DOCS_OK" != "true" ]] && echo "  • Documentation needs to be added"
    echo ""
    echo "To complete setup, run:"
    echo "  git clone <repo> && cd <repo>"
    echo "  bash scripts/setup-ui-lock.sh"
    echo ""
    exit 1
fi
