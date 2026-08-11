# TASK-VEHICLE-HANDOVER-05 — Report

Worktree: `fleetpro-worktrees/driver-vehicle-handover`, branch `driver/handover-05`,
base `feature/local-network-access` @ `1da105b`.

## Summary

Implemented `VEHICLE-HANDOVER-SPEC.md` in full under `server/driver/handover/**` and
`client/src/components/handover/**`: a new `VehicleHandover` collection (handover+return
paired via `linkedReturnHandoverId`), condition photos routed through
`TASK-DRIVER-DOCUMENTS-03`'s document registry, an atomic-conditional-write concurrency
guard on handover creation (proven with real concurrent HTTP requests, not sequential
awaits), and exactly one new driver-portal-reachable route
(`POST /api/driver-portal/handovers/:id/accept`), explicitly coordinated against
`TASK-DRIVER-QA-SECURITY-07`'s allow-list.

Zero edits to `server/models/index.ts`, `server/routes.ts`, or
`server/middleware/driverAuth.ts` — confirmed via `git diff --stat` on those three paths
(empty). All three were patched **locally and temporarily** to exercise the new code
end-to-end (same verify-then-revert pattern `TASK-DRIVER-DOMAIN-02` and
`TASK-DRIVER-DOCUMENTS-03` used), then reverted with `git checkout -- server/routes.ts`
before committing.

## Real cross-task dependency, and how it was handled

This task genuinely depends on code from `TASK-DRIVER-DOMAIN-02`
(`isEligibleForAssignment`) and `TASK-DRIVER-DOCUMENTS-03` (`uploadDriverDocument` and the
Drive-connection resolution chain) that is not merged to this branch's base. Neither
module exists in this worktree's committed history. To develop and test against them
honestly, their committed-but-unmerged branches
(`driver/domain-02-lifecycle`, `driver/documents-03-google-drive`) were copied
**temporarily and locally** into `server/driver/domain/` and `server/driver/documents/`
in this worktree (never committed — removed with `rm -rf` before the final commit,
confirmed via `git status`). `server/driver/handover/**`'s production code imports from
`../domain/eligibility` and `../documents/services/*` exactly as it will once all three
branches are merged; with the dependency modules absent (their current state on this
branch), `npx tsc --noEmit` correctly fails with 5 "Cannot find module" errors on exactly
those two dependency paths — this is expected and matches the same "cannot compile
standalone, verified compiling with dependencies present" situation `TASK-DRIVER-DOMAIN-02`
flagged in its own report about `TASK-DRIVER-DOCUMENTS-03`. **With the dependency modules
present** (as they were throughout development and the final test run below),
`npx tsc --noEmit` is clean (0 errors) and all tests pass.

## New files (all under `server/driver/handover/`)

