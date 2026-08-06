# FleetPro — Real-World Workflow Gap Report

Format per gap: current behaviour → real-world requirement → difference → operational/financial/security impact → severity → recommended solution → size → dependencies → required tests. Evidence citations point at [REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md) and [REAL_WORLD_SAAS_AUDIT.md](./REAL_WORLD_SAAS_AUDIT.md) for file:line detail.

---

### Gap 1 — No Vendor Master on the shipping branch
- **Current:** Vendor is a free-text field set per booking (`vendorName`, `vendorDriverName`, `vendorVehicleDetails`, `models/index.ts:172-178,442-448`).
- **Requirement:** A real taxi/travel business that outsources overflow trips needs one vendor directory, a running payable/receivable balance per vendor, commission calculation, and a duty roster that prevents double-booking a vendor's driver/vehicle.
- **Difference:** No master record exists; the same vendor's name can be typed differently across bookings with no de-dup or validation.
- **Operational impact:** Staff cannot answer "how much do we owe Vendor X this month" without manually totaling free-text bookings.
- **Financial impact:** Vendor payable/receivable reconciliation is entirely manual/off-system — a real risk of over- or under-paying a vendor.
- **Severity:** P0.
- **Solution:** Merge the already-built `feature/vendor-360-patch` branch (Vendor Master, Vendor Drivers/Vehicles, Vendor Duty, real time-window overlap checking) after re-verifying it against the current invoice/customer-360 work, since the branches diverged from different checkpoints.
- **Needs:** code merge + reconciliation, not a fresh build.
- **Size:** Medium (the feature exists; the work is merge + regression-test, not ground-up implementation).
- **Dependencies:** Resolve the divergent branch history (`feature/vendor-360-patch` branches from `main`@`be5ca9b`; the invoice work branches from `feature/customer-360-complete`@`f5c282a` — these have never been reconciled).
- **Tests required:** Existing `tests/e2e/vendor-master.spec.ts`, `vendor-drivers-vehicles.spec.ts`, `booking-vendor-fulfilment.spec.ts`, `vendor-duty.spec.ts` (already written on the other branch) plus a full regression run against the merged state.

---

### Gap 2 — No GPS / live vehicle tracking on the shipping branch
- **Current:** No location data anywhere in the schema or routes.
- **Requirement:** A dispatcher needs to see where a vehicle actually is to make assignment decisions and answer "where is my cab" customer queries.
- **Difference:** Total absence vs. a real operational necessity for a taxi/self-drive fleet SaaS.
- **Operational impact:** All dispatch decisions rely on driver phone calls / trust, not data.
- **Severity:** P0.
- **Solution:** A substantial, provider-neutral GPS foundation (tenant device/connection/assignment management, encrypted credentials, 4 e2e specs) already exists on `repair/full-saas-stabilization` and needs integration, not a fresh build.
- **Size:** Medium (integration + QA of existing ~1,500 lines of code).
- **Dependencies:** Same branch-reconciliation problem as Gap 1.
- **Tests required:** The 4 existing specs (`gps-connection-security`, `gps-device-master`, `gps-provider-registry`, `gps-vehicle-assignment`) plus new tests for actually surfacing live location on the dispatch/booking screens (not found on the GPS branch itself, since that branch only builds the device/connection layer, not a live map UI).

---

### Gap 3 — No vehicle document (RC/insurance/permit/fitness/PUC) expiry tracking
- **Current:** `VehicleSchema` has no expiry-date fields at all (`models/index.ts:335-360`).
- **Requirement:** A commercial fleet must not dispatch a vehicle with lapsed insurance, permit, or fitness certificate — this is a legal requirement in most jurisdictions, not just good practice.
- **Difference:** Complete absence of the concept.
- **Operational/legal impact:** A vehicle with expired insurance can be dispatched on a paid trip with zero system warning — real liability exposure if an accident occurs during that trip.
- **Severity:** P0.
- **Solution:** Add expiry-date fields (insurance, permit, fitness, PUC, registration) to `Vehicle`, a document-upload slot per field, and a dashboard "expiring this month" widget plus WhatsApp/email alert.
- **Size:** Medium (schema change + form fields + one new alerting query + one dashboard widget).
- **Dependencies:** None blocking; purely additive to the existing `Vehicle` model.
- **Tests required:** New e2e test creating a vehicle with a near-expiry document and asserting it surfaces on an alert list; regression on existing vehicle CRUD tests to confirm no unrelated fields broke.

---

### Gap 4 — No driver licence expiry tracking
- **Current:** `DriverSchema` captures `licenseNumber` only, no expiry date (`models/index.ts:363-388`).
- **Requirement:** Same legal-liability logic as Gap 3, for drivers.
- **Severity:** P1.
- **Solution:** Add `licenseExpiryDate` to `Driver`, surface on the same expiry-alert widget as Gap 3.
- **Size:** Small.
- **Dependencies:** None; can ship independently of Gap 3 or bundled with it.
- **Tests required:** New e2e test analogous to Gap 3's.

---

