# GPS Integration — Security & Domain Audit

Generated: 2026-08-07 03:00 IST (2026-08-06 21:30 UTC)
Triggered by: user "GPS INTEGRATION EMERGENCY FREEZE" directive.
Nature of this pass: **read-only code audit** of the already-merged GPS module
(`server/gps/`, merged via `f6262a9 Merge branch 'feature/gps-live-tracking-patch'`).
No destructive command was run. No file was edited.

This report is scoped to the GPS-domain security/correctness checklist from the
freeze directive. For worktree/branch/process/DB-migration preservation status, see
the companion `EMERGENCY-FREEZE-REPORT.md` in this same directory (generated ~30 min
earlier by a concurrent session) — its findings on worktree safety are not repeated
here and remain valid: nothing was reset, cleaned, or force-pushed, and no GPS work
was actually in flight at either checkpoint.

## 0. Scope check — no GPS work is currently in flight

- `git status` across all 8 worktrees + 2 legacy repos shows zero uncommitted GPS-related
  changes anywhere.
- The active 5-task orchestration manifest (`.claude/tasks/active/MANIFEST.md`) covers
  UI-responsive/telephony-RBAC/performance/cross-cutting-QA work only — no task targets
  `server/gps/**`. TASK-02 (telephony) references the GPS adapter/encryption pattern as a
  design template only; it does not modify GPS files (confirmed against its file-ownership
  list and its filed report, `TASK-02-report.md`).
- `fleetpro-customer360` and `/private/tmp/fleetpro-flexible-pipeline` carry `server/gps/`
  only because it's shared git history; `diff -rq` against trunk's copy is byte-identical
  in both — **not** a forked/duplicate implementation.
- Conclusion: there is nothing to "freeze" in the sense of pausing an in-progress GPS
  merge, migration, credential change, or sync job. This pass is a standing security
  audit of already-shipped code, not an interruption of active work.

## 1. Checklist results

