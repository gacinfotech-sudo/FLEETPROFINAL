# FleetPro — Final UI Stabilization & Premium Dashboard Redesign

Date: 2026-08-08 (early IST). Author: final-ui redesign session.

## CANONICAL BASE

- Base commit: `eab3581` — tip of `booking/integration-preview`, the branch behind the
  documented canonical preview (`:5050`, `fleetpro-main`) per
  `docs/manual-preview/FLEETPRO-MANUAL-TEST-DASHBOARD.md`.
- Candidate worktree: `fleetpro-worktrees/final-ui-redesign`, branch
  `ui/final-dashboard-redesign`, dev server verified on port **5210**.

## UI ROOT CAUSES (gap map from the audit)

1. **Sidebar search overflow** — `GlobalCustomerSearch`'s trigger button combined
   `w-full` with its own `mx-3 lg:mx-4`. Full width *plus* horizontal margins overflows
   the fixed sidebar by ~24–32px at every viewport. Structural, not viewport-specific.
2. **Logo not clickable** — the sidebar brand bar and the mobile header title were
   static elements.
3. **Navigation order** — Customers sat ~17 items deep; no Customers submenu; nothing
   prevented future modules from pushing it further down.
4. **Dashboard** — zero charts (recharts installed but unused there); KPI section
   fetched the entire `/api/vehicles`, `/api/drivers`, `/api/bookings` collections
   client-side just to count them; a hardcoded fake **"+0% from last month"** trend;
   `getTenantStats` reported only *available* vehicles/drivers as fleet size (the
   "Total = Available" lie); Upcoming Bookings rendered an unbounded 10-column table;
   Live Operations showed 7 equal-priority tiles; no Attention Required, no Recent
   Customers, no GPS state; `dashboard.tsx` was a 3,206-line monolith.
5. **Dead components** — `layout/header.tsx`, `layout/navbar.tsx`,
   `dashboard/stats-cards.tsx` were never imported anywhere;
   `dashboard/enhanced-stats.tsx` was replaced by the redesign. All four removed.
6. **No layout tokens** — shell geometry (sidebar width, header height, paddings) was
   hard-coded per component.

## DESIGN TOKEN SYSTEM

Added a single app-shell layout contract to `client/src/index.css` (`:root`):
`--sidebar-width`, `--header-height`, `--content-max-width`, `--page-padding-x/y`,
`--section-gap`, `--card-gap`. The sidebar and brand header consume the tokens
(`w-[var(--sidebar-width)]`, `h-[var(--header-height)]`); the dashboard content is
capped at `--content-max-width`. The existing shadcn/Tailwind color tokens
(`--primary`, `--muted-foreground`, chart colors, etc.) remain the color source.

## SIDEBAR FIX

- Search trigger: horizontal inset moved to a sidebar-owned wrapper (`px-3 pt-3`);
  the button itself is `w-full` with no margins. Verified by a permanent geometry
  regression (bounding-box containment) in `tests/e2e/ui-shell-redesign.spec.ts`.
- Consistent 40px row height, unified icon sizing/color, rounded active state
  (`bg-blue-50 text-blue-700` + `aria-current="page"`), visible focus rings,
  tighter submenu spacing, `border-r` on the sidebar, scrollable nav with
  always-visible Logout.

## NAVIGATION ORDER (mandated, permanently regression-tested)

```
Dashboard
Customers        ← group, directly below Dashboard
  All Customers
  Add Customer
Bookings         ← group, directly below Customers
  Add Booking / Live Bookings / Upcoming Bookings / Booking Queues /
  Payment Collection / Booking History
… all other modules after
```

- "Add Customer" routes to the new `customers-add` view: the Customers page with the
  existing Quick Inquiry intake dialog pre-opened. There is deliberately **no** new
  customer-create backend — new customers enter through the canonical inquiry funnel
  (`findOrCreateCustomer`), so no business logic changed.
- Parent group highlights when a child is active; a group with an active child cannot
  be collapsed shut.
