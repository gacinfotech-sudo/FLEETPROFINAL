# Authentication Regression Test Suite

This document defines mandatory regression tests for the FleetPro authentication system to prevent recurrence of P0 authentication failures.

## Test Matrix

### 1. User Creation → Login Flow

**Test ID:** AUTH-CREATE-LOGIN-ADMIN  
**Steps:**
1. Create admin user via `/api/admin/users` with role='admin'
2. Immediately login with created credentials
3. Verify login succeeds and returns user object with correct role

**Expected:** PASS  
**Timeout:** 5s per operation

---

**Test ID:** AUTH-CREATE-LOGIN-MANAGER  
**Steps:**
1. Create manager user via `/api/admin/users` with role='manager'
2. Immediately login with created credentials
3. Verify login succeeds and manager can access tenant resources

**Expected:** PASS  
**Timeout:** 5s per operation

---

**Test ID:** AUTH-CREATE-LOGIN-CLIENT  
**Steps:**
1. Create client/tenant user via `/api/admin/users` with role='client'
2. Immediately login with created credentials
3. Verify login succeeds and returns tenantId

**Expected:** PASS  
**Timeout:** 5s per operation

---

### 2. Password Hash Integrity

**Test ID:** AUTH-PASSWORD-SINGLE-HASH  
**Steps:**
1. Create user with password "TestPass@123"
2. Query database: `users.findOne({userId: 'testuser'})`
3. Verify password field is exactly 60 characters
4. Verify password starts with "$2b$" or "$2a$" (bcrypt format)
5. Verify password does NOT start with nested "$2" (no double-hash)

**Expected:** PASS  
**Failure Indicator:** Hash length ≠ 60, or invalid bcrypt format, or double-hashed

---

**Test ID:** AUTH-PASSWORD-NO-REHASH-ON-UPDATE  
**Steps:**
1. Create user with password "TestPass@123"
2. Capture password hash fingerprint (first 20 chars)
3. Update user: `PUT /api/admin/users/:id` with `{name: 'Updated Name'}` (no password field)
4. Query database again
5. Verify password hash fingerprint unchanged

**Expected:** PASS  
**Failure Indicator:** Hash changed after non-password update

---

### 3. Permission & Role Updates

**Test ID:** AUTH-LOGIN-AFTER-PERMISSION-EDIT  
**Steps:**
1. Create user with password "TestPass@123"
2. Login successfully
3. Logout
4. Update user permissions: `{permissions: ['MANAGE_DRIVERS']}`
5. Login again with SAME password
6. Verify login succeeds

**Expected:** PASS  
**Failure Indicator:** Login fails after permission edit, or password hash changed

---

**Test ID:** AUTH-LOGIN-AFTER-ROLE-CHANGE  
**Steps:**
1. Create manager user
2. Login successfully
3. Update user role from 'manager' to 'client'
4. Login again with SAME password
5. Verify login succeeds with new role

**Expected:** PASS  
**Failure Indicator:** Password hash changed, or login fails

---

### 4. Tenant Resolution

**Test ID:** AUTH-MANAGER-TENANT-CONTEXT  
**Steps:**
1. Create manager in tenant A
2. Create manager in tenant B (same password)
3. Login manager A with userId + password
4. Verify returned tenantId matches tenant A
5. Login manager B with userId + password
6. Verify returned tenantId matches tenant B

**Expected:** PASS  
**Failure Indicator:** Wrong tenantId returned, or login fails for second manager

---

**Test ID:** AUTH-TENANT-ISOLATION  
**Steps:**
1. Create users in tenant A and B
2. Login user A, get sessionId A
3. Login user B, get sessionId B
4. Using sessionId A, try to access tenant B resources
5. Verify request denied

**Expected:** PASS  
**Failure Indicator:** Cross-tenant access allowed

---

### 5. Session Persistence

**Test ID:** AUTH-RESTART-PERSISTENCE  
**Steps:**
1. Create user with password "TestPass@123"
2. Login successfully
3. Note user._id, passwordHash, createdAt
4. Simulate backend restart (or actual restart if test environment)
5. Query database for same user
6. Verify _id, passwordHash, createdAt unchanged
7. Login with SAME password succeeds

**Expected:** PASS  
**Timeout:** 60s  
**Failure Indicator:** User deleted, password changed, or login fails after restart

---

### 6. Status & Lifecycle

**Test ID:** AUTH-INACTIVE-USER-BLOCKED  
**Steps:**
1. Create user with isActive=true
2. Login succeeds
3. Set user isActive=false
4. Attempt login
5. Verify login fails with 403 ACCOUNT_DEACTIVATED

**Expected:** PASS  
**Failure Indicator:** Inactive user allowed to login

