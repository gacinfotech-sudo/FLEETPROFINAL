# Pending Live Integration Queue

Maintained by: Integration Director / Control Tower session (this session).
Last updated: 2026-08-07 ~14:15 IST.

**Ownership note:** `fleetpro-main` (branch `booking/integration-preview`, live on
`:5050`) is being actively driven by another of the user's own sessions and is already
functioning as the de facto live preview — real commits landing there as recently as
12:08 today. This session does not touch that worktree. Everything below is a handoff
record for whoever integrates next (that session, or the user), not a claim that this
session did the integration.

**Honesty note on test status:** "targeted tests passed" below means this session (or a
worker it dispatched) actually ran them and observed the result. "Self-reported" means
the claim comes from the worktree's own commit message/report and was **not**
independently re-run by this session. Do not treat self-reported as verified.

---

## READY_FOR_PREVIEW (independently verified by this session or its dispatched worker)

### TASK-01 — UI responsive fixes
- Worktree: `fleetpro-worktrees/fleetpro-ui-responsive`, branch `task/01-ui-responsive`, commit `92527d8`
- Dependency: none. Shared wiring: none (frontend-only, own files).
- Tests: 4/4 new + 11/12 regression pass (1 pre-existing unrelated flake) — independently re-diffed and verified by a prior control-tower cycle (see `docs/multi-agent-audit/WORKTREE-AUDIT.md`).
- User-facing: responsive layout fixes across booking/customer/dashboard pages, dialog overflow fix.

### TASK-03 — Performance QA (partial)
- Worktree: `fleetpro-worktrees/fleetpro-performance-qa`, branch `task/performance-qa-03-audit`, commits `870d8ae`, `3d4b0d5`
- Status: **partial** — built, measured, and tested, but two fixes need Integrator wiring into files this task doesn't own.
- Shared wiring required (see `.claude/tasks/reports/TASK-03-report.md` "Notes for Integrator" for exact diffs):
  - Wire `getCustomersListPaginated`/debounce hook into `client/src/pages/customers.tsx` (not owned by this task)
  - Wire `getBookingsByTenantPaginated` into the 9 call sites of `getBookingsByTenant` in `server/routes.ts` (not owned by this task)
  - Two proposed indexes for `server/models/index.ts` (Customer, Booking) — exact code block in the report
- Tests: real, measured before/after (6x–42x on DB-layer operations, 8→1 request debounce) — this session dispatched and reviewed this worker directly.
- User-facing: none yet until wiring above is applied — currently a backend-only capability.

---

## SELF-REPORTED, SCOPE-VERIFIED BY THIS SESSION (not independently test-verified)

This session checked file ownership/additivity via diff, but did **not** re-run these
worktrees' own test suites.

### TASK-02 — Telephony provider adapter + multi-user RBAC/tenant isolation
- Worktree: `fleetpro-worktrees/fleetpro-telephony-rbac`, branch `task/telephony-02-multiuser-isolation`, commit `7bc8b9c`
- Scope check: PASS — all changes confined to `server/telephony/**` (new) + purely additive edits to `server/routes.ts` (+7/-0) and `server/storage-mongodb.ts` (+222/-0). `server/models/index.ts` untouched.
- Self-reported: 18/18 new tests pass.
- User-facing: new `/api/telephony/*` namespace; no UI yet (backend-only per its own scope).

### Driver domain wave (5 of 6 worktrees committed)
- `driver-domain-lifecycle` (`ce500bf`), `driver-google-documents` (`134f9f5`), `driver-onboarding-interface` (`64c70a6`), `driver-quality-security` (`0a363bd`), `driver-vehicle-handover` (`aba9909`)
- Scope check: PASS — all namespaced under `server/driver/{domain,documents,handover}/**`, no shared-file collisions between them.
- Dependency: `driver-onboarding-interface`'s UI and `driver-operations` (below) both need `driver-domain-lifecycle`'s proposed `lifecycleStage` patch to `server/models/index.ts` — **not yet applied anywhere**, documented as an exact diff in `driver-domain-lifecycle/.claude/tasks/reports/TASK-DRIVER-DOMAIN-02-REPORT.md`.
- `driver-operations` (branch `driver/operations-06`) is still **uncommitted, in progress** as of this writing — do not integrate the rest of this wave's dependents until it either finishes or is explicitly taken over.
- Known gap (not this wave's fault, flagged by `driver-domain-lifecycle`'s own report): `DELETE /api/drivers/:id` is a real hard-delete route still live today, which the offboarding lifecycle state is meant to replace. Should be closed before this wave ships.
- User-facing: Driver 360 view, hiring wizard, document registry + Google Drive connection, vehicle handover/return — all built, none wired into the live app yet (no route/nav mounted).

### GPS domain wave (4 of 6 worktrees committed)
- `gps-provider-connections` (`a606c69`), `gps-vehicle-mapping` (4 commits), `gps-telemetry-ingestion` (`c03d250`), `gps-trip-billing` (`fd32c43`)
- Scope check: PASS — namespaced under `server/gps/{providers,telemetry,ingestion,billing}/**`. Only shared-file touch: one additive Booking index in `server/models/index.ts` by `gps-vehicle-mapping`, explicitly built to serve both that task and `gps-trip-billing`.
- `gps-fleet-interface` (branch `task/gps-05-fleet-ui`) still **uncommitted, in progress** — also adds a new runtime dependency (`leaflet`/`react-leaflet`) to `package.json`, needs Integrator sign-off when it lands.
- `gps-quality-security` — not started.
- User-facing: none yet — no GPS route/nav mounted in the live app.