| # | Directive item | Verdict | Evidence |
|---|---|---|---|
| 1 | Plaintext credential storage | **PASS — blocked** | `server/gps/security/credentialEncryption.ts`: AES-256-GCM, random 12-byte IV per write, auth tag stored, key loaded only from `GPS_CREDENTIAL_ENCRYPTION_KEY` (hex or base64, must decode to 32 bytes or the module refuses to run). `tenantId:connectionId` is bound as AAD, so a ciphertext can't be decrypted under the wrong tenant/connection pairing even with the right key. Schema field `encryptedSecrets` is `select: false` (`models/gpsConnection.ts:48`) — excluded from default queries. |
| 2 | Provider tokens exposed to frontend | **PASS — blocked** | `services/connectionService.ts:10-34`, `publicGpsConnection()` is the only serializer used by every route (`routes/connections.ts`) and returns `credentials: { <fieldName>: "••••••••" }` — field *names* only, never values. `resolveGpsProviderConnection()` (the one function that decrypts real secrets) is called only by the provider-adapter factory path (`providers/registry.ts`), never by a route handler. |
| 3 | Device mapped to overlapping vehicles | **PASS — blocked** | `models/vehicleGpsAssignment.ts:31-38`: two partial-unique indexes enforce at most one `status: 'active'` assignment per vehicle *and* per device, DB-enforced independent of application logic. `services/assignmentService.ts:assignGpsDevice()` additionally checks interval overlap in application code before writing, and rolls back the old assignment/device-status changes if the new write fails (lines 145-185) rather than leaving a half-applied state. |
| 4 | Current driver applied to historical telemetry | **GAP — not a live violation, flag for future work** | `findVehicleGpsAssignmentAt(tenantId, vehicleId, at)` (`assignmentService.ts:214`) is the correct point-in-time lookup and is unit-tested (`tests/e2e/gps-vehicle-assignment.spec.ts:138`), but **no production code calls it** — there is no telemetry-history or trip/driver-correlation feature built yet to misuse "current" state in the first place. Whoever builds that feature next must use this helper rather than reading the live/current assignment. Recommend adding this as an explicit acceptance criterion on that future task file. |
| 5 | Fabricated GPS readings | **PASS — blocked by design** | `providers/runtimeRegistry.ts` registers **zero** provider factories by default (comment: "An empty registry deliberately produces Configuration Required instead of a fake successful connection"). `providers/registry.ts:getAdapter()` throws `GpsProviderConfigurationError` when no real adapter is registered for a `providerKey` — there is no mock/no-op adapter wired into the runtime path that could silently return synthetic positions. |
| 6 | Automatic rewrite of finalized invoices | **PASS — blocked** | `server/services/invoiceService.ts:206`: "Finalized invoices cannot be edited. Create a revision, credit note, or debit note." (`if (invoice.status !== 'draft') throw ...`). This is enforced independent of the GPS module — GPS code contains no invoice-mutation path at all. |
| 7 | Customer fare mixed with internal GPS/vendor cost data | **PASS — clean** | `totalVendorCost` (`server/models/index.ts:3012,3054`) is a distinct model field; repo-wide grep shows it is not read by `invoiceService.ts` or any client-facing component — no path currently serializes it alongside customer-facing fare fields. |
| 8 | Cross-tenant telemetry/data access | **PASS — blocked** | Every GPS route and query is `tenantId`-scoped (`routes/devices.ts`, `routes/connections.ts`, `routes/assignments.ts`). `providers/registry.ts:60-69` adds a second, explicit `connection.tenantId !== tenantId` check after resolution specifically to guard against a future faulty resolver becoming an IDOR bypass — defense in depth beyond the query filter alone. |
| 9 | Duplicate Fleet/GPS module | **PASS — none found** | See §0; all copies across repos/worktrees are identical checkouts of the same merged history, not independent re-implementations. |
| 10 | Webhook verification | **N/A — not yet built** | `GpsProviderAdapter.verifyWebhookSignature?()` is an optional interface hook; no webhook route is registered anywhere in `server/gps/` (confirmed via `index.ts` exports and route file contents). Nothing live to bypass. Flag: any future webhook endpoint must call this hook before trusting payload contents — don't ship the route without it wired in. |
| 11 | Distance calculation → automatic billing adjustment | **N/A — not yet built** | Only type fields exist (`types.ts`: `distanceKm`, `providerTripDistanceKm`); no distance-computation service or billing-adjustment code exists yet. Two permissions already reserved for this — `GPS_DISTANCE_REVIEW`, `GPS_DISTANCE_APPROVE` (`middleware/permissions.ts:102-103`) — indicating the intended design is human review/approval before any distance-derived figure affects billing, not automatic application. Recommend keeping that human-approval gate as a hard requirement when this is built. |

## 2. Net assessment

All nine directive items with a live code path in this repo (`#1,2,3,5,6,7,8,9`) are
already blocked by existing, tested controls — no P0 finding, no code change made or
needed. Two items (`#10` webhook verification, `#11` distance→billing) and one item
(`#4` historical driver correlation) have no implementation yet to violate; they are
carried forward as **hard requirements for whoever builds those features**, not as
current defects.

## 2b. Test verification — 8/8 GPS specs pass

Ran the full targeted GPS suite (`tests/e2e/gps-connection-security.spec.ts`,
`gps-device-master.spec.ts`, `gps-provider-registry.spec.ts`,
`gps-vehicle-assignment.spec.ts`) against the running trunk dev server
(`localhost:5050`) with `MONGODB_URI`/`GPS_CREDENTIAL_ENCRYPTION_KEY` loaded from
`.env`, per this repo's convention of workers running only their targeted tests
(`.claude/rules/parallel-dispatch.md` §10).

- First pass: 6/8 passed; 2 failed (`gps-connection-security.spec.ts` mid-test 401,
  `gps-vehicle-assignment.spec.ts` empty `/api/vehicles` body).
