# TASK-ROOT-SUPPORT-03 report — backend-worker + frontend-worker

## Status
done

## Files changed (all new, none pre-existing)
- `server/root/models/supportTicket.ts` — `SupportTicket` model, exact §10 field list, exact status lifecycle (`NEW/INVESTIGATING/WAITING_TENANT/WAITING_EXTERNAL_PROVIDER/FIX_IN_PROGRESS/RESOLVED/CLOSED`) + transition map enforced server-side.
- `server/root/models/errorRecord.ts` — `ErrorRecord` model, exact §11 field list + diagnostics-support fields (actionAttempted/stepReached/validationFailure/apiResponseSnapshot/retryCount/lastSuccessfulStep) + `redactedFieldKeys` audit trail.
- `server/root/services/errorCaptureService.ts` — redaction pipeline (`sanitizeErrorPayload`, `sanitizeMessageText`, `buildErrorRecordDocument`, `captureError`) + a **local placeholder** for `RootAccessService.requirePlatformRole` (see "Dependency status" below).
- `server/root/middleware/correlationId.ts` — self-contained correlation-ID middleware. **Not wired into the live app.**
- `server/root/routes/support.ts` — `registerSupportRoutes(app)`: ticket CRUD + lifecycle transitions.
- `server/root/routes/errors.ts` — `registerErrorRoutes(app)`: error list/detail + diagnostics trace reconstruction.
- `client/src/pages/root/support-tickets.tsx` — list/filter/create/transition UI.
- `client/src/pages/root/error-center.tsx` — list/filter/detail UI, links out to Diagnostics.
- `client/src/pages/root/diagnostics.tsx` — correlation-ID lookup + reconstructed trace UI.
- Tests (all new, excluded from `npm run check` by `tsconfig.json`'s `**/*.test.ts`):
  - `server/root/services/errorCaptureService.test.ts`
  - `server/root/middleware/correlationId.test.ts`
  - `server/root/routes/support.test.ts`
  - `server/root/routes/errors.test.ts`
- `.claude/tasks/reports/TASK-ROOT-SUPPORT-03-report.md` (this file)

No file outside this task's ownership list was touched. `server/root/types.ts` and
`server/root/services/rootAccessService.ts` (TASK-ROOT-DOMAIN-01's owned files) were
**not created** — see "Dependency status."

## Dependency status (TASK-ROOT-DOMAIN-01)
`server/root/types.ts` / `server/root/services/rootAccessService.ts` are not present in
this worktree and are on this task's forbidden-to-modify list, so no placeholder file was
created at either of those paths. Instead, a minimal, self-contained stand-in lives inside
this task's own `server/root/services/errorCaptureService.ts`:

```ts
export type PlatformRole =
  | 'PLATFORM_ROOT' | 'PLATFORM_SUPER_ADMIN' | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN' | 'PLATFORM_SECURITY_ADMIN' | 'PLATFORM_READ_ONLY_AUDITOR';

export function requirePlatformRoleLocal(allowed: PlatformRole[]) { /* 403 unless req.user has an allowed platformRole */ }
```

Used by both `routes/support.ts` and `routes/errors.ts`. It reads `platformRole` off
`req.user` defensively (`.get('platformRole')` for a Mongoose-document-shaped user, falling
back to plain dot-access) since the real `User.platformRole` schema field doesn't exist in
this worktree either.

**Integrator action needed once TASK-ROOT-DOMAIN-01 lands:** delete the
`PlatformRole`/`ALL_PLATFORM_ROLES`/`MUTATION_PLATFORM_ROLES`/`requirePlatformRoleLocal`
block from `errorCaptureService.ts` and repoint the two `import { ... } from
'../services/errorCaptureService'` lines in `routes/support.ts` and `routes/errors.ts` at
the real `server/root/services/rootAccessService.ts`'s `requirePlatformRole`. No other
change should be needed — the call signature was written to match the documented contract
exactly.

## Proposed mount points (NOT applied — Integrator-only files)

**1. Correlation-ID middleware** — `server/index.ts`, immediately after the body-parser
middleware and before `registerRoutes(app)` is called, so every route (not just
`/api/root/**`) gets a correlation ID attached before any handler/error path runs:

```ts
import { correlationIdMiddleware } from './root/middleware/correlationId';
// ... after app.use(express.urlencoded(...)):
app.use(correlationIdMiddleware);
```

**2. Route mounts** — `server/routes.ts`, alongside the existing GPS registration block
(`registerGpsConnectionRoutes(app)` etc., ~line 327):

```ts
import { registerSupportRoutes } from './root/routes/support';
import { registerErrorRoutes } from './root/routes/errors';
// ...
registerSupportRoutes(app);
registerErrorRoutes(app);
```

**3. Frontend routes** — `client/src/App.tsx`, alongside the existing `/admin` route:

```tsx
<Route path="/root/support-tickets"><SupportTicketsPage /></Route>
<Route path="/root/error-center"><ErrorCenterPage /></Route>
<Route path="/root/diagnostics"><DiagnosticsPage /></Route>
```

**4. Sidebar nav** — `client/src/components/layout/sidebar.tsx`: three new entries under a
"Root / Platform" section — Support Center (`/root/support-tickets`), Error Center
(`/root/error-center`), Support Diagnostics (`/root/diagnostics`) — gated on the eventual
platform-role check, not shown to tenant-side users.

## Error privacy — exact redaction field list (for security review)

`REDACTED_FIELD_KEY_SUBSTRINGS` in `server/root/services/errorCaptureService.ts`. A field
key is redacted if its normalized form (lowercased, non-alphanumeric characters stripped)
**contains** any of these substrings — so `newPassword`, `x-auth-token`, `Set-Cookie`,
`refresh_token`, `API-Key`, `connect.sid`, etc. are all caught without an exhaustive
exact-name list:

```
password, pwd, passwd, otp, token, secret, apikey, cookie, connectsid,
authorization, sessionid, cardnumber, cvv, cvc, ssn
```

This is applied recursively (depth-limited to 8) to every structured value passed into
error capture (`clientContext`, `relatedEntities`, `apiResponseSnapshot`), replacing the
value with `[REDACTED]` and recording the stripped key name in `redactedFieldKeys` on the
stored `ErrorRecord` (an audit trail proving redaction actually fired, not just a claim).

**Defense-in-depth for free text** (`sanitizedMessage`/`sanitizedStack`, and any string
value nested inside the structured payload): four regex passes in
`sanitizeMessageText` additionally strip secrets that leaked into a message string rather
than a structured field —
1. `Bearer <token>` → `Bearer [REDACTED]`
2. `password=`/`token=`/`otp=`/`secret=`/`apiKey=`/`authorization=`/`cookie=` key=value pairs embedded in text
3. `connect.sid=<value>` (Express's default session cookie name) even without a "cookie" keyword nearby
4. JWT-shaped strings, anchored on the `eyJ` base64 prefix of a real JWT header (deliberately **not** a generic "three dot-separated segments" pattern — that would also match ordinary stack-trace file paths like `server.routes.ts`, which was caught and fixed during testing)

`cardnumber`/`cvv`/`cvc`/`ssn` are extra defense-in-depth beyond the task's explicit
requirement (password/OTP/token/cookie/authorization) — this app has no card-payment
integration today, but the redaction is cheap insurance if one is ever added. A generic
`pin` substring was deliberately **excluded** to avoid false-positive-redacting India-postal
`pincode` fields that are common elsewhere in this codebase.

Every document in `ErrorRecord` is written only via `buildErrorRecordDocument`/
`captureError` — the model file's own header comment says never to call
`ErrorRecord.create()` directly with unsanitized input.

## API surface changed (new, additive — none of it mounted by this task)
- `GET /api/root/support/tickets` — list/filter by `tenantId`/`status`/`severity`/`module`, paginated.
- `POST /api/root/support/tickets` — create.
- `PATCH /api/root/support/tickets/:id` — status transition (validated against the exact lifecycle map) / reassignment / severity change.
- `GET /api/root/errors` — list/filter by `tenantId`/`source`/`correlationId`, paginated.
- `GET /api/root/errors/:id` — detail.
- `GET /api/root/diagnostics/:correlationId` — reconstructed trace from every `ErrorRecord` sharing that correlation ID.

All six require `authenticateUser` + `requirePlatformRoleLocal`; GET routes accept any
platform role (including `PLATFORM_READ_ONLY_AUDITOR`), mutating routes exclude the
read-only auditor.

## Database impact
Two new collections only, `SupportTicket` and `ErrorRecord`. Indexes (all justified in the
model files' own comments):
- `SupportTicket`: `{tenantId,status}`, `{tenantId,severity}`, `{tenantId,createdAt:-1}` (Tenant 360's Support tab convention), plus non-tenant-first `{status,severity,createdAt:-1}` and sparse `{correlationId:1}` for the Root-wide Support Center list view.
- `ErrorRecord`: `{tenantId,createdAt:-1}`, `{tenantId,source,createdAt:-1}`, plus non-tenant-first `{createdAt:-1}` and `{correlationId:1}` — the diagnostics trace lookup is deliberately **not** tenant-filtered (reconstructing one specific failed request must not silently drop cross-tenant context).

## Tests run

```
npx tsc --noEmit
→ clean, 0 errors

npx tsx --test server/root/services/errorCaptureService.test.ts \
  server/root/middleware/correlationId.test.ts \
  server/root/routes/support.test.ts \
  server/root/routes/errors.test.ts
→ tests 32, pass 32, fail 0
```

Coverage per acceptance criterion:
- **Ticket lifecycle**: `support.test.ts` walks the exact `NEW → INVESTIGATING →
  WAITING_TENANT → INVESTIGATING → FIX_IN_PROGRESS → RESOLVED → CLOSED` path over real
  HTTP against a live route + real MongoDB, and separately proves an invalid jump
  (`NEW → RESOLVED`) is rejected with 422 and the allowed-next list.
- **Redaction bad case**: `errorCaptureService.test.ts` feeds a payload with
  nested `password`/`otp`/`token`/`cookie`/`secret` values and asserts none of the raw
  secret *values* survive anywhere in the serialized output (not just that redaction
  claims to have run) — happy-path fields are separately asserted to survive unchanged.
  `errors.test.ts` repeats this over the real HTTP read path (`GET /api/root/errors/:id`).
- **Correlation-ID middleware**: `correlationId.test.ts` — unit-tested in isolation (mock
  req/res, no live server), per the task's own acceptance-criteria wording: two requests
  with no header get distinct IDs; a client-supplied valid ID is echoed back exactly;
  an unsafe/oversized client-supplied ID is rejected and replaced.
- **Diagnostics reconstruction**: `errors.test.ts` captures two `ErrorRecord`s sharing one
  correlation ID (simulating a two-step failed workflow) and asserts the reconstructed
  trace's tenant/user/module/step/validation-failure/API-response/retry-count/
  last-successful-step fields and chronological event ordering — proven live over HTTP.
- **Tenant-scoped 403**: both `support.test.ts` and `errors.test.ts` create a **real**
  `Tenant` + `User` (`role: 'client'`, no `platformRole`) via the actual `User`/`Tenant`
  models, authenticate through the real `authenticateUser` middleware (not a mock), and
  confirm every `/api/root/**` route in this task returns 403 for that session.

Test infrastructure notes: `node_modules` was installed locally via `npm ci` (worktree had
none checked out) — gitignored, not committed. Tests connect directly to the local MongoDB
already running on `localhost:27017` (confirmed via `lsof -iTCP:27017 -sTCP:LISTEN` before
using it, per the parallel-dispatch process-safety rule), using dedicated database names
(`fleetpro_root_support_test_support`, `fleetpro_root_support_test_errors`) that don't
collide with any other worktree's dev database, and drop those databases in an `after()`
hook plus a final manual sweep. No dev server (`npm run dev`) was started, so no port
bind/PID cleanup was needed.

## Deviations from scope
- `server/root/types.ts` / `server/root/services/rootAccessService.ts` were not created,
  even as placeholders — the manifest's suggested fallback conflicts with this task's own
  explicit "Files forbidden to modify" list, which names those two exact paths. Resolved by
  keeping the placeholder self-contained inside this task's own
  `errorCaptureService.ts` instead (see "Dependency status" above). Flagging this
  explicitly in case the Integrator expected the placeholder at the manifest's suggested
  path.
- Diagnostics route (`GET /api/root/diagnostics/:correlationId`) was placed in
  `routes/errors.ts` rather than a separate file — it wasn't listed as its own file in
  "Files exclusively owned by this task," and it reads exclusively from `ErrorRecord`
  (owned by this task's `errors.ts`), so no new file/ownership question arises.

## Notes for Integrator
- Apply the three proposed mount points above (correlation-ID middleware in
  `server/index.ts`, two route registrations in `server/routes.ts`, three `<Route>`s in
  `client/src/App.tsx`) plus the sidebar nav entries once ready.
- Once `TASK-ROOT-DOMAIN-01` merges, delete the local `PlatformRole`/
  `requirePlatformRoleLocal` placeholder block from `errorCaptureService.ts` and repoint
  both route files at the real `RootAccessService`.
- `SupportTicket.correlationId` and the create-ticket form's optional correlation-ID field
  are the intended link between a tenant's support ticket and its Error Center /
  Diagnostics trace, if the ticket originated from a captured error — not automated yet
  (no route auto-links them), a reasonable Wave 2 addition once real usage patterns are
  known.
- Tenant Health Score and Support Debug Bundle (both explicitly out of scope per the gap
  matrix's sequencing) can now build on this task's `SupportTicket`/`ErrorRecord` models
  once dispatched.
