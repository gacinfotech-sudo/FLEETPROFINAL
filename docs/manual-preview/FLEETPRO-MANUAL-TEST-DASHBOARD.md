# FleetPro Manual Test Dashboard

Maintained by: Integration Director / Control Tower session (this session).
Last updated: 2026-08-07 ~14:15 IST.

**Canonical live preview:** `http://127.0.0.1:5050/` — worktree `fleetpro-main`, branch
`booking/integration-preview`, actively driven by another of the user's sessions. This
session does not edit that worktree; status below reflects what's been independently
audited elsewhere, not a full feature-by-feature smoke test of `:5050` itself (that's
outside this session's remit — see ownership note in `PENDING-LIVE-INTEGRATION.md`).

**Secondary pinned runtime:** `http://127.0.0.1:5051/` — worktree `fleetpro-stable-demo`,
pinned to rollback tag `checkpoint-responsive-calling-20260807-015905`. Restarted twice by
this session after unrelated process incidents; currently up. Intended as an
Integrator/demo-only rollback point, not a second user-facing preview.

---

## ✅ LIVE — READY FOR USER TEST

- Nothing added to this list by this session — items below are the closest candidates but
  none have a full live smoke test performed by this session on the actual `:5050` preview.

## 🟡 LIVE — KNOWN LIMITATION

- **[Added by Dispatcher session]** Booking money math (₹6000/₹4000 → ₹2000 etc.) —
  closes this doc's own open question about `qa-money-booking-03` below. Independently
  runtime-tested via real browser automation (not code inspection) in an isolated
  worktree pinned to a slightly earlier commit (`20bd273`, same as this branch's base).
  Full result: `docs/qa/MONEY-AND-BOOKING-CODE-QA.md`. Verdict: **inconclusive**, not
  pass or fail — 5 separate attempts to complete a full UI+API+DB round trip were each
  blocked by a *different* infrastructure failure (a SIGKILL on the test's own dev
  server, repeated 60s API timeouts, a malformed API response, a Playwright frame-
  detachment error, an unrelated filesystem permission error) under severe shared-
  environment contention (load average 38 at the time, 41 concurrent node/chrome
  processes). Three pre-existing, previously-passing regression specs were run as a
  sanity check and **all three also timed out** on unrelated endpoints — ruling out a
  bug in the QA spec itself. **Booking short public code is a separate, definitive
  finding**: confirmed **not implemented** via real runtime evidence — a live booking's
  actual ID observed in the UI mid-test was `BK1785868939046KMJ0` (20 characters), not
  the required 6-character format. No 6-char code generation exists anywhere in the
  codebase (static search) or in what's rendered (runtime observation). Recommend
  re-running the already-written, already-debugged spec
  (`tests/e2e/qa03-money-and-booking-code.spec.ts`, left in the `qa-money-booking-03`
  worktree) once the shared environment is quieter, rather than re-authoring it.

## 🔄 WORKING NOW

- **Driver domain wave** — `driver-operations` (branch `driver/operations-06`) has real
  uncommitted work in progress as of this writing.
- **GPS domain wave** — `gps-fleet-interface` (branch `task/gps-05-fleet-ui`) has real
  uncommitted work in progress, including a new `leaflet`/`react-leaflet` dependency.

## ⏳ WAITING DEPENDENCY

- **TASK-03 performance fixes** (pagination + debounce) — built and measured, but not
  user-visible until the Integrator wires them into `client/src/pages/customers.tsx` and
  the 9 `getBookingsByTenant` call sites in `server/routes.ts` (this task doesn't own
  those files — see `PENDING-LIVE-INTEGRATION.md`).
- **Driver domain wave (5/6 committed worktrees)** — built, self-reported tested, but no
  route/navigation is mounted for any of it yet (Driver 360, hiring wizard, document
  registry, vehicle handover). Depends on `driver-domain-lifecycle`'s proposed
  `server/models/index.ts` patch being applied first.
- **GPS domain wave (4/6 committed worktrees)** — same situation: built, self-reported
  tested, no route/navigation mounted yet.
- **[Added by Dispatcher session] Original UI/Telephony/Performance batch — more severe
  than "not mounted."** Verified directly this pass (`git merge-base --is-ancestor`
  against current HEAD, cross-checked with real file-existence): `server/telephony/`
  does not exist anywhere in this branch's working tree, `server/gps/telemetry/` does
  not exist, `server/driver/` does not exist, and the `min-w-0` responsive-fix signature
  is absent from the current `client/src/pages/dashboard.tsx`. This is not a "route not
  mounted" situation — the source code for these three batches is not present on
  `booking/integration-preview` at all right now, despite `TASK-01`/`TASK-02`/`TASK-03`
  (original batch) having previously self-reported `INTEGRATED`/merged into a *different*
  branch, `integration/preview-20260807`, which no longer exists as a worktree. Whoever
  owns re-integration should treat these as needing a fresh merge/cherry-pick from their
  original task branches (`task/01-ui-responsive` @ `92527d8`,
  `task/telephony-02-multiuser-isolation` @ `7bc8b9c`,
  `task/performance-qa-03-audit` @ `870d8ae`), not assume the prior integration carried
  forward.

## 🛠 REPAIRING

- (none owned by this session)

## ⚠ EXTERNAL CONFIG REQUIRED

- GPS provider credentials (Traccar or equivalent) — `gps-provider-connections`'s adapter
  is built but needs real provider credentials to do anything beyond mock/test mode.
- No git remote and no linked Vercel/Replit deployment target exist in this repo (confirmed
  earlier via `.claude/orchestration/DEPLOYMENT-STATE.json`) — there is no public URL to
  switch traffic to; "live preview" here means local-only.

## ❌ NOT IMPLEMENTED

- Hard-delete route `DELETE /api/drivers/:id` has not been deprecated/gated yet, despite
  the driver-domain wave building the soft-state (`lifecycleStage='offboarded'`) it's meant
  to replace — flagged in `driver-domain-lifecycle`'s own report as out-of-scope for that
  task specifically.
- **[Added by Dispatcher session] Vehicle 360 / Maintenance / Compliance batch —
  setup only, nothing built.** Full audit + sourced research + manifest + all 7 task
  files written this session (`.claude/tasks/active/VEHICLE-360-MANIFEST.md`,
  `docs/vehicle-research/*.md`), duplication-checked against the existing
  `driver-vehicle-handover` work (reused, not duplicated). Zero worktrees created, zero
  workers launched — this is next-in-queue work, not in-progress work.

---

## Known P0/P1 items this session did NOT independently chase down

Per the directive's own priority list (runtime/DB/security first, then booking/money/
customer/driver/vehicle), the following were named as known issues but this session found
no direct evidence either way and did not verify them on the live `:5050` preview:
booking save/create contract mismatch, monetary amount drift, leading-zero input bug,
malformed monetary display, booking short public code. Several `money-*` worktrees
(`money-qa`, `money-rootcause`, `qa-money-booking-03`) exist and are presumably targeting
exactly these — not yet audited by this session (see `PENDING-LIVE-INTEGRATION.md`'s
"not yet audited" list).