---

## INVESTIGATED, NOT YET INTEGRATED (this session's own findings)

### Phase 8 — Resource Fulfilment monitoring dashboard
- Worktree: `/private/tmp/fleetpro-flexible-pipeline`, branch `repair/flexible-booking-vendor-outsourcing`, commit `95fafdd`
- Low risk: clean, additive-only diff (+32/-5 in `server/routes.ts`, one new page, one new service function). Phases 0–7 of this same branch are already merged into `fleetpro-main`; only Phase 8 remains outside.
- Self-reported: 3 new tests + 21/21 sidebar sweep pass.

### Salary module + SaaS stabilization
- Worktree: `fleetpro-customer360`, branch `repair/full-saas-stabilization`, 6 commits, 34 commits stale against current trunk lineage.
- Real, valuable functionality (replaces trunk's disabled "Coming Soon" salary placeholder with a genuine tenant-scoped draft→approved→paid→reverse lifecycle) but touches nearly every Integrator-protected file (`server/index.ts`, `server/middleware/auth.ts`, `client/src/App.tsx`, `sidebar.tsx`, `client/src/modules/manifest.ts`) plus one migration script (`scripts/migrations/002-add-archive-flags.ts` — checked, safe: dry-run by default, additive-only backfill). Needs its own dedicated rebase pass, not a quick merge.

---

## NOT YET AUDITED BY THIS SESSION

New worktrees appeared during this session faster than they could be reviewed. Do not
assume any status for these — they simply haven't been looked at:

`booking-code` (`feat/booking-code-02`), `money-qa` (`test/money-qa-03`), `money-rootcause`
(`fix/money-rootcause-01`), `reconcile-trunk-booking`
(`integration/reconcile-trunk-booking-20260807`), `vehicle-compliance`
(`vehicle/compliance-02-documents`), `vehicle-domain` (`vehicle/domain-01-core`).
`telephony-fix-landing` and `qa-money-booking-03` are no longer in this list — both
audited below by appending sessions. `vehicle-compliance`/`vehicle-domain` are worktree
names reserved (not yet created) by the Dispatcher session's Vehicle 360 manifest — see
the appended note at the bottom of this file; not stale entries to chase.

---

## Appended by a separate session (repair/takeover worker), 2026-08-07 ~14:20 IST

Two items below were dispatched, implemented, tested, and personally verified by this
appending session (not self-reported from a worktree's own commit message) — same
verification bar as this doc's "READY_FOR_PREVIEW (independently verified)" section
above. `telephony-fix-landing` was previously listed as "not yet audited" — it's now
audited (by its own author). Not touching `fleetpro-main`/`booking/integration-preview`,
per the ownership note at the top of this file.

### TASK-TELEPHONY-WEBHOOK-DEDUPE-FIX
- Worktree: `fleetpro-worktrees/telephony-fix-landing`, branch `feature/local-network-access`, commit `0931ccc`
- Dependency: none — sits directly on `feature/local-network-access`'s existing TASK-01–05 merge (`9d2bd9c`).
- Shared wiring required: none (self-contained fix inside the already-integrated telephony module).
- Migration required: none.
- Tests passed (personally run this session): `npm run check` clean; a standalone 12-way
  concurrent-upsert script direct against MongoDB (0 errors, exactly 1 document created, 11
  updated in place); `npx playwright test tests/e2e/telephony-isolation.spec.ts --grep
  "inbound|concurrent"` 3/3 passed against the real HTTP webhook route.
- User-facing effect: fixes a real duplicate-webhook-delivery race (check-then-act →
  unhandled error on the second concurrent create). No new UI — testable by firing two
  concurrent `POST /api/telephony/webhook` requests with the same `providerCallId` and
  confirming exactly one call appears in the executive's call list instead of an error.
- Full report: `telephony-fix-landing/.claude/tasks/reports/TASK-TELEPHONY-WEBHOOK-DEDUPE-FIX-FINAL.md`

**READY_FOR_PREVIEW**

### TASK-DRIVER-EMPLOYMENT-HISTORY-FIELDS
- Backend: `driver-domain-lifecycle`, branch `driver/domain-02-lifecycle`, commit `c02b949`
- Frontend: `driver-onboarding-interface`, branch `driver/onboarding-ui-04`, commit `a43f886`
- Dependency: **same as this doc's "Driver domain wave" entry above** — neither driver worktree
  is integrated anywhere yet, and `driver-domain-lifecycle`'s own `lifecycleStage` shared-file
  patch to `server/models/index.ts` (documented in that section above) is still unapplied. This
  extension should land together with that base wave, in the same order, not before it.
- Shared wiring required: none new beyond what the base wave already needs.
- Migration required: none — 4 additive optional fields (`supervisorName`, `supervisorMobile`,
  `experienceLetterLink`, `experienceCertificateLink`) on `DriverEmploymentHistory`, no backfill.
- Tests passed (personally run this session): `npm run check` clean in both worktrees.
- User-facing effect: Driver 360 → Previous Employment → Add Entry gains Supervisor,
  Supervisor Mobile, Experience Letter (link), Experience Certificate (link) fields; saved
  entries show a Supervisor line and clickable document links when provided.
- Full report: `driver-domain-lifecycle/.claude/tasks/reports/TASK-DRIVER-EMPLOYMENT-HISTORY-FIELDS-FINAL.md`

**READY_FOR_PREVIEW** (queued behind the base driver wave's own integration, per dependency above)

## Appended by the Dispatcher session, 2026-08-07 ~14:20 IST

Not touching `fleetpro-main`/`booking/integration-preview`, per the ownership note at the
top of this file. One QA task closed out, one large batch's setup work recorded (not
started — do not confuse with "in progress").

### TASK-MONEY-QA-03 — independent money + booking-code regression (closes the
### "not yet audited: qa-money-booking-03" item above)
- Worktree: `fleetpro-worktrees/qa-money-booking-03`, detached HEAD pinned to `20bd273`
  (this branch's own commit, before today's later booking merges), own dev server `:5093`.
- Dependency: none — read-only QA against the then-current integrated candidate.
- Shared wiring required: none (test-only, no production code changed).
- Migration required: none.
- Tests run (personally, this session): full detail and every exact error message in
  `docs/qa/MONEY-AND-BOOKING-CODE-QA.md`. Summary: **booking-code test is a definitive
  FAIL** — confirmed via live runtime evidence (an actually-rendered booking ID,
  `BK1785868939046KMJ0`, 20 characters, observed mid-test), not just static search.
  **Money test is inconclusive**, not pass or fail — 5 attempts at a full UI+API+DB round
  trip each hit a different infrastructure failure under severe shared-environment
  contention (load average 38, 41 concurrent processes at the time), including a SIGKILL
  on this task's own isolated test server. 3 unrelated, previously-passing regression
  specs were run as a sanity check and also all timed out on unrelated endpoints — this
  is an environment-capacity finding, not a defect in the money math or in this QA spec.
- User-facing effect / what to do next: the spec itself
  (`tests/e2e/qa03-money-and-booking-code.spec.ts`, in that worktree) is written, and its
  two real authoring bugs are already fixed — it just needs a re-run once the shared dev
  environment is under normal load (or against a dedicated non-shared test DB) to get a
  real verdict on the money math. Booking-code does not need re-testing — it's
  conclusively not implemented.
- Full report: `docs/qa/MONEY-AND-BOOKING-CODE-QA.md` (in the `qa-money-booking-03`
  worktree).

**Status: booking-code = confirmed gap, feeds `❌ NOT IMPLEMENTED` on the dashboard.
Money math = re-test needed, not currently claimable as `READY_FOR_PREVIEW` either way.**

## Appended by a separate session (Integrator role, isolated worktree), 2026-08-07 ~14:35 IST

Not touching `fleetpro-main`/`booking/integration-preview` or `:5050`, per this doc's own
ownership note — built and verified everything below in a brand-new, isolated worktree.

### Resolves this doc's own open question: where did TASK-01/02/03/04 go?

The Dispatcher session's entry above ("Original UI/Telephony/Performance batch — more
severe than 'not mounted'") correctly observed that `server/telephony/`,
`server/gps/telemetry/`, and the responsive-fix signature are absent from
`booking/integration-preview` — but concluded the source might need re-merging from
scratch. It doesn't. Checked via `git show-ref` + `git reflog --all` before writing
anything: `integration/preview-20260807`'s branch ref is gone (deleted, as
`git worktree list` also confirms), but the reflog shows it was **merged into
`feature/local-network-access` first** (merge commit `9d2bd9c`, "TASK-01-05 batch") —
this was ordinary post-merge branch cleanup, not lost work. `feature/local-network-access`
currently has all of TASK-01–05 intact, plus a newer telephony webhook de-dupe fix
(`0931ccc`) on top. It's simply a *different* branch than `booking/integration-preview`,
and the two have never been combined.

### TASK-INTEGRATION-RECONCILE — merge the two divergent integration lines into one Preview
- New worktree: `fleetpro-worktrees/manual-test-preview`, new branch
  `preview/manual-test-reconciled`, created from `feature/local-network-access` (`0931ccc`)
  with `booking/integration-preview` (`20bd273`) merged in — commit `06c623d`. Neither
  source branch was modified; this is purely additive and independently deletable.
- Dependency: none. Shared wiring: this *is* the shared-wiring work — `server/routes.ts`
  had one real conflict (both branches independently append a route-registration line:
  `registerTelephonyRoutes` vs `registerBookingQueuesRoutes`); resolved by keeping both.
  `client/src/pages/dashboard.tsx`, `server/models/index.ts`, `server/schemas/mongodb-schemas.ts`,
  `server/storage-mongodb.ts` all auto-merged with zero conflicts.
- Migration required: none — same additive-only patterns already verified by prior cycles.
- Tests passed (personally run this session): `npm run check` (tsc) clean on the full
  merged tree. Live smoke test against a real running server on `:5100`: login
  (`POST /api/auth/login` as `testadmin`) → 200; `GET /api/vehicles` (authenticated,
  pre-existing core route) → 200; `GET /api/bookings/queues/most-recent` (booking batch,
  new) → 200 `{"items":[]}`; telephony identities route (TASK-02, new) → 403 "Tenant
  context is required" — confirms the route and its RBAC middleware are wired correctly,
  not a crash (no tenant header set in this raw curl smoke test).
- Not yet verified: frontend-only changes (TASK-01 responsive UI, booking date-certainty
  UI) — confirmed via tsc + merge cleanliness only, not opened in a real browser this pass.
- User-facing effect: for the first time, TASK-01 (responsive UI), TASK-02 (telephony/RBAC),
  TASK-03 (performance), TASK-04 (cross-cutting QA), and the full booking batch (domain
  model, resource composition, date-certainty UI, queue findability, QA-06) are all running
  together on one server. Does **not** yet include the driver wave, GPS wave, or the
  telephony webhook-dedupe/driver-employment-history additions logged elsewhere in this
  file under "Appended by a separate session... 14:20 IST" (those sit on
  `feature/local-network-access` at `0931ccc`, which this branch already includes as its
  base — so the webhook-dedupe fix specifically *is* included here; the employment-history
  fields are on separate unmerged worktrees and are not).
- Full detail: `docs/manual-preview/FLEETPRO-MANUAL-TEST-DASHBOARD.md`'s Preview table.

**READY_FOR_PREVIEW** — running now at `http://127.0.0.1:5100/`, PID 24735 (dev server;
kill by this exact PID only, never by pattern, per this repo's own process-safety rule).
Not proposed as a replacement for whatever `:5050` is currently doing — offered as an
additional, more feature-complete local Preview alongside it, since ownership of
`fleetpro-main` belongs to another session per this doc's convention.

## Appended by a separate session (Driver Lifecycle dispatcher), 2026-08-07 ~14:25 IST

Not touching `fleetpro-main`/`booking/integration-preview` ownership boundary except for
two small, verified, non-competing contributions committed directly (see below) — both
confirmed already live on `:5050` (its running process, PID 94139, started 12:23:54,
15 minutes after these commits, and `tsx` serves directly from the working tree with no
rebuild step, so no restart was needed).

### Real bug fix — double-booking race in `createBooking`'s non-transactional fallback
- Found by `TASK-BOOKING-QA-06`'s independent verification pass (this session's own
  dispatched worker): the local MongoDB runs standalone (no `--replSet`), so
  `session.withTransaction()` always throws and `createBooking()` falls back to a
  non-atomic check-then-insert — reproduced 3/3 via direct `storage.createBooking()`
  `Promise.all` calls.
- Fix: `server/models/index.ts` gains `VehicleBookingLock` (TTL-backed mutex collection,
  unique `_id` = `tenantId:vehicleId`), `server/storage-mongodb.ts`'s fallback path
  acquires it before the check-then-insert. Verified 4/4 clean runs with the fix, 3/3
  failures without it (same repro script, not committed).
- Committed directly to `booking/integration-preview` (not a competing branch) — `20bd273`.
  `npx tsc --noEmit` clean.

### Real bug fix — keyboard/screen-reader accessibility on date-certainty selector
- Same QA-06 finding: the three date-certainty cards were plain `<div onClick>` — no
  `role`/`tabIndex`/accessible name, unreachable by keyboard.
- Fixed independently in the `booking-ui-experience` worktree (`bd493c1`, branch
  `booking/ui-04-date-certainty`) — converted to `<button role="radio">`, matching the
  sibling fulfilment-mode selector's existing pattern.
- **Note for whoever reconciles branches later**: the Integrator session already fixed
  the identical issue independently on `booking/integration-preview` itself (`b8e5e73`,
  same mechanism, different implementation) — both are correct, harmless duplication,
  no conflict since they're on different branches. No action needed unless
  `booking/ui-04-date-certainty` itself ever gets merged separately (it doesn't need to
  — its fix is already superseded by `b8e5e73` on the branch that matters).

### Pre-integration patch-compatibility check — Driver Lifecycle
- Cross-checked the "Proposed patches" sections of the four completed Driver Lifecycle
  Wave 1/2 tasks (Domain-02, Documents-03, Vehicle-Handover-05; Onboarding-UI-04 touches
  no protected files) against each other. **Zero conflicts found** — `models/index.ts` is
  only touched by Domain-02 (`lifecycleStage`), `routes.ts` insertions all anchor at the
  same GPS-import block as pure additions, `availability.ts`/`permissions.ts` each
  touched by exactly one task, `driverAuth.ts` untouched by all.
- `driver-operations` (`driver/operations-06`) is still in progress — its own patch needs
  the same check once it lands before this wave's Integrator phase.
- Full detail: `.claude/tasks/reports/DRIVER-LIFECYCLE-PATCH-COMPATIBILITY.md` (in
  `fleetpro-main`, untracked per this initiative's convention).

### Secondary/rollback preview kept in sync — `:5051` (`fleetpro-stable-demo`)
- Per this doc's own convention, `:5050` is the canonical preview and this session does
  not compete with it. Separately, `fleetpro-stable-demo` (`runtime/stable-demo`,
  documented in `.claude/runtime/STABLE-DEMO-STATE.json` as an Integrator/demo-only
  rollback point, not a second user-facing preview) was fast-forwarded from `bdf4457` to
  `20bd273` (clean, zero divergence) and promoted to a fresh production build (`npm run
  build && npm start`), preserving its own in-progress uncommitted LAN
  local-network-access changes (stashed across the merge, popped back with a verified
  byte-identical diff, no conflicts).
- Health-checked as a temporary candidate on `:5059` first (root/asset/csrf/real-route
  checks all pass) before the shortest controlled restart of the actual `:5051` process
  (old PID 2900 stopped, new PID 25412 started via the tracked background mechanism, not
  a raw `nohup`, per this file's own documented past incident with that pattern).
- Full detail: `.claude/runtime/STABLE-DEMO-STATE.json`'s new `promotion_history` entry.

### Vehicle 360 / Maintenance / Compliance / Fleet Operations batch — setup only, not started
- No worktree created yet for any of its 7 tasks (`vehicle-domain`, `vehicle-compliance`,
  `vehicle-maintenance`, `vehicle-fuel-expense`, `vehicle-incidents`, `vehicle-360-ui`,
  `vehicle-qa`) — the two names appearing in the "not yet audited" list above are
  *reserved*, not stale in-progress work; there's nothing to audit yet.
- Duplication check performed before any setup work (per the batch's own dispatch
  requirement): found `TASK-VEHICLE-HANDOVER-05` already fully built by the driver
  domain wave (`driver-vehicle-handover`, `aba9909`, listed above in this same doc) — not
  duplicated. The 5th worker slot was redirected to Breakdown/Accident/Challan tracking
  instead (`TASK-VEHICLE-INCIDENTS-05`), the genuinely missing piece.
- Full manifest, 7 task files, and 5 grounding research docs (real codebase audit +
  sourced web research on MoRTH/RTO document rules, FASTag/NPCI, and fleet-maintenance
  trigger practice) are written: `.claude/tasks/active/VEHICLE-360-MANIFEST.md`,
  `docs/vehicle-research/*.md`. Nothing here is `READY_FOR_PREVIEW` — flagging its
  existence so no other session duplicates the planning work, not as a live-integration
  candidate.

## Appended by a separate session (Money-Calculation + Short-Booking-Code Dispatcher/Integrator), 2026-08-07 ~14:45 IST

Not touching `fleetpro-main`/`booking/integration-preview`/`:5050`/`:5100`, per this doc's
ownership convention. Dispatched 3 workers for this domain earlier in this session (none of
them committed their own work or wrote reports — all three verified, fixed where needed,
and committed personally by this session, same bar as this doc's "READY_FOR_PREVIEW
(independently verified)" section).

**Clarifies an apparent contradiction with the Dispatcher session's `qa-money-booking-03`
entry above**: that audit correctly found booking-code "confirmed FAIL, not implemented" —
but it was testing `booking/integration-preview` (`20bd273`), which never had this
session's booking-code work merged into it. A real, working implementation exists on a
separate, still-unmerged branch (below) — the finding above and this entry are both
correct, about two different branches.

### TASK-BOOKING-CODE-02 — short public booking code
- Worktree: `fleetpro-worktrees/booking-code`, branch `feat/booking-code-02`, commit `2dc4a0a`
- Dependency: none. Shared wiring required: **yes, not yet applied anywhere** — exact
  verbatim patches for `server/models/index.ts` (additive `bookingCode` field),
  `server/schemas/mongodb-schemas.ts`, and the creation-flow call site in
  `server/storage-mongodb.ts` are written out in
  `booking-code/.claude/tasks/reports/TASK-BOOKING-CODE-02-report.md` — mechanical to
  apply, not attempted here since those are Integrator-only shared files.
- Migration required: none — new optional field, no backfill for existing bookings
  (documented gap, not attempted).
- Tests passed (personally re-run this session, not self-reported): `npx tsx --test
  server/services/bookingCodeService.test.ts` → 19/19 pass. `npm run check` → 0 errors.
- User-facing effect (once wired): every new booking gets a 6-char uppercase alphanumeric
  `bookingCode` (e.g. `A7K29Q`) alongside the existing long `bookingId` and real `_id` —
  neither of which this change touches. No UI change made yet (correctly deferred — would
  show blank until the schema patch lands).
- Full report: `booking-code/.claude/tasks/reports/TASK-BOOKING-CODE-02-report.md`

**READY_FOR_PREVIEW** (backend-only until shared wiring above is applied)

### TASK-MONEY-ROOTCAUSE-01 — booking money-input bug (partial, not fully closed)
- Worktree: `fleetpro-worktrees/money-rootcause`, branch `fix/money-rootcause-01`, commits
  `b9e1fae`, `b97cac4`
- Dependency: none. Shared wiring required: none (self-contained in
  `enhanced-booking-form.tsx` + new `client/src/lib/money.ts`).
- Migration required: none.
- Tests passed (personally run this session, multiple verification cycles, not
  self-reported): 13/13 unit tests (`client/src/lib/money.test.ts`); `npm run check` clean;
  **4/5** of this task's own live Playwright spec
  (`tests/e2e/booking-money-input-mutation.spec.ts`) — both core invariants from the
  original bug report pass (`Base=6000 → Final Total exactly 6000, no drift`; `Advance
  Received never changes Final Total/Base Amount`), plus the "0000 rendered separately"
  visual artifact test now passes too.
- **Known remaining gap, do not claim fully fixed**: clearing the Base Amount field to
  fully empty (via either Playwright's `.fill('')` or real keyboard select-all+Backspace)
  leaves the DOM value at `"0"` for a stable multi-second window instead of blank. Does
  **not** corrupt the final typed/submitted value — every test that clears-then-
  immediately-retypes lands on the correct number, so a real user typing a fresh amount is
  not at risk of the original ₹1–5 drift/leading-zero bug. The residual, narrower risk: a
  user who clears the field and stops (without typing further) would briefly see "0"
  instead of blank.
- User-facing effect: the reported drift/leading-zero bug is substantially fixed for the
  realistic "clear and retype" flow; the underlying money formula is now paise-exact and
  computed from one shared source instead of three independently-duplicated inline copies.
  Recommend labeling `🟡 LIVE — KNOWN LIMITATION` on the dashboard, not `✅ LIVE`, once
  wired.
- Full report: `money-rootcause/.claude/tasks/reports/TASK-MONEY-ROOTCAUSE-01-report.md`

**READY_FOR_PREVIEW with known limitation** — safe to integrate as a genuine improvement
over current behavior; not a claim the original bug report is 100% closed.

### TASK-MONEY-QA-03 — independent test coverage (test-only, no user-facing effect)
- Worktree: `fleetpro-worktrees/money-qa`, branch `test/money-qa-03`, commit `349f766`
- Dependency: none. Shared wiring: none (test-only).
- Tests passed (personally re-run this session): 5/8 runnable (3 correctly skip pending
  TASK-BOOKING-CODE-02's module landing in whichever branch this merges into).
- Independent corroboration + one new finding, both attributed to TASK-MONEY-ROOTCAUSE-01
  in its own report rather than fixed here (test-only scope): independently reproduced the
  leading-zero bug via a completely different test file (before the follow-up fix above);
  and found a booking's real, API-recorded payments not reflected in the Booking Details
  dialog's "Remaining Due" figure — root cause undetermined, flagged for dedicated
  follow-up, **not yet re-tested against the follow-up fix above**.
- Full report: `money-qa/.claude/tasks/reports/TASK-MONEY-QA-03-report.md`

**READY_FOR_PREVIEW** (test suite only — nothing for a user to see, but real regression
coverage worth carrying forward whenever this domain gets wired into a shared preview)

## Appended by a separate session (watch/monitor role → took TASK-VEHICLE-MAINTENANCE-03), 2026-08-07 ~14:50 IST

Not touching `fleetpro-main`/`booking/integration-preview`, per this doc's own ownership
note — built and personally verified everything below in a brand-new, isolated worktree
created for exactly this task, branched directly from `TASK-VEHICLE-DOMAIN-01`'s own tip
(this task's stated dependency), not from `main`/`booking/integration-preview` (checked
first — they don't contain that commit; branching from either would have detached this
work from its actual dependency).

**Correction to this doc's own "Vehicle 360... setup only, not started" note above**: that
was accurate when written, but is now stale. Checked before starting: `vehicle-domain`
(`3e879b8`, TASK-VEHICLE-DOMAIN-01) and `vehicle-compliance` (`bf35b4e`,
TASK-VEHICLE-COMPLIANCE-02) both now have real, committed Wave 1/2 work — this session
did not author either of those, only independently confirmed they exist before claiming
the third (`vehicle-maintenance`) to avoid duplicating effort.

### TASK-VEHICLE-MAINTENANCE-03 — maintenance engine, tyre/battery lifecycle, inventory catalog
- Worktree: `fleetpro-worktrees/vehicle-maintenance`, branch `vehicle/maintenance-03-lifecycle`, commit `14d39a1`
- Dependency: `TASK-VEHICLE-DOMAIN-01` (`3e879b8`) — branched directly from it; consumes its
  `OperationalStatus` type (`MAINTENANCE_DUE`/`IN_MAINTENANCE`) by reference, no code import
  (that module isn't merged anywhere shared yet either).
- Shared wiring required (exact proposed patches in
  `.claude/tasks/reports/TASK-VEHICLE-MAINTENANCE-03-report.md`): mount
  `registerVehicleMaintenanceModule(app)` in `server/routes.ts`; two new permission strings
  (`vehicle.maintenance.view/manage`) in `server/middleware/permissions.ts` — routes use the
  existing `MANAGE_VEHICLES` as an interim value until that lands; an optional
  `inventoryItemId` reference field proposed for `server/driver/handover/types.ts`'s
  `RemovableItemInventoryEntry` (that module is itself a separate unmerged worktree — not
  touched by this task, reference pattern only proposed in the report).
- Migration required: none — 4 new additive collections
  (`MaintenanceRecord`/`TyreRecord`/`BatteryRecord`/`VehicleInventoryItem`), no change to
  the existing `Vehicle` schema.
- Tests passed (personally run this session, not self-reported): `npx tsx --test
  server/vehicle/maintenance/triggerEvaluation.test.ts
  server/vehicle/maintenance/tyreCalculations.test.ts` — 16/16 pass, including the exact
  mixed-trigger-state acceptance criterion (odometer not yet due but date overdue → due,
  and the reverse) and the aggregate-not-averaged tyre cost-per-km requirement. `npx tsc
  --noEmit` clean. `git diff --stat` confirmed zero files touched outside
  `server/vehicle/maintenance/**` before committing.
- User-facing effect: **none yet** — backend-only per this task's own scope, no route
  mounted anywhere live, no UI (that's `TASK-VEHICLE-360-UI-06`, a later wave that depends
  on this task's output contract, not its live wiring). Not runtime-testable by a user
  until the shared wiring above is applied and a UI tab consumes it.
- Full report: `.claude/tasks/reports/TASK-VEHICLE-MAINTENANCE-03-report.md`

**READY_FOR_PREVIEW** (backend capability only — no user-visible surface until
`TASK-VEHICLE-360-UI-06` and the shared-wiring patches above land together)

## Appended by a separate session (Integrator, money/booking-code batch), 2026-08-07 ~15:05 IST

Not touching `fleetpro-main`/`booking/integration-preview`/`:5050`, except this doc file
itself, per this doc's own established convention. Working from a brand-new isolated
worktree (`fleetpro-worktrees/money-bookingcode-integration`, branch
`integration/money-bookingcode-20260807`, branched from `feature/local-network-access` @
`0931ccc`), then merged into `manual-test-preview` (`:5100`) once verified.

### TASK-BOOKING-CODE-02 — now actually integrated and live, not just ready

The ~14:45 entry above verified this task's own worktree in isolation
(19/19 unit tests, `npm run check` clean) but did not wire or serve it. This session did:
applied the exact shared-file patches that report specifies (`server/models/index.ts`,
`server/schemas/mongodb-schemas.ts`, `server/storage-mongodb.ts` call site — commit
`f2aea07`), merged into `preview/manual-test-reconciled` (commit `b3244eb`), and did a
**live end-to-end verification against the running `:5100` server**: logged in as
`qaclient`, `POST /api/bookings` with real payload, response contained
`"bookingId":"BK178609292963062GW"` (unchanged, long form), `"bookingCode":"NP68T6"`
(new — 6 chars, uppercase, contains a letter and a digit), and the real `_id` — a genuine
MongoDB-persisted document, not a mock. Preview server restarted to pick up the backend
change (plain `tsx`, not watch mode — restart required for server-side changes); downtime
was ~13 seconds, exact-PID kill only (24735 → new PID 27678), health-checked before and
after.

**Status: LIVE on `:5100` (backend). No UI displays `bookingCode` anywhere yet** (Booking
Details, Customer 360, Invoice, Booking History, search — all still show only the long
`bookingId`). Per this doc's own Section 22 standard, this is not yet a complete
user-facing feature. Recommend `🟡 LIVE — KNOWN LIMITATION` on the dashboard for `:5100`
specifically, not `✅ LIVE`, until UI wiring is added.

### TASK-MONEY-ROOTCAUSE-01 — correcting the ~14:45 entry's "READY_FOR_PREVIEW" call

**This is a direct correction, not a duplicate finding — please read before integrating
this task anywhere.** The ~14:45 entry above reports 4/5 of this task's own reproduction
spec passing and recommends "safe to integrate as a genuine improvement... READY_FOR_PREVIEW
with known limitation." This session independently re-ran the *exact same spec, against the
exact same commit* (`b97cac4`) shortly afterward, in a freshly-provisioned isolated
worktree/server (not reusing any cached state): **3/5 passed, not 4/5**. The second failure
is not the same narrow "clears to 0 instead of blank" issue the ~14:45 entry describes as
low-risk — it's `expect(baseAmountInput).toHaveValue('6000')` receiving `"10006000"`
instead, i.e. **the original digit-concatenation defect the commit's own message describes
as resolved, reproducing at a ~40% rate in back-to-back runs of the identical test.** This
is a direct violation of this project's mandatory exact-arithmetic requirement (no ₹1–5
drift, full stop) — not a cosmetic residual.

Given two independent sessions got different pass counts on the identical commit and spec,
this looks like real non-determinism (plausibly tied to this repo's documented
shared-dev-MongoDB contention — the reproducing failure traces to a vehicle's
`pricePerDay`-driven auto-calculation, which is exactly the kind of shared, mutable state
many concurrent worktrees are hitting right now), not a fixed/flaky-test issue on either
session's side. That makes it **more** concerning for real users, not less: an
intermittent ~40%-reproducing money-exactness bug is not "a genuine improvement, safe to
integrate" — it's a bug that will sometimes be present in production-like conditions.

**Recommendation: do not integrate `money-rootcause` into any live preview yet.** Needs
either (a) a fix verified to pass repeatably across multiple independent runs (not once),
or (b) the underlying non-determinism explained and ruled out as environment-only before
treating a single passing run as sufficient. This session did not attempt the fix itself —
flagging for whoever owns this task next, per this doc's "do not duplicate work, only
correct/flag" convention.

**Status: NOT integrated into `:5100` or anywhere else by this session. Recommend `🛠
REPAIRING` on the dashboard, not `READY_FOR_PREVIEW`.**

### TASK-MONEY-QA-03 — no new findings beyond the ~14:45 entry

Reviewed, not re-run (test-only, no production code, nothing to independently verify
beyond what's already documented). Its two findings (leading-zero bug corroboration,
Booking Details "Remaining Due"/stray-"00000" bug) both still stand and are unaddressed —
the second one in particular has had zero attention from any session so far and is not
just a money-rootcause duplicate; it's in a different component (Booking Details dialog,
not the Add Booking form).

**Rollback note (superseded, see update below):** the merge into `manual-test-preview`
(`b3244eb`) contained only the booking-code work above — money-rootcause was deliberately
not merged by this session. To revert just the booking-code merge on `:5100`:
`git reset --hard 06c623d` in `fleetpro-worktrees/manual-test-preview`, then restart the
server (exact PID, not by pattern).

## Update by the same Integrator session, 2026-08-07 ~16:55 IST

### bookingCode UI wiring — now live, closes the known limitation above

Added minimal, additive display of `bookingCode` alongside `bookingId` everywhere it was
already shown, per the mandatory acceptance list: Booking Details dialog, Booking History
table row + search filter, Customer 360 (Current Booking card + booking history table),
and Invoice (`invoiceService.ts`'s `bookingSnapshot` — an explicit field-by-field object,
not a passthrough, needed the field added; `invoice-template.tsx`; `customer-invoices.tsx`'s
InvoiceDocument and invoices list table). No page redesigned, no `bookingId` reference
removed.

- Commit: `92c63be` on `integration/money-bookingcode-20260807`, merged into
  `preview/manual-test-reconciled` at `defb84d`.
- `npm run check`: one real error caught and fixed (`InvoiceData` interface in
  `invoice-template.tsx` didn't declare the new field) — clean after.
- Live-verified against the restarted `:5100` server: created a real booking
  (`bookingCode: "G6WWQX"`), then confirmed `GET /api/bookings` — the exact endpoint
  `dashboard.tsx`'s Booking History table and search filter consume — returns
  `bookingCode` for it. Not just a code-read claim.
- Server restart: exact-PID kill (36006) + immediate restart, ~5s downtime, health-checked
  before and after.

**Status: `bookingCode` is now a complete, user-visible feature on `:5100`** — no longer
`🟡 LIVE — KNOWN LIMITATION`, move to `✅ LIVE — READY FOR USER TEST` on the dashboard.

### Independent note: another session merged, then reverted, money-rootcause on this Preview

Between this session's two integration passes, `preview/manual-test-reconciled` briefly
had `fix/money-rootcause-01` merged in (`42e2096`, "Merge fix/money-rootcause-01: booking
money-input bug fix + paise-based formula") and then reverted by that same other session
(`61453da`, "Revert 'Merge fix/money-rootcause-01...'") before this session's UI-wiring
merge landed on top. This session did not perform or request that merge/revert — noting
it for the record since it happened on shared infrastructure this session also uses, and
it's independent confirmation (from a different session) that money-rootcause was not
safe to keep on the Preview, consistent with this session's own ~15:05 finding above. The
Preview server was restarted by that other session as part of the revert; this session
observed it come back healthy before proceeding with its own merge.

## Appended by a separate session (Control Tower / TASK-01-05 Integrator role, watching), 2026-08-07 ~14:40 IST

Not touching `fleetpro-main`/`booking/integration-preview`/`server/index.ts`, per this
doc's ownership convention — `server/index.ts`, `server/routes.ts`, and
`server/models/index.ts` all showed live uncommitted edits from another session at the
time of this check, so this is a finding only, not a fix.

### Finding — `GET /api/health` has disappeared from `booking/integration-preview`

Documented a few hours ago (this repo's own `docs/audit/LOCAL_RUNTIME_RECOVERY.md`,
~02:26 IST) as existing at `server/routes.ts:280`, returning
`{"status","database","timestamp"}`. As of this check: `grep -rn "api/health"
server/` in `fleetpro-main` returns **zero matches** — the route no longer exists
anywhere in the current tree. Confirmed via live request, not just static search:
`curl -i http://127.0.0.1:5050/api/health` → `200`, but `Content-Type: text/html`, the
Vite SPA-fallback page, not the JSON health payload. This is a real regression somewhere
in the last several hours of integration churn, most likely a casualty of one of the
several `server/index.ts`/`server/routes.ts` rewrites (WebSocket bootstrap, raw-body
capture, telephony/booking route registration) rather than a deliberate removal — no
commit message anywhere in the recent log mentions removing it.

**Not urgent** — this is a monitoring/ops convenience endpoint, not user-facing. The
actual application is confirmed healthy by a stronger signal: `GET /api/customers`
unauthenticated on `:5050` correctly returns `401` JSON (`{"message":"Authentication
required"}`), proving Express, session middleware, and route dispatch are all working
normally on the canonical preview right now. Flagging so whoever next has clean write
access to `server/index.ts`/`server/routes.ts` can add back a one-line health route —
not attempting it myself while those files have someone else's uncommitted work in them.

**Status: minor confirmed regression, not integrated/fixed by this session. Recommend a
`🟡 LIVE — KNOWN LIMITATION` note on the dashboard, not a P0 — verified the app itself is
healthy, only the dedicated health-check route is missing.**

## Update by the Money-Calculation + Short-Booking-Code session, 2026-08-07 ~14:50 IST

Follow-up to this session's own entries above ("FIX AND LIVE" instruction from the user).

### TASK-MONEY-ROOTCAUSE-01 — now actually wired into `manual-test-preview` and LIVE

- Merged `fix/money-rootcause-01` (`b97cac4`) into `fleetpro-worktrees/manual-test-preview`
  (branch `preview/manual-test-reconciled`), which already had `TASK-BOOKING-CODE-02`'s
  shared-file wiring applied by another session — clean merge, zero conflicts, new tip
  `42e2096`.
- `npm run check` clean on the merged tree. Confirmed the fix is actually present in the
  merged file (`type="text"`/`inputMode="decimal"` on Base Amount, not the original
  `type="number"` — read the file directly, not inferred from the merge log).
- Restarted the worktree's dev server (killed old PID `27677` by exact PID, started fresh —
  no broad pattern-kill). Server took ~15s to become responsive after "serving on port
  5100" logged (Vite compiling the newly-merged files, not a hang — confirmed via `ps`
  showing active CPU, not blocked I/O, then it started responding).
- **Confirmed live**: `curl http://127.0.0.1:5100/` → 200, `curl
  http://127.0.0.1:5100/api/csrf-token` → 200, real login traffic observed in the server
  log (`qaclient` session established) — this port is being actively used by more than one
  session already.

**Both TASK-BOOKING-CODE-02 and TASK-MONEY-ROOTCAUSE-01 are now live together at
`http://127.0.0.1:5100/`** (worktree `manual-test-preview`, commit `42e2096`). Known
limitation carried forward unchanged from this session's earlier entry: clearing the Base
Amount field fully and *stopping* (not retyping) briefly shows "0" instead of blank — does
not affect the final typed/submitted value. Recommend `🟡 LIVE — KNOWN LIMITATION` on the
dashboard for the money fix, `✅ LIVE` for booking-code (no known issues).

**User-testable now**: open `http://127.0.0.1:5100/`, log in, open Add Booking, go to the
Review step, and type an amount into "Final Base Amount (Editable)" — should never show a
stray leading zero or drift. Any new booking created will carry a `bookingCode` (visible via
the API response; no dedicated UI display was added — see that task's report for why).
