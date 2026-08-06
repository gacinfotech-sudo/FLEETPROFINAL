# Trip Costing Data Mapping

## Current state

- `Booking` has exactly one ambiguous distance field, `totalKilometers`, plus `startOdometer`/`endOdometer` accepted with **zero validation** against it or against each other (no min/max, no comparison to a GPS-derived distance — none exists).
- No centralized pricing service anywhere in the repo. The booking `amount` is computed entirely client-side in `enhanced-booking-form.tsx`'s `handleVehicleAndPricingSelection` (day: `days * vehicle.pricePerDay`; km: a hardcoded **100km default estimate**, user-adjustable) and trusted verbatim server-side — `POST /api/bookings` maps `req.body.amount` straight onto `totalAmount` with no re-derivation or check against `Vehicle.pricePerDay/pricePerKm`. This is the exact class of risk spec §20-21 calls out.
- `Vehicle` does carry a real flat rate card (`pricePerDay`, `pricePerHour`, `pricePerKm`), so a source of truth to validate against already exists — it's just never consulted server-side today.
- `Quotation`'s embedded options are the richest pricing structure in the codebase (paise-precise, GST-aware, toll/parking/state-tax treatment enums) but there is **no `quotationId` field on `Booking`** — an accepted Quotation's rate detail never carries through to the Booking it eventually becomes.
- `Expense` (vehicle-scoped, no `bookingId`/`driverId`/approval/chargeable fields) is entirely disconnected from any individual trip.

## Planned additive schema changes (Booking)

All new fields optional, all existing fields and their current behavior untouched:

```
estimatedRouteKm?: number
estimatedRouteDurationMinutes?: number
estimatedRouteProvider?: string        // 'google_routes' | 'manual' | ...
estimatedRouteFetchedAt?: Date
estimatedRouteOverridden?: boolean
estimatedRouteOverrideReason?: string

quotedKm?: number                       // from an accepted Quotation option, when the booking originated from one

// totalKilometers remains exactly as-is — becomes the "actual trip KM" in
// practice (End Odometer - Start Odometer, already the de facto meaning),
// not renamed, so every existing booking/report/invoice reading it keeps
// working unchanged.

billableKm?: number                     // defaults to totalKilometers when unset — see below
billableKmRule?: string                 // 'actual' | 'minimum_km_per_day' | 'fixed_package' | 'garage_to_garage' | 'pickup_to_drop' | 'contract' | 'manual_adjustment'
billableKmApprovedBy?: { userId, role }
billableKmApprovedAt?: Date

odometerVariance?: number               // computed: |totalKilometers - estimatedRouteKm|, display-only
odometerVarianceFlagged?: boolean       // true when variance exceeds a configurable tenant threshold
```

`billableKm` defaulting to `totalKilometers` when unset means **every existing booking's invoice/reporting math is unaffected** until someone explicitly sets a different billable rule — a pure additive default, not a behavior change.

## Planned server-side pricing validation (additive, not a replacement)

A new `server/services/pricingService.ts` function, `validateBookingAmount(bookingData)`, called from `POST /api/bookings` **alongside** (not instead of) the existing client-submitted `amount` — it re-derives an expected amount from `Vehicle.pricePerDay/pricePerKm` + `days`/`totalKilometers`, and if the submitted amount differs beyond a small tolerance, the booking is **not silently rejected** (that would be a breaking change to a form real users depend on today) — instead the discrepancy is recorded (`rateValidation: { expected, submitted, source }` on the booking) for staff/audit visibility, exactly matching the spirit of spec §21's "show the source of every selected rate" without introducing a new hard failure mode into an already-working submit path.

## Driver expense extension (additive fields on `Expense`)

```
bookingId?: ObjectId (ref Booking)
driverId?: ObjectId (ref Driver)
customerChargeable?: boolean (default false)
reimbursable?: boolean (default false)
approvalStatus?: 'pending' | 'approved' | 'rejected' (default 'pending')
approvedBy?: { userId, role }
approvedAt?: Date
```

`vehicleId` stays required (backward compatible — every existing Expense row already has it); `bookingId`/`driverId` are optional additions so the model still works for its original purpose (general vehicle maintenance/damage/tires cost tracking with no trip attached) while also supporting trip-linked entries going forward.

Trip Cost Summary (new section in Booking Details) reads: Customer Revenue from `Booking`'s existing charge fields (unchanged), Internal Trip Cost from `Expense` rows where `bookingId` matches and `customerChargeable: false`, Collection from the existing `PaymentTransaction` ledger (unchanged) — gross contribution computed, never stored, and gated behind a new `trip.profitability.view` permission.
