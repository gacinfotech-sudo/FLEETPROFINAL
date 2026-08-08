# FLEETPRO UI LOCK — ACCEPTANCE TEST CHECKLIST
**Phase 26-27: Final Verification Before Production**

**Date**: 2026-08-09  
**Status**: READY FOR TEAM TESTING  

---

## How To Use This Checklist

1. Assign tasks to team members based on role
2. Complete each test in order
3. Check box when verified ✅
4. Note any issues or concerns
5. Report results to project lead

**Estimated Time**: 2-3 hours for full team

---

## SECTION 1: INFRASTRUCTURE (30 minutes)

### Repo Setup & Configuration

- [ ] **Clone Repository**
  - [ ] Command: `git clone <repo>`
  - [ ] Verify no errors
  - [ ] Check `.ui-lock/` directory exists
  - [ ] Check `.git/hooks/` directory exists

- [ ] **Run Setup Script**
  - [ ] Command: `bash scripts/setup-ui-lock.sh`
  - [ ] All checks should pass (✅)
  - [ ] Verification runs successfully
  - [ ] Output shows "UI Lock is fully set up"

- [ ] **Verify Golden Tag**
  - [ ] Command: `git tag | grep fleetpro-golden`
  - [ ] Shows: `fleetpro-golden-ui-locked`
  - [ ] Command: `git rev-parse fleetpro-golden-ui-locked`
  - [ ] Shows: `94844c5...`

- [ ] **Check Protected Files Manifest**
  - [ ] Command: `wc -l .ui-lock/protected-ui-files.txt`
  - [ ] Shows: 39 files
  - [ ] Command: `cat .ui-lock/protected-ui-files.txt | head`
  - [ ] Shows: app files and UI components

- [ ] **Verify Hash File**
  - [ ] Command: `jq '.metadata' .ui-lock/golden-ui-hashes.json`
  - [ ] Shows golden_commit, golden_branch, timestamp
  - [ ] Command: `jq '.protected_files | keys | length' .ui-lock/golden-ui-hashes.json`
  - [ ] Shows: 17

---

## SECTION 2: DEVELOPER WORKFLOW (45 minutes)

### Test as a Developer (Use different git user if possible)

- [ ] **Create Feature Branch**
  - [ ] Command: `git checkout -b test/ui-lock-acceptance`
  - [ ] Verify you're on new branch

- [ ] **Add Backend Feature (Should Succeed)**
  - [ ] Create test file: `echo "// test" > server/services/test-service.ts`
  - [ ] Stage it: `git add server/services/test-service.ts`
  - [ ] Commit it: `git commit -m "test: add test service"`
  - [ ] ✅ Commit succeeds (no UI lock error)
  - [ ] Cleanup: `git reset --hard HEAD~1`

- [ ] **Try to Modify Dashboard (Should Fail)**
  - [ ] Modify: `echo "// modified" >> client/src/pages/dashboard.tsx`
  - [ ] Stage: `git add client/src/pages/dashboard.tsx`
  - [ ] Try commit: `git commit -m "test: modify dashboard"`
  - [ ] ✅ Commit fails with UI LOCK VIOLATION message
  - [ ] Message shows: "Cannot commit changes to protected files"
  - [ ] Cleanup: `git reset --hard`

- [ ] **Try to Modify Sidebar (Should Fail)**
  - [ ] Modify: `echo "// modified" >> client/src/components/layout/sidebar.tsx`
  - [ ] Stage: `git add client/src/components/layout/sidebar.tsx`
  - [ ] Try commit: `git commit -m "test: modify sidebar"`
  - [ ] ✅ Commit fails with UI LOCK VIOLATION message
  - [ ] Cleanup: `git reset --hard`

- [ ] **Restore From Accidental Change**
  - [ ] Modify dashboard: `echo "// modified" >> client/src/pages/dashboard.tsx`
  - [ ] Run restore: `bash scripts/restore-golden-ui.sh`
  - [ ] Say "yes" to confirmation
  - [ ] ✅ File is restored to golden state
  - [ ] Verify: `git status` shows modified dashboard.tsx
  - [ ] Cleanup: `git checkout -- .`

---

## SECTION 3: VERIFICATION SCRIPTS (30 minutes)

### Test Each Automation Script

- [ ] **Check-UI-Lock Script**
  - [ ] Command: `bash scripts/check-ui-lock.sh`
  - [ ] ✅ Output shows all ✓ (green checkmarks)
  - [ ] Shows count of checked files
  - [ ] Exit code: `echo $?` returns 0
  - [ ] No violations reported

