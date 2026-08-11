# Vendor Financial Mapping

How customer commercials, vendor commercials, and internal profitability stay separated, per spec §15.

## Already separated today (do not rebuild)

`Booking` already carries customer-facing commercial fields (`totalAmount`, advance/due tracking via the payment ledger) entirely separately from the vendor fields added for `assign-vendor` (`vendorAgreedRate`, `vendorAdvancePaid` — `server/models/index.ts:178–218`). No existing code path copies a vendor rate into a customer-facing total, or vice versa — confirmed by reading `assign-vendor`'s handler (`server/routes.ts:6125–6234`), which only ever writes to the `vendor*` fields.

## What this initiative adds, and where it must NOT cross

| Field group | Visibility | New in this initiative |
|---|---|---|
| Customer Commercials (`totalAmount`, advance, due, tax) | Customer-facing roles, existing permission set (`edit_booking` etc.) | Unchanged |
| Vendor Commercials (`vendorAgreedRate`, `vendorAdvancePaid`, new: sourcing-request `targetVendorCostPaise`, accepted quote's `quotedCostPaise`) | `vendor_commercial.view`/`vendor_commercial.edit` only (new permissions) | New sourcing-request quote fields, same visibility boundary as existing `vendorAgreedRate` |
| Internal Profitability (`customerRevenue - vendorDirectCost`) | Computed on read, never stored duplicated; gated by a margin-view permission | New computed field on the Booking detail/Resource Fulfilment panel, additive |

## Enforcement points

1. **API response shaping** — any endpoint returning booking data to a customer-facing view must not include `vendorAgreedRate`/quote-cost fields unless the caller has `vendor_commercial.view`. This matches the existing pattern already used for `view_revenue`-gated report endpoints (`pipeline-audit-permission-repairs.spec.ts`).
2. **Sourcing-request quote comparison UI** — vendor cost only ever rendered inside the vendor-commercial-gated comparison drawer, never inside the customer-facing Booking summary.
3. **Vendor invoice/settlement** — reuses the existing Vendor Settlement ledger (already immutable-transaction-based per the prior pipeline-audit initiative); no new settlement mechanism is introduced, only new source records (accepted sourcing-request quotes) feeding the same ledger the same way `assign-vendor` already does.

## Test coverage plan

A dedicated test must prove: a booking with an accepted sourcing-request quote (a) shows the correct customer `totalAmount` unaffected by vendor cost, (b) hides vendor cost from a role without `vendor_commercial.view`, (c) shows it to a role with that permission, (d) the profitability figure equals `totalAmount - vendorDirectCost` exactly.
