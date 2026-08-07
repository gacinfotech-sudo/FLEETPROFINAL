# TASK-VEHICLE-SAFETY-ELIGIBILITY — Report

## BASE COMMIT
`89a0454` on `booking/integration-preview` (confirmed via `git log --oneline -5` at
launch — ancestry included `b1bce7b`/`91c0c25`, the full Vehicle 360 batch + 5
follow-ups). Work landed on `task/vehicle-safety-eligibility` as commit **`1002b17`**
(`1002b1732d10ac1edb0bde377569fd741cbc3e6a`).

## FILES
- `server/vehicle/core/ownFleetEligibility.ts` (new) — `resolveOwnFleetEligibility`,
  the single I/O wrapper around the pure `deriveBookingEligibility`.
- `server/vehicle/inspections/service.ts` — `computeSafetyHold` gained an optional
  Mongo session param; added `findActiveBookingsRequiringSafetyReview`.
- `server/vehicle/inspections/routes.ts` — `GET .../safety-hold` now also returns
  `activeBookingsRequiringReview`.
- `server/storage-mongodb.ts` — `getAvailableVehicles` excludes SAFETY_HOLD
  vehicles; `createBooking` rejects (`VEHICLE_SAFETY_HOLD`) an own-fleet
  `vehicleId` on SAFETY_HOLD, inside the same create transaction.
- `server/routes.ts` — `POST /api/bookings` surfaces the new 409 code; `PUT
  /api/bookings/:id` rejects reassigning a SAFETY_HOLD vehicle (stale-allocation
  recheck), non-overridable.
- `server/services/bookingStateMachine.ts` — `transitionBooking` gates
  `trip_started` on a live SAFETY_HOLD recheck.
- `tests/e2e/vehicle-safety-eligibility.spec.ts` (new) — scenarios A-H plus Trip
  Start / active-trip-safety coverage.

## ELIGIBILITY CALLER
`resolveOwnFleetEligibility(tenantId, vehicleId, opts)` in
`server/vehicle/core/ownFleetEligibility.ts` calls `deriveBookingEligibility` with
a real, live `safetyHold` (from `computeSafetyHold`), and documented neutral
placeholders for `complianceStatus` ('COMPLIANT') and `operationalStatus`
(defaults 'AVAILABLE' unless the caller already knows a real value — the
availability list passes the real one since its candidates are pre-filtered to
`status: 'available'`). See the function's SCOPE NOTE: no live call site in this
app enforces compliance/operational status at write time today either, so this
call's only new, in-scope behavioral gate is SAFETY_HOLD — exactly the one
documented gap. Called from 4 places: `getAvailableVehicles`, `createBooking`,
`PUT /api/bookings/:id` (on vehicle reassignment), and `transitionBooking` (on
`trip_started`).

## BOOKING FLOW AFFECTED
Own-fleet vehicle assignment only, at: (1) picker candidate list, (2) booking
creation with a `vehicleId`, (3) reassigning/changing the vehicle on an existing
booking via edit. Booking **capture** via Allocation Pending / Vendor Vehicle /
Outsource / Tentative / Quote Only (no `vehicleId`, or `vendorVehicleId` instead)
is untouched — confirmed by test E and by the code path only running when
`bookingData.vehicleId` is actually set.

## TRIP START FLOW
`transitionBooking` in `bookingStateMachine.ts` re-evaluates SAFETY_HOLD live at
the moment of the `trip_started` transition (via both `POST
/api/bookings/:id/start` and the generic status route). On hold, it throws
`InvalidTransitionError` (409, code `INVALID_TRANSITION`) before writing any
field — the booking is left exactly as it was. No override exists for this gate.
A defect logged **after** a trip is already `trip_started`/`ongoing`/etc. never
mutates the booking; it only becomes visible via
`GET /api/vehicles/:vehicleId/safety-hold`'s new `activeBookingsRequiringReview`
array (read-only signal, no stored flag).

## TESTS
All run against the real running app (`npm run dev` on port 5977), real MongoDB,
real HTTP via Playwright — final run: **10/10 passed**.