- "Payment Collection Due" label shortened to "Payment Collection" (same id/route).

## FLEETPRO LOGO BEHAVIOR

Both the sidebar brand bar and the mobile-header wordmark are now real `<button>`s:
`aria-label="Go to Dashboard"`, pointer cursor, visible focus ring, client-side
navigation via the existing `handleViewChange("dashboard")` (wouter — no full reload).
Covered by a permanent e2e test that returns from Customers, Add Booking, Fleet, and
GPS Tracking.

## DASHBOARD — BEFORE/AFTER ARCHITECTURE

**Before:** 452 lines of inline JSX in `dashboard.tsx`'s `case "dashboard"`, five
page-level queries fetched for every view, plus full-collection downloads for counting.

**After:** one component — `client/src/components/dashboard/overview.tsx` — rendered by
the same case. Structure (desktop 12-col grid; mobile reorders via CSS `order` so
Attention → Upcoming → charts):

1. Header: `Dashboard` + "Live overview of your fleet operations" + exactly 3 actions
   (Add Customer / Create Booking primary / Manage Fleet).
2. Four KPI cards (Revenue·period, Bookings, Vehicles, Drivers) — factual secondary
   metrics only, no invented trends. Revenue hidden for managers (existing permission).
3. Revenue Trend (8 col) — area chart, 7D/30D/90D selector + Fleet Status donut (4 col).
4. Booking Activity single-hue horizontal bars (8 col) + Driver Status donut (4 col).
5. Attention Required (5 col) + Upcoming Bookings compact card (7 col, tabs, **max 3
   rows**, View All).
6. Live Operations strip — 4 tiles max, one-line quiet state when all zero.
7. Live Fleet GPS (7 col) — real device counts when configured, otherwise
   "GPS not connected → Configure GPS" + Recent Customers (5 col, **max 4**, masked
   phone numbers).
8. Quick Actions — exactly 4.

Every widget has its own skeleton loading state (loading ≠ real zero), a compact empty
state with one CTA, per-widget error + Retry, and a React error boundary so one failed
widget cannot take down the Dashboard.

## CHARTS IMPLEMENTED

Library: **recharts** (already a dependency — no new chart library added).

- Revenue Trend — 2-series area/line (Revenue, Collections), 7/30/90-day selector,
  zero-filled daily buckets, legend carries the period totals as text.
- Booking Activity — horizontal single-hue bars over the five status groups
  (pipeline / confirmed / running / completed / cancelled), every enum value mapped to
  exactly one group, direct value labels.
- Fleet Status — donut (Available/On Trip/Maintenance) with center total and an
  always-visible numeric legend; segment and legend clicks drill into the pre-filtered
  Fleet list (existing `goToFleetStatus`).
- Driver Status — donut (Available/On Duty/Inactive), same pattern via
  `goToDriverStatus`.

Chart colors were validated with the dataviz palette validator (CVD ΔE and contrast
checks pass on the white card surface); gray appears only as the *labeled* Inactive
status. Numeric values always accompany every chart — data is never color-alone.

## REAL DATA SOURCES

New aggregated endpoint: **`GET /api/dashboard/overview?days=7|30|90`**
(`server/dashboard/overview.ts`, registered in `routes.ts`). All values from canonical
sources:

- Revenue = completed bookings' `totalAmount` (same definition as the Revenue Report,
  so the KPI can never contradict the page its click opens). Collections = the
  `PaymentTransaction` ledger via the same `RECEIPT_TYPES` as `finance-summary`.
- Fleet/Driver/Booking statuses = DB `$group` aggregations (totals are true totals,
  not "available" masquerading as total).
- Attention items = the same `buildLiveOperations`/`buildPaymentDues` services the Live
  Bookings and Payment Collection pages use, plus maintenance-vehicle and offline-GPS
  counts. Severity-sorted, top 4.
