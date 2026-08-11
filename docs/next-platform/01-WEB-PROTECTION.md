# Web Protection & Isolation Policy

**Status**: ACTIVE  
**Date**: 2026-08-12  
**Protected Port**: `:5050`  
**Protected Branch**: `main` (production live)

---

## Current Protected System State

### Port `:5050` — THE CANONICAL LIVE WEB CRM

**Status**: ✅ OPERATIONAL  
**Last Deploy**: 2026-08-11 (commit 781da47)  
**Database**: Canonical MongoDB (shared with mobile dev)  
**Users**: Production tenants + QA  
**Monitoring**: 24/7 active  

**DO NOT**:
- Modify :5050 code directly during development
- Restart :5050 without explicit approval
- Drop/rebuild database tables
- Rename existing fields
- Change authentication behavior
- Modify existing booking logic
- Touch manifest.ts (navigation registry)
- Touch package.json (dependencies)

### Protected Branches

```
main
  ├─ 781da47 🎉 FINAL: FleetPro Production Deployment - LIVE ON :5050
  └─ b983eb7 🚀 PHASES 16-20: PRODUCTION DEPLOYMENT COMPLETE
  └─ [all production history preserved]

repair/full-saas-stabilization
  └─ [current uncommitted state — STASHED for safety]
```

**DO NOT**:
- Force-push main
- Rebase main
- Delete main
- Merge breaking changes to main

### Protected Files

These files must NOT be modified during isolated development:

```
✅ LOCKED (Final Integrator Only):
├─ client/src/modules/manifest.ts (Navigation registry — 42+ items)
├─ client/src/components/layout/sidebar.tsx (Sidebar rendering)
├─ client/src/App.tsx (Main app component)
├─ client/src/routes.ts (Route definitions)
├─ server/index.ts (Server entry point)
├─ server/connectDB.ts (Database connection)
├─ server/models/index.ts (Mongoose schema)
├─ package.json (Dependencies)
├─ tsconfig.json (TypeScript config)
├─ vite.config.ts (Vite config)
├─ playwright.config.ts (Test config)
└─ server/migrations/* (All migration files)
```

---

## Development Isolation Strategy

### Branch Structure

```
main (PROTECTED — :5050 production)
  │
  └─ feature/fleetpro-next-platform (development)
       │
       ├─ wave0-baseline-checkpoint
       ├─ wave1-domain-audit
       ├─ wave2-customer-identity
       ├─ wave3-mobile-api
       ├─ wave4-driver-lite-shell
       └─ [continues through WAVE 19]
```

### Development Ports

```
:5050  ← PROTECTED: Web CRM (never touch)
:5051  ← Development: Wave testing
:5052–5098 ← Development: Reserved for parallel work
```

### Database Strategy

**ONE canonical MongoDB** (shared with Web :5050):
- Existing collections read-only (during isolated dev)
- New test collections for mobile development
  - `drivers_mobile_test`
  - `bookings_mobile_test`
  - `sync_operations_test`
  - etc.
- Existing production data stays intact
- No dropping/rebuilding existing schemas

**Before final merge**:
- Migrate test collections to canonical names (one-time, after approval)
- Verify existing data not corrupted
- Rollback ready

---

## What Changes & What Doesn't

### ✅ SAFE TO CHANGE (in feature/fleetpro-next-platform)

- Create new API routes (`/mobile/v1/*`)
- Create new services (`DriverAssignmentService`, `PhoneNormalizer`, etc.)
- Create new models/components for mobile UI
- Add new database collections (sync, operations, device registration)
- Add new indexes (for mobile queries)
- Create mobile-specific packages (Android APK structure)
- Create documentation (this directory)
- Create tests (mobile-specific E2E tests)

### ❌ DO NOT CHANGE (protected)