- [ ] **Verify-Golden-UI Script**
  - [ ] Command: `bash scripts/verify-golden-ui.sh`
  - [ ] ✅ All checks pass (✓ marks)
  - [ ] Shows: "[GIT STATE]" section
  - [ ] Shows: "[PROTECTED FILES]" section
  - [ ] Shows: "[BUILD STATUS]" section
  - [ ] Shows: "[DOCUMENTATION]" section
  - [ ] Shows green summary at end
  - [ ] Exit code: 0

- [ ] **Restore-Golden-UI Script**
  - [ ] No files to restore (baseline is clean)
  - [ ] Output explains this politely
  - [ ] Exit code: 0

- [ ] **Health Check Script**
  - [ ] Command: `bash scripts/health-check.sh | grep "UI Lock"`
  - [ ] ✅ Shows: "✓ UI Lock: PASS"
  - [ ] Full health report appears
  - [ ] No critical failures

---

## SECTION 4: GIT HOOKS (20 minutes)

### Test Pre-commit Hook

- [ ] **Hook Installation**
  - [ ] File exists: `.git/hooks/pre-commit`
  - [ ] Is executable: `test -x .git/hooks/pre-commit && echo "yes"`
  - [ ] Contains UI LOCK logic: `grep -q "UI LOCK CHECK" .git/hooks/pre-commit`

- [ ] **Hook Behavior - Protects UI Files**
  - [ ] Modify protected file: `echo "test" >> client/src/components/ui/card.tsx`
  - [ ] Stage: `git add client/src/components/ui/card.tsx`
  - [ ] Try commit: `git commit -m "test"`
  - [ ] ✅ Hook blocks commit with error message
  - [ ] Cleanup: `git reset --hard`

- [ ] **Hook Behavior - Allows Backend**
  - [ ] Create backend file: `echo "test" > server/test.ts`
  - [ ] Stage: `git add server/test.ts`
  - [ ] Commit: `git commit -m "test: backend"`
  - [ ] ✅ Commit succeeds
  - [ ] Cleanup: `git reset --hard HEAD~1 && rm server/test.ts`

- [ ] **Hook Behavior - Override**
  - [ ] Create override: `touch .ui-lock/.allow-ui-changes`
  - [ ] Modify UI: `echo "test" >> client/src/components/ui/button.tsx`
  - [ ] Stage: `git add .ui-lock/.allow-ui-changes client/src/components/ui/button.tsx`
  - [ ] Commit: `git commit -m "test: override"`
  - [ ] ✅ Commit succeeds with override present
  - [ ] Remove override: `rm .ui-lock/.allow-ui-changes`
  - [ ] Cleanup: `git reset --hard HEAD~1`

---

## SECTION 5: BUILD & DEPLOYMENT (30 minutes)

### Test Build Verification

- [ ] **Normal Build (Should Succeed)**
  - [ ] Command: `npm run build`
  - [ ] ✅ Build completes without errors
  - [ ] No UI-related warnings
  - [ ] Output shows "dist/" created

- [ ] **API Health Check**
  - [ ] Server running: `lsof -i :5050 | grep -q node && echo "running"`
  - [ ] If not running: `PORT=5050 npm run dev &`
  - [ ] Health endpoint: `curl http://localhost:5050/api/health`
  - [ ] ✅ Returns 200 OK
  - [ ] Response shows `"status":"ok"`

- [ ] **Dashboard Loads Correctly**
  - [ ] Server running on :5050
  - [ ] Browser: `http://localhost:5050/dashboard/dashboard`
  - [ ] ✅ Page loads without errors
  - [ ] UI looks correct (matches golden baseline)
  - [ ] No console errors (F12 → Console)
  - [ ] Sidebar visible and functional
  - [ ] Header visible with navigation

---

## SECTION 6: CI/CD INTEGRATION (30 minutes)

### Test GitHub Actions (If GitHub repo available)

- [ ] **Workflow File Exists**
  - [ ] File: `.github/workflows/ui-lock-verify.yml`
  - [ ] ✅ Contains GitHub Actions syntax
  - [ ] Has job: `ui-lock-check`
  - [ ] Has job: `build-check`

