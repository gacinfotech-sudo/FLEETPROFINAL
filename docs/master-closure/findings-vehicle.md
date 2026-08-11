# Vehicle 360 Domain — Evidence Audit

Audit date: 2026-08-07. Read-only investigation. No servers started (Preview :5051 and
trunk :5050 were already running; only unauthenticated read-only `curl` checks were made,
no data written). No migrations run, no writes to shared MongoDB, no git state changed.

## Ancestry / integration facts (verified this session)

| Worktree | Branch | Commit | Merged into trunk (`booking/integration-preview` @ 20bd273)? | Merged into Preview (bdf4457)? |
|---|---|---|---|---|
| `vehicle-domain` | vehicle/domain-01-core | 3e879b8 (on top of 20bd273) | **NO** | **NO** |
| `vehicle-compliance` | vehicle/compliance-02-documents | 20bd273 + **uncommitted untracked** `server/vehicle/documents/types.ts` | **NO** (nothing to merge, not even committed) | **NO** |
| `driver-vehicle-handover` | driver/handover-05 | aba9909 | **NO** | **NO** |
| `gps-vehicle-mapping` | (GPS batch) | 0ce74ea | **NO** as a worktree, but its subject matter (`vehicleGpsAssignment`) has a **separate, earlier, already-integrated** foundation in trunk — see VEH-014 | — |
| `driver-operations` (adjacent) | driver/operations-06 | — | **NO** | **NO** |

`vehicle-maintenance`, `vehicle-fuel-expense`, `vehicle-incidents`, `vehicle-360-ui`,
`vehicle-qa` worktrees **do not exist at all** (`ls fleetpro-worktrees/` confirmed). Per
`.claude/tasks/active/VEHICLE-360-MANIFEST.md`, this batch was "SETUP PHASE ONLY" — Wave 1
(`TASK-VEHICLE-DOMAIN-01`) ran; Wave 2 only partially started (Compliance has an
uncommitted types-only stub, Maintenance/Fuel-Expense/Incidents never started); Wave 3
(the actual Vehicle 360 UI page) and Wave 4 (QA) never started. No task report exists for
any of Compliance/Maintenance/Fuel-Expense/Incidents/360-UI/QA in any `reports/` directory
searched.

## Architecture question answered: still Quick Add → Vehicle 360, but only half-built

`docs/vehicle-research/VEHICLE-360-SPEC.md` (already written, grounded) confirms the
intended split and explicitly states the **old flat form is kept, not replaced**, becoming
the Quick-Add step. The `vehicle-domain` worktree's commit 3e879b8 delivers exactly that:
`client/src/components/fleet/vehicle-form.tsx` was extended with 6 Recommended fields and
three save actions (Save Vehicle / Save Draft / Save & Complete Profile), verified by
reading the file directly (`vehicleSchema`, `draftSchema`, `VehicleSaveMode` type,
`handleSaveDraft`). **However this file is only extended in the isolated worktree — trunk's
copy of the same file (`grep -n "Save Draft" client/src/components/fleet/vehicle-form.tsx`
in `fleetpro-main`) has zero matches, i.e. trunk/Preview still serve the old flat 8-field
form with none of the three save modes.** The Vehicle 360 detail page itself
(`client/src/pages/vehicle-360.tsx`, `TASK-VEHICLE-360-UI-06`) was never built anywhere —
`find . -iname "*vehicle-360*"` across every worktree returns nothing. So today, on any
running instance, "Add Vehicle" is still the single flat form; there is no post-save
360 detail view for a user to land on at all.

## Old Vehicle model/field-mapping regression check (explicitly requested)