- Existing Booking logic (use it as-is; create adapter if needed)
- Existing Customer model (add fields only; don't rename)
- Existing Driver model (add fields only; don't rename)
- Existing Payment logic (use as-is; create adapter if needed)
- Existing API routes (never modify `/api/*` routes; add `/mobile/v1/*` instead)
- Manifest.ts (navigation registry)
- Existing database migrations (create new ones only)
- package.json (do NOT add dependencies; use what exists)

---

## Integration Checkpoints

### Before Pushing to feature/fleetpro-next-platform

```bash
# 1. Verify :5050 still running
curl http://localhost:5050/api/health

# 2. Verify main branch untouched
git log main -1 --oneline  # Should be 781da47

# 3. Build your changes locally
npm run build

# 4. Check for any imports of protected files
grep -r "from.*manifest\|from.*routes\.ts\|from.*models/index" src/ server/

# 5. Create checkpoint tag
git tag "pre-$(git branch --show-current)-$(date +%Y%m%d-%H%M%S)"
```

### Before Merging to main (Final Integration)

```bash
# 1. :5050 running on latest main?
git checkout main
PORT=5050 npm start
# Wait 30s, check curl http://localhost:5050/api/health

# 2. Database clean?
mongosh --eval "db.customers.countDocuments()"  # Should have data

# 3. All existing tests pass?
npm run test:e2e

# 4. Build with zero TS errors?
npm run build

# 5. Feature branches can merge cleanly?
git merge --no-commit --no-ff feature/fleetpro-next-platform
git merge --abort

# 6. Create full backup tag
git tag "pre-merge-$(date +%Y%m%d-%H%M%S)"
git tag -d "pre-merge-*" # Keep only 3 most recent

# 7. Merge only with explicit approval
# [Approval obtained from stakeholders]
git merge feature/fleetpro-next-platform
```

---

## Failure Scenarios & Recovery

### Scenario: :5050 Goes Down

**DO NOT**:
- ❌ Rewrite booking logic
- ❌ Modify database manually
- ❌ Force restart without investigation

**DO**:
- ✅ Check logs: `tail -f .server-5050.log`
- ✅ Check database: `mongosh --eval "db.adminCommand('ping')"`
- ✅ Check port conflict: `lsof -i :5050`
- ✅ Rollback last code change if recent
- ✅ Restore from backup if data corruption

### Scenario: Database Corrupted

**DO NOT**:
- ❌ Drop collections manually
- ❌ Rebuild schema
- ❌ Delete production data

**DO**:
- ✅ Stop services: `npm stop`
- ✅ Restore from backup: `mongorestore --uri "mongodb://..." /backups/`
- ✅ Verify: `mongosh --eval "db.customers.findOne()"`
- ✅ Restart: `npm start`

### Scenario: Accidental Change to Protected File

**DO NOT**:
- ❌ Force-push to main
- ❌ Rebase to hide commits
- ❌ Delete branch

**DO**:
- ✅ Revert commit: `git revert <commit-hash>`
- ✅ Create PR for review
- ✅ Get approval before merging
- ✅ Document root cause

### Scenario: Main Branch Diverges from :5050

**DO NOT**:
- ❌ Assume :5050 is outdated
- ❌ Force main to match :5050 logic

**DO**:
- ✅ Check current commit on :5050: `git log --oneline main -3`
- ✅ Verify git tag: `git tag | grep "live\|production" | sort -V | tail -1`
- ✅ Compare: main commit should match latest production tag
- ✅ If diverged: Create bug fix PR (don't force-push)

---

## Communication Protocol

### When Deploying to :5050 (Final Integration)

1. **Announce** in team chat: "Deploying to :5050 at [time]"
2. **Wait** for acknowledgment from ops
3. **Deploy** with explicit approval
4. **Monitor** for 5 minutes (check metrics, logs)
5. **Confirm** success or rollback

### When Discovering Issues

1. **Stop** further changes to main
2. **Investigate** root cause (1–2 hours max)
3. **Fix** in isolated PR
4. **Test** thoroughly before merging
5. **Tag** recovery point: `git tag "fix-issue-name-$(date)"`

### If Main Goes Into Bad State

1. **Immediate rollback**: `git reset --hard <last-good-commit>`
2. **Notify team** of rollback
3. **Investigate** what went wrong
4. **Create issue** to prevent recurrence
5. **Do not merge** any suspect code without thorough review

---

## Rollback Procedures

### Quick Rollback (If :5050 Broken)

```bash
# 1. Identify last good commit
git log --oneline main | head -10

# 2. Rollback
git reset --hard <commit-hash>

# 3. Rebuild + restart
npm run build
PORT=5050 npm start

# 4. Verify health
curl http://localhost:5050/api/health
```

### Full Rollback (If Database Corrupted)

```bash
# 1. Stop server
npm stop

# 2. Restore database from backup
mongorestore --uri "mongodb://127.0.0.1:27017/" /backups/last-known-good/

# 3. Rollback code
git reset --hard <last-good-commit>

# 4. Rebuild + restart
npm run build
PORT=5050 npm start

# 5. Verify
mongosh --eval "db.customers.countDocuments()"
curl http://localhost:5050/api/health
```

### Partial Rollback (One Bad Commit)

```bash
# 1. Create revert commit (don't force-push)
git revert <bad-commit-hash>

# 2. Verify no conflicts
git status

# 3. Push (will be reviewed before merging)
git push origin feature/fleetpro-next-platform
```

---

## Approval Gates

### Changes Requiring Explicit Approval

- ❌ Any modification to main branch
- ❌ Any change to protected files
- ❌ Any deployment to :5050
- ❌ Any database migration affecting existing tables
- ❌ Any removal of existing features
- ❌ Any change to existing API contracts

### Changes NOT Requiring Approval

- ✅ New API routes in feature/fleetpro-next-platform
- ✅ New services/utilities in feature/fleetpro-next-platform
- ✅ New tests in feature/fleetpro-next-platform
- ✅ Documentation updates
- ✅ New database collections (test-scoped)

---

## Audit Trail

### Commands to Verify Protection

```bash
# Check main is protected
git log main -1

# Check :5050 hasn't changed
curl http://localhost:5050/api/health

# Check protected files unchanged
git diff main -- client/src/modules/manifest.ts
git diff main -- server/models/index.ts

# Check feature branch exists
git branch | grep feature/fleetpro-next-platform

# Check stashed changes from repair/full-saas
git stash list | head -3
```

---

## Summary

| Item | Status | Action |
|------|--------|--------|
| :5050 Port | 🟢 Protected | Never modify |
| main Branch | 🟢 Protected | No direct pushes |
| Protected Files | 🔒 Locked | Read-only |
| feature/fleetpro-next-platform | ✅ Active | Develop here |
| Database | ⚠️ Shared | Test collections only |
| Backups | ✅ Ready | Created before changes |
| Rollback | ✅ Ready | Procedures documented |

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-12  
**Approval Status**: LOCKED & ENFORCED
