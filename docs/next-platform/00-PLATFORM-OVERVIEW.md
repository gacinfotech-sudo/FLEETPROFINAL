# FleetPro Next Platform — Architecture Overview

**Status**: WAVE 0–1 in progress  
**Date**: 2026-08-12  
**Branch**: `feature/fleetpro-next-platform`  
**Protected Port**: `:5050` (Web CRM — UNTOUCHED)  
**Dev Ports**: `:5051–5098` (reserved for development)

---

## Platform Mission

Design and deliver a scalable Pan-India Taxi/Fleet SaaS with:
- **One Web CRM** (full control, desktop)
- **One Business APK** (fast ops, 4GB+ devices)
- **One Driver Lite APK** (minimal, 2–3GB devices)
- **One Canonical Cloud Backend** (MongoDB)
- **One Source of Truth** (no data duplication)
- **Offline-first Driver operations** (sync when online)
- **Zero-cost default integrations** (WhatsApp, phone)

---

## High-Level Architecture

```
FLEETPRO CLOUD
             │
    Canonical API + Database
             │
    ┌────────┼────────┬────────┐
    │        │        │        │
 WEB CRM  BUSINESS  DRIVER   MOBILE
 :5050    LITE APK  LITE APK  API
  │        │        │        │
  └────────┼────────┴────────┘
           │
   Integration Hub
           │
   ┌───┬───┬───┬───┐
 WhatsApp Phone GPS AI  KYC/eSign
```

### Key Principles

1. **Singular Canonical Domain Model**
   - One Booking engine, not parallel web + mobile implementations
   - One Driver Assignment state machine
   - One Customer master (no duplicates by phone)
   - One Payment ledger (idempotent transactions)

2. **Tenant Isolation**
   - Every entity scoped to `tenantId`
   - Multi-tenant configurations respected
   - RBAC enforced server-side

3. **Offline-First Driver Operations**
   - Driver can complete duty without network
   - Outbox-based sync when online
   - Idempotent operations (operationId deduplication)

4. **Mobile API Versioning**
   - Explicit `/mobile/v1/` path prefix
   - Backward compatibility maintained
   - Feature flags for gradual rollouts

5. **No Redesign of Protected Web CRM**
   - Existing Web continues at `:5050`
   - All new mobile/integrations isolated
   - Final merge only with explicit approval

---

## Canonical Domain Entities

### Customer
```
tenantId (required)
phone (required, normalized E.164)
name (optional, locked when customer found)
alternatePhone (optional, normalized)
email (optional)
blacklistStatus (optional: NONE | WARNING | MANAGER_APPROVAL | HARD_BLOCK)
blacklistReason (optional)
blacklistedAt (optional)
blacklistedBy (optional)
riskNotes (optional)
lastBooking (optional reference)
upcomingBooking (optional reference)
outstanding (optional amount)
createdAt
updatedAt
```

**Critical Behaviors**:
- Phone is canonical identity; normalizer converts all variants to E.164
- Duplicate customer prevention: lookup by `tenantId + normalizedPhone`
- Blacklist checked on every booking creation
- Name locked after initial customer fetch (prevents typo duplicates)

### Booking
```
tenantId (required)
customerId (required, locked after creation)
bookingType (required: SELF_DRIVE | WITH_DRIVER)
pickupTime (required)
pickupLocation (required)
dropLocation (optional/required based on type)
vehicleRequired (optional)
driverId (optional, required for WITH_DRIVER)
fare (optional, calculated or provided)
advance (optional)
outstanding (optional, calculated)
status (CREATED | CONFIRMED | ASSIGNED | ACCEPTED | REJECTED | IN_PROGRESS | COMPLETED | CANCELLED)
travelDateStatus (CONFIRMED | TENTATIVE | FLEXIBLE)
createdAt
updatedAt
```

**Critical Behaviors**:
- Single unified model (no separate self-drive/with-driver tables)
- Booking creation triggers customer duplicate check
- Driver assignment is separate state machine (DriverAssignment entity)

### DriverAssignment
```
tenantId (required)
bookingId (required)
driverId (required)
status (ASSIGNED | NOTIFICATION_SENT | SEEN | ACCEPTED | REJECTED | TIMED_OUT | CANCELLED)
notificationSentAt (optional)
seenAt (optional)
acceptedAt (optional)
rejectedAt (optional)
acceptanceDeadline (optional)
createdAt
updatedAt
```

