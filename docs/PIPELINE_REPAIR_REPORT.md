# Pipeline Repair Report

Full detail on the 5 repairs applied this initiative. See `docs/PIPELINE_BUG_REPORT.md` for classification/severity and the "documented, not fixed" list.

---

## Repair 1 — Backend permission check missing on Revenue/Performance reports (P0, SECURITY_RISK)

**Previous status**: `GET /api/reports/revenue`, `/driver-performance`, `/vehicle-performance` had `authenticateUser, requireTenant` only. Frontend hid these behind `restrictedForManagers`, but the API itself enforced nothing — any authenticated tenant user could call them directly and receive full profitability data.

**Root cause**: `PERMISSIONS.VIEW_REVENUE` existed and was already used by the frontend's `usePermissions().canViewRevenue()`, but was never attached as `requirePermission(...)` middleware to these 3 backend routes.

**Files changed**: `server/routes.ts` (3 one-line middleware additions, lines 1426, 5395, 5414).

**APIs changed**: same 3 routes — behavior change only for callers lacking `view_revenue` (now 403 instead of 200).

**Database changes**: none.

**Tests**: `tests/e2e/pipeline-audit-permission-repairs.spec.ts` — 6 tests (3 routes × manager-403 + owner-200). Manager identity reused from `availability-engine.spec.ts`'s existing `avtest_*` sub-user (known credentials, default permissions with no `view_revenue`) rather than creating a new one — this tenant's manager quota (default limit 5) was already exhausted, confirmed live during test development.

**Final status**: Fixed, tested, regression-clean.

---

## Repair 2 — Booking creation had no duplicate-request protection (P0, DATA_LOSS_RISK / FINANCIAL_RISK)

**Previous status**: `POST /api/bookings` had zero idempotency mechanism. A double form-submit or a retried request after a dropped response created two distinct Booking documents, each holding a vehicle/driver slot and counting as separate revenue.

**Root cause**: No idempotency key existed on the route or the `Booking` schema, unlike the established pattern already used for WhatsApp messages, reward transactions, and payment reversals.

**Files changed**:
- `server/models/index.ts` — additive `IBooking.idempotencyKey?: string`, schema field, and a new partial unique index `{tenantId, idempotencyKey}` (mirrors `PaymentTransaction`'s exact pattern).
- `server/schemas/mongodb-schemas.ts` — added `idempotencyKey: z.string().optional()` to `mongoBookingSchema` (without this, Zod's default unknown-key-stripping would have silently dropped the field before it ever reached the database — the exact same failure mode a neighboring comment in this file already documents for `createdBy`).
- `server/routes.ts` — pre-check (return existing booking if the key was already used) before any customer-linking/reward-redemption/payment side effects run, plus a race-safe duplicate-key (`11000`) catch around the actual `storage.createBooking()` call for the narrow case of two truly simultaneous requests. Also added `delete bookingData.idempotencyKey` to the `PUT /api/bookings/:id` edit route so it can never be changed post-creation.
- `client/src/components/booking/enhanced-booking-form.tsx` — one `useRef<string>` key generated at mount, sent with every create-booking request, regenerated only at both "Create New Booking" reset points (never on a mid-session retry).

**Database changes**: additive schema field + index only; no existing Booking documents touched, no migration needed (the field is optional and the partial index only applies where it's set).

**Tests**: `tests/e2e/pipeline-audit-idempotency-repairs.spec.ts` test 1 (two concurrent API requests, same key, same resulting booking, confirmed exactly one document exists) and test 3 (full UI wizard submission, confirmed exactly one booking created — regression guard for the new client-side wiring).

**Final status**: Fixed, tested, regression-clean.

---

## Repair 3 — Payment recording had no duplicate-request protection (P0, FINANCIAL_RISK)

**Previous status**: `POST /api/bookings/:id/payments` never accepted or forwarded an `idempotencyKey`, despite `recordPayment()` (the underlying service) fully supporting one and this exact pattern already working correctly for `reversePayment()`. A double-click or retry created two separate `PaymentTransaction` rows, inflating the ledger-derived `advanceReceived`.

**Root cause**: The route destructured a fixed field list from `req.body` that simply omitted `idempotencyKey`.

**Files changed**:
- `server/routes.ts` — route now reads and forwards `idempotencyKey`.
- `client/src/components/customers/customer-dashboard.tsx` — new `paymentIdempotencyKey` state, generated fresh at both places the Record Payment dialog opens, sent with the mutation.
- `client/src/components/booking/payment-section.tsx` — same pattern, independent component/dialog.

**Database changes**: none (used the existing `PaymentTransaction.idempotencyKey` field and index, already present).

**Tests**: `pipeline-audit-idempotency-repairs.spec.ts` test 2 — two concurrent payment-recording requests with the same key, confirmed exactly one `PaymentTransaction` and `advanceReceived` reflects exactly one ₹500 payment, not ₹1,000.

**Final status**: Fixed, tested, regression-clean.

---

## Repair 4 — Sub-user deactivate/reactivate routes missing tenant guard (P2, TENANT_ISOLATION_RISK)

**Previous status**: `DELETE /api/users/sub-users/:userId` and `PATCH /api/users/sub-users/:userId/reactivate` lacked the `requireTenant` middleware present on their sibling create/list routes. Narrow edge case: an orphaned admin/client user with no `tenantId` could deactivate/reactivate any tenant's manager by guessing a `userId`.

**Root cause**: Simple omission — no functional reason found for the asymmetry with the other sub-user routes.

**Files changed**: `server/routes.ts` — added `requireTenant` to both routes (2 one-word middleware insertions).

**Database changes**: none.

**Tests**: No dedicated new test (the edge case requires an orphaned tenant-less admin account, not producible via the normal signup/creation flow in this environment). Covered incidentally — the existing sub-user reactivate call in `availability-engine.spec.ts`'s `beforeAll` continued to pass after this change, confirming no regression for the normal (tenant-scoped) case.

**Final status**: Fixed, regression-clean.

---

## Repair 5 — "Finalize & Lock" invoice button not permission-gated on the frontend (P2, BROKEN_PERMISSION UX mismatch)

**Previous status**: Backend already correctly enforced `PERMISSIONS.GENERATE_INVOICE` on finalize; the button itself rendered unconditionally, so an unauthorized manager would click it and only then see a 403.

**Root cause**: `customer-invoices.tsx` never imported/used the existing `usePermissions().canGenerateInvoice()` hook already used elsewhere in the app for exactly this kind of gate.

**Files changed**: `client/src/components/customers/customer-invoices.tsx` — imported the hook, button now renders disabled with an explanatory tooltip when unauthorized, matching this same file's own established convention for the Email/WhatsApp buttons on draft invoices.

**Database changes**: none.

**Tests**: `tests/e2e/invoice-send-gating.spec.ts` re-verified passing with the owning-tenant client role (which has the permission, so the button remains fully functional) — regression guard, not a new dedicated permission test (would require the same scarce-manager-slot workaround as Repair 1; the backend enforcement is already the tested security boundary, this fix is UX-only).

**Final status**: Fixed, regression-clean.

---

## Cross-cutting process note

Every server-side change in this repair round required a dev-server restart before its effect was visible to Playwright — the dev server runs via plain `tsx server/index.ts` (no watch mode configured in `package.json`'s `dev` script), so file edits are not hot-reloaded. This was discovered mid-repair (Repair 1's first test run gave a false "still broken" result against stale server code) and applied consistently for every subsequent change in this phase.
