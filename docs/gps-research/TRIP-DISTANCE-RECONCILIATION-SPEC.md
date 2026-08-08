# Trip / Distance Reconciliation Specification

Generated: 2026-08-06T21:30Z. Scopes TASK-GPS-TRIP-BILLING-06. Provider-neutral — does not
assume any specific GPS vendor's trip-report shape (see
[GPS-PROVIDER-RESEARCH.md](GPS-PROVIDER-RESEARCH.md) for what's actually available per
provider).

## 1. What already exists (do not rebuild)

Per [CURRENT-FLEET-AUDIT.md](CURRENT-FLEET-AUDIT.md) §1: `Booking` already carries
`startOdometer?`, `endOdometer?`, `totalKilometers?`, `actualStartDateTime`,
`actualEndDateTime` (`server/models/index.ts:161-164, 221`). Odometer capture and
`totalKilometers` computation happen in `server/services/bookingStateMachine.ts:125-227` on
booking-state transitions. This manual-entry pipeline is the **authoritative source of record**
today and remains authoritative after GPS reconciliation ships — see boundary #1 below.

`VehicleGpsAssignment` (`server/gps/models/vehicleGpsAssignment.ts`, already built) is
effective-dated, so for any historical booking window FleetPro can already determine which GPS
device (if any) was assigned to a vehicle during that window — this is the join key
reconciliation needs; it does not need to be reinvented.

## 2. Preserve-first boundaries (non-negotiable, from `docs/GPS_IMPLEMENTATION_PLAN.md:18-25`)

1. **Booking stays authoritative.** GPS-derived distance is evidence displayed *alongside*
   `totalKilometers`, never a silent replacement. `totalKilometers` is not overwritten by a
   background job.
2. **GPS cannot mutate finalized invoices or payments.** Any GPS/meter mismatch surfaces in a
   review UI; only an explicit manager approval action writes a reconciled value forward, and
   only into a new field/record dedicated to that purpose — never by rewriting
   `Booking.totalKilometers` or an `Invoice` line item in place.
3. **GPS reconciliation stores its own source and approval trail**, separate from the manual
   odometer fields, so it's always possible to audit "what did the driver report" vs. "what did
   GPS report" vs. "what did a manager approve" as three distinct values with three distinct
   provenances and timestamps.

## 3. Proposed reconciliation model (new, additive — this task's actual deliverable)

A new collection/model, e.g. `GpsTripReconciliation` (exact name/shape is this task's
responsibility to finalize and propose as a report patch per the shared-file rule below), keyed
by `bookingId` + `tenantId`, holding:

- `gpsDistanceKm` (derived from position-history/trip-report data for the assigned device
  during `[actualStartDateTime, actualEndDateTime]`) — nullable if no device was assigned or
  data is incomplete for the window.
- `meterDistanceKm` (copy of `Booking.totalKilometers` at time of computation, for point-in-time
  audit even if the booking record later changes).
- `distanceSource`: enum, e.g. `gps_only | meter_only | both_matched | both_mismatched |
  insufficient_data`.
- `mismatchPct` / `mismatchKm` when both values are present.
- `reviewStatus`: `pending_review | approved | rejected | not_applicable`.
- `approvedBy`, `approvedAt`, `approvalNote` — populated only through the explicit manager
  approval action (TASK-GPS-TRIP-BILLING-06's billing-review panel).
- `rawEvidenceRef` — pointer to the underlying telemetry/trip-report records used (from
  TASK-GPS-INGESTION-04's storage), so a reviewer can drill into the actual GPS points, not just
  a computed number.

This model is **new** (does not exist yet) — it belongs to TASK-GPS-TRIP-BILLING-06's exclusive
ownership (see the manifest's file-ownership matrix), living under `server/gps/models/` or
`server/gps/billing/` alongside the existing GPS submodules, not inside `server/models/index.ts`
directly (which stays Integrator-only).

## 4. Mismatch-detection logic (provider-neutral)

1. Resolve the vehicle's assigned GPS device for the booking's actual time window via
   `VehicleGpsAssignment` (already built — reuse `assignmentService.ts`'s effective-dated
   lookup, do not re-implement).
2. If no device was assigned for any part of the window → `distanceSource: meter_only`,
   `reviewStatus: not_applicable` (nothing to reconcile).
3. If a device was assigned but ingestion (TASK-GPS-INGESTION-04) has no stored telemetry
   covering the window → `distanceSource: meter_only`, flagged separately as a **data-gap**
   (distinct from a genuine mismatch — do not conflate "GPS didn't report" with "GPS disagrees
   with the driver").
4. If both values exist, compute `mismatchKm = |gpsDistanceKm - meterDistanceKm|` and
   `mismatchPct = mismatchKm / meterDistanceKm`. Threshold for `both_mismatched` vs.
   `both_matched` is a tenant-configurable tolerance (default value to be proposed by this task
   in its report, informed by typical GPS noise/rounding — do not hard-code an arbitrary
   threshold without stating the reasoning).
5. Noise filtering: raw GPS position streams commonly contain drift/jitter when a vehicle is
   stationary (ignition off, still reporting slightly-varying coordinates). Distance computed
   from raw points without stop-filtering will systematically overstate `gpsDistanceKm`. This
   task must apply a stop/idle filter (e.g. discard displacement below a small
   distance-per-interval threshold while `movingStatus` is not `moving`) — the exact
   `movingStatus` derivation comes from TASK-GPS-INGESTION-04's normalized telemetry, this task
   consumes it, does not redefine it.

## 5. Billing review panel — UX/permission requirements

- Gated by `GPS_DISTANCE_REVIEW` (view) and `GPS_DISTANCE_APPROVE` (approve) permissions —
  both already provisioned in `server/middleware/permissions.ts:94-110`, unused until this
  task's routes consume them.
- Must show, per booking under review: meter reading, GPS-derived distance, mismatch %, a link
  to the underlying trip/route replay (from TASK-GPS-FLEET-UI-05's route-history view, cross-
  referenced not duplicated), and an explicit approve/reject action with a required note on
  reject.
- Approval is per-booking, not bulk-by-default — a bulk-approve action, if added, must still
  write an individual audit entry per booking, not one blanket record.

## 6. Driver/vehicle performance analytics (secondary scope of this task)

Once reconciliation data exists across many bookings, driver- and vehicle-level aggregates
(average mismatch, frequency of `both_mismatched`, idle-time ratio) become possible. This is
explicitly lower priority than the per-booking reconciliation flow above — TASK-GPS-TRIP-
BILLING-06's report should treat analytics as a stretch goal within its wave, not block
completion on it.

## 7. Open dependency

This entire task is blocked on TASK-GPS-INGESTION-04 producing normalized telemetry with a
`movingStatus` derivation and a queryable position-history-by-time-range interface — see the
dependency graph in
[GPS-TELEMATICS-MANIFEST.md](../../.claude/tasks/active/GPS-TELEMATICS-MANIFEST.md).
