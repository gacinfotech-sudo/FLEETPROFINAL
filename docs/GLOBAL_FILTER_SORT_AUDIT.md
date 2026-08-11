# Global Filter/Sort Audit

Full per-page findings recorded in this audit session; summarized here with the rollout plan.

## Current state summary

| Page | Filtering | Default sort | Pagination |
|---|---|---|---|
| Customers | server-side (search/segment/tag) | server `lastBookingDate: -1, createdAt: -1` | none — hardcoded `.limit(500)`, no `total` |
| Inquiries | server-side (search/status) | server `createdAt: -1` | **broken** — backend supports `limit/skip/total`, frontend never uses it, hard-capped at 50 |
| Leads | server-side (status only, no search) | server `createdAt: -1` | same broken pattern as Inquiries |
| Bookings (History) | 100% client-side `.filter()` on an unbounded fetch | client-side re-sort of already-sorted data (redundant) | none at all |
| Drivers | 100% client-side `.filter()` on an unbounded fetch | none applied client-side (backend returns `createdAt: -1`) | none at all |
| Fleet/Vehicles | 100% client-side `.filter()` on an unbounded fetch | none applied client-side (backend returns `createdAt: -1`) | none at all |
| Payments | *no tenant-wide list page exists* | server `receivedAt: -1` (scoped views only) | none |
| Invoices | none — no filter UI at all | server `createdAt: -1` | none |
| Expenses | none — no filter UI at all | server `date: -1, createdAt: -1` | none |

**No shared `FilterBar` component exists** — every page builds its own filter UI independently. A generic shadcn `pagination.tsx` primitive exists but is imported nowhere.

**Two real bugs found** (not just gaps):
1. Inquiries/Leads: the backend's own `limit`/`skip`/`total` contract is silently ignored client-side — both lists are invisibly capped at the first 50 rows with no "there are more" indication.
2. `dashboard.tsx`'s `searchTerm` state (declared once, line 76) is shared across the Fleet, Drivers, and Booking History tabs — a search typed on one tab silently carries into another.

## Rollout plan (additive, page-by-page, smallest-diff-first)

**Step 1 (near-zero risk):** fix the Inquiries/Leads pagination wiring — pure frontend change, backend already correct. Fix the `searchTerm` sharing bug by giving Fleet/Drivers/Booking History their own state variables (mirrors the existing `vehicleStatusFilter`/`driverStatusFilter` separation already present in the same file for status).

**Step 2:** build one reusable `client/src/components/shared/filter-bar.tsx` — search input, quick date chips (Today/Tomorrow/This Week/Last 7 Days/This Month/Custom), a slot for domain-specific filters, active-filter chips with individual remove + "Clear All", result count. Purely additive new component; existing pages keep working unchanged until each is migrated onto it individually.

**Step 3:** migrate Customers/Inquiries/Leads onto the shared bar first (already server-side, smallest additional change — just swapping their existing ad-hoc filter JSX for the shared component while keeping the same query params/behavior).

**Step 4:** migrate Bookings (History)/Drivers/Fleet from client-side-filter-everything to real server-side search/filter/sort/pagination — the highest-value, highest-effort step, done last and one page at a time, each with its own full regression pass, since these are the most heavily-used, most-tested existing pages in the app.

**Step 5:** add filtering to Invoices/Expenses (currently zero) using the same shared bar.

**Not built in this initiative:** a new tenant-wide Payments list page (no such page exists today; out of scope unless explicitly requested — flagged as a gap, not a P0). Saved Views (§34) are additive and safe but sequenced after the base FilterBar rollout, not before.

## Indexes

Existing indexes already cover most of the "Tenant + created/updated date" patterns (confirmed via each model's schema in `server/models/index.ts` during this audit — e.g. `Customer` already has `{tenantId, lastBookingDate}`-adjacent indexes). New composite indexes will only be added where a genuinely new server-side query pattern is introduced by Step 4 above (e.g. `{tenantId, status, scheduledStartDateTime}` for the Bookings list once it moves server-side) — not speculatively added upfront, per spec §35's own "measure first" instruction.
