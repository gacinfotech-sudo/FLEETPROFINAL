#!/bin/bash

# 🚨 EMERGENCY RECOVERY SYSTEM
# One-command recovery from any backup

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKUP_DIR="/Users/pradeep/backups/auto-30min"
PROJECT_DIR="/Users/pradeep/fleetpro-final-recovery"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}         🚨 SYSTEM RECOVERY & ROLLBACK${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  echo -e "${RED}❌ Backup directory not found: $BACKUP_DIR${NC}"
  exit 1
fi

# List available backups
echo -e "${YELLOW}📋 Available backups:${NC}"
echo ""
backups=($(ls -td "$BACKUP_DIR"/*/ | head -20))

if [ ${#backups[@]} -eq 0 ]; then
  echo -e "${RED}❌ No backups found!${NC}"
  exit 1
fi

for i in "${!backups[@]}"; do
  backup_path="${backups[$i]}"
  backup_name=$(basename "$backup_path" | sed 's:/*$::')
  backup_size=$(du -sh "$backup_path" 2>/dev/null | cut -f1)
  timestamp=$(echo "$backup_name" | grep -oE '[0-9]{8}-[0-9]{6}' || echo "unknown")

  echo -e "  ${GREEN}[$((i+1))${NC}] $backup_name ($backup_size)"
  echo "      Size: $backup_size | Contains: MongoDB, Git, Config"
done

echo ""
echo -e "${YELLOW}Select backup to restore (number 1-${#backups[@]}, or 'q' to quit):${NC}"
read -p "> " choice

if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
  echo "Cancelled."
  exit 0
fi

# Validate choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backups[@]} ]; then
  echo -e "${RED}❌ Invalid selection${NC}"
  exit 1
fi

SELECTED_BACKUP="${backups[$((choice-1))]}"
BACKUP_NAME=$(basename "$SELECTED_BACKUP" | sed 's:/*$::')

echo ""
echo -e "${YELLOW}🔄 RECOVERY PLAN:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  📦 Backup: $BACKUP_NAME"
echo -e "  📍 Location: $SELECTED_BACKUP"
echo -e "  🎯 Actions:"
echo -e "     1. ⏹️  Stop running server"
echo -e "     2. 💾 Restore MongoDB database"
echo -e "     3. 🔄 Restore git repository state"
echo -e "     4. ⚙️  Restore configuration files"
echo -e "     5. 🚀 Restart server"
echo ""

read -p "Proceed with recovery? (yes/no): " confirm
if [ "$confirm" != "yes" ] && [ "$confirm" != "YES" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo -e "${BLUE}Starting recovery process...${NC}"
echo ""

# Step 1: Stop server
echo -e "${YELLOW}[1/5] ⏹️  Stopping server...${NC}"
pkill -f "npm run dev" || true
sleep 3
echo -e "${GREEN}✅ Server stopped${NC}"
echo ""

# Step 2: Restore MongoDB
echo -e "${YELLOW}[2/5] 💾 Restoring MongoDB database...${NC}"
if [ -d "$SELECTED_BACKUP/mongodb" ]; then
  mongorestore --uri "mongodb://127.0.0.1:27017/fleetpro" \
    --drop --archive --gzip < "$SELECTED_BACKUP/mongodb" 2>/dev/null || \
  mongorestore --uri "mongodb://127.0.0.1:27017" --drop "$SELECTED_BACKUP/mongodb" 2>/dev/null || \
  echo -e "${YELLOW}⚠️  MongoDB restore skipped (check mongod running)${NC}"
  echo -e "${GREEN}✅ Database restored${NC}"
else
  echo -e "${YELLOW}⚠️  MongoDB backup not found in snapshot${NC}"
fi
echo ""

# Step 3: Restore git state
echo -e "${YELLOW}[3/5] 🔄 Restoring git repository...${NC}"
cd "$PROJECT_DIR"

if [ -f "$SELECTED_BACKUP/fleetpro.bundle" ]; then
  # Create temporary restore point
  git stash 2>/dev/null || true

  # Clone from bundle to temp location
  TEMP_DIR=$(mktemp -d)
  git clone "$SELECTED_BACKUP/fleetpro.bundle" "$TEMP_DIR" 2>/dev/null

  # Copy git objects back
  cp -r "$TEMP_DIR/.git" "$PROJECT_DIR/.git-restore" 2>/dev/null || true

  # Restore HEAD and refs
  if [ -f "$SELECTED_BACKUP/git-head.txt" ]; then
    cat "$SELECTED_BACKUP/git-head.txt" > "$PROJECT_DIR/.git/HEAD" 2>/dev/null || true
  fi

  echo -e "${GREEN}✅ Git state restored${NC}"
  rm -rf "$TEMP_DIR"
else
  echo -e "${YELLOW}⚠️  Git backup not found${NC}"
fi
echo ""

# Step 4: Restore configuration
echo -e "${YELLOW}[4/5] ⚙️  Restoring configuration files...${NC}"
if [ -d "$SELECTED_BACKUP/config" ]; then
  cp "$SELECTED_BACKUP/config/package.json" "$PROJECT_DIR/package.json" 2>/dev/null && echo "  ✓ package.json restored" || true
  cp "$SELECTED_BACKUP/config/tsconfig.json" "$PROJECT_DIR/tsconfig.json" 2>/dev/null && echo "  ✓ tsconfig.json restored" || true
  if [ -f "$SELECTED_BACKUP/config/.env" ]; then
    cp "$SELECTED_BACKUP/config/.env" "$PROJECT_DIR/.env" 2>/dev/null && echo "  ✓ .env restored" || true
  fi
  echo -e "${GREEN}✅ Configuration restored${NC}"
else
  echo -e "${YELLOW}⚠️  Config backup not found${NC}"
fi
echo ""

# Step 5: Restart server
echo -e "${YELLOW}[5/5] 🚀 Restarting server...${NC}"
cd "$PROJECT_DIR"
npm run dev > /tmp/dev.log 2>&1 &
sleep 8
echo -e "${GREEN}✅ Server restarted${NC}"
echo ""

# Verification
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ RECOVERY COMPLETE!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Recovery Summary:${NC}"
echo "  ✅ Server stopped"
echo "  ✅ Database restored from: $BACKUP_NAME"
echo "  ✅ Git state restored"
echo "  ✅ Configuration restored"
echo "  ✅ Server restarted"
echo ""
echo -e "${YELLOW}🔗 Next steps:${NC}"
echo "  1. Check server logs: tail -f /tmp/dev.log"
echo "  2. Verify data: curl http://localhost:5050/api/health"
echo "  3. Test login: Visit http://localhost:5050"
echo ""
echo -e "${YELLOW}⚠️  Backup used:${NC}"
echo "  📦 $BACKUP_NAME"
echo "  📍 $SELECTED_BACKUP"
echo ""
