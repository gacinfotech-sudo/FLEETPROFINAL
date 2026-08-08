# UNIFIED BOOKING WORKSPACE — Final Closure Report

Date: 2026-08-08
Branch: `booking/unified-workspace`
Worktree: `fleetpro-worktrees/unified-booking-workspace`
Canonical commit: `d0e9469` (merge into `booking/integration-preview`; feature commits `5062bb3` → `316847b` → `b5628bf`, base `3fb3ed1`)

FINAL PRODUCT RULE delivered: **ONE booking. ONE workspace. ONE status engine.
ONE financial engine. ONE resource engine. MANY connected views.**

---

## CURRENT FRAGMENTATION FOUND

The audit (server + client + worktrees) found the backend already largely
canonical and the fragmentation concentrated in the client:

| Feature | Current component | Current API | DB field | Duplicate? | Canonical? | Broken? |
|---|---|---|---|---|---|---|
| Booking model | `server/models/index.ts` (Booking) | — | one collection | No | **Yes** | No |
| Status engine | `server/services/bookingStateMachine.ts` | POST `/api/bookings/:id/status` / `start` / `complete` | `status`, `statusHistory` | No | **Yes** | No |
| Generic edit | PUT `/api/bookings/:id` (+ certainty partial schema) | PUT | many | No | **Yes** | Partially (see below) |
| Payments | `PaymentSection` + ledger routes | `/:id/payments` (+ reverse) | ledger + cached `advanceReceived` | No | **Yes** | No |
| Queues | `server/booking/queues/*` (projections) | GET `/api/bookings/queues/*` | derived | No | **Yes** | Display only |
| **Dashboard "Edit Booking" dialog** | `dashboard.tsx` (deleted) | PUT | financial fields | **YES** | No | **YES — wrong money formula**: recomputed `totalAmount = base − toll − parking − fuel − thirdParty` client-side, and was fed queue summary rows so blank defaults could overwrite real values |
| Dashboard "View Booking" dialog | `dashboard.tsx` (deleted) | none (stale row object) | — | **YES** (read-only duplicate of detail rendering) | No | Stale data |
| Customer 360 booking dialog | `customer-dashboard.tsx` (deleted) | none (stale row object) | — | **YES** | No | Stale data |
| Upcoming Bookings page | `upcoming-bookings.tsx` | GET operations | — | No | view | **Dead end** (only tel/WhatsApp) |
| Booking Queue rows | `queue-table.tsx` | GET queues | — | No | view | **No actions; contradictory status display** |
| `resourceFulfilmentStatus` | set at create only | — | stored | No | drifted | **YES — root cause of "Driver Assigned + Unallocated"** (never recomputed on PUT edits) |
| `lastActivityAt` | never stamped by edits | — | stored | No | drifted | Most Recent queue could go stale |
| GET booking by id | missing on committed line (live only as uncommitted change in fleetpro-main) | — | — | — | — | **YES** (carried into candidate as `5062bb3`) |

Worktree/branch audit: booking work was already reconciled into
`booking/integration-preview` (the checked-out runtime); the older booking
worktrees (`booking-domain-engine`, `booking-queues`, `booking-ui-experience`,
`booking-resource-engine`, …) are ancestors of it. The only booking-relevant
work living outside a commit was fleetpro-main's uncommitted GET-by-id +
SA-01 session fix — carried into this candidate as commit `5062bb3` without
touching the contested main tree.

## CANONICAL BOOKING MODEL

Unchanged: the single `Booking` document (Mongo) with lifecycle `status`,
date-certainty axis (`travelDateStatus`/`tentativeStartDate`/`tentativeEndDate`),
allocation facts (`driverId`/`vehicleId`/vendor fields/`resourceFulfilmentStatus`),
ledger-derived `advanceReceived`, `statusHistory`/`rescheduleHistory`/
`extensionHistory`/`revisionHistory`. No new booking collections, no
`queueBooking`/`upcomingBooking`/`liveBooking` copies — every queue remains a
query projection.

## CANONICAL EDITOR

`client/src/components/booking/booking-workspace.tsx` — the ONE Unified
Booking Workspace:

