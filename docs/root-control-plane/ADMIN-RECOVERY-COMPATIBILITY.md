# admin-recovery.ts Compatibility with the Option A Migration

## The question

`server/admin-recovery.ts` has two paths that create `role: 'admin'` accounts outside
the normal signup flow: `createBackupAdmin` (CLI-invoked) and `createEmergencyAdmin`
(env-var-triggered, invoked automatically at server startup if `EMERGENCY_ADMIN_ID`/
`EMERGENCY_ADMIN_PASSWORD` are set). Before the Option A migration, any `role:'admin'`
account got an unconditional cross-tenant bypass. After Option A, that bypass requires a
valid `platformRole` — so does a freshly-recovered admin account still work?

## Trace (not guessed)

Read `server/admin-recovery.ts` in full and `ADMIN_RECOVERY_GUIDE.md`:

- Neither `createBackupAdmin` nor `createEmergencyAdmin` accepts or sets a `tenantId`
  anywhere in either function.
- `ADMIN_RECOVERY_GUIDE.md` documents this as "Your FleetPro system"-wide recovery — i.e.
  platform-level, not tenant-level. This codebase's `role:'admin'` has never meant
  "tenant admin" — that's `role:'client'` (see `CURRENT-SUPER-ADMIN-AUDIT.md`).

Conclusion: these are platform-level recovery paths by design, so `platformRole:
'PLATFORM_ROOT'` (not a tenant role, and the highest platform tier) is the correct grant
— confirmed by tracing the actual code and docs, not assumed by pattern-matching on the
word "admin".

## The fix (already applied in the integration candidate, commit `745f63a`)

Both `createBackupAdmin` and `createEmergencyAdmin`'s user-creation objects now include:
```ts
platformRole: 'PLATFORM_ROOT' as const,
```
alongside the existing `role: 'admin'`. `role` is untouched — a recovery admin is still
`role:'admin'` for `requireAdmin`-gated `/api/admin/**` routes, and now separately holds
`platformRole:'PLATFORM_ROOT'` for `requireTenant`/`scopeTenant`-gated cross-tenant
routes. Without this fix, a freshly-recovered admin would be immediately locked out of
the exact cross-tenant routes recovery exists to restore access to — recovery would
"succeed" but the recovered account would still be unable to do its job.

## Regression test (added this pass — the gap this closes)

The brief explicitly required "regression tests proving the intended boundary" for this
fix; none existed before this pass. Added `server/admin-recovery.test.ts` (new, 4/4
passing, dedicated randomly-named throwaway DB per the existing convention):

1. `createBackupAdmin`: created account has `platformRole: 'PLATFORM_ROOT'`, not just
   `role: 'admin'`.
2. `createBackupAdmin` refuses a second admin creation, and — critically — the refusal
   path does not touch the first admin's `platformRole` (proves the "existing admin
   untouched" invariant, not just the "no second admin" invariant).
3. `createEmergencyAdmin`: same `platformRole` grant when triggered via
   `EMERGENCY_ADMIN_ID`/`EMERGENCY_ADMIN_PASSWORD`, and confirms `mustResetPassword:
   true` still holds (unrelated to this fix, must not regress).
4. **Boundary proof**: neither recovery path ever sets a `tenantId` — directly confirms
   the "platform-level, not tenant-level" trace above at the data layer, not just by
   reading the code.

## Live verification (QA-06 candidate, port 5301)

Started the candidate server with `EMERGENCY_ADMIN_ID=smoketest_root` /
`EMERGENCY_ADMIN_PASSWORD` set. Server log on boot:
```
Creating user with data: { userId: 'smoketest_root', role: 'admin', platformRole: 'PLATFORM_ROOT', ... }
✅ Emergency admin created: smoketest_root
```
Logged in as that account (`POST /api/auth/login` -> `200`), then confirmed it could
reach `GET /api/root/tenants` (`200`, cross-tenant data) — proving the fix end-to-end
against a real server, not just the unit test. Restarting the same server a second time
correctly detected the existing emergency admin and skipped re-creation
(`⚠️ Emergency admin user already exists`), confirming the idempotency guard is unaffected.

## Status: PASS. No open gaps.
