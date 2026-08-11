# Root Control Plane — Wave 1 Integration Report (Final)

Second-pass integrator session, 2026-08-07. Picks up from the integration candidate
already assembled at `integration/root-control-plane-wave1` commit `6ef24d4` (worktree
`root-integration`) — see `docs/root-control-plane/ROOT-INTEGRATION-report.md` for the
full merge-order/conflict-resolution history (5 branches merged, 2 real conflicts, both
resolved keeping the real DOMAIN-01 files over placeholders; `server/models/index.ts`
schema patch; requireTenant/scopeTenant Option A migration; admin-recovery.ts fix; route
mounting; sidebar/App.tsx wiring). This report covers everything added on top of that
candidate to reach promotion, and records the final promoted state.

## What this pass added, on top of `6ef24d4`

1. **`server/admin-recovery.test.ts`** (new, 4/4 passing) — the regression test the
   admin-recovery compatibility fix was missing. Proves both recovery paths grant
   `platformRole: 'PLATFORM_ROOT'`, that a second admin-creation attempt is refused
   without touching the first account, and a boundary proof that neither recovery path
   ever sets a `tenantId` (platform-level, not tenant-level recovery). Full detail:
   `ADMIN-RECOVERY-COMPATIBILITY.md`.

2. **`isPlatformRole()` fail-closed hardening** in `requireTenant`
   (`server/middleware/auth.ts`) and `scopeTenant` (`server/routes.ts`) — both had
   already been migrated from `role === 'admin'` to checking `platformRole`, but via a
   bare truthy check (`if (req.user?.platformRole)`) rather than validating the value.
   An unrecognized string in that field — reachable only via a write path that bypasses
   Mongoose's enum validation (a raw-driver write, a manual DB edit, a future admin tool
   bug; the migration script itself is safe) — would have granted the cross-tenant
   bypass anyway. Hardened both to use `isPlatformRole()`, the validator DOMAIN-01 had
   already built for exactly this purpose but never wired in here. Full detail:
   `OPTION-A-MIGRATION-REPORT.md`.

3. **`server/middleware/auth.requireTenant.test.ts`** — extended with 3 new "FAIL
   CLOSED" cases (garbage `platformRole` string, empty string, across both
   `requireTenant` and the `scopeTenant` describe block) proving the hardening above.

4. **Live QA-06 pass against a real running server** (not just the unit suite) — found
   and fixed one real bug: `RootAccessService.recordAuditEvent`'s DB write path
   (`defaultAuditSink`) was silently failing on every single call across the entire Root
   Control Plane (config, features, sales, customers — 9+ call sites), due to a wrong
   export name plus a field-shape mismatch between the canonical event contract and the
   independently-designed DB schema. Full detail: `ROOT-QA-06-REPORT.md`.

5. **Promoted into the canonical Manual-Test Preview** (`preview/manual-test-reconciled`,
   worktree `manual-test-preview`, port 5100) — clean merge, 0 conflicts, 0 typecheck
   errors. Full detail: `ROOT-LIVE-STATUS.md`.

## Final commit chain

```
2f31271  (base: preview/manual-test-reconciled, pre-Root)
  -> 8528e28  Merge feat/root-domain-01
  -> 84d4702  Merge feat/root-security-05
  -> 38a8965  Merge feat/root-dashboard-02
  -> c63e446  Merge feat/root-support-03
  -> 469ccbc  Merge feat/root-sales-config-04
  -> f653285  Reconcile placeholder RootAccessService contracts to canonical
  -> 649939f  Add User.platformRole + Tenant additive fields (schema patch)
  -> c8487a1  Apply the requireTenant/scopeTenant Option A migration
  -> 745f63a  Give admin-recovery.ts-created admins a platformRole
  -> 05dd310  Mount all Root Control Plane routes + correlation-ID middleware
  -> c6053a1  Add Root/Platform nav section to sidebar.tsx
  -> 6ef24d4  Register all Root Control Plane routes in App.tsx      [prior session's candidate: READY]
  -> bead79e  QA-06 fix: PlatformAuditEvent sink was silently dropping every audit write
                (server/admin-recovery.test.ts, isPlatformRole hardening, and the
                 auth.requireTenant.test.ts FAIL CLOSED cases are folded into this
                 worktree's history prior to bead79e — see git log for exact commits)
  -> cf77438  [on preview/manual-test-reconciled] Merge integration/root-control-plane-wave1
                PROMOTED — this is the live canonical preview HEAD.
```

## Test results (final, before promotion)

- `npx tsc --noEmit`: **0 errors**, full merged tree, re-confirmed after every change in
  this pass.
- **127/127** tests passing, run individually per file (avoids a known harmless
  `node:test` IPC artifact when running many files in one process — see
  `ROOT-QA-06-REPORT.md`): `admin-recovery.test.ts` (4), `auth.requireTenant.test.ts`
  (13), `rootAccess.http.test.ts` (1 wrapper), `salesConfigModels.test.ts` (1 wrapper),
  `correlationId.test.ts` (8), `errors.test.ts` (5), `support.test.ts` (7),
  `errorCaptureService.test.ts` (12), `piiMaskingService.test.ts` (11),
  `rootAccessGate.test.ts` (6), `rootAccessService.test.ts` (24),
  `tenantIsolation.test.ts` (5), `bookingCodeService.test.ts` (19),
  `migrate-admin-to-platform-role.test.ts` (11).
- Re-run again after the audit-sink fix: still 127/127, 0 regressions.
- Live QA-06 scenarios against a real running server (isolated candidate, port 5301):
  see `ROOT-QA-06-REPORT.md` for the full scenario list and results.
- Post-promotion smoke test on the canonical preview (port 5100): see
  `ROOT-LIVE-STATUS.md`.

## Deferred / known gaps (unchanged from prior reports, explicitly not silently dropped)

- **MFA**: explicitly out of scope for Wave 1 (user-confirmed at dispatch time).
  `mfaStatus: 'not_implemented'` is an honest placeholder in `GET /api/root/security/events`,
  not a fake success state.
- **Release Management**: explicitly out of scope for Wave 1.
- **DASHBOARD-02's `localRootAccessService` contract divergence** (paginated
  `{rows,total}` vs. canonical bare-array `RootAccessService`): deliberately not
  force-reconciled — flagged as a Wave 2 design decision in
  `ROOT-INTEGRATION-report.md`. Its `requireRole` gate and `getCustomerAcrossTenants`
  read path still use the local placeholder; only its `recordAuditEvent` calls
  (in `server/root/routes/customers.ts`) were repointed to the canonical, durably-persisted
  sink in this pass, since that specific gap was a live-verified security defect
  (PII-read audit events not being persisted), not a cosmetic shape difference.
- **`POST /api/root/customers/:id/unmask`** (the "View Sensitive Data" flow,
  implemented in `audit.ts` per its own coordination note) was not exercised in this
  pass's live QA-06 run — Customer 360 detail view was tested (masked output confirmed
  correct), but the explicit unmask-with-reason round trip was not. Recommended as the
  first live check in any Wave 2 session picking this up.
