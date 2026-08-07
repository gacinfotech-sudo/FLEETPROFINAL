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
