#!/bin/bash

# Automated backup every 30 minutes
# Backs up: database, code, and key files

BACKUP_DIR="/Users/pradeep/backups/auto-30min"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_PATH"

echo "🔄 Starting backup at $(date)"

# 1. Backup MongoDB database
echo "📦 Backing up MongoDB..."
mongodump --uri "mongodb://127.0.0.1:27017/fleetpro" \
  --out "$BACKUP_PATH/mongodb" 2>/dev/null || echo "⚠️ MongoDB backup skipped"

# 2. Backup git repository (current state)
echo "💾 Backing up git state..."
cd /Users/pradeep/fleetpro-final-recovery
git bundle create "$BACKUP_PATH/fleetpro.bundle" --all 2>/dev/null || echo "⚠️ Git backup skipped"
cp .git/HEAD "$BACKUP_PATH/git-head.txt" 2>/dev/null || true

# 3. Backup key configuration files
echo "⚙️  Backing up configs..."
mkdir -p "$BACKUP_PATH/config"
cp package.json "$BACKUP_PATH/config/" 2>/dev/null || true
cp tsconfig.json "$BACKUP_PATH/config/" 2>/dev/null || true
cp .env 2>/dev/null && cp .env "$BACKUP_PATH/config/" || true

# 4. Backup server schemas and models
echo "📋 Backing up schemas..."
mkdir -p "$BACKUP_PATH/schemas"
cp -r server/models "$BACKUP_PATH/schemas/" 2>/dev/null || true
cp -r server/schemas "$BACKUP_PATH/schemas/" 2>/dev/null || true

# 5. Create metadata file
echo "📝 Creating backup metadata..."
cat > "$BACKUP_PATH/BACKUP_INFO.txt" << EOF
Automated Backup - Every 30 Minutes
====================================
Timestamp: $TIMESTAMP
Date: $(date)
Hostname: $(hostname)
User: $(whoami)

Backup Contents:
- MongoDB database dump (fleetpro)
- Git repository bundle (all branches)
- Package configuration
- Schema definitions
- Models

Restore Commands:
=================
# Restore MongoDB:
mongorestore --uri "mongodb://127.0.0.1:27017" $BACKUP_PATH/mongodb

# Restore git:
git clone $BACKUP_PATH/fleetpro.bundle fleetpro-restored

Size: $(du -sh $BACKUP_PATH | cut -f1)
EOF

# 6. Cleanup old backups (keep only last 10)
echo "🧹 Cleaning up old backups..."
cd "$BACKUP_DIR"
ls -td */ | tail -n +11 | xargs -r rm -rf

echo "✅ Backup complete: $BACKUP_PATH"
echo "📊 Total backups stored: $(ls -1d */ 2>/dev/null | wc -l)"
echo ""