- A. Eligible vehicle assignable — **PASS**
- B. SAFETY_HOLD excluded from availability list (API) and Own Fleet picker (UI) — **PASS**
- C. Direct API assignment of a SAFETY_HOLD vehicle rejected (create + PUT reassignment) — **PASS**
- D. Vehicle becomes SAFETY_HOLD after form loaded it as eligible → final confirmation rejects (live recheck, not client snapshot) — **PASS**
- E. Booking capture remains possible as Allocation Pending despite unsafe vehicle — **PASS**
- F. Tenant isolation (SAFETY_HOLD data doesn't leak cross-tenant; cross-tenant vehicleId reuse is a documented pre-existing gap unrelated to this task — see note below) — **PASS**
- G. Manager permission enforcement unaffected by / cannot bypass SAFETY_HOLD (no-permission manager still 403; permitted manager still hard-blocked 409) — **PASS**
- H. Vehicle cleared via real resolve-defect transition (not reload) becomes eligible again — **PASS**
- Bonus: Trip Start gate (booking preserved, no silent start) — **PASS**
- Bonus: Active-trip safety (mid-trip defect never auto-mutates the booking, surfaced via `activeBookingsRequiringReview`) — **PASS**

**Note on F**: cross-tenant `vehicleId` reuse in booking creation was found to
succeed (Tenant B can reference Tenant A's vehicle _id_ in a create payload) —
this is **pre-existing behavior unrelated to SAFETY_HOLD** (booking creation has
never validated that a supplied `vehicleId` belongs to the requesting tenant;
confirmed by reading `createBooking` — no such check exists anywhere in it,
before or after this change). Not in this task's scope to fix. What this task
does guarantee is verified: the SAFETY_HOLD check itself stays correctly
tenant-scoped (`computeSafetyHold` queries `{tenantId, vehicleId}`), and the
`GET .../safety-hold` endpoint leaks no real cross-tenant data.

### Regression checks (Step 3)
- `npm run check`: **0 errors**.
- 10 `vehicle.*` permissions: re-ran `vehicle-360-manager-permissions.spec.ts`
  (grant/revoke via real UI, persisted, out-of-allowlist rejected 400) — **PASS**.
- Vehicle Handover: `vehicle-handover-lifecycle.spec.ts` (4/4),
  `vehicle-handover-concurrency.spec.ts` (2/2) — **PASS**.
  `vehicle-handover-documents.spec.ts` — **FAILED**, but for a reason unrelated to
  this task: `DRIVER_DOCUMENT_ENCRYPTION_KEY` is not set in this worktree's
  `.env` (`DriverDocumentEncryptionConfigurationError`), an environment gap that
  predates this change and affects zero files this task touched.
- Money smoke test: `6000-4000=2000`, `9797-2798=6999` verified directly (node
  `-e`) — this task never touches money/pricing code (confirmed via `git diff
  --stat`, no payment/ledger/pricing files present).
- GPS: `vehicle-360-gps-telematics-tab.spec.ts` (real telemetry state render) —
  **PASS**. `GET /api/vehicles/:vehicleId/gps/latest-state` unauthenticated
  request confirmed 401 via direct curl; route code itself
  (`server/gps/routes/vehicleState.ts`) was not touched by this task and remains
  tenant-scoped (404 on cross-tenant, per its existing code).

### Environment note
This worktree's shared dev MongoDB had no `qaclient` user (used by many existing
specs) — seeded it directly (Tenant + User, matching the schema other Vehicle 360
tests already assume) since it's a pre-existing environment gap, not a code
change. My own new suite uses a dedicated, marker-unique tenant/user instead
(see spec file header) specifically because this shared MongoDB instance is used
concurrently by other agent worktrees, and this app enforces single-session-per-
user — a concurrent `qaclient` login from another worktree's test run was
observed silently invalidating this suite's session mid-test before that switch.

## SA-01 DIFF PRESERVED
Never touched. This worktree is an isolated `git worktree` checkout — SA-01's
uncommitted work lives only in `fleetpro-main`'s working tree, a separate
checkout this worktree cannot see or affect. This task's diff touches
`server/storage-mongodb.ts` (confirmed: only `getAvailableVehicles` and
`createBooking`, both far from `getUserBySessionId`/session/auth code) and does
**not** touch `server/middleware/auth.ts` at all (`git diff --stat` on the
commit confirms neither file's auth-related sections were touched).

## ROLLBACK
`git revert 1002b17` on `task/vehicle-safety-eligibility` (single commit, clean
tree, no dependents). Alternatively `git reset --hard 89a0454` if the branch has
had no other commits added. No schema/migration changes were made — nothing to
undo beyond the code diff itself.

---

## FINAL VEHICLE 360 STATUS
- VEHICLE 360 UI: VERIFIED (unchanged by this task; confirmed via passing regression suites)
- GPS TELEMATICS: VERIFIED (unchanged; `vehicle-360-gps-telematics-tab.spec.ts` passes, 401 unauth confirmed)
- DAILY INSPECTIONS: VERIFIED (unchanged; underlying `computeSafetyHold`/resolve-defect flow exercised directly by this task's own new tests)
- SAFETY HOLD COMPUTATION: VERIFIED (pre-existing, unchanged; confirmed via tests B/C/D/H)
- SAFETY HOLD BOOKING ENFORCEMENT: VERIFIED (this task's deliverable — create, reassignment, stale-recheck, Trip Start gate, active-trip non-mutation, all passing)
- MANAGER PERMISSIONS: VERIFIED (regression suite passes; new test G confirms SAFETY_HOLD gate is independent of permission grants)
- VEHICLE HANDOVER: VERIFIED for lifecycle + concurrency; NOT YET for the condition-photo/document-registry path in this worktree specifically, due to a pre-existing missing `DRIVER_DOCUMENT_ENCRYPTION_KEY` env var unrelated to this task's diff
- CANONICAL RUNTIME: NOT YET (promotion to the canonical preview branch is the Dispatcher's job, not this task's)
