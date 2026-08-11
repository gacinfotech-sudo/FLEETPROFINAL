# FleetPro Master Defect Register

Started: 2026-08-07, by an independent audit pass in response to the "Supreme Real-World
Auditor" directive. **This register covers exactly two defects, both in the Booking Money
module — it is not a full-system sweep.** The originating directive asked for an 80-section,
all-module audit; that is realistically a multi-day, multi-session effort (this repo's own
history shows each single module — GPS, Driver, Booking, Vehicle — already took a full
dedicated 6-7-task wave to audit/build). Fabricating coverage for modules not actually
exercised would violate the directive's own core rule ("EVIDENCE > CLAIMS", "NEVER FAKE
CONFIDENCE"). This is an honest Phase-1 slice: real evidence on the two findings below,
nothing asserted about anything else.

---

## DEF-001 — Booking form "Final Base Amount" field displays a leading zero while typing

| Field | Value |
|---|---|
| Severity | **P2** (significant UX/workflow defect, not financial-correctness — see below) |
| Module | Booking — Create Booking wizard, Review & Pay step |
| Scenario | Real user (or automated browser) clears the "Final Base Amount" field and types a new value, e.g. `9797` |
| Problem | The input displays `09797` instead of `9797` — a spurious leading zero |
| Reproducible | **Yes — confirmed in 2 independent live-browser runs**, both via real Playwright automation (not code inspection), against a live dev server, real login, real DOM read |
| Evidence | Pass A (black-box): `test-results/qa03-money-and-booking-cod-06a43-*/` — `expect(uiAmountValue).toBe("9797")` received `"09797"`. Pass B (white-box): `client/src/components/booking/enhanced-booking-form.tsx:2668-2692` (pre-fix) — `<Input type="number" value={field.value \|\| 0} onChange={(e) => field.onChange(parseFloat(e.target.value) \|\| 0)} />`. |
| Root Cause | **CONFIRMED**, but not by this session — by a separate session's runtime-instrumented investigation (`fleetpro-worktrees/money-debug-trace`, documented in `docs/manual-preview/PENDING-LIVE-INTEGRATION.md` under "Root cause found — TASK-MONEY-ROOTCAUSE-01's 'stuck 0' bug"). This session's own first hypothesis (the `\|\| 0` vs `?? ""` binding pattern) was tested and **did not resolve the defect** — confirming it was the wrong layer. The actual mechanism, per that session's console-trace proof: `amount`'s Zod schema is `z.number().min(1)` (required); clearing the field makes it invalid under the resolver, and react-hook-form's `Controller` falls back to the field's *registration-time default* (`0`) instead of the live `undefined` value specifically when the value is undefined **and** the field is currently invalid — confirmed by direct trace showing `form.getValues().amount === undefined` while `field.value === 0` at the identical render, with neither `form.setValue` nor `form.reset` firing. `advanceReceived` is `.optional()`, so clearing it never makes it invalid, which is why it never showed the symptom despite using a superficially similar JSX pattern. |
| Real-World Impact | An office employee typing a corrected fare during a live customer call sees a wrong-looking number in the box while typing. **Important, independently confirmed finding: the actual computed "Remaining Balance" was correct** (₹6999 for 9797-2798, verified via the same DOM read) — so this does not miscalculate money, it only misdisplays the input field's own text during editing. This is why it's scored P2, not P0/P1 — no evidence of actual financial corruption. |
| Minimal Fix | `UI_FIX` — commit `f97cff2` on `audit/fix-money-amount-leading-zero` (worktree `fleetpro-worktrees/audit-fix-money`, branched from `manual-test-preview@2f31271`), superseding this session's earlier, ineffective `463979b`. Implements the fix approach proposed alongside the root-cause trace above (not applied anywhere until this commit): decouples the visible input value from `Controller`'s `field.value` into local component state, only handing numeric values to react-hook-form via `field.onChange`; a `useEffect` resyncs from `field.value` only when it diverges for a reason other than this input's own `onChange` (e.g. the vehicle/pricing-selection `form.setValue` calls elsewhere in the file), so it doesn't fight the user's own typing. |
| Worktree | `fleetpro-worktrees/audit-fix-money`, branch `audit/fix-money-amount-leading-zero` |
| Regression Test | `npm run check` — clean on the corrected fix. Full Playwright regression **not run** (disclosed gap, not a claimed pass). |
| Canonical Retest | **NOT COMPLETED — blocked by environment, not by the fix.** Three live-browser re-verification attempts against the corrected fix (dedicated dev server, port 5101): attempt 1 blocked by DEF-002's stale-draft dialog; attempt 2 (after working around DEF-002) hit the same dialog again; attempt 3 (after proactively clearing the draft via API) failed on unrelated timeouts/a browser-context crash once shared-machine load spiked back to ~50 mid-session. The fix itself was never actually exercised to a pass/fail verdict in this session. |
| Status | `FIX_IN_WORKTREE` → **`TARGETED_RUNTIME_PASS`** (this update, 2026-08-07 ~22:45 IST) — see below. Not yet `INTEGRATED` or `CLOSED`. |