| File | Purpose |
|---|---|
| `types.ts` | `HandoverDirection`/`HandoverStatus` enums, `RemovableItemInventoryEntry`, `ConditionPhotoRef`, `DiscrepancyFlag`, `ODOMETER_DISCREPANCY_THRESHOLD_KM` |
| `models.ts` | `VehicleHandover` Mongoose model — the unique partial index that makes concurrency correctness a DB-level guarantee (see below) |
| `handoverService.ts` | `createHandover()` (atomic-conditional-write), `acceptHandoverAsDriver()`, `listPendingHandoversForDriver()`, lookups |
| `returnService.ts` | `createReturn()` (atomic claim-and-close of the open handover), `computeDiscrepancyFlags()` (pure, independently testable) |
| `documentIntegration.ts` | Routes condition photos through Documents-03's `uploadDriverDocument()` |
| `serialization.ts` | `publicVehicleHandover()` (staff view), `driverPortalHandoverSummary()` (driver-portal view) |
| `routes.ts` | Staff routes: `POST/GET /api/vehicles/:id/handover`, `POST /api/vehicles/:id/return`, `GET /api/vehicles/:id/handovers`, `GET /api/vehicle-handovers/:id` |
| `driverPortalRoutes.ts` | `acceptHandoverHandler` (the one new driver-portal route's handler) + `getPendingHandoversForDriverPortal` (for the `/me` response addition) |
| `index.ts` | Barrel + `registerVehicleHandoverRoutes(app)` |

New client files under `client/src/components/handover/`: `types.ts`,
`DriverHandoverAcceptance.tsx` (embedded in driver-portal.tsx), `HandoverDialog.tsx`,
`ReturnDialog.tsx`, `RemovableItemInventoryEditor.tsx`, `index.ts`.

New test files: `tests/e2e/vehicle-handover-concurrency.spec.ts`,
`tests/e2e/vehicle-handover-lifecycle.spec.ts`, `tests/e2e/vehicle-handover-documents.spec.ts`,
`tests/e2e/helpers/vehicle-handover-fixtures.ts` (new helper file, this task's own —
mirrors `TASK-DRIVER-QA-SECURITY-07`'s `tests/e2e/helpers/driver-fixtures.ts` precedent of
a new file alongside the shared `tests/e2e/helpers.ts`, which is untouched).

## Design decisions

**Concurrency — atomic conditional write, not check-then-write.** `VehicleHandoverSchema`
has a unique partial index: `{ tenantId: 1, vehicleId: 1 }` unique,
`partialFilterExpression: { isOpenForVehicle: true }`. `createHandover()` does a friendly
pre-check (nicer error message in the common case) but the actual correctness guarantee is
a single `VehicleHandover.create()` call — if two requests race, MongoDB's index
constraint allows exactly one insert to succeed; the loser gets a real `E11000`
duplicate-key error, caught and translated to `409 HANDOVER_CONFLICT`. This is one atomic
DB operation, not an application-level check-then-write race. `createReturn()` similarly
uses a single `findOneAndUpdate({ isOpenForVehicle: true }, { $unset, $set })` to
atomically "claim" the open handover before creating the return record, so two concurrent
returns against the same handover can't both succeed either (a pre-generated `ObjectId`
links the claim to the not-yet-created return record).