- [ ] **Simulate CI Check Locally** (using act or Docker)
  - [ ] Command: `bash scripts/check-ui-lock.sh`
  - [ ] ✅ Passes
  - [ ] Command: `npm run build`
  - [ ] ✅ Succeeds

- [ ] **Test PR Comment (GitHub only)**
  - [ ] Create test branch
  - [ ] Make small backend change
  - [ ] Push to GitHub
  - [ ] Create pull request
  - [ ] ✅ CI runs automatically
  - [ ] ✅ Workflow shows "UI Lock Verification"
  - [ ] ✅ All checks pass
  - [ ] ✅ Comment appears on PR

- [ ] **Test Blocked Merge (GitHub only)**
  - [ ] Create test branch
  - [ ] Modify protected file (dashboard.tsx)
  - [ ] Push to GitHub
  - [ ] Create pull request
  - [ ] ✅ CI runs and fails
  - [ ] ✅ Status shows red ❌
  - [ ] ✅ Merge button is disabled
  - [ ] ✅ Error message visible

---

## SECTION 7: DOCUMENTATION (20 minutes)

### Verify All Docs Are Present & Accurate

- [ ] **Developer Guide**
  - [ ] File: `docs/ui-lock/DEVELOPER-GUIDE.md`
  - [ ] ✅ Exists and is readable
  - [ ] Contains: "Can I change X" section
  - [ ] Contains: Common scenarios
  - [ ] Contains: Dashboard extension points
  - [ ] Test: Developer reads and understands workflow

- [ ] **OPS Guide**
  - [ ] File: `docs/ui-lock/OPS-GUIDE.md`
  - [ ] ✅ Exists and is readable
  - [ ] Contains: Health check setup
  - [ ] Contains: Emergency procedures
  - [ ] Contains: Incident response
  - [ ] Test: Ops person reads and understands procedures

- [ ] **Quick Reference**
  - [ ] File: `docs/ui-lock/QUICK-REFERENCE.md`
  - [ ] ✅ Exists and is readable
  - [ ] Contains: Permission matrix
  - [ ] Contains: One-liners
  - [ ] Contains: Emergency recovery

- [ ] **Golden Baseline**
  - [ ] File: `docs/ui-lock/GOLDEN-UI-BASELINE.md`
  - [ ] ✅ References commit 94844c5
  - [ ] ✅ References tag fleetpro-golden-ui-locked
  - [ ] Contains: Visual layout spec
  - [ ] Contains: Component hierarchy
  - [ ] Contains: Protected files list

- [ ] **CI/CD Integration**
  - [ ] File: `docs/ui-lock/CI-CD-INTEGRATION.md`
  - [ ] ✅ Contains GitHub Actions example
  - [ ] ✅ Contains GitLab CI example
  - [ ] Contains: Override procedures
  - [ ] Contains: Branch protection rules

---

## SECTION 8: TEAM READINESS (20 minutes)

### Verify Team Can Use the System

- [ ] **Developer Can Understand What's Protected**
  - [ ] Developer reads DEVELOPER-GUIDE.md
  - [ ] Developer can answer: "Can I modify dashboard.tsx?" (NO)
  - [ ] Developer can answer: "Can I add a new page?" (YES)
  - [ ] Developer can answer: "Can I add a dashboard card?" (YES via registry)

- [ ] **Developer Can Recover From Mistake**
  - [ ] Developer accidentally modifies sidebar.tsx
  - [ ] Developer knows to run: `bash scripts/restore-golden-ui.sh`
  - [ ] Developer successfully restores files
  - [ ] Developer commits the fix

- [ ] **Ops Can Monitor UI Lock**
  - [ ] Ops person knows where health check is: `scripts/health-check.sh`
  - [ ] Ops person can set up cron job
  - [ ] Ops person can read health check output
  - [ ] Ops person understands alert triggers

- [ ] **Ops Can Respond to Incidents**
  - [ ] Ops reads OPS-GUIDE.md section "Incident Response"
  - [ ] Ops can run: `bash scripts/restore-golden-ui.sh`
  - [ ] Ops can run: `git checkout fleetpro-golden-ui-locked`
  - [ ] Ops knows how to rollback and redeploy

- [ ] **Team Can Do Intentional UI Redesign**
  - [ ] Design team understands approval process
  - [ ] Developers understand override token: `.ui-lock/.allow-ui-changes`
  - [ ] Team knows how to regenerate baseline
  - [ ] Team knows how to create new golden tag

---

## SECTION 9: PERFORMANCE (15 minutes)

