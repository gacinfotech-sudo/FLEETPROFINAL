# FLEETPRO UI LOCK — DEVELOPER GUIDE
**For**: Development team working on FleetPro  
**Date**: 2026-08-09  
**Status**: ACTIVE ENFORCEMENT  

---

## Quick Answer: Can I Change X?

### ✅ YES — These Changes Are Allowed

**Backend & API Changes**
```
✅ Add new API endpoint in server/routes.ts
✅ Modify business logic in server/services/
✅ Add new database collection
✅ Create new database migration
✅ Update authentication logic
✅ Add new middleware
```

**Feature Pages**
```
✅ Create new page: client/src/pages/my-feature.tsx
✅ Add new component: client/src/components/my-feature/
✅ Add feature-specific styles
✅ Add feature configuration
```

**Dashboard Extensions** (Via Registry)
```
✅ Add new card/widget to dashboard (via registration)
✅ Add data source to existing card
✅ Add new tab to 360 modules (via registry)
✅ Register new sidebar menu item
```

**Configuration & Documentation**
```
✅ Update package.json (add dependencies)
✅ Update .env files
✅ Create new documentation
✅ Add tests for your feature
✅ Update README
```

### ❌ NO — These Changes Are Blocked

**Protected UI Files**
```
❌ Modify client/src/pages/dashboard.tsx
❌ Modify client/src/components/layout/sidebar.tsx
❌ Modify client/src/components/layout/header.tsx
❌ Modify client/src/App.tsx
❌ Modify client/src/index.css (global styles)
❌ Modify tailwind.config.js
❌ Modify theme files
```

**Why?** These files define the core UI structure. Changes to them cascade and cause visual regressions.

---

## Common Development Scenarios

### Scenario 1: Adding a New Feature (Backend)

```bash
# ✅ This is allowed — no UI changes

# 1. Create your feature routes
vim server/routes.ts
# Add: app.get('/api/my-feature', ...)

# 2. Create business logic
vim server/services/myFeatureService.ts
# Implement your logic

# 3. Commit your work
git add server/
git commit -m "feat: add my-feature backend support"

# ✓ Commit will succeed — no UI lock violation
```

### Scenario 2: Adding a New Dashboard Widget

```bash
# ✅ This is allowed — use the extension point

# 1. Create your widget component
mkdir -p client/src/components/dashboard/my-widget
vim client/src/components/dashboard/my-widget/index.tsx
# Implement your widget

# 2. Register with dashboard (do NOT modify dashboard.tsx)
vim client/src/lib/dashboard-registry.ts
# Add: registry.register('my-widget', MyWidget, config)

# 3. Commit
git add client/src/components/dashboard/my-widget
git add client/src/lib/dashboard-registry.ts
git commit -m "feat: add my-widget to dashboard"

# ✓ Commit will succeed — no modification to protected dashboard.tsx
```

### Scenario 3: You Accidentally Changed dashboard.tsx

```bash
# ❌ This is blocked at commit time

git add client/src/pages/dashboard.tsx
git commit -m "fix: update dashboard"

# Error output:
# [UI LOCK CHECK]
# UI LOCK VIOLATION — Cannot commit changes to protected files
# Protected files about to be modified:
#   • STAGED_CHANGE: client/src/pages/dashboard.tsx

# Solution:
git reset HEAD client/src/pages/dashboard.tsx
git checkout client/src/pages/dashboard.tsx
# (your changes are discarded, use the extension point instead)
```

### Scenario 4: Intentional Dashboard Redesign (Approved)

```bash
# ❌ Normally blocked, but with approval:

# 1. Get approval from design team
# "We're redesigning the dashboard UI for Q3"
# Design team: "✅ Approved"

# 2. Create override token (one-time)
touch .ui-lock/.allow-ui-changes

# 3. Implement your redesign
vim client/src/pages/dashboard.tsx
vim client/src/components/dashboard/
# ... make all your UI changes ...

# 4. Test your changes
npm run build
PORT=5051 npm run dev
# Visit http://localhost:5051/dashboard/dashboard
# Verify everything looks correct

# 5. Commit with EXPLICIT message
git add -A
git commit -m "redesign: dashboard UI overhaul (approved Q3-redesign)"

# 6. IMPORTANT: Remove the override token
rm .ui-lock/.allow-ui-changes

# 7. Generate new golden baseline
./scripts/verify-golden-ui.sh

# 8. Commit the new baseline
git add .ui-lock/golden-ui-hashes.json docs/ui-lock/GOLDEN-UI-BASELINE.md
git commit -m "update: golden UI baseline after Q3-redesign"

# ✓ Now the new design is the protected baseline
```

---

## Working With UI Lock

### Check Current Status

```bash
# Quick check — are protected files modified?
./scripts/check-ui-lock.sh

# Full verification — all systems go?
./scripts/verify-golden-ui.sh
```

### Restore Golden UI (Accidental Changes)

```bash
# If you accidentally modified protected files:
./scripts/restore-golden-ui.sh

# Follow the prompts, it will:
# 1. Show what will be restored
# 2. Ask for confirmation
# 3. Restore files from golden tag
# 4. Show you how to commit the fix

# Commit the restoration
git add -A
git commit -m "fix: restore golden UI"
```

### Compare with Golden

```bash
# See what changed from golden
git diff fleetpro-golden-ui-locked -- client/src/pages/dashboard.tsx

# See full diff since golden
git diff fleetpro-golden-ui-locked

# Check out golden temporarily to compare
git stash
git checkout fleetpro-golden-ui-locked
# ... review the golden version ...
npm run build && PORT=5051 npm run dev

# Go back to your branch
git checkout booking/integration-preview
git stash pop
```

