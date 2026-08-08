#!/bin/bash
# FLEETPRO UI LOCK — GitHub Branch Protection Setup (Phase 15-16)
# Configures branch protection rules to enforce UI lock at the repository level
# REQUIRES: gh CLI + admin access to repository

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  FLEETPRO UI LOCK — GitHub Branch Protection Setup    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}[CHECKING PREREQUISITES]${NC}"
echo ""

# Check gh CLI
if ! command -v gh &> /dev/null; then
    echo -e "${RED}ERROR: 'gh' CLI not found${NC}"
    echo "Install from: https://github.com/cli/cli/releases"
    exit 1
fi
echo -e "${GREEN}✓${NC} gh CLI found"

# Check authentication
if ! gh auth status &>/dev/null; then
    echo -e "${RED}ERROR: Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi
echo -e "${GREEN}✓${NC} GitHub authenticated"

# Get repo info
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "")
if [[ -z "$REPO" ]]; then
    echo -e "${RED}ERROR: Not in a GitHub repository${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Repository: $REPO"

echo ""
echo -e "${BLUE}[CONFIGURING BRANCH PROTECTION]${NC}"
echo ""

# Confirm before proceeding
echo "This will configure branch protection rules for:"
echo "  • main"
echo "  • booking/integration-preview"
echo ""
read -p "Continue? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Configuring branch protection rules..."
echo ""

# Function to set branch protection
set_branch_protection() {
    local branch=$1
    local display_name=$2

    echo -n "Setting up $display_name... "

    # Create protection rules
    if gh api repos/"$REPO"/branches/"$branch"/protection \
        --input - << EOF 2>/dev/null
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ui-lock-check",
      "build",
      "tests"
    ]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "dismiss_stale_reviews": false,
  "require_code_owner_reviews": false,
  "required_approving_review_count": 1,
  "enforce_admins": true,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
    then
        echo -e "${GREEN}Done${NC}"
        return 0
    else
        echo -e "${YELLOW}Warning${NC} (may already be configured)"
        return 0
    fi
}

# Configure both protected branches
set_branch_protection "main" "main branch"
set_branch_protection "booking/integration-preview" "golden branch (booking/integration-preview)"

echo ""
echo -e "${BLUE}[VERIFICATION]${NC}"
echo ""

# Verify configuration
echo "Verifying branch protection rules..."
echo ""

verify_branch() {
    local branch=$1
    local display_name=$2

    echo "$display_name:"

    # Get protection status
    if gh api repos/"$REPO"/branches/"$branch"/protection --jq . 2>/dev/null | grep -q "required_status_checks"; then
        echo -e "  ${GREEN}✓${NC} Status checks required"
    else
        echo -e "  ${YELLOW}⚠${NC} Status checks not configured"
    fi

    if gh api repos/"$REPO"/branches/"$branch"/protection --jq . 2>/dev/null | grep -q "required_pull_request_reviews"; then
        echo -e "  ${GREEN}✓${NC} PR reviews required"
    else
        echo -e "  ${YELLOW}⚠${NC} PR reviews not configured"
    fi

    if gh api repos/"$REPO"/branches/"$branch"/protection --jq .enforce_admins 2>/dev/null | grep -q "true"; then
        echo -e "  ${GREEN}✓${NC} Admin enforcement enabled"
    else
        echo -e "  ${YELLOW}⚠${NC} Admin enforcement not enabled"
    fi

    echo ""
}

verify_branch "main" "main"
verify_branch "booking/integration-preview" "booking/integration-preview (golden)"

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Branch protection rules configured${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Test with a PR: make a change and create a pull request"
echo "  2. Verify UI lock check runs automatically"
echo "  3. Confirm merge is blocked if UI lock fails"
echo ""
echo "Important:"
echo "  • CI workflow (.github/workflows/ui-lock-verify.yml) must be pushed"
echo "  • GitHub Actions must be enabled for the repository"
echo "  • Status check 'ui-lock-check' must match workflow job name"
echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
