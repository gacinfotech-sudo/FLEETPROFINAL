#!/bin/bash

# 🚨 ULTRA-QUICK RECOVERY - One command, minimal prompts
# Usage: bash QUICK_RECOVERY.sh [backup_number]
# Example: bash QUICK_RECOVERY.sh 1  (restores from most recent backup)

BACKUP_DIR="/Users/pradeep/backups/auto-30min"
PROJECT_DIR="/Users/pradeep/fleetpro-final-recovery"

echo "🚨 QUICK RECOVERY - FleetPro"
echo "════════════════════════════════════════════════════════"

# Get backup choice from argument or use latest
if [ -z "$1" ]; then
  BACKUP_CHOICE=1
  echo "Using latest backup (restore #1)"
else
  BACKUP_CHOICE=$1
fi

# Get selected backup
backups=($(ls -td "$BACKUP_DIR"/*/ | head -20))
if [ ${#backups[@]} -lt "$BACKUP_CHOICE" ]; then
  echo "❌ Backup #$BACKUP_CHOICE not found"
  exit 1
fi

SELECTED_BACKUP="${backups[$((BACKUP_CHOICE-1))]}"
BACKUP_NAME=$(basename "$SELECTED_BACKUP" | sed 's:/*$::')

echo "Restoring from: $BACKUP_NAME"
echo ""

# Quick recovery without prompts
echo "⏹️  Stopping server..."
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

echo "💾 Restoring database..."
if [ -d "$SELECTED_BACKUP/mongodb" ]; then
  mongorestore --uri "mongodb://127.0.0.1:27017" --drop "$SELECTED_BACKUP/mongodb" 2>/dev/null || true
fi

echo "🔄 Restoring config..."
if [ -f "$SELECTED_BACKUP/config/package.json" ]; then
  cp "$SELECTED_BACKUP/config/package.json" "$PROJECT_DIR/package.json" 2>/dev/null
fi

echo "🚀 Restarting server..."
cd "$PROJECT_DIR"
npm run dev > /tmp/dev.log 2>&1 &
sleep 5

echo ""
echo "✅ Recovery complete!"
echo "   Server: http://localhost:5050"
echo "   Logs: tail -f /tmp/dev.log"
