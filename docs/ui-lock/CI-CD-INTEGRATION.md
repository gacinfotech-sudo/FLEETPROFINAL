# FLEETPRO UI LOCK — CI/CD INTEGRATION
**Date**: 2026-08-09  
**Status**: IMPLEMENTATION GUIDE  

---

## Overview

The Golden UI Lock is protected at three levels:

1. **Local Level** — Git pre-commit hooks prevent accidental commits
2. **CI Level** — Build pipeline verifies UI baseline before deployment
3. **Repository Level** — Immutable git tag + protected branches

This document guides CI/CD pipeline integration.

---

## Phase 7-8: Git Hooks (LOCAL)

### Pre-commit Hook

**Location**: `.git/hooks/pre-commit`  
**Status**: ✅ DEPLOYED  

Prevents commits that modify protected UI files without explicit override.

#### How It Works
```bash
# Developer attempts to commit UI changes
git add client/src/pages/dashboard.tsx
git commit -m "change dashboard"

# Hook intercepts and fails commit:
# [UI LOCK CHECK]
# UI LOCK VIOLATION — Cannot commit changes to protected files
```

#### Bypassing (For Intentional UI Redesigns)
```bash
# Option 1: Explicit override file (for this session)
touch .ui-lock/.allow-ui-changes
git commit -m "redesign: dashboard overhaul"
rm .ui-lock/.allow-ui-changes

# Option 2: Environment variable (use with extreme caution)
SKIP_UI_LOCK=true git commit -m "redesign: dashboard"
```

---

## Phase 9-10: CI BUILD STAGE

### GitHub Actions Example

Create `.github/workflows/ui-lock-verify.yml`:

```yaml
name: UI Lock Verification

on:
  pull_request:
    branches:
      - main
      - booking/integration-preview
  push:
    branches:
      - main
      - booking/integration-preview

jobs:
  ui-lock-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Install Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup jq for JSON processing
        run: sudo apt-get install jq

      - name: Run UI Lock Verification
        run: |
          bash scripts/verify-golden-ui.sh

      - name: Run UI Lock Check
        run: |
          bash scripts/check-ui-lock.sh

      - name: Report UI Violations
        if: failure()
        run: |
          echo "UI Lock check failed."
          echo "Protected files were modified. Review the changes above."
          exit 1
```

### GitLab CI Example

Create `.gitlab-ci.yml` additions:

```yaml
ui-lock-check:
  stage: test
  image: node:18-alpine
  before_script:
    - apk add --no-cache jq bash
  script:
    - bash scripts/verify-golden-ui.sh
    - bash scripts/check-ui-lock.sh
  only:
    - merge_requests
    - main
    - booking/integration-preview
  allow_failure: false
```

---

## Phase 11-12: BUILD PIPELINE INTEGRATION

### Pre-Build Verification

Add to your build script (before `npm run build`):

```bash
#!/bin/bash

echo "Starting build with UI Lock verification..."

# 1. Verify golden UI is intact
./scripts/verify-golden-ui.sh || {
    echo "UI Lock verification failed. Build aborted."
    exit 1
}

# 2. Check for UI file changes
./scripts/check-ui-lock.sh || {
    echo "Protected UI files have changed. Build aborted."
    echo "Run: ./scripts/restore-golden-ui.sh"
    exit 1
}

# 3. Proceed with normal build
echo "UI Lock verified. Proceeding with build..."
npm run build
```

### Deployment Gate

Before deploying to production:

