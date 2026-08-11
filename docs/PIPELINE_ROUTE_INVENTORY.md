# Pipeline Route Inventory

## Top-level app routes (`client/src/App.tsx:20-79`)

| Route | Component | Guard |
|---|---|---|
| `/` | `LandingPage` | none |
| `/login` | `LoginPage` or `Dashboard`/`AdminPanel` if already authenticated | none |
| `/reset-password` | `ForcedPasswordResetPage` or `Dashboard` | client/manager |
| `/admin` | `AdminPanel` | admin only |
| `/dashboard/:section?` | `Dashboard` | client/manager |
| (catch-all) | role-based redirect or `LoginPage` | — |

## Dashboard views (`client/src/pages/dashboard.tsx`, `ViewType`)

All 24 `ViewType` values have a matching `case` in the render switch AND a matching Sidebar nav entry — **no orphaned view and no dangling nav item found** (full 1:1 mapping verified):

`dashboard, inquiries, leads, followups, live-bookings, upcoming-bookings, payment-dues, bookings, fleet, vehicle-performance, drivers, driver-attendance, driver-leave, driver-performance, history, customers, after-sales, campaigns, revenue, expenses, salary, whatsapp, users, profile`

Manager-restricted (`restrictedForManagers: true` in `sidebar.tsx`, matching stripped from `allowedSections` in `dashboard.tsx`): `vehicle-performance, drivers, driver-attendance, driver-leave, driver-performance, after-sales, campaigns, revenue`. `users` is additionally `admin`/`client`-only.

**Refresh-restore verified working**: `dashboard.tsx:142-173` validates `params.section` against the role-filtered `allowedSections` on every mount/param change; a direct refresh on e.g. `/dashboard/customers` correctly restores that exact view. Only a missing/disallowed section falls back to `/dashboard/dashboard`.

## Known gap surfaced by this audit (see PIPELINE_BUG_REPORT.md #1, now fixed)

Frontend route/nav-level restriction (`restrictedForManagers`) for `revenue`/`driver-performance`/`vehicle-performance` was not, by itself, a security boundary — the backing API routes had no permission check. Fixed by adding `requirePermission(PERMISSIONS.VIEW_REVENUE)` to `GET /api/reports/revenue`, `/driver-performance`, `/vehicle-performance`. Frontend routing/nav structure itself required no change (already correct).

## No dead routes found

Every Sidebar nav item resolves to a real, rendering view. No duplicate routes, no route opening a generic unfiltered list where a specific record was expected, found in this pass (this audit did not attempt an exhaustive click-through of every button — see `PIPELINE_ACTION_MATRIX.md` for the action-level spot checks that were performed).