### Gap 5 — No driver cash-collection settlement screen
- **Current:** Cash collected by a driver is recorded per-booking (`paymentType:'driver_collection'` on the ledger), but there is no aggregate reconciliation view; Salary tab is a "Coming Soon" placeholder with the real prior implementation commented out (`dashboard.tsx:1690-1720`).
- **Requirement:** A fleet owner needs "driver X collected ₹18,500 in cash this month across 12 trips, owes ₹14,200 net of salary/advance" as a single screen.
- **Operational/financial impact:** This reconciliation currently has to happen entirely outside the system (spreadsheet), defeating the purpose of tracking collections at all.
- **Severity:** P1.
- **Solution:** Restore/finish the commented-out salary system, or build a dedicated `DriverSettlement` view that nets `driver_collection` ledger entries against a salary/advance figure.
- **Size:** Medium — some of this was apparently already built and then disabled; needs investigation before estimating build-vs-restore effort.
- **Dependencies:** None technical; needs a product decision on whether to restore the commented code or redesign.
- **Tests required:** New e2e test: record two driver_collection payments, assert the settlement view nets them correctly against a salary figure.

---

### Gap 6 — Stale `/api/vehicles/available` conflict check
- **Current:** Only excludes bookings with the single literal status `'confirmed'` and compares midnight-only dates (`storage-mongodb.ts:450-476`), unlike the driver equivalent which was already fixed to use the full 17-status-aware, time-accurate check.
- **Requirement:** The vehicle-selection dropdown in the booking form should only ever show genuinely free vehicles.
- **Difference:** A vehicle mid-trip (`status: 'ongoing'`, etc.) can appear "available" in this list.
- **Operational impact:** Staff pick a vehicle the UI said was free, then get a 409 rejection at save time (actual booking creation is still protected transactionally) — wasted re-entry and staff confusion, not a real double-booking.
- **Severity:** P1.
- **Solution:** Route `getAvailableVehicles` through the same `findVehicleConflicts`/`OCCUPYING_STATUSES`/`scheduledStartDateTime` logic already used everywhere else, and accept `pickupTime`/`returnTime` params (currently only accepts date).
- **Size:** Small — this is applying an already-proven pattern to one more function.
- **Dependencies:** None.
- **Tests required:** New e2e test mirroring the existing driver-availability test: create an `ongoing` booking, assert the vehicle does not appear in `/api/vehicles/available` for an overlapping window.

---

### Gap 7 — Missing permission enforcement on revenue/booking visibility (client-side-only access control)
- **Current:** `PERMISSIONS.VIEW_BOOKINGS`/`VIEW_REVENUE` exist and gate UI visibility (`use-permissions.ts:32-33`) and are deliberately excluded from a new manager's default permission set (`user-management.tsx:73-78`), but are never used as a server-side `requirePermission` gate anywhere (`GET /api/bookings`, `/api/reports/revenue`, `/api/dashboard/stats`, all 4 `/api/operations/*` routes).
- **Requirement:** A permission withheld in the UI must also be enforced on the API, or it isn't a real permission.
- **Difference:** A sub-user whose UI hides revenue can still call the API directly (their own authenticated session, no exploit needed) and get full tenant revenue/booking data.
- **Impact:** Access-control bypass for exactly the data (revenue, customer PII, payment-due amounts) a tenant admin most likely intended to restrict.
- **Severity:** P1.
- **Solution:** Add `requirePermission(PERMISSIONS.VIEW_BOOKINGS)`/`VIEW_REVENUE` to the listed routes.
- **Size:** Small (middleware wiring only, pattern already exists elsewhere in the same file).
- **Dependencies:** None; must confirm it doesn't break the default admin/client roles which should always pass.
- **Tests required:** New e2e test — log in as a manager with revenue view withheld, call the revenue/dashboard-stats endpoints directly, assert 403.

---