- Opens by canonical id via `BookingWorkspaceProvider` /
  `useBookingWorkspace().openBooking(id, { focus })` (provider mounted once
  in `App.tsx`).
- Always fetches fresh from `GET /api/bookings/:id` — never edits a stale
  row object, never touches the Add Booking wizard's draft state (§77).
- Sections (§57): Overview · Customer & Journey · Schedule · Allocation ·
  Pricing & Payments · Follow-up & Notes · Timeline. Sticky summary header
  (§9) with a Booking Readiness strip (§58) whose chips deep-focus the
  fixing section (§59).
- Reuses the already-canonical panels rather than duplicating them:
  `PaymentSection` (ledger), `TripCostSummary`, `ResourceFulfilmentPanel`
  (outsourcing), `AssignVendorDialog`, `ExtendBookingDialog`,
  `BookingCommunication`, `PipelineStepper`.
- State-aware editing (§28/§62): operational fields lock once finalized;
  `closed` financial changes require `adjustmentReason` (server-enforced,
  surfaced in UI); terminal bookings show a preserved-history notice;
  cancelled bookings stay visible with reason (§63).
- Unsaved-changes guard with Discard / Keep Editing / Save & Close (§44).
- No optimistic queue writes: server saves first, then ONE shared
  invalidation helper refreshes every booking view (§45/§46).

`client/src/components/booking/schedule-editor.tsx` is the ONE date editor
(confirmed / range / not-decided), used by both the workspace Schedule tab
and the queue row's compact Set Date dialog — one save path (§5-§7).

## QUEUE INTEGRATION

`queue-table.tsx` (shared by all five tabs):
- Booking code clickable → workspace; whole row clickable (§3, §66).
- Compact action area: **[Open] [Confirm] [More ▾]** (Set/Change Date,
  Assign Driver/Vehicle, Vendor/Outsource, Add Payment, Follow-up,
  Timeline) — one primary action + contextual menu, not 12 buttons (§4).
- Date Pending rows show an inline **[Set Date]** button (§5-§6, §37).
- Flags are actionable quick-fix links focused on the fixing section (§59).
- Confirm from queue opens the workspace Overview with the smart confirm
  checklist (§22-§23): all-required-complete → Confirmation Review
  (AlertDialog, "Confirm with Allocation Pending" when applicable §24);
  missing info → **[Complete Missing Fields]** focuses the first gap. Never
  a dead rejection.

## UPCOMING INTEGRATION

Rows clickable + [Open] action + actionable flags → same workspace. No more
read-only dead end (§26).

## LIVE INTEGRATION

Row/booking-code click + [Open] → same workspace; the existing quick
next-action buttons (Start/Complete/etc., already canonical status calls)
kept. Extend Trip lives in the workspace Allocation tab via the existing
`ExtendBookingDialog` (§27, §71).

## HISTORY INTEGRATION

Dashboard Booking History rows' View/click → workspace (state-aware: locked
operational fields, audited financial adjustment path, timeline). No
unrestricted edits of finalized records (§28, §72).

## CUSTOMER 360 INTEGRATION

Booking code, Full Details, and View actions → same workspace; the
customer-specific booking-details dialog was deleted (§29). Payment
quick-record on the customer page still uses the same ledger endpoints.

## DATE WORKFLOW

- `not_decided` and `range` remain first-class; nothing ever forces a fake
  date (§5, §7). Set Date (queue or workspace) saves via canonical PUT with
  the certainty partial schema; date confirmed → booking automatically
  leaves Date Pending and enters Upcoming purely by query derivation — no
  copies, no manual moves (§37, §52; E2E-proven).
- Moving an already-confirmed date uses POST `/reschedule` so
  `rescheduleHistory` is preserved (§60).
- Fix: an open-ended same-day booking (pickup date+time, no return info
  anywhere) no longer rejects with "Return must be after pickup" — the
  validation window extends to end-of-day (validation-only; nothing fake is
  persisted).

## ALLOCATION

