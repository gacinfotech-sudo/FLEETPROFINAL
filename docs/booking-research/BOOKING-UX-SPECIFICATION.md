# Booking UX Specification

Generated: 2026-08-07. FleetPro-specific synthesis of `BOOKING-MARKET-RESEARCH.md` +
`REAL-WORLD-SCENARIO-MATRIX.md` + the dispatch prompt's requirements. This is the shared
spec `TASK-BOOKING-UI-04`, `TASK-BOOKING-DOMAIN-02`, and `TASK-BOOKING-QUEUES-05` build
against, so all three land on one coherent workspace instead of three guesses.

## 1. Booking certainty model (the core abstraction)

**CORRECTED 2026-08-07**: the resource-fulfilment axis below was originally spec'd as a
new concept for this initiative to build. It already exists, shipped and tested, as
`resourceFulfilmentStatus` on `repair/flexible-booking-vendor-outsourcing`
(`9049d33`) — see `CURRENT-BOOKING-AUDIT.md`'s correction section. This spec now treats
it as existing vocabulary to integrate with, not to invent.

Every booking carries **two independent axes**:

- **Travel-date certainty** (this initiative's genuine remaining gap):
  `travelDateStatus: not_decided | tentative_range | confirmed`. A *confirmed* booking
  can still have an undecided date (scenario #4 in the matrix); a booking with a firm
  proposed date can still be travel-date-`tentative_range` if the customer hasn't locked
  it in.
- **Resource-fulfilment certainty** (already built on the flexible-pipeline branch):
  `resourceFulfilmentStatus: not_started | own_fleet_assigned | vendor_vehicle_selected |
  vendor_confirmation_pending | vendor_confirmed | outsourcing_requested |
  vendor_quotes_pending | resource_sourcing_pending | resource_secured |
  resource_rejected | resource_failed`.

Resource consumption (does this booking hold a vehicle/driver slot) is a derived
property of **both** axes together: only `travelDateStatus=confirmed AND
resourceFulfilmentStatus ∈ {own_fleet_assigned, vendor_confirmed, resource_secured}`
consumes a slot. Every other combination is visible in queues but does not block
availability for other bookings. This is the concrete mechanism behind the prompt's
"never silently save the current date as the actual travel date" and "do not consume
driver or vehicle availability" rules — and it's a smaller lift than originally spec'd,
since only the date axis needs to be built new.

## 2. Field model — additive to the REAL existing schema, not a fresh design

`CURRENT-BOOKING-AUDIT.md` found a real, 17-value status enum and required
`pickupDate`/optional `returnDate` already in `IBooking`/`BookingSchema`
(`server/models/index.ts:222-224,464-465,527-533`) — this section adds new fields
alongside them, it does not replace them:

| Field | Status | Purpose | Never used for |
|---|---|---|---|
| `createdAt` | exists | record creation timestamp | travel date |
| `lastActivityAt` | **new** | last staff touch, drives "Most Recent" queue | travel date |
| `travelDateStatus` | **new** | `not_decided \| tentative_range \| confirmed` | — |
| `tentativeStartDate` / `tentativeEndDate` | **new** | optional range while undecided | confirmed scheduling/availability |
| `pickupDate` | exists, **validation relaxed** | the field availability logic already reads (`availability.ts`) — stays the single source of truth for confirmed scheduling; becomes conditionally required (only when `travelDateStatus=confirmed`) instead of unconditionally required | draft/placeholder value |
| `followUpAt` | **new** | when to re-contact for date-pending bookings | — |
| `vehicleId` | exists, **validation relaxed** | conditionally required (only when allocation is being made now); currently unconditionally required at 3 layers (Mongoose/server-Zod/client-Zod) — this is the audit's #1 blocker | — |
| `tripType` | exists on client only, **currently dead — must be wired end-to-end** | trip shape, kept separate from `bookingType`'s self_drive/with_driver axis | — |

No code path may write `pickupDate = new Date()` (or any current-time default) as a
stand-in for an unconfirmed date — this is a named, testable acceptance criterion for
`TASK-BOOKING-QA-06`. Because `pickupDate` is what `availability.ts` already reads,
relaxing its required-ness (rather than introducing a parallel `confirmedTravelDate`
field) avoids forking the single source of truth the existing, working overlap-detection
engine depends on.

## 3. Wizard structure (TASK-BOOKING-UI-04)

Progressive disclosure, minimum-to-maximum commitment, matching the research finding
that booking.com-style conditional disclosure keeps the default path short:

1. **Customer** — select/create customer (required to save anything at all).
2. **Trip shape** — trip type (one-way/round-trip/local/airport/hourly/fixed
   package/per-km), route (pickup required, drop optional/"partially known" allowed).
3. **When** — date certainty selector first (`Confirmed date` / `Sometime in a range` /
   `Not decided yet`), then the corresponding date input(s) conditionally rendered. Time
   of day is its own optional sub-field, never required to proceed.
4. **Who/what** — passenger count (optional), vehicle category (optional/"undecided"
   allowed), fulfilment source (own fleet / vendor / outsource / undecided).
5. **Review** — sticky summary panel (persists across all steps, not just step 5) shows
   exactly what will be saved and under what outcome (Quote/Tentative/Confirmed/Confirmed
   +Allocation Pending/Vendor Sourcing Pending) before the user commits.

Any step may be exited early via one of the five safe-save actions — the wizard is not a
gate the user must complete linearly to get anything saved.

## 4. Error presentation contract (TASK-BOOKING-UI-04 + TASK-BOOKING-DOMAIN-02)

- Errors are stage-specific: a Quote-Only save only enforces Quote-Only-required fields,
  never Confirmed-booking-required fields.
- Every error names the exact field and the exact corrective action ("Select a pickup
  location to continue" — not "Invalid input").
- No error clears or resets any field, per Baymard's checkout-error findings — this
  applies to selections (e.g. a chosen trip type) exactly as much as typed text.
- A failed submit leaves the draft intact and recoverable, not discarded.

## 5. Queues (TASK-BOOKING-QUEUES-05)

Pre-built saved views, not a filter builder (per the dispatch-board research finding
that naming the common failure states as dedicated shortcuts beats a generic filter UI):

| Queue | Definition |
|---|---|
| Most Recent | sorted by `lastActivityAt desc` |
| Unallocated | `resourceFulfilmentStatus ∈ {not_started, resource_sourcing_pending, vendor_quotes_pending}` (existing field — `live-bookings.tsx` already has a partial "Unassigned" tab, extend/reconcile with it rather than duplicating) |
| Date Pending | `travelDateStatus=not_decided` (new field) |
| Follow-up Due | `followUpAt <= now` (new field) |
| Tentative Bookings | `status='tentative'` (existing status enum value, not a new concept) |
| Needs Attention | union of Unallocated + Date Pending + Follow-up Due, de-duplicated |

Search/filter/sort are layered on top of these views, not a replacement for them.
Customer previous-booking reuse (scenario #32) surfaces the customer's last booking's
route/vehicle-preference as a one-click prefill when starting a new booking for them.

## 6. Resource allocation contract (TASK-RESOURCE-03) — mostly already built

**Superseded by the flexible-pipeline branch findings.** Atomic conditional allocation
writes, "Allocation Pending" (`resourceFulfilmentStatus=not_started`/
`resource_sourcing_pending`) as a legitimate non-error state, and re-validation on
change are **already implemented and tested** (`server/services/availability.ts`,
`server/services/vendorSourcingService.ts`, 9/9 tests passing as of this correction).
TASK-RESOURCE-03's remaining job is narrow: make `resourceFulfilmentStatus` and the new
`travelDateStatus` axis (§1) compose correctly together — specifically, a booking that
is both `travelDateStatus=not_decided` AND `resourceFulfilmentStatus=not_started` must
still resolve to "does not consume availability" via the existing engine, not a new one.

## 7. Explicit non-negotiables (from the dispatch prompt, restated as spec)

- No second Booking module — this evolves the existing Add Booking surface in place.
- No deletion/replacement of shell, sidebar, dashboard, or any other listed module.
- Backdated corrections require an explicit authorization flag and are recorded in
  revision history, never a silent overwrite.
- Every non-blocking save path (Draft/Quote/Tentative/Confirmed+Pending/Vendor-Pending)
  must be independently reachable — QA-06 tests each as its own acceptance scenario, not
  as a side effect of testing the "happy path."
