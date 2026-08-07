# Current Fleet Module Audit

Generated: 2026-08-07. Repo: fleetpro-main trunk (`feature/local-network-access` /
`booking/integration-preview`, commit `20bd273` at time of audit). Grounds every
Vehicle-360 task file's file-ownership list — every path below was confirmed by direct
read, not inferred.

## 1. `IVehicle` model
- Interface: `server/models/index.ts:71-88`. Schema: `:474-499`. Export: `Vehicle` model.
- Fields today: `tenantId`, `make` (required — actually holds "Vehicle Name" per the UI
  label), `vehicleModel?`, `year?`, `licensePlate?`, `capacity?`, `type` (enum:
  economy|standard|premium|luxury|suv|sedan|hatchback|coupe|convertible), `status` (enum:
  **`available|on_trip|maintenance` — only 3 values**), `features: string[]`,
  `pricePerDay`, `pricePerHour`, `pricePerKm`, `color?`, `fuelType?`, `transmission?`,
  `createdAt`.
- **Gaps confirmed against this initiative's requirements:** no `currentDriverId`, no VIN,
  chassis number, engine number, registration date, ownership type, acquisition
  date/value, branch/base location, engine hours, current odometer (owned-fleet side —
  contrast with `VendorVehicle`, which has `currentOdometer`). No compliance-status
  dimension, no GPS-status dimension. Only index: `{tenantId:1, status:1}`
  (`:1636`) — **no unique/dedup index on `licensePlate`**, so two vehicles with the same
  registration number can exist today.
- **Best existing precedent to extend from:** `IVendorVehicle`
  (`server/models/index.ts:3170-3258`) already has the richer shape this initiative wants
  for owned-fleet `Vehicle`: `registrationNumber` + `normalizedRegistrationNumber` with a
  real tenant-scoped unique partial index (`:3253-3256`), `rcNumber`, `rcExpiry`,
  `insuranceExpiry`, `permitExpiry`, `fitnessExpiry`, `pucExpiry`, `taxExpiry`,
  `currentOdometer`, `assignedDriverId`, and a status enum that already includes
  `breakdown` and `document_expired` (`:3235`). TASK-VEHICLE-DOMAIN-01 should copy this
  pattern onto `IVehicle`, not invent a new one.

## 2. Fleet/Vehicle routes (`server/routes.ts` — protected, Integrator-only)
- `GET /api/vehicles` — `:1700`
- `GET /api/vehicles/:id/customer-feedback-profile` — `:1709`
- `POST /api/vehicles` — `:1721` (permission `MANAGE_VEHICLES`, enforces tenant
  vehicle-limit via `storage.checkVehicleLimit`)
- `PUT /api/vehicles/:id` — `:1762` (permission `MANAGE_VEHICLES`)
- `DELETE /api/vehicles/:id` — `:1796` (permission `MANAGE_VEHICLES`)
- `GET /api/vehicles/available` — `:1806`
- `GET /api/reports/vehicle-performance` — `:6646` (permission `VIEW_REVENUE`)
- `POST /api/vehicles/:id/handover`, `POST /api/vehicles/:id/return`,
  `GET /api/vehicles/:id/handovers`, `GET /api/vehicle-handovers/:id` — **not in trunk
  yet**, exist in the unmerged `driver-vehicle-handover` worktree
  (`server/driver/handover/routes.ts:126,165,211,225`).

## 3. Add Vehicle form
- `client/src/components/fleet/vehicle-form.tsx`. Zod schema (`:16-25`): `make` (required,
  UI-labeled "Vehicle Name"), `model?`, `year?`, `registrationNumber?`, `vehicleType?`
  (enum), `ratePerDay?`, `ratePerKm?`, `status` (default `available`). Matches the user's
  screenshot exactly. No Rate-per-Hour field despite `pricePerHour` existing on the
  model — a pre-existing minor gap, not this initiative's problem to fix incidentally.
- Rendered as a `Dialog` inline inside `client/src/pages/dashboard.tsx`, case `"fleet"`
  (`:1007-1039`) — not a standalone routed page.

