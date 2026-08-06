# FleetPro — UI Action Audit

Every entry verified by reading the component source and its wired mutation/query, cross-referenced against the route it calls. Full click→route→API→DB chain was traced for each row; "read code only" items are marked as such where a live browser click-through wasn't performed for that specific control (screenshots of the pages themselves were captured — see [AUDIT_TEST_RESULTS.md](./AUDIT_TEST_RESULTS.md)).

| Screen | Control | Route/API called | Works? | Notes |
|---|---|---|---|---|
| Dashboard | Stat cards (bookings/vehicles/drivers/users) | `GET /api/dashboard/stats` | Yes | Real Mongo aggregation, no hardcoded values |
| Dashboard → Vehicle List | Search box | none applied | **Dead control** | `searchTerm` state exists but the vehicle `.map()` never filters by it |
| Dashboard → Vehicle List | Status filter dropdown | none applied | **Dead control** | No `value`/`onValueChange` wired at all |
| Dashboard → Driver List | Search box | none applied | **Dead control** | Same pattern as Vehicle List |
| Dashboard → Driver List | Status filter dropdown | none applied | **Dead control** | Same pattern |
| Dashboard → Bookings | Search box | filters `bookings` list client-side | Yes | The one list `searchTerm` actually filters |
| Dashboard → Salary tab | Entire tab | none | **Placeholder** | Static "Coming Soon" card; correctly labeled, not a silent failure — real prior implementation present in source but commented out |
| Live Bookings / Upcoming Bookings / Payment Dues | List + status actions | `GET /api/operations/*`, `POST /api/bookings/:id/status` | Yes | Real, well-built bucketing engine |
| Add Booking (enhanced form) | Vehicle dropdown | `GET /api/vehicles/available` | **Misleading** | Populates from a stale/narrow conflict-check endpoint — can show an on-trip vehicle as available (save-time check still blocks the actual double-booking) |
| Add Booking | Driver dropdown | `GET /api/drivers/available` | Yes | Correctly leave-and-conflict-aware |
| Add Booking | Submit / Confirm Booking | `POST /api/bookings` | Yes | Transactional double-booking check, real save |
| Booking Details | Assign Vendor | `POST /api/bookings/:id/assign-vendor` | Yes, but stand-in | Real save, but only flat free-text fields — no vendor master behind it |
| Booking Details | Reschedule / Extend | `POST /api/bookings/:id/reschedule`,`/extend` | Yes | Real, validated, history-tracked |
| Booking Details | Record Payment | `POST /api/bookings/:id/payments` | Yes, with a gap | Real ledger write; no idempotency key wired (double-click risk, see data-risk audit) |
| Booking Details | Status change buttons | `POST /api/bookings/:id/status` | Yes | State-machine validated |
| Booking Details | Delete booking | `DELETE /api/bookings/:id` | Yes, but untracked | Real hard delete; no audit trail of who/when |
| Fleet / View Vehicles | Add/Edit/Delete Vehicle | `POST/PUT/DELETE /api/vehicles` | Yes | Permission-gated, real writes |
| Vehicle Performance | Report view | `GET /api/reports/vehicle-performance` | Yes | Live-computed, not cached |
| Manage Drivers | Add/Edit/Delete Driver | `POST/PUT/DELETE /api/drivers` | Yes | Permission-gated, real writes |
| Driver Attendance | Mark attendance | `POST /api/drivers/:id/attendance` | Yes | Upsert, merges with leave for daily report |
| Driver Leave | Request / Approve / Reject | `POST /api/drivers/:id/leave`, `/api/driver-leaves/:id/approve|reject` | Yes | Approval blocks on conflicting bookings unless explicitly overridden |
| Driver Performance | Report view | `GET /api/reports/driver-performance` | Yes | Live-computed from bookings, comment confirms "nothing stored separately" |
| Customers | Search / open profile | `GET /api/customers` | Yes | Real, capped at 500 results (not true pagination, but bounded) |
| Customer Dashboard | Edit profile fields (pencil icon) | `PUT /api/customers/:id` | Yes | Verified this session's earlier work — safe-merge PATCH, preserves unrelated fields |
| Customer Dashboard | Tap Due amount → Record Payment | `POST /api/bookings/:id/payments` | Yes | Never directly overwrites the due number — ledger transaction only |
| Customer Dashboard | Merge customers | `POST /api/customers/merge` | Yes, but ungated | Works, but no `requirePermission` — any sub-user can trigger it |
| Customer Dashboard | Rewards adjust | `POST /api/customers/:id/rewards/adjust` | Yes, but ungated | Works, but no `requirePermission` |
| Customer Dashboard | Request Google Review | `POST /api/customers/:id/google-reviews/request` | Yes | Real tracking record created |
| Customer Invoices | Preview / Save Draft / Finalize / Revision / Credit Note / Debit Note | `POST/PUT /api/invoices/*` | Yes | Every button wired to a real mutation |
| Customer Invoices | Email/WhatsApp on a **draft** invoice | disabled, `title` tooltip | **Correctly disabled**, not a dead button | Explains why it's disabled instead of silently hiding it — good pattern |
| Customer Invoices | Email/WhatsApp on a **finalized** invoice | `mailto:`/`wa.me` links | Yes, but untracked | Opens staff's own mail/WhatsApp client; no backend send record for invoices specifically |
| Invoice Settings (Profile page) | Save Invoice Settings | `PATCH /api/invoice-settings` | Yes | Verified this session — persists and reloads correctly |
| Campaigns | Create / Preview / Send | `POST /api/campaigns`, `/preview`, `/send` | Yes | Consent re-checked at send time, atomic state transition |
| Manage Expenses | Add/Edit/Delete Expense | `POST/PUT/DELETE /api/expenses` | Yes, but ungated | Works, real writes, feeds vehicle profitability — but zero permission check on any of these routes |
| WhatsApp Panel | Start session / Show QR / Logout | `/api/whatsapp/session/*` | Yes | Real Baileys session lifecycle, per-tenant |
| Manage Users | Add sub-user, set permissions | `POST /api/users/sub-users` | Yes | Real, subscription-limit-checked (`checkManagerLimit`) |
| Manage Users | Deactivate/reactivate sub-user | `PATCH /api/users/:id/...` | Yes, with a gap | Works, but this route skips `requireTenant` (see multi-tenant audit T3) |
| Super Admin Panel | Tenant CRUD, user reset/deactivate, plan management | `/api/admin/*` | Yes | Real cross-tenant capability, correctly `requireAdmin`-gated |
| Super Admin Panel | "Total Vehicles" / "Today's Bookings" tiles | none | **Hardcoded to 0** | Explicit comment: "Would need to aggregate from all tenants" — every other admin metric on the same page is live |
| Sidebar | Nav items below the visible fold (Salary, WhatsApp, Manage Users, Profile at common laptop heights) | — | **Unreachable** | Confirmed via DOM measurement — see [SIDEBAR_SCROLL_DIAGNOSIS.md](./SIDEBAR_SCROLL_DIAGNOSIS.md) |

## Dead / non-functional controls summary

1. Dashboard Vehicle List search box — no-op.
2. Dashboard Vehicle List status filter — no-op.
3. Dashboard Driver List search box — no-op.
4. Dashboard Driver List status filter — no-op.
5. Sidebar nav items past the fold on shorter viewports — physically unreachable (not a JS logic bug, a CSS overflow bug; full diagnosis in its own document).

## Controls that look disabled but are correctly, intentionally disabled (not defects)

- Email/WhatsApp buttons on a draft invoice — visibly present, disabled, with an explanatory tooltip rather than silently hidden or silently failing. This matches the standing "no dead/unclickable buttons without an explanation" requirement correctly.

## No console-error or blank-page regressions observed

The screenshot pass (`GET`-only navigation across Dashboard, Bookings, Fleet, Drivers, Customers, Campaigns, Expenses, WhatsApp, Users, Profile — see [AUDIT_TEST_RESULTS.md](./AUDIT_TEST_RESULTS.md)) did not surface a blank page or an uncaught client-side error on any of the screens visited under the `qaclient` account. This is not a substitute for the full Playwright regression suite (deliberately not run in this read-only audit — see that document for why), but it does rule out the most obvious "page doesn't render at all" class of defect across the main navigation surface.