**Condition photos via Documents-03's registry, `documentType: 'other'`, not
`vehicle_handover_acknowledgement`.** Documents-03's own report suggested
`vehicle_handover_acknowledgement`, but `uploadDriverDocument()` forces `label: ''` for
every `documentType` except `'other'` (`documentService.ts`), and its
`(tenantId, driverId, documentType, label)` uniqueness means every handover for the same
driver would version-collapse into ONE evolving record under that type — the opposite of
"tagged to the handover, not the driver's persistent document set." `'other'` is the only
type that accepts a caller-supplied `label`, so each photo gets
`label: "handover:<handoverId>:<angle>:<index>"`, giving every handover's photos their own
distinct `DriverDocument` records while still going through the exact same registry,
encryption, versioning, and audit-log machinery. `accessClassification` for `'other'` is
`'medium'` (from `DOCUMENT_TYPE_ACCESS_CLASSIFICATION`) — never public, never
unclassified. Verified in `vehicle-handover-documents.spec.ts` (service-level, stubbed
Drive client — no real Drive credentials exist in this sandbox, same testing approach
Documents-03's own suite uses).

**Return status reuses the spec's own 3-value enum.** A flagged return sets
`status: 'disputed'` (the spec's own value) rather than inventing a fourth status —
"flagged/pending-review" and "disputed" are the same shape (a human needs to look at it),
and `isOpenForVehicle` (not `status`) is what actually governs vehicle availability, so a
`'disputed'` return still fully closes out the vehicle's open slot.

**No financial deduction, ever, from this module.** `server/driver/handover/**` contains
no import of any invoice/ledger service and never writes to
`Booking.advanceReceived`/`totalAmount` — grep-verified
(`grep -rn "invoice\|ledger\|deduction" server/driver/handover/` returns nothing). A
flagged return creates `flags: DiscrepancyFlag[]` on the record only.

**No `Vehicle` schema change.** Odometer/fuel live only on `VehicleHandover` records, per
the spec's explicit rationale (no second odometer source of truth alongside
`Booking.startOdometer`/`endOdometer`). Confirmed via `git diff --stat server/models/index.ts`
— empty.

## Proposed patches (NOT applied — for the Integrator)

### `server/routes.ts`

**1. Mount this module's staff routes** (same pattern as GPS/Domain-02/Documents-03):
```diff
 import { registerGpsConnectionRoutes } from "./gps/routes/connections";
 import { registerGpsDeviceRoutes } from "./gps/routes/devices";
 import { registerGpsAssignmentRoutes } from "./gps/routes/assignments";
+import { registerVehicleHandoverRoutes } from "./driver/handover/index";
+import { acceptHandoverHandler, getPendingHandoversForDriverPortal } from "./driver/handover/driverPortalRoutes";
```
```diff
   registerGpsConnectionRoutes(app);
   registerGpsDeviceRoutes(app);
   registerGpsAssignmentRoutes(app);
+  registerVehicleHandoverRoutes(app);
```

**2. The one new driver-portal route — registered inline**, not from a sub-module, so it
stays textually visible in `server/routes.ts` next to the existing 4 driver-portal routes
(same style, same file, same block) rather than hidden inside `server/driver/handover/**`:
```diff
     res.json({ dutyAcceptedAt: booking.dutyAcceptedAt });
     } catch (error: any) {
       console.error('Accept duty error:', error?.message || error);
       res.status(500).json({ message: "Failed to accept duty" });
     }
   });
+
+  // TASK-VEHICLE-HANDOVER-05 — the ONE new driver-portal-reachable route
+  // this task adds.
+  app.post("/api/driver-portal/handovers/:id/accept", authenticateDriver, acceptHandoverHandler);
```

**3. `GET /api/driver-portal/me` — response-body addition only, NOT a new route** (so this
task's allow-list footprint is exactly the one row above, matching
`TASK-DRIVER-QA-SECURITY-07`'s own Wave-1 expectation: "expect exactly one new row"):
```diff
   app.get("/api/driver-portal/me", authenticateDriver, async (req: DriverAuthRequest, res) => {
-    res.json({ id: req.driver._id, name: req.driver.name, phone: req.driver.phone, status: req.driver.status });
+    const pendingHandovers = await getPendingHandoversForDriverPortal(String(req.driver.tenantId), req.driverId!);
+    res.json({ id: req.driver._id, name: req.driver.name, phone: req.driver.phone, status: req.driver.status, pendingHandovers });
   });
```

### `server/middleware/driverAuth.ts`

**No patch proposed or needed.** The new route imports `authenticateDriver` from this file
unmodified — it does not need to change for this task's route to exist. Read in full
before adding anything (per the task's instruction); its own design comment already states
"this middleware only ever grants access to the small, explicit set of
`/api/driver-portal/*` routes" and "no route checks BOTH `authenticateUser` and
`authenticateDriver`" — the new route (`authenticateDriver` only, on its own line, no other
staff middleware) satisfies both invariants without any change to this file.

### `server/models/index.ts`

**No patch proposed or needed.** `VehicleHandover` is self-contained in
`server/driver/handover/models.ts`, same as GPS's models live under `server/gps/models/**`
and Documents-03's under `server/driver/documents/models/**` rather than the shared index.
No `Vehicle`/`Booking` field additions, per the spec's explicit "no second odometer source
of truth" rationale.

## Driver-portal allow-list — exact scope and coordination with QA-Security-07

`TASK-DRIVER-QA-SECURITY-07`'s Wave-1 report documents the exhaustive allow-list as of its
pass (4 routes: `POST /api/driver-auth/logout`, `GET /api/driver-portal/me`,
`GET /api/driver-portal/my-duties`, `POST /api/driver-portal/bookings/:id/accept-duty`) and
explicitly flags: *"The driver-portal allow-list above is the artifact
TASK-VEHICLE-HANDOVER-05 ... will need diffed against in Wave 3 — expect exactly one new
row."*

This task adds **exactly one row**: `POST /api/driver-portal/handovers/:id/accept`.

- It is registered with `authenticateDriver` and nothing else — no route in this codebase
  checks both `authenticateUser` and `authenticateDriver` (confirmed: `grep -n
  "authenticateUser.*authenticateDriver\|authenticateDriver.*authenticateUser"
  server/routes.ts` returns nothing, before and after this task's proposed patch).
- `GET /api/driver-portal/me`'s response body gained a `pendingHandovers` field, but its
  route registration (`app.get("/api/driver-portal/me", authenticateDriver, ...)`) is
  byte-for-byte unchanged — it is not a new row in the allow-list, only a data addition to
  an already-allow-listed route.
- Ownership is verified from the session (`req.driverId`), never a client-supplied value:
  `acceptHandoverAsDriver()` queries
  `VehicleHandover.findOne({ _id, tenantId: req.driver.tenantId, driverId: req.driverId })`
  — a handover belonging to a different driver 404s (not 403, so existence isn't leaked to
  a driver who shouldn't see it — same defensive-404 convention Documents-03 uses).
- No `server/driver/handover/**` staff route (`/api/vehicles/:id/handover`,
  `/api/vehicles/:id/return`, `/api/vehicles/:id/handovers`, `/api/vehicle-handovers/:id`)
  uses `authenticateDriver` — all four use `authenticateUser, requireTenant,
  requirePermission(PERMISSIONS.MANAGE_VEHICLES)`, verified by direct HTTP testing (see
  below): a driver-portal session gets `401` on every one of them.

**Verified live** (`vehicle-handover-lifecycle.spec.ts`'s first test):
- A staff session gets `401` on the new driver-portal accept route (no `driverSessionId`).
- A driver session gets `401` on `GET /api/vehicles/:id/handovers` and `GET /api/vehicles`.
- A driver session belonging to a *different* driver than the handover's `driverId` gets
  `404` attempting to accept it.
- A driver session's own `GET /api/driver-portal/me` correctly surfaces the pending
  handover via the new `pendingHandovers` field, and the accept call succeeds and flips
  `status` to `accepted`.

## Concurrency-test methodology and results

**Methodology.** Real HTTP `POST` requests fired together via `Promise.all` (not
`await`ed sequentially) against the real running dev server and real MongoDB — mirrors
`tests/e2e/pipeline-audit-idempotency-repairs.spec.ts`'s exact pattern (two/five
concurrent `page.request.post(...)` calls in one `Promise.all`). Two tests:
1. 2 concurrent handover-creation requests for the same vehicle, from **two independent,
   already-authenticated sessions** — exactly one `201`, one `409 HANDOVER_CONFLICT`;
   confirmed by re-querying the vehicle's handover history and asserting exactly 1 record
   has `isOpenForVehicle: true` (not 0, not 2).
2. A burst of **5** concurrent handover-creation requests for the same vehicle, 5
   independent sessions — exactly 1 `201`, 4 `409`; same DB-level re-verification.

**Why independent sessions, not one shared session issuing 2/5 concurrent requests** (a
real, root-caused finding, not a stylistic choice): `server/routes.ts`'s
`POST /api/auth/login` is deliberately single-session-per-user (comment: *"PWA-friendly
session management — allow longer sessions but prevent concurrent logins"* — it overwrites
`User.sessionId` on every login). This sandbox also runs ~20-50 concurrent, unrelated
dev-server/Playwright processes from other parallel worktree initiatives, all pointed at
the same local MongoDB, most authenticating as the same shared `qaclient` fixture — so a
login from any of them can invalidate any other `qaclient` session at any moment. This was
root-caused, not assumed: `tests/e2e/driver-overlap.spec.ts` (pre-existing, **completely
unmodified by this task**) was run against a **pristine `server/routes.ts`** (temporarily
`git stash`ed away every line this task ever added, confirmed via `git diff --stat`) and
still failed non-deterministically (3/4 tests failing, a different test failing each of
three separate runs) — conclusive proof this flakiness is a pre-existing environmental
condition of this shared sandbox, not something this task's code introduced.

The fix: `tests/e2e/helpers/vehicle-handover-fixtures.ts` seeds a dedicated Tenant + N
`'client'`-role Users (bypass-all-permissions, one Mongo document per session — no
per-account contention with any other suite) + one Vehicle + one Driver, directly via
Mongoose (idempotent find-or-create, same precedent `TASK-DRIVER-DOMAIN-02`'s
`ddtest_executive` and `TASK-DRIVER-QA-SECURITY-07`'s `driver-fixtures.ts` both already
established). Each session logs in **once**, sequentially (distinct accounts, so no
self-collision), then the actual burst is fired against those already-established
sessions — the concurrency under test is the vehicle-handover write, not the login
mechanism.

**Results** (against the real dev server, `PORT=5073`, real MongoDB):
```
$ npx tsc --noEmit
(0 errors, with dependency modules present)

$ PLAYWRIGHT_BASE_URL=http://127.0.0.1:5073 MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro \
  DRIVER_DOCUMENT_ENCRYPTION_KEY=<...> \
  npx playwright test tests/e2e/vehicle-handover-*.spec.ts tests/e2e/driver-overlap.spec.ts --reporter=list

  ✓ vehicle-handover-concurrency.spec.ts (2/2)
  ✓ vehicle-handover-documents.spec.ts (1/1)
  ✓ vehicle-handover-lifecycle.spec.ts (4/4)
  ✘ driver-overlap.spec.ts (1/4 in this run; varies 1-4/4 across reruns)

  8 passed, 3 failed (11 total)
```
All 7 of this task's own tests passed in every one of 3 separate full reruns performed
during development. `driver-overlap.spec.ts` (not owned by this task, not modified by it)
failed a *different* subset of its 4 tests in each of 4 separate runs (including the
pristine-`routes.ts` control run) — consistent with the environmental root cause above,
not a regression. **No change in this task touches booking creation, driver availability,
login, or session logic** (`server/driver/handover/**` has zero imports from
`server/services/availability.ts`, `storage-mongodb.ts`'s session methods, or
`server/routes.ts`'s booking routes) — there is no code path by which this task's changes
could affect that suite's outcome.

## Acceptance criteria — status

- **Two concurrent handover attempts, exactly one succeeds, real concurrent-request test**:
  done, see above (2-way and 5-way bursts, both passing reliably).
- **A return with a missing item / large odometer discrepancy creates a flagged record,
  does not block the return**: done — `vehicle-handover-lifecycle.spec.ts`'s second test
  sends a return with a missing item, a newly-damaged item, an odometer delta wildly
  exceeding `expectedTripDistanceKm`, and explicit damage text; asserts `201` (not
  4xx/5xx), `status: 'disputed'`, all 4 flag types present, no `deductionAmount`/`charge`
  field anywhere in the response, and that the vehicle's slot is immediately available for
  a brand-new handover.
- **The new driver-portal route is reachable only with a driver session, and no other new
  route was accidentally left reachable**: verified live (see above) — this task adds
  exactly one `authenticateDriver` route registration, zero new `authenticateUser` routes
  use `authenticateDriver`, and vice versa.
- **Condition photos route through the document registry with an appropriate
  `accessClassification`**: verified — `'other'` documentType, `accessClassification:
  'medium'` (never public/unclassified), each handover's photos are distinct
  `DriverDocument` records (not silently version-collapsed across handovers).

## Notes for the Integrator / downstream tasks

- This task's `server/driver/handover/**` hard-depends on
  `TASK-DRIVER-DOMAIN-02`'s `isEligibleForAssignment` and `TASK-DRIVER-DOCUMENTS-03`'s
  `uploadDriverDocument`/Drive-connection chain being merged first (or at least present)
  for `npx tsc --noEmit` to pass — this is the Wave 1 → Wave 2 ordering the manifest
  already specifies, not a new constraint.
- `TASK-DRIVER-OPERATIONS-06`'s "damage/shortage history"/incident-tracking territory can
  read `VehicleHandover.flags` (exported via `server/driver/handover/index.ts`) as its
  source for handover-originated incidents, rather than this module writing to
  Operations-06's incident collection directly (kept as a read-only integration point,
  matching the pattern Documents-03 used for `setRetentionHoldForDriver`).
- `client/src/components/handover/HandoverDialog.tsx`/`ReturnDialog.tsx` (staff-facing) are
  built and self-contained but **not wired into any existing staff page** (e.g. a vehicle
  management view) — no such page is in this task's ownership or its
  driver-portal.tsx-only hard-scope exception. Wiring them in is a follow-up integration
  decision for whichever task/Integrator owns that page.
- Two `driver-overlap.spec.ts` failure screenshots/traces from this session's runs are
  available under `test-results/` in this worktree if the Integrator wants to inspect the
  environmental-flakiness evidence directly.

## Dev server / environment notes

- `PORT=5073` (`.env`), `HOST=127.0.0.1` (`0.0.0.0` fails to bind in this sandbox).
- Dev server started/stopped by exact PID only (`kill <pid>` / `lsof -ti:5073 | xargs
  kill`), never a broad `pkill`, per the parallel-dispatch safety rule.
- `node_modules` symlinked to `fleetpro-main-p0-fixed/fleetpro-main/node_modules`.
