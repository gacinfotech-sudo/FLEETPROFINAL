# 🚨 EMERGENCY RECOVERY GUIDE

If FleetPro crashes or breaks, follow this guide to recover in minutes.

---

## ⚡ QUICK RECOVERY (1-2 minutes)

### Option 1: Automatic Recovery (Recommended)

```bash
# Run interactive recovery menu
bash scripts/recover-system.sh

# Follow the prompts:
# 1. Select backup from list
# 2. Confirm recovery
# 3. Wait for system to restore
```

**That's it!** The system will:
- ✅ Stop the server
- ✅ Restore database from backup
- ✅ Restore git state
- ✅ Restart server

---

## 📊 RECOVERY SCENARIOS

### Scenario 1: Server crashed or won't start

```bash
# 1. Kill any running processes
pkill -f "npm run dev"

# 2. Run recovery
bash scripts/recover-system.sh

# 3. Select latest backup (usually #1)
# 4. Wait for restart
```

**Expected time:** 2-3 minutes

---

### Scenario 2: Database corrupted or data lost

```bash
# 1. Stop server
pkill -f "npm run dev"

# 2. Run recovery script
bash scripts/recover-system.sh

# 3. Select the backup from just before data loss occurred
# 4. Confirm recovery
```

**Expected time:** 3-5 minutes (depending on database size)

---

### Scenario 3: Code accidentally deleted or broken

```bash
# 1. View backups with timestamps
bash scripts/backup-status.sh

# 2. Run recovery to restore from before deletion
bash scripts/recover-system.sh

# 3. Choose backup timestamp from before issue
```

**Expected time:** 2-3 minutes

---

### Scenario 4: Configuration file corrupted

```bash
# Quick restore just config without stopping server
cp /Users/pradeep/backups/auto-30min/TIMESTAMP/config/package.json \
   /Users/pradeep/fleetpro-final-recovery/package.json

npm install
npm run build
```

**Expected time:** 1 minute

---

## 🔍 MANUAL RECOVERY (If scripts fail)

### Restore MongoDB manually

```bash
# Find backup
ls -la /Users/pradeep/backups/auto-30min/

# Restore database
mongorestore --uri "mongodb://127.0.0.1:27017/fleetpro" \
  --drop /Users/pradeep/backups/auto-30min/TIMESTAMP/mongodb
```

### Restore Git state manually

```bash
cd /Users/pradeep/fleetpro-final-recovery

# Restore from bundle
git clone /Users/pradeep/backups/auto-30min/TIMESTAMP/fleetpro.bundle temp-repo

# Copy critical files back
cp -r temp-repo/.git .git-backup
```

### Restore config files manually

```bash
# Restore package.json
cp /Users/pradeep/backups/auto-30min/TIMESTAMP/config/package.json \
   /Users/pradeep/fleetpro-final-recovery/package.json

# Reinstall
npm install
npm run build
```

---

## 🚀 RESTART AFTER RECOVERY

```bash
# Stop current server
pkill -f "npm run dev"

# Start fresh
cd /Users/pradeep/fleetpro-final-recovery
npm run dev

# In another terminal, monitor logs
tail -f /tmp/dev.log
```

---

## ✅ VERIFY RECOVERY WAS SUCCESSFUL

### Check server status

```bash
# Should return health info
curl http://localhost:5050/api/health

# Expected response: { "status": "ok", ... }
```

### Check database

```bash
# Connect to MongoDB
mongosh

# List collections
db.getCollectionNames()

# Should show: customers, bookings, drivers, vehicles, etc.
```

### Check git state

```bash
git log --oneline -5
git status
```

---

## 📋 BACKUP CONTENTS

Each backup includes:

| Item | Location | Purpose |
|------|----------|---------|
| **MongoDB** | `mongodb/` | Complete database dump |
| **Git** | `fleetpro.bundle` | All code, branches, history |
| **Config** | `config/` | package.json, tsconfig.json |
| **Schemas** | `schemas/` | Database models |
| **Metadata** | `BACKUP_INFO.txt` | Restore instructions |

---

## 🔧 TROUBLESHOOTING

### MongoDB won't restore

```bash
# Check if mongod is running
ps aux | grep mongod

# If not running, start it:
brew services start mongodb-community

# Try restore again
mongorestore --uri "mongodb://127.0.0.1:27017" /path/to/backup/mongodb
```

### Server won't start after recovery

```bash
# Check for port conflicts
lsof -i :5050

# Kill any process on port 5050
kill -9 <PID>

# Check logs for errors
tail -100 /tmp/dev.log

# Try building fresh
npm install
npm run build
npm run dev
```

### Git restore issues

```bash
# If .git is corrupted
rm -rf .git
git clone /Users/pradeep/backups/auto-30min/TIMESTAMP/fleetpro.bundle new-repo
cp -r new-repo/.git .
```

---

## 💾 BACKUP SCHEDULE

- **Frequency:** Every 30 minutes automatically
- **Retention:** Last 10 backups kept
- **Storage:** `/Users/pradeep/backups/auto-30min/`
- **Disk space:** ~33MB per backup
- **Cron job:** `*/30 * * * *`

---

## 📊 RECOVERY CHECKLIST

After recovery completes, verify:

- [ ] Server started successfully (port 5050)
- [ ] Database accessible (MongoDB)
- [ ] Git history intact
- [ ] All collections present
- [ ] Admin dashboard loads
- [ ] Can login
- [ ] Bookings display correctly
- [ ] Customers display correctly

---

## 🆘 IF ALL ELSE FAILS

1. **Check latest backup exists**
   ```bash
   ls -lah /Users/pradeep/backups/auto-30min/ | head -5
   ```

2. **Stop everything**
   ```bash
   pkill -f "npm run dev"
   pkill -f "mongod"
   ```

3. **Clean up and rebuild**
   ```bash
   cd /Users/pradeep/fleetpro-final-recovery
   rm -rf node_modules dist .next
   npm install
   npm run build
   ```

4. **Restore database manually**
   ```bash
   mongorestore --uri "mongodb://127.0.0.1:27017/fleetpro" \
     --drop /Users/pradeep/backups/auto-30min/LATEST/mongodb
   ```

5. **Start server**
   ```bash
   npm run dev
   ```

---

## 📞 QUICK REFERENCE

| Situation | Command |
|-----------|---------|
| **Check backup status** | `bash scripts/backup-status.sh` |
| **Full recovery** | `bash scripts/recover-system.sh` |
| **Manual MongoDB restore** | `mongorestore --uri mongodb://... --drop /path/to/backup` |
| **Restart server** | `pkill -f "npm run dev"; npm run dev` |
| **View recent backups** | `ls -lt /Users/pradeep/backups/auto-30min/ \| head -5` |
| **Check server logs** | `tail -50 /tmp/dev.log` |
| **Health check** | `curl http://localhost:5050/api/health` |

---

**Recovery time: 2-5 minutes depending on database size**

**Last updated:** 2026-08-18
