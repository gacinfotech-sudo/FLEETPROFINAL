# Current Driver Module Audit

Generated: 2026-08-07, evidence-based (file:line citations), commit `1da105b`.

## The two findings that reshape everything else

1. **No document/file storage exists for the fleet `Driver` model at all** — but the
   repo already anticipated this. `server/routes.ts:190-220` defines
   `servePrivateTenantFile()`, explicitly commented: *"P1 PATTERN (for future private
   documents — self-drive KYC, driving licence, Aadhaar, damage photos; see
   IMPLEMENTATION_PLAN.md P2)"* — currently unused (`void servePrivateTenantFile;`).
   `TASK-DRIVER-DOCUMENTS-03` should build on this existing hook, not invent a parallel
   file-serving mechanism.
2. **Zero Google Drive/OAuth integration exists anywhere** in the repo (`googleapis`,
   `GoogleAuth`, `OAuth2Client` — no matches in `server/` or `client/src/`, no
   `google*` npm dependency). This is entirely new infrastructure, not an extension of
   something existing.

## Driver model — what exists (`server/models/index.ts`)

`IDriver` interface `:82-112`, `DriverSchema` `:434-462`, registered `:3275`.

12 fields total: `tenantId`, `name`, `phone`, `email`, `licenseNumber` (**no license
class, no expiry date**), `experience`, `rating`, `status`
(`'available'|'on_duty'|'inactive'` — a flat flag, not a lifecycle), `languages`,
`permanentAddress`, `currentAddress`, `maritalStatus`, `aadharNumber`, `panNumber`,
`dateOfJoining`, `createdAt`, plus driver-portal auth fields (`loginPin`,
`loginPinSetAt`, `sessionId`).

**Not present on `Driver` at all**: PSV/badge, police-verification status, medical
fitness, employment type, bank details, insurance, emergency contacts, references,
employment history, training records, any document/attachment field.

### A richer sibling model already exists — for the wrong drivers

`IVendorDriver` (`:2937-2962`, schema `:2964-3005`) — third-party/outsourced drivers,
a **separate** collection — already has `licenseExpiry`, `policeVerificationStatus`,
`emergencyContact` (single string), `photoUrl`, `rating`, `complaintCount`. This is
useful precedent for field *naming*, but `TASK-DRIVER-DOMAIN-02` must not confuse the
two models or accidentally merge them — the prompt explicitly forbids creating a second
Driver master, and `VendorDriver` already correctly serves a different population
(vendor-supplied drivers, not company employees).

### A known inconsistency, worth fixing incidentally

`server/routes.ts:1932` checks `d.status === 'inactive' || d.status === 'suspended'` —
but `'suspended'` is not a value in `DriverSchema.status`'s actual enum. Dead/unreachable
code today. `TASK-DRIVER-DOMAIN-02`'s lifecycle work should resolve this properly (a real
`suspended` state) rather than leave the inconsistency in place.

### Vestigial dead UI, worth fixing incidentally

The driver-detail view dialog (`client/src/pages/dashboard.tsx:3070-3232`) references
`viewingDriver.age`, `.licenseType`, `.licenseExpiry`, `.notes` — **none of these fields
exist on `IDriver`** — they silently render blank. Likely leftover from an earlier or
planned schema. `TASK-DRIVER-ONBOARDING-UI-04` should either wire these to real new
fields (license expiry is genuinely needed) or remove the dead references — not leave
them as an invisible landmine.

## Emergency contacts / references — confirmed absent on Driver

No contact/reference field of any kind on `Driver`. Existing precedent elsewhere is a
**single flat string** (`Customer.emergencyContact`, `VendorDriver.emergencyContact`) —
never normalized, never multiple. This means the Contact Data Rule's normalized
Driver Contact/Reference model is genuinely new work, with no existing pattern to
migrate away from (a clean slate, not a migration problem).

## Driver lifecycle — confirmed absent

`status` is a 3-value flat flag. No candidate/application/onboarding/offboarded concept
anywhere. `DriverLeave` (`:865-878`) and `DriverAttendance` (`:906-922`) are separate,
adjacent collections with their own status enums — real and usable by
`TASK-DRIVER-OPERATIONS-06`, but neither is a lifecycle-stage model.

