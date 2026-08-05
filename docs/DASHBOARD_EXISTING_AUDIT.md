# Dashboard — Existing State Audit (feasibility gate)

Scope: `client/src/pages/dashboard.tsx` (2,782 lines), `client/src/components/dashboard/enhanced-stats.tsx`, and everything they render into. This builds directly on the prior full-repo audit ([REAL_WORLD_FEATURE_MATRIX.md](./REAL_WORLD_FEATURE_MATRIX.md), [UI_ACTION_AUDIT.md](./UI_ACTION_AUDIT.md)) rather than re-deriving already-established findings.

## Routes
- **Dashboard:** `/dashboard/:section` (wouter), `dashboard.tsx:52-121` maps `params.section` to a `ViewType` union (`dashboard.tsx:49`) via `renderContent()`'s switch (`dashboard.tsx:325`+). The "Dashboard Overview" view is `currentView === "dashboard"`.
- **CEO/Owner Dashboard:** no separate route exists. The `admin`/`client` role sees the same `dashboard` view as everyone else, just with more `visibleNavItems` (sidebar) and more `allowedSections` (dashboard.tsx:95-97). There is no dedicated "CEO 360" screen today — this audit treats the existing `dashboard` view (which the owner/client role already lands on) as the CEO Dashboard, consistent with "existing route must remain unchanged."

## Existing components on the `dashboard` view
- `EnhancedStats` (`enhanced-stats.tsx`) — 4 KPI cards: Total Revenue, Total Bookings, Total Vehicles, Total Drivers. Data: `GET /api/dashboard/stats`, `/api/vehicles`, `/api/drivers`, `/api/bookings`. **None of the 4 cards are clickable today** (no `onClick` anywhere in this file).
- "Upcoming Bookings" `Card` (`dashboard.tsx:352-492`) — single flat table (mobile card view + desktop table view), no tabs, no Today/Tomorrow/Future grouping. Data source: `GET /api/bookings/upcoming` (`dashboard.tsx:301-303`).
- Quick Actions grid (`dashboard.tsx:495-534`) — 3 cards (Add Booking, Manage Fleet, Revenue Report), **already clickable** via `onClick={() => handleViewChange(...)}`.