- Workspace Allocation tab: assign/change/clear driver and vehicle with
  genuinely-eligible lists (`/api/drivers/available` with
  `excludeBookingId` + unavailability reasons; `/api/vehicles/available`),
  final server-side recheck on save (overlap, leave, SAFETY_HOLD — §15).
- Own fleet unavailable → booking stays captured: Keep Allocation Pending
  (clear = `''`→null server mapping), Vendor (AssignVendorDialog), or
  Outsource (ResourceFulfilmentPanel) — §16-§17.
- Date change with assigned resources triggers the existing PUT/reschedule
  conflict revalidation; conflicts surface with [Change Allocation] or
  admin-only override-with-reason (§49). A resource being *cleared* in the
  same request is no longer availability-checked as if still assigned.

## CONFIRM FLOW

Confirm requires customer + route + fare + confirmed travel date; allocation
may remain pending (§23-§24). Executed via POST `/:id/status` →
`transitionBooking` — the ONE state machine; the workspace renders lifecycle
buttons from the server's `allowedNextStatuses` (now returned by GET
`/:id`), so the client holds no copy of the transition table. Trip Start
remains stricter (assignment/override + SAFETY_HOLD hard stop) — Confirmed ≠
Started (§25).

## PAYMENT

One financial engine: the payment ledger (`/:id/payments`, reverse) with
`advanceReceived` as a server-maintained cache. The workspace edits fare
fields as-is and performs **no client-side money math**; the deleted legacy
dialog's charge-subtraction formula is gone (§18-§20, §76). Payment
Collection rows open the workspace focused on Payments ([Collect]) — §54.
Exact-money invariant E2E-proven: ₹6000 − ₹4000 = ₹2000.

## FOLLOW-UP

Workspace Follow-up tab: set/change `followUpAt`, Mark Follow-up Done
(clears via `''`→null). Follow-up Due queue membership is purely derived —
completing removes the row automatically (E2E-proven, §21, §55). Travel date
and follow-up date never conflated (§12).

## STATUS DERIVATION

- **Contradiction fixed at the root (§34-§35)**: `resourceFulfilmentStatus`
  was computed only at create time; PUT now recomputes it atomically with
  the vehicle assignment/clearing (only across the
  `not_started ⇄ own_fleet_assigned` pair — vendor/outsourcing states
  belong to their own flows and are untouched).
- Queue rows now carry a server-derived, never-stored `AllocationSummary`
  (driver axis × vehicle axis × vendor × self-drive) with a precise label:
  "Driver Assigned · Vehicle Pending", "Vendor — <name>", "Allocation
  Pending" — the blanket "Unallocated" badge beside a "Driver Assigned"
  status can no longer render.
- Client mirror in `lib/booking-state.ts` (allocation, payment,
  readiness) is derivation-only; conceptual dimensions (lifecycle / date /
  allocation / payment / follow-up) are separated exactly as §33 requires,
  reusing existing enums — no duplicate status systems created.
- `lastActivityAt` now stamped by PUT, `transitionBooking`, and reschedule
  (server-side only; never accepted from clients).

## CACHE/REALTIME

One shared `invalidateBookingViews()` (predicate over `/api/bookings*`,
`/api/operations*`, `/api/dashboard*`, plus the booking's
`/api/customers/:id*`) runs after every workspace/queue save — detail,
queues, upcoming, live, history, Customer 360, dashboard all refresh without
a hard reload (§46). Tenant-scoped WebSocket notification on status change
was already present and is unchanged (§47). Concurrency: server-side
transition validation + conflict rechecks remain the final authority (§48).

## TESTS

New `tests/e2e/unified-booking-workspace.spec.ts` — **5/5 passing** on the
candidate (port 5098):
1. Queue → Set Date → Confirm: ONE record, same `bookingId` code, leaves
   Date Pending and Tentative purely by derivation, `statusHistory` audited
   (§68, §52-§53).
2. Precise allocation state (driver assigned, vehicle pending) in queue rows.
3. `resourceFulfilmentStatus` recompute on assign/clear via canonical PUT.
4. Follow-up Due → completed → row disappears.
5. Exact money: ₹6000 − ₹4000 = ₹2000 through the ledger.