**Critical Behaviors**:
- Created when booking assigned to driver
- Triggers high-priority notification to driver
- Driver Lite receives assignment; accepts/rejects
- Acceptance deadline enforced server-side

### Driver
```
tenantId (required)
name (required)
phone (required, normalized E.164)
email (optional)
licenseNumber (optional)
status (ACTIVE | INACTIVE | SUSPENDED | ON_DUTY | OFF_DUTY)
documents (array of document references)
createdAt
updatedAt
```

### Vehicle
```
tenantId (required)
make (required)
licensePlate (required)
normalizedLicensePlate (for lookup)
capacity (optional)
type (optional: ECONOMY | PREMIUM | LUXURY | etc.)
status (AVAILABLE | ON_TRIP | MAINTENANCE)
createdAt
updatedAt
```

### Payment
```
tenantId (required)
bookingId (required)
amount (required, in paise)
status (PENDING | COLLECTED | FAILED)
method (CASH | CARD | UPI | etc.)
transactionId (optional)
operationId (for idempotency)
createdAt
updatedAt
```

### SyncOperation (NEW — mobile-specific)
```
tenantId (required)
userId (required)
operationId (required, unique per device)
deviceId (required)
entityType (required: BOOKING | PAYMENT | EXPENSE | etc.)
entityId (required)
baseVersion (optional, for conflict detection)
payload (the mutation)
syncStatus (PENDING | SYNCED | CONFLICT | FAILED)
deviceTimestamp (when operation created locally)
serverTimestamp (when processed)
createdAt
updatedAt
```

**Critical Behavior**: Server processes operationId idempotently; duplicate attempts return cached result.

### DeviceRegistration (NEW — mobile-specific)
```
tenantId (required)
userId (required)
deviceId (required, unique per user + device)
deviceType (IOS | ANDROID)
appVersion (semantic version)
lastSeenAt (timestamp)
isActive (boolean)
createdAt
updatedAt
```

---

## Mobile API Contract

### Bootstrap
```
GET /mobile/v1/bootstrap
Response:
{
  tenant: {
    id, name, timezone, serviceModes, policyRules
  },
  user: {
    id, name, role, tenantId
  },
  features: {
    whatsapp: { mode: "BASIC" | "LINKED", enabled: true },
    phone: { enabled: true },
    gps: { enabled: false },
    offlineMode: { enabled: true }
  },
  config: {
    bookingTimeoutMinutes: 15,
    syncBatchSize: 100,
    offlineQueueMaxSize: 1000
  }
}
```

### Customer Lookup
```
POST /mobile/v1/customer/lookup
{
  phone: "9876543210"  // Any format; will be normalized
}
Response:
{
  found: true,
  customer: {
    id, name, phone, email, lastBooking, upcomingBooking, outstanding
  },
  blacklist: {
    status: "NONE" | "WARNING" | "HARD_BLOCK",
    reason: "...",
    riskNotes: "..."
  }
}
```

### Device Registration
```
POST /mobile/v1/device/register
{
  deviceId: "unique-per-device",
  deviceType: "ANDROID" | "IOS",
  appVersion: "1.0.0"
}
Response:
{
  registered: true,
  sessionToken: "...",
  expiresAt: timestamp
}
```

### Booking Creation
```
POST /mobile/v1/bookings
{
  customerId: "...",
  bookingType: "WITH_DRIVER",
  pickupTime: ISO8601,
  pickupLocation: "...",
  dropLocation: "...",
  operationId: "uuid"  // For idempotency
}
Response:
{
  id, status, customerId, driverId, fare, advance
}
```

### Driver Assignment & Duty
```
POST /mobile/v1/assignments/{assignmentId}/accept
{
  operationId: "uuid"
}
Response:
{
  assignmentId, status: "ACCEPTED", bookingId, driverId
}
```

### Sync Push (offline operations)
```
POST /mobile/v1/sync/push
{
  operations: [
    {
      operationId: "uuid",
      entityType: "EXPENSE",
      entityId: "...",
      payload: { ... },
      baseVersion: 1,
      deviceTimestamp: ISO8601
    }
  ]
}
Response:
{
  synced: [{ operationId, status, serverVersion }]
  conflicts: [{ operationId, reason }]
  failed: [{ operationId, error }]
}
```

