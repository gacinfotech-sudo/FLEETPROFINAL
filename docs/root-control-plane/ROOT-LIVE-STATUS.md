# Root Control Plane — Wave 1 Live Status (FINAL — promoted)

Updated by: Integrator session, 2026-08-07 ~19:31 IST, immediately after promotion and
post-switch smoke test.

## Promotion summary

**PROMOTED.** Root Control Plane Wave 1 is live on the canonical Manual-Test Preview.

- Worktree: `manual-test-preview`
- Branch: `preview/manual-test-reconciled`
- Commit: `168d205` (merge commit `cf77438` + build-identifier commit `168d205` on top)
- Port: **5100**, `HOST=127.0.0.1`
- Database: `fleetpro` (shared canonical preview DB — the QA-06 candidate used its own
  dedicated throwaway DB and never touched this one)
- Build banner (dev-only, printed at boot):
  `FLEETPRO CANONICAL MANUAL TEST / Commit: 168d205 / Root Wave: WAVE 1 + QA / Updated: 2026-08-07T14:01:23.462Z`

## Prior canonical preview state (recorded before switch, for rollback)

- Branch: `preview/manual-test-reconciled`
- Commit: `2f3127106183980a81f27b531ef0276e949e7327`
- PID: `54287` (stopped cleanly before restart)
- Port: 5100

**Rollback**: `git checkout 2f31271 -- .` on the `manual-test-preview` worktree (or `git
reset --hard 2f31271` if no other work has landed since), then restart. All Root Wave 1
changes are strictly additive at the file level (no existing file was deleted; the one
behavioral change — Option A's `requireTenant`/`scopeTenant` migration — is isolated to
`server/middleware/auth.ts` and `server/routes.ts`), so a rollback is low-risk if ever
needed.

## Merge and promotion path

1. `integration/root-control-plane-wave1` (worktree `root-integration`) — 5 Wave 1
   branches merged, reconciled to one canonical `RootAccessService` contract, Option A
   migration applied and hardened, admin-recovery fixed and tested, live QA-06 pass
   (found + fixed the audit-sink bug). Final commit: `bead79e`.
2. Merged into `preview/manual-test-reconciled` with `--no-ff`: **0 conflicts**, 69 files
   changed, all additive except `server/routes.ts` (44 lines, new route mounts) and the
   Option A files. Merge commit: `cf77438`.
3. `npx tsc --noEmit`: 0 errors on the merged canonical branch.
4. Old preview process (PID `54287`) stopped cleanly; new process (PID `90945`) started
   on the same port `5100` against the same `fleetpro` DB.
5. Post-switch smoke test (immediate): base app `GET /` -> 200; existing
   `GET /api/csrf-token` -> 200 (pre-existing functionality unaffected); unauthenticated
   `GET /api/root/tenants` -> 401 (new surface reachable and protected); `GET
   /root/dashboard` -> 200 (SPA route resolves).

## Status by task

| Task | Status | Commit | Test |
|---|---|---|---|
| TASK-ROOT-DOMAIN-01 | READY, promoted | `b30f801` | 35/35 (24 unit + 11 migration-script, DB-backed) |
| TASK-ROOT-SECURITY-05 | READY, promoted | `033e461` | 19/19 (Playwright) |
| TASK-ROOT-DASHBOARD-02 | READY, promoted | `6dd20c1`/`91b3922` | 22/22 |
| TASK-ROOT-SUPPORT-03 | READY, promoted | `fcb98e3` | 32/32 |
| TASK-ROOT-SALES-CONFIG-04 | READY, promoted | `83543a0` | 29/29 |
| TASK-ROOT-QA-06 | **DONE**, this pass | n/a (executed directly, not a separate branch) | see `ROOT-QA-06-REPORT.md` — found + fixed 1 real bug live |

## Aggregate test count

- **127/127** unit/integration tests (`node:test`, run individually per file), 0 failures,
  re-confirmed after the audit-sink fix.
- **19/19** Playwright E2E (SECURITY-05's original suite, not re-run this pass — no
  files it covers were touched after its own last verification).
- Live QA-06: 20 real-HTTP scenarios against a running server, all passing after the
  audit-sink fix (see `ROOT-QA-06-REPORT.md` for the full table).

## Security boundary — final proof (live, real HTTP)

| Case | Result |
|---|---|
| Migrated `PLATFORM_ROOT` -> `/api/root/**` | ALLOW (200) |
| Unauthenticated -> `/api/root/**` | DENY (401) |
| Legacy `role:'admin'`, no `platformRole` -> `/api/root/**` | DENY (403) — no bypass into new Root surface |
| Legacy `role:'admin'`, no `platformRole`, no `tenantId` -> tenant route | DENY (403) — documented Option A regression |
| Ordinary tenant client -> `/api/root/**` | DENY (403) — tenant-admin -> root denied |
| Ordinary tenant client -> own tenant route | ALLOW (200) — unaffected |
| Invalid/garbage `platformRole` string -> tenant route | Fails closed (scoped/403, not bypass) |
| PII (`GET /api/root/customers*`) | Masked in every response (`91987XXXXX`, `ra***@example.com`) — raw values never returned |
| PII read audit trail | **Fixed this pass** — now durably persisted to `GET /api/root/audit`, was previously silently dropped |
| Break-glass expiry | Real wall-clock expiry proven (3s duration, confirmed `active:false` after a real 4s wait, not a mocked clock) |
| Support-access mode | Enter/status/exit all functional, all 3 actions produce real audit events |
| Secret redaction (error capture) | Covered by unit tests (`errorCaptureService.test.ts`, 12/12) — no live POST endpoint exists to submit a new error through the Error Center's read-only router, so this specific case was not exercised live this pass (see `ROOT-QA-06-REPORT.md`'s "not covered" section) |

## Root URL

`http://127.0.0.1:5100/root/dashboard` (requires a `PLATFORM_*` session — log in with an
account holding a valid `platformRole`, e.g. via `scripts/migrate-admin-to-platform-role.ts`
or a fresh `admin-recovery.ts` emergency-admin bootstrap).

## Deferred (unchanged, explicitly out of Wave 1 scope)

- **MFA** — `mfaStatus: 'not_implemented'`, honest placeholder.
- **Release Management** — not started, out of scope.

## Known open items for Wave 2

1. `POST /api/root/customers/:id/unmask` not exercised live this pass (implemented, unit
   logic untested end-to-end via HTTP).
2. DASHBOARD-02's `localRootAccessService` contract divergence (paginated vs. bare-array)
   — flagged, not force-reconciled; see `WAVE-1-INTEGRATION-REPORT.md`.
3. `platform-role-map.json` — an untracked, uncommitted artifact left in the
   `root-integration` worktree from a prior migration-script dry-run by a different
   session; not part of this integration, left alone rather than deleted (not mine to
   remove without knowing if it's still needed).

## Rollback commit

`2f3127106183980a81f27b531ef0276e949e7327`