```bash
#!/bin/bash

DEPLOYMENT_TARGET=${1:-production}

echo "Pre-deployment UI Lock verification..."

# Mandatory checks before any deployment
./scripts/verify-golden-ui.sh || {
    echo "Cannot deploy: Golden UI baseline not verified"
    exit 1
}

# Check current commit against golden
CURRENT=$(git rev-parse HEAD)
GOLDEN=$(git rev-parse fleetpro-golden-ui-locked)

if [[ "$DEPLOYMENT_TARGET" == "production" ]] && [[ "$CURRENT" != "$GOLDEN" ]]; then
    echo "Warning: Deploying non-golden commit to production"
    echo "  Current: $CURRENT"
    echo "  Golden:  $GOLDEN"
    read -p "Continue? (yes/no): " confirm
    [[ "$confirm" == "yes" ]] || exit 1
fi

# Proceed with deployment
echo "UI Lock passed. Safe to deploy."
```

---

## Phase 13-14: MONITORING & ALERTS

### Health Check Integration

Extend `scripts/health-check.sh` to verify UI:

```bash
# Add to health-check loop
echo "Verifying UI lock..."
if ./scripts/check-ui-lock.sh &>/dev/null; then
    echo "  ✓ UI lock verified"
    HEALTH_STATUS="HEALTHY"
else
    echo "  ✗ UI lock violation detected!"
    HEALTH_STATUS="COMPROMISED"
    # Alert operations team
    send_alert "UI Lock violation detected on production"
fi
```

### Alert Triggers

Configure alerts for:
1. UI Lock check script failure in CI
2. Protected file modification attempts
3. Pre-commit hook bypass (via environment variable)
4. Commit to protected branches with UI changes

---

## Phase 15-16: MERGE PROTECTION

### Branch Protection Rules

Configure these for branches `main` and `booking/integration-preview`:

1. **Require status checks to pass**
   - `ui-lock-check` MUST pass before merge

2. **Require code review**
   - At least 1 approval required
   - Reviewers must verify no accidental UI changes

3. **Restrict push access**
   - Only designated maintainers can force-push
   - Never allow force-push to main or golden branch

4. **Require up-to-date branches**
   - Branch must be updated before merge
   - Ensures UI lock check runs against latest

### Implementation

```bash
# GitHub example using gh CLI
gh api repos/your-org/fleetpro/branches/booking/integration-preview/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["ui-lock-check", "tests", "build"]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "enforce_admins": true,
  "restrictions": {
    "users": [],
    "teams": ["maintainers"],
    "apps": []
  }
}
EOF
```

---

## Phase 17-18: OVERRIDE PROCEDURE (INTENTIONAL UI REDESIGNS)

When UI changes ARE intentional (new dashboard design, layout overhaul):

### 1. Request & Approval
```
User files a change request:
  "New dashboard redesign for Q3"
  
Code review board approves:
  "Approved for golden UI redesign"
```

### 2. Implementation
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Create explicit override
touch .ui-lock/.allow-ui-changes

# Implement the UI redesign
# ... edit files in client/src/components/...
# ... edit files in client/src/pages/...

# Commit with explicit message
git add -A
git commit -m "redesign: dashboard overhaul (approved by design team)"

# Remove override
rm .ui-lock/.allow-ui-changes

# Generate new golden baseline
./scripts/verify-golden-ui.sh
git tag -a fleetpro-golden-ui-locked-v2 HEAD -m "Updated golden UI baseline"
```

### 3. Update Baseline

```bash
# Regenerate hashes
jq -r '.protected_files | keys[]' .ui-lock/golden-ui-hashes.json | while read f; do
    [ -f "$f" ] && \
    NEW_HASH=$(shasum -a 256 "$f" | awk '{print $1}') && \
    jq ".protected_files[\"$f\"].sha256 = \"$NEW_HASH\"" .ui-lock/golden-ui-hashes.json > /tmp/hashes.tmp && \
    mv /tmp/hashes.tmp .ui-lock/golden-ui-hashes.json
done

# Update documentation
cp docs/ui-lock/GOLDEN-UI-BASELINE.md docs/ui-lock/GOLDEN-UI-BASELINE-v1.md
# ... update GOLDEN-UI-BASELINE.md with new design specs ...

