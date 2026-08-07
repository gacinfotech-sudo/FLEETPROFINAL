# TASK-ROOT-DASHBOARD-02 report — backend-worker + frontend-worker

## Status
done

## Files changed (all new, all within this task's owned-file list)
- `server/root/routes/dashboard.ts` — `GET /api/root/dashboard`
- `server/root/routes/tenants.ts` — `GET /api/root/tenants`, `GET /api/root/tenants/:tenantId`, `GET /api/root/tenants/:tenantId/tabs/:tab`
- `server/root/routes/customers.ts` — `GET /api/root/customers`, `GET /api/root/customers/:id`
- `client/src/pages/root/dashboard.tsx` — Root Dashboard
- `client/src/pages/root/tenants.tsx` — Tenant Master Database
- `client/src/pages/root/tenant-360.tsx` — Tenant 360° tabbed workspace
- `client/src/pages/root/global-customers.tsx` — Global Customer Database
- `client/src/pages/root/customer-360.tsx` — Root Customer 360
- `server/root/services/piiMaskingService.test.ts`, `server/root/services/rootAccessGate.test.ts`, `server/root/services/tenantIsolation.test.ts` — this task's test files

## Contract placeholders created (and why)

**`server/root/types.ts`** — explicitly authorized by the task file's Context section
("create a local placeholder file matching the documented shape exactly"). Contains the
`PlatformRole` union and `RootAccessService` interface verbatim from
`ROOT-CONTROL-PLANE-MANIFEST.md`, plus this task's own interpretation of the auxiliary
payload types (`TenantSummary`, `Tenant360`, `GlobalCustomerFilter`, `MaskedCustomerRow`,
`PlatformAuditEvent`, `TenantListFilter`) since the manifest only specified the
`RootAccessService` method signatures, not their full payload shapes.
**Deviation flagged in the file itself**: `listTenants`/`getCustomerAcrossTenants` return
`{ rows, total }` instead of the manifest's bare-array signature, because this task's
acceptance criteria requires server-side pagination with a total count. Integrator/
DOMAIN-01: reconcile this shape difference at merge time.
**Delete this file and repoint every import at the real one once TASK-ROOT-DOMAIN-01 lands.**

**`server/root/services/piiMaskingService.ts`** — explicitly authorized at this exact path
by the task file ("placeholder it if that task hasn't landed yet"). Exports `maskPhone`
(→ `98765XXXXX` shape) and `maskEmail` (→ `ra***@gmail.com` shape) only — no unmask, no
break-glass, no audit-logged reveal (that's SECURITY-05's scope, not reimplemented).
**Replace this file's contents (or delete + repoint) once TASK-ROOT-SECURITY-05 lands** —
every caller in this task imports only `maskPhone`/`maskEmail` from this exact path, so a
drop-in replacement works as long as the real service exports the same function names.

**`server/root/services/localRootAccessService.ts`** — **not** placeholdered at the real
`server/root/services/rootAccessService.ts` path, because the task file's "forbidden to
modify" list did not extend placeholder-creation permission to that exact filename (unlike
`piiMaskingService.ts`, which explicitly did) — creating a file at DOMAIN-01's real path
risked a silent overwrite/collision when that worktree's branch merges. Instead this is a
deliberately differently-named local adapter implementing the same `RootAccessService`
contract with real Mongoose queries, used only by this task's own route files.
**Integrator: once DOMAIN-01's real `rootAccessService.ts` lands, repoint the three route
files' imports from `./localRootAccessService` to it and delete this file** (verify method
signatures match, especially the pagination-shape deviation noted above).

Contains one flagged **interim bridge** in `requirePlatformRole`: until DOMAIN-01's Option A
migration actually populates `User.platformRole` on real accounts, it also accepts today's
existing `role === 'admin'` bypass (already unconditionally cross-tenant per
`server/middleware/auth.ts`). This preserves "never reachable by a tenant-scoped session
token" (an `admin` session is not tenant-scoped) while `platformRole` isn't persistable yet
(the field doesn't exist on the real `User` Mongoose schema — adding it is DOMAIN-01/
Integrator's job). **Remove this bridge once DOMAIN-01 lands** so an `admin` role without an
explicit `platformRole` stops being implicitly admitted.

## Proposed `Tenant` schema patch (Integrator-only file — not applied by this task)

Per the task's assignment (the exact subset of the audit's §1 finding this task was asked to
close: "tenant code, trial dates, usage counters, health/risk flag, internal notes"), all
additive/optional, zero migration required:

```typescript
// server/models/index.ts — ITenant interface + TenantSchema (proposed patch)
interface ITenant extends Document {
  // ...existing fields unchanged...
  tenantCode?: string;                 // unique short code, e.g. "FP-0001"
  trialStartsAt?: Date;
  trialEndsAt?: Date;                  // presence + comparison to now drives the
                                        // computed 'trial'/'expired' status this task's
                                        // routes already read defensively via `any`
  usageCounters?: {
    bookingsThisMonth: number;
    lastActivityAt?: Date;
  };                                   // vehicles/drivers/managers usage is already
                                        // computed live from real collections by this
                                        // task's routes — only the derived/cached
                                        // "activity" counters are genuinely new state
  healthRiskFlag?: 'none' | 'watch' | 'at_risk';
  internalNotes?: {
    note: string;
    authorId: string;
    authorName?: string;
    createdAt: Date;
  }[];
}

// TenantSchema additions (all optional, no default required):
tenantCode: { type: String, unique: true, sparse: true },
trialStartsAt: { type: Date },
trialEndsAt: { type: Date },
usageCounters: {
  bookingsThisMonth: { type: Number, default: 0 },
  lastActivityAt: { type: Date },
},
healthRiskFlag: { type: String, enum: ['none', 'watch', 'at_risk'] },
internalNotes: [{
  note: String, authorId: String, authorName: String, createdAt: { type: Date, default: Date.now },
}],
```

All existing tenants render these as "not set" until backfilled — `server/root/services/localRootAccessService.ts`
already reads `trialEndsAt`/`healthRiskFlag`/`tenantCode` defensively via `(tenant as any)`.

## Proposed route-mount lines (Integrator-only, `server/routes.ts`)

```typescript
import { registerRootDashboardRoutes } from "./root/routes/dashboard";
import { registerRootTenantRoutes } from "./root/routes/tenants";
import { registerRootCustomerRoutes } from "./root/routes/customers";
// ...
registerRootDashboardRoutes(app);
registerRootTenantRoutes(app);
registerRootCustomerRoutes(app);
```

## Proposed sidebar nav entries (Integrator-only, `client/src/components/layout/sidebar.tsx`)

A new "Root" / "Platform" section, visible only to platform-role sessions:
- Root Dashboard → `/root/dashboard`
- Tenant Database → `/root/tenants`
- Global Customers → `/root/customers`

## Proposed `App.tsx` routes (Integrator-only)

```tsx
<Route path="/root/dashboard"><ProtectedRoute><RootDashboard /></ProtectedRoute></Route>
<Route path="/root/tenants"><ProtectedRoute><RootTenants /></ProtectedRoute></Route>
<Route path="/root/tenants/:tenantId"><ProtectedRoute><RootTenant360 /></ProtectedRoute></Route>
<Route path="/root/customers"><ProtectedRoute><RootGlobalCustomers /></ProtectedRoute></Route>
<Route path="/root/customers/:customerId"><ProtectedRoute><RootCustomer360 /></ProtectedRoute></Route>
```
(exact `ProtectedRoute`/guard shape left to the Integrator, matching whatever platform-role
check pattern DOMAIN-01's frontend contract ends up using — this task's pages themselves
are guard-agnostic and rely entirely on the backend 403).

## Tests run and results

All run via `npx tsx --test` (no Jest/Vitest configured in this repo — same convention as
the only pre-existing test, `server/services/bookingCodeService.test.ts`). 22/22 pass:

- `server/root/services/piiMaskingService.test.ts` (11 tests) — pure masking-shape tests,
  no DB.
- `server/root/services/rootAccessGate.test.ts` (6 tests) — `requirePlatformRole` 403 proof
  via mock req/res (tenant-scoped `client`/`manager` sessions → 403; unauthenticated → 403;
  in-list `platformRole` → admitted; out-of-list `platformRole` → 403; interim `admin`
  bridge → admitted).