## 4. Vehicle Profile / Performance
- `client/src/pages/vehicle-performance.tsx` — monthly aggregate table (trips/km/revenue/
  expenses) hitting `GET /api/reports/vehicle-performance?month=`, routed via
  `dashboard.tsx:2214-2215`, sidebar entry `sidebar.tsx:40`.
- `client/src/components/fleet/vehicle-feedback-profile.tsx` — narrow feedback-only widget.
- **No standalone single-vehicle "Vehicle 360" detail page/route exists.** The Fleet list
  itself is the `"fleet"` inline dashboard case — no per-vehicle drill-down today. This is
  greenfield UI work for TASK-VEHICLE-360-UI-06.

## 5. Expense model — already vehicle-aware, extend don't duplicate
- Interface `server/models/index.ts:383-411`, schema `:849`.
- Fields: `tenantId`, `vehicleId` (**required already**), `category`
  (`maintenance|damage|tires|fuel|other` — narrow), `amount`, `date`, `description?`,
  `attachmentUrl?` (bare string, no managed upload/verification), `createdBy{userId,role}`,
  plus additive `bookingId?`, `driverId?`, `customerChargeable?`, `reimbursable?`,
  `approvalStatus?`, `approvedBy?`, `approvedAt?`.
- Routes: `GET/POST /api/expenses` (`:6865/6875`), `GET/PUT/DELETE /api/expenses/:id`
  (`:6916/6929/6990`), `POST /api/expenses/:id/approve|reject` (`:6960/6975`, gated by
  `APPROVE_EXPENSE`).
- **This initiative must extend `category`'s enum and add the fuel/CNG/EV transaction
  shape as new, additively-named fields or a companion collection — never a second
  Expense model.**

## 6. GPS/telemetry — trunk vs. unmerged work
- Trunk (`server/gps/**`) today only has **connection/device/vehicle-assignment
  management** — `server/gps/models/vehicleGpsAssignment.ts:1-47` links
  `vehicleId`↔`gpsDeviceId`↔`connectionId`, one active assignment per vehicle via partial
  unique index. **No telemetry ingestion, no live location/speed/ignition store, no
  live/history routes exist in trunk.**
- `server/gps/types.ts:58-84` defines `NormalizedTelemetryPoint` but nothing persists it
  in trunk.
- **In-flight, unmerged**: `gps-telemetry-ingestion` worktree has built
  `server/gps/telemetry/models/{telemetryPoint,vehicleLatestState}.ts` exposing per
  `gpsDeviceId`: `latitude/longitude/speedKph/headingDegrees/ignition/motion/engineOn/
  batteryLevel/movingStatus(+since)`. **No engine-hours field, no explicit idle-duration
  field** — idle time would need deriving from `movingStatus`/`movingStatusSince` deltas.
- **Directive for this initiative: the Vehicle 360 GPS tab consumes
  `GpsVehicleLatestState` once that work merges. Do not build a second ingestion path.**
  If engine-hours/idle-duration are required for the Maintenance engine's "whichever
  trigger fires first" rule, flag it as a gap for the GPS initiative, don't patch around it
  here.

## 7. Booking↔Vehicle / Vehicle↔Driver assignment
- `IBooking.vehicleId?`/`driverId?` — `server/models/index.ts:147-148` (both optional, per
  the flexible-fulfilment initiative).
- **No "current Vehicle-Driver assignment" concept exists beyond**: (a) the new
  `VehicleHandover` model (event-based, not a persistent roster field), and (b) GPS's
  `VehicleGpsAssignment` (device assignment, unrelated to driver). No `currentDriverId` on
  `IVehicle`.

## 8. Document/file storage precedent
- Only local-disk `multer` usage anywhere: `logoStorage`/`signatureStorage`
  (`routes.ts:306-384`, business branding assets) and one in-memory multer for a one-off
  WhatsApp PDF send (`:4441-4447`). **Nothing vehicle-specific with real file upload
  exists.** `Expense.attachmentUrl` is a bare unmanaged string. `IVendorVehicle`'s
  `rcExpiry`/`insuranceExpiry`/etc. are dates only, no attached file.