### Verify No Significant Performance Impact

- [ ] **Script Execution Time**
  - [ ] Command: `time bash scripts/check-ui-lock.sh`
  - [ ] ✅ Completes in < 5 seconds
  - [ ] Command: `time bash scripts/verify-golden-ui.sh`
  - [ ] ✅ Completes in < 10 seconds

- [ ] **Pre-commit Hook Impact**
  - [ ] Command: `time git commit --allow-empty -m "test"`
  - [ ] ✅ Commit completes in < 2 seconds
  - [ ] Overhead is negligible

- [ ] **Build Performance**
  - [ ] Command: `time npm run build`
  - [ ] ✅ No significant slowdown from UI lock checks
  - [ ] Build time is normal for this repo

---

## SECTION 10: SECURITY (15 minutes)

### Verify Security Properties

- [ ] **Hash Integrity**
  - [ ] All hashes are valid SHA256 (64 hex chars)
  - [ ] No hashes can be guessed or brute-forced
  - [ ] File changes are immediately detected

- [ ] **Git Tag Protection**
  - [ ] Golden tag cannot be deleted accidentally
  - [ ] Tag points to immutable commit
  - [ ] Rollback to golden is always possible

- [ ] **No Credentials in Lock Files**
  - [ ] Check: `grep -r "password\|token\|secret" .ui-lock/`
  - [ ] ✅ No credentials found
  - [ ] Safe to commit to repository

- [ ] **Override Token Cleanup**
  - [ ] `.allow-ui-changes` token is temporary
  - [ ] Documentation clearly explains to remove it
  - [ ] Token not in `.gitignore` (intentional for safety)

---

## SECTION 11: EDGE CASES (20 minutes)

### Test Unusual Scenarios

- [ ] **Multiple Protected Files Changed**
  - [ ] Modify multiple files: dashboard.tsx, sidebar.tsx, header.tsx
  - [ ] Try to commit
  - [ ] ✅ Hook reports all three violations

- [ ] **Protected File Deleted**
  - [ ] Delete: `rm client/src/components/ui/button.tsx`
  - [ ] Try to commit deletion
  - [ ] ✅ Hook blocks deletion

- [ ] **Protected File Added (Different Content)**
  - [ ] Create new file: `client/src/components/ui/new-component.tsx`
  - [ ] Stage it
  - [ ] ✅ Can commit (it's a new file, not in protected list)

- [ ] **Switching Branches**
  - [ ] Create test branch with changes
  - [ ] Switch to golden: `git checkout fleetpro-golden-ui-locked`
  - [ ] ✅ Git handles checkout correctly
  - [ ] Files match golden state
  - [ ] Switch back: `git checkout booking/integration-preview`

- [ ] **Rebase Onto Golden**
  - [ ] Create feature branch
  - [ ] Make commits
  - [ ] Rebase: `git rebase fleetpro-golden-ui-locked`
  - [ ] ✅ Rebase works correctly
  - [ ] No UI lock interference

---

## SECTION 12: FINAL CHECKLIST

### Sign-off Criteria

- [ ] All tests in Sections 1-11 are complete
- [ ] All checks are passing ✅
- [ ] No blockers or critical issues
- [ ] Team understands the system
- [ ] Documentation is clear and complete
- [ ] Scripts are working correctly
- [ ] Build and deployment verified
- [ ] Emergency procedures tested
- [ ] Performance is acceptable
- [ ] Security properties verified

### Issues Found

List any issues, gaps, or concerns:

```
Issue #1: [Description]
Impact: [Critical/High/Medium/Low]
Resolution: [How to fix]

Issue #2: [Description]
Impact: [Critical/High/Medium/Low]
Resolution: [How to fix]
```

---

## FINAL APPROVAL

**Date Completed**: ________________  
**Completed By**: ________________  
**Team Lead Review**: ________________  

### Sign-off

- [ ] All acceptance tests passed
- [ ] No critical issues remain
- [ ] Ready for production deployment
- [ ] Team trained and confident

**Approval**: ✅ READY FOR PRODUCTION

---

## Post-Deployment Tasks

After this checklist is complete and approved:

1. [ ] Configure GitHub branch protection rules
2. [ ] Set up cron jobs for automated health checks
3. [ ] Distribute documentation to team
4. [ ] Conduct optional team training
5. [ ] Monitor first week of operations
6. [ ] Adjust procedures based on feedback

---

**Next**: Deploy to production and begin operations

