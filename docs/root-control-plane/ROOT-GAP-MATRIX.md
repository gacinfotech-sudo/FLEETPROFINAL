# Root Control Plane — Gap Matrix

Classification per requirement, against `CURRENT-SUPER-ADMIN-AUDIT.md`'s findings. Per the
dispatch brief: no implementation starts until this is complete.

| # | Requirement (dispatch section) | Classification | Basis |
|---|---|---|---|
| 1 | Platform role hierarchy (§3) | **DUPLICATE_RISK** | `User.role: 'admin'` already acts as an unscoped, all-powerful platform role today (`requireTenant` bypass). Introducing `PLATFORM_ROOT`/etc. *alongside* the untouched existing `'admin'` value creates two independent, overlapping "root" mechanisms unless deliberately reconciled — see "Critical design fork" below. |
| 2 | Root Dashboard (§4) | **PARTIAL** | No aggregate dashboard exists, but every underlying count (tenants, users, bookings...) is a straightforward query against already-tenant-scoped collections. Error/queue/webhook/GPS/WhatsApp/Telephony health cards need new instrumentation (see #10). |
| 3 | Tenant Master Database (§5) | **PARTIAL** | `admin-panel.tsx` + `/api/admin/tenants` already lists/manages tenants. Missing fields (tenant code, trial dates, usage counters, health/risk flag, internal notes) are additive `Tenant` schema fields, not a new system. |
| 4 | Tenant 360° (§6) | **MISSING** (as a unified workspace) | No single tenant-drill-down view exists; the data each tab needs already exists per-module (bookings, drivers, vehicles, etc., all `tenantId`-queryable) — this is an aggregation/UI task, not new data modeling, for most tabs. Errors/Support/Security/Audit-Log tabs depend on #8/#9/#10 below existing first. |
| 5 | Global Customer Database + Root Customer 360 (§7-8) | **MISSING** | No cross-tenant customer view exists. PII masking (default-masked phone/email, explicit unmask + audit) is wholly new — no masking utility exists anywhere in the codebase today (checked). |
| 6 | Cross-tenant access safety / `/api/root/**` namespace (§9) | **MISSING, but pattern precedent exists** | No `/api/root/**` namespace exists. The `admin`-bypass-in-`requireTenant` pattern is the *wrong* precedent to copy (it's an implicit, unaudited bypass) — build explicit Root data-access services instead, per the brief's own instruction not to "implement Root access by simply disabling tenant filters globally." |
| 7 | Support Center (§10) | **MISSING** | No `SupportTicket` model or UI exists anywhere. |
| 8 | Error Center + correlation IDs (§11-13, §39) | **MISSING** | No structured error capture, no correlation-ID propagation, no `ErrorLog` model. Real, substantial new infrastructure — needs a request-scoped correlation-ID middleware touching every route (a shared-file change) plus a new capture layer. |
| 9 | Tenant Health Score (§14) | **MISSING** | No scoring exists. Inputs (booking success rate, API error rate, support tickets, subscription status) mostly depend on #7/#8 existing first — sequence this after Support/Error Center, not in parallel. |
| 10 | Support access / impersonation (§15) | **MISSING** | No "enter tenant view" mechanism exists. The existing `admin`-role bypass is architecturally close (already grants full cross-tenant reach) but has none of the required banner/audit/reason/read-only-by-default controls — must be built as a new, deliberately narrower mechanism, not an extension of the bypass. |
| 11 | Break-glass access (§16) | **MISSING** | No time-boxed elevated-access mechanism exists anywhere. |
| 12 | Sales / Onboarding CRM (§17-18) | **MISSING** | No `Prospect`/pipeline model exists. "Create Tenant" from a won deal can reuse the existing `POST /api/admin/tenants` endpoint's underlying logic as a starting point. |
| 13 | Product Configuration / Plans / Entitlements (§19) | **MISSING** | `Tenant.subscriptionPlan` is a bare enum string with no entitlement table behind it — `Tenant.limits` is the *only* thing resembling entitlements today, and it's just 3 numeric counters. Centralized entitlements is genuinely new. |
| 14 | Tenant Feature Flags (§20) | **MISSING** | Confirmed zero existing feature-flag infrastructure of any kind. |
| 15 | Tenant Configuration Override / effective-value resolution (§21) | **MISSING** | No config-layering (tenant/plan/platform default) exists; each module's settings today are just directly-stored tenant fields with no override hierarchy. |
| 16 | Subscription/Billing control (§22) | **MISSING** | No platform-billing model exists. Do not confuse with the existing tenant-facing booking-payment ledger (`paymentLedger.ts`) — that's a different concern (customers paying tenants, not tenants paying FleetPro) and must not be reused/conflated. |
| 17 | Platform Audit Log (§23) | **MISSING globally, reusable pattern exists** | Generalize `GpsAuditLog`'s shape (`{tenantId, userId, action, oldValue, newValue, reason, createdAt}`) rather than design from scratch. |
| 18 | Security Command Center (§24) | **PARTIAL** | `GET /api/admin/security/stats` already exists as a basic precedent. Failed-login tracking, active-session listing, MFA status, break-glass-event listing are new. |
| 19 | Platform Root security hardening — MFA, session rotation, rate limiting, CSRF (§25) | **PARTIAL, mostly EXISTING_AND_REUSABLE** | Rate limiting (`express-rate-limit`/`express-slow-down`), CSRF (double-submit, already hardened once via a documented P0 fix), secure session store (`connect-mongo`) all already exist and just need to be *applied* to new Root routes. **MFA is the one genuinely missing piece** — real new cryptographic/UX scope. |
| 20 | Privileged action re-auth (§26) | **MISSING** | No re-authentication-for-sensitive-action mechanism exists anywhere in the current codebase. |
| 21 | Root user management (platform staff) (§27) | **MISSING** | The existing `/api/admin/users` manages *tenant* users only; there's no concept of a platform-staff user distinct from a tenant's own users. |
| 22 | Tenant user management from Root (§28) | **PARTIAL** | `/api/admin/tenants/:tenantId/managers` and reset-password/toggle-activation already exist for tenant users from the admin panel — force-logout and MFA-status display are the missing pieces. |
| 23 | Release management / rollout control (§29) | **MISSING** | No feature-release-channel or staged-rollout mechanism exists. This is a large, genuinely separate concern from everything else in the brief — flagging as a strong candidate to explicitly descope from the first implementation wave (see recommendation below). |
| 24 | Security policy configuration (§30) | **MISSING** | No centralized security-policy store (MFA requirement, session duration, password policy, IP allowlist, etc.) exists — currently these are all hardcoded constants scattered across `server/middleware/security.ts` and friends. |
| 25 | Secrets management visibility (§31) | **EXISTING_AND_REUSABLE pattern** | GPS and Telephony's encrypted-credential modules (`credentialEncryption.ts` in each) already implement exactly the "configured/health/last-tested, never reveal the value again" pattern this section describes — Root's view should read *from* these existing per-module encryption services, not build a new one. |
| 26 | Database operations visibility (§32) | **MISSING** | No DB health/migration-status endpoint exists (confirmed: no migration runner exists in this repo at all, schemaless-additive convention throughout). |
| 27 | Backup/restore visibility (§33) | **MISSING** | No backup automation or status tracking exists in-app (infrastructure-level, likely genuinely out of this codebase's scope per the brief's own §32 instruction against DB shell access). |
| 28 | Platform notifications (§34) | **MISSING** | No alerting/notification-acknowledgement system exists. Can reuse the Socket.IO layer from the telephony work (§11 of the audit doc) for real-time delivery, once that branch is merged into whatever lineage Root builds on. |
| 29 | Exports (§35) | **MISSING** | No export mechanism with permission/reason/audit gating exists. |
| 30 | Global Search (§36) | **MISSING** | No cross-entity/cross-tenant search exists. |
| 31 | Database indexing (§38) | **N/A until new collections exist** | New Root collections (audit log, support tickets, errors, sales prospects) need indexes designed alongside their schemas, following the existing `{tenantId, field}` convention plus new non-tenant-first indexes for global aggregate queries. |
| 32 | Support Debug Bundle (§40) | **MISSING** | Depends on §8 (Error Center) and feature-flag infra (§14) existing first. |

## Critical design fork — must be decided before dispatch, not left to individual workers

**The existing `role: 'admin'` bypass and the new `PLATFORM_ROOT` hierarchy cannot both
exist unreconciled.** Two options:

**Option A — Migrate.** Introduce the new platform-role field (e.g. `User.platformRole`,
additive, optional, defaulting to none), keep `User.role` exactly as-is for tenant-side
values, and change `requireTenant`'s bypass condition from `role === 'admin'` to checking
the new platform-role field instead. Existing `admin`-role users get an explicit one-time
migration to `platformRole: 'PLATFORM_ROOT'` (or a deliberately narrower role, reviewed
per-user) so behavior is preserved for real accounts, but the bypass mechanism itself
becomes the new, auditable one. **Requires editing `server/middleware/auth.ts`
(`requireTenant`) and `server/routes.ts:159`'s bypass check — both currently
Integrator-only shared files.**

**Option B — Layer.** Leave `role: 'admin'`'s existing bypass completely untouched (it
keeps working exactly as today, zero regression risk), and build the entire new
`PLATFORM_ROOT`/etc. hierarchy as a wholly separate, additive authorization path that only
applies to the new `/api/root/**` namespace. The old `/api/admin/**` namespace and its
`admin`-role bypass continue operating side-by-side, unaudited, indefinitely. Lower
implementation risk short-term; leaves the exact security gap the brief is trying to close
(an unaudited, un-MFA'd, all-powerful bypass role) permanently in place as a parallel back
door.

**Recommendation: Option A**, but flagging this explicitly rather than deciding
unilaterally — this is a security-architecture call with real blast radius (it changes an
authorization check every existing admin-panel request depends on), not a routine
implementation detail. This should be confirmed before `TASK-ROOT-DOMAIN-01` starts.

## Recommended scope adjustment for Wave 1

Given the gap matrix above, several sections have hard sequencing dependencies the
suggested 6-task split (§48) doesn't fully capture:

- Tenant Health Score (§14) depends on Support Center (§10) and Error Center (§11) existing
  first — cannot be built in the same wave as its own dependencies.
- Support Debug Bundle (§40) depends on Error Center (§11) and Feature Flags (§20).
- Release Management (§29) is large, genuinely separate, and not referenced by anything
  else in the brief's acceptance tests (§50-54) — **recommend explicitly descoping it from
  this implementation pass** rather than silently dropping it; flag for a dedicated future
  task.
- MFA (§25) is real, separate cryptographic scope, not a natural fit inside
  `TASK-ROOT-SECURITY-05` alongside RBAC/masking/break-glass/audit — recommend either its
  own task or explicit acknowledgment that Wave 1 ships without it and documents the gap.

## What Wave 1 should NOT rebuild (per the brief's own "no second source of truth" rule)

- Tenant CRUD basics (name, plan, activate/deactivate) — extend `/api/admin/tenants`'s
  underlying data layer, don't recreate it under `/api/root/tenants`.
- Session handling — reuse the existing `connect-mongo` store.
- Rate limiting / CSRF / helmet — reuse `server/middleware/security.ts` as-is.
- Encrypted-credential storage — reuse the GPS/Telephony pattern, don't write a third
  implementation.
- Permission-check mechanism — extend `requirePermission`'s pattern with a
  platform-permission variant, don't invent a new authorization primitive.
