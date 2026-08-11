# Vehicle Handover Specification

Generated: 2026-08-07. Governs `TASK-VEHICLE-HANDOVER-05`. Per
`CURRENT-DRIVER-MODULE-AUDIT.md`, this is genuinely new — no handover/checklist/
inspection/odometer-on-Vehicle concept exists today; "assignment" is currently just
setting `Booking.driverId`/`vehicleId` directly.

## New collection: `VehicleHandover`

```
tenantId, vehicleId, driverId, bookingId? (nullable — a handover can exist for a
duty-shift assignment independent of one specific booking), direction (handover|return),
odometerReading, fuelLevel, conditionPhotos: [{ url/fileRef, angle, takenAt }],
removableItemInventory: [{ item, present, condition, notes }], damageNoted?: string,
driverAcceptance: { accepted, acceptedAt, signatureRef? }, staffConductedBy,
conductedAt, linkedReturnHandoverId? (set on the paired return record), status
(pending_driver_acceptance|accepted|disputed), createdAt
```

## Why a separate collection, not fields bolted onto `Booking`

A handover is a **vehicle+driver** event, not strictly a **booking** event — a
duty-shift handover (driver takes a vehicle for the day, works multiple bookings) has no
single owning booking. Making `bookingId` optional and modeling handover as its own
collection avoids forcing every handover into a booking-shaped box, and keeps `Booking`
itself untouched (preserve-first — no new required fields on the existing, heavily-relied-on
`Booking` schema).

## Handover flow

1. Staff conducts handover: records odometer, fuel level, condition photos (uploaded via
   the same document-registry mechanism `TASK-DRIVER-DOCUMENTS-03` builds, tagged to
   this handover rather than the driver's persistent document set), removable-item
   inventory, any damage.
2. Driver acknowledges (via driver-portal, respecting its existing isolated-auth
   boundary — a new, explicitly-added `/api/driver-portal/handovers/:id/accept` route,
   not a broadened blanket permission) — `driverAcceptance.accepted=true`.
3. Vehicle is now considered "handed over" for availability purposes — this is an
   **additive signal** consumed by `TASK-RESOURCE-03`/`availability.ts`-adjacent logic
   from the Booking initiative if relevant, or simply a new operational-state read by
   `TASK-DRIVER-OPERATIONS-06`'s dashboard views; it does not replace the existing
   Booking-level vehicle-overlap check.

## Return flow

1. Same structure, `direction=return`, `linkedReturnHandoverId` on the original handover
   points to this record (and vice versa) — a matched pair, not two independent events.
2. Odometer/fuel/condition/inventory compared against the handover record automatically
   — any shortfall (missing item, new damage, large odometer discrepancy vs. expected
   trip distance) is flagged, not silently accepted.
3. A flagged discrepancy creates a `damage/shortage history` entry
   (`TASK-DRIVER-OPERATIONS-06`'s incident-tracking territory) rather than blocking the
   return itself — matches the broader initiative's non-blocking philosophy (from the
   concurrent Booking initiative's own "never a dead end" principle, applied here):
   record the problem, don't prevent the vehicle from being returned.

## Concurrency

Two staff cannot conduct a handover for the *same vehicle* at overlapping times — use
the same atomic-conditional-write pattern already established for booking resource
allocation (`BOOKING-UX-SPECIFICATION.md` §6, if that initiative's docs are available to
reference; otherwise: a single conditional write keyed on `vehicleId` + "no open,
unaccepted handover already exists for this vehicle"). Tested explicitly by
`TASK-DRIVER-QA-SECURITY-07`'s "handover concurrency" requirement.

## What this does NOT change

- `Booking.vehicleId`/`driverId` assignment mechanism itself — unchanged, still the
  authoritative link between a trip and its resources.
- `Vehicle` schema — no new required fields; odometer/fuel are handover-record fields,
  not new Vehicle-level state (avoids a second, potentially-drifting odometer source of
  truth alongside `Booking.startOdometer`/`endOdometer`).
