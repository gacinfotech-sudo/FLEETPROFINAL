# Pipeline Action Matrix

Actions verified end-to-end (UI → API → DB → connected modules) this session, either newly built/repaired or spot-checked as part of this audit. This is **not** an exhaustive click-through of every button in the application — that would require a dedicated, much larger pass. It covers every action this audit's research and repair work actually touched or verified, honestly scoped rather than overclaimed.

| Page | Label | API | Permission | Expected result | Actual result | Status | Severity |
|---|---|---|---|---|---|---|---|
| Revenue Report | (page load) | `GET /api/reports/revenue` | `view_revenue` | Manager without permission blocked; owner sees data | **Was**: any authenticated user got data regardless. **Now**: 403 for unauthorized manager, 200 for owner. | FIXED | P0 |
| Driver Performance | (page load) | `GET /api/reports/driver-performance` | `view_revenue` | Same as above | Same fix applied | FIXED | P0 |
| Vehicle Performance | (page load) | `GET /api/reports/vehicle-performance` | `view_revenue` | Same as above | Same fix applied | FIXED | P0 |
| Add Booking wizard | "Confirm Booking" | `POST /api/bookings` | `create_booking` | One click → one booking, even under double-submit/retry | **Was**: two clicks/retries → two bookings. **Now**: same `idempotencyKey` → same booking returned. | FIXED | P0 |
| Customer 360° / Booking detail | "Record Payment" | `POST /api/bookings/:id/payments` | `edit_booking` | One submit → one ledger entry | **Was**: retry could double-record. **Now**: idempotency-keyed per dialog session. | FIXED | P0 |
| Invoice Document dialog | "Finalize & Lock" | `POST /api/invoices/:invoiceId/finalize` | `generate_invoice` | Disabled+tooltip if unauthorized, else works | **Was**: always enabled, 403 after click for unauthorized users. **Now**: disabled with explanation. | FIXED | P2 |
| Manage Users | Deactivate/Reactivate sub-user | `DELETE`/`PATCH /api/users/sub-users/:userId` | admin/client inline check | Tenant-scoped | Hardened with `requireTenant` (narrow edge case) | FIXED | P2 |
| Customer Database | Global Customer Search (Sidebar) | `GET /api/customers?search=` | — | Find existing customer, open 360° | Verified working (prior phase, regression-tested again this phase) | WORKING | — |
| Customer 360° | "New Booking" / "Use as template" | reuses `EnhancedBookingForm.initialValues` | — | Correct prefill scope (identity only / route+notes only) | Verified working | WORKING | — |
| Customers list | Unknown-number search | `GET /api/customers`, `QuickInquiryForm` | — | "Create Quick Inquiry" CTA with number prefilled | Verified working | WORKING | — |
| Inquiries / Leads list | Pagination | `GET /api/inquiries` / `/api/leads` (`limit`/`skip`) | — | Correct page-of-50 + total count | Verified working | WORKING | — |
| Inquiry → Lead | "Convert to Lead" | `POST /api/inquiries/:id/convert-to-lead` | `inquiry.convert_to_lead` | One Inquiry → one Lead, no data re-entry | Verified via code audit: two-layer idempotency guard, transaction-wrapped, requirement fields read live (not duplicated) | WORKING | — |
| Lead → Quotation | "Send via WhatsApp" | `POST /api/quotations/:id/send-whatsapp` | `quotation.send` | Real provider send, failure surfaced, no false "sent" status | Verified via code audit: real Baileys provider, failure returns HTTP 400 and does not flip status | WORKING | — |
| Lead → Customer | "Convert to Customer" | `POST /api/leads/:id/convert-to-customer` | `lead.convert_to_customer` | Reuses shared dedup logic, one-time only | Verified via code audit: shared `findOrCreateCustomer`, `linkedCustomerId` idempotency guard | WORKING | — |
| Booking → Driver Duty | Driver-assignment WhatsApp | `sendBookingMessage` (`driver_duty` type) | — | Driver notified with itinerary | Verified working (sends), but no acceptance step and no driver portal exists to view it in-app — WhatsApp-message-only | PARTIALLY_WORKING | documented, not fixed (#6) |
| Trip Start/Complete | `POST /api/bookings/:id/start` / `/complete` | — | `edit_booking` (via general booking permission) | Idempotent, correct status transition | Verified via code audit: no-op on repeat status | WORKING | — |
| Google Review request | "Send Review Request" | `POST /api/customers/:id/google-reviews/request` | — | No duplicate charge/points; UI should prevent duplicate requests per booking | Idempotent for exact retry; UI does not disable after first request (button only disables once *received*) | PARTIALLY_WORKING | documented, not fixed (#11) |

## Not audited at the action level this phase

Vendor settlement UI (no such feature exists — confirmed absent, not "broken"), driver-facing UI (does not exist — no driver role/portal), telephony/calling UI (no provider integration exists), WhatsApp Settings/connection panel deep-dive, Campaigns, After-Sales, Salary pages. These were not implicated by any of the 5 research passes' findings and were left untouched per the "smallest safe patch" principle — auditing them exhaustively would be a separate, dedicated pass.
