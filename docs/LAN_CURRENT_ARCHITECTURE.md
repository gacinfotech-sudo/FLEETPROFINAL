# FleetPro — Architecture Snapshot (LAN Access Work)

Recorded before the `feature/local-network-access` changes, from the
running repo at `fleetpro-main-p0-fixed/fleetpro-main`.

## Baseline
- Branch at start: `feature/booking-first-ui-referral-rewards` @ `bdf445740c5a4468acfc83fd279587ccf81836f0`
- Uncommitted at start: one untracked file (`client/src/components/settings/`) — unrelated in-progress work, left untouched.
- Checkpoint branch created: `feature/local-network-access` (same commit, no forced checkpoint commit — see note below).

## Stack
- Single Node/Express process (`server/index.ts`), `type: module`, run via `tsx` in dev / bundled with `esbuild` for prod (`npm run build` / `npm start`).
- Vite (React) is mounted as **Express middleware** in development (`server/vite.ts` → `setupVite`), and served as static files in production (`serveStatic`). There is no separate frontend server/port — one process, one port.
- Database: **local MongoDB** (`mongodb://127.0.0.1:27017/fleetpro`, via Mongoose), not Atlas. Bound to loopback only by the `mongod` process itself (confirmed via `lsof`) — never exposed to the LAN by this change.
- No WebSocket / Socket.IO / SSE anywhere in `server/` or `client/src` — real-time features (if any) work over the same HTTP/session channel.
- No `cors(...)` middleware anywhere — not needed, since frontend and API are same-origin by construction.
- Client API calls use relative paths (`/api/...`), confirmed via `client/src/lib/api.ts` and `queryClient.ts` — no hard-coded `localhost` found anywhere in `client/src`.
- Auth: cookie/session based (`express-session` + `connect-mongo`), CSRF-protected, bcrypt password hashing, existing lockout/rate-limit fields already on the `User` model.

## Ports (as actually running, not assumed from any screenshot)
- `PORT=5050` (from `.env`) — single user-facing port for frontend + API.
- Confirmed via `lsof -n -i :5050` before any change.

## Auth / RBAC (existing, reused — not replaced)
- Roles: `admin` | `manager` | `client` (`server/models/index.ts`). `admin` is the highest role and is what this work treats as "Super Admin" — no new role was invented.
- `mustResetPassword` flag already exists on the `User` model and is already enforced client-side (`client/src/App.tsx`) — force-password-change-on-first-login required no new code.
- An emergency-admin bootstrap already existed (`server/admin-recovery.ts`, `reset-admin.js`), driven by `EMERGENCY_ADMIN_ID` / `EMERGENCY_ADMIN_PASSWORD` in `.env`. An active admin (`testadmin`) already existed in the database from this mechanism before this work started.

## Root blocker found
`.env` had `HOST=127.0.0.1`, explicitly overriding the code's own `0.0.0.0` default — this is what actually restricted access to this machine only. Digging further, that override existed because binding `0.0.0.0` **crashed the server** (`ENOTSUP`) due to `reusePort: host === "0.0.0.0"` in `server/index.ts` — `SO_REUSEPORT` on a wildcard bind isn't supported on this macOS/Node combination, and `reusePort` was never actually needed (single process, no clustering). See `LAN_CONFIGURATION_REPORT.md` for the fix.