Trunk's `IVehicle`/`VehicleSchema` (`server/models/index.ts:71-88,474-499`) is unchanged
from before this batch: 3-value `status` enum, `licensePlate` (not `registrationNumber`),
no VIN/chassis/engine number/ownership/branch fields. The POST/PUT `/api/vehicles` route
handlers (`server/routes.ts:1721-1798`) already map `req.body.registrationNumber` →
`licensePlate` (`licensePlate: req.body.licensePlate || req.body.registrationNumber`), so
that specific old mapping is intact and not broken by anything in this batch (nothing in
this batch touched `server/routes.ts` or `server/models/index.ts` — both are
Integrator-only per the manifest, and `TASK-VEHICLE-DOMAIN-01`'s report explicitly confirms
it proposed, but did not apply, its `IVehicle` patch). The new Quick-Add fields the
`vehicle-domain` form now sends (`vehicleCategory`, `variant`, `ownershipType`,
`currentOdometer`, `branch`, `isDraft`) are **not present in `mongoVehicleSchema`**
(`server/schemas/mongodb-schemas.ts:44-65`, confirmed by reading it) — a plain (non-
`.strict()`) Zod object, so `.parse()` silently strips those keys before the data ever
reaches Mongoose. This matches the worker's own report, which flags it as a known,
intentional gap awaiting an Integrator-applied patch. Net effect: **if the vehicle-domain
worktree's form were deployed as-is against trunk's current backend, all new fields would
silently vanish on save** — not a crash, a silent data-loss gap.

## Table

