# Driver Lifecycle Specification

Generated: 2026-08-07. Implementation-ready spec synthesizing
`DRIVER-COMPLIANCE-RESEARCH.md`, `CURRENT-DRIVER-MODULE-AUDIT.md`,
`DRIVER-DATA-MINIMIZATION-MATRIX.md`, and `DRIVER-DOCUMENT-MATRIX.md`. Governs
`TASK-DRIVER-DOMAIN-02` primarily, referenced by every other implementation task.

## 1. Lifecycle stage model (new — nothing today beyond a flat status flag)

```
candidate → application → document_collection → identity_verification →
police_verification → medical_fitness → reference_verification →
employment_verification → training → approved → active →
[suspended | on_leave] → offboarding → offboarded
```

- Stored as a new `lifecycleStage` field on `Driver`, **additive**, default `'active'`
  for every existing document (backward-compatible — a driver that already exists today
  is, by construction, already past onboarding).
- The existing `status: 'available'|'on_duty'|'inactive'` field is **preserved
  unchanged** — it remains the real-time operational flag `TASK-DRIVER-OPERATIONS-06`
  and the availability engine already depend on. `lifecycleStage` is a second,
  orthogonal axis (mirrors the Booking initiative's travel-date/resource-fulfilment
  axis split) — a driver can be `lifecycleStage=active` and `status=on_duty`
  simultaneously; they answer different questions.
- Fix the existing `'suspended'`-referenced-but-not-in-enum inconsistency
  (`server/routes.ts:1932`) as part of this work — add `suspended` to `status` for real,
  or move suspension entirely to `lifecycleStage` and update the route's check
  accordingly. Pick one, don't leave both.

## 2. Driver Contact/Reference model (new, normalized — per the Contact Data Rule)

New collection `DriverContact` (not fixed columns on `Driver`):

```
tenantId, driverId, fullName, relationship, contactCategory (enum: spouse, parent,
sibling, other_family, friend, professional_reference, previous_employer,
local_guardian, emergency_medical_contact, nominee, other), primaryMobile,
alternateMobile?, address?, occupation?, preferredLanguage?, emergencyPriority,
referenceVerificationStatus, verificationMethod, verifiedBy?, verifiedAt?,
consentStatus, notificationStatus, notes?, isActive, createdAt, updatedAt
```

- Duplicate `primaryMobile`/`alternateMobile` within the same driver's contact set is
  rejected at the application layer (a compound uniqueness check scoped to `driverId`,
  not a blanket global-unique index — the same phone number legitimately appears across
  different drivers' contact lists).
- Default policy (tenant-configurable): minimum 2 emergency contacts, minimum 2 verified
  references, maximum configurable up to 10. Enforcement is a **soft, stage-gating**
  check (you cannot reach `approved` without meeting the minimum), not a hard schema
  `required` — a candidate mid-application legitimately has zero contacts yet.
- When a tenant configures more than 4 required contacts: require a stated
  `businessPurpose` on the tenant policy record itself (not per-contact), and each
  contact beyond the default 4 additionally requires `consentStatus` and
  `notificationStatus` to be explicitly set (not left null) before the driver can reach
  `approved`.
- Access: normal Executive role does **not** get the full contact list — only a
  manager-tier permission (new: `DRIVER_CONTACTS_VIEW_FULL`) does. An Executive sees at
  most the single top-`emergencyPriority` contact, matching real operational need
  (who to call if something happens on a trip) without exposing the full reference set.

## 3. Employment history (new)

New collection `DriverEmploymentHistory`: `tenantId, driverId, employerName,
role?, startDate, endDate?, contactForVerification?, verificationStatus,
verifiedBy?, verifiedAt?, notes?`. Feeds the "Previous Employment Verification" lifecycle
stage; verification status gates `approved` the same way reference verification does.

## 4. Training (new)

New collection `DriverTraining`: `tenantId, driverId, trainingType, completedDate?,
expiryDate?, certificateDocumentId? (ref DriverDocument), status (scheduled|completed|
expired)`. `TASK-DRIVER-DOCUMENTS-03` owns the certificate file; this collection owns the
training-event record itself (`TASK-DRIVER-OPERATIONS-06`'s territory).

## 5. Assignment eligibility (new, replaces implicit "any driver can be assigned")

A new `isEligibleForAssignment(driverId)` check (pure function, new file, called from
the existing `checkDriverAvailability()` path in `server/services/availability.ts` —
**additively**, not replacing its existing overlap/leave logic) that additionally
requires: `lifecycleStage=active`, no unexpired-required document in `rejected`/`expired`
state, and `status` not `suspended`. A driver failing eligibility is excluded from
`GET /api/drivers/available` results with a clear reason string, exactly matching the
existing `unavailabilityReason` pattern already used for booking/leave conflicts
(`server/routes.ts:1943-1949`) — extend that same reason vocabulary, don't invent a
parallel mechanism.

## 6. Revision history (new — no existing generic mechanism to reuse cleanly)

Closest existing precedent is `GpsAuditLog`'s shape
(`tenantId/userId/action/oldValue/newValue/reason/createdAt`) — reuse that shape for a
new `DriverAuditLog` collection covering lifecycle-stage transitions, status changes,
and contact/document verification-status changes. **No hard deletes anywhere in this
initiative** — every "removal" (e.g. deactivating a contact) is `isActive=false` plus an
audit-log entry, matching the prompt's "No-hard-delete rules."

## 7. Vehicle handover — see `VEHICLE-HANDOVER-SPEC.md`

Not duplicated here; that document is authoritative for `TASK-VEHICLE-HANDOVER-05`.

## 8. What stays exactly as-is (preserve-first, explicit)

- `Driver.status` semantics and every existing consumer of it.
- `DriverLeave`, `DriverAttendance` — reused by `TASK-DRIVER-OPERATIONS-06`, not
  replaced.
- `driverPerformance.ts`'s live-computed-from-bookings approach — extended (e.g. folding
  in incident counts once that's built), never replaced with a stored/hand-entered score.
- The driver-portal's isolated auth boundary (`server/middleware/driverAuth.ts`) — any
  new route a driver-portal session might need (e.g. viewing their own documents) must
  be explicitly added to that small allow-list, never exposed by accident through a
  broader `authenticateUser`-only route.
- `VendorDriver` remains the vendor/outsourced-driver model — this entire initiative is
  scoped to the fleet `Driver` model only. No merging, no second Driver master.