---

**Test ID:** AUTH-NEW-USER-MUST-RESET  
**Steps:**
1. Create user with mustResetPassword=true
2. Login succeeds
3. Verify response includes `mustResetPassword: true`
4. Frontend should redirect to password reset flow

**Expected:** PASS  
**Failure Indicator:** mustResetPassword not returned or not enforced

---

### 7. Lockout & Rate Limiting

**Test ID:** AUTH-LOCKOUT-AFTER-5-FAILURES  
**Steps:**
1. Create user with password "CorrectPass@123"
2. Attempt login 5 times with wrong password
3. On 6th attempt, verify response is 429 (rate limited)
4. Verify error message mentions 5-minute lockout
5. Wait 5+ minutes (or mock time)
6. Attempt login with correct password
7. Verify login succeeds

**Expected:** PASS  
**Timeout:** 330s (5.5 minutes)  
**Failure Indicator:** Lockout not enforced, or timeout wrong

---

### 8. Wrong Password Rejection

**Test ID:** AUTH-WRONG-PASSWORD-FAILS  
**Steps:**
1. Create user with password "CorrectPass@123"
2. Attempt login with password "WrongPass@123"
3. Verify login fails with 401 Invalid credentials
4. Verify error message is generic (no user enumeration)

**Expected:** PASS  
**Failure Indicator:** Wrong password accepted, or user enumeration info leaked

---

### 9. Missing Fields Validation

**Test ID:** AUTH-MISSING-USERID-FAILS  
**Steps:**
1. POST /api/auth/login with `{password: "somepass"}` (no userId)
2. Verify response is 400 with message about required fields

**Expected:** PASS  
**Failure Indicator:** Request accepted without userId

---

**Test ID:** AUTH-MISSING-PASSWORD-FAILS  
**Steps:**
1. POST /api/auth/login with `{userId: "testuser"}` (no password)
2. Verify response is 400 with message about required fields

**Expected:** PASS  
**Failure Indicator:** Request accepted without password

---

### 10. Input Validation

**Test ID:** AUTH-INVALID-INPUT-TYPE-REJECTED  
**Steps:**
1. POST /api/auth/login with `{userId: 123, password: "pass"}` (userId is number)
2. Verify response is 400 Invalid input format

**Expected:** PASS  
**Failure Indicator:** Non-string input accepted

---

## Running the Tests

### Automated Test Suite

```bash
npm run test:auth-regression
```

### Manual Test Checklist

Use this before any major auth code change:

- [ ] AUTH-CREATE-LOGIN-ADMIN
- [ ] AUTH-CREATE-LOGIN-MANAGER
- [ ] AUTH-CREATE-LOGIN-CLIENT
- [ ] AUTH-PASSWORD-SINGLE-HASH
- [ ] AUTH-PASSWORD-NO-REHASH-ON-UPDATE
- [ ] AUTH-LOGIN-AFTER-PERMISSION-EDIT
- [ ] AUTH-LOGIN-AFTER-ROLE-CHANGE
- [ ] AUTH-MANAGER-TENANT-CONTEXT
- [ ] AUTH-TENANT-ISOLATION
- [ ] AUTH-RESTART-PERSISTENCE
- [ ] AUTH-INACTIVE-USER-BLOCKED
- [ ] AUTH-NEW-USER-MUST-RESET
- [ ] AUTH-LOCKOUT-AFTER-5-FAILURES
- [ ] AUTH-WRONG-PASSWORD-FAILS
- [ ] AUTH-MISSING-USERID-FAILS
- [ ] AUTH-MISSING-PASSWORD-FAILS
- [ ] AUTH-INVALID-INPUT-TYPE-REJECTED

## Invariants

These must ALWAYS be true:

1. ✅ Successful user creation produces immediately-authenticatable credentials
2. ✅ Password hashed exactly once (never double-hashed)
3. ✅ Profile/role/permission edits never modify password hash
4. ✅ Create and Login use canonical authentication database
5. ✅ Tenant resolution deterministic (no stale data)
6. ✅ Roles use one password system (no separate incompatible implementations)
7. ✅ Development seeders never reset production passwords
8. ✅ Server startup never rewrites existing user passwords
9. ✅ User records persist across restarts (TTL not set)
10. ✅ Sessions may expire; user accounts must persist
11. ✅ No destructive user operations without explicit approval
12. ✅ UI success messages only after database persistence succeeds

## Status

**Last Updated:** 2026-08-10 12:26 AM IST  
**All Tests:** ✅ PASS (verified manually)  
**Automated Suite:** ⏳ Pending implementation

---

*This test suite is MANDATORY for any authentication-related code changes. Run before merging, deploy, or closing auth tickets.*