- **The only real architectural precedent is the (unmerged) driver Google Drive module**
  (`server/driver/documents/**`, worktree `driver-google-documents`) — Drive-for-bytes +
  Mongo-for-metadata, versioning (`IDriverDocumentVersion`), checksums, encryption
  (`security/documentEncryption.ts`), verification workflow, retention lifecycle.
  **Confirmed not directly reusable**: `DriverDocument.driverId` is a hard-required,
  driver-typed field (`models/driverDocument.ts:105`), and `documentType`'s enum
  (`types.ts:8-23`) is entirely driver-specific (driving_license, psv_badge, etc. — no
  RC/insurance/PUC/fitness/permit values). **Recommendation, followed in
  TASK-VEHICLE-COMPLIANCE-02: build a parallel `server/vehicle/documents/**` module on the
  identical architectural pattern** (same Drive OAuth/credential-encryption approach,
  ideally the *same* tenant-level Drive connection, just a new vehicle-typed metadata
  model) rather than trying to generalize the driver one.

## 9. Permissions (`server/middleware/permissions.ts`, 128 lines — protected file)
- `MANAGE_VEHICLES: 'manage_vehicles'` (`:51`) — flat, legacy-style, currently the only
  thing gating vehicle CRUD.
- `VENDOR_VEHICLE_CREATE`/`VENDOR_VEHICLE_EDIT` (`:92-93`) — vendor-side only.
- GPS's block (`:94-110`) already uses the newer dot-namespaced convention
  (`GPS_CONNECTION_VIEW`, `GPS_LIVE_VIEW`, etc.) — **this initiative's new permissions
  should follow that convention** (e.g. `vehicle.compliance.view/manage`,
  `vehicle.maintenance.view/manage`), proposed in each task's report, never added
  directly (protected file).

## 10. Protected files (confirmed, same as every prior batch this session)
`server/models/index.ts`, `server/routes.ts`, `server/middleware/permissions.ts`,
`client/src/App.tsx`, `client/src/components/layout/sidebar.tsx`,
`client/src/pages/dashboard.tsx` (already independently owned/modified by the original
UI-responsive batch's TASK-01 — no task in *this* initiative may edit it either),
`package.json`/`package-lock.json`, `.env`/`.env.example`. All Vehicle-360 tasks needing a
change to these propose it in their report; the Integrator applies it.

## 11. Tenant uniqueness on registration number
No unique or dedup index on `IVehicle.licensePlate` today (only index is
`{tenantId,status}`). `IVendorVehicle`'s `normalizedRegistrationNumber` +
`{tenantId,vendorId,normalizedRegistrationNumber}` unique-partial-index pattern
(`:3253-3256`) is the exact template to copy for owned-fleet vehicles (drop the `vendorId`
segment, scope purely by `tenantId`).

## Duplication check result (Section 25 of the dispatch requirement)

**`TASK-VEHICLE-HANDOVER-05` already exists and is already implemented** — Driver
Lifecycle batch, worktree `driver-vehicle-handover`, commit `aba9909`,
`server/driver/handover/**`: `VehicleHandover` collection (handover+return, atomic
concurrency guard via partial unique index, condition photos, odometer/fuel, free-text
removable-item entries, driver acceptance, damage/discrepancy flags). **Confirmed gaps in
that implementation** (not covered, still needed by this initiative): no fixed
inventory-item catalog (spare tyre/jack/toolkit tracked with purchase dates/warranty —
today's `removableItemInventory` is free-text per-event only), no breakdown workflow, no
accident/claim tracking, no challan tracking.

**Resolution applied in this batch's task split:** this batch does **not** create a new
`TASK-VEHICLE-HANDOVER-05`. The existing implementation is reused as-is. The 5th worker
slot is redirected to `TASK-VEHICLE-INCIDENTS-05` (Breakdown / Accident / Challan — the
genuinely unimplemented pieces), and the inventory-catalog gap (structured items with
purchase/warranty data, distinct from handover's free-text per-event checklist) is folded
into `TASK-VEHICLE-MAINTENANCE-03`'s scope as a new, additive `VehicleInventoryItem`
catalog that handover events can reference once merged — not a rebuild of handover itself.
