## Current Status
UP

## Preview URL
http://127.0.0.1:5051 (this machine)
http://192.168.29.142:5051 (other devices on the same Wi-Fi/LAN)

## Frontend
UP — Vite dev middleware serving SPA shell, no stale-bundle indicators.

## Backend
UP — `POST /api/auth/login` validates input (400 on empty body) and performs
a real DB-backed credential check (401 on unknown user). Core routes present:
`/api/customers`, `/api/bookings`, `/api/drivers`, `/api/vehicles`.

## Database
UP — MongoDB 8.0.4, PID 71231, `127.0.0.1:27017`, confirmed via the login
round-trip above.

## Running Commit
`bdf4457` — "Rewards/Referral Phase 5c: Customer 360 Referral Summary panel"
Branch: `runtime/stable-demo`
Worktree: `fleetpro-main-p0-fixed/fleetpro-worktrees/fleetpro-stable-demo`
Rollback tag: `checkpoint-responsive-calling-20260807-015905` (same commit)

## Last Updated
2026-08-07T06:48Z

## Newly Integrated Features
- **LAN access fix** (2026-08-07T06:54Z): the app was unreachable from other
  devices on the same Wi-Fi via `192.168.29.142`. Root cause: `server/index.ts`
  passed `reusePort: host === "0.0.0.0"` to `server.listen()`, and
  `SO_REUSEPORT` on a wildcard bind crashes with `ENOTSUP` on this
  macOS/Node combo — so any attempt to bind `0.0.0.0` silently failed to
  take effect, leaving the server stuck on loopback-only. `reusePort` was
  never actually needed here (single process, no clustering). Removed that
  option and set `.env` `HOST=0.0.0.0`, then restarted the exact PID
  (never a broad `pkill`) for both `fleetpro-main` (5050) and this preview
  (5051). Verified on both: binds `*:<port>`, reachable via LAN IP, and a
  real auth+DB round-trip succeeds from the LAN IP. Database stays
  loopback-only throughout (unaffected, still `127.0.0.1:27017`). This
  matches the independent audit already on file in `docs/LAN_*.md`.

## Speed work (2026-08-07T07:05Z)
- **Applied and running**: gzip/br compression middleware on all responses
  (confirmed via `Content-Encoding: gzip` on LAN requests). Cuts transfer
  size for JSON API responses and any non-bundled assets over the real
  Wi-Fi link (loopback didn't need it; LAN bandwidth does).
- **Attempted, rolled back**: switching this preview to a production build
  (`npm run build && npm start`) for minified/bundled/cached static assets
  — the real remaining tax is Vite dev mode serving hundreds of unbundled,
  unminified module files per page load. The production bundle measured
  726KB gzip in one main chunk, a large drop in request count. But
  `NODE_ENV=production` also silently enables three behaviors that assume
  a real TLS-terminating reverse proxy in front of the app (secure
  cookies, trusted `X-Forwarded-For`, forced HTTPS redirect) — none of
  which exist on this bare LAN server. The HTTPS-redirect one actually
  took the preview down for ~90s (caught and logged by
  `stable-demo-monitor.sh`, which correctly did not auto-restart). Rolled
  back immediately to the known-good dev-mode server. Fixed all three
  couplings at the code level with explicit env-var overrides
  (`SESSION_COOKIE_SECURE`, `TRUST_PROXY_HOPS`, `FORCE_HTTPS_REDIRECT` —
  see `.claude/runtime/PREVIEW-RUNTIME.json` for the full list).
- **Resolved (2026-08-07T07:22Z)**: rebuild completed (5m46s — slow because
  system load average was ~40 from other concurrent worker sessions
  building/testing, not a hang) and the production build is now live on
  this preview (PID 2900). Verified: root page 200 (not 302), gzip active
  on HTML and the main JS bundle, hashed assets get
  `Cache-Control: public, max-age=31536000, immutable`, login's `Set-Cookie`
  correctly has no `Secure` attribute (works over plain HTTP), MongoDB
  still loopback-only. Watchdog shows sustained `OK` after the deploy.

## Known Errors
- **P1 — BOOKING CREATION DEFECT**: previously reported "Failed to create
  booking" / "Invalid booking data" toast did not surface which field was
  invalid. A fix is already in progress, uncommitted, in the `fleetpro-main`
  trunk worktree (branch `booking/integration-preview`,
  `client/src/components/booking/enhanced-booking-form.tsx`) — it makes the
  failure toast show the specific Zod-validated field/message instead of a
  generic string. Not yet verified against a live booking submission or
  promoted to this preview.

## Currently Being Fixed
- P1 booking creation error (see above) — in flight in the trunk worktree by
  another session; this session did not modify it, per file-ownership rules.

## Verification method / limitations
This pass verified HTTP/API-level health only (curl-based: login endpoint,
route registration, DB round-trip). It did **not** drive an actual browser
through login → dashboard → customers → bookings → drivers → fleet, because
no browser-automation tool was available in this session and no test-account
credentials were located in the repo (checked e2e specs, `.env.example`,
docs — none defined a reusable demo login). Treat the click-through smoke
test in the task's Section 7 as **not yet performed**; the API-level checks
above are a strong but partial substitute. If the user has a known test
account, share it and this can be completed end-to-end.

FLEETPRO PREVIEW
Build: bdf4457
Updated: 2026-08-07T06:48Z
