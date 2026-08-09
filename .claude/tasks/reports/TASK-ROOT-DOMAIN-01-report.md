# TASK-ROOT-DOMAIN-01 report — backend-worker

## Status
done

## Files changed
- `server/root/types.ts` — new. `PlatformRole` union + `PLATFORM_ROLES`/`isPlatformRole`, `UserPlatformFields`, `RootAccessRequest`/`Middleware`, `TenantListFilter`/`TenantSummary`/`Tenant360`, `GlobalCustomerFilter`/`MaskedCustomerRow`, `PlatformAuditEvent`, and the `RootAccessService` interface.
- `server/root/services/rootAccessService.ts` — new. Real `createRootAccessService()`/`rootAccessService` implementation: `requirePlatformRole`, `listTenants`, `getTenant360`, `getCustomerAcrossTenants`, `recordAuditEvent`, plus `maskPhone`/`maskEmail` placeholder PII masking.
- `server/root/services/rootAccessService.test.ts` — new. 24 unit tests (authorization logic, DI plumbing, audit forwarding, masking).
- `scripts/migrate-admin-to-platform-role.ts` — new. Dry-run-by-default, idempotent migration script (see below).
- `scripts/migrate-admin-to-platform-role.test.ts` — new. 11 live-DB integration tests against a dedicated throwaway database.
- No `server/root/models/**` files — decided not to create a separate platform-staff model (see decision below).

## API surface changed
None. This task ships no HTTP routes — `RootAccessService` is a service layer other Wave-1 tasks' routes call into.

## `server/root/types.ts` — the contract, as shipped

Matches `ROOT-CONTROL-PLANE-MANIFEST.md`'s documented contract exactly, with additive supporting types the manifest referenced but didn't spell out (`TenantListFilter`, `TenantSummary`, `Tenant360`, `GlobalCustomerFilter`, `MaskedCustomerRow`, `PlatformAuditEvent`, `Middleware`/`RootAccessRequest`) so the interface actually compiles. No deviation in the parts the manifest did spell out:

```typescript
export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

export const PLATFORM_ROLES: readonly PlatformRole[] = [ /* all six, in the order above */ ];
export function isPlatformRole(value: unknown): value is PlatformRole { /* ... */ }

export interface UserPlatformFields {
  platformRole?: PlatformRole;
}

export interface RootAccessService {
  requirePlatformRole(allowed: PlatformRole[]): Middleware; // 403 if missing/insufficient
  listTenants(filter: TenantListFilter): Promise<TenantSummary[]>;
  getTenant360(tenantId: string): Promise<Tenant360>;
  getCustomerAcrossTenants(filter: GlobalCustomerFilter): Promise<MaskedCustomerRow[]>;
  recordAuditEvent(event: PlatformAuditEvent): Promise<void>;
}
```

`PlatformAuditEvent` generalizes `GpsAuditLog`'s shape (`server/gps/models/gpsConnection.ts`) as instructed: `{ actorUserId, actorPlatformRole, action, targetTenantId?, targetUserId?, resourceType?, resourceId?, oldValue?, newValue?, reason?, metadata?, createdAt? }`.

Other Wave-1 tasks: import directly from `server/root/types.ts` — it now exists in this worktree's lineage, no placeholder needed once this branch is merged.

## Platform-staff-modeling decision

**Decision: reuse `User` with the additive `platformRole` field. No separate `server/root/models/**` platform-staff model was created.**

Justification:
- The manifest's own recommendation ("do not create a second source of truth") and the gap matrix's framing of this as primarily a *migration* of an existing mechanism, not a new one, both point the same direction.
- A separate collection would need its own session/auth wiring, duplicate `isActive`/lockout/session-device-tracking fields `User` already has, and would reopen the exact "two independent, overlapping root mechanisms" problem the gap matrix flagged as the critical design fork — just one layer down (two *user* stores instead of two *bypass conditions*).
- Platform staff are a small, low-cardinality set of real people (per the audit: today, real `role: 'admin'` accounts are the entire existing platform-staff population) — the "would this ever need independent scaling/schema" argument for a separate collection doesn't apply here.
- The one legitimate argument *for* a separate collection — that platform staff logging in as "PLATFORM_ROOT" for a support session and a tenant's own `client`/`manager` login are conceptually different actors — is already handled correctly by keeping `role` and `platformRole` as two independent, never-compared fields on the same document (per the manifest's explicit instruction not to mix them), rather than by physically separating the storage.

## Proposed patch — `server/middleware/auth.ts` (NOT applied by this task)

Current (`server/middleware/auth.ts:86-98`):
```typescript
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Admin users can access all tenant resources
  if (req.user?.role === "admin") {
    return next();
  }
  ...
```

Proposed:
```typescript
export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Platform staff (User.platformRole set) can access all tenant resources.
  // Replaces the old `role === "admin"` bypass — see
  // server/root/types.ts (PlatformRole) and
  // scripts/migrate-admin-to-platform-role.ts (TASK-ROOT-DOMAIN-01).
  if (req.user?.platformRole) {
    return next();
  }
  ...
```
(Rest of the function — the `tenantId` check and its error response — is unchanged.)

