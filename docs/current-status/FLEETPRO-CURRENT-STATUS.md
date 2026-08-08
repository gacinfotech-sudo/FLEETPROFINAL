# FleetPro — Live Development Status Audit

Generated: 2026-08-07, this session. Read-only audit — no product code changes made while
producing this document (two unrelated fixes from an earlier task this same session remain
uncommitted in the working tree; noted below, not repeated as new work).

## Methodology / honesty note

This is a time-bounded audit of a **very large, currently-live** repository — 30+ Git
worktrees, most with independent unmerged commits, several concurrent Claude Code sessions
observed actively committing to shared branches *during* this audit. Every status below is
backed by one of: a file/route/model actually read, a `git log`/`git ls-tree` check against
a specific commit, an existing task report, or a live HTTP check — never inferred from a
menu item or a task's *title* alone. Where I did not gather enough evidence to be confident,
the status is **❓ STATUS UNKNOWN — AUDIT REQUIRED**, not a guess dressed up as a finding.
Full regression and production-build test suites were **not re-run** in this pass (would
take longer than this audit's scope and this shared server is under heavy concurrent load
from other sessions right now) — evidence for those comes from existing task reports and
one confirmed recent build artifact, called out explicitly where that's the case.

## Critical infrastructure finding (read this first)

**The currently-running preview (`fleetpro-main`, port 5050) is on a different, less-complete
integration lineage than the most advanced commit that already exists elsewhere in this
same repo.**

- `fleetpro-main` is on branch `booking/integration-preview` @ `20bd273`.
- Three other worktrees (`money-rootcause`, `booking-code`, `reconcile-trunk-booking`) are
  all sitting at commit `200919b`, titled *"Reconcile: merge booking/integration-preview
  (6-task booking manifest) into TASK-01-05 integration (9d2bd9c)"* — i.e., someone already
  did the work of merging the booking-domain work with the earlier TASK-01–05 integration
  (which includes **telephony**, among other things).
- `git merge-base --is-ancestor 20bd273 200919b` → **false**. These have diverged, not one
  simply ahead of the other — `20bd273` was committed to `fleetpro-main` directly (a
  same-session "Fix double-booking race" commit) *after* the point both lineages last
  shared history (`7fc47a5`), while `200919b` reconciled the same base point with the
  telephony/TASK-05 line in a different worktree. Nobody has yet merged these two forward
  paths back together.
- Concretely: `server/telephony/` has **0 files** on the currently-serving `20bd273`, but
  **11 files** on the already-reconciled `200919b`. Anyone testing telephony against
  `localhost:5050` right now is testing a build that doesn't have it, even though a working
  version exists two worktrees away.