## Existing APIs already in play on this view
- `GET /api/dashboard/stats` — real aggregation (`storage-mongodb.ts:801-836`), feeds `EnhancedStats`.
- `GET /api/bookings/upcoming` — feeds the current Upcoming Bookings card. **Confirmed stale/narrow**: `storage.getUpcomingBookings()` (`storage-mongodb.ts:766-782`) filters `status: 'confirmed'` only (misses `vehicle_assigned`/`driver_assigned`/`ready_for_dispatch`, all of which are legitimately "upcoming") and compares raw `pickupDate` with no time component.
- `GET /api/operations/upcoming-bookings?days=N` — a **second, separate, more correct** upcoming-bookings implementation (`server/services/upcomingBookings.ts`, `buildUpcomingBookings()`), already used by the standalone `upcoming-bookings.tsx` page (via the sidebar's "Upcoming Bookings" nav item, a different screen from the Dashboard Overview card). This is the exact "different upcoming-booking logic in different components" problem flagged in the CEO dashboard brief — two real implementations already coexist. `buildUpcomingBookings()` correctly uses a local-timezone day boundary (not UTC), a correct pre-dispatch status set (`PRE_DISPATCH` = enquiry…ready_for_dispatch, i.e. everything before `trip_started` and excluding terminal states), and combined date+time comparison. It is capped server-side at `days <= 7` (`routes.ts:1746`), bucketed by day, and returns a **summarized** shape (not full booking documents).
- `GET /api/bookings` — full raw booking list, already fetched by `dashboard.tsx:313-315` for other purposes (vehicle/driver lookups in the existing table). Unbounded (no `.limit()`) — a pre-existing scalability finding, not something this patch introduces or needs to fix.

## Existing permissions relevant to this view
- `usePermissions()` hook (`dashboard.tsx:87`) exposes `canManageFleet`, `canManageDrivers`, `canViewRevenue`, `canDeleteBooking`, `canGenerateInvoice` — already used elsewhere on this page.
- Manager role: `EnhancedStats` already hides the Total Revenue card for `user?.role === 'manager'` (`enhanced-stats.tsx:70`). Sidebar/route-level restriction (`dashboard.tsx:100-108`) blocks managers from the `drivers` view entirely — relevant because a naive "make the Total Drivers card clickable → navigate to /dashboard/drivers" would silently bounce a manager back to the dashboard, which is a real trap to avoid (see safe change plan).

## Existing loading/empty/error states
- `EnhancedStats` has a real loading skeleton (`enhanced-stats.tsx:36-51}`) and a real empty-adjacent state (the "need N more bookings for analytics" banner). No error state — a failed `/api/dashboard/stats` call currently renders stale/zero numbers with no visible error, not a full-page crash (React Query default: `data` stays `undefined`, the component's `?? 0` fallbacks paper over it silently). Not a blank-page risk, but not an honest error state either.
- The existing Upcoming Bookings card has a real, correctly-worded empty state ("No upcoming bookings" / "Create your first booking to get started") for both mobile and desktop layouts.

## Existing responsive behaviour
- `EnhancedStats` grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (3 for manager). Upcoming Bookings card: separate mobile-card-view / desktop-table-view branches, already responsive. Quick Actions: `grid-cols-1 md:grid-cols-3`. This existing responsive foundation is reused, not replaced.

## Confirmed broken/dead actions (carried over from the prior full audit, re-verified against source during this pass)
- `EnhancedStats`'s 4 cards — dead (no click behaviour at all), confirmed above.
- Dashboard Vehicle List / Driver List search boxes and status filters (on the separate `fleet`/`drivers` views, not the `dashboard` view itself) — already documented in [UI_ACTION_AUDIT.md](./UI_ACTION_AUDIT.md), out of scope for this dashboard-only patch since they live on different `ViewType` cases.

## Hardcoded/demo data on this view
None found — every number rendered on the `dashboard` view traces to a real `useQuery` against a real API. (Contrast with the Super Admin panel's two hardcoded-`0` tiles, which are a different screen, out of scope here.)

## Missing backend aggregations needed for the fuller CEO 360 spec
The brief's Sections D–H (Live Operations mini-board, Fleet/Driver status board, Finance overview with cash/UPI/bank split, Lead-source chart, Alerts/Approvals panel) each need either an existing-but-not-yet-wired-in endpoint or a genuinely new one:
- Live Operations bucket counts: **exists** (`GET /api/operations/live-bookings`, already built, not yet wired into this view).
- Fleet/Driver status board (available/on-trip/maintenance/on-leave counts): **derivable** from already-fetched `/api/vehicles`/`/api/drivers` client-side counts (small lists, safe to reduce client-side per the existing `vehicles.filter(...)` pattern already used on the `fleet` view), no new endpoint strictly required for basic counts.
- Finance overview (cash/UPI/bank/card split, driver-cash-pending, vendor payable/receivable): **partially missing** — the payment ledger has `paymentMethod`, so a cash/UPI/bank/card split is derivable from it, but vendor payable/receivable requires a Vendor ledger that [does not exist on this branch](./REAL_WORLD_FEATURE_MATRIX.md) — this sub-piece is genuinely unsafe to build (would be inventing data that doesn't exist).
- Lead-source chart: **derivable** — `Booking.bookingSource` field already exists and is populated (confirmed in `upcomingBookings.ts:58`), a simple aggregation would work.
- Alerts/Approvals panel: **mostly missing** — payment/discount/refund/vendor-settlement approval workflows don't exist as distinct entities anywhere in the schema (per the prior full audit); building this panel would mean inventing an approvals system, which is a new feature, not a dashboard-clickability patch.

## Exact files likely to change in this patch (Phase 1 — see [DASHBOARD_SAFE_CHANGE_PLAN.md](./DASHBOARD_SAFE_CHANGE_PLAN.md) for scope)
- `client/src/components/dashboard/enhanced-stats.tsx` — add click behaviour to the 4 existing cards.
- `client/src/pages/dashboard.tsx` — extend the existing "Upcoming Bookings" Card with Today/Tomorrow/Future/All Upcoming tabs, wire row clicks to the existing `viewingBooking` dialog, add loading/error states.
- `server/services/upcomingBookings.ts` — add one new exported function (existing `buildUpcomingBookings` untouched).
- `server/routes.ts` — add one new route, `GET /api/dashboard/upcoming-bookings`.

No other file needs to change for this phase.