- Recent customers = 4 most recently updated non-deleted `Customer` docs.
- GPS = real `GpsConnection`/`GpsDevice` state; unconfigured tenants get the honest
  "GPS not connected" card, never fake markers.
- Upcoming/Live Ops reuse the existing `/api/dashboard/upcoming-bookings` and
  `/api/operations/live-bookings` endpooints unchanged.

No mock numbers, no fabricated trends anywhere. Fetch count on the Dashboard went from
~8 (several full-collection) to 3 bounded requests.

## VIEW-MORE RULE

One pattern everywhere: card header carries a ghost `View All →` action; list widgets
default to 3 (bookings/attention) or 4 (customers) records. Routes verified by e2e:
Upcoming → `/dashboard/upcoming-bookings`, Booking Activity → `history`, Fleet →
`fleet`, Drivers → `drivers`, Live Ops/Attention → `live-bookings` (or `payment-dues`
per item), Recent Customers → `customers`.

## RESPONSIVE RESULTS

Verified on the real rendered app (Playwright, real login, real data):

| Width | Result |
|---|---|
| 375  | 0px horizontal overflow; KPIs 2-col; Attention/Upcoming above charts |
| 768  | 0px horizontal overflow; 2-col cards |
| 1366 | 0px horizontal overflow; full 12-col grid |
| 1920 | 0px horizontal overflow; content capped at `--content-max-width` |

Screenshots reviewed manually at desktop/mobile (top and scrolled sections).

## CONSOLE RESULTS

Only console entry during login+dashboard: the documented pre-auth `401` from the
"am I logged in?" bootstrap check (already whitelisted by the existing navigation
spec's console-error tracking, which passes). No React key warnings, no chart errors,
no routing errors.

## AUTOMATED REGRESSION

New permanent suite `tests/e2e/ui-shell-redesign.spec.ts` (12 tests, all passing):
logo→Dashboard from 4 routes; sidebar order Dashboard→Customers→Bookings; search
bounding-box geometry; Add Customer intake dialog; grouped-parent active state; charts
render with numeric summaries; Recent Customers ≤4 + View All; 5 View All routes are
real; no horizontal overflow at 375/768/1366/1920.

Updated for the redesign (all passing): `app-shell.spec.ts`, `navigation.spec.ts`
(22 tests), `dashboard-upcoming-bookings.spec.ts` (now also asserts the ≤3-row limit),
`dashboard-finance-and-sources.spec.ts` (API contract unchanged; UI tests target the
Revenue KPI/Trend), and 15 specs that clicked nav "Customers" now click
"All Customers". Also fixed a pre-existing midnight-IST flake (`toISOString()` UTC
dates) in the upcoming-bookings suite. `customer-360`/`customer-segments` re-run green.
`tsc` clean; production build clean.

## REMOVED BY DESIGN (not regressions)

- "Today's Collection" mode-split and "Booking Sources" cards left the Dashboard
  (information-limit rule). Their APIs are unchanged and still covered by tests;
  the data remains on the Revenue Report and via booking history filters.
- The old giant Upcoming table (10 columns, unbounded rows) — replaced by the compact
  card; full detail lives on the Upcoming Bookings page.
- An embedded mini-map was deliberately not added to the GPS card: the QA tenant has no
  configured provider, and the requirement forbids fake markers. The card shows real
  device counts (online / idle / offline) when a provider is configured and the
  config-required state otherwise; the full map remains on the GPS page.

## CANDIDATE COMMIT

See `git log ui/final-dashboard-redesign` — single commit on top of `eab3581`.

## CANONICAL LIVE COMMIT

Promotion target: `booking/integration-preview` (fleetpro-main, `:5050`) via
fast-forward merge of `ui/final-dashboard-redesign`. The dev server (`tsx` watch +
Vite) picks up the merge without manual restart. Recorded below after promotion.

## ROLLBACK

`git -C fleetpro-main reset --hard eab3581` (or `git revert` of the merge commit)
restores the previous UI; no schema/data migrations are involved — the only backend
change is one additive read-only endpoint.