**Recommended next action (not performed in this audit, per "do not modify product code
first"):** a deliberate reconciliation merge of `20bd273` (fleetpro-main's own new commit)
into the already-reconciled `200919b` lineage, then promote *that* as the one preview branch
everyone points at. Until that happens, "what's actually running on :5050" and "what's the
most complete integrated state" are two different answers — treat every status below as
scoped to **what's on the currently-serving branch**, with unintegrated-elsewhere work
called out separately.

## Priority bugs (as requested)

| Bug | Status | Detail |
|---|---|---|
| Confirm Booking → "Invalid booking data" | 🛠 FIX IN PROGRESS (uncommitted) | Root cause confirmed this session: the frontend discarded the server's structured field-level `errors` array, showing only the generic top-level message. Patched in `client/src/components/booking/enhanced-booking-form.tsx` (onError handler now surfaces `field: reason`). `tsc` clean. **Not committed** — sitting in `fleetpro-main`'s working tree, needs a decision on whether to commit here or reconcile into `200919b` first. |
| Money calculation drift (₹2–5) | ❓ NOT SUBSTANTIATED | Investigated this session: the Remaining Balance formula is plain JS integer subtraction — mathematically exact for every example given (6000−4000, 9797−2798, etc.), no floating-point defect exists in that code path. No drift reproduced. A formally tracked task (`TASK-MONEY-ROOTCAUSE-01`) exists with its own worktree (`money-rootcause`, branch `fix/money-rootcause-01`) but has **0 commits of its own yet** (still at the shared base `200919b`) and **no report**. |
| Leading zero / "₹9797 + 0000" rendering | 🛠 FIX IN PROGRESS (uncommitted, partial) | Confirmed and fixed the zero-prefix root cause: the "Final Base Amount" input used `value={field.value \|\| 0}` (defaults to displaying `0`, so typing without clearing produces `06000`-style input), inconsistent with the safe `value={field.value ?? ""}` pattern already used two fields below it for `advanceReceived`. Patched to match. The specific "₹9797 / 0000 splits across two lines" rendering claim was **not reproduced** — no duplicate-element or formatter bug found by code search. |
| Short 6-character public Booking Code | ❌ NOT IMPLEMENTED | Confirmed via `server/storage-mongodb.ts:630` — the only booking identifier generated today is `bookingId` (e.g. `BK1786085579949K7QP`, ~19 chars). No `bookingCode` field exists on the `Booking` model on the currently-serving branch. **Formally assigned**: `TASK-BOOKING-CODE-02`, worktree `booking-code` (branch `feat/booking-code-02`) — task spec exists at `.claude/tasks/active/TASK-BOOKING-CODE-02.md` and correctly scopes it as additive (new `bookingCode` field, `_id`/`bookingId` untouched). **0 commits of its own yet**, no report — not started. |

## Module status

Legend: ✅ Verified working · 🟢 Implemented, final test pending · 🔄 Work in progress ·
⏳ Waiting on dependency · 🛠 Broken, fix in progress · 🔴 Broken, unassigned ·
⚠ External config required · ❌ Not implemented · ❓ Status unknown

### Runtime / Database
**Status:** 🟢 Implemented — final test pending
Live at `localhost:5050` (`fleetpro-main`, `booking/integration-preview` @ `20bd273`), HTTP
200, MongoDB connected on startup. **Confirmed bug (separate from the four above):** the
server log shows a recurring MongoDB idle-disconnect/reconnect cycle roughly every ~15
minutes, and during this audit an authenticated session intermittently failed with
`"Invalid session"` (`server/middleware/auth.ts:30`, `getUserBySessionId` returning nothing
for a session that had just worked) — very likely correlated with that reconnect cycle
and/or the ~15+ other worktrees' dev servers all sharing this one local MongoDB instance
under concurrent load. **Next action:** investigate session-store resilience across Mongo
reconnects; not yet assigned to a task.

### Authentication
**Status:** ✅ Verified working
`POST /api/auth/login`, session cookie, CSRF double-submit token — all exercised directly
this session via curl against the live server and confirmed functioning end-to-end
(login → CSRF fetch → authenticated write). Rate-limiting/lockout middleware present
(`loginRateLimit`, `checkUserLockout`). The intermittent session-drop noted above is a
reliability issue, not a functional gap.

### Tenant / RBAC
**Status:** 🟢 Implemented — final test pending
`requireTenant`, `requirePermission(PERMISSIONS.*)` present on the booking route and (per
earlier task reports read this session) exercised by `tests/e2e/telephony-isolation.spec.ts`
(18/18 passing on a different branch) for cross-tenant/cross-user isolation. Not
independently re-verified against the currently-serving branch in this pass.

### Dashboard
**Status:** ✅ Verified working
`client/src/pages/dashboard.tsx` is the real hub — hosts Add Booking, live ops, upcoming
bookings, edit-booking dialog. Confirmed reachable and rendering (HTTP 200 on `/`).

### Inquiry
**Status:** 🟢 Implemented — final test pending
`/api/inquiries` route group exists; `tests/e2e/inquiry-crm.spec.ts`,
`inquiry-detailed-requirements.spec.ts` exist. Not re-run this pass.

### Lead
**Status:** 🟢 Implemented — final test pending
`/api/leads` exists; `lead-pipeline.spec.ts`, `lead-status-and-quotation-fallback.spec.ts`,
`lead-to-booking-conversion.spec.ts`, `lead-to-customer-conversion.spec.ts` all present.
Not re-run this pass.

### Follow-up
**Status:** 🟢 Implemented — final test pending
Both `/api/follow-ups` and `/api/followups` route prefixes exist (naming inconsistency
worth a look, not investigated further here); `followups.tsx` page and
`followup-workflow.spec.ts` exist.

### Quotation
**Status:** 🟢 Implemented — final test pending
`/api/quotations` exists; `quotation-workflow.spec.ts`, `quotation-whatsapp-pdf.spec.ts`
exist (implying WhatsApp+PDF delivery is at least implemented, not re-verified live).

### Customer / Customer 360
**Status:** 🟢 Implemented — final test pending
`/api/customers` exists; extensive test coverage present (`customer-360.spec.ts`,
`customer-crm.spec.ts`, `customer-merge.spec.ts`, `customer-segments.spec.ts`,
`customer-timeline.spec.ts`, `customer-financial-summary.spec.ts`, and more). No file named
literally `customer-360.*` in `client/src` — the 360 view is implemented as embedded
component(s) within the customer pages/dashboard rather than a standalone file; not
independently confirmed rendering in this pass.

### Add Booking
**Status:** 🛠 Broken — fix in progress (uncommitted)
See "Priority bugs" above. Core create-booking path (`enhanced-booking-form.tsx` →
`POST /api/bookings` → `mongoBookingSchemaWithCertainty.parse`) confirmed working for a
realistic full payload (live-tested this session, real booking created:
`BK1786083662430VJ9T`). The two confirmed defects (error-message swallowing, base-amount
leading-zero) are patched but uncommitted. **Definition of done:** both patches committed
(here or after lineage reconciliation), a real second reproduction of the *original*
user-reported failure with the actual DevTools payload to confirm which field it really was
(not yet obtained), and `TASK-MONEY-ROOTCAUSE-01`/`TASK-BOOKING-CODE-02` either completed
or explicitly descoped.

### Booking Edit
**Status:** ❓ STATUS UNKNOWN — AUDIT REQUIRED
`PUT /api/bookings/:id` referenced in code comments (uses
`mongoBookingSchemaWithCertaintyPartial`) but not independently exercised this pass.

### Booking Queues
**Status:** 🟢 Implemented — final test pending
`booking-queues-findability.spec.ts`, `booking-queues-previous-booking-reuse.spec.ts` exist;
commit history shows `"Add booking findability queues + customer previous-booking reuse"`
and `"Integrator: wire booking-queues panel into dashboard nav"` — implemented and wired
into nav on the current branch. Not independently re-verified live.

### Live Bookings
**Status:** 🟢 Implemented — final test pending
`client/src/pages/live-bookings.tsx` exists; `dashboard-live-ops-fleet-status.spec.ts`
exists.

### Upcoming Bookings
**Status:** 🟢 Implemented — final test pending
`client/src/pages/upcoming-bookings.tsx` exists; `dashboard-upcoming-bookings.spec.ts`
exists. Note: that same test's "classify bookings A–F" case was reported as a pre-existing,
unrelated flake in an earlier task report (shared dev DB running out of free vehicle slots
under concurrent test load) — a real but low-severity, already-diagnosed issue.

### Payments
**Status:** 🟢 Implemented — final test pending
`advance-payment.spec.ts`, `payment-dues.tsx` page, `payment-reversal.spec.ts` exist.
Advance-payment recording path read directly in `server/routes.ts` this session (fires on
booking creation, best-effort, doesn't fail booking creation on payment-record failure —
confirmed by reading the code, not by live test).

### Invoice
**Status:** 🟢 Implemented — final test pending
`invoice-deferred-numbering.spec.ts`, `invoice-send-gating.spec.ts`,
`invoice-settings.spec.ts`, `customer-invoice.spec.ts` all exist; `/api/invoices` and
`/api/invoice-settings` route groups exist.

### Driver
**Status:** 🔄 Work in progress (unintegrated)
`driver-overlap.spec.ts`, `driver-feedback.spec.ts` exist and presumably pass against
*some* branch. Substantial driver work exists across **6 separate, mostly-unintegrated
worktrees** (`driver-domain-lifecycle`, `driver-google-documents`,
`driver-onboarding-interface`, `driver-operations`, `driver-quality-security`,
`driver-vehicle-handover`) — each with real commits (`ce500bf`, `134f9f5`, `64c70a6`, etc.)
not yet merged into the currently-serving branch.

### Driver 360
**Status:** ❓ STATUS UNKNOWN — AUDIT REQUIRED
No file matching `driver*360*` found. May be embedded elsewhere or may genuinely not exist
as a distinct view — not confirmed either way this pass.

### Vehicle / Fleet
**Status:** 🟢 Implemented — final test pending
`/api/vehicles` exists; `vehicle-feedback.spec.ts`, `vehicle-performance.tsx` page exist.

### Vehicle Handover
**Status:** 🔄 Work in progress (unintegrated)
No handover component/route found on the currently-serving branch. Real work exists in the
`driver-vehicle-handover` worktree (branch `driver/handover-05`, commit `aba9909`) — not
yet integrated.

### Vendor 360
**Status:** 🟢 Implemented (as Vendor management, not confirmed as a distinct "360" view)
`vendor-master.spec.ts`, `vendor-drivers-vehicles.spec.ts`, `vendor-commercial-separation.
spec.ts`, `vendor-duty.spec.ts`, `vendor-sourcing-workflow.spec.ts`,
`vendor-settlement.tsx`/`vendors.tsx` pages, `/api/vendors` route all exist. Whether there's
a specific unified "360" view (vs. separate pages) not confirmed.

### GPS
**Status:** 🔄 Work in progress
`registerGpsConnectionRoutes`, `registerGpsDeviceRoutes`, `registerGpsAssignmentRoutes` are
imported and wired into `server/routes.ts` on the current branch — connections/devices/
assignments are live. `TASK-GPS-MAPPING-03` report explicitly states "Done. All acceptance
criteria met." Telemetry ingestion and trip-billing reconciliation
(`gps-telemetry-ingestion`, `gps-trip-billing` worktrees) have their own commits
(`c03d250`, `fd32c43`) **not yet integrated** into the current branch — those two pieces
specifically are incomplete on what's actually running.

### Telephony
**Status:** ❌ NOT IMPLEMENTED (on the currently-serving branch) / ✅ exists elsewhere
Zero files under `server/telephony/` on `20bd273` (current `fleetpro-main` HEAD). A
complete, previously-verified implementation (18/18 Playwright tests passing, confirmed
independently this session in an earlier turn) exists at commit `9d2bd9c` and is already
folded into the reconciled `200919b` lineage sitting in three other worktrees. **This is
purely an integration gap, not missing work** — see the Critical Infrastructure Finding
above.

### WhatsApp
**Status:** 🟢 Implemented — final test pending
`server/whatsapp/` module exists; `whatsapp-panel.tsx` page exists;
`quotation-whatsapp-pdf.spec.ts` exists.

### Google Drive
**Status:** 🔄 Work in progress (unintegrated)
No Google Drive integration module found under `server/` on the current branch. Real work
exists in `driver-google-documents` worktree (branch `driver/documents-03-google-drive`,
commit `134f9f5`) — not yet integrated.

### Rewards
**Status:** 🟢 Implemented — final test pending
`rewards-referrals-dashboard.tsx` page; `reward-ledger.spec.ts`,
`referral-rewards-engine.spec.ts`, `review-rewards-campaign.spec.ts` exist; `/api/rewards-*`
and `/api/referrals` route groups exist.

### Reports
**Status:** ❓ STATUS UNKNOWN — AUDIT REQUIRED
`/api/reports` route prefix exists server-side. No dedicated `reports` page found under
`client/src/pages`. Whether reporting is surfaced anywhere in the UI (vs. API-only) not
confirmed this pass.

### Settings
**Status:** ❓ STATUS UNKNOWN — AUDIT REQUIRED
No single `settings.tsx` page found; settings-like concerns appear split across
`admin-panel.tsx`, `invoice-settings` API, and possibly within `dashboard.tsx`. Not
confirmed as a coherent single "Settings" area.

### Responsive UI
**Status:** ✅ Verified working (for the pages TASK-01 covered)
`TASK-01`/`fleetpro-ui-responsive` report (read earlier this session): 4/4 new
responsive-overflow tests passing, 11/12 regression passing (1 pre-existing unrelated
flake, independently confirmed via `git stash` against baseline). Root-cause fixes
(`min-w-0` on the app shell, `DialogContent` max-height+scroll) are structural and apply
app-wide by construction, but the report itself flags that a full manual per-page audit at
all 9 breakpoints was not performed — treat as verified for the 5 explicitly-tested
surfaces (Dashboard, Booking wizard, Customers, Inquiries, Leads), not exhaustively proven
elsewhere.

### Automated Tests
**Status:** ❓ STATUS UNKNOWN — AUDIT REQUIRED (full suite not re-run this pass)
70+ Playwright spec files exist (`tests/e2e/`). Individual suites' pass/fail status is
scattered across task reports rather than one current, whole-repo run — and given the
active multi-session concurrent load on the shared dev DB/server right now, a full-suite
run in this exact moment would produce noisy, hard-to-trust results. **Recommended next
action:** run the full suite once, after the branch-reconciliation work above, in a
quieter window.

### Production Build
**Status:** ✅ Verified working (recent artifact exists)
`dist/index.js` and `dist/public/` exist, last built **today** (Aug 7, 11:54) — confirms
`npm run build` has succeeded recently on some branch. Not confirmed which exact commit
produced this artifact, and not rebuilt fresh against current HEAD in this audit pass.

## Summary counters

| Counter | Count |
|---|---|
| Total modules audited | 30 |
| ✅ Verified working | 4 |
| 🟢 Implemented — final test pending | 15 |
| 🔄 Work in progress (real commits, unintegrated) | 5 |
| 🛠 Broken — fix in progress | 1 (Add Booking; the leading-zero item is folded into it, not double-counted) |
| ❌ Not implemented | 2 (Booking Code, Telephony-on-current-branch) |
| ❓ Status unknown — audit required | 5 (Booking Edit, Driver 360, Reports, Settings, Automated Tests) |
| ⏳ Waiting on dependency | 0 identified |
| ⚠ External configuration required | 0 identified this pass (real GPS/telephony provider credentials would be, once those are integrated and actually pointed at a live provider — not reached in this audit) |

Note: counts don't sum to a clean partition in a couple of cases by design — e.g. Telephony
is counted once as ❌ (not on the serving branch) even though fully-working code exists
elsewhere, because the audit's stated scope is "what's actually running," and double-status
items are called out in prose rather than force-fit into one bucket.
