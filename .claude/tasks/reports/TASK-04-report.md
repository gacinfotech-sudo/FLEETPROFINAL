# TASK-04 — Cross-cutting QA report

**Status:** done

## Files changed

- `tests/e2e/isolation-rbac-tenant.spec.ts` (new, 11 tests)
- `tests/e2e/cross-device-viewport.spec.ts` (new, 6 tests)
- `tests/e2e/concurrent-session-executives.spec.ts` (new, 3 tests)
- `.claude/tasks/reports/TASK-04-report.md` (this file)

No application code was touched — this task is test-only, per scope.

`.env` was created locally in this worktree to run the dev server for
verification (MongoDB URI, session secret, port 5077, `HOST=127.0.0.1`).
It is git-ignored (`.gitignore` already excludes `.env`) and was not
committed. `node_modules` was also installed locally via `npm ci` (the
worktree had none checked out) — also git-ignored, not committed.

## Test results

All 20 new tests pass, run together in one invocation against a live dev
server + local MongoDB:

```
npx playwright test tests/e2e/isolation-rbac-tenant.spec.ts \
  tests/e2e/cross-device-viewport.spec.ts \
  tests/e2e/concurrent-session-executives.spec.ts

20 passed (43.8s)
```

Breakdown:
- `isolation-rbac-tenant.spec.ts` — 11/11 passed. Executive-own-calls
  scoping, cross-executive PATCH blocking, owner tenant-wide view +
  `?userId=` filtering, cross-tenant call-id unreachability (even for the
  owning tenant's owner), note attribution surviving a second author,
  reassignment history, duplicate-webhook de-dupe (sequential).
- `cross-device-viewport.spec.ts` — 6/6 passed. 9-viewport
  scrollWidth/clientWidth overflow check on Dashboard (owner view),
  booking wizard, Customer 360 detail dialog (including dialog
  bounding-box-in-viewport at every width, not just document overflow),
  Inquiries, Leads, and Dashboard (manager/executive-role view).
- `concurrent-session-executives.spec.ts` — 3/3 passed. Two independent
  `browser.newContext()` sessions creating calls at the same instant (no
  cross-attribution, no data crossover), concurrent notes from two
  sessions on the same call session both landing (no lost update), and a
  true-concurrency (`Promise.all`-ed, not sequential) duplicate inbound
  webhook delivery still resolving to exactly one `CallSession` record.

## Bugs found (not fixed)

None. Every scenario exercised — including the two adversarial
concurrency cases below — passed against the current code:

- The cross-executive PATCH block (`isolation-rbac-tenant.spec.ts`,
  "Executive B cannot PATCH Executive A's call") returns **404**, not
  403. This is intentional per `server/telephony/routes/calls.ts:157-158`
  and its own comment: `getCallSessionForActor()` returns `null` for a
  manager reading another executive's call, so the route can never leak
  "exists but forbidden" vs. "doesn't exist" as two different signals.
  Documented as a deviation below rather than a bug, since it's the
  existing, deliberate contract (also what TASK-02's own
  `telephony-isolation.spec.ts` already asserts).
- `resolveInboundEvent()` (`server/telephony/services/callService.ts`)
  uses a check-then-act pattern (read for an existing `providerCallId`,
  then create if absent) that is *not* atomic at the application level —
  only the DB's unique partial index on `(tenantId, providerCallId)`
  backstops it. A truly concurrent duplicate delivery could in principle
  race between the two requests' read and write. The test written for
  this (`concurrent-session-executives.spec.ts`, "Duplicate inbound
  webhook events delivered at the exact same instant") passed in this
  run — Node's single-threaded event loop plus the unique index appear to
  prevent an observable duplicate in practice — but the underlying
  check-then-act shape means this isn't structurally guaranteed the way
  an atomic `findOneAndUpdate({ upsert: true })` would be. Flagging as a
  latent risk worth the Integrator's attention, not a reproduced bug.

## Implementation changes required

None.

## Deviations from scope

- The task's pre-extracted context described the Executive-B-cannot-PATCH
  scenario as returning "(403)". The actual, already-live behavior
  (confirmed by reading `server/telephony/routes/calls.ts` and by TASK-02's
  own `telephony-isolation.spec.ts`, which asserts the same thing) is
  **404** — a manager acting on another executive's call never learns the
  call exists at all. The new test asserts the real, intentional
  behavior (404) with a comment explaining why, rather than asserting 403
  and producing a false failure against working code. 403 is still
  exercised elsewhere in the existing suite for the *reassignment*
  sub-case (a manager attempting `assignedUserId` on any call, including
  their own, gets 403 — that's a different code path).
- `concurrent-session-executives.spec.ts`'s "no lost update" scenario
  uses two call-note PATCHes (owner + the owning executive) rather than a
  Lead, because the Leads API in this codebase has no creation endpoint
  (leads are only created via inquiry-conversion,
  `POST /api/inquiries/:id/convert-to-lead`), which would have added
  unrelated inquiry-workflow setup noise to a test whose actual subject is
  concurrency, not lead creation. The task description explicitly offered
  "a Lead or call" as either being acceptable.
- The same concurrency test needed the owner to add a note to a call
  initiated by an executive, since attempting to have the tenant owner
  *initiate* a call directly 400s (`initiateOutboundCall` requires the
  actor to hold a `TelephonyIdentity`, which only executives have in this
  fixture setup, matching the app's real registered-number model) — this
  was discovered by running the test against the live server, not
  guessed, and is why the two-writer scenario is exec-creates +
  (owner-and-exec)-concurrently-annotate rather than owner-creates +
  reassign.
- Fixture user IDs across all three new files are lowercase-only
  (`_execa`/`_execb`, not `_execA`/`_execB`). `storage-mongodb.ts`'s
  `getUserByCredentials()` always lowercases the login `userId` before
  querying (the app's own `createUser()` stores it lowercase), so any
  fixture inserted directly via the Mongoose model with a mixed-case id
  would silently 401 on login. This was caught during verification
  (first draft of `isolation-rbac-tenant.spec.ts` used `_execA`/`_execB`
  and every login failed) and fixed before committing.
