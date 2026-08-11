# Current Super Admin / Platform Architecture — Audit

Performed before any Root Control Plane implementation, per the dispatch brief's own
"audit first" mandate. Every claim below is grounded in a file:line reference, not assumed.

## Headline finding

**FleetPro already has a primitive, real, working platform-admin layer — this is not a
greenfield build.** `User.role === 'admin'` already bypasses tenant scoping entirely, and a
substantial `/api/admin/**` route namespace (~25 endpoints) plus a real UI
(`client/src/pages/admin-panel.tsx`, 862 lines) already does tenant CRUD, user management,
plan management, and usage stats. The Root Control Plane must be designed as an *additive
evolution* of this, not a parallel system that ignores it — see `ROOT-GAP-MATRIX.md`'s
"DUPLICATE_RISK" section for the specific design fork this creates.

## 1. Tenant model

`server/models/index.ts` — `TenantSchema`: `name`, `businessName`, `email`, `phone`,
`address`, `isActive`, `maxManagers`, `subscriptionPlan` (`enum: ['starter','pro','custom']`),
`limits: { vehicles, drivers, managers }`, `createdAt`. No `tenantCode`, no `legalName`
distinct from `businessName`, no `city`/`state`/`country` breakdown (just one `address`
string), no GST/tax field, no trial dates, no billing cycle/renewal date, no risk
flag/internal notes/support status. **PARTIAL** — real and reusable as the base row, but
missing most of Section 5's required fields.

## 2. Tenant ID strategy

