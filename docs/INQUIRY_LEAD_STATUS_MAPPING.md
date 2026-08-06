# Inquiry / Lead Status Mapping

Centralized mapping — used by exactly one compatibility module (`server/services/inquiryStatus.ts`, added in Phase 1) so no other file invents its own status logic, per the spec's "do not use different upcoming-booking-style logic in different components" principle applied to statuses.

## Inquiry statuses (new, Phase 1)

```ts
type InquiryStatus =
  | "new" | "unverified" | "contact_attempted" | "contacted"
  | "requirement_pending" | "requirement_completed" | "qualified"
  | "converted_to_lead" | "future_follow_up" | "duplicate" | "invalid"
  | "lost" | "cancelled";
```

Terminal states (no further transition, mirroring the existing `Booking` state machine's `TERMINAL_STATES` pattern at `server/services/bookingStateMachine.ts:83`): `converted_to_lead`, `duplicate`, `invalid`, `lost`, `cancelled`.

Default on creation: `"new"`.

## Relationship to existing `Booking.status` `'enquiry'`/`'quotation_sent'` values

These are **not** the same field and this patch does not touch `Booking.status` or its enum. `Booking.status: 'enquiry'`/`'quotation_sent'` continue to mean exactly what they mean today (an early-stage Booking document already has a real, required `vehicleId`). The new `Inquiry` model exists **before** any `Booking` document is created — it is deliberately a separate, lighter-weight record precisely so office staff can log a phone call that may never need a vehicle at all, without the current forced early creation of a full `Booking` row. When (and only when) an Inquiry is ready to become a real trip, the existing booking-creation flow is used unchanged to create the `Booking`, and at that point `Booking.status` starts at whatever the existing default/flow already produces (`server/models/index.ts:465`: default `'confirmed'`) — this patch does not change that default.

## Lead statuses (Phase 2, not implemented in Phase 1 — recorded here for the full mapping picture)

```ts
type LeadStatus =
  | "new" | "assigned" | "requirement_completed" | "quotation_draft"
  | "quotation_under_review" | "quotation_sent" | "follow_up_due"
  | "negotiation" | "customer_confirmed" | "converted_to_customer"
  | "converted_to_booking" | "future_requirement" | "lost" | "cancelled";
```

## Full lifecycle mapping table

| Business stage | Entity | Status field | Value(s) |
|---|---|---|---|
| Raw inquiry | `Inquiry` | `status` | `new` → `contact_attempted` → `contacted` |
| Requirement capture | `Inquiry` | `status` | `requirement_pending` → `requirement_completed` |
| Qualified | `Inquiry` | `status` | `qualified` |
| Converted | `Inquiry` | `status` | `converted_to_lead` (terminal on the Inquiry; the Inquiry record itself is never deleted — see §10 of the main spec, "keep the original Inquiry record") |
| Lead pipeline (Phase 2) | `Lead` | `status` | `new` → `assigned` → `quotation_*` → `negotiation` → `customer_confirmed` |
| Customer link | `Customer` | *(no new status)* | existing `Customer.customerStatus`/`status` fields untouched |
| Booking | `Booking` | `status` | existing 17-value enum, completely untouched by this patch |

## Compatibility rule

`server/services/inquiryStatus.ts` (Phase 1) exports `isTerminalInquiryStatus(status)` and `getAllowedNextInquiryStatuses(status)`, mirroring the exact shape of the existing `isValidStatus`/`getAllowedNextStatuses` pattern in `bookingStateMachine.ts:129-134`, so the same architectural pattern is reused for consistency rather than inventing a different state-machine style for Inquiries.
