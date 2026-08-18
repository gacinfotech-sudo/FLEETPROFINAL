#!/bin/bash
# FLEETPRO GOLDEN UI LOCK — Check Script (Phase 4)
# Detects unintended changes to protected UI files
# Exit code: 0 = all protected files match golden baseline, 1 = mismatch detected

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HASHES_FILE="${REPO_ROOT}/.ui-lock/golden-ui-hashes.json"
PROTECTED_FILES_LIST="${REPO_ROOT}/.ui-lock/protected-ui-files.txt"

if [[ ! -f "$HASHES_FILE" ]]; then
    echo "❌ ERROR: Golden UI hashes file not found: $HASHES_FILE"
    exit 1
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MISMATCH_COUNT=0
CHECKED_COUNT=0
VIOLATIONS=()

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}FLEETPRO UI LOCK — File Integrity Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

# Extract file list from JSON and check each one
while IFS= read -r line; do
    # Skip metadata, parse "filename": entries
    if [[ $line =~ \"([^\"]+)\":[[:space:]]*\{ ]]; then
        filename="${BASH_REMATCH[1]}"

        # Extract expected hash from JSON
        expected_hash=$(jq -r ".protected_files[\"$filename\"].sha256" "$HASHES_FILE" 2>/dev/null || echo "")

        if [[ -z "$expected_hash" ]]; then
            continue
        fi

        filepath="${REPO_ROOT}/${filename}"
        CHECKED_COUNT=$((CHECKED_COUNT + 1))

        if [[ ! -f "$filepath" ]]; then
            echo -e "${RED}✗ MISSING${NC}: $filename"
            VIOLATIONS+=("MISSING: $filename")
            MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
        else
            # Calculate current SHA256
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                current_hash=$(shasum -a 256 "$filepath" | awk '{print $1}')
            else
                # Linux
                current_hash=$(sha256sum "$filepath" | awk '{print $1}')
            fi

            if [[ "$current_hash" == "$expected_hash" ]]; then
                echo -e "${GREEN}✓ OK${NC}: $filename"
            else
                echo -e "${RED}✗ CHANGED${NC}: $filename"
                echo "   Expected: $expected_hash"
                echo "   Current:  $current_hash"
                VIOLATIONS+=("CHANGED: $filename")
                MISMATCH_COUNT=$((MISMATCH_COUNT + 1))
            fi
        fi
    fi
done < <(jq -r '.protected_files | keys[]' "$HASHES_FILE")

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo "Results: ${CHECKED_COUNT} files checked, ${MISMATCH_COUNT} violations"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"

if [[ $MISMATCH_COUNT -gt 0 ]]; then
    echo ""
    echo -e "${RED}UI LOCK VIOLATION DETECTED!${NC}"
    echo ""
    echo "Protected files have been modified:"
    for violation in "${VIOLATIONS[@]}"; do
        echo -e "  ${RED}•${NC} $violation"
    done
    echo ""
    echo "Options:"
    echo "  1. Restore golden UI:  scripts/restore-golden-ui.sh"
    echo "  2. Review changes:     git diff --stat"
    echo "  3. View golden state:  git show fleetpro-golden-ui-locked:<file>"
    echo ""
    exit 1
else
    echo -e "${GREEN}✓ All protected files match golden baseline${NC}"
    exit 0
fi
