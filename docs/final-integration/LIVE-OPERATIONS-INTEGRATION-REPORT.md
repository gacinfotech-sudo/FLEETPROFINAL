# Live Operations — Integration Report (2026-08-08)

Integrated into canonical trunk `booking/integration-preview` (live on :5050) at
commit `f5be531` (fast-forward from `operations/live-booking-control`).

## What shipped

ONE operational control layer over canonical Booking records — no duplicate
live-booking store anywhere.

**Server** (`server/operations/`):
- `liveVehicles.ts` — Vehicles on Booking view: bounded indexed query
  (`{tenantId, status, scheduledEndDateTime}`), runtime status derived at read
  time (RUNNING / ENDING_SOON / RETURN_DUE / OVERDUE / END_TIME_PENDING),
  next-booking impact + turnaround conflict, deposit strictly separate from
  rental balance.
- `policy.ts` — tenant-resolved reminder policy (Tenant.timezone +
  operationsSettings; defaults 3h/2h/90m/60m/30m self-drive, 3h/2h/60m/30m
  with-driver).
- `reminderEngine.ts` — persistent server-side sweep (60s guarded interval in
  `index.ts`; restart-safe; browser-independent). Fires only the most imminent
  enabled stage; idempotent via OperationsAlert.dedupeKey + WhatsAppMessage
  idempotency ledger; honest WhatsApp status (SENT/FAILED/SKIPPED, never
  faked); extension supersedes stale time-anchored alerts (`resweepBooking`
  hook in POST /api/bookings/:id/extend).
- `routes.ts` — /api/operations/live-vehicles, /alerts (+acknowledge/snooze/
  contact with actor attribution), /bookings/:id/activity, /reminders/run
  (manual idempotent sweep = E2E accelerator), /api/tenant/operations-settings
  (PATCH owner-only).
- `availability.ts` hardening — an overdue physically-out trip occupies its
  vehicle/driver open-endedly (spec §20-22); scheduled end passing never frees
  anything.
- `storage-mongodb.ts` — expired-bookings sweep now skips self_drive (§21).
- Models: OperationsAlert + OperationsActivity (alert/audit records — not
  booking state), Booking securityDepositAmount/Status + startFuelLevel,
  WhatsAppMessage recipientType 'staff'.

**Client**:
- `pages/live-operations.tsx` — Vehicles on Booking: summary chips, tabs
  All/Self Drive/With Driver/Ending Soon/Overdue/Needs Attention, distinct
  self-drive vs with-driver cards, actions Call/WhatsApp/Extend/Collect/
  Start Return/Complete/Open (all canonical flows).
- `components/operations/` — alert strip + controlled popup + notification
  sheet; extend dialog (recovers structured 409 conflicts); collect-payment
  dialog (canonical ledger + idempotency key); reminder settings dialog
  (owner-only); dashboard live-operations summary (counts + ≤4 urgent +
  View All).
- Sidebar "Vehicles on Booking" under Bookings; dashboard section
  `live-operations`; alert strip mounted once in the dashboard shell.

## Verification (all against real HTTP + shared dev DB)

- `tests/e2e/live-operations.spec.ts` — **5/5 passed on :5050** after
  integration (and on the worktree preview :5121 before merge):
  1. Self-drive card w/ deposit; T-30 fires exactly once; ack/contact
     attributed; extension resweeps (superseded alerts + RUNNING again;
     revised total through canonical pricing).
  2. Overdue self-drive never auto-freed; critical alert unsnoozable (400);
     only return workflow releases; alerts resolve as 'completed'.
  3. With-driver card driver/fare/balance; T-60 + PAYMENT DUE; canonical
     payment clears live balance + alert ('paid'); completion exits view.
  4. Extension conflict → 409 AVAILABILITY_CONFLICT with the next booking;
     end time NOT overwritten; next booking intact.
  5. Dashboard summary + alert strip + popup acknowledge + tab filtering.
- `npx tsc` clean (fresh tsbuildinfo) on worktree and trunk post-merge.
- Regression: app-shell 3/3, self-drive-workspace green.

## Known pre-existing flakes hit during verification (NOT regressions)

- `availability-engine.spec.ts` "buffer parameter is opt-in": randomly picks a
  qaclient vehicle; several shared-DB vehicles carry open critical Daily
  Inspection defects (Safety Hold) from an earlier suite run → fails whenever
  the random pick lands on one. Reproduced on unmodified trunk :5050.
- Shared-`qaclient` session kick (single-session-per-user) when concurrent
  sessions run suites simultaneously — documented previously in
  vehicle-safety-eligibility.spec.ts.

## Integrator notes

- Server work + client build were produced by the concurrent Live-Operations
  session in the `live-operations` worktree; this session reviewed everything,
  fixed one real bug (operations extend dialog's 409 branch was dead —
  apiRequest throws on non-2xx), hardened `tests/e2e/helpers.ts` login()
  against the new alert popup's overlay (affects every existing spec), wrote
  the E2E suite, and performed the merge/restart/verification.
- Also committed on trunk en route: `049c18e` (pending self-drive lifecycle
  module that was live-but-uncommitted) and `e95804a` (expired-sweep
  self-drive guard).
- Deferred (documented, not blocking): GPS last-seen on cards (engine designed
  to work without GPS), per-tenant WhatsApp message template editing (default
  templates keep customer/internal content separate), collection-assignment
  workflow (§27) beyond the `collection_assigned` activity action.
