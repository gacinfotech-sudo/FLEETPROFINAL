#!/bin/bash

# MongoDB Backup Script
# Creates daily automated backups of MongoDB database
# Keeps only the last 30 backups

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODEJS_BACKUP_SCRIPT="$SCRIPT_DIR/backup-mongodb-nodejs.js"

# Try to use mongodump first if available
if command -v mongodump &> /dev/null; then
    BACKUP_DIR="/Users/pradeep/fleetpro-backups"
    DB_URI="mongodb://127.0.0.1:27017/fleetpro"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

    mkdir -p "$BACKUP_DIR"

    echo "[$(date)] Starting mongodump backup..."
    mongodump --uri="$DB_URI" --out="$BACKUP_PATH"

    if [ $? -eq 0 ]; then
        echo "[$(date)] Backup complete: $BACKUP_PATH"

        # Keep only last 30 backups
        echo "[$(date)] Cleaning up old backups..."
        cd "$BACKUP_DIR" 2>/dev/null || exit 1
        ls -td backup_* 2>/dev/null | tail -n +31 | while read old_backup; do
            echo "[$(date)] Removing: $old_backup"
            rm -rf "$old_backup"
        done

        echo "[$(date)] Backup process completed successfully"
        exit 0
    else
        echo "[$(date)] Warning: mongodump failed, falling back to Node.js backup" >&2
    fi
fi

# Fallback to Node.js-based backup
if [ -f "$NODEJS_BACKUP_SCRIPT" ]; then
    echo "[$(date)] Using Node.js-based backup..."
    node "$NODEJS_BACKUP_SCRIPT"
    exit $?
else
    echo "[$(date)] Error: Neither mongodump nor Node.js backup script found" >&2
    exit 1
fi