### Gap 8 — No permission gate on Expenses, Customer merge, or Rewards adjustment
- **Current:** Zero `requirePermission` on any `/api/expenses*` route (and `MANAGE_EXPENSES` doesn't exist as a constant); `POST /api/customers/merge` and `POST /api/customers/:id/rewards/adjust` are similarly ungated.
- **Requirement:** Financial-write and destructive actions should require an explicit permission, consistent with how vehicles/drivers/invoices are already gated.
- **Impact:** Any authenticated sub-user — even one intentionally scoped down at creation — can delete expense records (hiding fleet mismanagement), merge customer records, or adjust reward-point liability.
- **Severity:** P1/P2.
- **Solution:** Add a `MANAGE_EXPENSES` permission constant and gate the expense routes; gate customer-merge and rewards-adjust behind existing or new permission constants.
- **Size:** Small.
- **Dependencies:** None.
- **Tests required:** New e2e tests for each route, asserting a permission-less sub-user gets 403.

---

### Gap 9 — No idempotency on the primary payment-recording endpoint
- **Current:** `POST /api/bookings/:id/payments` never generates/forwards an `idempotencyKey`, though the schema and two other call sites already support one.
- **Requirement:** A double-click or network retry on "Record Payment" must not create two ledger rows for one real payment.
- **Impact:** Overstated `advanceReceived`/understated `balanceDue`, propagating into invoices.
- **Severity:** P2 (FINANCIAL RISK).
- **Solution:** Generate a client-side idempotency key per form submission, thread through to `recordPayment` the same way the two already-correct call sites do.
- **Size:** Small.
- **Dependencies:** None.
- **Tests required:** New e2e test — submit the same payment twice with the same idempotency key, assert only one `PaymentTransaction` row exists.

---

### Gap 10 — No pagination on Bookings/Expenses lists
- **Current:** `GET /api/bookings` and `GET /api/expenses` have no `.limit()`/page params at all, against a documented 200,000-booking-per-tenant design cap.
- **Requirement:** A mature tenant's Bookings screen must not attempt to transmit hundreds of thousands of populated documents on every page load.
- **Impact:** Page load time and memory usage degrade linearly and eventually unusably as a tenant's history grows; this is the single largest structural scalability gap found.
- **Severity:** P1.
- **Solution:** Add real page/limit/skip (or cursor) pagination to both endpoints and their consuming UI components.
- **Size:** Medium (backend + frontend list/table changes together).
- **Dependencies:** None technical; UI pagination controls need design input.
- **Tests required:** New e2e test seeding >1 page of bookings, asserting the list endpoint respects `limit`/`page` and the UI paginates correctly.

---

### Gap 11 — No centralized audit log; booking hard-delete leaves no trace
- **Current:** No audit/activity-log model exists; `DELETE /api/bookings/:id` does a hard `findOneAndDelete` with zero record of who/when.
- **Requirement:** "Who deleted this booking and when" must be answerable for a multi-tenant SaaS handling money and third-party services.
- **Impact:** No support/dispute/fraud-investigation trail for deletions.
- **Severity:** P1.
- **Solution:** Either soft-delete bookings (consistent with the existing `Customer.isDeleted` pattern) with `deletedBy`/`deletedAt`, or add a lightweight `AuditLogEntry` collection written on sensitive mutations (deletes, role changes, admin actions).
- **Size:** Medium.
- **Dependencies:** None blocking.
- **Tests required:** New e2e test — delete a booking, assert an audit trail record exists with actor/timestamp.

---

### Gap 12 — No in-app backup/export/restore
- **Current:** No backup, export, or restore route anywhere.
- **Requirement:** A hosted SaaS needs some in-app safety net beyond whatever the hosting/DB layer provides automatically, especially combined with Gap 11's no-audit-trail hard deletes.
- **Severity:** P1.
- **Solution:** At minimum, a tenant-scoped data-export endpoint (JSON/CSV dump of a tenant's own data) for offboarding and manual recovery; full point-in-time restore is a larger, infra-level project (e.g., relying on MongoDB Atlas continuous backups) rather than purely an application feature.
- **Size:** Medium for export; Large for true in-app restore (likely belongs at the infra/ops layer, not application code).
- **Dependencies:** Hosting/DB-provider capabilities for true restore.
- **Tests required:** New e2e test for the export endpoint's shape and tenant-scoping.

---

### Gap 13 — No SaaS subscription billing automation
- **Current:** Resource limits (vehicles/drivers/managers) are enforced; the billing loop is 100% manual (an admin edits plan/limits by hand).
- **Requirement:** For the SaaS vendor to actually collect recurring revenue without manual intervention per tenant.
- **Severity:** P1 (business-model-blocking, not a data/security risk).
- **Solution:** Integrate a payment gateway (Stripe/Razorpay) for recurring tenant billing, webhook-driven plan activation/suspension.
- **Size:** Large — this is a genuine new subsystem, not a patch.
- **Dependencies:** Business decision on gateway/pricing model.
- **Tests required:** New test suite for the billing webhook flow (trial→paid, failed payment→grace period→suspension).

---

### Gap 14 — No Quotation stage before Booking
- **Current:** No `Quotation` model/route; the workflow goes straight from a requirement/enquiry to a real `Booking`.
- **Requirement:** A travel agency typically issues 2–5 quotes before a customer commits; the agency needs to track which quotes didn't convert.
- **Severity:** P2 (process/data gap, not a risk).
- **Solution:** Add a lightweight `Quotation` model that can later convert into a `Booking`, carrying the same customer/requirement linkage already built for bookings.
- **Size:** Medium.
- **Dependencies:** None.
- **Tests required:** New e2e test for create-quote → convert-to-booking flow.

---

### Gap 15 — No multi-brand or multi-branch support
- **Current:** Zero brand/branch concept anywhere in the schema.
- **Requirement:** Larger operators run multiple brands or branches under one back office, needing bookings/vehicles/drivers scoped to the right brand/branch and managers restricted to their assigned branch.
- **Severity:** P2 (real gap for larger customers, not a defect for smaller single-branch tenants who are today's actual fit).
- **Solution:** See [MULTI_BRAND_BRANCH_AUDIT.md](./MULTI_BRAND_BRANCH_AUDIT.md) for the detailed design gap and recommendation.
- **Size:** Large — this is a genuine new dimension of scoping across most collections, not a small patch.
- **Dependencies:** Product decision on whether multi-branch is a near-term target market before investing here.
- **Tests required:** Full new test suite once designed.
