# Booking — Current State Audit

Full-repository read, not a summary of assumptions. Covers the `Booking` Mongoose model, the Add-Booking wizard (`enhanced-booking-form.tsx`), and the separate Edit-Booking form. This document records facts only — see `docs/BOOKING_REAL_WORLD_GAP_ANALYSIS.md` for the classified action matrix and `docs/AUTONOMOUS_PENDING_TASKS.md` for what's planned in response.

## 1. Booking model (`server/models/index.ts`, `IBooking` lines 102-257, schema 391-557)

| Group | Fields | Notes |
|---|---|---|
| Identity/tenancy | `tenantId`, `bookingId` (unique), `customerId?`, `customerName`, `customerPhone`, `customerEmail?` | `customerId` optional — pre-CRM bookings can exist without it |
| Vehicle/driver | `vehicleId` (required), `driverId?` | |
| Route | `pickupLocation` (required), `dropoffLocation?`, `additionalStops?: string[]` | `additionalStops` is **only** ever written by the Extend-Booking flow, never by Add/Edit — no structured, ordered itinerary exists |
| Schedule | `pickupDate` (required), `returnDate?`, `pickupTime?`, `returnTime?`, `scheduledStartDateTime`/`scheduledEndDateTime` (auto-derived), `actualStartDateTime?`/`actualEndDateTime?` (set only by Start/Complete Trip actions) | |
| Odometer/KM | `startOdometer?`, `endOdometer?`, `totalKilometers?` | **No** estimated-vs-actual split, no GPS field, no photo field, no variance/reconciliation logic anywhere (confirmed by full-repo grep) |
| Source | `bookingSource` (17-value enum, default `direct_customer`), `sourceName/Contact/CommissionType/CommissionAmount/ReferenceNumber/Notes` | |
| Fulfilment/vendor | `fulfilmentType` (`own\|vendor`), `vendorName/ContactPhone/DriverName/DriverPhone/VehicleDetails/AgreedRate/AdvancePaid` | |
| Type/pricing/status | `bookingType` (6-value enum), `pricingType` (`day\|km`, default `day`), `status` (17-value state machine), `statusHistory[]` | **No** `ratePerKm`/`ratePerDay`/`minimumKm`/`extraKmRate`/rate-source field on Booking itself |
| Money | `totalAmount`, `originalAmount?`, `rewardPointsRedeemed/DiscountApplied`, `advanceReceived` (ledger-derived cache), `advanceRequested`, `driverCollectionAmount`, `collectionMode`, `paymentStatus` | |
| Trip-cost fields on Booking | `tollCharges`, `parkingCharges`, `petrolCharges`, `dieselCharges`, `cngCharges`, `miscellaneousAmount`, `miscellaneousDescription` | Staff-entered numbers in the booking form itself — **not** records in the separate `Expense` collection, not linked to it in any way |
| Third-party driver | `useThirdPartyDriver`, `thirdPartyDriverName/Charges/Phone/Address` | Present in schema; confirmed **dead in the UI** — never rendered in any of the 4 wizard steps |
| Other | `customerDiscussionSummary?`, `notes?`, `cancellationReason?/Type?`, `createdBy`, `createdAt`, `extensionHistory[]`, `rescheduleHistory[]` | |

**GST/tax: not on Booking at all.** Confirmed by grepping the full interface — zero tax fields. GST only exists on `Customer.gstNumber` and the separate `Invoice` model, computed only when an invoice is generated.

**`BookingDraft`** (separate collection, lines 2499-2525): per-`(tenantId, userId)` autosave of the wizard's `step`+`formData`, already built (Phase 8 of the prior Inquiry/Lead initiative).

## 2. Add-Booking wizard (`client/src/components/booking/enhanced-booking-form.tsx`, 2324 lines)

4 fixed steps, no accordion/advanced-section concept — visibility is binary per field (shown or not), never collapsed-by-default within a step:

