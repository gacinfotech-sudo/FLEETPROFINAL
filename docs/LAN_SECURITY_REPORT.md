# FleetPro — LAN Access Security Review

## Boundary checks

| Control | Status |
|---|---|
| Login required for all app/API routes | ✅ unchanged — `authenticateUser` middleware, not touched |
| RBAC enforced (`admin`/`manager`/`client`) | ✅ unchanged |
| Tenant isolation (`scopeTenant`, `requireTenant`) | ✅ unchanged |
| Database reachable from the LAN | ❌ No — MongoDB is bound to `127.0.0.1:27017` by the `mongod` process itself, independent of this change. Not touched, not exposed. |
| Unrestricted CORS (`origin: "*"`) | N/A — no CORS middleware exists; app is same-origin by construction |
| Anonymous admin route | ❌ No new routes bypass auth except the new `/api/health`, which returns only `{status, database, timestamp}` — no tenant data, no secrets |
| Default/backdoor password | ❌ No default password was introduced. `admin:bootstrap` only ever generates a fresh random 24-char password, shown once, and only when **no** active Super Admin already exists |
| Hard-coded JWT/session secret | ❌ No — `SESSION_SECRET` is read from `.env`, unchanged |
| `.env` / secrets committed to git | ❌ No — `.env` was already gitignored; new `.runtime/` credential directory was added to `.gitignore` in the same commit that introduces it |
| Public internet exposure | ❌ Disabled — server binds `0.0.0.0` (all local interfaces) but nothing routes it past the LAN; no port forwarding, UPnP, or NAT was configured |

## What was intentionally *not* touched
- OS/root/database/router administrator credentials — never created, changed, or viewed.
- The existing `EMERGENCY_ADMIN_ID`/`EMERGENCY_ADMIN_PASSWORD` mechanism in `.env` and `server/admin-recovery.ts` — left exactly as found. It already created an active `admin` user (`testadmin`, `mustResetPassword: true`) before this work started; `admin:bootstrap` detects that account and intentionally does **not** create a second one.
- Authentication/session/cookie logic, CSRF protection, rate limiting, and account lockout — all pre-existing and unmodified. `cookie.secure` is already environment-gated (`NODE_ENV === 'production'`), so LAN access over plain HTTP in development was already cookie-compatible; no security downgrade was made to enable it.

## Recommendation (not applied — requires your decision, not a code change)
`EMERGENCY_ADMIN_PASSWORD` currently sits in plaintext in the local `.env` file. The code's own comment already recommends removing `EMERGENCY_ADMIN_ID`/`EMERGENCY_ADMIN_PASSWORD` from `.env` once you've confirmed you can log in and have changed the password — worth doing now that LAN login is confirmed working, but left as your call since it's pre-existing state, not something this task introduced.

## Role-based access for office users (Section 21 of the brief)
No new users were created for Manager/Booking Executive/Accounts/Operations/Driver Manager/Read-only roles — the brief asks to "create role-based accounts" for these, but the existing `User` model only has three roles (`admin`/`manager`/`client`), and inventing new role names or a finer-grained permission set was outside a preserve-first, patch-only change. Existing tenant users can already log in with their own credentials over the LAN URL today (confirmed: any authenticated session works identically over `http://192.168.29.142:5050` as over `localhost`). If you want dedicated per-function office accounts, that's a product/RBAC decision worth its own task rather than bundling it into network access.
