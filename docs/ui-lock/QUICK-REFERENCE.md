# FLEETPRO UI LOCK — QUICK REFERENCE
**TL;DR version for quick lookups**

---

## Am I Allowed To Change This?

| What | Allowed? | How |
|------|----------|-----|
| Add new API endpoint | ✅ | Edit `server/routes.ts` |
| Add new page/feature | ✅ | Create `client/src/pages/my-feature.tsx` |
| Add dashboard card | ✅ | Register in dashboard registry |
| Add sidebar menu item | ✅ | Register in sidebar registry |
| Modify `dashboard.tsx` | ❌ | Use extension points instead |
| Modify `sidebar.tsx` | ❌ | Use extension points instead |
| Modify `header.tsx` | ❌ | Use extension points instead |
| Modify global CSS | ❌ | Create feature-specific styles |
| Change theme colors | ❌ | Create themed component variant |

---

## I Made a Mistake

### Accidentally modified dashboard.tsx

```bash
# Option 1: Restore just that file
git checkout client/src/pages/dashboard.tsx

# Option 2: Restore all golden files
./scripts/restore-golden-ui.sh

# Option 3: Undo last commit
git reset --soft HEAD~1
git checkout -- .
```

### Can't commit because of UI lock

```bash
# See what's blocked
./scripts/check-ui-lock.sh

# Restore protected files
./scripts/restore-golden-ui.sh

# Or unstage them
git reset HEAD <protected-file>

# Then commit your other changes
git commit -m "my message"
```

### UI looks wrong in production

```bash
# Quick restore
./scripts/restore-golden-ui.sh
npm run build
PORT=5050 npm run dev

# Or full rollback
git checkout fleetpro-golden-ui-locked
npm install && npm run build
PORT=5050 npm run dev
```

---

## Common Tasks

### Check if UI is safe
```bash
./scripts/verify-golden-ui.sh
# All ✓ = safe
# Any ✗ = problem
```

### Check what changed
```bash
./scripts/check-ui-lock.sh
# Shows exactly which files changed
```

### Restore golden UI
```bash
./scripts/restore-golden-ui.sh
# Interactive, asks for confirmation
```

### Compare with golden
```bash
git diff fleetpro-golden-ui-locked -- client/src/
# Shows all differences from golden state
```

### Browse golden version
```bash
git show fleetpro-golden-ui-locked:client/src/pages/dashboard.tsx | head -50
# View golden file without checking out
```

### Create new feature (won't break UI lock)
```bash
# Create your files
mkdir -p client/src/pages/my-feature
vim client/src/pages/my-feature.tsx

# Register if needed
# vim client/src/lib/feature-registry.ts

# Commit (will succeed!)
git add client/src/pages/my-feature.tsx
git commit -m "feat: add my-feature"
```

---

## Files You Can't Touch

```
client/src/App.tsx
client/src/pages/dashboard.tsx
client/src/components/layout/sidebar.tsx
client/src/components/layout/header.tsx
client/src/index.css
tailwind.config.js
client/src/lib/theme.ts
client/src/lib/colors.ts
All UI components: client/src/components/ui/*.tsx
```

See full list:
```bash
cat .ui-lock/protected-ui-files.txt
```

---

## Files You CAN Modify

```
server/routes.ts ✅
server/services/* ✅
server/models/* ✅
client/src/pages/my-*.tsx ✅ (new files)
client/src/components/my-feature/* ✅ (new files)
client/src/lib/registries.ts ✅
package.json ✅
.env ✅
README.md ✅
Documentation ✅
Tests ✅
```

---

## Git Commands

```bash
# Check current branch
git branch

# See if you're on golden
git log -1 --oneline
# Should show: commit 94844c5 (if on golden)

# Switch to golden
git checkout booking/integration-preview

# Rollback to golden
git checkout fleetpro-golden-ui-locked

# See changes since golden
git diff fleetpro-golden-ui-locked

# See commits since golden
git log fleetpro-golden-ui-locked..HEAD --oneline
```

---

## When UI Lock Blocks You

