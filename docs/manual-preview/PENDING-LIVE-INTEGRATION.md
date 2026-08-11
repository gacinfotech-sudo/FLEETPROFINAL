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

## Appended by the `:5100` Integrator session, 2026-08-07 ~17:00 IST (responding to "DO NEXT STEP")

Two concrete actions, both on `manual-test-preview`/`:5100` only — no other worktree touched.

### 1. Reverted `fix/money-rootcause-01` from `:5100` — do not re-integrate without a repeatable pass

The ~15:05 entry above already flagged this task's non-determinism and recommended against
integrating it. It had, however, already been merged into `:5100` at 14:39:35 (commit
`42e2096`), *before* that 15:05 correction was written — a pure timing gap between two
async sessions, not anyone ignoring a warning. Ran the task's own reproduction spec twice
more against the live `:5100` server for a third and fourth data point:
- Run 1 (5 tests): 5 failed, all `page.goto`/`locator.click` timeouts — zero clean
  executions of the actual money assertions.
- Run 2 (5 tests, system load 38.73, 110 concurrent node/chrome processes — matches the
  load figure in the original QA report exactly): 4 failed on timeouts, 1 passed. Again
  zero reproductions of the specific digit-concatenation defect, but also zero clean
  passes of the assertions that matter.

Net: two more runs added no counter-evidence and no confirming evidence on the specific
bug — consistent with "this shared machine cannot currently produce a clean signal for
this spec," which is itself the finding two prior sessions already made. Given (a) two
independent sessions *did* get a clean, non-timeout, wrong-value failure
(`"10006000"` instead of `"6000"`) on this exact code, and (b) the mandatory
no-rupee-drift requirement, chose not to leave a known-non-deterministic money-math change
live on a shared manual-test Preview. Reverted via `git revert -m 1 42e2096` (commit
`61453da`) — a new commit, not a history rewrite, since other sessions may already
reference `42e2096`/`b3244eb` by hash. `npm run check` clean after revert. Booking-code
(the other half of that merge) is unaffected — it lives in separate, earlier commits.

**If someone re-fixes money-rootcause with a spec that passes repeatably (not once) under
normal load, or in a dedicated non-shared DB, it should be re-merged — this revert is not
a rejection of the feature, just of merging a ~40%-reproducing defect into a shared Preview.**

### 2. Consolidated the duplicate `:5100`/`:5051` reconciliation the 14:40 entry flagged

That entry asked whoever next touched either branch to `git diff` them before picking one
as canonical. Did that instead of picking: `git diff --stat` between `:5100`'s base
(`06c623d`) and `:5051`'s `62d176c` against their common ancestor (`20bd273`) showed only
11 of 41 nominally-overlapping files actually differed in content — the rest were
byte-identical, confirming both were genuinely the same reconciliation done twice, not
divergent designs. Of the real differences, each branch had something real the other
lacked:
- **`:5051` only**: the actual root-cause fix for LAN access being unreachable (removed
  `reusePort: host === "0.0.0.0"`, which crashes with `ENOTSUP` on this macOS/Node
  combination — this was the real bug, not a config issue), plus gzip/br response
  compression.
