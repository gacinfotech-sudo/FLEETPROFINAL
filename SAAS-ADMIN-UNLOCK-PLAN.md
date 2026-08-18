# 🔓 SaaS ADMIN TENANT MANAGEMENT - UNLOCK PLAN

**Status:** P0 - Root Admin Cannot Manage Tenants

---

## 🔍 ROOT CAUSE ANALYSIS

**Read-Only Lock Location:**
- File: `client/src/pages/superadmin/tenants.tsx`
- Line 254: Card has `cursor-not-allowed` + `opacity-95`
- Line 228-236: Hardcoded "TENANT DATA LOCKED FOR SECURITY" banner
- Line 249: Comment "CARD VIEW - READ-ONLY, NO MODIFICATIONS ALLOWED"

**Why It's Locked:**
- Defensive design: assumed all tenants need read-only protection
- No authorization check: applies lock to ALL users equally
- No PLATFORM_ROOT permission: doesn't distinguish privileged users

---

## ✅ PHASE 1: UNLOCK FOR PLATFORM_ROOT (TODAY)

### 1. Remove Frontend Read-Only Lock
- [ ] Check user `platformRole` from localStorage
- [ ] If `PLATFORM_ROOT` → remove lock banner + enable cards
- [ ] If not → keep read-only message
- [ ] Show appropriate UI per role

### 2. Enable Card Clickability
- [ ] Remove `cursor-not-allowed` for PLATFORM_ROOT
- [ ] Make cards clickable to open tenant detail/edit
- [ ] Add click handlers to tenant cards
- [ ] Navigate to `/superadmin/tenants/:tenantId/manage`

### 3. Backend Authorization Check
- [ ] Verify `/api/admin/tenants` checks user role
- [ ] Verify `/api/admin/tenants/:id` requires PLATFORM_ROOT
- [ ] Add authorization middleware if missing
- [ ] Return 403 if unauthorized

---

## 📋 PHASE 2: TENANT MANAGEMENT FLOWS (2-3 hours)

### Create Tenant
- [ ] Form: Company Profile (name, legal, mobile, email, address, GST, PAN)
- [ ] Form: Owner (name, mobile, email, login ID, temporary password)
- [ ] Form: Plan (subscription plan, billing cycle)
- [ ] Form: Limits (vehicles, users, drivers, branches)
- [ ] Create transaction: Tenant → Owner → Subscription → Limits
- [ ] Rollback if any step fails

### Edit Tenant
- [ ] Open existing tenant detail
- [ ] Edit: Company Profile
- [ ] Edit: Owner information
- [ ] Edit: Subscription/Plan
- [ ] Edit: Resource Limits
- [ ] Save changes → API → DB → Audit log

### Tenant Login ID Management
- [ ] Show current login ID
- [ ] Show owner name/email
- [ ] Allow EDIT LOGIN ID (with collision check)
- [ ] Show last login
- [ ] Show account status

### Password Reset
- [ ] Generate temporary password (hashed)
- [ ] Display once (modal)
- [ ] Copy button
- [ ] After close → cannot retrieve again
- [ ] Must reset again to get new password
- [ ] Revoke previous sessions

### Plan Management
- [ ] Show current plan details
- [ ] Assign new plan
- [ ] Upgrade (show additional features/limits)
- [ ] Downgrade (warn about current usage)
- [ ] Custom plan override
- [ ] Update limits without deleting data

### Resource Limits
- [ ] Set Vehicle limit
- [ ] Set User limit
- [ ] Set Driver limit
- [ ] Set Branch limit
- [ ] Show USED / LIMIT / AVAILABLE
- [ ] Enforce in backend

### Subscription & Billing
- [ ] Show subscription details
- [ ] Show billing dates
- [ ] Auto-renew toggle
- [ ] Renew subscription
- [ ] Change billing cycle
- [ ] View payment history
- [ ] Manage payment method

### Tenant Status
- [ ] Activate/Deactivate
- [ ] Temporarily lock
- [ ] Suspend/Reactivate
- [ ] Show status reason
- [ ] Audit logging

---

## 🧪 PHASE 3: TESTING & VALIDATION

### Unit Tests
- [ ] Authorization checks
- [ ] Transaction rollback
- [ ] Collision detection
- [ ] Password hashing
- [ ] Limit enforcement

### Integration Tests
- [ ] Create tenant flow (end-to-end)
- [ ] Reset password + login as tenant
- [ ] Change plan + verify limits
- [ ] Change vehicle limit + verify enforcement
- [ ] Downgrade plan + warn on usage

### Manual QA
- [ ] Create test tenant
- [ ] Edit all fields
- [ ] Reset password
- [ ] Login as tenant
- [ ] Change plan
- [ ] Change limits
- [ ] Verify data persists
- [ ] Double-click safety
- [ ] Audit log completeness

---

## 📊 IMPLEMENTATION CHECKLIST

### Frontend (UI Unlock)
```
✓ Check user role (PLATFORM_ROOT)
✓ Conditional lock removal
✓ Card clickability
✓ Navigation to detail pages
✓ Form validation
✓ API error handling
✓ Loading states
✓ Confirmation modals
```

### Backend (Management APIs)
```
✓ POST /api/admin/tenants (create)
✓ GET /api/admin/tenants/:id (detail)
✓ PUT /api/admin/tenants/:id (update)
✓ PUT /api/admin/tenants/:id/company-profile
✓ PUT /api/admin/tenants/:id/owner
✓ PUT /api/admin/tenants/:id/login-id
✓ POST /api/admin/tenants/:id/reset-password
✓ PUT /api/admin/tenants/:id/plan
✓ PUT /api/admin/tenants/:id/limits
✓ PUT /api/admin/tenants/:id/subscription
✓ POST /api/admin/tenants/:id/activate
✓ POST /api/admin/tenants/:id/deactivate
```

### Authorization
```
✓ PLATFORM_ROOT → full access
✓ PLATFORM_ADMIN → limited access
✓ PLATFORM_AUDITOR → read-only
✓ Others → no access
```

### Audit Logging
```
✓ Tenant created
✓ Tenant edited
✓ Login ID changed
✓ Password reset
✓ Plan changed
✓ Limits changed
✓ Subscription changed
✓ Status changed
```

---

## 🎯 SUCCESS CRITERIA

- [ ] Root admin can view ALL tenants (no lock)
- [ ] Root admin can click any tenant card (no cursor-not-allowed)
- [ ] Tenant detail page opens (new or existing flow)
- [ ] All tenant fields editable for PLATFORM_ROOT
- [ ] Create tenant works end-to-end
- [ ] Edit tenant works with persistence
- [ ] Password reset functional (temporary password one-time)
- [ ] Plan/limit changes don't delete tenant data
- [ ] Double-write protection works
- [ ] All actions audit logged
- [ ] UI unchanged (no redesign)
- [ ] Tenant operational modules untouched
- [ ] Read-only mode works for non-root users
- [ ] Authorization enforced in backend
- [ ] Test tenant creation + login works

---

## 🚀 QUICK WINS (Do First)

1. Remove hardcoded lock banner for PLATFORM_ROOT
2. Remove cursor-not-allowed from cards for PLATFORM_ROOT
3. Make cards clickable for PLATFORM_ROOT
4. Navigate to existing tenant detail page
5. Test with real tenant login

This enables ~80% value with 20% effort, then add management features incrementally.

---

**Estimated Time:** 3-4 hours for complete unlock + functional management
**Priority:** P0 - Blocks all tenant administration
**Owner:** Claude
**Status:** PENDING - Awaiting implementation start
