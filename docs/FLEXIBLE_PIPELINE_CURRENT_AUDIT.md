# Flexible Pipeline — Current State Audit

Evidence-based audit of the Inquiry → Lead → Quotation → Customer → Booking → Resource Fulfilment → Trip pipeline as it exists today, before any changes in this initiative. Every claim below is grounded in a file:line citation. Purpose: stop later phases from rebuilding what already works, per the standing additive-only mandate.

## Headline finding

The reported "no company vehicle → dead end" bug is real and narrow: it lives entirely in one UI empty-state and one hard-required backend field. The surrounding vendor infrastructure (`VendorVehicle`, `VendorDriver`, `VendorDuty`, correct full-datetime overlap checking, an `assign-vendor` API) already exists, already works, and is already tested (`tests/e2e/booking-vendor-fulfilment.spec.ts`, `tests/e2e/vendor-duty.spec.ts`). It just can't be reached until *after* a booking already has a company vehicle — the one missing piece is letting fulfilment start as "vendor" or "not yet decided" from the very first save.

## 1. Booking Wizard Step 2 dead-end

`client/src/components/booking/enhanced-booking-form.tsx`:
- Step 2 = "Vehicle & Service" (line 695).
- Availability fetch (lines 284–293) queries `GET /api/vehicles/available?pickupDate&returnDate` — **no time params sent**, unlike the driver-availability query a few lines below it (304–320) which does send time and has a comment explaining why bare dates were already fixed as a P0 bug for drivers. The vehicle path was never given the same fix.
- Empty state (1229–1236): literal `"No vehicles available for selected dates"` message, no other action offered.
- "Continue"/Next (1313–1338): not `disabled`-gated but its `onClick` throws a blocking toast unless a real `selectedVehicleId` is set — functionally a hard wall.

## 2. `/api/vehicles/available` — two real bugs, one in-scope

`server/routes.ts:1794` → `server/storage-mongodb.ts:450–476`:
- **Bare-date overlap comparison.** Compares `Booking.pickupDate`/`returnDate` (midnight-only `Date`s), not `scheduledStartDateTime`/`scheduledEndDateTime` (which exist on `Booking` specifically to fix this class of bug elsewhere — `server/models/index.ts:147–156`). Two same-day bookings at non-overlapping times can incorrectly appear to conflict, and — more relevant to the dead-end — a bare-date query can also make a vehicle appear unavailable more often than it should. **In scope for this initiative**: bringing this endpoint's comparison logic in line with the already-correct pattern is a small, additive fix that directly reduces false "no vehicles available" results.
- **Only excludes `status: 'confirmed'` bookings**, not the other occupying statuses (`vehicle_assigned`, `ongoing`, `trip_started`, etc.). This under-counts conflicts (the opposite direction from the dead-end bug) — noted for completeness, **left unfixed**: it's a separate, pre-existing correctness issue unrelated to this initiative's objective, and fixing it would need its own dedicated audit/test pass, per "smallest safe patch."
- No branch/brand scoping, no vehicle-category filter — pre-existing, not part of this bug, not touched.

## 3. `POST /api/bookings` — vehicleId is hard-required today

Three independent layers, all must change together for a genuinely optional path:
- Zod: `server/schemas/mongodb-schemas.ts:106` — `vehicleId: z.string()`, no `.optional()`.
- Mongoose: `server/models/index.ts:688` — `required: true`.
- Route: `server/routes.ts:2335` parses `req.body` through the same schema with no special-case.

## 4. Vendor-fulfilment fields already exist on Booking — after the fact only

`server/models/index.ts:178–218` (`IBooking`) already has `fulfilmentType?: 'own' | 'vendor'`, `fulfilmentVendorId`, `vendorDriverId`, `vendorVehicleId`, plus display/commercial fields (`vendorName`, `vendorAgreedRate`, `vendorAdvancePaid`, etc.) — separate from `bookingSource`/`sourceVendorId` (attribution, not fulfilment). Populated only via `POST /api/bookings/:id/assign-vendor` (`server/routes.ts:6125–6234`), which requires an **already-created** booking. Real validation exists there: active-vendor check, `checkVendorDriverAvailability`/`checkVendorVehicleAvailability` against the booking's real datetime window, `VendorDuty` upsert. **Gap**: no path to create a booking as vendor-fulfilled (or unresolved) from the start.

## 5. Vendor Master — VendorDriver / VendorVehicle / VendorDuty already correct

- `VendorDriver` (`server/models/index.ts:2908–2966`), `VendorVehicle` (`2986–3068`, service in `vendorVehicleService.ts`) — both mature models with status enums, expiry tracking, unique-per-vendor codes.
- `checkVendorVehicleAvailability` (`vendorVehicleService.ts:88–112`) and the driver equivalent already do **full-datetime overlap** via `VendorDuty` + the linked `Booking`'s `scheduledStartDateTime/scheduledEndDateTime` (`vendorDutyService.ts:81–113`), explicitly mirroring `server/services/availability.ts`'s company-side logic. This is already correct — nothing to fix here.

## 6. State machine trip-start gate — company-only blind spot

`server/services/bookingStateMachine.ts:107,181–190`: `REQUIRES_ASSIGNMENT = ['ready_for_dispatch', 'trip_started']` checks only `booking.vehicleId`/`booking.driverId`; a vendor-fulfilled booking (`vendorVehicleId`/`vendorDriverId` set, company fields null) would incorrectly require a manager override to ever start a trip. **Real gap, in scope**: needs an additive OR-clause.

## 7. Inquiry → Lead conversion — already flexible, no work needed

`server/routes.ts:3961` (`POST /api/inquiries/:id/convert-to-lead`) copies only `priority`/`assignedExecutive` from the inquiry; no date/route/vehicle-category field is read or required. Confirmed at the schema level: only `tenantId`, `customerName`, `primaryMobile` are `required: true` on `Inquiry` (`server/models/index.ts:2017/2036/2037`); `pickupDate`, `vehicleCategoryId`, `tripType` are all optional (1939, 1884, 1936). **Section 21's stated problem does not exist in the current codebase** — this is called out explicitly so no phase wastes effort "fixing" something already working.

## What this means for scope

The real build is narrower than the spec's full list suggests:
- **Small, additive backend fix**: optional `vehicleId`, a `resourceFulfilmentStatus` field, `/api/vehicles/available` datetime fix, state-machine OR-clause.
- **New UI, reusing existing data**: the three-path Step 2 card layout, wired to the already-correct vendor-vehicle/driver availability checks.
- **Genuinely new build**: the Outsource Vehicle sourcing-request/quote-comparison/vendor-WhatsApp workflow — nothing like it exists today.
- **No work needed**: Inquiry-to-Lead flexibility, vendor overlap correctness, vendor duty tracking.
