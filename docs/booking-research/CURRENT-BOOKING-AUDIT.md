# Current Booking Audit

Generated: 2026-08-07, evidence-based (file:line citations), commit `3c556d6`.

## CORRECTION (2026-08-07, later same day) — a second branch already solved most of this

`/private/tmp/fleetpro-flexible-pipeline` (branch `repair/flexible-booking-vendor-outsourcing`,
HEAD `9049d33`, not yet merged to trunk) independently audited and fixed the exact
`vehicleId`-required dead-end this document calls "the one finding that reshapes
everything else," below. Verified firsthand (not just read — re-ran the tests): **9/9
pass** on `tests/e2e/booking-non-blocking-fulfilment.spec.ts` and
`tests/e2e/vendor-sourcing-workflow.spec.ts` against that branch's own running instance.

Real, shipped, additive, backward-compatible (old clients creating a booking with a
vehicle are unaffected — explicitly tested):

- **`resourceFulfilmentStatus`** field on `Booking` (`server/models/index.ts`, 11 values:
  `not_started, own_fleet_assigned, vendor_vehicle_selected, vendor_confirmation_pending,
  vendor_confirmed, outsourcing_requested, vendor_quotes_pending,
  resource_sourcing_pending, resource_secured, resource_rejected, resource_failed`).
  Absent on legacy bookings — treated as already-resolved, not as a gap to backfill.
- New `VendorSourcingRequest`/`VendorSourcingResponse` models — a full outsource-vehicle
  workflow (request → send to N vendors → compare responses → select → booking resolves),
  in `server/services/vendorSourcingService.ts` (375 lines).
  `Trip Start` still strictly gates on real resolution (own OR vendor) — no bypass.
- Three-path Booking Wizard Step 2 UI (Own Fleet / Vendor Vehicle / Outsource) already
  built into `enhanced-booking-form.tsx` on that branch, plus Quick-Add Vendor/Vehicle
  inline in the wizard.
- `/api/vehicles/available` fixed to compare real date+time, not bare calendar dates
  (a related bug this document's own research agent didn't catch).

**What that branch did NOT touch** (still a genuine gap — see rest of this document):
the date-certainty axis (`travelDateStatus`/tentative range/`followUpAt`) is completely
separate from resource-fulfilment-certainty and doesn't exist there either. `tripType`
is still dead code there too (unrelated to that branch's scope).

**Everything below this point that talks about building vehicle-optional/vendor/outsource
booking creation as new work is superseded** — treat `resourceFulfilmentStatus` as the
existing vocabulary to build on, not a name to reinvent. See the revised
`BOOKING-EXPERIENCE-MANIFEST.md` for the corrected task split.

## The one finding that reshapes everything else

**`vehicleId` is required to create a booking at all** — enforced at three layers:
Mongoose (`server/models/index.ts:459`), server Zod (`server/schemas/mongodb-schemas.ts:106`),
client Zod (`enhanced-booking-form.tsx`). This directly blocks the dispatch prompt's
core requirements: Allocation Pending, Vehicle Pending, Vehicle Category Undecided, and
"Save Confirmed Booking with Allocation Pending" are **all impossible today**. A code
comment already acknowledges the gap (`server/routes.ts:3824-3828`): office staff can't
log a phone call that might not become a trip "without creating a real Booking (which
requires a vehicleId today)" — which is why the separate Inquiry model exists as a
workaround. Relaxing this constraint (additively, conditionally — required only once
`intent=confirmed AND allocation is being made now`) is `TASK-BOOKING-DOMAIN-02`'s
highest-priority, highest-risk change.

## What already exists and should NOT be rebuilt

The dispatch prompt reads as if several capabilities are missing. They are not —
scope these tasks to the real gaps, not to re-implementing solved problems:

| Capability | Status | Evidence |
|---|---|---|
| Idempotent booking creation | **Already solid.** Client-generated `idempotencyKey`, server pre-check + post-insert duplicate-key (Mongo `11000`) catch, partial unique index `{tenantId,idempotencyKey}` | `models/index.ts:454,1469-1472`, `routes.ts:2395-2403,2472-2483` |
| Draft persistence / autosave | **Already solid.** One draft slot per `(tenantId,userId)`, 1200ms debounced autosave, "Resume your unfinished booking?" dialog, auto-clear on submit, correctly disabled during Lead-conversion prefill | `models/index.ts:2765-2785`, `routes.ts:2303-2344`, `enhanced-booking-form.tsx:216-281` |
| Vehicle/driver overlap detection | **Already solid.** Transaction-wrapped, checks both real bookings and *other users' in-progress drafts* (self-excluded, 20-min staleness window), driver-leave conflicts, structured 409 responses | `server/services/availability.ts` (`findVehicleConflicts`/`findDriverConflicts`/`findTentativeDraftConflicts`/`checkDriverAvailability`), `storage-mongodb.ts:690-711` |
| Own-fleet vs vendor vs outsource | **Already solid, richer than the prompt assumes.** `fulfilmentType: 'own'\|'vendor'`, structured Vendor/VendorDriver/VendorVehicle links, plus a *separate* third-party-driver-only concept, deliberately decoupled from booking source | `models/index.ts:202-218,505-515`, `routes.ts:6099` |
| Unallocated / needs-attention visibility | **Partially exists.** `live-bookings.tsx` already has an explicit "Unassigned" tab (of 11) and per-row flag badges (`driverNotAssigned`, `vehicleNotAssigned`) | `live-bookings.tsx:15-27,198-203` |
| Rich status model | **Already exists**, 17 values including `enquiry, quotation_sent, tentative, on_hold, confirmed, ...`, with full `statusHistory[]` audit trail | `models/index.ts:222-224,527-544` |
| Review-required re-validation | **Already exists.** Changing pickup date after selecting a vehicle clears the selection and forces re-review rather than silently submitting a stale allocation | `tests/e2e/booking-wizard-review-required.spec.ts:16-21` |

