# Vendor 360° — Implementation Log

## Phase 1 (this patch): Vendor Master

### Database

- `server/models/index.ts`
  - `Counter` — generic per-tenant atomic sequence (`{ tenantId, name, value }`, unique index on `(tenantId, name)`). `$inc` via `findOneAndUpdate` is a single atomic Mongo op, so it's safe under concurrent creates (verified — see test report).
  - `Vendor` — the Vendor Master record. Unique index on `(tenantId, vendorCode)`, plus `(tenantId, normalizedMobile)` and `(tenantId, status)` for lookup/filtering. Money fields (`businessDetails.creditLimit`, `defaultCommercialTerms.commissionValue`) use plain rupee `Number`, matching every other financial field in this codebase (`Booking.totalAmount`, `Customer.totalSpending`, etc.) rather than the spec's suggested paise-integer convention — see the Audit doc for why (avoids two units colliding when a Vendor cost is later compared against `Booking.totalAmount` in the same margin calculation).

### Services

- `server/services/vendorService.ts`
  - `nextVendorCode(tenantId)` — atomic `VND-0001`, `VND-0002`, ... generator.
  - `createVendor(input)` — normalizes the mobile, generates the code, creates the record; catches a duplicate-key race on `vendorCode` (belt-and-suspenders behind the unique index) and surfaces it as a clean retryable error instead of a raw Mongo exception.

### API (all tenant-scoped, all require `authenticateUser` + `requireTenant`)

| Method | Route | Permission | Notes |
|---|---|---|---|
| GET | `/api/vendors` | `vendor_view` | `?status=` and `?search=` (company/contact/code/normalized mobile) |
| GET | `/api/vendors/:vendorId` | `vendor_view` | |
| POST | `/api/vendors` | `vendor_create` | via `createVendor()` |
| PATCH | `/api/vendors/:vendorId` | `vendor_edit` | explicit allowlist + shallow-merge on nested objects; `vendorCode`/`tenantId`/`status` are not settable here |
| POST | `/api/vendors/:vendorId/block` | `vendor_block` | sets `status: temporarily_blocked` + `suspensionReason` |
| POST | `/api/vendors/:vendorId/activate` | `vendor_block` | clears block/blacklist reasons, sets `status: active` |

### Permissions

`server/middleware/permissions.ts` — added `VENDOR_VIEW`, `VENDOR_CREATE`, `VENDOR_EDIT`, `VENDOR_BLOCK` to the existing `PERMISSIONS` map. Enforced server-side via `requirePermission()` on every route above (admin/client roles bypass, as they do for every existing permission in this app); the frontend additionally hides the "Vendors" nav item from managers (`restrictedForManagers: true` in `sidebar.tsx`), but the server check is the actual boundary.

### Frontend

- `client/src/pages/vendors.tsx` (new) — Vendor Database list (search, status badges), New Vendor dialog (company/contact/mobile/email + multi-select vendor types & roles), Vendor detail dialog (view + Block/Reactivate).
- `client/src/pages/dashboard.tsx` — 4-spot wiring: `ViewType` gained `"vendors"`, added to `allowedSections` and `restrictedSections` (manager-restricted, same as Campaigns/After-Sales — vendor commercial relationships are not manager-visible), `renderContent()` case.
- `client/src/components/layout/sidebar.tsx` — new nav item `{ id: "vendors", label: "Vendors", icon: Building2, restrictedForManagers: true }`.

No existing page, route, model field, or component was modified beyond these additive insertions — see the diff review in the final report.

## Phase 2: Vendor Drivers + Vendor Vehicles

### Database