### Update 2026-08-07 ~22:45 IST — clean runtime verdict obtained (typing behavior), financial regression partial

Ran the mandate's exact digit-by-digit test plan against commit `f97cff2` on a dedicated,
fully isolated environment (port 5310, fresh throwaway DB `fleetpro_def001_verify`, a
purpose-seeded tenant/user/vehicle — deliberately **not** the shared `qaclient` fixture,
sidestepping DEF-003 entirely rather than fixing it) under confirmed-stable machine load
(load average 1.36–3.7 on this 10-core box at test time, i.e. ~0.14–0.37 normalized).

**Inspected the actual diff first** (mandate requirement): `f97cff2` decouples the visible
input value into local `useState`, resyncing from `field.value` only via a `useEffect`
keyed on `[field.value]` — it does **not** introduce a second source of truth for
submission; `field.onChange` (the real RHF value) is still called on every keystroke, the
local state is a display-only mirror. Confirmed the `useState`/`useEffect` calls are safe
inside `Controller`'s `render` prop here specifically because this `FormField` is
unconditionally mounted ("Always editable regardless of pricing type", per the
surrounding code's own comment) — not inside a conditional branch that would violate
React's hook-call-order rule.

**Digit-by-digit typing — 9/9 PASS, unambiguous, black-box + white-box evidence
redundant:** `tests/e2e/def001-amount-typing-verify.spec.ts` (new, this session).
Every mandated sequence (9797, 6000, 5000, 10000, 1, 10, 100, 1000) plus backspace-to-empty,
asserting the *exact* intermediate input value after every single keystroke (not just the
final value) — never a leading zero at any point, backspace-to-empty allowed without a
forced stale zero. Confidence: **HIGH**.

**Financial regression + persistence (mandate section 6/7) — PARTIAL, 1/4 fully clean, 2/4
partially clean, 1/4 inconclusive:** `tests/e2e/def001-financial-regression.spec.ts` (new).
Scenario base=6000/advance=4000→remaining=2000: **full pass** — UI display, submitted
request payload, immediate fresh-GET persistence check, AND a post-`page.reload()` fresh
persistence re-check all correct, no drift, no leading zero, no trailing `0000`. (Two real,
non-app test-script bugs found and fixed along the way, disclosed rather than hidden: (a)
this codebase has no single-booking `GET /api/bookings/:id` endpoint — confirmed by reading
`server/routes.ts` — switched to filtering the list endpoint; (b) `POST /api/bookings` maps
the request body's `amount` field to the persisted document's `totalAmount` field — confirmed
by reading the handler — the test was checking the wrong field name.) Scenarios
9797/2798→6999 and 10000/9999→1: passed UI display + immediate creation + no-drift checks,
but failed specifically on the **post-refresh** re-check. Scenario 5000/2798→2202: timed out
mid-form-fill. **Machine load spiked from ~1.4–3.7 to 24.33 (55 node processes) between the
clean run and the retry that surfaced these three failures** — per the mandate's own
machine-contention rule, these are marked `TEST_DEFERRED_MACHINE_CONTENTION`, not
`VERIFIED_FAIL` — they need one more clean re-run under stable load before either confirming
a real edge-case bug or clearing them. Also directly, live-confirmed DEF-002's documented
fire-and-forget draft-clear race in passing: a just-submitted scenario's draft reappeared as
"Resume your unfinished booking?" on the very next scenario's page load within the same
automated run — test-handled (Start Fresh + explicit awaited `DELETE
/api/booking-drafts/mine`), not a new defect, but real corroborating evidence for DEF-002's
"fire-and-forget" root-cause note above.

**Confidence for the core leading-zero defect: HIGH (fix confirmed working).** Confidence
for 100% financial-regression-with-refresh coverage: **MEDIUM** (1 of 4 scenarios fully
clean end-to-end; the other 3's partial results are consistent with the fix working, not
consistent with it failing — zero leading-zero or drift assertions failed anywhere,
Reason for the 3 failures was 100% in an isolated fund/refresh test-timing seam that is
also load-correlated, not in the amount field itself).

**Next required step before `CANONICAL_RUNTIME_RETEST_PASS`/`INTEGRATED`:** re-run
`def001-financial-regression.spec.ts` once more under confirmed-stable load; if all 4 pass
cleanly, promote to `INTEGRATED` then run one more retest against the canonical preview
before `CLOSED`. Do not promote on the strength of the typing test alone — per the
mandate's own closure lifecycle, financial persistence must also be clean.

---

## DEF-002 — Server-side booking-draft autosave has no staleness cutoff, causing repeated "Resume unfinished booking?" interruptions

| Field | Value |
|---|---|
| Severity | **P2/P3** — working-as-designed feature with a rough edge, not a regression or data-integrity bug |
| Module | Booking — Add Booking wizard (draft persistence) |
| Scenario | Any user who starts filling the Add Booking form, pauses for >1.2s with unsaved changes, and later returns (or any subsequent session under the same login) |
| Problem | `GET/PUT/DELETE /api/booking-drafts/mine` (`enhanced-booking-form.tsx:324-352`) autosaves the in-progress form 1.2s after any dirty change, per-user, with **no visible expiry/staleness cutoff found in this file**. A draft from an old, abandoned, or even a *failed automated test run* persists indefinitely and re-triggers a blocking "Resume your unfinished booking?" modal on every subsequent Add Booking visit by that same user, until explicitly dismissed. |
| Reproducible | **Yes — 4/4 independent runs**, real browser automation, real API, real dialog observed via Playwright's own DOM snapshot (not inference) |
| Evidence | Live page snapshot captured on test failure: `dialog: heading "Resume your unfinished booking?"`, `paragraph: You have a booking in progress from earlier for Should Never Surface Here...` — a customer name that reads like a QA sentinel value left by an earlier, unrelated test run reusing the same fixed test login (`qaclient`). Source: `enhanced-booking-form.tsx:322-352` (draft fetch/save/discard logic). |
| Root Cause | Confirmed via source read: 1.2s debounce (`enhanced-booking-form.tsx:361-368`), no TTL/expiry field on the draft, `discardDraft()` correctly calls `DELETE /api/booking-drafts/mine` but a **new** draft can be created again within the same interrupted session if the user (or test) types anything before finishing — this is by design for real users, but means a fixed QA login shared across sequential/concurrent automated runs will contaminate itself and any other run using the same credentials. |
| Real-World Impact | For a real business user: mostly a *feature*, not a bug (matches the code's own stated intent, "don't lose organic Add Booking progress"). For QA/automation using a shared login (as this repo's several concurrent sessions have been doing all day, per `docs/manual-preview/PENDING-LIVE-INTEGRATION.md`'s own environmental-contention notes): every subsequent E2E run against a shared test tenant is at risk of an unexpected blocking dialog, producing false "timeout" failures that look like application bugs but are actually test-hygiene collisions — this exact confusion consumed significant investigation time in this session and in the earlier `qa-money-booking-03` QA pass. |
| Minimal Fix | `INDEX_FIX` — commit `3b3891a` on `audit-fix-money`: TTL index on `BookingDraft.updatedAt`, `expireAfterSeconds: 86400` (24h). MongoDB's own TTL monitor handles cleanup; no application code changed. Also confirmed already-correct: tenant/user scoping (server-derived, never client-supplied) and clear-on-success (`enhanced-booking-form.tsx:705`) — neither needed a fix. |
| Worktree | `fleetpro-worktrees/audit-fix-money`, branch `audit/fix-money-amount-leading-zero` (shared with DEF-001's fix — same domain, same worktree, separate commits) |
| Regression Test | `npm run check` — clean |
| Canonical Retest | See campaign-status note above: `TARGETED_TEST_PASS` via a controlled synthetic-document TTL smoke test against the live shared database. Not yet a full UI-level `CANONICAL_RUNTIME_RETEST_PASS` (blocked by DEF-003). |
| Status | `ROOT_CAUSE_CONFIRMED` → `FIX_IN_WORKTREE` → **`TARGETED_TEST_PASS`** |

---

---

## DEF-003 — Shared QA fixture login `qaclient` is broken (test-infrastructure, not app defect)

| Field | Value |
|---|---|
| Severity | Not a product severity — **test-infrastructure blocker**, but high-impact: this login is used by dozens of E2E spec files repo-wide (`advance-payment.spec.ts`, `app-shell.spec.ts`, `availability-engine.spec.ts`, `qa03-money-and-booking-code.spec.ts`, and more) |
| Module | Test fixtures / shared dev database |
| Scenario | Any E2E spec calling `login(page, 'qaclient', 'QaFixed456!')` |
| Problem | Direct API login attempt returns `401 {"message":"Invalid credentials"}` — confirmed via raw `curl` (CSRF token fetched correctly, POST `/api/auth/login` rejected), not just a flaky browser test |
| Reproducible | Yes, deterministic — confirmed via direct API call, not browser automation |
| Evidence | `curl -X POST http://127.0.0.1:5101/api/auth/login -d '{"userId":"qaclient","password":"QaFixed456!"}'` → `HTTP 401`, `{"message":"Invalid credentials"}` |
| Root Cause | **Not investigated.** Most likely: another concurrent session (this repo has 20+ active today) reset, deleted, or changed the password of this shared fixture user in the shared dev database as a side effect of unrelated work (e.g. an auth/security test). No dedicated seed script for `qaclient` was found in `scripts/`, so it cannot be cheaply/safely recreated without risking a mismatched user (wrong tenant, wrong permissions) that breaks the dozens of other specs relying on it differently. |
| Real-World Impact | None directly (test-only fixture, not a real tenant). Indirect impact: blocks reliable E2E verification for DEF-001 and any other spec using this login, repo-wide, until fixed. |
| Minimal Fix | Not attempted — out of scope for this pass. Whoever owns test-infrastructure conventions in this repo should either (a) recreate the exact fixture (needs to know its original tenant/permissions setup, not guessed here) or (b) add a proper seed script so this stops being a manually-maintained, fragile, shared mutable fixture across 20+ concurrent sessions. |
| Status | `DISCOVERED`, not investigated further |

---

## DEF-004 — Two divergent, unreconciled "canonical" Preview lineages, gap widening over time

| Field | Value |
|---|---|
| Severity | **Infrastructure/process risk, not an app defect** — but real product impact: stakeholders testing on one Preview will not see features that only exist on the other |
| Module | Repository integration process (not a single app module) |
| Scenario | Two separate concurrent sessions each independently reconciled "missing from trunk" work into what each treated as *the* canonical Preview |
| Problem | `fleetpro-worktrees/manual-test-preview` (`preview/manual-test-reconciled`) and `fleetpro-worktrees/fleetpro-stable-demo` (`runtime/stable-demo`) have diverged and neither is a superset of the other. `manual-test-preview` (this session's own prior work, commit `168d205` at time of writing) carries the full Root Control Plane (Wave 1: platform roles, Root Dashboard, Tenant 360, Global Customer DB, PII masking, Support/Break-Glass, audit log) and this session's DEF-001/DEF-002 evidence trail. `fleetpro-stable-demo` (commit `62d176c`, port 5051) carries a separately-rescued telephony/RBAC/WebSocket batch, Booking Queues, and a customer-search race-condition fix that **do not exist on `manual-test-preview`'s lineage at all**. |
| Reproducible | Yes — directly confirmed by reading `docs/master-closure/FLEETPRO-GAP-REGISTER.md` (written by the other campaign, flagging this exact split as its own top-priority unresolved item, already at commit `06c623d` for `:5100` at the time that report was written — `:5100` has advanced substantially since, widening the gap further) and independently cross-checking `git log` on both worktrees in this session. |
| Root Cause | Structural: this repo runs a very high number of concurrent Claude Code sessions (50+ worktrees observed today) with no single locked "the Preview" pointer — two sessions each correctly followed the repo's own "promote to canonical Preview" convention, but pointed it at two different worktrees/ports (`:5100` vs `:5051`) without either being aware of the other's promotion at the time. |
| Real-World Impact | Anyone manually testing against `:5051` will not see the Root Control Plane; anyone testing against `:5100` will not see the rescued telephony/RBAC/WebSocket/Booking-Queues batch. A future merge of either branch into the other risks a large, high-conflict-surface merge (both branches have independently touched `server/routes.ts`, `client/src/App.tsx`, and other Integrator-only shared files). |
| Minimal Fix | Not attempted this session — this is a decision for whoever owns Preview promotion policy, not something to resolve unilaterally without risking loss of one side's verified work. Recommended next step (per the other campaign's own Gap Register and this session's independent agreement): diff the two lineages' unique commits, pick one as the single forward canonical, cherry-pick or re-integrate the other side's unique work onto it, then treat the loser as archived. |
| Status | `DISCOVERED`, flagged for whoever next does integration/Preview-promotion work. Not this session's task to resolve unilaterally. |

---

## Campaign status update, 2026-08-07 ~19:20 IST (continuing the same audit session)

Responding to a follow-up directive to convert this into a multi-worker campaign and push
DEF-001/DEF-002 toward verified closure.

- **DEF-001**: attempted a clean live re-verification once shared-machine load dropped back
  to normal (load average ~1.35 on a 10-core machine, down from ~50). Got through login
  successfully on the *first* clean-load attempt... then hit DEF-003 (the shared test login
  itself broke) before ever reaching the Amount field again. **Still not runtime-verified.**
  Status remains `FIX_IN_WORKTREE`, fix is `f97cff2` — unchanged, root cause and fix
  reasoning unchanged, just still awaiting a clean pass.
- **DEF-002**: implemented the fix (TTL index on `BookingDraft.updatedAt`, 24h) — see commit
  `3b3891a` on the same `audit-fix-money` worktree/branch. `npm run check` clean.
  **TARGETED_TEST_PASS achieved**, via a safer method than waiting 24 real hours: (1)
  confirmed the index actually landed in the live shared dev database —
  `db.bookingdrafts.getIndexes()` shows `{name: "updatedAt_1", expireAfterSeconds: 86400}`;
  (2) inserted one synthetic, clearly-labeled throwaway draft
  (`userId: "ttl-smoke-test-throwaway"`, fake `tenantId`) with `updatedAt` set 25 hours in
  the past; (3) polled the same collection until it disappeared — **confirmed removed by
  MongoDB's own TTL monitor**, no manual deletion. This directly exercises the fix's actual
  mechanism, not just its presence. Not yet a full `CANONICAL_RUNTIME_RETEST_PASS` (that
  would mean reproducing the original "Resume unfinished booking?" dialog scenario
  end-to-end through the real UI, which is blocked by DEF-003) — but the underlying
  mechanism is now directly, controllably proven to work, which is the strongest evidence
  practically obtainable for a 24h-TTL fix without literally waiting a day.
  **Status: `FIX_IN_WORKTREE` → `TARGETED_TEST_PASS`.**
- **Wave 1 audit lanes launched**: `AUDIT-AUTH-SECURITY` and `AUDIT-DATABASE-INTEGRITY`,
  both dispatched as independent background agents, both scoped to read-only
  source/API-contract/live-DB-read analysis (explicitly not live browser E2E, given DEF-003
  and today's demonstrated machine-load volatility). Findings will land in
  `AUDIT-AUTH-SECURITY-findings.md` and `AUDIT-DATABASE-INTEGRITY-findings.md` in this same
  directory once they complete — not yet available as of this update.
- **Not yet launched**: Session/Reliability (Wave 1d), and all of Wave 2-4 (Customer, Driver,
  Vehicle, Vendor, GPS, Telephony, WhatsApp, Root control plane, Performance, Accessibility,
  persona/chaos scenarios). Genuinely not started — not implying otherwise.

## Wave 1 audit lanes complete, 2026-08-07 ~20:05 IST

Both background lanes finished. Full detail in their own files (kept separate per the
campaign's file-ownership convention, not merged into this register to avoid a
concurrent-write collision — this file has been edited by multiple sessions today).

**`AUDIT-AUTH-SECURITY-findings.md`**: 0 P0, 0 P1, 0 P2, 3 P3 (SEC-001 non-tenant-scoped
idempotency lookup in the rewards ledger, safe today only by caller convention; SEC-002 a
driver-portal route allow-list test that's drifted one route stale, reproduced as
currently-failing; SEC-003 several dead/inconsistent `PERMISSIONS` constants). HIGH
confidence tenant isolation is sound for everything sampled (~60 route handlers read
end-to-end, zero `req.body.tenantId`/`req.query.tenantId` reads found anywhere in
`server/`). Explicitly found the campaign brief's hypothesized "two superuser mechanisms"
risk does **not** exist in this repo/commit — only one (`role==='admin'`). Telephony
coverage deferred (source absent from the assigned tree) to two pre-existing documents
under `docs/master-closure/` — see below.

**`AUDIT-DATABASE-INTEGRITY-findings.md`**: DB-001 (P2, HIGH) — `bookingCode` uniqueness is
global, not tenant-scoped, the one exception to an otherwise fully-consistent
tenant-scoping convention across this entire schema; mitigated by a 10-attempt retry loop,
not currently causing failures. DB-002 (P3, HIGH) — **the shared dev database's live
schema is a blend of many divergent, unmerged worktree schemas and does not reliably
represent `fleetpro-main` trunk**, demonstrated with four concrete mismatches in both
directions; this is a methodology risk for the whole campaign, not an app bug, and this
document keeps live-DB and trunk-source evidence labeled separately for exactly that
reason. DB-003/DB-004 (P3 each) — missing indexes on `Driver.phone` (full cross-tenant
scan on every driver login, by design) and `Booking.customerId`. Live data-integrity
checks (5 requested) all came back `INSUFFICIENT_EVIDENCE`, not PASS — the target database
had 0-1 documents in every relevant collection at check time, so "0 violations found" means
"nothing to violate," not "verified clean."

## Important discovery: a parallel, already-substantial audit campaign exists

`docs/master-closure/findings-security-testinfra.md` and `findings-telephony-whatsapp.md`
were found and read in full by the AUDIT-AUTH-SECURITY lane. They cover materially
overlapping ground (91 tenant-scoping call sites, SEC-001 through at least SEC-014,
telephony/WhatsApp specifically) under a different campaign name, run by a different
concurrent session, dated the same day. **Before launching further Wave 2+ lanes, it's
worth reading that campaign's full scope** — continuing this campaign's Wave 2-4 without
checking `docs/master-closure/` first risks substantial duplicated effort across modules
that campaign may have already covered.

## What this register does NOT cover

Per the directive's own 80-section scope: Customer, Inquiry, Lead, Quotation, Payments
beyond the two scenarios above, Driver, Vehicle, Vendor, GPS, Telephony, WhatsApp, Google
Drive, RBAC, Root/Platform control plane, performance, reports, rewards, settings,
tenant-isolation hostile testing, concurrency/idempotency red-teaming, security deep audit,
accessibility, backup/restore, and every persona/chaos scenario in sections 5-6 — **none of
these were exercised in this pass.** Extending this register to real, evidence-backed
coverage of those areas is a substantial multi-session effort, consistent with how every
other module in this repository has actually been built and audited (dedicated task waves,
not a single pass).

---

## Final closure update — 2026-08-07 ~23:40 IST (Canonical Reconciliation + Defect Closure Director pass)

Executed the DEF-004 reconciliation, then used the resulting canonical candidate for
DEF-001's final closure and DEF-002's repair, per the controlling directive's explicit
priority order. Full evidence trail: `.claude/runtime/PREVIEW-RUNTIME.json`'s
`promotion_history` entry for `f9a9aa2 -> 97934cd`.

### DEF-004 — CLOSED

Built the reconciliation in an isolated worktree (`fleetpro-final-canonical`, branch
`integration/fleetpro-final-canonical`), based on `:5051`'s actual code ancestry (not a
port-number choice) — it was already the more complete lineage (trunk's Vehicle 360 +
Telephony/RBAC + DEF-001/DEF-002 fixes), missing only Root Control Plane, which was the
one deliberate, explicit gap left by the prior reconciliation pass. Merged
`integration/root-control-plane-wave1` (`bead79e`) onto it — 2 real conflicts, both
purely additive imports/route-mounts, nothing dropped from either side. Verified
`isPlatformRole()` fail-closed hardening survived the merge (live-tested: bare legacy
`role:'admin'` still 403s on `/api/root/**`). Applied P0-1's fix (the shared-DB-wipe
vulnerability in the Root test suite's own `dropDatabase()` calls) as a required
prerequisite for safely bringing that test suite into the canonical lineage. 132/132
tests passing. Live-smoke-tested on an isolated port before promotion: Root security,
tenant isolation (fresh test tenants via the app's own admin APIs — cross-tenant
Customer/Booking reads 404, cross-tenant Root access 403), and route registration across
Telephony/Booking-Queues/Driver/Vehicle/GPS/Root.

While preparing promotion, found `runtime/stable-demo` had advanced further (Vehicle
Safety-Eligibility, `c238aa3`) and had real, tested, **uncommitted** work sitting in its
working tree — the SA-01 session-death fix and a new `GET /api/bookings/:id` endpoint,
explicitly flagged in `PREVIEW-RUNTIME.json`'s own coordination note as needing inclusion
in "the next rebuild/promotion cycle." Merged the former, applied the latter, verified
both. Confirmed byte-for-byte that stable-demo's dirty working tree was a strict subset
of the final candidate commit before discarding it — nothing lost.

Fast-forwarded `runtime/stable-demo` to the final commit (`97934cd`), rebuilt for
production, and found `.env` had been **silently rewritten a second time** (same failure
signature as the incident `PREVIEW-RUNTIME.json` already documented — `PORT=5200`
instead of `5051`) — restored just the two wrong keys, left everything else (encryption
keys, LAN-safety overrides) alone since those were still correct. Restarted PID `1548` by
exact PID (confirmed dead before restarting) — new PID `7687`. Live-verified the actual
promoted `:5051`: root page 200, login 200, Root security 403 for bare admin, new
endpoint registered, Telephony registered. Stopped `:5100` (`manual-test-preview`, PID
`98221`) by exact PID — confirmed fully superseded first. `:5050` (trunk itself) left
running/untouched — active multi-session dev trunk, not a preview, out of scope.

**Result: ONE canonical lineage, ONE canonical runtime (`:5051`), old conflicting runtime
classified and stopped.** `PREVIEW-RUNTIME.json` updated as the single source of truth.

### DEF-001 — CLOSED

Full mandated closure suite (8 digit sequences + backspace-to-empty, all 4 financial
scenarios with create/refresh/persistence checks) run against the exact commit
(`97934cd`) that then became the live canonical `:5051` — same code, verified before and
smoke-confirmed live after promotion. **9/9 typing, 4/4 financial**, both on isolated
sequential runs under confirmed-stable machine load (load average 1.90–2.90 on this
10-core box, ~0.19–0.29 normalized). One combined/concurrent run produced 9 timeouts
while this same session was simultaneously running a separate heavy unit-test suite in
the foreground — zero were value-mismatch assertions (all pure element-visibility/timing
timeouts), correctly attributed to self-inflicted machine contention rather than
reopening the defect. Closure lifecycle: `FIX_IN_WORKTREE` → `TARGETED_RUNTIME_PASS` →
`INTEGRATED` → `CANONICAL_RUNTIME_RETEST_PASS` → **`CLOSED`**.

### DEF-002 — FIXED, primary race resolved and corroborated live (not exhaustively matrix-tested)

Root cause confirmed exactly as hypothesized: `enhanced-booking-form.tsx`'s `onSuccess`
handler fired the draft-clear `DELETE /api/booking-drafts/mine` without awaiting it,
inside a handler that was already `async`. Fixed by awaiting it — minimal, one-line-plus-
comment change, no rewrite. Server-side scoping (`{tenantId, userId}`, always
server-derived) and the 24h TTL index were both already correct and needed no change.
Indirect but real corroboration: all 4 DEF-001 financial-regression scenarios ran
back-to-back on the same test account with real successful bookings each time, with no
run requiring the "Start Fresh" stale-dialog workaround to activate. **Not exhaustively
re-run against the full test matrix** (wrong-tenant/wrong-user restore denial, validation-
failure-preserves-input, explicit discard) — those specific properties were verified by
direct source read (the routes are already correctly scoped, the `onError` handler
already never touches the draft) rather than fresh runtime tests this pass. Status:
`ROOT_CAUSE_CONFIRMED` → `FIX_IN_WORKTREE` → **fixed and live on canonical `:5051`**, not
formally `CLOSED` pending a full matrix run.

### DEF-003 — still OPEN, unchanged

Not investigated this pass either — this session's DEF-001 verification again sidestepped
it with dedicated fixtures (`fc-client-a`/`fc-client-b` via the app's own admin APIs, not
`qaclient`), same as the prior pass. `qaclient`'s actual state was not re-checked.

---

## Session/Reliability lane — 2026-08-07 ~23:48 IST (run against promoted canonical :5051)

Next item in the priority chain after DEF-004/DEF-001/DEF-002. Run against the actual
promoted canonical (`:5051`, commit `97934cd`), not a stale candidate.

**Real finding, not a defect:** the app has a working IP-based login rate-limiter
(confirmed live: `429 {"message":"Too many failed login attempts...","retryAfter":92}`
after ~20 rapid `POST /api/auth/login` calls from one test machine's single IP within a
few minutes). First test design (fresh login per scenario) tripped this on its own first
run — restructured to log in 10 dedicated fixture users (`sr-user-1..10`, each its own
throwaway tenant, cleaned up after via the real `DELETE /api/admin/tenants/:id` route)
once and reuse those sessions across every scenario, both more realistic and the only way
to safely exercise concurrency from a single source IP.

**8/8 PASS** (`tests/e2e/session-reliability.spec.ts`, committed to `runtime/stable-demo`
at `b2ce184`): 1 session (cross-module nav, refresh, identity preserved) · 5 concurrent
already-authenticated sessions (no identity bleed) · 10 concurrent (same, higher scale) ·
multiple tabs sharing one login · cross-module concurrent activity (Booking/Driver/
Vehicle reads from 3 sessions at once) · WebSocket client connects without crashing the
server (0 uncaught client errors) · short idle-then-resume · final health check (server
still responsive, all 10 sessions still individually valid). No server crash, no error-
log entries, DB collection count unchanged (84) before/after. Confidence: **HIGH**.

**Not covered this pass:** long-duration idle (real session-timeout boundary, only a
short ~8s idle was tested), a genuinely distributed multi-IP concurrent-login scenario
(not practically simulable from one test machine — this is exactly what the confirmed
rate-limiter would need real multi-IP traffic to test safely), and the SA-01 fix's own
target scenario (a live MongoDB reconnect blip during an active session) was not
independently re-triggered this pass — trusted the merging session's own reported 16/16
`telephony-isolation.spec.ts` result rather than re-running it, since re-verifying it
here would mean deliberately destabilizing the canonical database connection.
