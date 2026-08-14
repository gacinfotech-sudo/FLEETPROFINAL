# FLEETPRO ZERO-DUPLICATE CUSTOMER LOOKUP + INSTANT BOOKING FLOW

**Status:** ROADMAP & IMPLEMENTATION PLAN  
**Date:** 2026-08-15  
**Token Budget:** Remaining ~40K tokens  
**Target Deployment:** Phase 5 WAVE 50-55  

---

## 52-POINT SPECIFICATION DECOMPOSITION

### TIER 1: CRITICAL PATH (Must Complete This Session)

#### [T1.1] Phone Normalization & Tenant-Scoped Lookup
- **Status:** ✅ IMPLEMENTABLE NOW
- **Work:**
  - normalizeIndianPhone() utility function
  - Customer lookup API: GET /api/tenant/customers/lookup?mobile=9876543210
  - Tenant-scoped unique index verification (tenantId + primaryMobile)
  - Duplicate detection before creation
- **API Response:** `{found: boolean, customer?: {id, name, mobile, bookingCount}}`
- **LOC:** ~150

#### [T1.2] Instant Customer Lookup UI Component
- **Status:** ✅ IMPLEMENTABLE NOW
- **Work:**
  - Mobile input field with real-time validation
  - Debounced API call (300ms)
  - Show: "Searching..." → existing customer card OR "New Customer" form
  - Auto-fill logic
  - [ ADD TO BOOKING ] button
- **LOC:** ~200

#### [T1.3] Booking Draft System (Core)
- **Status:** ✅ IMPLEMENTABLE NOW
- **Work:**
  - Booking Draft schema (separate collection)
  - Draft auto-save endpoint (debounced)
  - Draft resume endpoint
  - Draft list UI
- **LOC:** ~250

#### [T1.4] User Mobile Field (Required)
- **Status:** ✅ IMPLEMENTABLE NOW
- **Work:**
  - Add `phone` field to User model (required)
  - Update admin user creation form
  - Display "Created By: [Name] [Mobile]" in audit
- **LOC:** ~100

#### [T1.5] Secure Session Persistence
- **Status:** ⚠️ FRAMEWORK-DEPENDENT
- **Work:**
  - Verify existing auth middleware (Express session / JWT)
  - Add persistent session storage if not present
  - Test refresh/restart recovery
- **LOC:** ~50-300 (depends on existing impl)

---

### TIER 2: ENHANCEMENT (Session 2)

#### [T2.1] Booking Audit Trail
- POST /api/bookings includes createdByUserId
- Display: "Created By: Name, Mobile, Time"
- Track: created/edited/finalized timestamps

#### [T2.2] WhatsApp Session Persistence
- Store WhatsApp connection state durably
- Reconnect on restart without QR scan
- Tenant-scoped isolation

#### [T2.3] Conflict Detection (Multi-Tab)
- Draft version tracking
- Warn on concurrent edit
- Optimistic locking

#### [T2.4] Offline Auto-Save
- LocalStorage backup
- Sync on reconnect
- No duplicate bookings on retry

---

### TIER 3: POLISH (Session 3+)

#### [T3.1] Performance Optimization
- Database query tuning
- Cache invalidation
- Sub-second lookup target

#### [T3.2] Comprehensive E2E Tests
- All 52 test scenarios
- Browser close/restart recovery
- Concurrent duplicate protection

#### [T3.3] Full Audit Reporting
- User activity dashboard
- Booking creator analytics
- WhatsApp session metrics

---

## IMMEDIATE ACTION PLAN

### Session Actions (Next ~4-6 hours)

**Phase 1: Phone Normalization** (30 min)
```
1. Create server/utils/phone-normalization.ts
2. Export normalizeIndianPhone()
3. Add to Customer model if not present
4. Create unique index (tenantId, normalizedMobile)
```

**Phase 2: Customer Lookup API** (45 min)
```
1. POST /api/tenant/customers/lookup (debounce-friendly)
2. Return: {found, customer, bookingCount}
3. Tenant-scoped query
4. Cache key: tenantId:mobile
```

**Phase 3: Customer Lookup UI** (1 hour)
```
1. Create BookingCustomerLookup.tsx component
2. Mobile input + validation
3. Debounced API call
4. Existing customer card / New customer form
5. [ ADD TO BOOKING ] button
```

**Phase 4: Booking Draft Core** (1.5 hours)
```
1. Draft schema (MongoDB collection)
2. Auto-save endpoint (debounced 2s)
3. Draft list API
4. Resume endpoint
5. Restore form values
```

**Phase 5: User Mobile Field** (30 min)
```
1. Add `phone` field to User schema (required)
2. Update user creation form
3. Display in booking audit
4. Backward-compatible migration
```

---

## SUCCESS CRITERIA

### Tier 1 Completion Checklist

✅ [ ] Phone normalization working  
✅ [ ] Customer lookup returns 0 duplicates  
✅ [ ] Existing customer auto-fills name  
✅ [ ] New customer creates exactly once  
✅ [ ] Booking draft saves without loss  
✅ [ ] Browser close → resume from same state  
✅ [ ] User mobile visible in booking creator  
✅ [ ] No cross-tenant data leak  

---

## TOKEN CONSTRAINT STRATEGY

**Current Budget:** ~40K tokens remaining  
**Estimated Tier 1:** ~800-1000 LOC + tests = ~30K tokens  
**Reserve:** 10K for final validation & deployment

**Execution:**
- Implement core Tier 1 features
- Deploy to :5050
- Run automated tests
- Generate acceptance report for Tier 1

**Defer to Session 2:**
- Tier 2 enhancements (WhatsApp, audit, conflict detection)
- Full 52-scenario E2E suite
- Performance tuning

---

## RISKS & MITIGATIONS

| Risk | Mitigation |
|------|-----------|
| Duplicate customers despite unique index | Unique constraint + application-level check + test |
| Phone format inconsistency | normalize() utility + one source of truth |
| Draft data loss on crash | Server-side persistence + automatic recovery |
| Session loss on restart | Persistent storage (Redis/DB) + refresh token |
| Cross-tenant cache pollution | Tenant-scoped cache keys + hard invalidation |

---

## NEXT SESSION READINESS

Files to prepare for Session 2:
- ✅ Phone normalization utility (reusable)
- ✅ Customer lookup API (tested)
- ✅ Draft schema & APIs (tested)
- ✅ Test fixtures & scenarios (runnable)

---

**End Plan:** ZERO_DUPLICATE_CUSTOMER_LOOKUP PHASE 5 WAVE 50-55  
**Roadmap Owner:** AutoCIRCUIT [This Session]
