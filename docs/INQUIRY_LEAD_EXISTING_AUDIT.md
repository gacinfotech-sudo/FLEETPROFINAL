# Inquiry/Lead/Quotation/Booking — Existing-Code Audit

**Branch:** `feature/inquiry-lead-booking-zero-overlap`, based on `feature/customer-invoice-system` @ `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`.
**Mode:** additive-only. This document records what exists today so the new Inquiry→Lead→Quotation→Customer→Booking workflow extends it rather than duplicating or conflicting with it.

## Headline finding: no Inquiry/Lead/Quotation entity exists today

There is no `Inquiry`, `Lead`, or `Quotation` model, route, or UI component anywhere in the codebase. The closest existing concepts are:

- **`Booking.status` already has `'enquiry'` and `'quotation_sent'`** as the first two of its 17 statuses (`server/services/bookingStateMachine.ts:58-76`). Today's "pre-sales pipeline" is modeled as early states of a real `Booking` document, not a separate pre-booking entity — a real `Booking` (with a real `vehicleId`, required) is created the moment someone starts capturing an enquiry. This is the single biggest structural gap the new system fixes: a genuine Inquiry (a phone call that may never become a trip) forces a premature, vehicle-required Booking record today.
- **`CustomerRequirement`** (`server/models/index.ts:1523-1592`) — an append-only, versioned snapshot of "what the customer asked for" (route, passengers, vehicle category, driver preference, AC, instructions), always attached to a `Customer`, optionally to a `Booking`. This already covers most of the new spec's §9 "Detailed Customer Requirement Form" fields. **The new Inquiry model reuses this vocabulary rather than re-inventing it** — see [INQUIRY_BOOKING_FIELD_INVENTORY.md](./INQUIRY_BOOKING_FIELD_INVENTORY.md).
- **`CustomerFollowUp`** (`server/models/index.ts:1406-1443`) — a *post-trip, after-sales* task list (auto-created on booking completion), not a pre-sales lead-nurturing queue. Distinct purpose from the new spec's `LeadFollowUp` — kept separate, not reused, to avoid conflating after-sales care tasks with sales-pipeline follow-ups.
- **No Quotation, no Quotation PDF, no Vendor/VendorDriver/VendorVehicle model** exist on this branch (Vendor fulfilment is flat string fields on `Booking` — `server/models/index.ts:169-178,441-448`).

## Existing infrastructure the new system will reuse (not duplicate)

| Need | Existing infrastructure | File:line |
|---|---|---|
| Customer exact-phone lookup | `GET /api/customers/lookup?phone=` | `server/routes.ts:3220-3247` |
| Customer general search | `GET /api/customers?search=` | `server/routes.ts:2441-2476` |
| Phone normalization | `normalizeIndianPhone()` | `server/whatsapp/phone.ts:5-19` |
| Find-or-create customer | `findOrCreateCustomer()` | `server/services/customerService.ts:28-66` |
| Driver conflict check | `findDriverConflicts()` | `server/services/availability.ts:82` |
| Vehicle conflict check | `findVehicleConflicts()` | `server/services/availability.ts:68` |
| Driver leave conflict check | `findDriverLeaveConflicts()` | `server/services/availability.ts:103` |
| Combined driver availability | `checkDriverAvailability()` | `server/services/availability.ts:129` |
| Customer 360 view | `customer-dashboard.tsx` + related components | `client/src/components/customers/` |
| WhatsApp text send (booking-scoped) | `sendBookingMessage()` | `server/whatsapp/sendBookingMessage.ts:26` |
| Client-side PDF generation pattern | off-screen React render → `html2pdf()` | `client/src/components/booking/booking-communication.tsx:18-49` |

## Gaps the new system must fill (new infrastructure, not reuse)