### Sync Pull (download canonical state)
```
POST /mobile/v1/sync/pull
{
  lastEventId: "...",
  entities: ["BOOKING", "ASSIGNMENT", "DRIVER"]
}
Response:
{
  events: [
    {
      eventId,
      entityType,
      entityId,
      state: { ... },
      version,
      timestamp
    }
  ],
  nextEventId: "..."
}
```

---

## Backward Compatibility Strategy

### Web CRM
- No changes to existing Booking, Customer, Driver, Vehicle schemas
- New fields added as optional (missing → defaults)
- Existing API routes continue unchanged
- New `/mobile/v1/` routes do not interfere

### Mobile Versioning
- API version in path: `/mobile/v1/`
- Minimum supported version defined per release
- Old APK continues to function (with deprecation warnings)
- Forced upgrade only for security/critical incompatibility

### Database Migrations
- Additive only (no column drops, no renames, no table deletes)
- Existing indexes preserved
- New indexes added for mobile queries
- Rollback strategy: revert to previous version

---

## Security & RBAC

### Tenant Isolation
- Every query filtered by `tenantId`
- Multi-tenant tenants scoped to `branchId` where configured
- RBAC enforced server-side (not just UI)

### Mobile Authentication
- Session-based (device fingerprint: userAgent + IP)
- Timeout: 7 days
- Multi-device support (each login gets independent session)

### Blacklist Enforcement
- Checked at booking creation
- Can escalate to HARD_BLOCK (deny) or MANAGER_APPROVAL (require override)
- Audit trail: who blacklisted, when, why

### WhatsApp Safety
- BASIC mode: zero bulk/campaign capability
- LINKED mode: rate-limited to operational messaging only
- No automated bulk recipient list
- Compliance warning shown on tenant setup

---

## Failure Handling

### Critical: Always Work Standalone
- ❌ Booking must NOT fail if WhatsApp unavailable
- ❌ Booking must NOT fail if GPS unavailable
- ❌ Booking must NOT fail if AI unavailable
- ✅ Core booking works offline
- ✅ Integrations fail gracefully

### Driver Offline Scenarios
- Downloaded duty = driver can accept/reject without network
- Accept stored locally → synced when online
- Duplicate accepts = server rejects second attempt
- Conflict detection: if server already processed, return cached result

### Network Recovery
- Automatic retry (exponential backoff)
- User never presses "Sync Now" button
- Background queue maintained
- Status shown as subtle indicator only

---

## Observability

### Required Metrics
- API latency (p50, p95, p99)
- Booking creation time (must be ≤ 2 minutes)
- Driver acceptance time
- Sync success rate
- Mobile crash rate
- Offline queue depth

### Structured Logging
- All mutations logged with operationId
- Blacklist checks logged
- Payment transactions logged
- Sync conflicts logged
- No customer PII in logs (use IDs)

### Alerts
- Booking creation failure rate > 5%
- Driver assignment timeout > 15%
- Sync queue depth > 10,000
- WhatsApp connector unavailable
- Database unavailable

---

## Deployment Strategy

### Phase 1: Isolated Development
- Branch: `feature/fleetpro-next-platform`
- Ports: `:5051–5098`
- Database: Same canonical database (separate test collections)
- No changes to `:5050`

### Phase 2: Integration Candidate
- All WAVE 1–19 locally pass
- Create INTEGRATION_CANDIDATE branch
- Deploy to staging `:5050-staging`
- Full E2E testing
- QA signoff

### Phase 3: Production Merge
- After staging validation
- Explicit approval from stakeholders
- Merge to main
- Deploy to `:5050` (Web remains live)
- Gradual mobile rollout (feature flags)

---

## Next Steps

1. ✅ WAVE 0: Baseline checkpoint (done)
2. → WAVE 1: Domain audit + DB compatibility (in progress)
3. WAVE 2: Customer identity / PhoneNormalizer / Blacklist
4. WAVE 3: Mobile API + device registration
5. WAVE 4: Driver Lite shell + local DB
6. WAVE 5: Driver assignment + notification
7. ...WAVES 6–19...
8. Final: Integration candidate + production merge

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-12  
**Next Review**: After WAVE 1 completion