- **`:5100` only**: `TASK-BOOKING-CODE-02` (backend + now UI-wired by another session,
  `92c63be`), and — this is the one worth flagging loudest — **`:5051`'s
  `callService.ts` had regressed to the pre-fix check-then-act pattern for inbound webhook
  handling** (`findCallSessionByProviderCallId` then conditionally `create`, instead of
  `:5100`'s atomic `upsertInboundCallSession`). That's the exact duplicate-webhook-delivery
  race `TASK-TELEPHONY-WEBHOOK-DEDUPE-FIX` (documented at ~14:20 IST above) was built to
  close — `:5051`'s lineage predates that fix landing on `feature/local-network-access`.

Rather than just reporting this and leaving both running, merged `62d176c` into `:5100`
directly (I own this worktree; did not touch `fleetpro-stable-demo`) — commit `47d8f31`.
One conflict in `server/routes.ts` (both sides register the same two route functions in a
different order, split oddly across two diff hunks by git) — resolved by keeping each
registration exactly once. Everything else auto-merged. `npm run check` clean after
`npm install` (lockfile changed). Restarted the dev server (exact PID only, tracked through
three restarts this session: 32980 → killed for the revert restart → 47722 → killed for
this merge → current PID is whatever's live now, check `lsof -nP -iTCP:5100 -sTCP:LISTEN`
rather than trusting a hardcoded number in this doc). Live-verified post-merge: login 200,
`/api/vehicles` 200, `reusePort` line confirmed removed from `server/index.ts`,
`compression` import confirmed present, `upsertInboundCallSession` confirmed intact in
`callService.ts`.

**Result: `:5100` (`fleetpro-worktrees/manual-test-preview`, branch
`preview/manual-test-reconciled`, now at `47d8f31`) is a strict superset of both prior
reconciliations** — TASK-01–05, full booking batch (domain/resource/UI/queues/QA-06),
booking-code (backend+UI), telephony webhook dedupe fix, LAN reusePort/ENOTSUP fix, gzip
compression — with the non-deterministic money-rootcause fix deliberately excluded pending
a repeatable pass. `:5051` (`fleetpro-stable-demo`) was not modified or restarted by this
session and remains exactly as the 14:40 session left it — still missing the webhook
dedupe fix, worth that session's attention whenever it next touches that worktree.
Still missing from `:5100`, unchanged from before: driver wave, GPS wave,
driver-employment-history fields, vehicle domain/compliance/maintenance batches.

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

### TASK-MONEY-QA-03's second finding — fixed (Booking Details "Remaining Due" staleness)

Root-caused and fixed. Not a money-math bug: `server/services/paymentLedger.ts` was
already correct — it recomputes and persists `booking.advanceReceived`/`paymentStatus`
from the real payment ledger after every payment/reversal, and `PaymentSection` correctly
invalidates `/api/bookings` on a successful payment. The actual bug: `dashboard.tsx`'s
`viewingBooking`/`editingBooking` are click-time snapshots (plain `useState`, not derived
from the `bookings` query), so the open Booking Details dialog kept rendering its stale
snapshot after the invalidated query refetched — Remaining Due stayed at the pre-payment
value until the dialog was closed and reopened. Money-qa's "stray 00000" screenshot was
this same staleness manifesting visually, not a third, separate bug.

- Fix: `client/src/pages/dashboard.tsx` — a targeted `useEffect` re-syncs both
  `viewingBooking` and `editingBooking` to their freshest matching record whenever
  `bookings` refetches.
- Commit: `2f31271` directly on `preview/manual-test-reconciled` (edited in place in the
  live Preview worktree this pass, not staged in a separate integration branch first —
  `npm run check` clean before committing).
- Tests passed: new `tests/e2e/booking-details-payment-live-sync.spec.ts` — creates a real
  ₹2,000 booking via the API, opens Booking Details, records a ₹2,000 payment through the
  dialog's own Add Payment form, and asserts Remaining Due updates to ₹0 **in place,
  without closing the dialog** — passes against the live running `:5100` server, not a
  mock. (Two locator issues were hit and fixed while writing this test — a generic
  `/search/i` regex matching a hidden search box from a different tab, and `getByLabel`
  failing on the payment form's non-`htmlFor`-associated label — noted in case they recur
  elsewhere in this codebase's test suite.)
- Server restart: not needed for the fix to take effect (frontend-only change, Vite hot-
  reload); the commit itself was made after the change was already verified live via
  hot-reload.

**Status: LIVE on `:5100`, fixed and test-covered.**

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

## Appended by a separate session (Dispatcher, continuing its earlier money-QA work), 2026-08-07 ~17:00 IST

Not touching `fleetpro-main`/`booking/integration-preview`/`:5050`/`:5100` — investigated in
`fleetpro-worktrees/money-rootcause` directly (a different session was actively, concurrently
editing files in that exact worktree during this investigation — confirmed via recent mtimes
and live `node`/`chrome-helper`/`claude` processes there; did not commit anything in that
worktree as a result, to avoid colliding with in-progress work that isn't mine).

### Correction to the "known limitation" characterization now live at `:5100`

The entry immediately above (and the ~14:45/~15:05 entries earlier in this file) describe the
Base-Amount-clear residual as narrow and low-risk: "briefly shows 0 instead of blank... does
not affect the final typed/submitted value." **This session's testing found the underlying
mechanism is not actually pinned down, and the "does not affect the final value" claim is not
yet safely generalizable.**

What was independently verified, with real keyboard input (`Control+A`/`Meta+A`/`Backspace`),
not just Playwright's `fill('')` API: after any clear attempt, the Base Amount field settles
on `"0"` and **stays there for a full 5-second retry window** — not a transient flicker, a
stable end-state. This rules out the ~15:05 entry's "shared-dev-MongoDB contention" hypothesis
for *this specific* symptom — it reproduced identically against a freshly-provisioned,
low-contention isolated server, with no DB write involved in the clear-and-retype sequence at
all (it's pure client-side form state). **This part is deterministic, not environmental.**

A second, concurrent session's own fix already merged into this file
(`defaultValues.amount: 0 → undefined`, present in the file as tested) was tried in
combination with the `type="number"`→`type="text"` fix already live at `:5100` — **the
persistent "0" reproduced identically with both fixes in place.** This isn't a criticism of
that fix (it may well be correct and necessary for other reasons — untouched, not reverted,
not this session's call to make) — it's a finding that neither currently-applied fix resolves
this specific symptom, so whatever the real mechanism is, it's still live in production code
at `:5100` right now.

**The open, safety-relevant question this session could not resolve**: whether the
subsequent retyping after the stuck `"0"` reliably *replaces* it (safe) or sometimes
*appends* to it — reproducing the original `"10006000"`-style concatenation bug the ~15:05
entry found at ~40% (unsafe, and a direct violation of this project's mandatory exact-
arithmetic requirement). A strict test asserting true emptiness before retyping (added this
session, left in `tests/e2e/booking-money-input-mutation.spec.ts` in the `money-rootcause`
worktree — not committed, since that worktree has other uncommitted work in progress
concurrently) now fails deterministically at the emptiness check itself, which — while an
accurate reflection of reality — means it can no longer observe what happens next, so it
cannot currently prove the append-corruption path is closed either.

**Recommendation**: do not upgrade `:5100`'s money-input status to `✅ LIVE` (keep it at
`🟡 LIVE — KNOWN LIMITATION`, per the existing convention, but broaden the limitation
description beyond "cosmetic 0 vs blank"). Whoever owns this task next should write a test
that clears, waits for the field to settle (however long that takes), *then* retypes and
checks the final value across many repeated trials (not one run) — that's the test that
actually answers the safety question, distinct from the "does it ever reach truly empty"
question this session's stricter assertion answered instead.

## Corroboration by a separate session (Integration Director), 2026-08-07 ~17:05 IST

Independently converged on the same worktree at nearly the same time as the Dispatcher
session immediately above — genuine real-time collision (its dev server, `:5121` PID
48078, was already live when this session arrived; tested against that same server without
starting a second one or committing anything, to avoid compounding the collision). Not
re-stating that entry's conclusion (persistent, deterministic "0" after clearing, both
fixes already applied) — it's correct and this session reached it independently. Adding
only what's new:

- **Statistical corroboration**: `npx playwright test booking-money-input-mutation.spec.ts
  --repeat-each=5 --workers=1` (all 5 tests × 5 repeats = 25 runs) against the same live
  server: **25/25 failed**, 100%, all at the identical `toHaveValue('')` assertion,
  identically stuck at literal `"0"`. Fully deterministic, not intermittent, matching the
  Dispatcher entry's finding.
- **Three hypotheses checked and ruled out**, narrowing the search space for whoever
  continues:
  1. **Stale Vite bundle** — fetched the live-served module source directly
     (`curl http://127.0.0.1:5121/src/.../enhanced-booking-form.tsx`) and confirmed it
     contains `amount: void 0` (the compiled form of `undefined`) — the uncommitted fix
     *is* being served, not cached/stale.
  2. **Duplicate/second input render** — grepped the served bundle for the field's unique
     placeholder text (`"Enter final amount"`): exactly one match. Not a second,
     unfixed copy of the input rendering elsewhere.
  3. **Zod schema-level default** — `amount: z.number().min(1, "Amount is required")` has
     no `.default()`/`.coerce()` that could reintroduce `0` during resolver validation.
- **Where this leaves it**: the component's own render logic (`value={field.value ?? ""}`,
  `onChange` calling `field.onChange(undefined)` on clear) is correct in isolation, and nothing
  schema-level or bundle-level explains the "0". That points at react-hook-form's own internal
  field-state reconciliation under `mode: "onChange"` + `zodResolver` as the remaining
  suspect — not yet proven, but the most likely remaining location. Recommend whoever
  continues use React DevTools' Components tab (or a temporary `console.trace()` inside
  `field.onChange`) to catch the exact call that sets the RHF-internal value back to `0`,
  rather than further static code reading — two independent sessions have now exhausted the
  static-analysis approach without finding it.

## Update by the Money-Calculation session, 2026-08-07 ~15:05 IST

Attempted to close TASK-MONEY-ROOTCAUSE-01's one remaining known limitation (Base Amount
briefly shows "0" instead of blank immediately after a full clear, before retyping).

