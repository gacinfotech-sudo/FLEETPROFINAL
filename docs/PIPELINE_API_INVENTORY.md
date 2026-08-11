# Pipeline API Inventory — Pipelines A-D, I-L, O, P, Q, R, S

Endpoints newly catalogued by this audit (Booking/Customer/Invoice-core endpoints already catalogued in the prior initiative's docs).

## Inquiry → Lead → Quotation → Customer (A-D)

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /api/inquiries` | Create inquiry | Never auto-creates a Customer; normalizes phone via `normalizeIndianPhone`. |
| `GET /api/customers/lookup?phone=` | Existing-customer check | Called from the Quick Inquiry form on mobile blur. |
| `POST /api/inquiries/:id/convert-to-lead` | Inquiry → Lead | Two-layer idempotency guard (`status==='converted_to_lead'` check + `Lead.findOne` check), transaction-wrapped. |
| `POST /api/leads/:leadId/quotations` | Create quotation | Does **not** auto-fill Inquiry's requirement fields into the option form (display-only use of the Inquiry). |
| `POST /api/quotations/:id/send-whatsapp` | Send quotation | Real Baileys provider by default; failure is a real HTTP 400, `quotation.status` not flipped to `'sent'` on failure. |
| `POST /api/quotations/:id/accept` | Accept quotation | Only place `Lead.status` auto-transitions (`→ 'customer_confirmed'`), best-effort (invalid-transition errors swallowed). |
| `POST /api/leads/:id/convert-to-customer` | Lead → Customer | Calls the shared `findOrCreateCustomer` (not a duplicate implementation); idempotent via `lead.linkedCustomerId` check. |

## Driver Duty → Trip lifecycle (I-L)

| Endpoint | Purpose | Notes |
|---|---|---|
| `PUT /api/bookings/:id` (driver field change) | Triggers driver-duty WhatsApp | `messageType: 'driver_duty'`, unconditional customer-contact/collection-amount visibility (no driver auth exists to gate against). |
| `POST /api/bookings/:id/start` | Trip start | Odometer optional, no photo fields exist, server-derived timestamp, idempotent (no-op on repeat). |
| `POST /api/bookings/:id/complete` | Trip end | Odometer optional; `totalKilometers` NOT recomputed from odometer here (stays whatever was set at booking time). |
| `POST /api/expenses` | Record expense | Vehicle-scoped only — accepts no `bookingId`. |
| `GET /api/operations/live-bookings` | Live Ops board | Buckets by status; `trip_started` immediately appears in the `ongoing` bucket. |

## Payment / Vendor / Feedback-Rewards (O, Q, P)

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /api/bookings/:id/payments` | Record payment | **Idempotency added this phase** (Bug Report #3). |
| `POST /api/bookings/:id/payments/:paymentId/reverse` | Reverse payment | Already idempotent, admin/client only. |
| `POST /api/bookings/:id/assign-vendor` | Outsource to vendor | Writes plain fields on Booking, no Vendor model. |
| `GET/POST /api/customers/:id/complaints` | Complaint | Distinct from Feedback; resolution can create a real refund (`PaymentTransaction`) or reward-points compensation, both idempotency-keyed to the complaint. |
| `POST /api/customers/:id/google-reviews/request` | Google review request | Idempotent on exact `requestId` retry only, not per-booking (Bug Report #11). |

## WhatsApp / Calling / Routes / Permissions (R, S, and cross-cutting)

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /api/bookings/:id/whatsapp/send` | Booking WhatsApp | Idempotent via `${tenantId}_${bookingId}_${messageType}_${recipientPhone}_v${booking.__v}`. |
| `GET /api/reports/revenue` | Revenue report | **Permission check added this phase** (Bug Report #1). |
| `GET /api/reports/driver-performance` | Driver performance | Same fix. |
| `GET /api/reports/vehicle-performance` | Vehicle performance | Same fix. |
| `DELETE /api/users/sub-users/:userId` | Deactivate manager | **`requireTenant` added this phase** (Bug Report #4). |
| `PATCH /api/users/sub-users/:userId/reactivate` | Reactivate manager | Same fix. |

No telephony/calling provider integration exists anywhere (confirmed by repo-wide grep — zero real hits). No driver-facing API surface exists (no `driver` role, no driver auth routes).
