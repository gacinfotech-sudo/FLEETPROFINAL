# FleetPro — Multi-Brand and Multi-Branch Audit

Read-only, evidence-based. Branch `feature/customer-invoice-system` @ `71e40450e40e573be042d0cfd94d1b9af5c2b4d7`.

## Finding: no multi-brand or multi-branch concept exists anywhere in the codebase

- `grep -rniE "\bbrand\b|\bbranch(es)?\b" server/models/index.ts server/routes.ts client/src/pages/*.tsx` → **zero matches** (verified directly during this audit).
- The tenancy model is exactly one level: `Tenant` → `User`(with role `admin`/`client`/`manager`) → all operational data (`Booking`, `Vehicle`, `Driver`, `Customer`, etc.) scoped by a single `tenantId`. There is no intermediate `Brand` or `Branch` entity, and no field on any operational model that could represent one (no `branchId`, `brandId`, `locationId`, `outletId`, or similar found anywhere).
- The `manager` role's scoping is **tenant-wide minus explicitly restricted UI sections** (see `sidebar.tsx`'s `restrictedForManagers` flags and `dashboard.tsx`'s `restrictedSections` array), not scoped to a subset of the tenant's own data by branch/location. A manager at a single-tenant company today sees *all* of that tenant's bookings/vehicles/drivers, just with fewer menu sections available — there is no "Manager A only sees Branch 1's bookings" capability.

## What this means against the brief's checklist

| Check | Result |
|---|---|
| Booking belongs to correct brand | N/A — no brand concept |
| Booking belongs to correct branch | N/A — no branch concept |
| Customer shared/separated per configuration | N/A — customers are tenant-wide, no per-branch separation option exists |
| Vehicle belongs to correct branch | N/A |
| Driver belongs to correct branch | N/A |
| Vendor serves multiple branches | N/A — no vendor master exists either (see feature matrix) |
| Invoice uses correct brand | N/A — one `InvoiceSettings` document per tenant, not per brand |
| WhatsApp template uses correct brand | N/A — one WhatsApp session per tenant |
| Dashboard filters by brand/branch | N/A — no such filter exists |
| Owner sees combined view | Trivially true (owner already sees everything, since there's no sub-division to combine) |
| Manager sees assigned branches only | **Not possible today** — a manager sees the whole tenant's data, restricted only by UI section, not by data subset |

## Real-world implication

Today's data model correctly fits **one company operating as one operational unit** — a single taxi/travel/self-drive business with one office, one fleet pool, one set of drivers. It does **not** fit:
- A group that operates two distinct customer-facing brands (e.g., a budget and a premium taxi brand) sharing back-office infrastructure but needing separate invoice branding/numbering/WhatsApp templates per brand.
- A company with multiple physical branches/depots where a manager at Branch 2 should not see Branch 1's bookings, vehicles, or drivers, and where vehicle/driver availability needs to be computed per-branch, not tenant-wide.
- A vendor that serves multiple branches of the same tenant with a single vendor relationship (moot today since there's no vendor master either).

This is not a defect in what exists — every single-branch, single-brand tenant is well served by the current model — but it is a real ceiling on the customer segment FleetPro can serve as-is. A multi-location fleet operator (a realistic and valuable SaaS customer profile) cannot be onboarded correctly today.

## Recommended solution shape (design note, not a proposal to implement now)

Introducing branch scoping is a **structural** change, not a small patch — it would require:
1. A `Branch` model (`{tenantId, name, address, ...}`) and, optionally, a `Brand` model above it if brand and branch are meant to be independent dimensions.
2. A `branchId` field added to every operationally-scoped collection (`Booking`, `Vehicle`, `Driver`, `Customer` if branch-separated, `Expense`, `Invoice`/`InvoiceSettings` if per-brand numbering is needed).
3. Extending `requireTenant`-style middleware with a `requireBranch` (or branch-aware) scoping layer, mirroring the existing tenant-scoping pattern rather than inventing a new one.
4. Reworking the `manager` role's restriction model from "hide UI sections" to "filter data by assigned branch(es)," which touches most list/detail routes across the API.
5. Per-branch (or per-brand) `InvoiceSettings` and WhatsApp session/template resolution instead of the current one-per-tenant assumption.

This is correctly classified as **Large** in the roadmap — it touches the core scoping pattern used by nearly every route in the application, not a bolt-on feature. See [RECOMMENDED_IMPLEMENTATION_ROADMAP.md](./RECOMMENDED_IMPLEMENTATION_ROADMAP.md) for sequencing relative to the other gaps.
