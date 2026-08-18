# Availability Rule Matrix

Records the exact current state of `server/services/availability.ts` (full file read) and what the eventual centralized Availability Engine (spec §29-38) needs to add. **Phase 1 of this patch does not modify `availability.ts` or add the new engine** — Phase 1 is Inquiry capture only, which doesn't yet touch driver/vehicle assignment. This document exists now so later phases build against a recorded, accurate baseline rather than re-discovering it.

**Update — Phase 10 (`docs/INQUIRY_BOOKING_TEST_REPORT.md`):** the two gaps below that were actually built are struck through with what shipped. Buffers now exist (additive, optional, default 0). `checkVehicleAvailability` now exists. A working cross-user tentative hold now exists too — deliberately implemented as a live read over `BookingDraft` (Phase 8) rather than a new `ResourceReservation` model, since a draft already *is* a per-user "this vehicle, these dates, right now" record and a second model would only add a lifecycle to keep in sync. Vendor rules remain blocked (no Vendor Master). The `Vehicle.status` enum widening was not needed by anything built and remains undone.

## Current exported functions (baseline, unchanged by Phase 1)

| Function | Signature | Buffer support | Exclude-self support |
|---|---|---|---|
| `findVehicleConflicts` | `(tenantId, vehicleId, start, end, excludeBookingId?, session?)` | None | Yes (`excludeBookingId`) |
| `findDriverConflicts` | `(tenantId, driverId, start, end, excludeBookingId?, session?)` | None | Yes |
| `findDriverLeaveConflicts` | `(tenantId, driverId, start, end, session?)` | None | N/A (leave isn't a booking) |
| `checkDriverAvailability` | `(tenantId, driverId, start, end, excludeBookingId?, session?)` | None | Yes |

**No `checkVehicleAvailability` wrapper exists** — call sites use `findVehicleConflicts(...).length === 0` directly.

## Current occupying-status set (`OCCUPYING_STATUSES`, availability.ts:27-30)

```
confirmed, vehicle_assigned, driver_assigned, ready_for_dispatch,
trip_started, ongoing, extended, return_pending
```

`enquiry`, `quotation_sent`, `tentative`, `on_hold` are **not** occupying today — nothing currently blocks a resource for a pre-confirmation booking. This is the correct behavior for the *existing* early-Booking-as-pipeline-stage model, but the new Inquiry/Lead/Quotation system introduces a new question the current code was never designed to answer: should a *sent, unaccepted* quotation put a soft/tentative hold on a vehicle? Spec §36 (`ResourceReservation`, `status: 'tentative'`) says yes. This is new behavior, not a bug in the existing code — recorded here as the design point the future Availability Engine phase must resolve deliberately, not accidentally.

## Current overlap formula (no buffers)

```
scheduledStartDateTime < queryEnd && scheduledEndDateTime > queryStart
```

The spec's requested formula adds reporting/return/rest buffers:
```
existingEffectiveStart = existingStart - reportingBuffer
existingEffectiveEnd = existingEnd + returnBuffer + restBuffer
```
None of this exists today. Buffers are a genuinely new concept, additive to (not replacing) the existing strict-overlap check — the plan for the later Availability Engine phase is to add buffer parameters with a default of `0` minutes so existing callers that don't pass a buffer get byte-identical behavior to today.

## Vehicle status vs. maintenance/breakdown

Confirmed (re-verified from schema): `Vehicle.status` enum is exactly `available | on_trip | maintenance` — no separate `service`/`breakdown` status exists. The spec's §32 "Service / Maintenance / Breakdown" distinctions would currently all have to map onto the single `maintenance` value, OR a future phase could widen the enum additively (append new values, never remove/rename `available`/`on_trip`/`maintenance`) if the business genuinely needs to distinguish them. Not done in this patch.

## Vendor resource rules — blocked dependency

Spec §33 (Vendor Driver/Vehicle/Duty overlap) has no underlying entity on this branch — see [INQUIRY_LEAD_EXISTING_AUDIT.md](./INQUIRY_LEAD_EXISTING_AUDIT.md). Vendor availability rules cannot be implemented until the Vendor Master branch (`feature/vendor-360-patch`, already built elsewhere per the earlier full-repo audit) is merged. This is an explicit, reported dependency block, not an oversight.

## What Phase 1 actually touches re: availability

**Nothing.** Inquiry capture (this patch) happens before any driver/vehicle/vendor is assigned to anything — an Inquiry has no `vehicleId`/`driverId` fields at all (only requirement *preferences*, e.g. "customer wants a 7-seater," which is a request, not an assignment). The centralized Availability Engine, buffers, and `ResourceReservation` model are scoped for a later phase, sequenced after Lead/Quotation (since availability-checking only becomes relevant once a real Booking Draft with real dates is being assigned real resources).