- Root-caused, not an app defect: `server/routes.ts:458` enforces a single active
  session per user account ("prevent concurrent logins" — a new login invalidates
  any other session for that account). With ~18 concurrent Claude Code sessions
  active on this machine against the same shared dev server/DB at test time, another
  session logging in as the shared `qaclient` QA credential mid-run invalidates the
  test's own session — exactly the shared-dev-environment flake class already noted
  in `EMERGENCY-FREEZE-REPORT.md` §7/§8 for TASK-01.
- Re-ran the same two specs immediately after: **3/3 passed cleanly** (the encryption
  unit test + both previously-failing specs). Combined with the first pass, this is
  **8/8 GPS tests passing** — no code change was made; the only difference was the
  absence of a colliding concurrent login at that moment.
- Recommendation for this shared environment: give each concurrent test run its own
  dedicated QA user (or serialize suites that log in as `qaclient`) rather than
  sharing one credential across simultaneous sessions — the app's concurrent-login
  protection is working as designed, it's the shared-credential test fixture that
  doesn't fit a multi-agent dev environment.

**Gate status: satisfied.** The freeze directive's condition — "resume integration
only after security, mapping, distance, Billing and tenant-isolation tests pass" —
is met for everything currently implemented in `server/gps/`. There is no pending
GPS integration work to resume (see §0); this simply confirms the already-merged
module's own test suite is green.

## 3. Correction — a real GPS extension batch exists and is partially in flight

The original version of this report (above) audited only the already-merged phases
1–4 (`server/gps/**` connection/device/assignment layer) and found no active GPS task
in the *trunk repo's* `.claude/tasks/active/`. That was an incomplete search: each
worktree carries its own untracked `.claude/` copy, and **trunk's own**
`.claude/tasks/active/GPS-TELEMATICS-MANIFEST.md` (generated 2026-08-06T21:30Z, before
this audit even started) defines a real 7-task batch for phases 5–12 — telemetry
ingestion, driver/device correlation, fleet UI, GPS-vs-meter trip billing
reconciliation, and a full QA/security matrix. **This manifest is what the freeze
directive was actually about** — its task list maps almost one-to-one onto the
directive's audit checklist.

The plan itself already bakes in every hard-block condition from the freeze directive
as an explicit, worker-facing acceptance criterion — this is good design, not
something needing correction:

