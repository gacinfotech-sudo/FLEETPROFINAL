# FLEETPRO UI LOCK — OPERATIONS GUIDE
**For**: Operations, SRE, Deployment teams  
**Date**: 2026-08-09  
**Status**: ACTIVE ENFORCEMENT  

---

## Overview

The Golden UI Lock prevents unintended changes to the user-facing interface. This guide covers:
- Daily monitoring and health checks
- Deployment verification
- Incident response
- Emergency recovery

---

## Daily Operations

### Health Check Script

Run every 4 hours (automated):

```bash
# Manual run
/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/scripts/health-check.sh

# Output includes:
# ✓ Infrastructure: Server, MongoDB, Disk
# ✓ API Health: Dashboard, Customers, Vehicles, Drivers
# ✓ UI Lock: Protected files integrity check
# ✓ Database: Connection status
# ✓ Resources: Memory usage
```

### Setup Automated Health Checks (Cron)

```bash
# Edit crontab
crontab -e

# Add this line to run health check every 4 hours:
0 */4 * * * /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/scripts/health-check.sh >> /var/log/fleetpro-health.log 2>&1

# Verify cron job is scheduled
crontab -l | grep health-check
```

### Monitor Health Check Logs

```bash
# View all health check history
tail -f /tmp/fleetpro-health-check.log

# Search for failures
grep "FAIL" /tmp/fleetpro-health-check.log

# Count recent passes/fails
tail -100 /tmp/fleetpro-health-check.log | grep "Status:" | sort | uniq -c
```

---

## Deployment Verification

### Before Deploying (Pre-deployment Gate)

```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# 1. Verify UI lock is intact
echo "=== Verifying UI Lock ===" 
./scripts/verify-golden-ui.sh

# Output should show all ✓ checks passed

# 2. Check git status
git status

# Should show clean working tree (or only backend/feature changes)

# 3. Verify build succeeds
npm run build

# Should complete without UI-related errors

# 4. Quick API test
curl -s http://localhost:5050/api/health | jq .

# Should return: {"status":"ok"}
```

### Deployment Checklist

```
☐ UI Lock verification passed
☐ All protected files match golden baseline
☐ Build completes successfully
☐ No console errors during build
☐ API endpoints responding
☐ Database connection healthy
☐ Current commit is on golden branch (booking/integration-preview)
☐ No uncommitted changes (except backend work)
```

### Safe Deploy Script

```bash
#!/bin/bash
# deploy.sh — Safe deployment with UI lock verification

REPO="/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main"
DEPLOYMENT_ENV=${1:-staging}

cd "$REPO"

echo "=== Pre-deployment UI Lock Verification ==="
./scripts/verify-golden-ui.sh || {
    echo "❌ UI Lock verification failed. Deployment blocked."
    exit 1
}

echo ""
echo "=== Building Application ==="
npm run build || {
    echo "❌ Build failed. Deployment blocked."
    exit 1
}

echo ""
echo "=== Verifying API Health ==="
curl -f http://localhost:5050/api/health >/dev/null || {
    echo "⚠️  Warning: API may not be responding"
    read -p "Continue deployment? (yes/no): " confirm
    [[ "$confirm" != "yes" ]] && exit 1
}

echo ""
echo "=== Deployment Ready ==="
echo "Environment: $DEPLOYMENT_ENV"
echo "Current commit: $(git rev-parse --short HEAD)"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo ""
read -p "Deploy to $DEPLOYMENT_ENV? (yes/no): " deploy_confirm
[[ "$deploy_confirm" != "yes" ]] && exit 0

# Proceed with deployment (specific to your infrastructure)
echo "Deploying to $DEPLOYMENT_ENV..."
# docker push / k8s apply / pm2 restart / etc.

echo "✓ Deployment complete"
```

---

## Incident Response

### Scenario 1: Dashboard/UI Looks Wrong

```bash
# Step 1: Identify the problem
curl http://localhost:5050/dashboard/dashboard | head -100
# Compare with screenshot from earlier

# Step 2: Check UI lock status
./scripts/check-ui-lock.sh

# If FAIL output:
# ✗ CHANGED: client/src/pages/dashboard.tsx
# UI lock violation detected

# Step 3: Identify when it changed
git log -3 --oneline client/src/pages/dashboard.tsx

# Step 4: Decide whether to:
# a) Restore golden UI (if accidental change)
# b) Accept new baseline (if intentional redesign)
```

### Scenario 2: UI Lock Violation Detected

```bash
# Step 1: Stop current deployment (if in progress)
killall node

# Step 2: Restore golden UI
./scripts/restore-golden-ui.sh

# Follow prompts:
# - Review what will be restored
# - Type 'yes' to confirm
# - Script restores files

# Step 3: Commit the fix
git add -A
git commit -m "ops: restore golden UI after incident ($(date +%s))"

# Step 4: Rebuild and verify
npm install
npm run build
PORT=5050 npm run dev

# Step 5: Test the UI
# Open http://localhost:5050/dashboard/dashboard
# Verify it looks correct

# Step 6: Notify stakeholders
echo "UI has been restored to golden state. All systems nominal."
```

### Scenario 3: Protected File Accidentally Modified in Code

```bash
# This is how it might happen:
# 1. Developer on feature branch modifies dashboard.tsx
# 2. CI pipeline runs and detects UI lock violation
# 3. Merge is blocked automatically

# Your action:
# Step 1: Review the failed CI job
# GitHub/GitLab will show: "UI Lock Verification: FAILED"

# Step 2: Contact developer
# "Your PR modified protected UI files. Use the extension points instead."

# Step 3: Developer's fix:
# - Revert UI changes
# - Use dashboard registry instead
# - Resubmit PR

# No action needed from ops if CI caught it (expected case)
```

---

