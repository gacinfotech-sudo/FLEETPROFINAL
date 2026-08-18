# Inquiry / Booking Field Inventory

Maps the new spec's requested Inquiry fields against what already exists on `CustomerRequirement` and `Booking`, so the new `Inquiry` model reuses existing vocabulary instead of duplicating it.

## Fields already covered by `CustomerRequirement` (server/models/index.ts:1523-1592) — reused, not duplicated

| Spec field (§9) | Existing `CustomerRequirement` field |
|---|---|
| Route / itinerary | `route`, `multipleStops[]` |
| Pickup/drop requirements | `pickupRequirements`, `dropRequirements` |
| Passenger count | `numberOfPassengers` |
| Luggage | `luggage` |
| Hotel details | `hotelDetails` |
| Train/flight details | `trainFlightDetails` |
| Senior citizen / child / wheelchair | `seniorCitizenRequirement`, `childRequirement`, `wheelchair` |
| Darshan/temple timing | `templeTiming`, `darshanTiming` |
| Vehicle category | `vehicleCategory` |
| Driver preference | `driverPreference` |
| Language preference | (new — `CustomerRequirement` has no language field; added on `Inquiry`) |
| AC requirement | `acRequirement` |
| Payment arrangement | `paymentArrangement` |
| Toll/parking agreement | `tollParkingAgreement` |
| Included/excluded services | `includedServices[]`, `excludedServices[]` |
| Customer-visible instructions | `customerVisibleInstructions` |
| Driver instructions | `driverInstructions` |
| Office-only notes | `officeOnlyNotes` |
| Billing instructions | `billingInstructions` |

**Decision:** the `Inquiry` model's requirement-capture fields are a superset built from this same vocabulary (field names kept identical where the concept matches) plus the additional Inquiry-specific fields below that `CustomerRequirement` doesn't have (it's a customer-level snapshot, not a pipeline-stage record). When an Inquiry converts to a real booking with a linked customer, its requirement fields can be copied into a new `CustomerRequirement` row using the existing `POST /api/customers/:id/requirements` route — no schema change to `CustomerRequirement` needed.

## Fields new to `Inquiry` (not present anywhere else)

- Pipeline/lifecycle: `status`, `priority`, `assignedExecutive`, `nextFollowUpAt`
- Source attribution (kept separate from `Booking.bookingSource` per spec §6): `source`, `sourceDetail`, `campaign`, `referrer`
- Contact capture (pre-customer — an Inquiry may exist with no linked `Customer` yet): `customerName`, `primaryMobile`, `whatsappNumber`, `alternateMobile`, `email`
- Multiple vehicle requirements (spec §16, array — `CustomerRequirement.vehicleCategory` is a single string): `vehicleRequirements[]`
- Custom vehicle requirement (spec §14): `customVehicleRequests[]`
- Trip type (spec §C — broader enum than `Booking.bookingType`'s 6 values): `tripType`
- Conversion linkage: `convertedToLeadAt`, `linkedCustomerId`, `linkedBookingId`
- Lost-lead fields (spec §44, applies once status reaches a lost-equivalent state): `lostReason`, `lostNotes`, `futureReconnectDate`

## `Booking.bookingSource` vs. new `Inquiry.source` — kept deliberately separate

Per spec §6 ("Keep separate: Original Inquiry Source / Lead Conversion Source / Booking Source / Fulfilment Source"), `Inquiry.source` is the **original** channel (set once, immutable after creation). `Booking.bookingSource` (`server/models/index.ts:159-161`) remains exactly as-is and continues to be set independently at booking-creation time — when an Inquiry converts all the way to a Booking, the booking-creation code may copy `Inquiry.source` into `Booking.sourceName`/`bookingSource` as a convenience default, but the two fields are never the same field, and editing one never silently edits the other. `Booking.fulfilmentType` (own/vendor) also remains fully untouched and orthogonal, exactly as documented in the existing schema comment at `server/models/index.ts:154-158`.

## Trip type mapping

| New `Inquiry.tripType` (spec §C, 15 values) | Existing `Booking.bookingType` (6 values) |
|---|---|
| `local` | `local` |
| `airport_transfer` | `airport` |
| `railway_transfer` | *(no direct equivalent — maps to `one_way` at conversion, with `Inquiry.tripType` preserved on the Inquiry record for reporting)* |
| `one_way` | `one_way` |
| `round_trip` | `round_trip` |
| `outstation` | *(maps to `round_trip` or `one_way` depending on return-date presence)* |
| `multi_city`, `religious_tour`, `corporate_duty`, `wedding_event`, `group_tour`, `monthly_contract`, `employee_transport`, `custom` | *(no existing equivalent — all map to the closest of `round_trip`/`one_way` at booking-conversion time; the richer original `Inquiry.tripType` value is never lost, since the Inquiry record itself is preserved after conversion, satisfying the spec's "do not destructively rename old status values" and "keep original records" rules)* |
| `self_drive` | `self_drive` |

This is intentionally a **lossy-but-recoverable** mapping: `Booking.bookingType`'s enum is not widened (patch-only mode — no existing field's valid values change), and the richer original intent stays queryable on the preserved `Inquiry` document via its own `tripType` field.