git add .ui-lock/golden-ui-hashes.json docs/ui-lock/GOLDEN-UI-BASELINE.md
git commit -m "update: golden UI baseline after approved redesign"
```

---

## Phase 19-20: TESTING & VERIFICATION

### Automated Tests

Create `.test/ui-lock.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as crypto from 'crypto';

const HASHES_FILE = '.ui-lock/golden-ui-hashes.json';
const hashes = JSON.parse(fs.readFileSync(HASHES_FILE, 'utf-8'));

describe('UI Lock', () => {
  it('should have all protected files present', () => {
    for (const [file, data] of Object.entries(hashes.protected_files)) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('should match golden baseline hashes', () => {
    for (const [file, data] of Object.entries(hashes.protected_files)) {
      const content = fs.readFileSync(file, 'utf-8');
      const hash = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');
      expect(hash).toBe(data.sha256);
    }
  });

  it('should prevent modifications without override', () => {
    const modified = '.ui-lock/.allow-ui-changes';
    expect(fs.existsSync(modified)).toBe(false);
  });
});
```

Run with:
```bash
npm run test -- ui-lock.test.ts
```

---

## Phase 21-22: DOCUMENTATION & PROCEDURES

### For Developers

**File**: `docs/ui-lock/DEVELOPER-GUIDE.md`

```markdown
# For Developers: Working with UI Lock

## I want to add a new feature (backend/API)
✅ This is allowed!
- Modify routes in `server/routes.ts`
- Add new API endpoints
- Update database schemas
- Pre-commit hook will NOT block you

## I want to add a new dashboard card
✅ This is allowed!
- Use the Dashboard Module Registry (extension point)
- Register your card in the dashboard config
- Do NOT modify `client/src/pages/dashboard.tsx` directly

## I want to change the sidebar
❌ This is blocked!
- Sidebar is protected
- File: `client/src/components/layout/sidebar.tsx`
- Contact design team for sidebar changes

## I accidentally changed a protected file. What do I do?
1. Run: `./scripts/restore-golden-ui.sh`
2. Commit: `git commit -m "fix: restore golden UI"`
3. Done!

## I need to do an intentional UI redesign
1. Request approval from design/product team
2. Create override: `touch .ui-lock/.allow-ui-changes`
3. Implement changes
4. Run: `./scripts/verify-golden-ui.sh`
5. Generate new baseline
6. Update documentation
7. Remove override
```

### For Operations

**File**: `docs/ui-lock/OPS-GUIDE.md`

```markdown
# For Operations: Monitoring UI Lock

## Daily Health Check
```bash
./scripts/health-check.sh
# Look for: "UI Lock: ✓ VERIFIED"
```

## Production Deployment
Before deploying:
```bash
./scripts/verify-golden-ui.sh
# Must return exit code 0
```

## If UI is Wrong
```bash
# 1. Check what changed
./scripts/check-ui-lock.sh

# 2. Restore golden
./scripts/restore-golden-ui.sh

# 3. Commit recovery
git commit -m "ops: restore golden UI after incident"

# 4. Redeploy
npm run build && PORT=5050 npm run dev
```

## Emergency Procedures
```bash
# Full rollback to golden state
git checkout fleetpro-golden-ui-locked
npm install
PORT=5050 npm run dev
```
```

---

## Summary

| Phase | Task | Status |
|-------|------|--------|
| 4-6 | Automated scripts | ✅ DONE |
| 7 | Pre-commit hook | ✅ DONE |
| 8 | Merge/push hooks | TODO |
| 9-10 | CI workflow | TODO |
| 11-12 | Build gate | TODO |
| 13-14 | Monitoring | TODO |
| 15-16 | Branch protection | TODO |
| 17-18 | Override procedure | DOCUMENTED |
| 19-20 | Testing | TODO |
| 21-22 | Documentation | IN PROGRESS |

---

**Next**: Implement CI/CD workflows (GitHub Actions / GitLab)

