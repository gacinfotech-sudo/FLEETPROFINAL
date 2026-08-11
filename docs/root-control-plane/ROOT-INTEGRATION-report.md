# Root Control Plane — Wave 1 Integration Report

Integrator session, 2026-08-07. Worktree:
`/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-worktrees/root-integration`, branch
`integration/root-control-plane-wave1`, branched from `2f31271` on
`preview/manual-test-reconciled` (the same base all 5 Wave-1 branches used).

**Final commit: `6ef24d4`** (12 commits on top of the `2f31271` base — 5 merges + 7
integration commits). Working tree clean.

## Status: integration candidate ready. Requires one manual data-migration step
## (see "requireTenant migration — production readiness" below) before promotion
## to any live environment.

## Merge order and conflicts

Merged in the specified order, `--no-ff`, one merge commit each:

| Order | Branch | Commit | Result |
|---|---|---|---|
| 1 | `feat/root-domain-01` | `b30f801` | Clean merge, no conflicts. |
| 2 | `feat/root-security-05` | `033e461` | 1 conflict: `server/root/types.ts` (add/add — SECURITY-05's placeholder vs. DOMAIN-01's real file). Resolved: kept DOMAIN-01's real file (`git checkout --ours`). |
| 3 | `feat/root-dashboard-02` | `6dd20c1`/`91b3922` | 2 conflicts: `server/root/types.ts` and `server/root/services/piiMaskingService.ts` (both add/add — DASHBOARD-02's placeholders vs. the now-real files from merges 1–2). Resolved: kept the real files both times, confirmed drop-in-compatible by checking DASHBOARD-02's actual call sites before resolving. |
| 4 | `feat/root-support-03` | `fcb98e3` | Clean merge, no conflicts (this task's placeholder lived inside its own `errorCaptureService.ts`, not at a shared path). |
| 5 | `feat/root-sales-config-04` | `83543a0` | Clean merge, no conflicts (`_localPlatformAccess.ts` is a uniquely-named file, no path collision). |

Only 2 of the 5 merges had real conflicts, both mechanical (real-file-vs-placeholder at
the same path) and both resolved the same way: keep the real file, verify the
placeholder's actual callers were compatible, repoint/reconcile in follow-up commits.

## Placeholder reconciliation (commit `f653285`)

DOMAIN-01's real `server/root/types.ts` / `rootAccessService.ts` is canonical. Each of
the other four tasks built a local stand-in per the manifest's explicit
"placeholder-until-integration" instruction. Reconciliation approach per task:

| Task | Placeholder file(s) | Outcome |
|---|---|---|
| SECURITY-05 | `requirePlatformRoleLocal` in `security.ts` | **Repointed.** Now delegates to `rootAccessService.requirePlatformRole` (behaviorally identical — both just check `req.user?.platformRole` against an allowed list). `audit.ts` repointed the same way. Neither file deleted anything else — SECURITY-05's real `recordPlatformAuditEvent`/`auditLog.ts` model was never a placeholder, it's the canonical audit sink DOMAIN-01's own `rootAccessService.recordAuditEvent` dynamically imports. |
| SUPPORT-03 | `requirePlatformRoleLocal`/`ALL_PLATFORM_ROLES`/`MUTATION_PLATFORM_ROLES` in `errorCaptureService.ts` | **Route usage repointed**, placeholder **kept** (not deleted) in `errorCaptureService.ts` — `errorCaptureService.test.ts` still imports and directly unit-tests that function by name; deleting it would have required rewriting that test file for a purely cosmetic gain, so `support.ts`/`errors.ts` now call `rootAccessService.requirePlatformRole` directly instead, leaving the original placeholder as harmless dead-from-the-app's-perspective code with its own passing test. |
| SALES-CONFIG-04 | `_localPlatformAccess.ts` (`requirePlatformRole`, `recordAuditEvent`, its own `PlatformAuditEvent` shape, `PlaceholderAuditEvent` collection) | **Route usage repointed for both functions**, placeholder file **kept** (not deleted) — this task's own tests (`salesConfigModels.test.ts`, `rootAccess.http.test.ts`) import it directly by name. `sales.ts`/`config.ts`/`features.ts` now call `rootAccessService.requirePlatformRole` and `rootAccessService.recordAuditEvent` directly; every `recordAuditEvent` call site's field names were renamed to match the canonical `PlatformAuditEvent` shape exactly (`actorRole`→`actorPlatformRole`, `targetType`/`targetId`→`resourceType`/`resourceId`, ad hoc `tenantId`→`targetTenantId`). These 7 call sites now persist through SECURITY-05's real, canonical audit log instead of a second placeholder ledger. |
| DASHBOARD-02 | `localRootAccessService.ts` (own `RootAccessService`-shaped object) | **Genuine contract divergence, not reconciled to canonical — flagged as Wave 2 follow-up.** This task's routes need paginated `{ rows, total }` responses with richer per-tenant fields (`tenantCode`, `status`, `healthRiskFlag`, per-tenant counts) that the canonical bare-array `RootAccessService` interface doesn't support (documented as a known deviation in DASHBOARD-02's own report). Rewriting three already-tested route files and five frontend pages against the narrower canonical shape was judged out of scope for a merge/integration pass — real risk of breaking live-verified behavior for a shape change that itself needs a design decision (should the canonical service adopt pagination formally?). Resolution: `localRootAccessService.ts` was decoupled from claiming to implement the canonical `RootAccessService`/`PlatformAuditEvent` TypeScript interfaces (renamed to its own `LocalRootAccessService` type, its own local `TenantSummary`/`Tenant360`/etc. types restored) so it type-checks correctly and keeps behaving exactly as already tested, while still importing and reusing the canonical `PlatformRole` union for the actual authorization check. `dashboard.ts`/`tenants.ts`/`customers.ts` were **not modified** — zero behavior change, only the underlying service's type-conformance claim changed. |

**Files deleted:** none. Every placeholder file that still has a live test importing it
by name was left in place, decoupled where necessary. This is a deliberate deviation
from "delete once nothing imports it" — every placeholder file I found *is* still
imported (by its own test file, checked via grep before making any decision), so none
qualified for deletion under that rule as written.

Two of DASHBOARD-02's own test files needed fixing as a direct consequence of the
`piiMaskingService.ts` conflict resolution (real SECURITY-05 masking algorithm replacing
DASHBOARD-02's placeholder one):
- `piiMaskingService.test.ts`: 2 assertions hard-coded the placeholder's country-code-
  stripping behavior (`+91 98765 43210` → `98765XXXXX`). Real algorithm masks the last 5
  digit characters in place without stripping any prefix (`+91 98765 43210` →
  `+91 98765 XXXXX`). Same security property (last 5 digits never visible), different
  cosmetic shape — assertions updated to the real, verified output.
- `tenantIsolation.test.ts`: 1 assertion asserted the exact `\d{5}X{5}$` shape; loosened
  to `X{5}$` (ends with 5 masked characters) + `not all-digits`, which still proves the
  load-bearing security property without depending on the specific masking algorithm's
  cosmetic format.

## `server/models/index.ts` schema patch (commit `649939f`)

Applied two additive/optional schema patches explicitly proposed in task reports (per
the instruction to only touch this file when a report proposes it):
- `IUser.platformRole?: PlatformRole` (+ enum-constrained schema field) — DOMAIN-01's
  proposal. **This is a hard prerequisite**, not optional polish: without it,
  `req.user?.platformRole` is invisible via plain dot-access on a real Mongoose `User`
  document (strict-mode Mongoose drops undeclared paths), which was directly caught as 3
  real test failures in `support.test.ts` before this patch landed (see "Test results"
  below).
- `ITenant.{tenantCode, trialStartsAt, trialEndsAt, usageCounters, healthRiskFlag,
  internalNotes}` — DASHBOARD-02's proposal. Not blocking (DASHBOARD-02's routes already
  read these defensively via `(tenant as any)`), applied for correctness/cleanliness.

`role`/existing `Tenant` fields are untouched; no migration required for either patch.

## requireTenant migration — the highest-risk change (commit `c8487a1`)

Applied SECURITY-05's proposed Option A patch to both `server/middleware/auth.ts`
(`requireTenant`) and `server/routes.ts` (`scopeTenant`), replacing the
`role === "admin"` cross-tenant bypass with a `platformRole`-based one.

**Hardening beyond the literal proposed diff**: the proposed patch used a bare truthy
check (`if (req.user?.platformRole)`). This was upgraded to
`isPlatformRole(req.user?.platformRole)` (the existing, already-tested type guard from
`server/root/types.ts`) in both places. Rationale: `scripts/migrate-admin-to-platform-role.ts`
writes via the raw MongoDB driver, bypassing Mongoose's schema enum validation
entirely by design (documented in DOMAIN-01's own report) — a bug in a future write path
(a bad `--map` entry, a manual DB edit, a not-yet-built admin tool) could leave an
unrecognized string in this field, and a bare truthy check would grant the cross-tenant
bypass to it anyway. `requireTenant`/`scopeTenant` are the two most load-bearing
authorization gates in the app; they must fail closed independent of what currently
writes the field.

### Before/after verification

**Unit-level** (`server/middleware/auth.requireTenant.test.ts`, 13/13 passing), against
the real middleware/helper (not a reimplementation for `requireTenant`; `scopeTenant` is
a private closure in `routes.ts` so it's mirrored literally in the test with a comment
noting that any future edit that needs a matching test change is the drift signal):

| Case | Before | After | Verified |
|---|---|---|---|
| Migrated platform-staff (`platformRole` set) | bypass | bypass (unchanged outcome) | ✅ |
| Legacy `role:'admin'`, no `platformRole`, no `tenantId` | bypass | **403** (documented regression) | ✅ |
| Legacy `role:'admin'`, no `platformRole`, has `tenantId` | bypass | passes (falls through to normal tenant check) | ✅ |
| Tenant `client`/`manager` | unaffected | unaffected | ✅ |
| No user | 403 | 403 | ✅ |
| Garbage/invalid `platformRole` string | n/a (field didn't exist) | **403**, does not bypass (fail-closed hardening) | ✅ |
| Empty-string `platformRole` | n/a | 403, does not bypass | ✅ |

**Live HTTP verification** — booted the real server (`npx tsx server/index.ts`) on a
free port (5301, checked via `lsof` first, avoiding all in-use/excluded ports) against a
dedicated throwaway database (`fleetpro_reintegration_smoke`, never the shared
`fleetpro` dev DB), using real login sessions:

1. `smoketest_root` (emergency-admin-created, `role:'admin'` + `platformRole:'PLATFORM_ROOT'`
   thanks to the admin-recovery.ts fix below) — `GET /api/root/dashboard`,
   `/tenants`, `/customers`, `/security/events`, `/audit`, `/support/tickets`,
   `/errors`, `/sales/prospects`, `/config`, `/plans` all returned real `200` data.
2. `smoke_client` (real tenant, `role:'client'`, real `tenantId`) — every Root route
   above returned `403 {"message":"Platform access required"}`; `GET /api/vehicles` and
   `/api/bookings` (ordinary tenant-scoped routes) returned `200 []` normally — proves
   the migration didn't collaterally break tenant-side access.
3. `legacy_admin_smoke` (`role:'admin'`, deliberately **no** `platformRole`, seeded
   directly to simulate an unmigrated account) — `GET /api/admin/tenants`
   (`requireAdmin`-gated) returned `200` normally (untouched); `GET /api/vehicles`
   (`requireTenant`-gated) returned `403 {"message":"Tenant access required"}` — the
   documented regression, reproduced live.
4. `garbage_role_smoke` (`role:'client'`, `platformRole:'NOT_A_REAL_ROLE'`, inserted via
   the raw MongoDB driver to simulate a validation-bypassing write) — both
   `/api/root/dashboard` and `/api/vehicles` returned `403` — the fail-closed hardening
   holds live, not just in the unit test.

### requireTenant migration — production readiness (the answer the requester needs)

**The code is correct and fully verified.** It is **not yet safe to promote this
integration candidate into any environment with real user accounts** — specifically
`preview/manual-test-reconciled` (live at `:5100`) or anything downstream of it —
without first running the data migration.

Ran a **read-only dry run** (zero writes — guaranteed by the script's own design, proven
by 11/11 tests in `scripts/migrate-admin-to-platform-role.test.ts`) of
`scripts/migrate-admin-to-platform-role.ts` against the actual shared `fleetpro` database
(`mongodb://127.0.0.1:27017/fleetpro`, the one `manual-test-preview`'s `.env` points at):

```json
{
  "mode": "dry-run",
  "totalAdminAccounts": 2,
  "alreadyMigrated": [],
  "toMigrate": [],
  "unresolved": [
    { "id": "6a70f7b4e084576271b1b466", "userId": "testadmin" },
    { "id": "6a7557520baa6b67d8c17763", "userId": "testadmin04" }
  ]
}
```

Both real admin accounts in that database (`testadmin`, `testadmin04`) have **no**
`platformRole`. If this code reached that database today, both would immediately lose
cross-tenant access on every `requireTenant`/`scopeTenant`-gated route. **Before this
integration candidate is merged toward `manual-test-preview` or promoted to a canonical
preview, run**:

```
npx tsx scripts/migrate-admin-to-platform-role.ts --apply --map=<reviewed map covering testadmin, testadmin04>
```

against that specific database, with a human-reviewed `--map` deciding each account's
real `PlatformRole` (the script refuses to blanket-assign — it aborts if any account is
unresolved and no `--default-role` is given). This is a one-time, database-specific,
manual step — not something further code changes in this branch can satisfy.

## Shared-file patches applied (itemized)

1. `server/middleware/auth.ts` — `requireTenant` Option A patch (commit `c8487a1`).
2. `server/routes.ts` — `scopeTenant` Option A patch (commit `c8487a1`); route-mount
   imports + 8 registration calls for all Wave-1 route modules (commit `05dd310`).
3. `server/index.ts` — `correlationIdMiddleware` mounted app-wide, right after the
   body-parser middleware, before `registerRoutes(app)` (commit `05dd310`).
4. `server/models/index.ts` — `IUser.platformRole` + `ITenant.{tenantCode, trialStartsAt,
   trialEndsAt, usageCounters, healthRiskFlag, internalNotes}` (commit `649939f`).
5. `server/admin-recovery.ts` — both `role:'admin'`-creating functions
   (`createBackupAdmin`, `createEmergencyAdmin`) now also set
   `platformRole: 'PLATFORM_ROOT'` (commit `745f63a`; see below).
6. `client/src/components/layout/sidebar.tsx` — new "Root / Platform" nav section,
   additive, gated on `role === 'admin'` (commit `c6053a1`).
7. `client/src/App.tsx` — 12 new `/root/**` route registrations + `<SupportAccessBanner />`
   mounted once at the authenticated app shell root (commit `6ef24d4`).
8. `server/middleware/permissions.ts` — **not touched**. No task's report proposed a new
   permission constant there (DOMAIN-01's report only lists it among files it read for
   due-diligence context, not a proposed change).

### `server/admin-recovery.ts` gap (found via SECURITY-05's report, fixed here)

SECURITY-05's report explicitly flagged: `admin-recovery.ts`'s two emergency-admin
creation paths (`createBackupAdmin`, `createEmergencyAdmin`) create `role:'admin'`
accounts with no `platformRole`. Once the Option A patch ships, a freshly-recovered
admin — created at exactly the moment cross-tenant access was lost — would immediately
lose that access again. Traced both functions directly: neither accepts or sets a
`tenantId`; `ADMIN_RECOVERY_GUIDE.md` documents this as whole-system recovery, not
per-tenant. `PLATFORM_ROOT` is therefore the correct grant. Fixed both call sites; new
regression test `server/admin-recovery.test.ts` (4/4 passing) proves the grant, that an
existing admin's `platformRole` is never touched by a second `createBackupAdmin` call,
and that neither path ever sets a `tenantId` (the platform-vs-tenant boundary, verified
directly rather than assumed). Live-verified too: booting the smoke-test server with
`EMERGENCY_ADMIN_ID`/`EMERGENCY_ADMIN_PASSWORD` set produced a user with
`platformRole: 'PLATFORM_ROOT'` in the startup log, and that session got full Root access
immediately.

## Test results (full, re-run fresh against final commit `6ef24d4`)

- `npm run check` → **0 errors** (both Root code and the whole existing codebase).
- `npx tsx --test` across all 11 non-DB-isolated Root/auth test files → **106/106 pass**
  (`rootAccessService.test.ts` 24, `migrate-admin-to-platform-role.test.ts` 11,
  `piiMaskingService.test.ts` 11, `rootAccessGate.test.ts` 6, `tenantIsolation.test.ts`
  5, `errorCaptureService.test.ts` 8, `correlationId.test.ts` 6, `support.test.ts` 9,
  `errors.test.ts` 4, `auth.requireTenant.test.ts` 13, `admin-recovery.test.ts` 4).
- `salesConfigModels.test.ts` (dedicated throwaway DB) → **10/10 pass**.
- `rootAccess.http.test.ts` (dedicated throwaway DB, real Express app + real route
  files) → **19/19 pass**.
- `npx playwright test tests/e2e/root-security-*.spec.ts` (dedicated throwaway DB) →
  **19/19 pass**.
- **Total: 154/154 tests pass.**
- Live HTTP smoke test on a real running dev server (port 5301, dedicated DB) — see
  "requireTenant migration" section above for the 4 verified session scenarios plus 10
  successful `/api/root/**` route calls as a real `PLATFORM_ROOT` session.

No regressions found in isolation-vs-merged testing except the 3 masking-shape test
assertions (DASHBOARD-02's own test files, expected and fixed — see "Placeholder
reconciliation" above) and the 3 `support.test.ts` failures that were the actual signal
for the missing `User.platformRole` schema field (fixed by the schema patch, then
re-verified 32/32 passing).

`npm run check`'s previously-reported 2 pre-existing/unrelated `socket.io`-module errors
(flagged in DASHBOARD-02's own report as a baseline gap in this worktree lineage, not
caused by any Wave-1 task) resolved themselves mid-session when this worktree's
`node_modules` (originally symlinked to `fleetpro-main`'s) was replaced by a real,
complete `npm install` — unrelated to any code change in this branch.

## Follow-up needed (not blocking this integration candidate, but real)

1. **Run the admin migration** against `fleetpro` (the shared dev DB) before promoting
   toward `manual-test-preview` or canonical preview — see "production readiness" above.
   This is the only blocker.
2. **DASHBOARD-02's `RootAccessService` contract divergence** (pagination shape, richer
   `TenantSummary`/`MaskedCustomerRow` fields) is unresolved by design — a real design
   decision, not a mechanical fix. Recommend either formally extending the canonical
   `RootAccessService` interface to support pagination, or documenting
   `localRootAccessService.ts`'s shape as a permanent, intentional second
   implementation scoped to Dashboard/Tenant-360/Global-Customer routes only.
3. Dead-but-tested placeholder code left in `errorCaptureService.ts` and
   `_localPlatformAccess.ts` (their `requirePlatformRole`/`recordAuditEvent` functions
   are no longer called by any route, only by their own test files) — safe to delete in
   a future pass along with the now-redundant tests, not urgent.
4. `client/src/hooks/use-auth.ts`'s `user` object and `ProtectedRoute` don't expose/
   check `platformRole` yet — every `/root/**` page today gates client-side visibility on
   `role === 'admin'` (a stopgap every task's report explicitly flagged). Real
   authorization is server-side and correct regardless; this is a UX-only gap (a
   non-admin platform-staff-only account would see a 403 from the API rather than a
   tailored empty state).

## Final commit

`6ef24d4` on `integration/root-control-plane-wave1`, worktree
`/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-worktrees/root-integration`. 12 commits
on top of base `2f31271` (5 `--no-ff` merges + 7 integration commits, each individually
diffable). Working tree clean.
