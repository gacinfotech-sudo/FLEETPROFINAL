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

## Not yet built (explicitly out of scope for this patch)

Per the spec's own 27-section scope, everything past Vendor Master is a separate follow-up patch:
Vendor Drivers, Vendor Vehicles, driver/vehicle availability engine extension, Booking Source/Fulfilment Source patch to the booking form, Vendor Duty, Vendor Duty Slip, Vendor Ledger (`VendorTransaction`), Receivable/Payable, Commission, Booking Profitability/Margin service, Vendor Settlement UI, Vendor communication templates, the booking-vendor-mention migration, and the remaining permission codes (`vendor.driver.*`, `vendor.vehicle.*`, `vendor.payable.view`, `vendor.receivable.view`, `vendor.margin.view`, `vendor.payment.*`, `vendor.duty_slip.create`, `vendor.communication.send`, `vendor.statement.export`) that only make sense once their features exist.
