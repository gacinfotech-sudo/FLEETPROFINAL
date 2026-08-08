# FleetPro — LAN Access Configuration Report

## What changed (all additive / config-only — see git diff on `feature/local-network-access`)

1. **`.env`**: `HOST=127.0.0.1` → `HOST=0.0.0.0`. Not committed (already gitignored).
2. **`.env.example`**: documented the `HOST` variable (was previously undocumented).
3. **`server/index.ts`**: removed `reusePort: host === "0.0.0.0"` from `server.listen(...)`. This was the actual root cause of the LAN restriction — see `LAN_CURRENT_ARCHITECTURE.md`. `reusePort`/`SO_REUSEPORT` is for multiple processes sharing one port; this app is a single process, so it was never needed, and it crashed startup (`ENOTSUP`) whenever `HOST=0.0.0.0` was set. No other behavior changed.
4. **`server/routes.ts`**: added `GET /api/health` — unauthenticated, returns `{status, database, timestamp}` only (no secrets), used by `npm run lan:check`.
5. **New scripts** (`scripts/lan-info.ts`, `lan-check.ts`, `lan-start.ts`, `admin-bootstrap.ts`, `admin-status.ts`, `scripts/lib/lan-network.ts`, `scripts/lib/secure-password.ts`) + 5 new `npm run` entries in `package.json`. No new dependencies — reuse `tsx`, already a devDependency.
6. **`.gitignore`**: added `.runtime/` (one-time credential file location).

## Why no CORS / WebSocket / reverse-proxy changes were needed
The app is single-origin by design (Vite mounted as Express middleware, one port). There is nothing cross-origin to configure, and no WebSocket usage exists in the codebase to audit. This is why the patch is much smaller than a typical "split frontend/backend" LAN-access change — see Section 9/11/13 of the task brief, "prefer the smallest compatible patch."

## LAN access, as detected right now
- Host: `pradeeps-MacBook-Air.local`
- Interface: `en0` (carries the default route)
- **Recommended URL: `http://192.168.29.142:5050`**
- Port source: `PORT=5050` in `.env` (preserved, not changed)

Re-run `npm run lan:info` any time — the IP can change after a router restart or reconnect. For a permanently stable IP, configure a **DHCP reservation** for this Mac on your office router (out of scope for this repo — router admin access, not requested).

## New commands

| Command | Purpose |
|---|---|
| `npm run lan:info` | Prints hostname, recommended + additional LAN URLs, and a live health check |
| `npm run lan:start` | Validates required env vars, checks the port is free, prints the LAN URL, then runs `npm run dev` |
| `npm run lan:check` | Hits `/api/health`, `/`, and `/api/csrf-token` **on the detected LAN IP** (not localhost) and reports pass/fail |
| `npm run admin:bootstrap` | Idempotent: creates a Super Admin only if none exists; never touches an existing one |
| `npm run admin:status` | Reports existing Super Admin account(s) — never prints passwords or hashes |

## Firewall
macOS Application Firewall is currently **disabled** on this machine (`socketfilterfw --getglobalstate` → `State = 0`) — nothing is blocking inbound LAN connections at that layer, so no rule was needed. **If the firewall is ever turned on later**, run this once to keep FleetPro reachable (requires an admin password prompt, so it could not be run non-interactively here):

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$(which node)"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$(which node)"
```

This allows the `node` binary through the firewall for inbound connections; it does not open any other port or service, and does not touch the database port (MongoDB stays bound to `127.0.0.1:27017` regardless — unaffected by any of this).

## Not done (explicitly out of scope per the task brief)
- No router port forwarding, UPnP, or NAT configuration.
- No public internet exposure.
- No OS-, database-, or router-admin passwords created, changed, or disclosed.