### At commit time
```bash
[UI LOCK CHECK]
UI LOCK VIOLATION — Cannot commit changes to protected files

✗ Protected file modified:
  • client/src/pages/dashboard.tsx

Solution:
1. git reset HEAD client/src/pages/dashboard.tsx
2. ./scripts/restore-golden-ui.sh
3. Then git commit your allowed changes
```

### At PR merge time (CI fails)
```
Status: ❌ UI Lock Verification: FAILED
  Protected UI files were modified in this PR

Action:
1. Review the PR - should only have backend/feature changes
2. If you modified dashboard.tsx/sidebar.tsx/etc:
   - Remove those changes
   - Use extension points instead
   - Resubmit PR
3. CI will re-run and pass
```

---

## Emergency Recovery

### If server won't start
```bash
PORT=5050 npm run dev
# Check for errors in output

# If it's a UI file issue:
./scripts/restore-golden-ui.sh

# If it's a dependency issue:
npm install

# If nothing works, rollback to golden:
git checkout fleetpro-golden-ui-locked
npm install && npm run build
PORT=5050 npm run dev
```

### If database is down
```bash
# Check if MongoDB is running
mongo --version
lsof -i :27017

# Restart it
# (platform-specific, check with ops team)

# Restore from backup if corrupted
bash scripts/backup.sh --restore
```

### If you need help
1. Check `docs/ui-lock/DEVELOPER-GUIDE.md` (developers)
2. Check `docs/ui-lock/OPS-GUIDE.md` (operations)
3. See `docs/ui-lock/GOLDEN-UI-BASELINE.md` (what's protected and why)
4. Run `./scripts/verify-golden-ui.sh` (diagnostic)

---

## Key Files

| File | Purpose |
|------|---------|
| `.ui-lock/golden-ui-hashes.json` | Protected file checksums |
| `.ui-lock/protected-ui-files.txt` | List of locked files |
| `.git/hooks/pre-commit` | Prevents commits to locked files |
| `docs/ui-lock/GOLDEN-UI-BASELINE.md` | Why files are locked |
| `docs/ui-lock/DEVELOPER-GUIDE.md` | How to develop safely |
| `docs/ui-lock/OPS-GUIDE.md` | Operations procedures |
| `scripts/check-ui-lock.sh` | Detect changes |
| `scripts/verify-golden-ui.sh` | Full verification |
| `scripts/restore-golden-ui.sh` | Restore golden state |
| `.github/workflows/ui-lock-verify.yml` | CI verification |

---

## One-Liners

```bash
# Is the UI safe?
./scripts/verify-golden-ui.sh | grep "✓ Golden UI"

# What's changed?
./scripts/check-ui-lock.sh | grep "✗"

# Fix it!
./scripts/restore-golden-ui.sh && git add -A && git commit -m "fix: restore golden UI"

# See the golden version
git show fleetpro-golden-ui-locked:client/src/pages/dashboard.tsx | less

# How far from golden?
git log fleetpro-golden-ui-locked..HEAD --oneline | wc -l

# Is current commit golden?
[ "$(git rev-parse HEAD)" = "$(git rev-parse fleetpro-golden-ui-locked)" ] && echo "YES" || echo "NO"

# Switch to golden
git checkout fleetpro-golden-ui-locked

# Back to main
git checkout booking/integration-preview
```

---

## Healthy Status Indicators

✅ **All Good**
```
✓ UI Lock Check: PASSED
✓ All protected files match golden baseline
✓ Build succeeds without errors
✓ No uncommitted changes (or only backend work)
✓ git status shows clean working tree
```

❌ **Problem**
```
✗ UI Lock Check: FAILED
✗ Protected files have changed
✗ Build fails with UI-related errors
✓ Run: ./scripts/restore-golden-ui.sh
```

---

## Remember

1. **You CAN add features** — backend, new pages, new logic
2. **You CANNOT change core UI** — dashboard, sidebar, header, theme
3. **The lock prevents accidents** — intentional UI changes need approval
4. **Recovery is fast** — < 2 minutes to restore golden state
5. **CI catches problems** — UI lock verified on every PR

🎯 **Goal**: Stable UI + Rapid feature development