| Requirement ID | Original Requirement | Current Implementation | Worktree | Commit | Integrated (trunk/Preview) | Live UI | API | DB | Tests | Status | Gap | Next Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VEH-001 | Quick Add Vehicle (minimal required fields, 3 save modes) | `vehicle-form.tsx` extended w/ Required (Reg No, Make, Model, Category) + Recommended fields + Save/Draft/Complete-Profile actions | vehicle-domain | 3e879b8 | NO — trunk/Preview still have old flat form, 0 matches for "Save Draft" | NO (not on any running instance) | Reuses existing `/api/vehicles` POST/PUT | Partial — new fields dropped by `mongoVehicleSchema` (see above) | Component not covered by e2e (only pure-fn tests) | 🟡 PARTIALLY_IMPLEMENTED | Not merged to trunk; even if merged, new fields silently dropped until schema patch applied | Integrator: merge worktree, apply `mongoVehicleSchema`/`IVehicle` patch together (not form-only) |
| VEH-002 | `IVehicle` core-data patch (VIN, chassis, engine no., ownership, branch, etc.) | Exact diff proposed in `TASK-VEHICLE-DOMAIN-01-report.md`, not applied | vehicle-domain | 3e879b8 (report only, no code touches protected file) | NO | NO | N/A (schema only) | NO (not applied to `server/models/index.ts`) | N/A | ❌ NOT_IMPLEMENTED | Patch exists as text only | Integrator applies patch, runs full regression before deploy |
| VEH-003 | 4 independent status dimensions + single `deriveBookingEligibility()` pure function | `server/vehicle/core/{types,bookingEligibility,registrationNumber,index}.ts` | vehicle-domain | 3e879b8 | NO | N/A (no UI consumes it yet) | N/A (pure functions, no route) | N/A | `tests/e2e/vehicle-domain-core.spec.ts` — 6/6 passed per worker report (not independently re-run this audit) | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | Not consumed by any route/UI; isolated in unmerged worktree | Merge, wire into booking-eligibility checks and Vehicle 360 status badges |
| VEH-004 | Old Vehicle form/model field mapping still correct after restructuring | `registrationNumber → licensePlate` mapping intact in trunk `routes.ts:1740/1772` | fleetpro-main (trunk) | 20bd273 | YES (already in trunk) | Old form only | `/api/vehicles` POST/PUT — 401 confirmed live | Existing `VehicleSchema`, unchanged | None targeted | ✅ VERIFIED_CODE | New Quick-Add fields not yet in `mongoVehicleSchema` (silently dropped, not broken) | Include in same Integrator patch as VEH-001/002 |
| VEH-005 | Vehicle 360 detail page, 18 tabs, Setup Checklist | Not built — `client/src/pages/vehicle-360.tsx` does not exist in any worktree | — (TASK-VEHICLE-360-UI-06 never started) | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Entire Wave 3 never began; depends on Wave 2 tasks below, most of which are also not done | Dispatch Wave 2 tasks to completion first, then Wave 3 |
| VEH-006 | Documents & Compliance registry (RC/Insurance/PUC/Fitness/Permit/etc.) | Only `server/vehicle/documents/types.ts` (104 lines of TS types, applicability-resolution types) — no model, no service, no route | vehicle-compliance | 20bd273 base, **uncommitted/untracked** | NO | NO | NO | NO (no Mongoose model) | NO | ❌ NOT_IMPLEMENTED | Types-only stub, not even committed to the worktree's own branch | Build `VehicleDocument` model + Drive-reuse upload flow + routes |
| VEH-007 | Maintenance engine (date/odometer/engine-hours triggers) | None found anywhere | — (worktree never created) | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Create `vehicle-maintenance` worktree, run TASK-VEHICLE-MAINTENANCE-03 |
| VEH-008 | Daily Inspections + SAFETY_HOLD flag | None found (`grep -rl "DailyInspection\|VehicleInspection"` empty repo-wide) | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started; `SAFETY_HOLD` type exists in VEH-003's types but nothing produces it | Same as VEH-007 |
| VEH-009 | Tyre lifecycle records | None found | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Same as VEH-007 |
| VEH-010 | Battery lifecycle records | None found | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Same as VEH-007 |
| VEH-011 | Fuel/CNG/EV transaction tracking | None found (`server/vehicle/expenses/**` never created) | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Create `vehicle-fuel-expense` worktree |
| VEH-012 | Vehicle expense tracking (general) | Already existed pre-batch: `IExpense` has required `vehicleId`, `category` enum incl. maintenance/damage/tires/fuel/other | fleetpro-main (trunk) | 20bd273 | YES | Existing Fleet/Expenses UI (not re-verified in this pass) | Existing `/api/expenses*` routes | `ExpenseSchema` (`server/models/index.ts:849+`), indexed by `{tenantId, vehicleId}` | Not targeted this pass | ✅ VERIFIED_CODE | Category list is coarse (no FASTag/CNG-specific line item) | Extend `category` enum per VEHICLE-EXPENSE-MATRIX.md when Fuel/FASTag tasks run |
| VEH-013 | FASTag/Toll provider-adapter tracking | None found (`grep -ri fastag` repo-wide, only doc mentions) | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Create `vehicle-fuel-expense` worktree (owns `server/vehicle/fastag/**` per manifest) |
| VEH-014 | GPS & Telematics linkage (vehicle↔device assignment) | `VehicleGpsAssignment` model + `registerGpsAssignmentRoutes` (assignment + assignment-history endpoints), separate/earlier foundation predating this batch | fleetpro-main (trunk) | 20bd273 (pre-existing, trunk commits `ae60cc9`/`64299f1`/`0863fbc`/`1accadd`) | YES | Not re-verified (no GPS UI check this pass) | `GET /api/vehicles/:id/gps-assignment` and `-history` — **live-curled this session: 401 on both trunk (:5050) and Preview (:5051), confirming route registration** | `VehicleGpsAssignmentSchema`, unique partial index on active assignment | Covered by GPS batch's own suite (see `findings-gps.md`) | ✅ VERIFIED_RUNTIME (route-registration level) | Underlying GPS provider registry is empty on trunk/Preview (`configuration_required`) — see `findings-gps.md` | None specific to Vehicle domain; cross-reference GPS findings |
| VEH-015 | Driver assignment history (per-vehicle) | None found — `currentDriverId` only proposed (VEH-002, unapplied), no `VehicleDriverAssignment`/history collection | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Only a denormalized-pointer proposal exists, no history model | Design + build as part of Maintenance/Incidents wave or a new task |
| VEH-016 | Bookings & Trips tab (per-vehicle) | Data relationship exists (`IBooking.vehicleId`) but no dedicated per-vehicle bookings/trips API or tab (`grep` for `/api/vehicles/:id/bookings` — no match) | fleetpro-main (trunk, partial) | 20bd273 | Partial (model only) | NO | NO (no scoped endpoint) | `IBooking.vehicleId` exists | N/A | 🟡 PARTIALLY_IMPLEMENTED | Spec says "no new booking model" but a scoped read endpoint still doesn't exist | Add `GET /api/vehicles/:id/bookings` as part of VEH-005 build-out |
| VEH-017 | Handover & Return (reused, not rebuilt) | Full `VehicleHandover` model, atomic concurrency guard (unique partial index + E11000 handling), handover/return services, staff + driver-portal routes, 6 new UI components | driver-vehicle-handover | aba9909 | **NO** — `grep -n "handover" server/routes.ts` in trunk returns 0 matches; not mounted | NO | NO (routes not mounted in trunk) | `VehicleHandover` Mongoose model, fully designed | Worker report claims own 3 new e2e spec files pass (`vehicle-handover-{concurrency,lifecycle,documents}.spec.ts`) — **REPORTED_BY_PIPELINE_ONLY, not independently re-run this audit** | 🟢 IMPLEMENTED_NEEDS_FINAL_TEST | Real, substantial implementation but entirely unreachable on trunk/Preview until merged | Integrator: merge `driver-vehicle-handover`, mount routes, re-run its own test suite independently |
| VEH-018 | Breakdown event records | None found (`server/vehicle/incidents/**` never created) | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Create `vehicle-incidents` worktree |
| VEH-019 | Accident event / claim records | None found | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started | Same as VEH-018 |
| VEH-020 | Challan (traffic violation) records — vehicle-scoped | Only a **driver**-scoped `DriverChallan` model exists (`server/driver/operations/challanService.ts`, optional `vehicleId` field) — different domain/worktree, not the Vehicle-360-spec's `server/vehicle/incidents/**` Challan | driver-operations (adjacent, not vehicle domain) | (driver/operations-06) | NO | NO | NO | `DriverChallan` model, driver-primary | Not checked | 🟡 PARTIALLY_IMPLEMENTED (wrong domain owner) | Vehicle-domain Challan not built; a driver-domain lookalike exists but isn't the spec'd tab | Reconcile at Integrator: either point Vehicle 360's Challan tab at `DriverChallan` (filtered by vehicleId) or build the dedicated `server/vehicle/incidents/**` version |
| VEH-021 | Insurance claims tracking | None found beyond the `insurance_third_party`/`insurance_comprehensive` **document types** in the uncommitted Compliance stub (VEH-006) — no claims workflow/model | vehicle-compliance (uncommitted) | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Only document-type enum values exist, no claims entity | Build as part of Incidents/Compliance wave |
| VEH-022 | Accessories & Inventory (structured catalog) | None found (`VehicleInventoryItem` never created); today only free-text `VehicleHandover.removableItemInventory` entries exist (VEH-017) | driver-vehicle-handover (free-text only) | aba9909 | NO | NO | NO | Free-text field only, no structured catalog | NO | ❌ NOT_IMPLEMENTED | Spec explicitly calls this gap out; not closed | Build `VehicleInventoryItem` as part of Maintenance wave |
| VEH-023 | Revenue & Profitability calculation | `buildVehiclePerformance()` — live computation from bookings+expenses, `netProfit`/`revenuePerKm`/`profitPerKm`, pre-dates this batch | fleetpro-main (trunk) | 20bd273 | YES | `client/src/pages/vehicle-performance.tsx` exists (not re-verified visually this pass) | `GET /api/reports/vehicle-performance` — **live-curled: 401 unauthenticated on trunk :5050, confirming route registration**, gated by `VIEW_REVENUE` permission | Computed live from `Booking`/`Expense`/`Vehicle`, no separate stored table (matches spec's "prefer computed" philosophy) | Not targeted this pass | ✅ VERIFIED_RUNTIME (route-registration level) | Not yet folded into a Vehicle 360 "Revenue" tab (still a standalone report page) | Wire into VEH-005's Revenue tab once built |
| VEH-024 | Timeline view (fan-out across all sub-areas) | Spec explicitly recommends the fan-out pattern (like Customer 360's `timelineService.ts`) but nothing built — no `VehicleTimelineEvent` or fan-out service found | — | — | NO | NO | NO | NO | NO | ❌ NOT_IMPLEMENTED | Not started; also has no real content to aggregate yet since most sub-areas (VEH-006 through -022) don't exist | Build last, after Wave 2/3 sub-areas exist to fan out from |

## Summary of confidence levels used

- **VERIFIED_RUNTIME**: live `curl` against a running trunk (:5050) / Preview (:5051)
  instance returned the expected `401` (proves route registration + auth gate; does not
  prove full functional correctness behind auth, since no authenticated calls were made
  per the read-only/no-data-writes constraint).
- **VERIFIED_CODE**: read directly in the relevant file, not exercised live this session.
- **REPORTED_BY_PIPELINE_ONLY**: a worker's own task report claims tests passed; not
  independently re-run in this audit.
- **NO_EVIDENCE / NOT_IMPLEMENTED**: exhaustive `find`/`grep` across `fleetpro-main`,
  every `fleetpro-worktrees/*`, and `fleetpro-customer360` found nothing.

## Key findings (prose summary)

1. **The Vehicle 360 batch is almost entirely unbuilt beyond its foundational task.** Of
   the 7-task manifest (`VEHICLE-360-MANIFEST.md`), only `TASK-VEHICLE-DOMAIN-01`
   (Quick-Add UX + pure status functions) was actually completed and committed.
   `TASK-VEHICLE-COMPLIANCE-02` has only an uncommitted 104-line types file; Maintenance,
   Fuel-Expense, Incidents, the Vehicle 360 UI page itself, and QA were never started —
   no worktrees exist for them at all. Of the 18 tabs the spec lists, roughly 13-14 have
   zero implementation anywhere in any worktree (Documents, Maintenance, Daily Inspections,
   Tyres, Battery, Fuel/CNG/EV, FASTag, Breakdowns, Accidents, vehicle-scoped Challans,
   Insurance Claims, structured Inventory, Timeline, Driver Assignment history).
2. **Nothing from this batch is merged into trunk or Preview.** `vehicle-domain`,
   `vehicle-compliance`, and `driver-vehicle-handover` (Handover & Return, reused per
   spec) all sit as isolated, unmerged commits. Trunk's live vehicle-form.tsx is still the
   unmodified old flat form; trunk's `IVehicle` model is unchanged.
3. **A real silent data-loss bug is queued up, not yet live.** The new Quick-Add form
   (unmerged) sends fields (`vehicleCategory`, `ownershipType`, `currentOdometer`, `branch`,
   `isDraft`) that trunk's `mongoVehicleSchema` Zod validator doesn't know about; because
   that schema isn't `.strict()`, those fields are silently dropped rather than rejected.
   This is flagged by the worker's own report as an open item, confirmed independently by
   reading `server/schemas/mongodb-schemas.ts` — if the form is merged before the schema
   patch, vehicle records will look like they saved successfully while quietly losing data.
4. **Two solid, real implementations exist but are stranded in unmerged worktrees**:
   `VehicleHandover` (handover/return, atomic concurrency guard, driver-portal
   acceptance flow — genuinely substantial) in `driver-vehicle-handover`, and the
   `server/vehicle/core` status/eligibility pure functions in `vehicle-domain`. Neither is
   reachable from a running server today (`grep -c handover server/routes.ts` in trunk is
   0).
5. **Two Vehicle 360 sub-areas were already real and live before this batch even started**:
   GPS↔Vehicle assignment (`VehicleGpsAssignment`, live-curled 401 on both trunk and
   Preview) and Revenue/Profitability (`buildVehiclePerformance`, live-curled 401 on
   trunk's `/api/reports/vehicle-performance`). These predate the Vehicle 360 initiative
   and should be treated as "already done, needs wiring into the new UI" rather than
   "needs building."