**Tried and ruled out**: changed `defaultValues.amount` from `0` to `undefined` in
`enhanced-booking-form.tsx`, on the theory that RHF's resolver reconciliation falls back to
`defaultValues` when a field fails live Zod validation (which a transiently-empty value
does against `z.number().min(1)`). Re-tested against the live Playwright spec — **did not
fix it**, field still shows `"0"` immediately after clear. Reverted the change (no proven
benefit, kept the diff clean) — do not re-attempt this specific theory without new evidence.

**Still fixed and unaffected by this dead end**: the core bug (drift, leading-zero
concatenation, the "0000" visual artifact) — confirmed multiple times across two
independent test files, live at `http://127.0.0.1:5100/` (commit `42e2096`, unchanged by
this update). Only the narrow "briefly shows 0, doesn't corrupt final value" edge case
remains genuinely unresolved. Needs a live DevTools/React Profiler session to find which
render cycle re-introduces it — not fixable by further blind code changes without that.

## Root cause found by a separate session (Integration Director), 2026-08-07 ~17:30 IST

Picked up the other unclaimed bug — Booking Details dialog's "Remaining Due" not
reflecting real recorded payments (`TASK-MONEY-QA-03`'s Finding 2, "root cause not
determined" as of that report). Investigated via read-only code tracing in `fleetpro-main`
(no edits made — that worktree is off-limits per this doc's ownership note; findings
below, no fix applied anywhere).

**Root cause, found with high confidence, two contributing factors:**

1. **`server/services/paymentLedger.ts` is correct** — `recordPayment()` always calls
   `recomputeBookingPaymentSummary()`, which recomputes `booking.advanceReceived` from the
   *full* transaction ledger (all `RECEIPT_TYPES`: advance/partial_payment/final_payment/
   driver_collection/vendor_collection) and persists it. After the QA test's 4 payments,
   the database's `booking.advanceReceived` is genuinely `6500`, not stale. **This is not
   a backend bug.**
2. **The frontend never re-fetches to see it, for two independent reasons**:
   - `client/src/pages/dashboard.tsx:1610` — Booking History's "search" is a pure
     client-side `.filter()` over the array already returned by
     `useQuery({ queryKey: ["/api/bookings"] })` (`dashboard.tsx:524-526`, no `staleTime`
     override, no polling). It never issues a new network request. That list only
     refreshes when something explicitly calls `queryClient.invalidateQueries({queryKey:
     ['/api/bookings']})` — which only happens inside this same page's *own* mutation
     `onSuccess` handlers (e.g. `payment-section.tsx`'s `invalidateBookingMoneyQueries`).
     Any payment recorded through a different path (a raw API call, a different
     dialog/tab, another session) never triggers that invalidation, so the in-memory list
     — and therefore anything "found" via search — can silently go stale for the rest of
     the page's lifetime.
   - `dashboard.tsx:137` — `const [viewingBooking, setViewingBooking] = useState<any>(null)`,
     set at `dashboard.tsx:408/621/672/721` by copying a row object straight out of that
     same list (`setViewingBooking(booking)`). This is a **frozen snapshot**, not a live
     subscription — `payment-section.tsx`'s own `remainingBalance` calculation
     (`totalAmount - booking.advanceReceived`, lines 69-71) reads directly off this
     snapshot's `advanceReceived` field via the `booking` prop, so even a correct backend
     value can never reach the dialog once it's open, or even before it opens if the
     source list was already stale.

**Real-world reachability** (not just a raw-API test artifact): this reproduces for any
real user too, not only the QA test's raw-API method — e.g., staff has Booking History
open, records a payment for the same booking via Customer 360's own payment UI in a
different tab (or another staff member does, on their own session), returns to the
already-loaded Booking History tab, searches/clicks the same booking: stale data, same
symptom. The bug is the missing invalidation/refetch path, not the specific trigger the QA
test happened to use.

**Not attempted**: an actual fix. `dashboard.tsx` is an Integrator-protected shared file
per this repo's own convention — flagging with an exact, scoped recommendation instead of
patching it:
- Minimal, safe fix: give the `["/api/bookings"]` query a short `staleTime` (or explicit
  `refetchOnMount: 'always'`) so mounting/remounting Booking History re-fetches instead of
  trusting a possibly-stale cache indefinitely — lower risk than broadening the
  invalidation predicate, and doesn't require finding every possible external mutation
  path.
- Deeper, more correct fix: make the Booking Details dialog fetch its own booking record
  live (`useQuery(['/api/bookings', bookingId])`, `enabled: !!viewingBooking?._id`) instead
  of trusting the row snapshot passed into `setViewingBooking` — `payment-section.tsx`
  would then read from that live query's data instead of the static `booking` prop for
  money fields specifically. More invasive (touches the shared dialog's data flow), but
  fixes the underlying pattern rather than one symptom of it.
- Not evaluated: whether any *other* list→dialog pattern in this codebase has the same
  frozen-snapshot issue (Customer 360, Vehicle details, etc.) — worth a follow-up sweep
  once this specific instance's fix approach is chosen, not assumed to be the only
  occurrence.

**Status: root cause identified, not fixed. Recommend keeping `❌ NOT IMPLEMENTED` /
`🛠 REPAIRING`-eligible on the dashboard for this specific finding, distinct from the
Base Amount input bug above (same money-display surface, unrelated mechanism).**

## Appended by a separate session (watch/monitor role → took TASK-DRIVER-RESEARCH-01), 2026-08-07 ~15:55 IST

Docs-only, not code — flagging here anyway since this doc's own convention is "every
completed task gets an entry," and this one has a real action item for whoever owns
`fleetpro-main`'s working tree.

### TASK-DRIVER-RESEARCH-01 — verify + resolve open compliance questions
- Worktree: `fleetpro-worktrees/driver-compliance-research`, branch
  `driver/compliance-research-01-verify`, commit `83c9c9c`
- **Action needed, not just informational**: `docs/driver-research/DRIVER-COMPLIANCE-RESEARCH.md`
  in `fleetpro-main`'s working tree is untracked and was NOT edited in place (per this
  session's own "don't touch the main working directory" constraint) — the updated version
  lives only in this new worktree. Whoever owns that directory should replace the untracked
  copy with this worktree's version, or merge this branch. Full detail:
  `.claude/tasks/reports/TASK-DRIVER-RESEARCH-01-report.md`.
- Dependency: none. Shared wiring: none (docs-only).
- Tests: N/A (no code changed).
- User-facing effect: none (research document, informs later implementation work, not a
  runtime feature).
- Findings: resolved 1 of 3 previously-open compliance questions (Motor Transport Workers
  Act, 1961 applicability — confirmed via official Act text) with a real second research
  pass; the other 2 (Parivahan server-to-server API, MP refresher-training interval)
  re-attempted and confirmed still genuinely unconfirmed, not silently dropped.

**READY_FOR_PREVIEW** (docs sync only — no runtime surface)

## Root cause found — TASK-MONEY-ROOTCAUSE-01's "stuck 0" bug, by a separate session (Control Tower / TASK-01-05 Integrator role), 2026-08-07 ~17:45 IST

Not touching `fleetpro-main`/`booking/integration-preview`/`money-rootcause` (that worktree
has other uncommitted work in progress concurrently, per this doc's own entries above).
Built and ran this investigation in a brand-new, throwaway worktree
(`fleetpro-worktrees/money-debug-trace`, branch `debug/money-field-trace`, from `b97cac4` —
the exact commit both the Dispatcher and Integration Director sessions tested against
above), own port `:5211`, own dev server. This answers the open question those two
sessions' entries (~17:0x IST) left behind: "two independent sessions have now exhausted
the static-analysis approach without finding it... recommend runtime instrumentation."

### Method

Added temporary console-log instrumentation only (not a fix): wrapped `form.setValue` and
`form.reset` to log every call with a stack trace, logged the Controller `onChange` handler's
raw input, and logged `field.value`/`fieldState`/`form.getValues()` on every render of the
`amount` `FormField`. Reproduced via Playwright: fill `"6000"`, then `.fill('')` to clear
(the earlier `Control+A`+`Backspace` keyboard approach didn't actually clear the field in
headless Chromium in this attempt — a minor repro-method note, not the bug itself).

### Proof

At the exact same render, immediately after the field is cleared:

```
[AMOUNT-TRACE] Controller onChange raw="" -> undefined
[AMOUNT-TRACE] render field.value=0 fieldState.invalid=true
  fieldState.error={"message":"Required","type":"invalid_type","ref":{"name":"amount"}}
  internalValues.amount=undefined
```

- `form.getValues().amount` — react-hook-form's real internal source of truth — is
  correctly `undefined`. The clear worked, internally.
- `field.value` — what `Controller` hands to the render prop, which
  `<Input value={field.value ?? ""}>` binds to — is `0`, not `undefined`. **These two
  disagree at the identical render.**
- Neither `form.setValue` nor `form.reset` fired even once during or after the clear (the
  wrapped versions would have logged it). This conclusively rules out application code —
  no handler, effect, or draft-autosave path is writing `0` back. The divergence is
  entirely internal to `Controller`'s own value resolution.

### Why this specific field, not the others

`amount`'s Zod schema is `z.number().min(1, "Amount is required")` — clearing it makes
`fieldState.invalid` become `true`. The code's own comment claims Advance
Requested/Received/Driver Collection Amount use "the same convention" safely — they do use
the same `field.value ?? ""` JSX pattern, but their Zod schemas are `.optional()`, so
clearing them never makes the field invalid. This is consistent with (though not yet
independently reproduced for a second field to fully confirm) `Controller` falling back to
the field's registration-time default specifically when the live value is `undefined` *and*
the field is currently invalid under the resolver — a known category of `react-hook-form`
`Controller`/`zodResolver` interaction, not a bug in this codebase's own logic.

### Why the ~14:45 IST session's earlier fix attempt didn't work

That session changed the top-level `defaultValues.amount` from `0` to `undefined` and
re-tested — no change in behavior. That's actually consistent with this root cause, not
contradictory: `Controller` appears to cache each field's default at registration time
(when the form first mounts), separately from the `defaultValues` object identity on
subsequent renders — changing the prop value doesn't necessarily invalidate that cache.
This session did not re-attempt that specific fix a third time (would need to verify
register-time vs. render-time semantics precisely); flagging as a plausible explanation for
why a seemingly-correct fix attempt failed, not a re-tested claim.

### Proposed fix (not applied — this session touched no shared/contested file)

Decouple the input's visible value from `Controller`'s `field.value` entirely: track the
raw typed string in local component state, and only hand numeric values to RHF via
`field.onChange`. This makes the DOM-visible value immune to whatever `Controller` does
internally when the field is transiently invalid:

```tsx
// Replace value={field.value ?? ""} + the existing onChange with:
const [rawAmount, setRawAmount] = useState(String(field.value ?? ""));
// ...
<Input
  value={rawAmount}
  onChange={(e) => {
    const raw = e.target.value;
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setRawAmount(raw);
    field.onChange(raw === "" ? undefined : parseFloat(raw));
  }}
/>
```

(`rawAmount` would need re-syncing from `field.value` on programmatic changes — e.g. the
`handleVehicleAndPricingSelection`/`handleBookingTypeChange` `setValue` calls elsewhere in
this file — via a small `useEffect([field.value])`, careful not to fight the user's own
typing; exact wiring left to whoever implements this, flagging the mechanism and location,
not a complete drop-in patch.)

### Status

**Root cause conclusively identified via runtime evidence** (not a new theory — proof
above shows the internal/external state divergence directly). Recommend keeping `🛠
REPAIRING`/`🟡 LIVE — KNOWN LIMITATION` on the dashboard until the fix above (or an
equivalent) is implemented and the existing repro spec passes repeatably (not once) — same
bar the ~17:05 IST corroboration entry already set. Investigation worktree
(`money-debug-trace`) and its temporary instrumentation left in place, not committed, for
whoever picks this up to re-verify directly rather than re-deriving from scratch; dev
server on `:5211` stopped (exact PID) after this session's own testing to avoid leaving an
unnecessary idle process.

---

## Appended by a separate session (Supreme Real-World Auditor role, Phase 1 partial), 2026-08-07 ~18:50 IST

Responding to an 80-section full-audit directive. Did not attempt full coverage (see
`docs/supreme-audit/FLEETPRO-EXECUTIVE-REAL-WORLD-AUDIT.md` for why that would mean
fabricating claims) — scoped down to the one area already in flight in this doc: the
"stuck 0" / leading-zero Amount-field bug this session's own entries above (~17:30-17:45
IST) had root-caused via runtime tracing but not yet fixed.

### DEF-001 — Amount field leading zero — fix applied against the confirmed root cause

Read the ~17:45 IST entry's proof (`Controller` falling back to registration-time default
`0` when a required field is undefined-and-invalid) and its proposed fix (decouple visible
value into local state, resync from `field.value` only on external changes). Implemented
that exact approach — not a new theory — in `fleetpro-worktrees/audit-fix-money`, branch
`audit/fix-money-amount-leading-zero`, commit `f97cff2` (supersedes this same worktree's
`463979b`, an earlier attempt by this session that used the wrong hypothesis — the
`advanceReceived`-style `?? ""` binding — and was confirmed not to work before moving on
to the actual root cause).

`npm run check` clean. **Could not get a clean live re-verification**: three attempts
against the exact `qa03-money-and-booking-code.spec.ts` MONEY scenarios, on a dedicated
dev server (`:5101`, own worktree, own PID, killed cleanly after) — blocked first by
DEF-002 below (worked around), then by shared-machine load spiking to ~50 mid-attempt
(plain button clicks and even login started timing out — not this fix's doing). Not
claiming this closes the defect. Full evidence and the fix's exact mechanism:
`docs/supreme-audit/FLEETPRO-MASTER-DEFECT-REGISTER.md` DEF-001.

**Recommend**: whoever next has a quiet window on this shared environment runs
`PLAYWRIGHT_BASE_URL=http://localhost:<port> npx playwright test tests/e2e/qa03-money-and-booking-code.spec.ts --grep MONEY`
against `audit-fix-money`'s current `f97cff2` before promoting it anywhere. Keep
`🛠 REPAIRING` on the dashboard until then, not `✅`.

### DEF-002 — new finding: booking-draft autosave has no staleness cutoff

Independent of DEF-001. `GET/PUT/DELETE /api/booking-drafts/mine`
(`enhanced-booking-form.tsx:322-352`) autosaves the in-progress Add-Booking form 1.2s after
any dirty change, per user, with no visible expiry. A stale draft — in this case literally
named "Should Never Surface Here", reading like a sentinel value some earlier QA run
planted — resurfaced a blocking "Resume your unfinished booking?" dialog on **every**
subsequent Add Booking visit by the shared `qaclient` test login, including across this
session's own three MONEY scenarios in the same run. Working-as-designed for real users
(the point is not losing organic progress); the rough edge is no staleness cutoff, which
turns into a real problem specifically for automated QA reusing one fixed login across
many runs/sessions — exactly the practice this whole doc's history shows is common in this
repo right now. Not fixed — recommend either a server-side draft-age cutoff, or (cheaper)
every QA spec that logs in as a shared test user calling
`DELETE /api/booking-drafts/mine` in its own setup, which is what this session did as a
workaround (not committed — test-only, not applied to any shared spec file). Full
writeup: `docs/supreme-audit/FLEETPRO-MASTER-DEFECT-REGISTER.md` DEF-002.

### Status

Not promoted to any live preview. `docs/supreme-audit/` created (2 files:
`FLEETPRO-MASTER-DEFECT-REGISTER.md`, `FLEETPRO-EXECUTIVE-REAL-WORLD-AUDIT.md`) — both
explicit about covering only this one area, not the full 80-section scope requested.

---

## Update by the Supreme Audit Campaign session, 2026-08-07 ~19:35 IST

- **DEF-001** (Amount field leading zero, `f97cff2`): attempted clean re-verification once
  machine load normalized (~1.35 avg, 10-core). Got past login on the first attempt, then
  hit a new, unrelated blocker before reaching the field again — see DEF-003 below. Still
  `FIX_IN_WORKTREE`, not runtime-verified. Root cause/fix reasoning unchanged from the prior
  entry.
- **DEF-002** (booking-draft staleness, `3b3891a`): fixed with a TTL index on
  `BookingDraft.updatedAt` (24h). Confirmed live in the actual shared dev database
  (`db.bookingdrafts.getIndexes()`), and **directly proved working** via a controlled
  synthetic-document test (inserted a fake 25h-stale draft, confirmed MongoDB's own TTL
  monitor removed it without any app code running) rather than waiting 24 real hours. Status
  upgraded to `TARGETED_TEST_PASS`. Also confirmed while investigating: `BookingDraft` was
  already correctly tenant- and user-scoped server-side (no leakage risk existed) and
  already cleared correctly on successful booking creation — the only real gap was staleness,
  now closed.
- **New finding, DEF-003**: the shared QA fixture login `qaclient`/`QaFixed456!` — used by
  dozens of E2E spec files across this repo — now returns `401 Invalid credentials` via
  direct API call (not a browser flake). No seed script exists to safely recreate it. This
  blocks DEF-001's final live verification and likely blocks any other E2E spec using this
  login right now. Not investigated further or fixed — flagging for whoever owns test
  fixtures in this repo.
- **Wave 1 audit campaign started**: two independent background audit agents dispatched,
  `AUDIT-AUTH-SECURITY` and `AUDIT-DATABASE-INTEGRITY`, both scoped to read-only
  source/API/live-DB-read analysis (not browser E2E, given DEF-003 and today's demonstrated
  machine-load volatility). Still running as of this update — findings will land in
  `docs/supreme-audit/AUDIT-AUTH-SECURITY-findings.md` and
  `docs/supreme-audit/AUDIT-DATABASE-INTEGRITY-findings.md` once complete.

Full detail: `docs/supreme-audit/FLEETPRO-MASTER-DEFECT-REGISTER.md`.

## TASK-MONEY-ROOTCAUSE-01 — resolved (Integrator session, money/booking-code batch, 2026-08-07 ~19:00 IST)

Closing out a saga spanning three commits and multiple sessions' independent verification
(all previously documented above): `b9e1fae` (partial), `b97cac4` (follow-up, still
~40%-reproducing per two independent sessions' confirmation), and now `eddc1b4` (this
entry) — a genuine fix, verified repeatably, not just once.

**Root cause, finally correctly identified**: RHF's Controller `field.value` was being
trusted as the Base Amount input's own displayed value. It does not reliably transition to
`undefined` in the DOM on clear (a React reconciliation/timing issue), regardless of
`type="number"` vs `type="text"` — the previous fix's hypothesis was half right (the input
type mattered for the *keystroke* symptoms) but missed that the *clear* symptom needed the
component to stop trusting `field.value` for its own display state entirely.

**Fix**: `BaseAmountField` now owns local `display` state as the single source of truth for
what's on screen — pushed into the RHF field on every keystroke, pulled back from the RHF
field only on genuine external changes (vehicle/pricing auto-calc, form.reset, draft
resume), arbitrated by a `lastPushedRef` so the two directions can't fight. Schema-level
`amount` is now optional (transient `undefined` during clear no longer fights live
`mode:"onChange"` validation); "is it filled in" enforcement moved to `onSubmit`.

**Verification, done deliberately more rigorously than prior passes given the track
record**: 15/15 across 3 consecutive full runs of the reproduction spec against a
freshly-provisioned, non-shared isolated server (not reusing cached state between runs —
the prior "4/5 vs 3/5" discrepancy between sessions was itself evidence that a single run
isn't sufficient for this specific bug). Then merged into `preview/manual-test-reconciled`
(commit `9312f52`, resolving a real conflict against `61453da`'s revert — HEAD's version at
the conflict site was literally the *original pre-fix buggy code*, since the revert had
undone the whole feature; took the fix's side, unambiguous) and re-verified live against
the actual running `:5100` Preview: 4/5 immediately, the 1 failure was a page-load timeout
in an unrelated helper function (`navigateToReviewStep` waiting on "Add Booking" — shared-
environment contention, this repo's well-documented recurring issue, not a money-field
assertion failure), confirmed as a flake by an isolated re-run (passed). **20/20 total
across all verification in this pass.**

**Note on this session's own test-environment friction**: hit account lockouts and a
`mustResetPassword`-gated admin account before finding a usable, correctly-scoped
(`role: 'client'`) test account (`democlient`, password reset to a known value directly via
a one-off script for testing purposes only — a test fixture, not production data). Worth
someone eventually fixing the underlying flakiness in this repo's shared test accounts
(the `qaclient` account referenced throughout this doc's history doesn't currently exist in
this MongoDB instance at all) so future sessions don't repeat this same investigation.

**Status: LIVE on `:5100`, verified 20/20, both prior sessions' independently-confirmed
failure modes (digit concatenation, clear-shows-stale-value) no longer reproduce.**
