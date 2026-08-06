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

## Repair 6 — Customer 360° timeline had no click-through to the originating Inquiry/Lead (P3, UI_ONLY)

**Previous status**: `inquiry_linked`/`inquiry_converted_to_lead`/`lead_converted_to_customer` timeline events rendered as plain text even though the underlying Inquiry/Lead records and their linking fields exist.

**Root cause**: `TimelineEvent` never carried the actual `inquiryId`/`leadId` values, and `customer-timeline.tsx` had no navigation wiring.

**Files changed**:
- `server/services/timelineService.ts` — additive `inquiryId?`/`leadId?` fields on `TimelineEvent`, populated on the 3 relevant push calls.
- `client/src/components/customers/customer-timeline.tsx` — new optional `onNavigateToInquiry`/`onNavigateToLead` props; rows with an id render as clickable links (lead preferred over inquiry when both are present, since it's the "further along" record).
- `client/src/components/customers/customer-dashboard.tsx`, `client/src/pages/customers.tsx` — forward the two new callbacks down to the timeline.
- `client/src/pages/dashboard.tsx` — new `pendingInquiryId`/`pendingLeadId` state (same set-before-navigate/clear-on-navigate-away pattern as `pendingCustomerId`), new `handleNavigateToInquiry`/`handleNavigateToLead` handlers, threaded into new `initialInquiryId`/`initialLeadId` props.
- `client/src/pages/inquiries.tsx`, `client/src/pages/leads.tsx` — accept the new prop, fetch that exact record by id (`GET /api/inquiries/:id` / `GET /api/leads/:id`, both pre-existing routes) and open its detail dialog on arrival — fetched directly rather than found in the current page's loaded list, since the target record may not be on the currently filtered/paginated page.

**Database changes**: none.

**Tests**: `tests/e2e/pipeline-audit-timeline-clickthrough.spec.ts` test 1 — builds a real Inquiry→Lead→Customer chain via the actual APIs, clicks the "converted to lead" timeline row, confirms navigation to `/dashboard/leads` with that exact lead open.

**Scope note**: only wired for the primary Customer 360° view (`customers.tsx`); the secondary nested `CustomerDashboard` mount inside `leads.tsx` (viewing a lead's linked customer) was left with the plain-text-only behavior to avoid a deeper prop-threading chain through a page with its own complex state — no regression there, just not enhanced.

**Final status**: Fixed, tested, regression-clean.

---

## Repair 7 — WhatsApp send failures didn't distinguish "not configured" from a real failure (P2, PARTIALLY_WORKING)

**Previous status**: Every WhatsApp-send error handler forwarded the raw provider error string in a generic destructive toast, identical in presentation to an actual send failure (bad number, provider outage, etc.).

**Root cause**: No handler special-cased the specific "WhatsApp session not connected for this tenant" error that `baileysProvider.ts` returns when a tenant hasn't linked a session.

**Files changed**:
- `client/src/lib/whatsapp-error.ts` — new shared helper (`isWhatsAppNotConnectedError`, `whatsappErrorToast`) detecting the specific error substring and returning a distinct "WhatsApp Not Connected — Configuration Required" toast.
- `client/src/components/booking/booking-communication.tsx`, `client/src/components/customers/customer-message-center.tsx` — both WhatsApp-send `onError` handlers now use the shared helper.

**Database changes**: none.

**Tests**: `pipeline-audit-timeline-clickthrough.spec.ts` test 2 — triggers a real send against this dev tenant's genuinely disconnected WhatsApp session (confirmed disconnected by every other WhatsApp-touching test in the suite) and asserts the new toast text appears.

**Final status**: Fixed, tested, regression-clean.

---

## Repair 8 — Google Review request picker didn't distinguish "already requested" bookings (P2/P3, PARTIALLY_WORKING)

**Previous status**: The booking picker in the "Send Review Request" dialog only excluded bookings whose review was already *received*, not ones already *requested* — a staff member could send a second real request with no indication one was already sent, since idempotency only protects an exact-retry (same `requestId`), not a fresh request for the same booking.

**Root cause**: `requestableBookings` filtering only checked `receivedBookingIds`.

**Files changed**: `client/src/components/customers/customer-google-reviews.tsx` — new `requestedBookingIds` set (un-received but requested), booking options now show "(already requested)" — still selectable, since a genuine follow-up re-request is a legitimate action, just no longer an accidental-looking duplicate.

**Database changes**: none.

**Tests**: No dedicated new test — presentation-only change; `google-review.spec.ts`/`review-rewards-campaign.spec.ts` continue to exercise the underlying request flow unaffected.

**Final status**: Fixed, regression-clean.

---

## Cross-cutting process note

Every server-side change in this repair round required a dev-server restart before its effect was visible to Playwright — the dev server runs via plain `tsx server/index.ts` (no watch mode configured in `package.json`'s `dev` script), so file edits are not hot-reloaded. This was discovered mid-repair (Repair 1's first test run gave a false "still broken" result against stale server code) and applied consistently for every subsequent change in this phase.

**Shared-dev-DB far-future-date collision risk across the whole test suite**: this repo's E2E tests create real bookings against a shared, long-lived dev MongoDB with a small, fixed vehicle fleet, and avoid colliding with real/near-term data by picking a "far future" pickup date (a random offset thousands of days out). Because many independent test files each pick their own offset/window (observed range: +1 to +27000 days across the existing suite), two tests can legitimately land on the same vehicle+date and collide with a `VEHICLE_DOUBLE_BOOKING` error — this is what caused `pipeline-audit-idempotency-repairs.spec.ts`'s new tests to intermittently fail against unrelated pre-existing tests (and vice versa: it briefly broke `review-rewards-campaign.spec.ts`, whose `+27000` offset overlapped this phase's first choice of `+20000..27000`). Fixed by moving this phase's new date offsets to a `+40000..50000` range, clear of every existing offset found via a repo-wide search — not a code defect, a test-fixture spacing issue. Worth a future dedicated pass (a shared constants file enumerating each test file's reserved offset range) if this class of flake keeps recurring.
