# AUDIT-AUTH-SECURITY — Tenant Isolation / RBAC / Security Findings

Audit date: 2026-08-07. Lane: AUDIT-AUTH-SECURITY, one lane of the FleetPro Supreme
Audit Campaign. Read-only: no code edits, no destructive DB writes. Repo read:
`/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main`, branch `booking/integration-preview`,
commit `89a04547` at time of audit (this is *newer* than the `20bd273` commit that
`docs/master-closure/findings-security-testinfra.md` audited — re-verify before assuming
identical state on a future pass). Live preview `http://127.0.0.1:5100/`, worktree
`manual-test-preview`, branch `preview/manual-test-reconciled` — confirmed up (HTTP 200)
and used for a small number of safe, read-only black-box GET/POST probes (health check,
unauthenticated-401 checks, a deliberately-wrong-credentials login attempt, CSRF token
fetch). No login was attempted with the shared `qaclient` credential per this campaign's
own warning that it came back broken/401 in another lane today — this lane did not need
an authenticated session to get useful evidence, since the highest-value checks here are
either unauthenticated-boundary checks or white-box source reads.

**This is not a from-scratch audit.** Two prior documents already cover a large, directly
overlapping scope in real depth: `docs/master-closure/findings-security-testinfra.md`
(tenant isolation across 91 direct `findOne`/`findById` call sites, RBAC role-model gap,
shared-test-DB risk) and `docs/master-closure/findings-telephony-whatsapp.md` (telephony/
WhatsApp specifically). Both are dated the same day as this audit and were read in full.
Where this lane's own independent re-derivation agrees with those documents, that is
stated explicitly with fresh citations (re-run against the current commit, not just
trusted secondhand) rather than silently repeated. Where this lane found something new,
it's a genuinely new finding, not a restatement.

## What was actually covered (white-box)

- `server/middleware/auth.ts`, `server/middleware/permissions.ts`, `server/middleware/security.ts`,
  `server/middleware/driverAuth.ts` — read in full.
- `server/routes.ts` (7,098 lines) — read the top ~300 lines in full (session/CSRF/security
  middleware wiring, `scopeTenant` helper), then targeted greps + full reads of every
  Booking/Customer/Vehicle/Driver/Invoice/Payment/Reward/Referral/Vendor/Admin route
  touched by the sampling below (roughly 60 route handlers actually read end-to-end, not
  just grepped).
- `server/gps/**` — connections, devices, assignments, billing, webhook ingestion,
  credential encryption, SSRF guard (Traccar) all read.
- `server/driver/domain/access.ts`, `server/driver/documents/**` (routes, file serving,
  credential encryption) read.
- `server/vehicle/fastag/**` (credential-bearing module, same shape as GPS) read.
- `server/storage-mongodb.ts` — targeted reads of every tenant-scoping helper
  (`updateVehicle`, `deleteVehicle`, `getBooking`/`updateBooking`/`deleteBooking`,
  `deactivateSubUser`/`reactivateSubUser`/`updateSubUserPermissions`, `checkUserPermission`,
  `getUserByCredentials`).
- `server/services/rewardService.ts`, `server/services/referralService.ts`,
  `server/services/paymentLedger.ts`, `server/services/customerService.ts`,
  `server/services/customerMergeService.ts`, `server/services/segmentService.ts`,
  `server/services/campaignService.ts`, `server/services/availability.ts` — grepped for
  every DB query missing an inline `tenantId`, then each candidate individually read in
  full context to rule out false positives (multi-line queries where `tenantId` was on a
  later line than the grep match).
- Session/cookie config (`server/routes.ts:255-304`) and `server/index.ts` (raw-body
  capture for webhook signature verification, `express.json`).
- `server/admin-recovery.ts`, `server/recovery-script.ts` (emergency admin path) read for
  credential-logging risk.

## What was explicitly NOT covered / could not be covered

