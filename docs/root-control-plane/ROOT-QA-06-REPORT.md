# TASK-ROOT-QA-06 — Live Regression Report

Executed directly by the integrator session with full context of the Wave 1
reconciliation (rather than dispatched to a fresh worker that would need to rediscover
that context), per the brief's requirement that QA-06 test "direct API calls, not just
UI" against "the real merged candidate." All scenarios below were run as real HTTP
requests against a real running server — no mocking, no assertions against source code
alone.

## Candidate under test

- Worktree: `root-integration`, branch `integration/root-control-plane-wave1`, commit
  `bead79e` (before the audit-sink fix found below) / same commit after (the fix is
  included in `bead79e`; see "Bug found and fixed" below for the actual sequence).
- Isolated runtime: port **5301**, `HOST=127.0.0.1`, dedicated throwaway DB
  `fleetpro_root_qa06_candidate` — never touched the shared `fleetpro` DB or the
  canonical preview's port `5100`/`5050`.
- Seed data: 2 tenants (A, B), 1 legacy `role:'admin'` user with no `platformRole`
  (pre-migration shape), 1 tenant-scoped client (Tenant A), 1 customer with real PII
  (`primaryMobile`, `email`) in Tenant A.

## Scenarios run and results

| # | Scenario | Result |
|---|---|---|
| A | `PLATFORM_ROOT` (via `admin-recovery.ts` emergency-admin path) login | 200, session established |
| B | `PLATFORM_ROOT` -> `GET /api/root/tenants` (cross-tenant) | 200, `{"tenants":[],"total":0}` before seed reload |
| C | Unauthenticated -> `GET /api/root/tenants` | 401 `Authentication required` |
| D | Legacy admin (`role:'admin'`, no `platformRole`) login | 200, session established |
| E | Legacy admin -> `GET /api/root/tenants` | **403** `Platform access required` (no bypass into new Root surface) |
| F | Legacy admin -> `GET /api/bookings` (no `tenantId`) | **403** `Tenant access required` (documented Option A regression, live) |
| G | Tenant-scoped client login | 200, session established |
| H | Tenant client -> `GET /api/root/tenants` | **403** `Platform access required` (tenant-admin -> root denied) |
| I | Tenant client -> `GET /api/bookings` (own tenant) | 200, `[]` (unaffected by the migration) |
| J | `PLATFORM_ROOT` -> `GET /api/root/customers` | 200, `maskedPhone: "91987XXXXX"`, `maskedEmail: "ra***@example.com"` — raw PII never appears |
| K | `PLATFORM_ROOT` -> `GET /api/root/customers/:id` (Customer 360) | 200, masked detail view, `recordAuditEvent` called |
| L | `GET /api/root/audit` immediately after K | **Empty — BUG, see below** |
| — | *(fix applied, server restarted, re-ran K + L)* | **200, event present** — see below |
| M | Break-glass create, 3s real duration (`durationMinutes: 0.05`) | 201, `active: true` |
| N | `GET /api/root/security/events` immediately after M | `active: true` for that event |
| O | Same check after a real (unmocked) 4-second wait | `active: false` — real wall-clock expiry, not a mocked clock |
| P | Support-access enter (Tenant A, with reason + ticket ref) | 200, `active: true` |
| Q | `GET /api/root/support-access/status` | 200, matches P |
| R | Support-access exit | 200, `active: false` |
| S | `GET /api/root/audit` after M/P/R | All 4 real events present: `break_glass.create`, `support_access.enter`, `support_access.exit`, `root.customer360.view` |
| T | `GET /api/root/security/events` `mfaStatus` field | `"not_implemented"` — honest placeholder, not a fake success state |

## Bug found and fixed: `PlatformAuditEvent` sink silently dropped every write

Scenario L failed: a Customer 360 view (K) returned 200 and internally called
`recordAuditEvent`, but the very next `GET /api/root/audit` came back empty. Traced (not
guessed) through `server/root/services/rootAccessService.ts`'s `defaultAuditSink`:

1. **Wrong export name.** It dynamically imported `server/root/models/auditLog.ts` and
   read `auditModule.PlatformAuditLog` — a name guessed before that model existed in this
   worktree (the comment explaining the dynamic-import trick literally said "does not
   exist in this worktree yet"). The real export, once SECURITY-05's branch was merged,
   is `PlatformAuditEventModel`. The lookup was always `undefined`.

2. **Field-shape mismatch**, which would have kept failing even with (1) alone fixed.
   Every real caller across the whole Root Control Plane —
   `server/root/routes/customers.ts` (2 call sites), `config.ts` (3), `features.ts` (1),
   `sales.ts` (3) — already codes against this file's own `PlatformAuditEvent` contract:
   `actorUserId` / `resourceType` / `resourceId` / `metadata`. The DB schema
   (`server/root/models/auditLog.ts`, independently designed by SECURITY-05) uses
   different field names: `userId` (**required** — so `.create(event)` was throwing on
   every single call, caught by the surrounding `try`/`catch`, silently falling through
   to the console-only fallback) / `targetEntity` / no metadata field at all.

**Impact**: every audit write across the entire Root Control Plane — every config
change, feature-flag toggle, plan edit, sales/prospect action, and PII read — was
silently going to `console.warn` only, never to the database, since the moment
SECURITY-05's branch was merged. `GET /api/root/audit` would have always returned empty
in any environment, making the entire Platform Audit Log feature non-functional despite
9+ call sites already correctly instrumented to use it.

**Fix**: rewrote `defaultAuditSink` to explicitly map the canonical event shape onto the
schema's real fields (`actorUserId`->`userId`, `resourceType`+`resourceId`->`targetEntity`
as `"Type:id"`, `metadata` folded into `newValue`) rather than reconciling the two
independently-built shapes repo-wide — every existing caller keeps working unchanged, no
other file needed to change. Also fixed `server/root/routes/customers.ts`'s two
`recordAuditEvent` calls, which were separately still pointed at
`localRootAccessService`'s Wave-1-dev-only console-log placeholder instead of the
canonical service — same symptom, different call site.

**Verified after the fix**, server restarted, re-ran K then L: `GET /api/root/audit`
returned the real, persisted `root.customer360.view` event with correct `targetEntity:
"Customer:<id>"`. Re-ran M/P/R (break-glass, support-access enter/exit): all 4 events
now appear in the audit log (scenario S). Re-ran the full 127-test suite: still 127/127,
0 regressions.

## Status: PASS (after fix)

All boundary, masking, audit-persistence, break-glass-expiry, and support-access
scenarios verified live against a real server with real HTTP requests. One real,
significant bug found and fixed as a direct result of this pass — not caught by any
existing unit test, since `rootAccessService.test.ts` injects a mock `auditSink` and
never exercises `defaultAuditSink` against the real model.

## Not covered in this pass (explicit gap, not silently skipped)

`POST /api/root/customers/:id/unmask` (the "View Sensitive Data" flow) exists in
`audit.ts` but was not exercised live — Customer 360 detail view (masked) was tested,
the explicit unmask-with-reason round trip was not. Recommended as the first live check
in Wave 2.