1. **No `checkVehicleAvailability` wrapper** — only the lower-level `findVehicleConflicts` exists; callers check `.length === 0` themselves. The new centralized Availability Service adds this wrapper rather than duplicating the conflict query.
2. **No buffer/grace-period concept** in any existing availability check — pure strict interval overlap. Reporting/return/rest buffers are entirely new logic.
3. **`OCCUPYING_STATUSES`** (`availability.ts:27-30`) does not include `enquiry`/`quotation_sent`/`tentative`/`on_hold` — a quotation or tentative hold does not block a resource today. The new `ResourceReservation` (tentative hold) model is genuinely new, not a relabeling of an existing mechanism.
4. **No Vendor Master** — Vendor resource-overlap checking (spec §33) has no underlying entity to check against on this branch. This mirrors the same gap already documented in the prior full-repo audit ([REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md) §Vendors) and is **not solved by this patch** — Vendor availability rules are stubbed/deferred until the Vendor Master branch is merged (see [RECOMMENDED_IMPLEMENTATION_ROADMAP.md](./RECOMMENDED_IMPLEMENTATION_ROADMAP.md) Phase 0).
5. **No server-side PDF generation** — Quotation PDF must follow the client-side `html2pdf()` pattern already used for duty slips/invoices; there is no server PDF pipeline to extend.
6. ~~**WhatsApp send is text-only**~~ — **Done in Phase 11.** `WhatsAppProvider.sendDocument()` now exists (both `MockProvider` and `BaileysProvider`), wired into `sendQuotationMessage.ts` and a new `POST /api/quotations/:id/send-whatsapp-pdf` route. See `docs/INQUIRY_BOOKING_TEST_REPORT.md` Phase 11.
7. **No draft/wizard concept on `Booking`** at all (confirmed by direct schema read) — a multi-step, resumable Booking Wizard needs its own persistence, not a `Booking.draft` flag that doesn't exist.

## Existing status values (verbatim, for compatibility mapping)

See [INQUIRY_LEAD_STATUS_MAPPING.md](./INQUIRY_LEAD_STATUS_MAPPING.md) for the full mapping between the new Inquiry/Lead statuses and these existing values.

- **Booking.status** (17): `enquiry, quotation_sent, tentative, on_hold, confirmed, vehicle_assigned, driver_assigned, ready_for_dispatch, trip_started, ongoing, extended, return_pending, completed, payment_pending, closed, cancelled, no_show`
- **Vehicle.status** (3): `available, on_trip, maintenance`
- **Driver.status** (3): `available, on_duty, inactive`
- **DriverLeave.status** (4): `pending, approved, rejected, cancelled`
- **CustomerFollowUp.status** (7): `pending, contacted, follow_up_required, resolved, closed, no_response, do_not_contact`

## Existing permission keys (verbatim — new keys must not collide)

```ts
CREATE_BOOKING, DELETE_BOOKING, EDIT_BOOKING, VIEW_BOOKINGS, GENERATE_INVOICE,
MANAGE_VEHICLES, MANAGE_DRIVERS, VIEW_REVENUE, MANAGE_USERS, MANAGE_CAMPAIGNS,
MANAGE_INVOICE_SETTINGS
```
(`server/middleware/permissions.ts:45-57`)

## Existing sidebar / dashboard view registration points (must be extended, not replaced)

- `client/src/components/layout/sidebar.tsx:13-35` — `navItems` array (20 existing ids)
- `client/src/pages/dashboard.tsx:50` — `ViewType` union
- `client/src/pages/dashboard.tsx:105` — `allowedSections` array
- `client/src/pages/dashboard.tsx:114` — `restrictedSections` array (manager exclusions)

New view ids added by this patch (`inquiries`) are confirmed non-colliding with the existing 21.

## Scope decision for this patch (Phase 1)

Given the size of the full spec (Inquiry, Lead, Quotation+PDF+WhatsApp, Follow-ups, one-click conversions, a fully rebuilt Booking Wizard with draft persistence, and a centralized zero-overlap Availability Engine with buffers and transactional resource reservations), this is being delivered as a sequence of safe, independently-tested patches, per the spec's own "one minimal backward-compatible patch at a time" instruction. **Phase 1 (this patch)** delivers: the `Inquiry` model, Inquiry CRUD + qualify + convert-to-lead-marker API, the Quick Inquiry form, an Inquiries list view, and integration with the existing customer-lookup endpoint. Later phases (Lead/Quotation/PDF/WhatsApp-attachment/Booking Wizard/Availability Engine with buffers and reservations) are scoped in [RECOMMENDED_IMPLEMENTATION_ROADMAP.md](./RECOMMENDED_IMPLEMENTATION_ROADMAP.md) and will follow the same audit→implement→test→report cycle.