---

## Common Questions

### Q: How do I add a new menu item to the sidebar?

**A**: Use the sidebar registry, don't modify `sidebar.tsx` directly.

```typescript
// ✅ GOOD: Register via config
// client/src/lib/sidebar-registry.ts
registry.addMenuItem({
  path: '/my-feature',
  label: 'My Feature',
  icon: 'MyIcon',
  order: 10
})

// ❌ WRONG: Modify sidebar.tsx
// This will be blocked at commit time
```

### Q: Can I change the header styling?

**A**: No, header is protected. Create feature-specific styling instead.

```tsx
// ❌ BLOCKED: Modifying client/src/components/layout/header.tsx

// ✅ GOOD: Create feature-specific styled version
// client/src/components/my-feature/my-feature-header.tsx
export const MyFeatureHeader = () => {
  // Your custom styled header for your feature
}
```

### Q: I need to modify the dashboard to support my feature. What do I do?

**A**: Use the dashboard extension registry instead:

```typescript
// ✅ CORRECT APPROACH

// 1. Create your card/widget component
// client/src/components/dashboard/my-card/index.tsx

// 2. Register it with the dashboard
// client/src/lib/dashboard-registry.ts
dashboardRegistry.register('myCard', MyCardComponent, {
  title: 'My Card',
  size: 'medium',
  section: 'analytics'
})

// 3. Commit your changes (NOT dashboard.tsx modifications)
// The dashboard loads cards dynamically from the registry

// dashboard.tsx stays locked and clean
// Your feature still appears on the dashboard
```

### Q: How do I know which files are protected?

**A**: Check the manifest:

```bash
# See all protected files
cat .ui-lock/protected-ui-files.txt

# Or check the golden baseline docs
cat docs/ui-lock/GOLDEN-UI-BASELINE.md
```

---

## What Happens When You Commit

### Normal Commit (Backend/Feature Changes)
```
$ git commit -m "feat: add booking validation"

[UI LOCK CHECK]
✓ UI Lock check passed

[refs/heads/feature-branch 1a2b3c4] feat: add booking validation
```

### Attempt to Change Protected File
```
$ git commit -m "update: dashboard styling"

[UI LOCK CHECK]
UI LOCK VIOLATION — Cannot commit changes to protected files

Protected files about to be modified:
  • STAGED_CHANGE: client/src/pages/dashboard.tsx

These files are locked to prevent accidental UI changes.

Options:
  1. Revert changes: git checkout -- client/src/pages/dashboard.tsx
  2. Unstage changes: git reset HEAD client/src/pages/dashboard.tsx
  3. Allow changes: touch .ui-lock/.allow-ui-changes
     (use only for intentional UI redesigns)
```

---

## Development Workflow

### Day-to-Day Development

```bash
# 1. Create feature branch
git checkout -b feature/my-awesome-feature

# 2. Work on your feature (backend, logic, new pages, etc.)
vim server/routes.ts
vim client/src/pages/my-feature.tsx
mkdir -p client/src/components/my-feature

# 3. Commit frequently (commits will succeed if no UI lock violations)
git add .
git commit -m "feat: initial implementation"

# 4. Create a pull request
# UI Lock verification runs automatically in CI

# 5. When approved, merge to main
# UI Lock is verified one more time before merge
```

### If UI Lock Fails

```bash
# 1. Check what was modified
./scripts/check-ui-lock.sh

# 2. See the diff
git diff --stat

# 3. Either:
#    a. Restore the protected files
./scripts/restore-golden-ui.sh

#    b. Or revert your changes
git reset --hard HEAD~1
```

---

## Testing Your Changes

### Before Committing

```bash
# 1. Build your changes
npm run build

# 2. Verify UI lock
./scripts/verify-golden-ui.sh

# 3. Run tests
npm run test

# 4. Check for TypeScript errors
npm run type-check

# 5. Manual testing
PORT=5051 npm run dev
# Visit http://localhost:5051/dashboard/dashboard
# Test your new feature works
```

### After Committing

```bash
# Verify your commit didn't break anything
git log -1 --stat
npm run build
npm run test
```

---

## Emergency: Restore Golden UI

If something goes wrong with the UI:

```bash
# Option 1: Restore just the protected files
./scripts/restore-golden-ui.sh
npm run build
PORT=5050 npm run dev

# Option 2: Full rollback to golden commit
git checkout fleetpro-golden-ui-locked
npm install
PORT=5050 npm run dev

# Either takes < 2 minutes
```

---

## For Questions

**What's protected**: See `.ui-lock/protected-ui-files.txt`  
**Why it's protected**: See `docs/ui-lock/GOLDEN-UI-BASELINE.md`  
**How to extend UI safely**: See `docs/ui-lock/EXTENSION-POINTS.md`  
**Full policy**: See `docs/ui-lock/CI-CD-INTEGRATION.md`

---

## Key Takeaways

1. ✅ **You can freely add features** — new endpoints, new pages, new logic
2. ❌ **You cannot accidentally change the dashboard/sidebar/header** — protected by git hooks
3. 📋 **UI changes require approval** — intentional redesigns need explicit override token
4. 🔄 **Quick recovery** — if something breaks, just run `./scripts/restore-golden-ui.sh`
5. 🚀 **CI verifies everything** — UI lock checks run on every PR

**Bottom line**: Build features confidently. The UI lock prevents accidents, not intended changes.