- `VendorDriver` — scoped to `(tenantId, vendorId)`. Unique index on `(tenantId, vendorId, driverCode)` (atomic `VD-0001` codes, same `Counter` pattern as Vendor, keyed per-vendor via `vendor_driver_code_${vendorId}`). Real duplicate protection: unique **partial** index on `(tenantId, vendorId, normalizedMobile)` (`isDeleted: false` only, so a soft-deleted driver doesn't block re-adding the same person) — the same mobile cannot be created twice under one vendor, but the same person can legitimately drive for two different vendors.
- `VendorVehicle` — same shape, scoped to `(tenantId, vendorId)`. Unique `VV-0001` codes. `registrationNumber` is stored as entered; `normalizedRegistrationNumber` (uppercase, non-alphanumerics stripped) carries a matching unique partial index, so `"MP09 AB 1234"`, `"MP09AB1234"`, and `"mp-09-ab-1234"` are all treated as the same vehicle. Note: the vehicle's `model` field is named `vehicleModel` (not `model`) — `model` collides with Mongoose's reserved `Document.model()` method and fails to compile if used directly, so this repo's existing `Vehicle` schema already uses `vehicleModel` for the same reason; `VendorVehicle` follows that established convention rather than reinventing one.

### Services

- `vendorDriverService.ts`: `createVendorDriver()` (pre-checks for an existing normalized-mobile match and throws a clear, named error before ever touching the atomic counter; the unique index is the real backstop for the concurrent-request race), `findVendorDriverByMobile()`, `checkVendorDriverAvailability()`.
- `vendorVehicleService.ts`: `normalizeRegistrationNumber()`, `createVendorVehicle()` (same pre-check + index-backstop pattern), `findVendorVehicleByRegistration()`, `checkVendorVehicleAvailability()`.

**Availability is status-only for now.** `checkVendorDriverAvailability`/`checkVendorVehicleAvailability` check `status` (rejects `on_leave`/`suspended`/`inactive`/`document_expired`/`on_duty`/`assigned` for drivers; `maintenance`/`breakdown`/`document_expired`/`inactive`/`assigned`/`on_trip` for vehicles) and document expiry dates (license for drivers; insurance/permit/fitness/PUC for vehicles) — verified working in both the API smoke test and the automated suite. Real **time-window overlap** checking (the `overlaps(existingStart, existingEnd, requestedStart, requestedEnd)` function from spec §7) has nothing to check against yet, because Vendor Duty — the record of who's actually assigned to what time window — doesn't exist until Phase 3. Building a fake overlap check now would just always return "no conflict" and silently mislead whoever calls it; these two functions are written so Phase 3 can extend them with a real duty-window query without changing their signature or call sites.

### API (added to the existing Vendor routes, same auth/permission pattern)

| Method | Route | Permission |
|---|---|---|
| GET | `/api/vendors/:vendorId/drivers` | `vendor_view` |
| GET | `/api/vendors/:vendorId/drivers/lookup?mobile=` | `vendor_view` |
| GET | `/api/vendors/:vendorId/drivers/:driverId/availability` | `vendor_view` |
| POST | `/api/vendors/:vendorId/drivers` | `vendor_driver_create` |
| PATCH | `/api/vendors/:vendorId/drivers/:driverId` | `vendor_driver_edit` |
| GET | `/api/vendors/:vendorId/vehicles` | `vendor_view` |
| GET | `/api/vendors/:vendorId/vehicles/lookup?registrationNumber=` | `vendor_view` |
| GET | `/api/vendors/:vendorId/vehicles/:vehicleId/availability` | `vendor_view` |
| POST | `/api/vendors/:vendorId/vehicles` | `vendor_vehicle_create` |
| PATCH | `/api/vendors/:vendorId/vehicles/:vehicleId` | `vendor_vehicle_edit` |

New permissions: `VENDOR_DRIVER_CREATE`, `VENDOR_DRIVER_EDIT`, `VENDOR_VEHICLE_CREATE`, `VENDOR_VEHICLE_EDIT`.

### Frontend

- `client/src/components/vendors/vendor-drivers.tsx` and `vendor-vehicles.tsx` (new) — list + Add dialog for each.
- `client/src/pages/vendors.tsx` — the Vendor detail dialog gained an Overview/Drivers/Vehicles tab strip; Overview keeps its existing content unchanged, Drivers/Vehicles render the two new components. No other page or route touched.

The "auto-add driver/vehicle during booking assignment" confirmation flow described in spec §5/§6 (search by mobile/registration → offer "Add this driver/vehicle to Vendor CRM" → confirm → link to the duty) depends on the booking form's Fulfilment Source patch (spec §18, not yet built) as its actual entry point — the lookup endpoints it needs (`/drivers/lookup`, `/vehicles/lookup`) are built and tested now, but there's no UI trigger for that confirmation flow until the booking form itself is patched in a later phase.

## Critical fix made during Phase 2 verification (unrelated to Vendor 360 code)

While running the full regression suite, 11 previously-passing tests failed with a
reproducible (not flaky) error: `POST /api/bookings` succeeded, but the customer it
should have auto-created was never linked (`GET /api/customers/lookup` returned
`{customer: null}`). The dev server log showed the real cause:

```
Customer resolution failed: E11000 duplicate key error collection: fleetpro.customers
index: tenantId_1_customerCode_1 dup key: { tenantId: ..., customerCode: null }
```

`server/models/index.ts`'s `Customer` schema has no `customerCode` field at all — but a
**stale index** `tenantId_1_customerCode_1` (unique, sparse) still existed in the live
MongoDB database from some earlier, since-removed version of the schema. Because many
existing customer documents had `customerCode` explicitly present as `null` (not
merely absent), the sparse index still enforced uniqueness among them, and only the
very first customer with `customerCode: null` could ever be created — every
subsequent `findOrCreateCustomer()` call after that threw a duplicate-key error,
which the booking route was already catching and logging (not surfacing to the
caller), so bookings kept succeeding while silently failing to link a customer.

This was pre-existing damage, unrelated to any Vendor 360 code, but it broke core
booking→customer linking (not just tests) and needed fixing immediately: dropped the
stale index directly (`db.collection('customers').dropIndex('tenantId_1_customerCode_1')`)
since the field it was built on no longer exists anywhere in the current schema or
codebase. Verified via direct API call before and after, and the full suite went from
38/49 to 49/49 passing with no other change.

## Phase 3: Booking Source / Fulfilment Source patch

The Booking model already had a `bookingSource`/`sourceName`/... block and a
`fulfilmentType`/`vendorName`/`vendorDriverName`/`vendorVehicleDetails`/... block from
an earlier patch this session (spec §8) — but the fulfilment side had **no frontend at
all** (confirmed by grep: zero matches in `enhanced-booking-form.tsx`, and
`POST /api/bookings/:id/assign-vendor` had zero callers anywhere in the client). Both
sides were free-text only, not linked to the Vendor 360° records built in Phases 1–2.
This phase does two things: gives Fulfilment a real, working UI for the first time,
and lets both sides optionally link to real Vendor Master records while staying fully
backward compatible with the existing free-text display fields every other screen
already reads (duty slip, live/upcoming bookings, dashboards, customer dashboard).

### Database

Four new optional fields on `Booking`, all references, none required:
- `sourceVendorId` (ref `Vendor`) — optional link for Booking Source.
- `fulfilmentVendorId` (ref `Vendor`), `vendorDriverId` (ref `VendorDriver`),
  `vendorVehicleId` (ref `VendorVehicle`) — optional links for Fulfilment.

The existing free-text fields (`sourceName`, `sourceContact`, `vendorName`,
`vendorContactPhone`, `vendorDriverName`, `vendorDriverPhone`,
`vendorVehicleDetails`) are unchanged and remain the actual display values in every
existing reader — they're now *derived* from the linked record when one is provided
(and the caller didn't already fill them in manually), rather than replaced by a
second, parallel display path.

### Backend

- `POST /api/bookings` (creation): if `sourceVendorId` is present, validates the
  vendor exists/belongs to the tenant/is `active`, and fills `sourceName`/
  `sourceContact` from it only when the caller left those blank (a manual override
  always wins).
- `POST /api/bookings/:id/assign-vendor`: rewritten to support two modes side by
  side — the original free-text-only mode (`vendorName` required, unchanged
  behavior) and a new real-record mode (`fulfilmentVendorId` + optional
  `vendorDriverId`/`vendorVehicleId`). The real-record mode validates the vendor is
  `active`, and for a given driver/vehicle calls the exact same
  `checkVendorDriverAvailability`/`checkVendorVehicleAvailability` functions built in
  Phase 2 — an unavailable driver (on leave, suspended, expired license, etc.) or
  vehicle is rejected with a clear reason, and a blocked/inactive vendor is rejected
  outright. This is the "availability protection... at booking assignment" moment
  spec §7 describes — there was no real assignment action to protect until this
  patch existed.

### Frontend

- `enhanced-booking-form.tsx`: the existing Booking Source panel (shown for
  external/agent source types) gained an optional "Link to Vendor Master" select,
  populated from `GET /api/vendors?status=active` (only fetched when the panel is
  actually showing). Selecting a vendor auto-fills Source Name/Contact via
  `form.setValue` but leaves them editable — a manual edit afterward still wins on
  submit, matching the backend's "don't override an explicit value" rule.
- `client/src/components/booking/assign-vendor-dialog.tsx` (new) — the first actual
  UI for the previously-dead `assign-vendor` endpoint. Select an active vendor, then
  optionally pick one of that vendor's existing drivers/vehicles from a dropdown, or
  choose "Add new driver/vehicle to this vendor" to create one inline (calling the
  Phase 2 create endpoints) without leaving the dialog — a simplified, dropdown-based
  version of spec §5/§6's "search by mobile/registration, offer to add if not found"
  flow. Wired into the existing Booking Details view (`dashboard.tsx`) next to the
  pre-existing `ExtendBookingDialog`, not a new page or layout change.

## Critical fix made during Phase 3 verification (regression I introduced)

Full-suite verification caught a real regression: after adding `sourceVendorId` to
the booking form (default value `""` when nothing is selected), **every** booking
creation started failing with a 500 — not just ones using the new field. Server log:

```
Booking validation failed: sourceVendorId: Cast to ObjectId failed for value ""
```

Mongoose's ObjectId setter throws on an empty string rather than treating it as
unset. The booking creation route already had this exact guard for `driverId`
(`req.body.driverId && req.body.driverId.trim() !== '' ? req.body.driverId :
undefined`) — `sourceVendorId` needed the identical treatment and didn't have it.
Fixed by adding the same empty-string-to-undefined mapping in `server/routes.ts`'s
`mappedData` construction. Caught by two *pre-existing, unrelated* tests
(`advance-payment.spec.ts`, `booking-source.spec.ts`) failing at the final "Confirm
Booking" step — both are booking-creation tests that never touch the new field, which
is what made it obvious this wasn't scenario-specific. Verified fixed by direct
re-run of both, then the full suite.

## Not yet built (explicitly out of scope for this patch)

Per the spec's own 27-section scope: driver/vehicle availability's real time-window
overlap check (needs Vendor Duty to exist), the "search by mobile/registration with
confirm" version of auto-add (current version is dropdown + inline add, not a
mobile/registration search-first flow), Vendor Duty, Vendor Duty Slip, Vendor Ledger
(`VendorTransaction`), Receivable/Payable, Commission, Booking Profitability/Margin
service, Vendor Settlement UI, Vendor communication templates, the
booking-vendor-mention migration, and the remaining permission codes
(`vendor.payable.view`, `vendor.receivable.view`, `vendor.margin.view`,
`vendor.payment.*`, `vendor.duty_slip.create`, `vendor.communication.send`,
`vendor.statement.export`) that only make sense once their features exist.
