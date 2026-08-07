# TASK-ROOT-SALES-CONFIG-04 report — backend-worker + frontend-worker

## Status
done

## Files changed (all new — no existing files touched)
- `server/root/models/prospect.ts` — `Prospect` model, `PROSPECT_STAGES`, `isValidStageTransition`.
- `server/root/models/plan.ts` — `Plan` model (Starter/Professional/Enterprise/Custom), default catalog seeding, `resolvePlanForTenant`, `resolvePlanLimit`.
- `server/root/models/featureFlag.ts` — `FeatureFlag` model, `FEATURE_MODULES`, `resolveFeatureState`, `resolveEntitlement`.
- `server/root/routes/sales.ts` — Sales CRM routes (prospects CRUD + stage transitions + create-tenant).
- `server/root/routes/config.ts` — Product Configuration (singleton) + Plan catalog CRUD routes.
- `server/root/routes/features.ts` — Tenant Feature Flags routes.
- `server/root/routes/_localPlatformAccess.ts` — **deviation, see below**: local placeholder for the `RootAccessService` contract (`requirePlatformRole`, `recordAuditEvent`), since `server/root/types.ts` / `server/root/services/rootAccessService.ts` (TASK-ROOT-DOMAIN-01's owned files) don't exist in this worktree yet.
- `client/src/pages/root/sales-pipeline.tsx` — pipeline board UI + Create Tenant action.
- `client/src/pages/root/product-config.tsx` — branding/support settings + plan catalog view.
- `client/src/pages/root/feature-flags.tsx` — per-tenant feature flag table.
- `server/root/__tests__/salesConfigModels.test.ts` — model/service-level integration tests (real MongoDB).
- `server/root/__tests__/rootAccess.http.test.ts` — HTTP-level tenant-isolation proof (real MongoDB + real Express + real middleware).

## Proposed route-mount lines (NOT applied — server/routes.ts is Integrator-only)
```ts
import { registerSalesRoutes } from "./root/routes/sales";
import { registerConfigRoutes } from "./root/routes/config";
import { registerFeatureFlagRoutes } from "./root/routes/features";
...
registerSalesRoutes(app);
registerConfigRoutes(app);
registerFeatureFlagRoutes(app);
```
Mounts these endpoints: `GET/POST /api/root/sales/prospects`, `GET/PATCH /api/root/sales/prospects/:id`, `POST /api/root/sales/prospects/:id/create-tenant`, `GET/PATCH /api/root/config`, `GET/POST /api/root/plans`, `PATCH /api/root/plans/:id`, `GET/PATCH /api/root/tenants/:tenantId/features`.

## Proposed sidebar nav entries (NOT applied — client/src/App.tsx and sidebar.tsx are Integrator-only)
- `/root/sales` → `SalesPipeline` (`client/src/pages/root/sales-pipeline.tsx`)
- `/root/product-config` → `ProductConfigPage` (`client/src/pages/root/product-config.tsx`)
- `/root/tenants/:tenantId/features` → `FeatureFlagsPage` (`client/src/pages/root/feature-flags.tsx`, expects a `tenantId` prop — wire from the route param)

## How `Plan` relates to `Tenant.subscriptionPlan`
`Tenant.subscriptionPlan` (`server/models/index.ts`, untouched — this task's forbidden-files list excludes it) stays the single source of truth for existing tenants. `Plan` is additive:
- Each `Plan` document may declare `legacySubscriptionPlan: 'starter'|'pro'|'custom'` + `isDefaultForLegacyCode: true`, meaning "I am the canonical new-model Plan that this legacy string maps to." A partial unique index enforces at most one default Plan per legacy value.
- `resolvePlanForTenant(tenantId)` reads `tenant.subscriptionPlan` (the existing field) and looks up the matching default `Plan`. No new field was added to `Tenant` — every existing tenant keeps working completely unchanged, with zero migration required.
- `ENTERPRISE` has no legacy mapping (it didn't exist before this task) — a tenant only lands on it via a future explicit assignment mechanism (see gap list below).
- If the `Plan` catalog is empty, `ensureDefaultPlansSeeded()` lazily seeds the 4 defaults (STARTER/PROFESSIONAL/ENTERPRISE/CUSTOM) on first resolution — the seeded STARTER/PROFESSIONAL/CUSTOM defaults intentionally reuse `Tenant.limits`' current numbers (6/3/1 vehicles/drivers/managers for starter, etc.) so nothing changes in effective behavior in the interim.
- `resolveEntitlement(tenantId, key)` / `resolvePlanLimit(tenantId, key)` are the "other code COULD read from" helpers: numeric limit keys resolve from `Plan.limits`, falling back to `Tenant.limits`' three legacy counters if no Plan document matches; feature keys resolve via `resolveFeatureState` (see below).

## Tenant Feature Flags — audit + data-preservation proof
- `FeatureFlag` is `{tenantId, feature, state, updatedBy, reason, createdAt/updatedAt}`, unique on `{tenantId, feature}`.
- `resolveFeatureState(tenantId, feature)`: explicit per-tenant row wins; otherwise falls back to the tenant's resolved `Plan.features[feature]` default; if neither exists, defaults to `ENABLED` (matches today's reality — every module is always-on for every tenant, so introducing this system doesn't silently disable anything for a tenant nobody has touched yet).
- Every PATCH to `/api/root/tenants/:tenantId/features` calls `recordAuditEvent` (placeholder — see deviation below) with old/new state.
- **Proven by test** (`salesConfigModels.test.ts`, "disabling a feature flag records an audit event and does not touch the module's own data"): creates a real `GpsConnection` document for a tenant, disables that tenant's `gps_tracking` flag, then asserts (a) exactly one new audit event exists with the correct old/new values, and (b) the `GpsConnection` document still exists, unchanged, and the tenant's connection count is still 1. FeatureFlag writes never touch any other collection.

## Explicit "NOT retrofitted" list of existing hardcoded limits (follow-up work, not attempted here)
Per the task's own scope: build the entitlement model + `resolveEntitlement` helper, do not retrofit every caller. Confirmed still-hardcoded (grepped `server/storage-mongodb.ts` and `server/routes.ts`):
- `server/models/index.ts` `TenantSchema.limits` defaults (`vehicles: 6, drivers: 3, managers: 1`) — still the literal defaults applied at Tenant creation; `Plan`'s seeded defaults were deliberately set to match these numbers today, but the *codepath* that applies them (Mongoose schema defaults, not `resolveEntitlement`) is untouched.
- Any route/service that reads `tenant.limits.vehicles` / `.drivers` / `.managers` directly to enforce a cap (e.g. vehicle-creation or driver-creation limit checks in `server/storage-mongodb.ts` / `server/routes.ts`) still reads the raw `Tenant.limits` field, not `resolveEntitlement`.
- `mongoTenantSchema`'s `limits` defaults (`server/schemas/mongodb-schemas.ts`) — same three hardcoded numbers, independent copy.
- `maxManagers` on `Tenant` (`server/models/index.ts:425`, default 5) — a second, separate manager-limit field from `limits.managers`, explicitly marked "kept for backward compatibility" in the existing code; not unified with `Plan.limits.maxManagers` here.
- No caller anywhere reads `Plan.features[...]` / `resolveFeatureState` for existing GPS/Telephony/WhatsApp/booking-queue gating — those modules have no feature-flag check at all today, so "retrofitting" them means adding a check that didn't exist, not replacing a hardcoded one; flagged as new follow-up work, not a retrofit.
- No `Tenant.planId` field exists — a tenant can only ever resolve to the Plan matching its *legacy* `subscriptionPlan` string; there is no way yet to put a tenant on `ENTERPRISE` or a bespoke `CUSTOM` plan explicitly. Adding that field requires editing `server/models/index.ts` (Integrator-only) — flagged as follow-up, not built here.

## Soft dependency on TASK-ROOT-DOMAIN-01
`server/root/types.ts` and `server/root/services/rootAccessService.ts` do not exist in this worktree (DOMAIN-01 not yet merged into this lineage). Per `ROOT-CONTROL-PLANE-MANIFEST.md`'s instruction, a local placeholder was created at `server/root/routes/_localPlatformAccess.ts` — **not** one of this task's originally-listed owned files, added because the manifest explicitly calls for it and the two real files are off-limits to create/edit directly. It exports:
- `PlatformRole` (mirrors the manifest's documented union type exactly)
- `requirePlatformRole(allowed)` — 403s any session without a matching `platformRole` (today, that's every session, since the field doesn't exist on `User` yet — this is exactly what makes the tenant-isolation test below pass)
- `recordAuditEvent(event)` — writes to a narrowly-named `RootSalesConfigPlaceholderAuditEvent` collection (not `GpsAuditLog`, not the future `server/root/models/auditLog.ts`) so this task's own audit test has something real to query.

**Integrator action needed**: once DOMAIN-01 + SECURITY-05 land, delete `_localPlatformAccess.ts`, repoint `sales.ts` / `config.ts` / `features.ts` imports at the real `PlatformRole` (`server/root/types.ts`) and `RootAccessService` (`server/root/services/rootAccessService.ts`), and migrate/drop the placeholder audit collection.

## Tests run
- `npx tsc --noEmit -p tsconfig.json` → **0 errors** (whole project, not just this task's files).
- `MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro_test_sales_config npx tsx server/root/__tests__/salesConfigModels.test.ts` → **10 passed, 0 failed**. Covers: pipeline transition validity (forward-only, LOST reachable pre-tenant/terminal after), full PROSPECT→WON walk + `POST .../create-tenant` producing a real `Tenant` via the *same* `storage.createTenant`/`mongoTenantSchema` call `POST /api/admin/tenants` uses, `resolveEntitlement`/`resolvePlanLimit` returning different values across STARTER vs PROFESSIONAL plans, legacy-fallback behavior when no Plan matches, feature-flag disable → audit event + `GpsConnection` data survives unchanged, and per-tenant override beating the plan default.
- `MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro_test_sales_config_http npx tsx server/root/__tests__/rootAccess.http.test.ts` → **19 passed, 0 failed**. Real Express app mounting the real route files behind the real `authenticateUser` + `requirePlatformRole`; proves no session → 401, and tenant `client`/`manager`/legacy-`admin` sessions → 403 on all four `/api/root/**` route groups (16 checks), plus 3 isolated unit checks on `requirePlatformRole`'s allow/deny logic.
- No test runner (vitest/jest) is configured in this repo — these are plain Node/`tsx` scripts against a local `mongod` (confirmed running at `127.0.0.1:27017`), following the "connect, exercise real code, assert, non-zero exit on failure" pattern; each test file drops its own disposable database before and after running.
- Did not run `npm run dev` / spin up a dev server — not needed for these tests (no browser interaction involved), so no port was claimed.

## Deviations from scope
- Added `server/root/routes/_localPlatformAccess.ts` (not in the original owned-files list) — required by the manifest's explicit "define a local placeholder" instruction; see "Soft dependency" section above.
- `FEATURE_MODULES` (the module list gated by Tenant Feature Flags) is inferred from modules that actually exist in this codebase (GPS, Telephony, WhatsApp, Booking Queues, Vehicle 360, Driver lifecycle, Rewards/Referrals, Reports, API access, Customer portal) — the verbatim source-brief §20 module list wasn't available in this worktree's `docs/root-control-plane/` (only the audit + gap-matrix docs were present, not the full numbered brief). Flagging for confirmation against the real §20 text.
- Ran `npm ci` (not `npm install`) to populate `node_modules` in this worktree without touching `package-lock.json`.

## Notes for Integrator
- Apply the route-mount lines and nav entries above.
- Delete `_localPlatformAccess.ts` and repoint imports once DOMAIN-01/SECURITY-05 land (see above).
- Confirm `FEATURE_MODULES` against the real source brief §20 list; extend/rename as needed (it's a plain string-enum array, no migration required to add entries).
- Consider whether `POST /api/root/sales/prospects/:id/create-tenant`'s default `subscriptionPlan: 'starter'` fallback (when the prospect/override doesn't specify one) is the desired default, or whether Sales should be required to pick a Plan/legacy-plan explicitly before provisioning.
