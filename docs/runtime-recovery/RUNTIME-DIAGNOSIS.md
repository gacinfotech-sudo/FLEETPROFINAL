# FleetPro Runtime Diagnosis

**Run:** 2026-08-07T06:48Z

## Summary

FleetPro was NOT actually down at the time this recovery pass started. Two
healthy instances were already running:

| Instance | Worktree | Branch | Port | PID | Status |
|---|---|---|---|---|---|
| Trunk (dev) | `fleetpro-main-p0-fixed/fleetpro-main` | `booking/integration-preview` | 5050 | 87587 | UP |
| Stable demo / Preview | `fleetpro-main-p0-fixed/fleetpro-worktrees/fleetpro-stable-demo` | `runtime/stable-demo` | 5051 | 70799 | UP |

The user's memory of "port 5050" matches the trunk worktree (`fleetpro-main`),
not the designated always-on preview. The designated, protected, always-on
preview per existing project convention (`.claude/runtime/STABLE-DEMO-STATE.json`,
already present in this repo before this session) is the **5051** instance,
worktree `fleetpro-stable-demo`. That file documents this exact preview
pattern already being in active use — this session reuses it rather than
creating a new "fleetpro-integration-preview" worktree from scratch, per the
"don't recreate unnecessarily" rule.

## Frontend status

UP on both 5050 and 5051. Vite dev middleware served correctly (SPA HTML,
`/@vite/client` injected, no stale bundle indicators). `npm run dev` runs a
single Express process serving both API and Vite middleware on one port —
this repo does not use separate frontend/backend ports.

## Backend status

UP on 5051 (the designated preview). Verified via:
- `POST /api/auth/login` with empty body → `400 {"message":"User ID and
  password are required"}` (validation working, not a crash).
- `POST /api/auth/login` with a nonexistent probe user/password →
  `401 {"message":"Invalid credentials"}`. This is a full round trip through
  the auth handler and the database lookup, confirming both the backend
  and its DB connection are functioning, without needing a real credential.
- Core route registrations confirmed present in `server/routes.ts`:
  `/api/customers`, `/api/bookings`, `/api/drivers`, `/api/vehicles`.

## Database status

MongoDB (`mongod`, community 8.0.4) running since Tue 01:xx AM, PID 71231,
listening on `127.0.0.1:27017`. Confirmed via the login round-trip above
(a `401 Invalid credentials` response requires a real query against the
`fleetpro` database). `mongosh` is not installed in this environment, so
direct shell inspection of collections wasn't performed — not needed, since
the application-level round trip already proves connectivity and query
health.

## Port conflicts

None blocking. Multiple worker worktrees also run their own `tsx
server/index.ts` dev servers on other ports (5074, 5093, 5095, 5099, etc.) —
this is expected under this repo's parallel-worktree workflow and does not
conflict with the 5050/5051 instances.

## Environment status

`.env` present in `fleetpro-main` (not read for secrets). `fleetpro-stable-demo`
has its own `.env` with `PORT=5051`, `HOST=127.0.0.1`, `NODE_ENV=development`.

## Migration status

Not evaluated this pass — no migration failure symptoms observed (server
started, DB round-trips succeed). No destructive or ambiguous migrations
were run.

## Last runtime error / root cause of prior downtime

No active downtime was found. Historical incidents (all pre-dating this
session, documented in `.claude/runtime/STABLE-DEMO-STATE.json`
`incident_history`) were caused by other worker sessions running broad
`pkill -f "tsx server/index.ts"` during their own test cleanup — this
pattern matches by command-line substring machine-wide, not by working
directory, and has repeatedly killed unrelated worktrees' dev servers
(including this preview and the trunk). This is a known, already-documented
systemic risk (`.claude/rules/parallel-dispatch.md`, "Process management
safety" section), not newly diagnosed here. It is not fixed repo-wide; it is
a process-hygiene rule workers must follow (kill by exact PID or
`lsof -ti:<port>`, never by command-string pattern).

The instance currently up (PID 70799, started 10:46AM) has been stable for
the current session's entire investigation window.

## Known in-flight work (not touched by this session)

`fleetpro-main` has one uncommitted change on branch `booking/integration-preview`:
`client/src/components/booking/enhanced-booking-form.tsx` — improves the
booking-failure toast to surface the specific Zod validation error/field
instead of a generic message. This is exactly the P1 booking-creation defect
called out in this recovery task, already being worked on by a concurrent
session/agent in the trunk worktree. This session did not edit or commit
this file — it belongs to whoever has it in flight, per parallel-dispatch
file-ownership rules.
