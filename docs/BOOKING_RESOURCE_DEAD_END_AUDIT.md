# Booking Resource Dead-End — Reproduction &amp; Root Cause

Direct reproduction of the reported bug, per spec §4. See [`FLEXIBLE_PIPELINE_CURRENT_AUDIT.md`](./FLEXIBLE_PIPELINE_CURRENT_AUDIT.md) for full file:line evidence; this doc is the acceptance-scenario-style reproduction record.

## Reproduction

1. Open Add Booking wizard, complete Step 1 (Customer), advance to Step 2 ("Vehicle & Service").
2. Set every company vehicle of the required category to `status: 'maintenance'` (or otherwise unavailable) for the selected date, OR simply pick a date/vehicle-category combination the dev fleet has none of.
3. `GET /api/vehicles/available?pickupDate=...&returnDate=...` returns `[]`.
4. UI renders (`enhanced-booking-form.tsx:1229–1236`): "No vehicles available for selected dates" — no other control, no vendor option, no outsource option, no "continue anyway."
5. Clicking Continue throws a destructive toast ("Please select a vehicle") and does not advance — confirmed at `enhanced-booking-form.tsx:1313–1338`.
6. **The booking is unrecoverable from this screen.** The only way out is to change the date/category (defeating the customer's actual need) or abandon the wizard entirely.

## Answering the 13 diagnostic questions from spec §4

| # | Question | Finding |
|---|---|---|
| 1 | Why is the company vehicle list empty? | Genuinely empty when no company vehicle of matching availability exists — this is not a bug in the "should return more" sense, it's a business reality the UI has no fallback for. |
| 2 | Are date/time values correct? | Times are silently dropped from the request (`enhanced-booking-form.tsx:284–293`) — a real but secondary bug; see audit doc §2. |
| 3 | Complete timestamps checked? | No — bare `pickupDate`/`returnDate` only (`storage-mongodb.ts:450–476`). |
| 4 | Vehicles incorrectly filtered? | No incorrect filter; `status: 'available'` + tenant scope is correct in intent, just date-imprecise. |
| 5 | Cancelled/completed bookings blocking resources? | No — only `status: 'confirmed'` bookings are excluded from availability, so cancelled/completed bookings never wrongly hold a vehicle. (Separately, non-`confirmed` occupying statuses are under-excluded — the opposite problem, out of scope, documented in the main audit.) |
| 6 | Branch/brand scope incorrect? | No branch/brand param exists at all; not a scoping bug, just an absent feature, out of scope. |
| 7 | Service type affecting the query? | No — endpoint takes no service-type/category param. |
| 8 | Vendor vehicles excluded? | Yes, entirely and only — `/api/vehicles/available` only ever queries the `Vehicle` (company) collection; `VendorVehicle` is a separate, fully-capable collection never consulted here. This is the real, actionable gap. |
| 9 | UI has no fallback route? | Confirmed — literal dead-end text, no CTA. |
| 10 | Next action disabled? | Not `disabled`-attribute, but functionally blocked via toast + no state change. |
| 11 | Backend requires a physical vehicle too early? | Yes — `vehicleId` is `required: true` at the Mongoose level and non-optional in the Zod schema; enforced at booking-creation time, not trip-start time. |
| 12 | Booking Draft creation depends on company fleet availability? | Yes, entirely — there is no draft-vs-confirmed distinction for this requirement; even a draft would need to pass the same Zod schema... except drafts use a separate, already-permissive `PUT /api/bookings/draft` path (`tests/e2e/booking-draft-persistence.spec.ts`) that stores arbitrary partial JSON and never validates against the strict booking schema. **So Save Draft already works without a vehicle today** — only the *confirmed* booking-creation path is blocked. This narrows the fix further: the real requirement is making `POST /api/bookings` (confirmed creation) accept a missing vehicle, not building new draft infrastructure. |
| 13 | Same logic used in Add and Edit Booking? | Both call the same `/api/vehicles/available` endpoint and the same wizard component for the vehicle-selection UI (edit reuses `EnhancedBookingForm`), so a fix to the shared component/endpoint fixes both without duplication. |

## Root cause (single sentence)

Vehicle fulfilment and customer-booking confirmation are currently the same atomic step — `POST /api/bookings` requires a real company `Vehicle._id` — so the *only* way to represent "customer has confirmed, resource still pending" is to not create the booking at all.