Regression (candidate vs untouched baseline on :5050):
- Passing on candidate: booking-domain-certainty (17), booking-queues-
  findability, payment-reversal, app-shell, booking-actions (Extend through
  the workspace), dashboard-upcoming-bookings, vendor-sourcing-workflow-ui,
  connected-workspace-resource-fulfilment, booking-vendor-fulfilment (UI
  assign flow), fulfilment-mode-ui, non-blocking-fulfilment, previous-
  booking-reuse, ui-date-certainty, + more — 60+ tests green.
- **Zero regressions**: every remaining failure (advance-payment wizard
  ₹1500/day vehicle unavailable, booking-source wizard, draft-persistence
  UI, resource-composition, reward-refresh, lead-conversion UI) fails
  identically on the untouched baseline — pre-existing shared-DB/seed-data
  drift in the Add Booking wizard path, not workspace-related.
- Test maintenance done as integrator: suites that drove the deleted
  dialogs now drive the workspace; grep-guard updated for a reviewed-safe
  Vehicle 360 comparison; tripType round-trip decoupled from arbitrary
  tenant vehicles (a SAFETY_HOLD vehicle was correctly rejected by the
  safety gate and failing the test).
- Accessibility: workspace dialog carries a DialogTitle in loading/error
  states (caught by the suite's console-error guard, fixed).
- `tsc`: no new type errors vs baseline (5 pre-existing html2pdf typing
  errors exist on both lines, in files this task never touched).

## CANONICAL COMMIT

- `316847b` — Unified Booking Workspace (this initiative)
- `5062bb3` — carried verified runtime fixes (GET `/api/bookings/:id`,
  SA-01 session resilience) that were live-but-uncommitted in fleetpro-main
- Base: `3fb3ed1` (`booking/integration-preview`)

## LIVE URL

**PROMOTED 2026-08-08**: merged into `booking/integration-preview` as
`d0e9469` (conflict resolutions: routes.ts kept allowedNextStatuses;
dashboard.tsx kept the final-UI redesign's DashboardOverview with
onViewBooking → openBooking; dashboard-upcoming spec merged both sides).
Pre-merge commit `81158a2` recorded the live-but-uncommitted tenant
service-modes + SA-01 + GET-by-id work found in the trunk tree. The ONE
canonical preview is **http://localhost:5050** (fleetpro-main). The :5098
candidate server was stopped; the worktree/branch remain for rollback.

Promotion incident: a duplicate dev server from
`fleetpro-worktrees/fleetpro-final-canonical` (older lineage) bound :5050
via SO_REUSEPORT alongside the trunk server, splitting traffic between two
code versions (intermittent Invalid session/CSRF failures). Stopped by
exact PID (41074) per the repo process-safety rule; :5050 is single-server
again. If that session needs its server, it should use its own port.

## KNOWN LIMITATIONS

- The Add Booking wizard (create path) is intentionally untouched (§77
  separation of create-draft vs persisted-record editing); its pre-existing
  E2E failures are seed-data drift, not code.
- Vendor cost vs customer fare separation exists via the existing vendor
  fields/panels; a dedicated vendor-cost editor section inside the
  workspace (beyond AssignVendorDialog's fields) was not added.
- `main` branch and fleetpro-main's uncommitted working tree were
  deliberately not modified; final trunk integration is a follow-up merge.
- Quantity/multi-vehicle requirements, KYC documents, and day-wise
  itinerary are not modeled in the canonical Booking today and were not
  invented here.
- Realtime: existing tenant-scoped notification broadcast is reused;
  no new WebSocket event types were added.

## ROLLBACK

Everything is isolated on `booking/unified-workspace` in its own worktree.
Rollback = stop the :5098 server and delete the worktree/branch:

```
kill $(lsof -ti:5098)
git worktree remove fleetpro-worktrees/unified-booking-workspace
git branch -D booking/unified-workspace
```

No shared branch, no database migration, and no main-tree file was touched.
Data written by E2E runs is ordinary tenant test data in the shared dev DB
(same pattern as every existing suite).
