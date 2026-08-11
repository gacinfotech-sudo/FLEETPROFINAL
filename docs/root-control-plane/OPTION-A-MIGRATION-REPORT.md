# Option A Migration Report — requireTenant / scopeTenant

Option A (user-confirmed at Wave 1 dispatch): **replace** the existing unaudited,
unconditional `role === 'admin'` cross-tenant bypass with the new `platformRole`-based
mechanism — not leave both mechanisms running in parallel.

## The change

Two call sites, both gating cross-tenant data access for the whole app (not just the new
`/api/root/**` namespace):

- `requireTenant` middleware — `server/middleware/auth.ts`
- `scopeTenant` helper (non-exported closure inside `registerRoutes()`) — `server/routes.ts`

**Before:**
```ts
if (req.user?.role === "admin") { /* bypass tenant scoping */ }
```

**After integration candidate (`c8487a1`), before this pass's hardening:**
```ts
if (req.user?.platformRole) { /* bypass tenant scoping */ }
```

**After this pass's fix:**
```ts
import { isPlatformRole } from "../root/types"; // or "./root/types" in routes.ts
if (isPlatformRole(req.user?.platformRole)) { /* bypass tenant scoping */ }
```

## Why the bare truthy check wasn't enough

`isPlatformRole()` is a type-guard validator DOMAIN-01 built specifically to check a
value against the real `PlatformRole` union (`'PLATFORM_ROOT' | 'PLATFORM_SUPER_ADMIN' |
'PLATFORM_SUPPORT_ADMIN' | 'PLATFORM_FINANCE_ADMIN' | 'PLATFORM_SECURITY_ADMIN' |
'PLATFORM_READ_ONLY_AUDITOR'`) — but it was never actually called at either of these two
sites. `if (req.user?.platformRole)` only checks that the field is truthy, not that it
holds one of those six values.

Today, the only write path for this field is `scripts/migrate-admin-to-platform-role.ts`,
which does validate before writing — so in practice, on this exact codebase, today,
nothing currently produces an invalid value. But `requireTenant`/`scopeTenant` are the
app-wide cross-tenant bypass, not a narrowly-scoped Root-only check — they must fail
closed against *any* future write path that could leave an unrecognized string in this
field (a raw MongoDB-driver write, a manual DB edit run by a DBA fixing something else, a
bug in a not-yet-built Root User Management UI that will inevitably let an operator type
a role name), not just against the one script that happens to be careful today. This is
also an explicit requirement stated in the original integration brief: "invalid
platformRole -> fail closed" is a named acceptance case.

## Before/after behavior table (proven live, both via unit tests and real HTTP calls)

| Session | Old (`role==='admin'`) | Integration candidate (bare truthy) | This pass (validated) |
|---|---|---|---|
| Migrated platform staff (valid `platformRole`, any `role`) | bypass (if `role==='admin'`) | bypass | bypass |
| Legacy `role:'admin'`, no `platformRole`, no `tenantId` | **bypass** (unconditional) | 403 | 403 |
| Legacy `role:'admin'`, no `platformRole`, real `tenantId` | bypass | scoped to own tenant | scoped to own tenant |
| `platformRole: 'NOT_A_REAL_ROLE'` (garbage/invalid) | n/a (field didn't exist) | **bypass (BUG)** | scoped to own tenant / 403 |
| `platformRole: ''` (empty string) | n/a | **bypass (BUG)** | scoped to own tenant / 403 |
| Ordinary tenant client/manager | scoped/403 as before | unaffected | unaffected |

The "Legacy `role:'admin'`, no `platformRole`, no `tenantId` -> 403" row is the one
**intentional, documented regression**: any environment with real `role:'admin'` accounts
must run `scripts/migrate-admin-to-platform-role.ts` before this patch reaches it, or
those accounts lose cross-tenant access entirely. `admin-recovery.ts`'s two paths
(`createBackupAdmin`, `createEmergencyAdmin`) were fixed separately to always grant
`platformRole: 'PLATFORM_ROOT'` on creation — see `ADMIN-RECOVERY-COMPATIBILITY.md` — so
recovery-created admins are never caught by this regression.

## Regression coverage

`server/middleware/auth.requireTenant.test.ts` — 13 tests against the **real**
`requireTenant` middleware (not a reimplementation) plus a literal same-logic copy of
`scopeTenant` (kept as a copy, not an import, since the real one is a non-exported
closure — a future edit to `routes.ts`'s copy that silently diverges is the intended
failure signal if this test needs to change to keep passing):

- Migrated platform-staff user bypasses (with and without a `tenantId`).
- Legacy `role:'admin'`, no `platformRole`, no `tenantId` -> 403 (documented regression).
- Legacy `role:'admin'`, no `platformRole`, real `tenantId` -> passes through scoped.
- Ordinary tenant client/manager -> unaffected.
- No user at all -> 403.
- **FAIL CLOSED** (this pass): garbage `platformRole` string -> 403 / scoped, not bypass.
- **FAIL CLOSED** (this pass): empty-string `platformRole` -> 403 / scoped, not bypass.

All 13 passing, both in isolation and as part of the full 127-test run.

## Live verification (QA-06 candidate, port 5301, real HTTP requests — not UI)

- Legacy admin (`role:'admin'`, no `platformRole`) login -> `POST /api/root/tenants`:
  `403 {"message":"Platform access required"}`.
- Same legacy admin -> `GET /api/bookings` (a `requireTenant`-gated tenant route) with no
  `tenantId`: `403 {"message":"Tenant access required"}` — proves the "was unconditional
  bypass before Option A" regression is real and intentional, live.
- `PLATFORM_ROOT` session -> `GET /api/root/tenants`: `200`, cross-tenant data returned.
- Ordinary tenant client -> `GET /api/root/tenants`: `403 {"message":"Platform access
  required"}` ("tenant-admin -> root denied").
- Same tenant client -> `GET /api/bookings` (own tenant): `200 []`, unaffected.

## Files changed this pass

- `server/middleware/auth.ts` — `isPlatformRole()` import + `requireTenant` hardening.
- `server/routes.ts` — `isPlatformRole()` import + `scopeTenant` hardening.
- `server/middleware/auth.requireTenant.test.ts` — 3 new FAIL CLOSED cases.
