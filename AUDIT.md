# FleetPro Security & Stability Audit

Date: 2026-08-04
Scope: full repository (`fleetpro-main.zip`, no git history included in the upload)

This audit was performed with direct code changes, not just recommendations.
See `CHANGELOG.md` for the exact diff-level summary and `IMPLEMENTATION_PLAN.md`
for what's still open. Status legend: ✅ Fixed · ⚠️ Partially fixed / mitigated · ❌ Open.

## P0 — Critical security

| # | Finding | Status | Notes |
|---|---|---|---|
| 1 | `ADMIN_CREDENTIALS.md` contained a live plaintext admin username/password | ✅ Removed from tree | **No `.git` directory was present in the upload**, so there was no history to scrub. **You must rotate this credential in MongoDB now** — it was exposed in a document. If this file was ever committed to a real git repo elsewhere, that history must be scrubbed separately (`git filter-repo` / BFG) and force-pushed, and the old commit's copy purged from any CI caches/forks. |
| 2 | `cookies.txt`, `test-login.js` present in repo root | ✅ Removed, added to `.gitignore` | `test-login.js` only hashed a hardcoded test string, no real secret, but it's a debug artifact that shouldn't ship. |
| 3 | `SESSION_SECRET` fell back to `"your-secret-key"` | ✅ Fixed | Server now exits at startup if `SESSION_SECRET` is missing or under 32 chars. |
| 4 | Sessions used Express's default `MemoryStore` | ✅ Fixed | Replaced with `connect-mongo`, session payloads encrypted at rest, 30-day TTL mirrors cookie `maxAge`. |
| 5 | No CSRF protection | ✅ Fixed | Double-submit token (`X-CSRF-Token` header vs. session-stored value) on all mutating requests for authenticated sessions; `sameSite: 'lax'` cookie already provided partial protection. Frontend `apiRequest`/`queryClient` wrappers fetch and attach the token automatically, with self-heal on a stale-token 403. |
| 6 | Tenant isolation / IDOR — `findById` used with no tenant scoping | ✅ Fixed for vehicles, drivers, bookings, expenses, sub-user activation | `storage-mongodb.ts` now scopes single-record get/update/delete by `{_id, tenantId}` via a `scopeTenant()` helper in `routes.ts` (admins bypass, everyone else is scoped to `req.tenantId`). Update payloads can no longer reassign `tenantId`. Also found and fixed the same bug in `deactivateSubUser`/`reactivateSubUser` (a client could deactivate another tenant's manager by guessing their `userId`). |
| 7 | Manager permissions only enforced in the frontend | ✅ Fixed for the highest-value routes | `requirePermission()` middleware existed but was never wired in. Now applied to vehicle/driver/booking create/update/delete. **Not yet applied** to every mutating route — see IMPLEMENTATION_PLAN.md. |
| 8 | Zod `role` enum (`admin|client`) didn't match Mongoose model (`admin|client|manager`) | ✅ Fixed | Manager user create/update requests were previously rejected by validation before reaching the DB. |
| 9 | `/api/admin/fix-booking-audit` had no admin check | ✅ Fixed | Added `requireAdmin`. |
| 10 | `/api/test-background-job` had **no authentication at all** | ✅ Fixed | Now `requireAdmin` + disabled outside `NODE_ENV=development`. |
| 11 | Passwords/session IDs/customer data logged | ✅ Fixed for the worst offenders | Removed: full-user-object logging on every request in `middleware/auth.ts`, session ID logging on login, full request body logging on tenant creation and booking creation. **Not exhaustively audited** — see IMPLEMENTATION_PLAN.md for a `console.log` sweep. |
| 12 | Global error handler re-threw after `res.json()` | ✅ Fixed | Logs server-side, never throws after a response is sent, doesn't leak stack traces to 5xx clients in production. |
| 13 | MongoDB connection failure was swallowed with a false "in-memory fallback" message | ✅ Fixed | Retries with backoff, then `process.exit(1)` — verified by testing boot with no `MONGODB_URI` (fails immediately) and confirmed the old silent-continue path is gone. |
| 14 | Hard-coded port `5000` | ✅ Fixed | Uses `process.env.PORT`, falls back to `5000` locally. |
| 15 | File uploads validated only by client-supplied `mimetype` | ✅ Fixed | Added magic-byte verification (`file-type` package) after upload; rejects and deletes the file if the real signature doesn't match an allowed image type. Filenames are now built from an allow-listed extension, never the client's original filename. |
| 16 | `uploads/` served entirely via `express.static`, unauthenticated, no tenant scoping | ⚠️ Mitigated | Scoped the public mount to only `uploads/logos` and `uploads/signatures` (legitimately public branding assets used on customer-facing invoices). Added a `servePrivateTenantFile()` pattern in `routes.ts` for any future private document upload (self-drive KYC, driving licence, Aadhaar — none of these exist yet in the codebase; see IMPLEMENTATION_PLAN.md P2) so they are never served via a bare static mount. |

## P1 — Stability (partial pass — see IMPLEMENTATION_PLAN.md for the rest)

| # | Finding | Status |
|---|---|---|
| 17 | No vehicle double-booking check | ✅ Fixed | `createBooking` now checks for overlapping `confirmed/ongoing/hold` bookings for the same vehicle before inserting, wrapped in a MongoDB transaction where the deployment is a replica set (most managed MongoDB, incl. Atlas), with a non-transactional fallback (same check, smaller race window) for standalone instances. Returns HTTP 409 with a clear message on conflict. |
| 18 | `bookingId` generated from `Date.now()` alone — collision-prone under concurrent load | ✅ Fixed | Appends a 4-character random suffix. |
| 19 | Background job re-registered a new `setInterval` on every MongoDB `'connected'` event (reconnects stack up duplicate jobs) | ✅ Fixed | Guarded with a single module-level interval reference. |
| 20 | `deviceInfo` field used throughout the storage layer but missing from the `IUser` TS interface | ✅ Fixed | Added to the interface; this was silently breaking type-checking for a session-security-relevant field. |
| 21 | Several pre-existing `tsc` errors unrelated to my changes | ✅ Fixed (server) / ⚠️ open (client) | Fixed: `server/index.ts` `emitWarning` override typing, `server/vite.ts` `allowedHosts` typing, multer callback typing. **Not fixed**: several client dashboard/invoice components have real type errors (`stats-cards.tsx`, `dashboard.tsx`, `invoice-generator.tsx`, `use-permissions.ts`) — these predate this audit and are functional bugs (e.g. `dashboard.tsx` treats query results typed `unknown` as arrays), not security issues; scoped into IMPLEMENTATION_PLAN.md. |
| 22 | Remaining P1 items from the original brief (ObjectId validation coverage across all routes, standardized error envelope, tenant-scoped indexes/uniqueness, timezone handling, PWA service-worker claim, migrations, `.env.example`, seed/admin bootstrap docs) | ❌ Open | Scoped in IMPLEMENTATION_PLAN.md. |

## P2 / P3 — Business workflows, reports, tests

**Not started.** The brief asks for Religious Travels / Taxi / Self-Drive workflow completion (KYC, damage photos, deposits, agreements), fleet compliance tracking, a full reporting suite, and a test suite covering tenant isolation, booking lifecycle, and self-drive handover. This is realistically several weeks of product engineering on top of the P0/P1 security and stability work done here, and shouldn't be rushed through without your review of business rules (pricing, refund policy, deposit handling, etc.) at each step. See IMPLEMENTATION_PLAN.md for a phased breakdown.

## Verification performed

- `npx tsc --noEmit` — zero errors in `server/**`. Client has pre-existing, unrelated errors (listed above).
- `npm run build` — succeeds, produces `dist/index.js` and `dist/public/*`.
- Manual boot test: `NODE_ENV=production` with no `MONGODB_URI` → process now exits immediately with a clear error, instead of the old silent "falling back to in-memory storage" behavior (which had no actual fallback implementation).
- No automated tests exist in this repository yet (no test runner is even configured in `package.json`) — this is called out as P3 work.

## Immediate action items for you (cannot be done from inside this sandbox)

1. **Rotate the admin credential** that was in `ADMIN_CREDENTIALS.md` — change the password in MongoDB directly or via the recovery script.
2. Set these environment variables before deploying: `SESSION_SECRET` (32+ random hex chars, e.g. `openssl rand -hex 32`), `MONGODB_URI`, `PORT` (optional), `NODE_ENV=production`.
3. If this project's real git history (outside this zip) contains `ADMIN_CREDENTIALS.md`, scrub it with `git filter-repo`/BFG and rotate any credential a second time regardless, since scrubbing history doesn't un-expose something that's already been pushed to a remote.
4. Confirm your MongoDB deployment is a **replica set** (Atlas is, by default) so the new transactional booking-overlap check gets full atomicity rather than the fallback path.