## Emergency Procedures

### Full Rollback to Golden State

Use this if something is seriously broken:

```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Step 1: Check out golden tag
git checkout fleetpro-golden-ui-locked

# Step 2: Reinstall dependencies
npm install

# Step 3: Rebuild
npm run build

# Step 4: Start server
PORT=5050 npm run dev

# Step 5: Verify
curl http://localhost:5050/api/health | jq .

# Rollback time: < 2 minutes
# Data loss: ZERO (git code only, database untouched)
```

### If Server Won't Start

```bash
# Check for port conflicts
lsof -i :5050
# Kill if needed: kill -9 <PID>

# Check logs
tail -f /tmp/fleetpro-canonical-5050.log

# Verify MongoDB is running
mongo --version
lsof -i :27017

# Clear caches and retry
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
rm -rf node_modules package-lock.json
npm install
npm run build
PORT=5050 npm run dev
```

### If Database is Corrupted

```bash
# Step 1: Stop the application
kill -9 $(lsof -ti :5050)

# Step 2: Restore from backup
bash /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/scripts/backup.sh --restore

# Step 3: Restart
PORT=5050 npm run dev

# Data integrity restored
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| UI Lock Status | Must be PASS | Auto-restore if FAIL |
| API Response Time | < 500ms | Investigate slowness |
| Memory Usage | < 1GB | Check for leaks |
| Disk Usage | < 80% | Clean or expand |
| Database Connections | < 50 | Check for leaks |

### Alert Configuration

```bash
# Email alerts
# Configure in health-check.sh:
# ALERT_EMAIL="gacinfotech@gmail.com"

# Slack alerts (optional)
# Set SLACK_WEBHOOK in health-check.sh
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### Manual Alert Test

```bash
# Test email alert
echo "Test alert from FleetPro health check" | \
  mail -s "FleetPro Test Alert - $(date)" gacinfotech@gmail.com

# Verify email received within 5 minutes
```

---

## Maintenance

### Weekly Tasks

```bash
# Monday morning:
1. Review health check logs
   grep "FAIL" /tmp/fleetpro-health-check.log | wc -l
   # Should be 0 failures

2. Verify backups ran
   ls -lh /tmp/fleetpro-*backup* | head -5
   # Should be recent (< 24 hours)

3. Check disk space
   df -h | grep -E '^/dev/|^Filesystem'
   # Should be < 80%
```

### Monthly Tasks

```bash
# First of month:
1. Review UI lock status across all branches
   git for-each-ref --sort=-committerdate refs/heads | head -10

2. Archive old logs
   gzip /tmp/fleetpro-health-check.log.*

3. Test emergency recovery procedure
   # Run: git checkout fleetpro-golden-ui-locked
   # Verify it boots correctly
   # Checkout back to main

4. Review deployment history
   git log --oneline -20
```

### Quarterly Tasks

```bash
# Every 3 months:
1. Update golden baseline if intentional UI redesigns approved
2. Review and update this runbook
3. Conduct team training on emergency procedures
4. Test full disaster recovery (restore from backup)
```

---

## Troubleshooting

### "UI Lock Verification Failed"

```bash
# Check what changed
./scripts/check-ui-lock.sh
# Look for: ✗ CHANGED: <filename>

# Restore the file
./scripts/restore-golden-ui.sh

# Verify restoration
./scripts/verify-golden-ui.sh
```

### "Protected file missing"

```bash
./scripts/check-ui-lock.sh
# Output: ✗ MISSING: <filename>

# Restore it
./scripts/restore-golden-ui.sh

# Git should show the file restored
git status
# If it's not staged, add it:
git add <filename>
```

### "Build fails after UI lock change"

```bash
# Step 1: Restore golden UI
./scripts/restore-golden-ui.sh

# Step 2: Clear build artifacts
rm -rf dist/ .vite/

# Step 3: Rebuild
npm run build

# This should succeed
```

### "Server won't start on port 5050"

```bash
# Check what's using the port
lsof -i :5050

# Kill it if it's an old process
kill -9 <PID>

# Or use a different port for testing
PORT=5051 npm run dev
```

---

## Key Commands Reference

```bash
# Repository
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# UI Lock
./scripts/check-ui-lock.sh              # Fast check
./scripts/verify-golden-ui.sh          # Full verification
./scripts/restore-golden-ui.sh         # Restore golden files

# Server
PORT=5050 npm run dev                  # Start server
lsof -i :5050                          # Check if running
tail -f /tmp/fleetpro-canonical-5050.log # View logs

# Database
mongo 127.0.0.1:27017/fleetpro        # Connect to database
db.adminCommand('ping')                # Check connection

# Health
./scripts/health-check.sh              # Run health checks
tail -f /tmp/fleetpro-health-check.log # View check logs

# Git
git checkout fleetpro-golden-ui-locked # Rollback to golden
git status                             # Check changes
git log -1 --stat                      # See last commit
```

---

## Escalation Path

| Issue | Action | Escalate To |
|-------|--------|------------|
| UI Lock FAIL | Restore golden UI | Dev Lead |
| API errors | Check logs + restart | Backend Lead |
| Database issue | Restore from backup | DBA / Database Lead |
| Build failure | Check compile errors | Dev Lead |
| Performance | Monitor metrics | Infrastructure Lead |

---

## Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Alert Recipient | - | gacinfotech@gmail.com | - |
| Dev Lead | - | TBD | TBD |
| Backend Lead | - | TBD | TBD |
| Database Lead | - | TBD | TBD |

---

**Remember**: The UI Lock prevents accidental UI changes. It's working as intended when:
- ✅ Health checks pass
- ✅ Deployments verify UI before going live
- ✅ Developers can freely add features without changing the UI

**This is normal and good.** It keeps the product stable while development continues.