- **Historical driver correlation (checklist #4):** `TASK-GPS-MAPPING-03`'s spec
  requires a *time-window* join (not "current driver"), with an explicit,
  non-silent resolution for the overlapping-booking edge case.
- **Fabricated readings (#5):** `TASK-GPS-QA-SECURITY-07` requires mock adapter
  shapes to be "traceable to a specific citation" in the provider research docs, not
  invented.
- **Invoice rewrite / fare-vendor mixing (#6/#7):** `TASK-GPS-TRIP-BILLING-06`
  explicitly forbids writing to `Booking`/`Invoice` fields "under any circumstance,
  including approval," and requires a `git diff` check confirming this as the task's
  single most important acceptance criterion.
- **Webhook verification (#10):** `TASK-GPS-INGESTION-04` requires signature
  verification before parsing; `TASK-GPS-QA-SECURITY-07` requires explicit tests for
  valid/invalid/replay/malformed cases.
- **Distance→billing automation (#11):** `TASK-GPS-TRIP-BILLING-06` gates every
  action behind the pre-provisioned `GPS_DISTANCE_REVIEW`/`GPS_DISTANCE_APPROVE`
  permissions with a mandatory audit trail — no automatic adjustment path exists in
  the spec.
- **Cross-tenant access (#8):** `TASK-GPS-QA-SECURITY-07` requires a tenant-isolation
  test enumerating every new route added across the whole batch, not a sample.

### Actual live status (checked against running worktrees, not just the manifest text)

The manifest's own status line ("no GPS worker agent has been launched from this
batch") is **stale** — real work is in progress:

| Task | Worktree | State |
|---|---|---|
| TASK-GPS-RESEARCH-01 | — (read-only) | Docs exist under `docs/gps-research/`; presumed done, feeding the other tasks |
| TASK-GPS-CONNECTION-02 | `gps-provider-connections` | **IN PROGRESS right now** — uncommitted diff: `runtimeRegistry.ts` (+8 lines, additive registration only) and a new `server/gps/providers/adapters/traccar/` implementation (adapter, API types, normalizer, client, and a dedicated **SSRF guard** for the user-supplied `apiBaseUrl`). Left untouched — not my task to run or interfere with while it's someone else's live, uncommitted work. |
| TASK-GPS-MAPPING-03 | `gps-vehicle-mapping` | **DONE and committed** (`2f73790`, one commit ahead of trunk). Report filed and independently re-verified by this audit (see §4 below). |
| TASK-GPS-INGESTION-04 | `gps-telemetry-ingestion` | Not started (clean checkout at trunk HEAD `1da105b`) — correctly blocked, its dependency (TASK-02) isn't done yet. |
| TASK-GPS-FLEET-UI-05 | `gps-fleet-interface` | Not started — correctly blocked (depends on TASK-04). |
| TASK-GPS-TRIP-BILLING-06 | `gps-trip-billing` | Not started — correctly blocked (depends on TASK-04). |
| TASK-GPS-QA-SECURITY-07 | `gps-quality-security` | Not started — correctly blocked (depends on TASK-02/03/04/05/06). |

Wave/dependency ordering is being honored correctly so far: only Wave 0 (research)
and Wave 1's two independent tasks (`02`, `03`) have any activity, and `04`–`07`
are untouched pending their declared dependencies. No collision, no duplicate-worker
violation, no out-of-order dispatch found.

## 4. Independent re-verification of TASK-GPS-MAPPING-03 (the one completed task)

Did not just trust the filed report — reran it from scratch in its own worktree:

- Started `gps-vehicle-mapping`'s own dev server (port 5091, its pre-existing local
  `.env`), ran its two targeted specs, then stopped the server afterward (left no
  extra process running).
- `npx playwright test tests/e2e/gps-driver-correlation.spec.ts
  tests/e2e/gps-vehicle-assignment.spec.ts` → **8/8 passed** (7 new + 1 existing
  regression), matching the filed report exactly, including the ambiguous-overlap
  case being surfaced explicitly rather than silently resolved.
- `npm run check` → clean, zero type errors.
- `git diff --stat` against trunk → exactly the two files the task was allowed to own
  (`server/gps/services/driverDeviceCorrelation.ts`,
  `tests/e2e/gps-driver-correlation.spec.ts`), nothing else touched.

**This task is safe to integrate whenever the Integrator wave runs** — no code
change was needed from this audit.

## 5. Recommendation

1. **No freeze action needed against what's already merged** (phases 1–4) — confirmed
   clean and tested in the original pass above.
2. **Do not dispatch a second worker into TASK-GPS-CONNECTION-02** — it already has
   live, uncommitted work in `gps-provider-connections`; dispatching another would
   create exactly the duplicate-worker collision the freeze directive warns against.
3. **Do not advance TASK-GPS-INGESTION-04 or later tasks yet** — they are correctly
   gated on TASK-02, which isn't done. This is the plan working as designed, not a
   blocker to fix.
4. **The stale "not launched" line in `GPS-TELEMATICS-MANIFEST.md`'s Status section
   should be corrected by whoever owns that file next** (not done here — editing
   another session's in-progress orchestration file mid-flight risks exactly the kind
   of collision this whole exercise is trying to prevent; flagging it here instead).
5. Keep `#4`/`#10`/`#11` verification as a standing checklist for
   `TASK-GPS-QA-SECURITY-07` when it eventually runs — its own acceptance criteria
   already cover them, this audit just confirms nothing has drifted from that intent
   so far.
