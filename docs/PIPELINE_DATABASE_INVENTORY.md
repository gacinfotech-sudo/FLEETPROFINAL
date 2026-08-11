# Pipeline Database Relationship Inventory

All from `server/models/index.ts`. Booking model's own field table is already fully documented in `docs/BOOKING_CURRENT_STATE_AUDIT.md` §1 — this covers the cross-model relationships not previously catalogued.

## Relationship table

| Relationship | Field | Type | Required | Note |
|---|---|---|---|---|
| Booking → Customer | `customerId` | ObjectId ref `Customer` | Optional | Optional by design — pre-CRM bookings still work unmigrated. |
| Booking → Vehicle | `vehicleId` | ObjectId ref `Vehicle` | **Required** | |
| Booking → Driver | `driverId` | ObjectId ref `Driver` | Optional | |
| Booking → Vendor | *no ref* | plain `String`/`Number` fields (`vendorName`, `vendorContactPhone`, etc.) | — | **No Vendor model exists.** Explicit design comment: "Scoped-down stand-in for a full vendor master... not a ledger." |
| Booking → Lead | *absent* | — | — | Only the reverse direction exists: `Lead.linkedBookingId` (ObjectId ref `Booking`). |
| Booking → Quotation | *absent* | — | — | `Quotation.leadId` exists (required, ref `Lead`); no `quotationId` on Booking. |
| Booking → idempotencyKey | `idempotencyKey` | `String`, optional | Optional | **Added this phase** — partial unique index `{tenantId, idempotencyKey}`. |
| Expense → Booking | *absent* | — | — | `ExpenseSchema` has only `tenantId`+`vehicleId`. No `bookingId`/`driverId` field exists at all. |
| Expense → Vehicle | `vehicleId` | ObjectId ref `Vehicle` | **Required** | |
| Invoice → Booking | `bookingId` | ObjectId ref `Booking` | Optional | |
| Invoice → Customer | `customerId` | ObjectId ref `Customer` | **Required** | |
| Payment → Booking | `PaymentTransaction.bookingId` | ObjectId ref `Booking` | **Required** | Separate ledger model, not fields embedded in Booking. `Booking.advanceReceived`/`paymentStatus` are cached, ledger-derived, never written directly. |
| Feedback → Booking/Driver/Vehicle | `bookingId`, `driverId`, `vehicleId` | ObjectId refs, all optional | Optional | `CustomerFeedback` links all three simultaneously on one document. |
| Communication log → Customer/Booking/Lead/Quotation | `customerId`, `bookingId`, `leadId`, `quotationId` | ObjectId refs, all optional | Optional | `WhatsAppMessage` — proper refs throughout, none required. |
| Inquiry → Lead | `Lead.inquiryId` | ObjectId ref `Inquiry` | **Required**, unique compound index `{tenantId, inquiryId}` | Enforces one Lead per Inquiry. |
| Lead → Customer | `Lead.linkedCustomerId` | ObjectId ref `Customer` | Optional | Also back-filled onto `Inquiry.linkedCustomerId` at conversion. |

## Unusual findings

- **Booking→Vendor is entirely unstructured** (plain strings/numbers, no ref, no Vendor collection) — by explicit design, not oversight. A real vendor-settlement feature would require promoting this to a proper model (out of scope this phase, see Bug Report #12).
- **Booking has no upstream back-references** (`leadId`/`quotationId`) despite Lead/Quotation being upstream in the sales pipeline — only the forward direction (Lead→Booking) exists. Already flagged as an accepted gap in the prior initiative's `BOOKING_REAL_WORLD_GAP_ANALYSIS.md` ("Quotation ↔ Booking rate linkage... out of scope to deeply rewire").
- **Expense has zero Booking/Driver linkage** — vehicle-level only. Already scoped for a future additive change in `docs/TRIP_COSTING_DATA_MAPPING.md`.

## Snapshot vs. live-reference (financial/historical records)

`Invoice`'s `customerSnapshot`/`billingSnapshot`/`businessSnapshot`/`bookingSnapshot` (all `Schema.Types.Mixed, required: true`) are built once at generation time by `invoiceService.loadContext()` and stored as plain data — **not** live-populated references. Confirmed: once `finalizeInvoice()` runs, no code path re-derives these from live Customer/Vehicle data; editing a Customer's name later has zero effect on a finalized invoice. `Quotation` uses the same convention (`vehicleNameSnapshot` per option). This is correct, intentional design — no action needed.

## Status-transition validators (all centralized, all correct)

| Model | Validator | Enforcement point |
|---|---|---|
| Booking | `server/services/bookingStateMachine.ts` (`ALLOWED_TRANSITIONS`, `TERMINAL_STATES`) | Sole entry point `transitionBooking()`, called only from `POST /api/bookings/:id/status`. Generic `PUT /api/bookings/:id` explicitly rejects any `status` field. |
| Invoice | `invoiceService.finalizeInvoice()` | Requires `status==='draft'`, idempotent on repeat finalize, hard-blocks any edit (`updateInvoiceDraft`) once finalized. |
| Lead | `server/services/leadStatus.ts` (`ALLOWED_TRANSITIONS`) | `assertValidLeadTransition()`, enforced before every write. |
| Inquiry | `server/services/inquiryStatus.ts` | Same pattern, with an explicit `lost → contacted` reopen exception. |
| Quotation | `server/services/quotationStatus.ts` | Same pattern. |

No raw `.status = req.body.status` bypass found for any of the four.

## Idempotency mechanisms (post-repair state)

| Route | Mechanism |
|---|---|
| `POST /api/bookings` | **Added this phase**: optional client-supplied `idempotencyKey`, partial unique index, pre-check + race-safe duplicate-key catch. |
| Trip-start / Trip-complete | Already idempotent via the state machine's no-op-on-same-status behavior. |
| `POST /api/bookings/:id/payments` | **Added this phase**: `idempotencyKey` now accepted and forwarded to the already-idempotency-capable `recordPayment()` service. |
| `POST /api/invoices/:invoiceId/finalize` | Already idempotent (returns unchanged if already finalized). |
| WhatsApp sends (booking, quotation, Google review, custom templates) | Already idempotent via deterministic per-event keys + partial unique index. |
| `reversePayment`, reward-point transactions | Already idempotent via deterministic keys + unique indexes. |

## "Safe patch" audit — no wholesale overwrite pattern found

Vehicle/Driver updates go through a Zod `.partial()` schema (unknown keys stripped) applied as a Mongoose partial `$set`. Booking additionally rejects `status` outright and strips `advanceReceived` (and now `idempotencyKey`) post-parse. Customer uses an explicit field allowlist. Invoice updates are blocked entirely once finalized and only touch a fixed set of draft-editable fields. No `Object.assign(doc, req.body)` / `record = req.body` pattern exists anywhere in the 5 audited update routes.