## Vehicle handover — confirmed absent

No handover/return-checklist/inspection/condition-photo/removable-item-inventory concept
anywhere. No odometer field on `Vehicle` at all (only per-trip on `Booking`, as
`startOdometer`/`endOdometer`). "Assigning" a driver to a vehicle today is just setting
`Booking.driverId`/`vehicleId` directly via the generic `PUT /api/bookings/:id` — no
dedicated assignment endpoint, no checklist, no acceptance record beyond
`Booking.dutyAcceptedAt` (driver-portal accept-duty, "visibility for ops, not a gate"
per its own schema comment). `TASK-VEHICLE-HANDOVER-05` is genuinely new work end to end.

## GPS — Driver is not connected to it at all

Confirmed zero references to `driver` anywhere under `server/gps/`. GPS
device/connection/assignment is scoped strictly to `Vehicle`. `TASK-DRIVER-OPERATIONS-06`
should treat any driver↔GPS-device correlation as new, additive work — not assume a
hook exists to plug into.

## Performance & incidents

- **Performance is computed live from real Booking records**, never stored/fabricated —
  `server/services/driverPerformance.ts:18-30`, explicit comment: *"computed entirely
  from real operational records... never a hand-entered or mysterious score."* Good
  precedent to preserve and extend, not replace.
- **Complaints** are customer-complaint-driven (`ICustomerComplaint.driverId`,
  category includes `driver_late`/`driver_behaviour`/`rash_driving`) — no internal
  incident-report or challan (traffic violation) system exists. Both are genuinely new
  for `TASK-DRIVER-OPERATIONS-06`.

## Permissions & driver-portal auth

Only one real driver permission today: `MANAGE_DRIVERS`. No document-access or
contact-access permission granularity exists yet — needed for the Contact Data Rule's
"restrict access" and the Google Drive Rule's "access classification" requirements.

The driver-portal (phone+PIN login, `client/src/pages/driver-login.tsx`/`driver-portal.tsx`,
`server/middleware/driverAuth.ts`) is real, working, and **deliberately isolated** from
staff auth — the repo's own design comment (`server/models/index.ts:100-108`) explains
why: 100+ existing routes are gated only by `authenticateUser, requireTenant` with no
further role check, so a driver session must only ever reach the small, explicit
`/api/driver-*` route set. **Any new driver-lifecycle route added by this initiative must
respect this same isolation** — never let a driver-portal session reach a new
lifecycle/document/handover endpoint that wasn't built with driver-role access in mind.

## Audit history precedent

No shared generic audit log. Two existing patterns: inline history arrays on the parent
document (`Booking.statusHistory`/`rescheduleHistory`/`extensionHistory`), and a
dedicated collection (`GpsAuditLog` — `tenantId/userId/action/oldValue/newValue/reason/createdAt`
shape) which is the closer precedent for a Driver-lifecycle audit trail given the
initiative wants "no-hard-delete" revision history across many sub-entities (contacts,
documents, status), not just one parent document's own history array.

## UI — single form, not a wizard; no dedicated 360 page

`client/src/components/drivers/driver-form.tsx` (488 lines) — one `react-hook-form` +
Zod form in a Dialog, 6 always-visible fields + 6 in a collapsible "Additional Details"
section, 12 fields total, no document/photo upload. Driver detail is a **modal**
(`dashboard.tsx:3070-3232`), not a dedicated Driver 360 page. `TASK-DRIVER-ONBOARDING-UI-04`
is building a real hiring wizard and a real 360 view largely from scratch, evolving the
existing form/modal rather than replacing them outright (preserve-first mode).

## Existing driver-related tests

`driver-feedback.spec.ts` (1 test), `driver-overlap.spec.ts` (4 tests — solid overlap/
double-booking coverage, reusable pattern for handover-concurrency tests),
`pipeline-audit-driver-portal.spec.ts` (3 tests, serial mode — PIN set/login/duty-accept/
scoping), `vendor-drivers-vehicles.spec.ts` (covers `VendorDriver`, not fleet `Driver` —
don't confuse the two when writing new specs).
