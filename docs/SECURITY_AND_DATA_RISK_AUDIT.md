# FleetPro — Security and Data-Integrity Risk Audit

Read-only, evidence-based. Branch `feature/customer-invoice-system` @ `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`. No destructive security testing was performed — findings are from code-path reading only, per the audit's strict read-only mandate.

## Part A — Security

### Strengths (verified, not assumed)
- `bcrypt` password hashing, cost factor 12, applied consistently.
- Mandatory strong `SESSION_SECRET` — server refuses to start without one (confirmed via `.env.example` comment and prior `AUDIT.md`); no hardcoded fallback secret found.
- MongoDB-backed session store (`connect-mongo`), not in-memory (survives restarts, supports horizontal scaling of app servers).
- CSRF double-submit token pattern present and applied.
- No open CORS (`origin: '*'` not found).
- No client-side token storage (cookie-session based, not localStorage JWT).
- Strong file-upload validation — magic-byte re-check performed server-side after upload, not just trusting client-declared MIME type.
- No NoSQL injection paths found; `databaseSecurityMiddleware` blocks `$`-operator injection in request bodies.
- Minimal mass-assignment usage — most mutation routes use explicit field allowlists (the `Expense` route is a confirmed exception, see below).
- Global error handler does not leak stack traces to clients.

### Findings

