# FleetPro — Multi-Tenant SaaS Audit

Read-only, evidence-based. Branch `feature/customer-invoice-system` @ `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`.

## Context this audit builds on

The repo root already contains `AUDIT.md`, `CHANGELOG.md`, and `IMPLEMENTATION_PLAN.md` documenting a **prior** security remediation pass (session secret, CSRF, tenant-scoped IDOR fixes for direct-by-id routes, file upload validation). This audit independently verified those prior fixes are actually present in the current code, and focused new effort on gaps not already covered by that pass.

## What is done correctly (verified, not assumed)

- **Consistent `scopeTenant()` pattern** across `storage-mongodb.ts` and all `services/*.ts` files — the dominant, repeated pattern for building a tenant-scoped Mongo filter.
- **`tenantId` is required and compound-indexed on every major model** — confirmed across `Vehicle`, `Driver`, `Booking`, `Customer`, `Invoice`, `PaymentTransaction`, `Expense`, etc.
- **`requireTenant` middleware bypasses tenant scoping only for `role === 'admin'`** (`server/middleware/auth.ts:86-101`, `:88-90`) — by explicit design, since admin is the platform operator role; every other role is hard-blocked without a resolvable `tenantId`.
- **`databaseSecurityMiddleware`** blocks `$`-operator injection in request bodies (NoSQL injection defense) — confirmed present and functioning.
- **No vendor-specific models on this branch** — vendor data is plain text fields on `Booking`, so the "verify Tenant A can't reach Tenant B's vendor data via ID" check doesn't apply here (there's no vendor entity to leak). This is a Vendor-module *completeness* gap (see [REAL_WORLD_WORKFLOW_GAPS.md](./REAL_WORLD_WORKFLOW_GAPS.md) Gap 1), not a tenant-isolation risk in itself.
- **No CORS misconfiguration** — fail-closed, no `origin: '*'`.
- **No client-side token storage** — session-cookie-based auth, not a JWT stashed in localStorage.
- **Strong file-upload validation** — magic-byte re-check performed after upload, not just trusting the client-supplied MIME type/extension.
- **No raw NoSQL injection paths found** in the routes/services reviewed.
- **Global error handler never leaks stack traces** to the client.

## Findings — tenant-isolation risks

### T1. Booking creation trusts client-supplied `vehicleId`/`driverId` without verifying tenant ownership (P1)
- **Evidence:** `server/routes.ts:1985`, `server/storage-mongodb.ts:593-696`, `server/services/availability.ts:68-94`.
- **Mechanism:** `POST/PUT /api/bookings` accept `vehicleId`/`driverId` from the request body and use them directly in conflict checks and the saved document, without a query confirming those IDs belong to `req.tenantId`. Because booking reads `.populate()` these fields, the returned booking can embed another tenant's vehicle/driver document — including driver PII (per the audit brief's flagged fields: phone, and if present, government ID numbers).
- **Scenario:** A Tenant A user (or a compromised/malicious Tenant A account) submits a booking with a `driverId`/`vehicleId` belonging to Tenant B, obtained by guessing or previously observing a MongoDB ObjectId. The booking is created; subsequent reads of that booking populate and expose Tenant B's driver/vehicle document to Tenant A staff.
- **Why this is a distinct class from what's already fixed:** the prior remediation pass fixed *direct* by-id access (`GET /api/vehicles/:id` requiring tenant match); this is the same class of bug but via an **embedded foreign key** on a different tenant's own document, which is easy to miss when reviewing "does this route check tenant on its own primary entity" without also checking every foreign-key field it accepts.
- **Fix:** before using `vehicleId`/`driverId` in `createBooking`/`updateBooking`, verify each resolves to a document with matching `tenantId`; reject with 404/400 otherwise.

### T2. Expense mutation routes lack tenant-aware permission gating (P2)
- **Evidence:** `server/routes.ts:4632-4715` — `authenticateUser, requireTenant` only, no `requirePermission`, and `PUT /api/expenses/:id` mass-assigns the request body.
- **Note:** this overlaps with the permission finding in [SECURITY_AND_DATA_RISK_AUDIT.md](./SECURITY_AND_DATA_RISK_AUDIT.md) — listed here because it's also self-documented as a known gap in the repo's own `IMPLEMENTATION_PLAN.md`.

### T3. Sub-user deactivate/reactivate routes skip `requireTenant` (P2)
- **Evidence:** identified during the audit as an edge case specifically around orphaned clients without a resolvable `tenantId` — an area the app's own code elsewhere explicitly guards against, but these two routes don't apply the same guard.
- **Impact:** narrow, but worth closing given it's the same middleware already used everywhere else on adjacent routes.

## Tenant-owned resource checklist (per the audit brief)

| Resource | Tenant-scoped? | Evidence |
|---|---|---|
| Tenant creation/owner | Yes | `requireAdmin`-gated tenant CRUD, `routes.ts:976-1041` |
| Tenant users/roles | Yes | `User.tenantId`, role enum `admin/client/manager` |
| Tenant settings (business profile) | Yes | `routes.ts:585-738`, manager-inherits-from-owner logic verified |
| Tenant invoice numbering | Yes | `Counter` collection keyed by `{tenantId, name}`, atomic `$inc` |
| Tenant bank details | Yes | Part of `InvoiceSettings`, tenant-scoped |
| Tenant WhatsApp session | Yes | Per-tenant Baileys session directory, confirmed on disk |
| Tenant GPS connection | N/A on this branch | No GPS module present (see feature matrix) |
| Tenant customer/booking/driver/vehicle data | Yes, with the T1 caveat above | — |
| Tenant vendor data | N/A on this branch | No vendor entity exists |
| Tenant reports | Yes | All report services filter by `tenantId` |
| Tenant subscription | Yes | `Tenant.subscriptionPlan`/`limits`, enforced for vehicles/drivers/managers |
| Tenant files (uploads) | Yes, with strong post-upload validation | — |
| Tenant audit logs | N/A — no audit log exists at all (see feature matrix) | — |

## Cross-tenant access verification (non-destructive read-only checks only)

Per the brief's explicit instruction not to perform destructive security testing, cross-tenant access was verified by **code-path reading** (would Tenant B's ID, if guessed/known, pass the query filter) rather than by attempting a live cross-tenant request against real tenant data. The one confirmed gap by this method is T1 above; all other by-id routes reviewed (vehicles, drivers, customers, invoices, expenses) do filter by `tenantId` in their primary lookup.

## Summary

Multi-tenant isolation is **structurally sound** — the dominant pattern is correct and consistently applied — with one concrete P1 embedded-foreign-key gap (T1) and two P2 gaps (T2, T3) that are narrow and inexpensive to close. This is a materially better starting position than a typical early-stage SaaS; the prior remediation pass's fixes are real and verified in place.