## The real gaps (what these six tasks should actually build)

1. **`vehicleId`/`driverId` cannot be optional-with-intent** — the #1 blocker above.
2. **No date-certainty model.** Only `pickupDate` (required) + optional `returnDate` —
   no `travelDateStatus`, no tentative range, no `followUpAt`. This is the literal
   critical-date-rule requirement from the prompt and does not exist in any form today.
3. **`tripType` is dead code.** Present on the client Zod schema
   (`enhanced-booking-form.tsx:49`, values `one_way|round_trip|local|airport`) but
   **silently stripped** by the server Zod schema (unknown-key stripping) and never
   declared on `IBooking`/`BookingSchema` — never persisted. `bookingType` conflates
   "who drives" (`self_drive|with_driver`) with trip shape in one enum, and the form
   only ever writes the former. `invoiceService.ts:117` reads `(booking as any).tripType`
   — dead code reading a field that's never saved.
4. **No multi-vehicle support** — `vehicleId` is a single `ObjectId`, no array.
5. **No "Most Recent" / "Date Pending" / "Follow-up Due" queues** — these depend on
   fields that don't exist yet (`travelDateStatus`, `followUpAt`); `Tentative Bookings`
   is partially there since `status='tentative'` already exists.
6. **No customer previous-booking reuse flow** — not found anywhere in the audit.
7. **Hourly / fixed-package / per-km trip shapes** are not distinguished from the broken
   `tripType` field (item 3) — `pricingType: 'day'|'km'` exists as a separate, narrower
   concept (day-rate vs per-km pricing, not trip shape).
8. **Backdated authorized corrections** — `rescheduleHistory[]`/`extensionHistory[]`
   exist for some transitions, but no generalized "authorized backdated correction with
   reason" flag was found; needs confirmation from `TASK-BOOKING-RESEARCH-01`.

## Dead code found (flag for QA-06, do not silently delete as part of this initiative)

`client/src/components/booking/booking-form.tsx` (607 lines) — an older, non-wizard,
pre-Mongo (`vehicleId: z.number()`) form, not imported anywhere (`grep` for
`from.*booking-form` only self-matches). Not the live Add Booking UI
(`enhanced-booking-form.tsx` is). Leave in place; note in the QA report for the
Integrator to decide, since "preserve-first" mode means this session doesn't delete it
unilaterally even though it's unreachable.

## Live UI structure (for TASK-BOOKING-UI-04)

`client/src/components/booking/enhanced-booking-form.tsx` (2578 lines), mounted from
`client/src/pages/dashboard.tsx:995`. Real 4-step wizard (`stepConfig`, `:693-698`):
Trip Details → Vehicle & Service → Customer Info → Review & Pay. Already has real
Tailwind responsive breakpoints throughout (not a bare unstyled form) — e.g. step-title
truncation below `sm:` (`:736`), 2-col→4-col stat grids, stacking action buttons. This
is an evolution target, not a blank canvas.

## Booking creation flow (for TASK-BOOKING-DOMAIN-02)

`POST /api/bookings` (`server/routes.ts:2346-2629`): payload mapping → Zod validate →
idempotency check → source-vendor validation → customer resolve/create → reward preview
→ `storage.createBooking()` (does the actual write + availability check inside a Mongo
transaction) → customer/reward commit → referral capture → optional initial payment →
notification broadcast → best-effort WhatsApp confirmation. Any change to the "can this
save without a vehicle" rule touches this entire chain's assumptions — `TASK-BOOKING-
DOMAIN-02` must trace every step, not just the schema.

## Existing test coverage (for TASK-BOOKING-QA-06 — don't duplicate, extend)

`availability-engine.spec.ts`, `booking-actions.spec.ts`, `booking-draft-persistence.spec.ts`,
`booking-source.spec.ts`, `booking-vendor-fulfilment.spec.ts`,
`booking-wizard-review-required.spec.ts`, `complete-booking-and-reward-refresh.spec.ts`,
`dashboard-upcoming-bookings.spec.ts`, `lead-to-booking-conversion.spec.ts`.
