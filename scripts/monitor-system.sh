#!/bin/bash

# Log file
MONITOR_LOG="/Users/pradeep/fleetpro-final-recovery/logs/monitor.log"
mkdir -p $(dirname $MONITOR_LOG)

# Check 1: Backend process running
if ! pgrep -f "fleetpro-final-recovery.*node\|fleetpro-final-recovery.*tsx" > /dev/null; then
  echo "$(date): ⚠️ ALERT: Backend process not running" >> $MONITOR_LOG
else
  echo "$(date): ✓ Backend process alive" >> $MONITOR_LOG
fi

# Check 2: Port 5050 listening
if ! lsof -i :5050 > /dev/null 2>&1; then
  echo "$(date): ⚠️ ALERT: Port 5050 not listening" >> $MONITOR_LOG
else
  echo "$(date): ✓ Port 5050 listening" >> $MONITOR_LOG
fi

# Check 3: MongoDB connection
if ! mongosh mongodb://127.0.0.1:27017/fleetpro --eval "db.ping()" > /dev/null 2>&1; then
  echo "$(date): ⚠️ ALERT: MongoDB unreachable" >> $MONITOR_LOG
else
  echo "$(date): ✓ MongoDB connected" >> $MONITOR_LOG
fi

# Check 4: Database size
BACKUP_COUNT=$(ls -1 /Users/pradeep/fleetpro-backups/backup_* 2>/dev/null | wc -l)
echo "$(date): Database backups: $BACKUP_COUNT" >> $MONITOR_LOG

# Check 5: Disk space
DISK_USAGE=$(df /Users/pradeep | tail -1 | awk '{print $5}')
echo "$(date): Disk usage: $DISK_USAGE" >> $MONITOR_LOG

if [ "${DISK_USAGE%\%}" -gt 80 ]; then
  echo "$(date): ⚠️ ALERT: Disk usage > 80%" >> $MONITOR_LOG
fi

# Check 6: API health
if ! curl -s http://localhost:5050/api/health > /dev/null 2>&1; then
  echo "$(date): ⚠️ ALERT: API health check failed" >> $MONITOR_LOG
else
  echo "$(date): ✓ API responding" >> $MONITOR_LOG
fi