## Proposed patch — `server/routes.ts:159` (NOT applied by this task)

Current (`server/routes.ts:169-171`, inside `registerRoutes`):
```typescript
  const scopeTenant = (req: AuthRequest): string | undefined =>
    req.user?.role === "admin" ? undefined : req.tenantId;
```

Proposed:
```typescript
  const scopeTenant = (req: AuthRequest): string | undefined =>
    req.user?.platformRole ? undefined : req.tenantId;
```

## Exactly what this patch changes (for the Integrator's regression pass)

1. **Behavior for accounts with `platformRole` set**: identical to today's `role === 'admin'` accounts — unconditional cross-tenant bypass through `requireTenant` and `scopeTenant`. Every existing `/api/admin/**` request pattern keeps working, *for accounts that have been migrated*.
2. **Behavior for `role: 'admin'` accounts that have NOT yet been migrated (no `platformRole` set)**: this is the one real regression risk. The moment this patch lands, any `role: 'admin'` account without `platformRole` **loses cross-tenant access** — `requireTenant` will now require `req.tenantId` for them, same as a `client`/`manager`. **This patch must not be applied until the migration script has been run in `--apply` mode, with a reviewed `--map`, covering every real `role: 'admin'` account that needs to keep working.** Run the dry-run first (`npx tsx scripts/migrate-admin-to-platform-role.ts`) against production data to get the exact list before deciding the map.
3. **`role` field itself is never touched.** Every other `role === 'admin'` check elsewhere in the codebase (grepped, full list below) continues to behave exactly as before, since `role` is preserved byte-for-byte by the migration script.
4. **Not touched by this patch, found during due diligence, listed for awareness**: `requireAdmin` (`auth.ts:63`, gates the `/api/admin/**` namespace's entry, separate from `requireTenant`'s cross-tenant bypass), `permissions.ts:36`, `routes.ts:1539,1599,1616,1633,2177,2938,5744,5783,6028`, `admin-recovery.ts:19,59`, `storage-mongodb.ts:1263`, `index.ts:169`, `booking/domain/revisionHistory.ts:68`, `telephony/routes/calls.ts:29`, `telephony/routes/identities.ts:14,49,73`, `telephony/services/callService.ts:108` — all check `role === 'admin'` (mostly OR'd with `role === 'client'`, for "tenant owner or platform admin" gating, a different concern from cross-tenant scoping). None of these are modified by this task's proposed patch, and none of them break, because `role` is never changed. Flagging them so the Integrator's regression pass has the complete list rather than discovering it mid-review.

## Migration script — `scripts/migrate-admin-to-platform-role.ts`

Dry-run by default (`npx tsx scripts/migrate-admin-to-platform-role.ts`, no flags) — makes **no** DB writes under any circumstance without `--apply`. Behavior:

- Reads every `role: 'admin'` account (via `User.collection`, the raw MongoDB driver — see "Implementation note" below for why).
- Partitions into `alreadyMigrated` (has any `platformRole` already — from a prior run or a human edit) and candidates.
- For each candidate, resolves a target role from `--map=<file.json>` (a human-reviewed `{ "<userId>": "<PlatformRole>" }` object — the required per-account review path) and/or `--default-role=<PlatformRole>` (an explicit fallback for anyone not in the map — never a silent default).
- Dry-run: prints the full plan (`toMigrate`, `unresolved`, `alreadyMigrated`) and exits 0. Nothing is written.
- `--apply`: **aborts with exit code 1** if any candidate is unresolved (no map entry, no default-role) — refuses to blanket-assign. `--skip-unresolved` proceeds anyway, leaving those accounts untouched and reporting them separately.
- Idempotent: a real `--apply` run only touches accounts currently missing `platformRole` (guarded by `platformRole: { $exists: false }` in the write filter, unless `--force-remap`). Running the identical command twice produces `matched: 0, modified: 0` on the second run — proven by test.
- Never modifies the `role` field — only ever `$set`s the new `platformRole` field.

**Implementation note**: `User.platformRole` isn't a declared Mongoose schema path yet (that's the Integrator-applied `server/models/index.ts` patch, not part of this task). Mongoose's default `strict` document mode silently drops undeclared fields from both `.select()` projections and `$set` updates issued through the `Model` API — an early version of this script and its test silently no-op'd on this exact issue. The script uses `User.collection` (the underlying native MongoDB driver `Collection`) for both the read and the `bulkWrite`, which bypasses Mongoose schema casting entirely. This means the script is correct **today** (before the schema patch lands) and needs no changes **after** the schema patch lands.

### Real dry-run output example (against a throwaway seeded dataset — 2 admin accounts, one already migrated)

```json
{
  "mode": "dry-run",
  "totalAdminAccounts": 2,
  "alreadyMigrated": [
    {
      "userId": "admin-bob",
      "name": "Bob Support",
      "platformRole": "PLATFORM_SUPPORT_ADMIN"
    }
  ],
  "toMigrate": [],
  "unresolved": [
    {
      "id": "6a75d5a6488050e46be33f32",
      "userId": "admin-jane",
      "name": "Jane Root"
    }
  ],
  "note": "Run with --apply --map=<file covering these userIds> (and/or --default-role=<PlatformRole>) to migrate. No changes were made."
}
```