- `server/root/services/tenantIsolation.test.ts` (5 tests) — **the required tenant-isolation
  proof**, against a real, dedicated MongoDB database (`fleetpro_root_dashboard_test` on the
  local `mongod`, never the app's real dev DB), seeding 2 real tenants + customers and
  asserting: an unfiltered search returns rows from both tenants; every row is labeled with
  its correct tenant name; a `tenantId` filter scopes correctly; **the raw response JSON
  never contains the seeded raw phone digits or email strings** (masking proven at the API
  layer, not just checked via the masking function in isolation); `listTenants` also spans
  multiple tenants.

`npm run check`: only 2 pre-existing errors remain, both in `server/index.ts` (not touched
by this task) — `Cannot find module 'socket.io'` and one downstream implicit-any. Confirmed
pre-existing/unrelated: `git status` shows only `server/root/**` and `client/src/pages/root/**`
as new files; `server/index.ts` is untouched. This matches
`docs/root-control-plane/CURRENT-SUPER-ADMIN-AUDIT.md` §11's note that Socket.IO isn't
present/working in this specific worktree's branch lineage. Confirmed at runtime too: booting
`server/index.ts` directly (`npx tsx server/index.ts`) throws `ERR_MODULE_NOT_FOUND:
socket.io` before reaching any of this task's code — a baseline breakage in this worktree,
not something this task introduced or can fix (touching `server/index.ts` is out of scope).

### Live proof (not just reading the code)

Since `server/index.ts` can't boot in this worktree (pre-existing `socket.io` issue above),
I built a temporary, uncommitted harness (`server/root/_liveCheck.ts`, deleted before
committing — never part of the diff) that booted a minimal Express app using the **real**
`authenticateUser` middleware, **real** `express-session` + `connect-mongo` store, and this
task's **real** route-registration functions, against a dedicated scratch MongoDB database
(`fleetpro_root_dashboard_livecheck`, dropped after the run). Seeded 2 real tenants, 2 real
customers, 1 real booking, and 2 real `User` documents (one `role: 'admin'`, one tenant-scoped
`role: 'manager'` with a `tenantId`). Over real HTTP on `127.0.0.1:5915` (confirmed free via
`lsof` first; process killed by its exact PID afterward, not `pkill`):

- `GET /api/root/dashboard` as admin → `200`, real counts (`tenants.total: 2`, `bookings.total: 1`, ...).
- `GET /api/root/dashboard` as the tenant-scoped manager → `403 {"message":"Platform access required"}`.
- `GET /api/root/dashboard` with no session → `401`.
- `GET /api/root/tenants` → `200`, both seeded tenants, real per-tenant counts.
- `GET /api/root/tenants/:tenantId` → `200`, Tenant 360 overview with real counts.
- `GET /api/root/tenants/:tenantId/tabs/bookings` → `200`, the real seeded booking, paginated envelope.
- `GET /api/root/tenants/:tenantId/tabs/errors` → `404` (stub tab correctly rejected, not faked).
- `GET /api/root/customers` (no filter) as admin → `200`, **both** tenants' customers in one
  response, each tagged with its real `tenantName` ("LiveCheck Tenant A"/"LiveCheck Tenant
  B"), phones as `98765XXXXX`/`91234XXXXX`, emails as `al***@gmail.com`/`bo***@gmail.com`.
- `GET /api/root/customers` as the tenant-scoped manager → `403`.
- `GET /api/root/customers?includeSensitive=true` → `501`, not a real or fake unmask.

## Deviations from scope
- `listTenants`/`getCustomerAcrossTenants` return `{ rows/customers, total }` rather than the
  manifest's bare-array signature — flagged above and in `server/root/types.ts`, required for
  server-side pagination per this task's own acceptance criteria.
- `server/root/services/localRootAccessService.ts` is a new file not on the task's explicit
  "owned files" list (which names only the four route files + five page files + test files).
  It exists because the routes need *some* runnable implementation of the `RootAccessService`
  contract to be testable/live-provable, and the task's own forbidden-file list didn't
  authorize placeholdering at DOMAIN-01's real path — this was the least-collision-risk way
  to satisfy "code your routes against this contract" from the task's Context section. Flagged
  here explicitly rather than silently added.
- GPS/Telephony/WhatsApp tenant-360 tabs are real but intentionally thin (connection/identity
  lists + counts, not full per-module UIs) — those modules' own detail pages already exist
  elsewhere in the app; Root's Tenant 360 tab is a cross-tenant summary view, not a
  reimplementation of GPS/Telephony/WhatsApp's own screens.

## Notes for Integrator
- Delete `server/root/types.ts` and repoint imports once `TASK-ROOT-DOMAIN-01` lands; verify
  the pagination-shape deviation.
- Replace/delete `server/root/services/piiMaskingService.ts` once `TASK-ROOT-SECURITY-05`
  lands; same-name drop-in.
- Repoint `server/root/routes/{dashboard,tenants,customers}.ts`'s import of
  `./localRootAccessService` (or `../services/localRootAccessService`) to the real
  `rootAccessService.ts` once `TASK-ROOT-DOMAIN-01` lands, then delete
  `localRootAccessService.ts`, and remove the `role === 'admin'` interim bridge described above.
  `recordAuditEvent` is currently a `console.log` placeholder — repoint to
  `TASK-ROOT-SECURITY-05`'s real Platform Audit Log persistence once it lands.
- Apply the proposed `Tenant` schema patch, route-mount lines, sidebar entries, and `App.tsx`
  routes above (all Integrator-only files this task correctly did not touch).
- `node_modules` didn't exist in this worktree at task start; symlinked it to
  `fleetpro-main/node_modules` (matching every other active worktree's existing pattern,
  confirmed via `ls -la` before creating it) so `npm run check`/tests could run at all.
- The `server/index.ts` / `socket.io` breakage is pre-existing and unrelated to this task;
  flagging it here since it currently blocks running the *full* dev server in this specific
  worktree lineage (per `CURRENT-SUPER-ADMIN-AUDIT.md` §11's note about Socket.IO not being
  merged into every lineage) — worth a fix by whoever owns `server/index.ts` next.