- **`server/telephony/**` does not exist in the `fleetpro-main` tree this lane was told
  to read from** (`find server -type d -iname "*telephony*"` returns nothing under
  `server/`; only `.git/worktrees/fleetpro-telephony-rbac` and
  `.git/worktrees/telephony-fix-landing` directory *names* exist, i.e. other worktrees on
  disk, not code in this tree). This lane therefore could not independently white-box
  audit telephony's tenant isolation/RBAC internals from source in this repo. It **is**
  covered in depth by `docs/master-closure/findings-telephony-whatsapp.md` and
  `findings-security-testinfra.md` (SEC-011), which this lane read and is relying on as
  secondhand-but-substantive evidence (not upgraded to this lane's own VERIFIED_CODE).
  See SEC-004 below for a black-box wrinkle this lane found on top of that.
- No authenticated black-box testing was performed — no login was attempted (shared
  `qaclient` reported broken elsewhere today; this lane had no other credential and did
  not attempt to create one, per the read-only/no-speculative-writes constraint). All
  black-box evidence in this report is either unauthenticated-boundary checks (expect
  401) or a deliberately-failing login (to observe cookie/rate-limit headers only).
  **No cross-tenant live exploitation attempt was made or is claimed anywhere in this
  report.**
- Frontend (`client/src/**`) permission-mirroring was not audited — out of scope as
  specified (server-side focus).
- Full 7,098-line `server/routes.ts` was not read line-by-line; coverage is targeted
  (every resource type named in the brief, sampled across GET/POST/PUT/PATCH/DELETE,
  plus every anomaly a grep sweep surfaced). A residual chance of an un-sampled route
  with a scoping bug cannot be ruled out to 100% — see Confidence section.
- GPS ingestion/telemetry-store internals (`server/gps/telemetry/**`, `ingestion/deadLetter.ts`,
  `retry.ts`, `syncHealth.ts`) were located and their call sites checked for tenant
  parameters, but not read line-by-line.
- No load/concurrency/race-condition testing (e.g. two simultaneous requests racing a
  tenant-scoping check) was performed.

## Summary

- **P0 confirmed: 0.** No client-controlled tenant-crossing read/write was found reachable
  from any route this lane actually read.
- **P1 confirmed: 0.**
- **P2: 0.**
- **P3 / hygiene: 3** (SEC-001, SEC-002, SEC-003 below) — real, reproducible, but none is a
  live exploitable leak under the codebase's current call sites.
- **INSUFFICIENT_EVIDENCE (not a defect, a coverage gap): 1** (SEC-004 — telephony, source
  absent from the tree this lane was pointed to).
- Overall confidence in tenant-isolation safety for the code this lane actually read:
  **HIGH**. The `scopeTenant(req)` / `tenantContext(req,res)` pattern is applied with
  unusual consistency — every single-record `findOne`/`findById`/`updateOne`/`deleteOne`
  this lane sampled across Booking, Customer, Driver, Vehicle, Invoice, Payment, GPS
  connection/device/assignment, driver documents, and vendor resources includes a
  `tenantId` filter sourced from `req.tenantId` (never from `req.body.tenantId` or
  `req.query.tenantId` — grepped for both across all of `server/`, zero hits). This
  independently reconfirms `findings-security-testinfra.md`'s SEC-001–SEC-007/SEC-012
  conclusions at a newer commit, not just repeats them.

## Defect table

| ID | Severity | Module | Scenario | Problem | Reproducible | Evidence | Root Cause | Real-World Impact | Minimal Fix | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | **P3** | Rewards/Referrals ledger (`server/services/rewardService.ts`) | Any reward/referral credit that goes through `createTransaction()`'s idempotency check | `RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey })` (3 call sites: lines 43, 61, 104, plus a 4th at line 143/153 in the non-transactional fallback path) queries **only** by `idempotencyKey`, with no `tenantId` filter in the same query — unlike the structurally identical idempotency check in `server/services/paymentLedger.ts:62-65` (`PaymentTransaction.findOne({ tenantId: input.tenantId, idempotencyKey: input.idempotencyKey })`), which does include it. | Yes, by static read — not exploited live (would require a code change to actually trigger, see Root Cause) | `server/services/rewardService.ts:43-44,61,104,143,153` vs. `server/services/paymentLedger.ts:62-65,90-93` (the safe sibling pattern, in the same codebase, for direct comparison) | Every current caller of `createTransaction`/`creditReferralEventReward` constructs `idempotencyKey` **server-side**, always prefixed `${tenantId}_...` (confirmed at all 6 call sites: `server/services/rewardService.ts:203,214,255,279,305,359` and `server/services/referralService.ts:154,195`) — never client-supplied. So today, a global (non-tenant-scoped) lookup on a value that already embeds the tenantId as a prefix cannot practically collide across tenants. But the query itself provides **no defense-in-depth**: it relies entirely on every present-and-future caller remembering to embed `tenantId` in the key by convention, with nothing in `createTransaction`'s own signature or the DB query enforcing it. | None today (not exploitable under current call sites). If a future caller ever passes a raw/non-namespaced idempotencyKey (e.g. a client-supplied one, as `POST /api/bookings/:id/payments` already accepts for `PaymentTransaction` at `server/routes.ts:2965` — that path is safe only because *its* query does include `tenantId`), the reward ledger could return/short-circuit on another tenant's transaction. | Add `tenantId: input.tenantId` to all 4 `RewardTransaction.findOne({ idempotencyKey })` queries in `rewardService.ts`, matching the `paymentLedger.ts` pattern already used elsewhere in the same codebase. | `INSUFFICIENT_EVIDENCE`-for-exploitability, `CONFIRMED`-for-pattern-inconsistency. Not fixed (audit-only). |
| SEC-002 | **P3 (test-hygiene, not app code)** | Driver Portal auth boundary / regression test (`tests/e2e/driver-qa-foundations.spec.ts`) | A new `authenticateDriver`-mounted route was added since the allow-list test was last updated | `server/routes.ts:733` mounts `app.post("/api/driver-portal/handovers/:id/accept", authenticateDriver, acceptHandoverHandler)` — a 5th route using the driver-portal session middleware. The test's hardcoded `DRIVER_PORTAL_ALLOWLIST` (`tests/e2e/driver-qa-foundations.spec.ts:169-174`) lists only 4 routes and does not include it. | **Yes — reproduced this session** by re-implementing the test's own documented extraction method (regex `app\.(get\|post\|put\|patch\|delete)\(\s*"([^"]+)"` + a 6-line window checked for `authenticateDriver`, exactly as coded at `tests/e2e/driver-qa-foundations.spec.ts:182-194`) against the live `server/routes.ts` in a throwaway Node script (not by running Playwright itself, to avoid touching shared infra) — confirmed the extraction finds 5 routes, the allow-list has 4, and the missing one is `POST /api/driver-portal/handovers/:id/accept`. | `server/routes.ts:733`; allow-list at `tests/e2e/driver-qa-foundations.spec.ts:169-174`; the code comment at `server/driver/handover/driverPortalRoutes.ts:1-16` explicitly anticipated this exact coordination requirement ("registering this single ... route ... keeps it visible to that grep ... rather than hiding it") but the allow-list itself was apparently never actually updated to match. | The route being un-audited by this specific test is itself low-impact *because the route is correctly tenant/driver-scoped in its own implementation* (`server/driver/handover/driverPortalRoutes.ts:23-33`: `tenantId: String(req.driver.tenantId)`, `driverId: req.driverId!` both passed to `acceptHandoverAsDriver`) — this is a gap in the **safety net**, not a live vulnerability. But the whole point of this allow-list test is to catch exactly this class of drift automatically; right now it would not, because it's already drifted and (per this lane's reproduction) would currently fail its own `toEqual` assertion if run. | Add `{ method: 'POST', path: '/api/driver-portal/handovers/:id/accept' }` to `DRIVER_PORTAL_ALLOWLIST` in `tests/e2e/driver-qa-foundations.spec.ts:169-174`. | `CONFIRMED` via reproduced static analysis. Not fixed (audit-only; also this lane does not touch test files per its own read-only mandate). |
| SEC-003 | **P3 (RBAC hygiene)** | Permissions model (`server/middleware/permissions.ts`) vs. actual route enforcement | Several `PERMISSIONS` constants are either dead (defined, never wired to `requirePermission` anywhere) or inconsistently enforced vs. an equivalent-sensitivity sibling route | `PERMISSIONS.REWARD_ADJUST` (`permissions.ts:116`) is never passed to `requirePermission` anywhere in `server/` — `POST /api/customers/:id/rewards/adjust` (`server/routes.ts:5783-5807`, a money-adjusting endpoint) instead uses an inline `req.user.role !== 'admin' && req.user.role !== 'client'` check. `PERMISSIONS.MANAGE_USERS` (`permissions.ts:54`) is likewise never wired — sub-user management routes (`server/routes.ts:1535-1690`) all use the same inline role-check pattern instead. `PERMISSIONS.GPS_REPORT_EXPORT` (`permissions.ts:109`) has zero usages anywhere. Separately, `PERMISSIONS.REWARD_RULE_MANAGE` gates `PUT /api/reward-event-rules/:eventKey` (`routes.ts:5857`) but its equivalent-sensitivity sibling `PUT /api/reward-rules` (`routes.ts:5822`) uses the same inline-role-check pattern instead of the same permission constant, for what is functionally the same class of action (reward-rule configuration). | Yes — static grep + read, fully reproducible (`grep -rn "REWARD_ADJUST\|MANAGE_USERS\|GPS_REPORT_EXPORT" server/` shows the constants defined once in `permissions.ts` and, for the first two, never passed to `requirePermission`; zero hits at all for `GPS_REPORT_EXPORT` outside its own definition). | `server/middleware/permissions.ts:54,109,116`; enforcement sites `server/routes.ts:5783-5807` (inline check), `1535-1690` (inline checks throughout), `5822-5842` vs `5849-5865` (inconsistent pair) | Today this is **not a privilege-escalation gap** — the inline `role === 'admin' \|\| role === 'client'` checks are at least as strict as the dead permission constants would have been (no `manager`-role sub-user can be granted `REWARD_ADJUST`/`MANAGE_USERS` today regardless, since nothing checks for it). The risk is forward-looking: if a future change ever tries to grant one of these permissions to a non-admin/client user via the existing `MANAGER_ASSIGNABLE_PERMISSIONS` mechanism (`routes.ts:1690-1704`), it would silently do nothing, because the route it's meant to gate doesn't check it. | Either wire `requirePermission(PERMISSIONS.REWARD_ADJUST)` / `MANAGE_USERS` into their intended routes (replacing or supplementing the inline checks), or remove the dead constants to stop implying a capability that doesn't exist. Align `PUT /api/reward-rules` to use `requirePermission(PERMISSIONS.REWARD_RULE_MANAGE)` the same way its sibling does. | `CONFIRMED` (pattern), not a live leak. Not fixed (audit-only). Overlaps/extends `findings-security-testinfra.md`'s SEC-014, which independently found `GPS_REPORT_EXPORT` dead — this lane reconfirms that at the current commit and adds `REWARD_ADJUST`/`MANAGE_USERS`/the `REWARD_RULE_MANAGE` inconsistency as new instances of the same pattern. |
| SEC-004 | **INSUFFICIENT_EVIDENCE** (coverage gap, not a defect verdict) | Telephony (`server/telephony/**`) | Auditing telephony's tenant isolation/RBAC from source, as the campaign brief requested | `server/telephony/**` does not exist anywhere in `/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main` (confirmed: `find server -iname "*telephony*"` returns nothing under `server/`). This lane cannot cite file:line evidence for code it cannot read in the repo it was pointed to. | N/A — this is a scope/coverage note, not a reproducible defect | Black-box: `curl http://127.0.0.1:5100/api/telephony/calls` (the live canonical preview, **not** the `fleetpro-main` source tree) returned `401 {"message":"Authentication required"}` this session — a real, registered-route response, not the Vite SPA-fallback HTML a bogus path returns (confirmed by diffing against `curl .../api/totally-bogus-route-xyz`, which returned SPA `index.html`). This means telephony routes **are** mounted and reachable on whatever commit is actually running behind port 5100 right now, even though that code is absent from the `fleetpro-main` tree this lane was told to read source from. | Per `docs/master-closure/findings-telephony-whatsapp.md`'s own ancestry table (read this session), the live-preview worktree/branch (`preview/manual-test-reconciled`) is a distinct, diverged lineage from the `fleetpro-main`/`booking/integration-preview` tree that contains the telephony module with its dedupe fix — while `booking/integration-preview` (this lane's assigned source repo) does not contain `server/telephony` at all. Two different things share a name ("the codebase") but are different trees. | A reader of only this document could wrongly conclude telephony is entirely unaudited/unmounted anywhere — it is mounted and responding on the live preview, just not present in the source tree this lane was assigned to read. | N/A (not a defect) | For telephony's actual RBAC/tenant-isolation source-level verdict, defer to `docs/master-closure/findings-telephony-whatsapp.md` and `findings-security-testinfra.md`'s SEC-011 (both `VERIFIED_CODE` against the `fleetpro-telephony-rbac`/`telephony-fix-landing` worktrees, not `fleetpro-main`) — this lane's own black-box 401 check is corroborating-but-thin additional evidence that *some* commit of that code is live on the canonical preview right now, which those two documents did not have (they checked `runtime/stable-demo`, port 5051, not port 5100). |

## Positive findings (evidence-backed, not just asserted)

Per the campaign's evidence standard, these are stated with the same citation discipline
as the defects above — confidence label attached, not a bare "PASS".

- **Tenant scoping helper is applied with high consistency (HIGH confidence, white-box +
  partial black-box).** `scopeTenant(req)` (`server/routes.ts:165-166`) returns `undefined`
  only for `role === 'admin'`, `req.tenantId` for everyone else; every `findOne`/`findById`
  keyed on `req.params.id` this lane sampled across Booking (`routes.ts:2259,6196,6283,6515`),
  Customer (`3080,3098,3142,...,5795` — 15+ sites), Invoice (`5049`), Vendor (`5445` and 10
  more), Driver (`747`), DriverLeave (`6893,6928`), Expense (`7041,7056`) includes
  `tenantId: req.tenantId` in the same query. GPS uses an equivalent, arguably *stricter*
  `tenantContext(req,res)` guard (`server/gps/routes/connections.ts:70-79`) that hard-403s
  if `req.tenantId` is missing, rather than falling back to admin-sees-everything. No
  route anywhere in `server/` was found to read `req.body.tenantId` or `req.query.tenantId`
  (`grep -rn "req\.body\.tenantId\|req\.query\.tenantId" server/` — zero hits) — the classic
  client-supplied-tenant IDOR class of bug was not found anywhere this lane looked.
  `storage.updateVehicle` (`server/storage-mongodb.ts:462-479`) additionally *deletes*
  `data.tenantId` from the update payload when a `tenantId` scope is passed, with an explicit
  comment ("Never allow a request body to move a record to a different tenant") — a
  specific, deliberate defense against a tenant-reassignment attack via a PUT body.
- **No privilege-escalation path via a client-controlled `role` field (HIGH confidence,
  white-box).** There is no public self-registration endpoint (`grep` for `/api/auth/register`
  or `/signup` in `server/routes.ts`: zero hits). The only routes that ever write
  `User.role` are `POST/PUT /api/admin/users*` (`routes.ts:1278-1315`), gated by
  `requireAdmin`, and sub-user creation (`routes.ts:1535-1576`), which hardcodes
  `role: 'manager'` server-side, never taking `role` from `req.body`. `requireAdmin`
  (`server/middleware/auth.ts:74-96`) and `checkUserPermission`'s admin/client bypass
  (`server/storage-mongodb.ts:1255-1258`) are the **single** mechanism found — this lane
  looked specifically for the "two coexisting superuser mechanisms" risk the campaign
  brief called out (a legacy `role==='admin'` bypass *and* a separate Platform-RBAC path)
  and found no second mechanism: no `/api/root/*` or `/api/platform/*` routes exist
  (`grep` returns nothing), no `platformRole`/`isPlatformAdmin`/`superuser` fields exist
  anywhere in `server/` (`grep -rn "platformRole\|isPlatformAdmin\|isRoot\|superuser" server/`
  — zero hits). Only `/api/admin/*`, uniformly `requireAdmin`-gated. This is a genuine,
  reassuring finding worth stating plainly rather than treating the brief's hypothesized
  risk as confirmed by default: **in this repo, at this commit, there is one superuser
  mechanism, not two.**
- **A previously-fixed cross-tenant IDOR is documented in-place (HIGH confidence,
  white-box).** `server/storage-mongodb.ts:1180-1184`'s comment on `deactivateSubUser`
  states a prior version was scoped only by `userId` with no tenant check, letting any
  admin/client deactivate a manager in a *different* tenant by guessing their userId — now
  fixed (`tenantId` included in the query when passed). This lane independently re-read
  the current code and confirms the fix is in place and the same pattern is applied to
  the sibling `reactivateSubUser`/`updateSubUserPermissions` (`storage-mongodb.ts:1206-1226`).
  Cited here as evidence the codebase has previously found and fixed exactly this class of
  bug, not as a currently-open item.
- **Session/cookie/CSRF hardening (HIGH confidence, white-box + black-box).**
  `server/routes.ts:255-304`: `SESSION_SECRET` is required at startup (min 32 chars, else
  `process.exit(1)`) and `MONGODB_URI` is required for a `connect-mongo`-backed session
  store (`MongoStore.create(...)`, `crypto: { secret: sessionSecret }` — session payload
  encrypted at rest) — **no MemoryStore-in-production risk found**; the code comment at
  `routes.ts:265-268` documents this was a deliberate P0 fix. Cookie: `httpOnly: true`,
  `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`. CSRF: double-submit token
  (`server/middleware/security.ts:18-67`), session-stored, header-compared, with a
  documented P0 bug fix for a prior false-403-on-relogin bug. **Black-box confirmation**:
  `curl -i -X POST http://127.0.0.1:5100/api/auth/login` (deliberately wrong credentials)
  returned `Set-Cookie: fleetpro.sid=...; HttpOnly; SameSite=Lax` (no `Secure` — expected,
  since this is a local plain-HTTP dev preview, matching the `NODE_ENV==='production'`
  conditional exactly) and `RateLimit-Limit: 5` / `RateLimit-Remaining: 4` headers, i.e.
  `loginRateLimit` is live and enforcing 5-per-window, not just present in source but
  inert. `GET /api/csrf-token` returned a real 64-hex-char token. Login with a nonexistent
  userId returned the generic `{"message":"Invalid credentials"}` (`routes.ts:449-451`) —
  no username-enumeration message difference observed for that one probe.
- **Credential encryption is applied consistently at every credential-write site found
  (HIGH confidence, white-box).** AES-256-GCM (`server/gps/security/credentialEncryption.ts`,
  `server/vehicle/fastag/security/credentialEncryption.ts` — same algorithm, AAD bound to
  `tenantId:connectionId` preventing ciphertext reuse across tenants/connections) is the
  only path that writes `encryptedSecrets`/`encryptedCredentials` fields anywhere in
  `server/` — grepped every assignment site (`gps/routes/connections.ts:135,196`,
  `vehicle/fastag/routes.ts:28`, `driver/documents/routes/connectionRoutes.ts:80,132`) and
  each one calls the corresponding `encrypt*Credentials` function; none writes a raw
  credential string. All three models declare the field `select: false`
  (`gps/models/gpsConnection.ts:48`, `vehicle/fastag/models/fastagConnection.ts:32`,
  `driver/documents/models/tenantGoogleDriveConnection.ts:47`), so a normal `find`/`findOne`
  never returns it even accidentally. No `console.log`/`console.error` anywhere in
  `server/` was found logging a password/token/secret/credential in plaintext (`grep`
  swept every credential-shaped console call; the one near-miss,
  `storage-mongodb.ts:337,1148`, explicitly redacts with `password: '[HIDDEN]'`).
- **SSRF guard on tenant-supplied GPS provider URLs (HIGH confidence, white-box).**
  `server/gps/providers/adapters/traccar/traccarSsrfGuard.ts` blocks literal and
  DNS-resolved private/loopback/link-local/cloud-metadata IPs before every outbound
  Traccar API call (`traccarClient.ts:154,232`), with an honestly self-documented residual
  gap (no IP-pinning against DNS-rebinding TOCTOU) rather than a false completeness claim.
- **Driver-portal auth is structurally separate from staff auth (HIGH confidence,
  white-box).** `authenticateDriver` (`server/middleware/driverAuth.ts`) keys off a
  different session field (`req.session.driverSessionId`) than `authenticateUser`
  (`req.session.userId`), looks up a different collection (`Driver`, not `User`), and per
  the code's own comment "no route checks BOTH ... and no route meant for staff uses this
  middleware" — independently confirmed by this lane's grep: exactly 5 routes use
  `authenticateDriver` (see SEC-002 — one more than the stale test's allow-list expects,
  but all 5 are genuinely driver-portal-only, none overlaps a staff route). The one new
  (5th) route, `POST /api/driver-portal/handovers/:id/accept`, is itself correctly
  tenant/driver-scoped despite the allow-list drift (see SEC-002's Real-World Impact
  column).
- **Global input-hardening middleware is actually wired, not just defined (HIGH
  confidence, white-box).** `app.use(httpsRedirect)`, `securityHeaders` (Helmet, CSP in
  production), `ipBlockingMiddleware`, `sanitizeInput`, `databaseSecurityMiddleware`
  (blocks `$`-prefixed keys / Mongo operator strings in request bodies/queries) are all
  applied globally at `server/routes.ts:245-249`, confirmed by direct read (not just
  defined-but-unused in `security.ts`).

## Confidence assessment

- **Tenant isolation for the modules this lane actually read (Booking, Customer, Driver,
  Vehicle, Invoice, Payment, GPS connection/device/assignment, driver documents, vendor):
  HIGH.** Consistent `tenantId`-from-session scoping, zero client-supplied-tenantId reads
  found, a documented prior fix for exactly this bug class, and independent corroboration
  from `findings-security-testinfra.md`'s separately-conducted 91-call-site sweep against
  a slightly older commit reaching the same conclusion via a different method.
- **RBAC consistency: MEDIUM-HIGH.** Core permission gating (`requirePermission` +
  `PERMISSIONS` enum) is real and enforced on the routes it's wired to, but SEC-003 shows
  the enum and enforcement have drifted apart in a few spots — not exploitable today, but
  a real maintenance/trust gap in the permission system's own self-consistency.
- **Telephony: INSUFFICIENT_EVIDENCE from this lane directly** — source absent from the
  assigned repo; deferring to the two prior documents' `VERIFIED_CODE` (not
  `VERIFIED_RUNTIME`) verdicts, with one new black-box data point (live 401s on port 5100)
  suggesting *some* version of it is genuinely live on the canonical preview right now.
- **Root/Platform control plane risk the brief specifically asked about ("two permanent
  superuser mechanisms"): the risk as described does NOT appear to exist in this repo at
  this commit** — HIGH confidence there is exactly one (`role==='admin'`), not two. This
  should be re-checked if/when the telephony or other diverged lineages are ever merged
  into this tree, since this lane could not inspect those lineages' own admin/RBAC code.
- **No P0/P1 tenant-isolation or auth defect was found or is being claimed anywhere in
  this document.** This is a genuinely well-defended area of the codebase relative to what
  this lane was able to sample; the honest caveat is sampling, not depth — a small residual
  chance of an un-sampled route in the ~7,000 lines of `routes.ts` this lane did not read
  character-for-character cannot be fully ruled out.