## Tests run

- `npm run check` → **0 errors** (clean, after installing dependencies in this worktree — `node_modules` didn't exist yet, ran `npm install` first; `package-lock.json` unchanged).
- `npx tsx --test server/root/services/rootAccessService.test.ts` → **24/24 pass**. Covers: `requirePlatformRole` 403s with no `platformRole` (proven), 403s with a `platformRole` not in the allowed list (proven, including an all-role-pairs matrix and a legacy tenant-`role`-only identity), allows through and touches nothing on the response when authorized, throws on a misuse (empty allowed list); DI plumbing for `listTenants`/`getTenant360`/`getCustomerAcrossTenants`; `recordAuditEvent` timestamp handling and sink-failure propagation; `maskPhone`/`maskEmail`; `isPlatformRole`. No live DB needed — every DB-backed method is exercised through injected fakes.
- `npx tsx --test scripts/migrate-admin-to-platform-role.test.ts` → **11/11 pass**. A real, live-DB integration test against a dedicated, randomly-named throwaway database on the same local `mongod` every worktree's dev server uses (`127.0.0.1:27017`) — **never** the shared `fleetpro` database. Covers: dry-run listing with zero writes, apply-without-map abort (with DB-state proof), a real apply with a reviewed map (DB-state proof, `role` field untouched), idempotency (identical command run twice → `matched: 0, modified: 0` the second time, DB state unchanged), `--skip-unresolved`, `--default-role`, and fail-closed rejection of an invalid role in either `--map` or `--default-role` before any DB write. The throwaway database is dropped in an `after()` hook; verified no residue left behind after every run in this session (initially found 4 leaked near-empty phantom databases from Mongoose's background `autoIndex` collection creation racing the drop during earlier iterations of this test — fixed by connecting with `{ autoIndex: false }` in both the test and the script itself; confirmed zero residue on the final run).
- Combined run (`rootAccessService.test.ts` + `migrate-admin-to-platform-role.test.ts`): **35/35 pass**.

## Deviations from scope
None. Stayed inside `server/root/types.ts`, `server/root/services/rootAccessService.ts` (+ its test), `scripts/migrate-admin-to-platform-role.ts` (+ its test). No `server/root/models/**` created (justified above). `server/middleware/auth.ts`, `server/routes.ts`, `server/models/index.ts` were read-only for research; not modified. Ran `npm install` since `node_modules` was absent in this fresh worktree — did not touch `package-lock.json` (git diff confirms it's byte-identical).

## Notes for Integrator

1. **Sequencing is critical**: apply the `requireTenant`/`routes.ts:159` patch **only after** running the migration script in `--apply` mode (with a reviewed `--map`) against real production data, and only after `server/models/index.ts` has the additive `platformRole` field. Applying the route patch first (or without migrating first) locks out every currently-working `admin` account from cross-tenant access.
2. **`server/models/index.ts` patch needed**: add `platformRole?: PlatformRole;` to the `IUser` interface and `platformRole: { type: String, enum: [...PLATFORM_ROLES] }` (not `required`) to `UserSchema`, importing `PlatformRole`/`PLATFORM_ROLES` from `server/root/types.ts`. Once that lands, the migration script's `User.collection` raw-driver reads/writes keep working unchanged (they never depended on the schema declaration), but every other part of the app (e.g. any future code doing `req.user.platformRole` through the normal Model API, or Mongoose validation) starts working through the normal Mongoose path too.
3. **Grep guard**: the only unscoped (no-`tenantId`-filter) queries in this task's diff are `defaultListTenants`, `defaultGetTenant360` (tenantId-scoped by design — single-tenant lookup), and `defaultGetCustomerAcrossTenants` in `rootAccessService.ts` — confirmed via `grep -n "\.find(\|\.findById(\|\.findOne(\|\.countDocuments("` against this task's new files. Every route built by the other four Wave-1 tasks should call through `rootAccessService`'s methods, never write its own.
4. **`recordAuditEvent`'s sink is a placeholder** until `TASK-ROOT-SECURITY-05`'s `server/root/models/auditLog.ts` lands: it dynamically imports that path (via a non-literal specifier so `tsc` doesn't fail resolving a module that doesn't exist yet in every other worktree) and falls back to a structured `console.warn` if the module isn't there. Once SECURITY-05's model is merged, events start persisting automatically with zero code change here — but the Integrator should double check the persisted shape matches `PlatformAuditEvent` exactly (or add a thin adapter).
5. **PII masking in `getCustomerAcrossTenants` is a placeholder** (`maskPhone`/`maskEmail` in `rootAccessService.ts`) until `TASK-ROOT-SECURITY-05`'s real `piiMaskingService.ts` lands — safe-by-default (never returns raw PII) but should be swapped for the real service once available.
6. This worktree had no `node_modules` on start (fresh worktree checkout) — installed via `npm install`, 626 packages, no lockfile changes.
