#!/bin/bash
# FLEETPRO GOLDEN UI LOCK — Restore Script (Phase 6)
# Restores protected UI files to golden state without losing backend/feature code

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASHES_FILE="${REPO_ROOT}/.ui-lock/golden-ui-hashes.json"
GOLDEN_TAG="fleetpro-golden-ui-locked"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ ! -f "$HASHES_FILE" ]]; then
    echo "❌ ERROR: Hashes file not found: $HASHES_FILE"
    exit 1
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FLEETPRO GOLDEN UI LOCK — RESTORE PROCEDURE          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if tag exists
if ! git -C "$REPO_ROOT" rev-parse "$GOLDEN_TAG" >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Golden tag '$GOLDEN_TAG' not found${NC}"
    echo ""
    echo "To create the golden tag:"
    echo "  git tag -a $GOLDEN_TAG 94844c5 -m 'Golden UI baseline'"
    exit 1
fi

GOLDEN_COMMIT=$(git -C "$REPO_ROOT" rev-parse "$GOLDEN_TAG")
echo -e "${BLUE}Golden Commit:${NC} $GOLDEN_COMMIT"
echo ""

# Confirm before proceeding
echo -e "${YELLOW}This will restore these files to golden state:${NC}"
echo ""
jq -r '.protected_files | keys[]' "$HASHES_FILE" | sed 's/^/  • /'
echo ""

read -p "Restore UI files to golden state? (type 'yes' to confirm): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Restoring protected files...${NC}"
echo ""

RESTORED_COUNT=0
while IFS= read -r filename; do
    filepath="${REPO_ROOT}/${filename}"

    # Restore from golden tag
    git -C "$REPO_ROOT" show "${GOLDEN_TAG}:${filename}" > "$filepath" 2>/dev/null
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✓${NC} Restored: $filename"
        RESTORED_COUNT=$((RESTORED_COUNT + 1))
    else
        echo -e "${RED}✗${NC} Failed to restore: $filename"
    fi
done < <(jq -r '.protected_files | keys[]' "$HASHES_FILE")

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "Restored $RESTORED_COUNT protected files"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check if there are uncommitted changes now
if [[ -n $(git -C "$REPO_ROOT" status --porcelain 2>/dev/null) ]]; then
    echo -e "${YELLOW}Uncommitted changes detected:${NC}"
    git -C "$REPO_ROOT" status --short | head -10
    echo ""
    echo "Commit restored files:"
    echo "  git add -A"
    echo "  git commit -m 'fix: restore golden UI after unintended changes ($(date +%s))'"
    echo ""
fi

echo -e "${GREEN}✓ Golden UI restoration complete${NC}"
echo ""
echo "Verify restoration:"
echo "  ./scripts/verify-golden-ui.sh"
echo ""
