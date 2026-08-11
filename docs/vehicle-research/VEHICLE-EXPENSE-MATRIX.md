# Vehicle Expense Matrix

Grounds `TASK-VEHICLE-FUEL-EXPENSE-04`. The existing `Expense` model
(`server/models/index.ts:383-411`, schema `:849`) already has `vehicleId` (required),
optional `bookingId`/`driverId`/`approvalStatus`, and a narrow `category` enum
(`maintenance|damage|tires|fuel|other`). **This initiative extends that enum and adds new
linked collections for line-item detail (fuel transactions, tyre/battery cost roll-ups) —
it never creates a second Expense model**, per the dispatch requirement's explicit
instruction (Section 13).

## Category mapping: dispatch requirement's expense list → existing model

| Requested category | Existing `Expense.category` today | Action |
|---|---|---|
| Fuel | `fuel` (exists) | Extend: add `FuelTransaction` companion collection (Section 12) linked via `expenseId`, for line-item KM/L analytics — the `Expense` row stays the ledger entry, `FuelTransaction` adds the detail `Expense` alone can't hold (odometer, quantity, unit, station, full-tank flag). |
| CNG | Not distinct today (`fuel` catches it) | Extend enum: add `cng` value, or a `fuelType` sub-field on `FuelTransaction` — prefer the sub-field (fewer enum values to keep in sync across `server/schemas/mongodb-schemas.ts`, per this repo's own documented drift-bug history). |
| Charging (EV) | Not distinct today | Same treatment as CNG — `fuelType: 'ev'` on `FuelTransaction`. |
| Maintenance | `maintenance` (exists) | Reuse — new `MaintenanceRecord` collection (Section 9) creates its own detail row and an `Expense` entry for ledger consistency, `Expense.category = 'maintenance'` unchanged. |
| Repair | Not distinct (`maintenance` catches it) | New enum value `repair`, distinct from routine `maintenance`, since cost/downtime analytics benefit from separating planned service from unplanned repair. |
| Tyre | `tires` (exists, note the model's spelling is "tires" not "tyres" — keep as-is, don't rename an existing enum value) | Reuse `tires`; new `TyreRecord` collection (Section 10) for per-tyre lifecycle, each replacement/rotation event optionally creates a linked `Expense` row. |
| Battery | Not distinct (`other` today) | New enum value `battery`. |
| Insurance | Not distinct (`other` today) | New enum value `insurance`. |
| Permit | Not distinct (`other` today) | New enum value `permit`. |
| Fitness | Not distinct (`other` today) | New enum value `fitness`. |
| PUC | Not distinct (`other` today) | New enum value `puc`. |
| Tax | Not distinct (`other` today) | New enum value `tax`. |
| Toll / FASTag | Not distinct (`other` today) | New enum value `toll`, populated from FASTag transaction sync where a provider is connected, or manual entry otherwise. |
| Parking | Not distinct (`other` today) | New enum value `parking`. |
| Cleaning / Washing | Not distinct (`other` today) | New enum value `cleaning` (covers both — don't over-split into two enum values for a cosmetic distinction). |
| Accessories | Not distinct (`other` today) | New enum value `accessories`. |
| Challan | Not distinct (`other` today) | New enum value `challan`, linked to the new `Challan` collection (Section 18) — the challan record is the source of truth, the `Expense` row is the ledger reflection once payment responsibility is decided (never auto-created before that decision, per the dispatch requirement's explicit "never automatically deduct Driver money without approved workflow"). |
| Accident | Not distinct (`other` today, and `damage` already exists) | Reuse `damage` for the cost-ledger entry; link to new `AccidentEvent` collection (Section 17) for the full record. Don't create a redundant `accident` enum value when `damage` already captures the financial category. |
| EMI / Lease | Not distinct (`other` today) | New enum values `emi`, `lease` — financial/finance-cost items, `Accounts`-restricted per the compliance matrix's access-classification precedent. |
| GPS Subscription | Not distinct (`other` today) | New enum value `gps_subscription`. |
| Other | `other` (exists) | Reuse — true catch-all only. |

## Proposed extended `Expense.category` enum (deferred patch, Integrator-applied)

```
maintenance | repair | damage | tires | battery | fuel | insurance | permit | fitness |
puc | tax | toll | parking | cleaning | accessories | challan | emi | lease |
gps_subscription | other
```

Additive only — every existing value is preserved unchanged, so historical `Expense`
records need no migration/backfill.

## Analytics this feeds (Section 21 — Revenue & Profitability)

The matrix above is what makes `Cost/KM`, `Fuel Cost`, `Maintenance Cost`,
`Compliance Cost`, `Tyre Cost`, `Insurance Cost`, `Finance/Lease Cost`, `Other Cost`
computable as **independent, non-overlapping buckets** straight from
`Expense.category`, rather than one lump "vehicle expenses" number — directly satisfying
the dispatch requirement's Section 21 instruction not to silently mix cost categories.
`TASK-VEHICLE-FUEL-EXPENSE-04` owns the category extension; `TASK-VEHICLE-DOMAIN-01` (or
whichever task builds the Vehicle 360 Profitability tab) consumes it, never redefines it.