1. **Trip Details & Schedule** — dates/times, a 3-way Route Type toggle (`custom | local | not_decided`, auto-fills `dropoffLocation`+`tripType`), `pickupLocation` (plain text, no autocomplete), `dropoffLocation` (only shown for "custom"), `tripType` tile-select.
2. **Vehicle & Service** — `bookingType` radio cards, a vehicle grid from `/api/vehicles/available` with per-vehicle "By Day"/"By Kilometer" buttons, `driverId` select (only when `with_driver`) from `/api/drivers/available`.
3. **Customer Information** — name/phone/email, `bookingSource` (17 values), a vendor/agent sub-block only for external source types, notes.
4. **Review & Confirm** — read-only summary, `totalKilometers` (km pricing only), `amount` (always editable), toll/parking, fuel charges block, misc expense block, advance-payment block, driver-collection fields, reward-points redemption, computed remaining balance.

**No multi-stop/itinerary UI** — `additionalStops` never appears in this file. **No route-template/frequent-route quick-select** (the 3-way toggle only changes this one booking's dropoff text, nothing reusable/saved). **No Maps/distance-estimation integration anywhere in the codebase** (confirmed by repo-wide grep for `google.maps`, `DistanceMatrix`, `Geocoding`, `Autocomplete` — zero hits).

**Draft persistence**: already works (autosave every 1200ms to `BookingDraft`, "Resume your unfinished booking?" prompt) — but deliberately disabled when `initialValues` is supplied (the Lead-conversion path), by design, from the prior phase.

## 3. Edit Booking is a completely different, much smaller form

This is the single most important finding for the "which fields differ between Add and Edit" question the spec asks about.

`EnhancedBookingForm` (the 4-step wizard above) is used **only** for creating a new booking and for the Lead→Booking conversion prefill. Editing an existing booking uses an entirely separate, single-page, non-wizard `<form>` defined inline in `client/src/pages/dashboard.tsx` (Dialog, lines 2688-2905, opened via `setShowEditBookingForm(true)`).

The Edit form exposes **only**: `customerName`, `baseAmount`, `tollCharges`, `parkingCharges`, `petrolCharges`, `dieselCharges`, `cngCharges`, `thirdPartyDriverCharges/Name/Phone/Address`.

It **cannot edit**: pickup/dropoff location, dates/times, vehicle, driver, booking source, or advance payment at all — none of those fields appear in the Edit dialog. (A separate, narrower reschedule/reassign path exists via `PUT /api/bookings/:id` for date/vehicle/driver changes specifically, with its own conflict-check logic — but it's not exposed through this Edit dialog's UI.)

## 4. Route template / frequent route / package concept

**Does not exist as a reusable entity anywhere.** The only adjacent thing is a read-only, per-customer `Customer.preferredRoute` string (`server/models/index.ts:929`), computed by `recomputeCustomerStats()` as the single most-frequent `"pickup → dropoff"` pair across that customer's own bookings (plain frequency count, no recency weighting, no pricing attached). It's displayed once, read-only, in Customer 360 (`customer-dashboard.tsx:423`) and used for two hardcoded segment-filter regexes (`'Ujjain'`/`'Omkareshwar'`) in `segmentService.ts`. It is never surfaced in, or fillable into, the booking form.

## 5. Driver expense tracking

A general `Expense` model exists (`server/models/index.ts`, `IExpense` lines 259-272) — `tenantId`, `vehicleId` (required), `category` (`maintenance|damage|tires|fuel|other`), `amount`, `date`, `description?`, `attachmentUrl?`, `createdBy`, `createdAt`.

**It has no `bookingId`, no `driverId`, no `tripId` field at all** — it is a per-vehicle general business-expense ledger, entirely unrelated to individual trips. **No approval workflow, no customer-chargeable flag** exist on this model. **No driver-submission path exists** — the only consumer is a fleet-manager-facing CRUD page (`manage-expenses.tsx`); there is no driver app/portal anywhere in the codebase (grepped, zero hits).

The booking-level `tollCharges`/`parkingCharges`/`petrolCharges`/`dieselCharges`/`cngCharges`/`miscellaneousAmount` fields (§1) are a completely separate, unrelated concept from this `Expense` model.

## 6. GPS/odometer photo/reconciliation

None of this exists. `startOdometer`/`endOdometer` are plain optional numbers, set verbatim from the `POST /:id/start` / `POST /:id/complete` request bodies with **no validation against `totalKilometers`, no min/max sanity check, no comparison to any GPS-derived distance, no variance flag**. The only "photo" field anywhere in the schema belongs to `Customer` (profile photo), unrelated to trips.
