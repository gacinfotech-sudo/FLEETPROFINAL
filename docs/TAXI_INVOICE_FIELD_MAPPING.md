# Taxi Invoice Field Mapping

## Critical finding: three invoice renderers exist, only one is real

- `client/src/components/invoice/invoice-template.tsx` — **dead code**, zero importers anywhere in the app.
- `client/src/components/invoice/enhanced-invoice-generator.tsx` — used (from `dashboard.tsx`), but **entirely disconnected from the backend `Invoice` model**. It prefills from a raw booking prop, lets staff hand-type 11 separate charge fields, computes a total client-side with no GST math, and generates a client-side PDF — it never calls `POST /api/invoices`. Any invoice made through it is a downloaded PDF only, never a persisted, numbered, immutable financial record.
- `client/src/components/customers/customer-invoices.tsx`'s internal `InvoiceDocument` function — **the real one**, the only renderer actually wired to `invoiceService.ts` / the `Invoice` collection.

**This means: the professional taxi invoice must be built by extending `customer-invoices.tsx` / `invoiceService.ts` / the `Invoice` model. Building it inside `enhanced-invoice-generator.tsx` would produce a taxi-styled invoice that still never gets persisted as a real, numbered financial document — the wrong foundation entirely.** The dead `invoice-template.tsx` and the disconnected `enhanced-invoice-generator.tsx` are left untouched (out of scope to fix/delete in an additive-only patch) but flagged here for the user's awareness — this is a genuine, pre-existing product gap independent of this initiative.

## Current `Invoice` model (relevant fields)

`serviceDescription` (single string), `taxableAmount`/`gstAmount`/`totalAmount` (single combined numbers, no CGST/SGST/IGST split), `bookingSnapshot` (Mixed — populated by `invoiceService.loadContext` with only `bookingNumber`, dates, `pickupLocation`/`dropoffLocation`, `bookingType`, and populated vehicle `{make, vehicleModel, licensePlate, type}`). **No odometer, no KM, no per-KM rate, no driver name ever reaches an invoice today.**

## Planned additive schema changes (Invoice)

```
lineItems?: Array<{
  description: string, quantity: number, unit: string, rate: number, amount: number,
}>
```

Optional, defaults to empty/unused. `serviceDescription`/`taxableAmount` remain exactly as they are today — every existing finalized invoice keeps rendering identically, since `finalizeInvoice()` never recomputes amounts and the schema addition is purely additive. New taxi invoices populate `lineItems` (Vehicle Hire, Distance Charges, Extra KM, Extra Hours, Driver Allowance, Night Halt, Toll, Parking, State Tax, approved Customer add-ons, Discount, GST) while still also filling `taxableAmount`/`totalAmount` (the sum), so nothing downstream that reads the existing single-total fields breaks.

## Planned `loadContext` extension (additive)

Once the Trip Costing fields exist on `Booking` (see `docs/TRIP_COSTING_DATA_MAPPING.md`), `bookingSnapshot` gains: `driverName`, `startOdometer`, `endOdometer`, `billableKm`, `billableKmRule`, `pricingType`, `ratePerKm`/`ratePerDay` (the value actually used, from the new pricing-validation service). All additive to the existing Mixed blob — no existing key removed or renamed.

## GST/non-GST visibility

Already correctly implemented today (`documentType` gating: `tax_invoice` vs `non_gst_invoice`, `gstRate` only applied for the former) — spec §28's requirements are already met by the existing `invoiceService.ts` logic. No CGST/SGST/IGST split will be added without an explicit tenant requirement (inventing one would violate the spec's own "do not invent GST rates" rule).

## Internal Trip Statement

New, separate view (not a new `documentType` on the customer-facing `Invoice` — a distinct, permission-gated internal-only page/component reading from `Booking` + `Expense` + `PaymentTransaction` directly), never included in or linked from the customer-facing invoice PDF, matching spec §27's explicit separation requirement.