`tenantId: mongoose.Types.ObjectId` (ref `'Tenant'`) is the pervasive scoping field —
confirmed present on `Booking`, `Customer`, `Vehicle`, `Driver`, `Inquiry`, `Lead`, and
essentially every tenant-owned collection (171 occurrences in `server/storage-mongodb.ts`,
373 in `server/routes.ts`, per an earlier session's audit in this same conversation).
**EXISTING_AND_REUSABLE** — this is the correct, consistent foreign key for every Root
cross-tenant query to key off.

## 3. User model / Role model

`server/models/index.ts:25`: `role: 'admin' | 'client' | 'manager'` — a **flat, three-value
enum**, no hierarchy, no separate platform-vs-tenant distinction. `'client'` is the tenant
owner/business account; `'manager'` is a tenant sub-user; `'admin'` is the one existing
platform-wide role.

**Critical, security-relevant existing behavior**: `server/middleware/auth.ts:86-90`
(`requireTenant`): `if (req.user?.role === "admin") { return next(); }` — an `admin` user
is waved through tenant scoping unconditionally, on every route that uses `requireTenant`.
`server/routes.ts:159`: `req.user?.role === "admin" ? undefined : req.tenantId` — the
storage layer already treats an `undefined` tenant filter as "intentional cross-tenant
admin query" in multiple places. **This is the existing Root/Platform access mechanism,
today.** It has no MFA, no audit log, no PII masking, no scoped sub-roles — any `admin`
user has full, silent, unaudited cross-tenant read/write access to everything.
**EXISTING_AND_REUSABLE as a foundation, BROKEN as a safe production Root mechanism** —
exactly the gap Sections 3, 8, 15, 23, 25 of the dispatch brief are asking to fix.

## 4. Manager/Admin roles, ownership fields

`Lead.assignedExecutive`, `Inquiry.assignedExecutive`, `*FollowUp.assignedTo` are free-text
strings, not `ObjectId` refs (confirmed earlier this session investigating the telephony
work). No `managerId`/`teamId` hierarchy on `User`. Booking/Customer/Driver/Vehicle/Vendor
ownership is all `tenantId`-scoped only, no owning-user field beyond `createdBy`/`updatedBy`
(embedded `{userId, role}` sub-docs, not refs). **PARTIAL** — tenant-level ownership is
solid; user-level ownership within a tenant (relevant to Root's "which user hit this error"
drill-down) is thin.

## 5. Subscription model / Feature flags

`Tenant.subscriptionPlan` (starter/pro/custom) + `Tenant.limits` (vehicles/drivers/managers
counts only) is the *entire* current subscription model — no trial dates, no billing cycle,
no renewal date, no payment/invoice-for-the-platform-itself records, no per-feature
entitlement table. **Feature flags do not exist anywhere in this codebase** (confirmed via
grep — zero matches for `featureFlag`/`feature_flag` in models or middleware). **MISSING**
— Sections 19, 20, 22 are genuinely new work, not extensions of something existing.

## 6. Session model

`express-session` + `connect-mongo` (`MongoStore`), persistent MongoDB-backed store —
confirmed at `server/routes.ts:3-4,275` with an explicit comment noting this replaced the
default in-memory store specifically to fix a memory leak (a real prior incident, not
theoretical). **EXISTING_AND_REUSABLE** — Root sessions can use the same store; no need for
a second session mechanism.

## 7. Auth middleware / Permissions

`server/middleware/auth.ts`: `authenticateUser` (session → user lookup, `isActive` check),
`requireTenant` (the admin-bypass described above). `server/middleware/permissions.ts`
(128 lines): a flat `PERMISSIONS` string-constant map + `requirePermission(permission)`
middleware calling `storage.checkUserPermission(userId, permission)` — genuinely granular
per-action permissions already exist for tenant-side roles (e.g.
`inquiry.view`/`inquiry.create`, reward/referral permissions from earlier work this
session). **EXISTING_AND_REUSABLE pattern** — the new `PLATFORM_ROOT`/
`PLATFORM_SUPPORT_ADMIN`/etc. roles should plug into this same
`requirePermission`-style mechanism with a parallel platform-permission namespace, not a
new authorization paradigm.

## 8. Audit logs

**Do not exist.** Grepped `server/models/index.ts` for `AuditLog`: zero matches. The only
adjacent precedent is `GpsAuditLog` (`server/gps/models/gpsConnection.ts`, from the GPS
module built earlier this session) — a real, working, tenant-scoped audit-log pattern
(`{tenantId, userId, action, oldValue, newValue, reason, createdAt}`) that already proves
the shape works in this codebase, just scoped to one module. **MISSING globally, but a
directly reusable pattern exists** — Section 23's Platform Audit Log should generalize
`GpsAuditLog`'s shape rather than invent a new one.

## 9. Integrations (WhatsApp, Telephony, GPS, Payment)

- **GPS**: mature, provider-neutral module (`server/gps/**`) with connection/device/
  assignment/telemetry/billing sub-modules, encrypted-credential storage
  (`server/gps/security/credentialEncryption.ts`), and its own audit log (above). Built
  across this session's GPS wave. **EXISTING_AND_REUSABLE** as the encryption/health-check
  pattern for Section 31 (Secrets Management).
- **Telephony**: `server/telephony/**` (own models, encrypted credentials, mock provider
  adapter) — built earlier this session, lives on `task/telephony-02-multiuser-isolation`,
  not yet merged into this worktree's lineage. **EXISTING_AND_REUSABLE**, same encryption
  pattern.
- **WhatsApp**: `server/whatsapp/**` (Baileys-based), referenced throughout the booking/
  campaign code as already working, with graceful "not connected" handling already proven
  in existing tests. **EXISTING_AND_REUSABLE**.
- **Payments**: no third-party payment gateway integration found — booking payments are
  recorded via an internal ledger (`server/services/paymentLedger.ts`, confirmed earlier
  this session), not a Stripe/Razorpay-style external processor. **PARTIAL** — Section 22's
  "gateway-based billing architecture" for the *platform's own* subscription billing is
  genuinely new; nothing to reuse there specifically (the tenant-facing booking-payment
  ledger is a different concern).

## 10. Error handling / logging

No structured error-tracking/monitoring found (no Sentry, no `ErrorLog` model, no
correlation-ID propagation — grepped, zero matches). Errors are handled ad hoc per-route
(`try/catch` + `console.error` + a JSON error response), confirmed via spot-checks
throughout `server/routes.ts` this session. **MISSING** — Section 11's Error Center and
Section 39's correlation-ID tracing are genuinely new infrastructure, though Express's
existing per-request logging middleware (`morgan`-style request logs, seen throughout this
session's dev-server output) is a reasonable base to extend rather than replace.

## 11. WebSockets

A real WebSocket layer now exists (`server/index.ts`, Socket.IO, mounted at
`/ws/telephony`) — built during this session's telephony work, on
`task/telephony-02-multiuser-isolation` / the `9d2bd9c` trunk lineage, **not present in
this specific worktree's branch** (`booking/integration-preview`, checked directly — zero
`socket.io`/`io.on` matches here). Room membership is derived server-side from the
authenticated session only (independently verified earlier this session) — a safe pattern
to extend for Section 34's real-time platform alerts. **EXISTING_AND_REUSABLE, but only on
a branch not yet merged into every lineage** — flag this dependency explicitly for
whichever worker builds Root's real-time notifications.

## 12. Database indexes

88 explicit `.index(...)` calls already in `server/models/index.ts`, the large majority
`{tenantId, ...}` compound indexes. **EXISTING_AND_REUSABLE pattern, well-established** —
new Root-specific collections (audit log, support tickets, error records) should follow the
exact same `{tenantId: 1, <query field>: 1}` convention, and a global admin dashboard
aggregate query will need its own non-tenant-first indexes (e.g. `{createdAt: -1}` for
"errors in the last hour" across all tenants) — a genuinely new indexing need, not covered
by the existing tenant-first convention.

## 13. Tenant-scoped queries / existing API boundaries

Confirmed consistent `tenantId`-filtered query convention throughout `server/storage-mongodb.ts`
and `server/routes.ts`, with `requireTenant` as the enforcement point. **EXISTING_AND_REUSABLE**
as the model for what `/api/root/**` must deliberately *not* do (Section 9) — Root services
need their own explicit multi-tenant query functions, never just "the same tenant query
with the filter removed," to avoid inheriting any assumption that baked-in tenant scoping
elsewhere might rely on.

## 14. Existing "Super Admin" screens

`client/src/pages/admin-panel.tsx` (862 lines) — real, working, currently in production
use. Confirmed via direct inspection: lists tenants (`GET /api/admin/tenants`) and users
(`GET /api/admin/users`), supports tenant/user CRUD, password reset, activation toggle,
per-tenant manager-limit and plan management (`client-form.tsx`, `manager-control-modal.tsx`,
`plan-management-modal.tsx` — three existing admin-scoped components), bulk
activate/deactivate-all per tenant. There is also an existing
`GET /api/admin/security/stats` endpoint (`server/routes.ts:1144`) — a real, if basic,
precedent for Section 24's Security Command Center. **EXISTING_AND_REUSABLE — this is
Section 4-6's closest existing relative and should be the extension point for Tenant
Database / Tenant 360, not a from-scratch rebuild.**

## 15. Rate limiting / brute-force / CSRF / security headers

`server/middleware/security.ts`: `helmet`, `express-rate-limit`, `express-slow-down`, and a
real, carefully-commented CSRF double-submit implementation (with a documented P0 bug fix
in its own history — re-login-after-any-prior-session used to be broken, now fixed).
Rate-limiting is already applied per-module in GPS and Driver routes (`gps/routes/*.ts`,
`driver/handover/routes.ts`, `driver/documents/routes/*.ts`). **EXISTING_AND_REUSABLE** —
Section 25/26's rate-limiting and CSRF requirements are largely already met at the
infrastructure level; Root-specific routes need to *apply* these existing middlewares, not
build new ones.

## 16. MFA / 2FA

**Does not exist anywhere** (grepped for MFA/TOTP/twoFactor/2FA — zero matches).
**MISSING** — Section 25's MFA requirement for `PLATFORM_ROOT` is genuinely new work, and
notably significant: this is real cryptographic/UX scope (TOTP enrollment, backup codes,
verification flow), not a small addition.

## 17. Support tickets / incident management / sales CRM

**Do not exist anywhere.** No `SupportTicket`, `Incident`, or `Prospect`/sales-pipeline
model found. **MISSING entirely** — Sections 10, 17, 46 are wholly new subsystems, though
they can follow the same tenant-scoped-collection + REST-route + React-page pattern already
proven repeatedly this session (GPS, Telephony, Booking Queues, Vehicle 360 all built this
way).
