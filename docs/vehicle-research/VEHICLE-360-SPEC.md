# Vehicle 360 — Final Spec

Synthesizes the dispatch requirement + `CURRENT-FLEET-MODULE-AUDIT.md` +
`VEHICLE-REAL-WORLD-RESEARCH.md` + `VEHICLE-COMPLIANCE-MATRIX.md` +
`VEHICLE-EXPENSE-MATRIX.md` into one buildable spec. Every task file in this batch
implements a named section below; no task invents scope not listed here.

## Architecture: Quick Add → Vehicle 360, never one giant form

Confirmed today's `vehicle-form.tsx` (`client/src/components/fleet/vehicle-form.tsx`) is
exactly the flat 8-field form the screenshot shows. It is **kept, not replaced** — it
becomes the "Quick Add" step. A new, separate Vehicle 360 page (net-new, no existing
equivalent per the audit) carries everything else.

### Quick Add fields (extends the existing form, same file)
Required: Registration Number, Make, Model, Vehicle Category.
Recommended (optional, don't block save): Variant, Manufacturing Year, Fuel Type, Seating
Capacity, Ownership Type, Current Odometer, Branch/Base Location.
Actions: **Save Vehicle**, **Save Draft**, **Save & Complete Profile**. Save always
succeeds without any compliance document present. After Save, auto-open the **Vehicle 360
Setup Checklist** (a guided view of the empty tabs below, not a blocking wizard).

## Vehicle 360 tabs (all new, all additive to the Fleet module — none replace it)

Overview · Documents & Compliance · Maintenance · Daily Inspections · Tyres · Battery ·
Fuel/CNG/EV · Expenses · FASTag/Toll · GPS & Telematics · Driver Assignments ·
Bookings & Trips · Handover & Return · Breakdowns · Accidents · Challans ·
Accessories & Inventory · Revenue & Profitability · Timeline.

`Handover & Return` **reuses** the existing (unmerged) `VehicleHandover` model/routes
(`server/driver/handover/**`) — this tab is a read/action surface over that module, not a
new backend. `Bookings & Trips` reads existing `IBooking.vehicleId` records — no new
booking model. `GPS & Telematics` reads `GpsVehicleLatestState` once the GPS telemetry
work merges — no new ingestion.

## Vehicle core data (proposed `IVehicle` patch — Integrator-applied, see audit §1)

Additive fields, modeled directly on `IVendorVehicle`'s already-proven shape:
`normalizedLicensePlate` (+ `{tenantId, normalizedLicensePlate}` unique partial index),
`variant?`, `registrationDate?`, `vehicleCategory?` (distinct from existing `type`, which
is a pricing/UI category — `vehicleCategory` is the compliance/regulatory category),
`transportClassification?` ('transport'|'non_transport'), `vin?`, `chassisNumber?`,
`engineNumber?`, `currentOdometer?`, `engineHours?`, `ownershipType?`,
`acquisitionDate?`, `purchaseValue?` (Accounts-restricted by RBAC), `branch?`,
`baseLocation?`, `currentDriverId?` (denormalized pointer, source of truth remains
handover events — see Status dimensions below).

## Status dimensions — four independent axes, never one flag (Section 6)

**Operational** (extends today's 3-value enum, matches `IVendorVehicle`'s richer set):
`AVAILABLE | RESERVED | ASSIGNED | ON_TRIP | RETURNING | CLEANING | MAINTENANCE_DUE |
IN_MAINTENANCE | BREAKDOWN | ACCIDENT_HOLD | INACTIVE | SOLD`

**Compliance**: `COMPLIANT | EXPIRING_SOON | PENDING | EXPIRED | COMPLIANCE_HOLD` —
derivation rule fully specified in `VEHICLE-COMPLIANCE-MATRIX.md`'s last section.

**GPS**: `ONLINE | STALE | OFFLINE | NOT_CONFIGURED` — derived from
`GpsVehicleLatestState.movingStatusSince`/last-communication timestamp once that module
merges; `NOT_CONFIGURED` when no `VehicleGpsAssignment` exists.

**Safety** (from Daily Inspection, Section 8): `SAFETY_HOLD` is a fifth, cross-cutting flag
(not a 5th value bolted onto Operational) — a vehicle with an unresolved `CRITICAL`
inspection defect is `SAFETY_HOLD` regardless of what its Operational status says, and
`SAFETY_HOLD` overrides booking eligibility even if Operational says `AVAILABLE`.

**Booking eligibility** = `Operational == AVAILABLE` AND `Compliance != EXPIRED/
COMPLIANCE_HOLD` AND `NOT SAFETY_HOLD`. A single pure function, one implementation,
consumed everywhere eligibility is checked (booking creation, vehicle-selection UI,
availability API) — never re-derived ad hoc in multiple places.

## Data model summary (new collections, all additive, all outside `server/models/index.ts`
## except where noted as a proposed patch)

- `VehicleDocument` (`server/vehicle/documents/**`) — RC/Insurance/PUC/Fitness/Permit/etc,
  per `VEHICLE-COMPLIANCE-MATRIX.md`. Same Drive-for-bytes+Mongo-metadata pattern as the
  driver documents module, own vehicle-typed enum, ideally sharing the tenant's existing
  Drive *connection* (not a duplicate OAuth flow) once that module merges.
- `MaintenanceRecord` (`server/vehicle/maintenance/**`) — full field list per dispatch
  requirement Section 9, `nextDueDate`/`nextDueKm`/`nextDueEngineHours` driving the
  "whichever trigger fires first" rule confirmed by real industry practice in
  `VEHICLE-REAL-WORLD-RESEARCH.md` §3.
- `VehicleInventoryItem` (`server/vehicle/maintenance/**` or a sibling — task's call) — the
  structured catalog (spare tyre, jack, toolkit, fire extinguisher, etc. with purchase
  date/cost/warranty) that today's free-text `VehicleHandover.removableItemInventory`
  entries can reference by name, closing the gap confirmed in the audit.
- `TyreRecord`, `BatteryRecord` (`server/vehicle/maintenance/**`) — per-unit lifecycle,
  Sections 10-11.
- `FuelTransaction` (`server/vehicle/expenses/**`) — Section 12, linked to `Expense` via
  `expenseId`.
- `FastagRecord` (`server/vehicle/fastag/**`) — Section 14, provider-adapter pattern like
  GPS, not a hard-coded NPCI client (per research finding).
- `BreakdownEvent`, `AccidentEvent`, `Challan` (`server/vehicle/incidents/**`) — Sections
  16-18, the confirmed gap in the existing handover implementation.
- `VehicleTimelineEvent` — either a real stored collection or a computed fan-out (like the
  existing Customer 360 `timelineService.ts` pattern, audited previously in this repo) —
  **prefer the fan-out pattern**, consistent with this repo's own stated reasoning
  ("storing a second copy would just be another place these could drift out of sync").

## Permissions (proposed, dot-namespaced like the GPS block — Integrator-applied)

`vehicle.compliance.view/manage`, `vehicle.maintenance.view/manage`,
`vehicle.expense.view/manage`, `vehicle.incidents.view/manage`,
`vehicle.fastag.view/manage`, plus reuse of the existing `MANAGE_VEHICLES` for core CRUD
and `VIEW_REVENUE` for the Profitability tab (already proven pattern, don't invent a
parallel permission for something already gated).

## What is explicitly out of scope for this batch (confirmed via duplication check)

- Rebuilding `VehicleHandover`/handover-return flow — already built, reused as-is.
- Rebuilding GPS telemetry ingestion — consumed once merged, not duplicated.
- A second Google Drive OAuth/connection flow — the vehicle documents module should reuse
  the tenant's existing Drive connection where the driver-documents module established
  one; only the document-type/metadata model is new.
