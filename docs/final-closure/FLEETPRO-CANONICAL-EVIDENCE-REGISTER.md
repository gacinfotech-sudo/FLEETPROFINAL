# FleetPro Canonical Evidence Register

**Authoritative status document, per the Master Audit Reconciliation directive.** Supersedes
`docs/master-closure/` and `docs/supreme-audit/` for status purposes — those remain evidence
sources, not competing conclusions. See `FLEETPRO-CONTRADICTION-REGISTER.md` for the specific
claims reconciled and `FLEETPRO-PRIORITIZED-FIX-QUEUE.md` for what to do next.

## Method, honestly stated

This is **not** a from-scratch re-verification of all 183 master-closure rows plus supreme-audit's
findings. Per the directive's own instruction ("do not re-audit 183 requirements from zero... use
existing evidence... only re-run when current code changed, evidence is stale, campaigns conflict,
or a critical feature requires closure"), this pass:

1. Froze current git/runtime state (below).
2. Read both campaigns in full (11 master-closure files, 4 supreme-audit files).
3. **Re-verified every claim that could plausibly be stale** — specifically, everything about
   Driver, GPS, and Vehicle domain integration (both campaigns' most emphasized findings), via
   direct `git merge-base --is-ancestor` checks against **current** trunk/preview commits (not
   the audit-time commits the campaigns used) and direct filesystem/route-registration checks.
4. **Did not re-verify** Booking/Financial, Customer/Vendor, Telephony/WhatsApp, or Security
   findings beyond spot-checks, because this session has not touched those domains and had no
   specific reason to suspect staleness there (confirmed via targeted spot-checks: bookingCode
   absence, money-bug pattern, telephony absence, RBAC role count — all still match).
5. Investigated and resolved one live, blocking incident (DEF-003 root cause + a database
   near-total-wipe) discovered while trying to runtime-verify anything at all.

## Current system state (frozen at start of this pass)

```
CURRENT TRUNK:            booking/integration-preview @ 89a0454
                           (fleetpro-main-p0-fixed/fleetpro-main)

RUNNING PROCESSES (3 divergent lineages, confirmed live via lsof + curl):
  :5050  trunk itself (booking/integration-preview @ 89a0454)          — dev mode
  :5051  fleetpro-stable-demo (runtime/stable-demo @ 2599d48)          — prod build
         labeled "canonical" by .claude/runtime/PREVIEW-RUNTIME.json
  :5100  manual-test-preview (preview/manual-test-reconciled @ 168d205) — dev mode
         labeled "canonical" by docs/supreme-audit/FLEETPRO-EXECUTIVE-REAL-WORLD-AUDIT.md
  :5106  vehicle-integration worktree (this session's own follow-up work) — dev mode, not a preview

DATABASE: mongodb://127.0.0.1:27017/fleetpro — shared by nearly every worktree (BUG-TEST-DB-001,
          confirmed to have just caused a real incident — see below)

LINEAGE RELATIONSHIP (git merge-base, this pass):
  trunk ∩ :5051   = e17f9fb (TASK-GPS-QA-SECURITY-07) — trunk has 14 unique commits since
                    (the entire Vehicle 360 batch); :5051 has ~22 unique commits since
                    (Telephony/RBAC, UI-responsive, perf-QA, booking-code, money-rootcause-revert,
                    webhook-dedupe-fix, driver/GPS route-wiring fix, booking-details fix)
  :5051 ∩ :5100   = 2f31271-adjacent — neither is an ancestor of the other; :5100 additionally
                    has the entire 7-task Root Control Plane batch that :5051/trunk lack; :5051
                    has ~22 later commits :5100 lacks
  trunk ∩ :5100   = never converged (no common integration pass)

  Practical read: trunk = (shared GPS/Driver/booking foundation) + Vehicle 360 (exclusive).
  :5051 = (same foundation) + Telephony/RBAC/UI/perf/money-fixes (exclusive).
  :5100 = (same foundation, slightly older) + Root Control Plane (exclusive), missing :5051's
  newest 22 commits. No lineage is a superset of the other two.
```

## Domain-level status (headline correction from both campaigns)

| Domain | master-closure verdict (audit-time trunk `20bd273`) | **Current trunk (89a0454), this pass** | Current `:5051` | Current `:5100` |
|---|---|---|---|---|
| **Driver 360** | "Confirmed fully unintegrated" | ✅ Integrated — domain/documents/handover routes registered, `lifecycleStage` schema patch applied, `/api/attendance/daily` registered, isolated QA-security test suite present | ✅ Integrated (shares pre-divergence ancestry with trunk) | Very likely ✅ (shares older pre-divergence ancestry) — not independently re-curled this pass |
| **GPS** | "Neither worktree reachable from trunk or Preview... registry deliberately empty" | ✅ Integrated — Traccar adapter **registered** in `runtimeRegistry.ts`, ingestion/billing/Fleet-UI/QA-suite (17 spec files) all present | ✅ Integrated (same reasoning) | Very likely ✅ — not independently re-curled |
| **Vehicle 360** | "Almost entirely unbuilt... nothing merged" | ✅ Fully built and merged (7-task manifest + 5 follow-ups, this session) | ❌ Absent — confirmed via curl (`/vehicles/:id` → generic SPA shell, not the real page) | ❌ Absent (no ancestry path) |
| **Telephony** | "Server/telephony does not exist in trunk" | ❌ Still absent — confirmed via `find`/`grep`, unchanged | ✅ Present (part of `:5051`'s exclusive 22 commits) | ❌ Absent (predates telephony work per master-closure's own ancestry table) |
| **Root Control Plane** | Not covered (didn't exist as a concept yet in master-closure's scope) | ❌ Absent | ❌ Absent | ✅ Present — 7-task batch, exclusive to this lineage |
| **WhatsApp** | "Present in trunk, 4,729 real messages" | ✅ Still present in code (the *data* was wiped in the incident below — see DB-002) | ✅ Present | ✅ Present |
| **Booking core / Payments / Invoices** | "~19/38 VERIFIED_COMPLETE, real and correct" | ✅ Not re-verified this pass beyond spot-checks; no reason to suspect regression | ✅ | ✅ |
| **Customer/Inquiry/Lead/Vendor 360** | "~20/35 VERIFIED_COMPLETE, substantially real" | ✅ Not re-verified this pass beyond spot-checks | ✅ | ✅ |

## Confirmed still-open, real, current defects

- **BUG-MONEY-001 / DEF-001** (leading-zero in money input fields): confirmed still present in
  current trunk source (`enhanced-booking-form.tsx`, several fields still use the
  `value={field.value || 0}` pattern). A fix (`f97cff2`) exists in the `audit-fix-money` worktree,
  self-reported as **not yet verified working**. **A concurrent session appears to be actively
  working this worktree right now** (live process observed this pass) — do not duplicate.
- **DEF-003 (qaclient login) — now RESOLVED.** Root cause: an accidental `dropDatabase()` against
  the shared `fleetpro` database (see incident report below), not a credentials/session bug as
  hypothesized by supreme-audit. A concurrent session recreated the fixture; this pass
  independently verified it logs in cleanly (200, correct tenant, no forced-reset flag).
- **RBAC role model**: still a hard 3-value enum (`admin`/`client`/`manager`) vs. the 6-role
  requirement, on every lineage. Unchanged, real, unresolved.
- **`bookingCode` tenant-scoping (DB-001)**: applies to `:5051`/`:5100` (where it's live), not
  trunk (where it doesn't exist yet). Global uniqueness, not tenant-scoped — real but currently
  mitigated by a retry loop, not causing active failures.
- **Shared dev database methodology gap (DB-002 / BUG-TEST-DB-001)**: confirmed, and this pass
  found direct proof it already caused real damage (below) — not theoretical.

## Incident: near-total database wipe (discovered and root-caused this pass)

**What happened:** at **19:23:39 IST** (and four more times between 19:10:58–19:23:39), the
shared `fleetpro` database was hit with `dropDatabase()`, removing 49-50 collections each time.
Confirmed via direct `mongod.log` inspection (`dropDatabase - starting`, `"db":"fleetpro"`,
`numCollectionsDropped:50`). Impact, confirmed by direct collection counts: `vehicles`, `drivers`,
`gpsconnections`, `gpsdevices`, `vehiclegpsassignments` all at 0; `whatsappmessages` dropped from
4,729 (per supreme-audit's own count) to 1; `tenants` dropped to 3 (all recreated after the
incident); `bookings` to 1.

**Root cause:** `server/root/__tests__/salesConfigModels.test.ts` (present in `root-sales-config`,
`root-integration`, `manual-test-preview`) defaults to an isolated
`mongodb://127.0.0.1:27017/fleetpro_test_sales_config` database **only if `MONGODB_URI` is not
already set** (`process.env.MONGODB_URI || '...fleetpro_test_sales_config'`). Because nearly
every worktree's own `.env` sets `MONGODB_URI` to the **shared** `fleetpro` database (this is
BUG-TEST-DB-001, independently flagged by both campaigns), that fallback never activates when the
test is run in a normal `.env`-loaded context — the test's own `beforeAll`/`afterAll`
`dropDatabase()` calls, intended to reset its own isolated DB, instead reset the shared one.

**Status:** not recurring — no further `dropDatabase` against `fleetpro` in the 3+ hours since.
`qaclient`'s tenant was independently recreated by a concurrent session and verified working by
this pass. This pass created and then deleted one orphaned duplicate tenant during its own
(superseded) recreation attempt — cleaned up via the real `DELETE /api/admin/tenants/:id` route,
confirmed removed.

**Not fixed this pass:** the underlying unsafe fallback pattern still exists in the three
worktrees named above (not this session's to edit — they belong to other tasks/sessions) and
could recur if triggered again from a context where `MONGODB_URI` is preset. See Fix Queue.

## What was NOT done this pass

- Full row-by-row re-verification of all 183 master-closure requirements — used existing evidence
  per the directive's own instruction, re-verifying only the domains with plausible staleness.
- Runtime (authenticated, live-browser) re-verification of anything — the database incident above
  made this unsafe/meaningless for most of this pass; `qaclient` was only confirmed working again
  near the end.
- Reconciling the 3 divergent lineages into one canonical preview — a real, substantial merge
  (trunk + `:5051`'s Telephony/RBAC/perf/money work, then `:5100`'s Root Control Plane) that
  the directive itself says should follow this register, not be rushed into it.
- Fixing BUG-MONEY-001 — a concurrent session is actively in that worktree right now.

---

## Update appended by a separate concurrent session, 2026-08-07 ~23:00 IST

The P0-3 lineage-reconciliation item above (deliberately not rushed into this register) was
completed, separately, in parallel by this session — working from `:5051` outward rather than
this register's proposed trunk-first direction, but converging on the same target: **`:5051`
(`fleetpro-stable-demo`) is now a strict superset of current trunk plus its own prior unique work,
promoted and independently re-verified.**

Concretely, since this register's `:5051 @ 2599d48` snapshot above:

1. **Merged current trunk (`fd969a4`, one commit past this register's `89a0454`) into `:5051`'s
   lineage.** This brought Vehicle 360 (all 18/19 tabs, confirmed live: `GET /api/vehicles/<id>/documents`
   and `/maintenance-records` return `401`, not the SPA-fallback `200` this register's CTR-005
   found) onto `:5051` for the first time. 3 merge conflicts (`server/index.ts`,
   `server/middleware/permissions.ts`, `server/routes.ts`) — all were side-by-side additive
   overlaps (telephony/WebSocket vs. GPS-polling-scheduler imports; telephony vs. Vehicle-360
   permission constants; route-registration ordering), nothing dropped from either side.
   `npm run check` clean, production build succeeded.
2. **Merged the DEF-001/DEF-002 fix branch (`audit-fix-money` @ `3b3891a`) into the same lineage**
   — the "concurrent session actively in that worktree" this register flagged turned out to be
   this session; the fix was already committed and ready to merge, not still in progress.
3. **Independently ran DEF-001's real runtime verification** — the exact gap this register and
   the defect register both explicitly left open ("Do NOT mark solved... Required closure: clean
   runtime typing test"). Built a dedicated, isolated tenant/user/vehicle via the app's own
   `/api/admin/tenants` + `/api/admin/users` + `/api/vehicles` APIs (not direct DB writes) to
   avoid DEF-002/DEF-003 contamination entirely, then ran the pre-existing
   `tests/e2e/def001-amount-typing-verify.spec.ts` against the real running server: **8/8 digit
   sequences (9797, 6000, 5000, 10000, 1, 10, 100, 1000) typed digit-by-digit, zero leading-zero
   artifacts at any intermediate keystroke, real browser, real DOM reads.** One test in the same
   file failed on both runs — not the leading-zero symptom, but a *different*, previously
   undocumented issue: backspacing the Amount field to empty reverts it to the vehicle's day-rate
   instead of staying empty. Logged as a new, distinct, NOT-yet-closed finding — see
   `FLEETPRO-CONTRADICTION-REGISTER.md` CONTRA-006. **DEF-001's original reported symptom
   (leading zero while typing) is now genuinely CANONICAL_RUNTIME_RETEST_PASS.**
4. **Discovered `:5051`'s own `.env` (gitignored, invisible to every git-based check both
   campaigns ran) had been silently rewritten by a third concurrent session** — `PORT=5200`,
   `NODE_ENV=development`, and all three LAN-safety overrides removed — causing an `EADDRINUSE`
   crash on restart. Restored the correct production settings while preserving two new
   encryption-key variables (`TELEPHONY_CREDENTIAL_ENCRYPTION_KEY`,
   `DRIVER_DOCUMENT_ENCRYPTION_KEY`) the newly-merged code now legitimately needs. **This is a
   real, structural risk worth flagging prominently: `.env` state cannot be verified or reasoned
   about via any git-based audit method, including everything both campaigns did.**
5. **Discovered `:5051` had *also* independently received its own direct cherry-pick of the same
   Vehicle 360 batch from a fourth concurrent session** (7 commits, `50189c5` "Final Vehicle 360
   Integrator" — same task subjects as trunk's, different commit hashes, applied directly to the
   preview rather than through trunk). Merged the two lineages, preferring the more complete side
   in each conflict (verified: this session's trunk-derived version had `registerGpsVehicleStateRoutes`/
   `registerVehicleInspectionRoutes` that the direct-to-preview lineage was missing entirely, and
   a real Daily Inspections implementation vs. that lineage's honest "not built yet" placeholder).

**`:5051` current commit: `f9a9aa2`.** Full promotion history, verification evidence, and the
`.env` incident are recorded in `.claude/runtime/PREVIEW-RUNTIME.json`.

**Still not done, unchanged from this register's own list**: `:5100`'s exclusive Root Control
Plane batch (7 tasks) has not been evaluated or merged — genuinely deserves its own deliberate
pass, not a rushed fold-in at the tail of an already-long session. `qaclient` reconfirmed still
working against the now-current `:5051`.