**S1 — Global input sanitizer weakens stored passwords (P2)**
The sanitizer applied to request input strips characters that overlap the required password-complexity special-character set, silently producing a weaker stored password than the complexity policy intends, with no user-facing warning that their chosen special characters were altered.
- **Scenario:** a user sets a password containing a special character the sanitizer strips; the stored password is silently different from what they think they set, and the complexity requirement's own intent (forcing special characters) is partially undermined.
- **Fix:** exempt password fields from the general input sanitizer (passwords should never be HTML/text-sanitized — they're hashed, not rendered) and validate complexity on the raw input.

**S2 — Sensitive data logged unguarded in one location (P2)**
A sibling of an already-fixed sensitive-logging bug remains unguarded in `server/storage-mongodb.ts:167`.
- **Fix:** apply the same redaction/guard already used at the sites the prior remediation pass fixed.

**S3 — Rate limiting is login-only and in-process (P2)**
Rate limiting exists only for the login route, and even there it's in-process (per-server-instance) rather than distributed — it will not hold up once the app runs behind a load balancer with multiple instances, since each instance tracks attempts independently.
- **Fix:** move rate-limit state to a shared store (Redis or Mongo-backed) before horizontally scaling; consider extending basic rate limiting to password-reset and any other unauthenticated/low-friction endpoints.

**S4 — Self-service password change doesn't confirm current password (P2)**
A logged-in user can change their own password without re-entering their current one.
- **Scenario:** an attacker with a momentarily unlocked/unattended session (shared office computer, stolen session cookie) can lock the real user out by changing the password without ever knowing the original.
- **Fix:** require current-password confirmation on the self-service change-password flow.

**S5 — Login lockout can be bypassed by varying username case (P2)**
Failed-login lockout tracking appears to key on the literal username string rather than a normalized (lowercased) form, so an attacker can bypass a per-username lockout by alternating case on repeated attempts.
- **Fix:** normalize the lockout key the same way the login lookup itself normalizes username matching.

**S6 — CSP allows `unsafe-inline`/`unsafe-eval` (P3)**
The Content-Security-Policy is present but permissive enough to blunt its own XSS-mitigation value.
- **Fix:** tighten CSP once inline-script/style usage is audited and can be moved to nonces/hashes; lower priority since this is defense-in-depth on top of the sanitization/escaping already in place, not the primary XSS defense.

**S7 — Booking creation trusts client-supplied foreign keys without tenant verification (P1)**
See [MULTI_TENANT_SAAS_AUDIT.md](./MULTI_TENANT_SAAS_AUDIT.md) finding T1 — cross-referenced here because it is simultaneously a tenant-isolation risk and an IDOR-class security finding (`server/routes.ts:1985`, `server/storage-mongodb.ts:593-696`).

**S8 — Missing permission checks are effectively an access-control gap** (see Part A of [REAL_WORLD_WORKFLOW_GAPS.md](./REAL_WORLD_WORKFLOW_GAPS.md) Gaps 7–8 for full detail): `VIEW_BOOKINGS`/`VIEW_REVENUE` permission constants exist and gate the UI but are never enforced server-side; Expenses, customer-merge, and rewards-adjustment routes have no permission gate at all. Severity P1–P2 depending on route.

## Part B — Data Integrity

### B1. Payment ledger write is not atomic with its balance recompute (P2, FINANCIAL RISK)
`server/services/paymentLedger.ts` — `PaymentTransaction.create(...)` and the subsequent `booking.save()` inside `recomputeBookingPaymentSummary` are two separate, non-transactional writes; none of the three call sites (`server/routes.ts:2093,2323,2683`) wrap them in `mongoose.startSession().withTransaction()`.
- **Scenario:** the `PaymentTransaction` commits, then `booking.save()` fails (e.g., a replica-set election mid-write) — the booking's cached `advanceReceived`/`paymentStatus` is left stale until another payment event on that same booking recomputes it. Self-healing, not silent permanent corruption, but can show an incorrect due amount indefinitely on a booking with no further payment activity.
- **Fix:** wrap both writes in a session, matching the pattern `createBooking` already uses correctly (`storage-mongodb.ts:654-695`).

### B2. No idempotency key wired on the primary payment-recording endpoint (P2, FINANCIAL RISK)
The `PaymentTransaction` schema has a correctly-designed partial unique index on `idempotencyKey` (`models/index.ts:750-753`), and two call sites use it correctly — but `POST /api/bookings/:id/payments` (the one the main "Record Payment" UI actually calls) does not generate or forward one.
- **Scenario:** a double-click or a client retry after a slow response on a poor connection creates two separate completed payment rows for one real payment.
- **Fix:** generate a client-side idempotency key per form submission; thread it through, mirroring the existing correct call sites.

### B3. No unique constraint on customer phone number — check-then-insert race (P2, DATA-LOSS RISK)
`CustomerSchema.index({tenantId:1, primaryMobile:1})` (`models/index.ts:1071`) is a plain, non-unique index. `findOrCreateCustomer` (`customerService.ts:28-66`) does a `findOne` then `create` with no DB-level constraint backing the uniqueness assumption.
- **Scenario:** two near-simultaneous booking submissions for the same new customer's phone number (e.g., a WhatsApp-bot booking racing a manual walk-in entry) both miss the `findOne` check before either commits, creating two separate `Customer` documents for one real person — splitting booking history, reward points, and loyalty tier.
- **Fix:** make the index unique (after a normalization/migration pass, since `primaryMobile` is already stored in canonical form) and handle the resulting duplicate-key error the same way `recordPayment`/`createInvoiceDraft` already do elsewhere in the codebase.

### B4. No DB-level double-booking prevention across concurrent transactions (P2, FINANCIAL RISK)
`findVehicleConflicts`/`findDriverConflicts` run inside `session.withTransaction`, but MongoDB multi-document transactions only guarantee snapshot isolation for documents actually touched by both transactions — two concurrent `createBooking` calls for the *same* vehicle but *different new* booking documents do not conflict at the storage-engine level.
- **Scenario:** two staff members in two browser tabs both create an overlapping booking for the same vehicle within milliseconds of each other; both conflict-checks read empty (neither has committed yet), both bookings save, the vehicle is now double-booked in practice — discovered only when the second customer arrives.
- **Fix:** a serialized per-resource lock (e.g., `findOneAndUpdate` on a lightweight per-vehicle/driver lock document before the conflict check) or a post-commit re-validation pass; this is a known, generally-accepted-as-hard class of problem in booking systems and worth flagging as a deliberate trade-off decision rather than an oversight, since the current mitigation (transactional check) closes the overwhelming majority of real-world races.

### B5. Money stored as floating-point `Number`, not integer/Decimal128 (P2, FINANCIAL RISK)
Every monetary field (`Booking.totalAmount`, `Expense.amount`, `PaymentTransaction.amount`, `Invoice.taxableAmount/gstAmount/totalAmount/amountReceived/balanceDue`) is a plain JS `Number` (IEEE-754 double). Invoice math applies a `roundMoney()` guard consistently; the payment-ledger summation in `paymentLedger.ts:17-30` does not.
- **Scenario:** across thousands of transactions on a high-volume tenant, floating-point summation can accumulate sub-paisa rounding error, occasionally producing a `remainingBalance` off by a paisa or two on customer-facing receipts.
- **Fix:** either store money as integer paise or migrate to `Decimal128` for ledger/booking amount fields; low urgency at current typical tenant scale, worth planning for before high-volume tenants onboard.

### B6. Invoice numbering can leave a gap under a rare write failure (P3)
`Counter.$inc` (atomic) and `invoice.save()` (separate write) in `finalizeInvoice` — a save failure after the counter already advanced burns a sequence number. Acceptable under GST rules (gaps are permitted if traceable) but contradicts the "gap-free" claim in the code's own comment.
- **Fix:** either accept and correct the comment, or wrap both in a transaction for a true gap-free guarantee.

### B7. No index on `Booking.customerId` (P2, SCALABILITY RISK)
At least 8 call sites query `Booking` by `{tenantId, customerId}` or `customerId` alone with no supporting index — including `recomputeCustomerStats`, which runs synchronously on every booking completion/cancellation.
- **Fix:** `BookingSchema.index({tenantId:1, customerId:1, pickupDate:-1})`.

### B8. No pagination on Bookings/Expenses list endpoints (P1, SCALABILITY RISK)
`GET /api/bookings` and `GET /api/expenses` have no `.limit()`/page params, against a documented 200,000-booking-per-tenant design cap. This is the single largest structural scalability gap found — see [REAL_WORLD_WORKFLOW_GAPS.md](./REAL_WORLD_WORKFLOW_GAPS.md) Gap 10 for full detail.

### What is correctly designed and verified safe (not flagged)
- Booking↔Customer name snapshotting is intentional, correct audit/accounting practice, not staleness risk.
- Invoice business/customer snapshots are intentional, correct accounting practice.
- Driver/vehicle "current booking" state is always computed live from `Booking` queries, never cached — a whole class of stale-pointer bugs is structurally impossible here.
- Array field mutations use safe append/push patterns everywhere checked; no whole-array-replacement risk found.
- `createBooking` and reward-crediting both correctly use `session.withTransaction`.
- Dashboard/report aggregation (`getTenantStats`, revenue report, customer segmentation) correctly uses MongoDB aggregation pipelines, not fetch-all-then-reduce-in-JS — with the one documented exception of the Operations dashboard (see feature matrix, Live Operations row).
