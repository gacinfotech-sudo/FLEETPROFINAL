#!/bin/bash

# Fleet Pro Development Environment Setup
# Use this to create an isolated development worktree with a unique port

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BASE_DIR="/Users/pradeep/fleetpro-main-p0-fixed"
MAIN_REPO="$BASE_DIR/fleetpro-main"

# Get arguments
BRANCH_NAME="${1}"
DEV_PORT="${2:-5051}"

if [ -z "$BRANCH_NAME" ]; then
    echo -e "${RED}Usage: ./setup-dev-environment.sh <branch-name> [port]${NC}"
    echo ""
    echo "Examples:"
    echo "  ./setup-dev-environment.sh fix-booking-overlap 5051"
    echo "  ./setup-dev-environment.sh feature-whatsapp-integration 5052"
    echo ""
    echo "Available ports (5051-5098 not in use):"
    for p in {5051..5060}; do
        if ! lsof -i :$p 2>/dev/null | grep -q node; then
            echo "  $p - available"
        fi
    done
    exit 1
fi

# Validate port is available
if lsof -i :$DEV_PORT 2>/dev/null | grep -q node; then
    echo -e "${RED}✗ Port $DEV_PORT is already in use${NC}"
    exit 1
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Fleet Pro Development Environment Setup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Create worktree
WORKTREE_PATH="$BASE_DIR/fleetpro-worktrees/$BRANCH_NAME"

if [ -d "$WORKTREE_PATH" ]; then
    echo -e "${YELLOW}ℹ Worktree already exists: $WORKTREE_PATH${NC}"
    echo "Updating from main..."
    cd "$WORKTREE_PATH"
    git fetch origin
    git rebase origin/main
else
    echo -e "${GREEN}Creating worktree: $BRANCH_NAME${NC}"
    cd "$MAIN_REPO"

    # Make sure worktrees directory exists
    mkdir -p "$BASE_DIR/fleetpro-worktrees"

    # Create new worktree from main
    git worktree add "$WORKTREE_PATH" main
    echo -e "${GREEN}✓ Worktree created${NC}"
fi

cd "$WORKTREE_PATH"

# Step 2: Create or checkout development branch
if git rev-parse --verify "$BRANCH_NAME" 2>/dev/null; then
    echo -e "${GREEN}Checking out existing branch: $BRANCH_NAME${NC}"
    git checkout "$BRANCH_NAME"
else
    echo -e "${GREEN}Creating new branch: $BRANCH_NAME${NC}"
    git checkout -b "$BRANCH_NAME"
fi

echo -e "${GREEN}✓ Branch ready: $BRANCH_NAME${NC}"

# Step 3: Install dependencies (if needed)
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${GREEN}Installing dependencies (npm install)...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}ℹ Dependencies already present${NC}"
fi

# Step 4: Environment file
if [ ! -f ".env" ]; then
    echo ""
    echo -e "${GREEN}Setting up .env${NC}"

    # Check if main has .env
    if [ -f "$MAIN_REPO/.env" ]; then
        # Create symlink to shared .env
        ln -s "$MAIN_REPO/.env" .env
        echo -e "${GREEN}✓ Linked to main .env${NC}"
    else
        # Create from example
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${YELLOW}⚠ Created .env from example — UPDATE WITH REAL VALUES${NC}"
        else
            echo -e "${YELLOW}⚠ No .env or .env.example found${NC}"
        fi
    fi
fi

# Step 5: Type check (quick verification)
echo ""
echo -e "${GREEN}Running TypeScript check...${NC}"
if npm run check > /dev/null 2>&1; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript check found issues (check after edits)${NC}"
fi

# Step 6: Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Development Environment Ready${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} Worktree: ${YELLOW}$WORKTREE_PATH${NC}"
echo -e "  ${GREEN}✓${NC} Branch: ${YELLOW}$BRANCH_NAME${NC}"
echo -e "  ${GREEN}✓${NC} Port: ${YELLOW}$DEV_PORT${NC}"
echo ""
echo -e "${GREEN}To start development:${NC}"
echo ""
echo "  cd $WORKTREE_PATH"
echo "  PORT=$DEV_PORT npm run dev"
echo ""
echo -e "${GREEN}Then open:${NC} http://localhost:$DEV_PORT"
echo ""
echo -e "${GREEN}Testing workflow:${NC}"
echo "  1. Make code changes"
echo "  2. Save files (auto-reload in dev mode)"
echo "  3. Test feature locally"
echo "  4. Run: npm run check"
echo "  5. Create PR for review"
echo "  6. Once approved, merge to main"
echo "  7. Promote to live (:5050) after smoke test"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "  • Never merge untested code to main"
echo "  • Never promote to live without browser testing"
echo "  • Keep main branch stable for :5050 live environment"
echo "  • Isolate database changes to this development environment"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
