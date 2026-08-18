#!/bin/bash

# Show backup status and recent backups

BACKUP_DIR="/Users/pradeep/backups/auto-30min"
LOG_FILE="/tmp/backup-30min.log"

echo "════════════════════════════════════════════════════════"
echo "            BACKUP STATUS - EVERY 30 MINUTES"
echo "════════════════════════════════════════════════════════"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Backup directory not found: $BACKUP_DIR"
  exit 1
fi

# Count total backups
TOTAL_BACKUPS=$(ls -1d "$BACKUP_DIR"/*/ 2>/dev/null | wc -l)
echo "📊 Total backups: $TOTAL_BACKUPS"
echo ""

# Show last 5 backups
echo "📅 Recent backups (last 5):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -td "$BACKUP_DIR"/*/ 2>/dev/null | head -5 | while read backup_path; do
  backup_name=$(basename "$backup_path")
  backup_size=$(du -sh "$backup_path" 2>/dev/null | cut -f1)
  echo "✅ $backup_name ($backup_size)"
done
echo ""

# Show next scheduled backup time
echo "⏰ Next scheduled backup:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
CURRENT_MIN=$(($(date +%M) % 30))
NEXT_BACKUP_IN=$((30 - CURRENT_MIN))
NEXT_BACKUP_TIME=$(date -j -v+${NEXT_BACKUP_IN}M +%H:%M:%S 2>/dev/null || echo "~${NEXT_BACKUP_IN} minutes")
echo "In $NEXT_BACKUP_IN minutes at $NEXT_BACKUP_TIME"
echo ""

# Show recent log entries
echo "📝 Recent backup logs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "$LOG_FILE" ]; then
  tail -10 "$LOG_FILE" | sed 's/^/  /'
else
  echo "  (no logs yet)"
fi
echo ""

# Show cron job status
echo "🔧 Cron job status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if crontab -l 2>/dev/null | grep -q "backup-every-30min"; then
  echo "✅ Active: */30 * * * * backup-every-30min.sh"
else
  echo "❌ Inactive: Cron job not found"
fi
echo ""

# Disk space warning
echo "💾 Disk space usage:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print "  Used: " $1}'
echo ""

echo "════════════════════════════════════════════════════════"
