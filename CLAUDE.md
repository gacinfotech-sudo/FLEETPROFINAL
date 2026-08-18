# FLEETPRO FINAL INTEGRATOR POLICY
**Effective:** 2026-08-09 18:10 IST  
**Status:** LOCKED - Single Writer Enforcement Active  
**Recovery:** Complete (Phases 1-6 successful)

---

## 🔐 SHARED FILES LOCK (Final Integrator Only)

### Protected Files
These files can ONLY be modified by the Final Integrator:

```
LOCKED FILES (Read-only for all agents except Final Integrator):
├─ client/src/modules/manifest.ts (Navigation registry - 42+ items)
├─ client/src/components/layout/sidebar.tsx (Sidebar rendering)
├─ client/src/App.tsx (Main app component)
├─ client/src/routes.ts (Route definitions)
├─ server/index.ts (Server entry point)
├─ server/connectDB.ts (Database connection)
├─ server/models/index.ts (Database schema)
├─ package.json (Dependencies)
├─ package-lock.json (Dependency lock)
├─ tsconfig.json (TypeScript config)
├─ vite.config.ts (Vite build config)
├─ playwright.config.ts (Test configuration)
└─ All migration files (server/migrations/*)
```

### Why These Files?
- **manifest.ts**: Navigation registry - central authority for all UI features
- **sidebar.tsx**: Sidebar rendering - UI architecture
- **App.tsx, routes.ts**: Core app structure
- **package.json**: Dependency management
- **Database schemas**: Data integrity
- **Config files**: Build reproducibility

### Modification Policy
1. **Read-only for all agents** (enforceable via git hooks)
2. **Only Final Integrator modifies** these files
3. **Changes require approval** from stakeholders
4. **Rollback ready** for every change
5. **No parallel writers** allowed

---

## ✅ PRE-DEPLOY CHECKLIST (Required Before Any Change)

Before modifying ANY protected file:

1. **State Snapshot**
   ```bash
   git status
   git log --oneline -5
   ```
   Verify clean working tree + current commit hash

2. **Feature Inventory**
   ```bash
   grep -c "id:" client/src/modules/manifest.ts
   ```
   Verify 42+ navigation items present

3. **Database Health**
   ```bash
   mongosh --eval "db.customers.countDocuments()"
   ```
   Verify database accessible

4. **Build Validation**
   ```bash
   npm run build
   ```
   Verify 0 TypeScript errors

5. **Backup Creation**
   ```bash
   git tag "pre-change-backup-$(date +%Y%m%d-%H%M%S)"
   ```
   Create recovery point

---

## 🚫 PROHIBITION: Multi-Agent Parallel Writes

**BANNED:** Multiple agents modifying shared files simultaneously

**Why:** 
- Merge conflicts break the build
- Duplicate features get added/removed unpredictably
- Navigation corruption (items disappear then reappear)
- Database schema versions diverge
- Rollback becomes impossible

**Enforcement:**
- git hooks (pre-commit) block commits to protected files
- Code review required for any protected-file changes
- CI blocks merge if protected files not approved
- Single-integrator role required to push

---

## 📋 PRESERVATION GUARANTEES

### What's Preserved
✅ All 42+ navigation items (manifest.ts)  
✅ All 87 MongoDB collections (database)  
✅ All 57 worktrees (tagged, archived, NOT deleted)  
✅ All git history (commits, branches, tags)  
✅ All build artifacts (dist/, public/)  
✅ All test results (E2E tests documented)  

### What's Locked
🔒 manifest.ts (navigation registry)  
🔒 sidebar.tsx (sidebar rendering)  
🔒 package.json (dependencies)  
🔒 Database schemas (server/models/)  
🔒 Build configs (vite, tsconfig, playwright)  
🔒 Migration files (server/migrations/)  

### What's Open
✅ Feature development (in isolated worktrees)  
✅ Bug fixes (via Final Integrator review)  
✅ UI enhancements (in isolated branches)  
✅ Test improvements (E2E tests can evolve)  
✅ Documentation updates (README, docs/)  

---

## 🔄 CHANGE REQUEST PROCESS

### To Add a New Feature

1. **Create Isolated Worktree**
   ```bash
   git worktree add feature/my-feature
   ```

2. **Develop in Isolation**
   - Make all changes in your worktree
   - Do NOT modify protected files
   - Test thoroughly
   - Create commits with clear messages

3. **Request Integration**
   - Create pull request
   - Get code review
   - Final Integrator cherry-picks or merges
   - Verify no conflicts with manifest.ts

4. **Final Integrator Approval**
   - Reviews for navigation conflicts
   - Verifies 42+ items still present
   - Runs build validation
   - Merges to main

### To Fix a Bug

Same process:
1. Isolate in worktree
2. Fix + test
3. Request review
4. Final Integrator validates + merges

### To Modify Protected Files

**REQUIRES EXPLICIT APPROVAL:**
1. Create pull request with detailed justification
2. Get stakeholder sign-off
3. Final Integrator executes change
4. Create pre-change backup tag
5. Run full test suite
6. Deploy + monitor

---

## 🎯 FINAL INTEGRATOR RESPONSIBILITIES

### Daily
- Monitor :5050 server health
- Review change requests
- Approve feature integrations
- Ensure no parallel writers

### Per Change
- Verify manifest.ts integrity (42+ items)
- Run `npm run build` (0 errors required)
- Verify database accessibility
- Create backup tag (pre-change snapshot)
- Deploy + validate
- Document change in git history

### Weekly
- Archive successful worktrees
- Review test results
- Monitor server performance
- Backup production database

---

## 🚨 RECOVERY PROCEDURES

### If Build Fails
```bash
git checkout production-live-20260809-212440
npm run build
```

### If Database Corrupt
```bash
mongorestore --uri "mongodb://127.0.0.1:27017/" /Users/pradeep/backups/phase-6-pre-deploy/*/
```

### If Navigation Broken
```bash
git show production-live-20260809-212440:client/src/modules/manifest.ts
# Verify 42+ items present
```

### Full Rollback
```bash
git reset --hard production-live-20260809-212440
npm run build
PORT=5050 npm run dev
```

---

## 📊 LOCK STATUS

**Current State:**
- ✅ Production deployed (commit 1a1d569)
- ✅ All 42+ features live on :5050
- ✅ Database verified healthy (87 collections)
- ✅ Backup tagged (production-live-20260809-212440)
- ✅ Single-integrator lock active
- ✅ Parallel writers blocked

**Lock Enforced By:**
- Git hooks (pre-commit validation)
- CLAUDE.md policy (this file)
- Code review requirements
- Final Integrator approval gate
- Backup + rollback procedures

---

## 📝 HISTORY

**2026-08-09 18:10 IST** — PHASE 7 LOCKS ACTIVATED
- Production deployed to :5050 (commit 1a1d569)
- All 42+ navigation items live
- 87 MongoDB collections accessible
- Single-integrator policy enforced
- Backup tag created: production-live-20260809-212440
- Shared files locked (Final Integrator only)

---

## ✅ POLICY ACKNOWLEDGMENT

This policy is:
- ✅ Documented (this CLAUDE.md file)
- ✅ Enforced (git hooks + review gates)
- ✅ Backed up (pre-change snapshots)
- ✅ Reversible (rollback procedures ready)
- ✅ Transparent (all agents can read)

**Status: ACTIVE AND ENFORCED**

---

*Recovery complete. Final integrator policy in effect. Single-writer mode enabled.*
