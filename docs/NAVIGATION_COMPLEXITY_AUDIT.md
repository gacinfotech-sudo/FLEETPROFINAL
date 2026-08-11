# Navigation Complexity Audit

## Finding 1 — Flat 26-item sidebar with no grouping

**Current:** `client/src/components/layout/sidebar.tsx`'s `navItems` is a single flat array rendered as one unbroken list of buttons. No sections, no collapsing, no visual grouping beyond icon+label.
**Expected:** Booking-related items grouped under one parent; resource-management, CRM-pipeline, finance, and admin items each recognizable as their own cluster.
**Root cause:** The sidebar was built incrementally, one `navItems.push`-equivalent per feature, across many prior phases of this project, with no information-architecture pass since.
**Severity:** P1 (usability, not correctness — nothing is broken, but every new booking-adjacent feature this project has added has made the list longer, not better organized).
**Regression risk of fixing:** Low, if done as a rendering-only change (group headers + collapsible sections wrapping the *same* `navItems` entries, same `onClick` handlers, same `currentView`/`ViewType` values) rather than restructuring the underlying view-switch logic.

## Finding 2 — No single "Bookings" parent despite 5 booking-primary views existing

**Current:** Live Bookings, Upcoming Bookings, Payment Collection Due, Add Booking, Booking History are five separate top-level sidebar entries, each a distinct `ViewType` value, each rendered by its own page component (`live-bookings.tsx`, `upcoming-bookings.tsx`, `payment-dues.tsx`, the `bookings` case inline in `dashboard.tsx`, and the `history` case inline in `dashboard.tsx`).
**Expected (spec §6):** One "Bookings" parent, these five as children.
**Classification:** DUPLICATED navigation exposure of what is conceptually one domain — not duplicated *data* or *logic* (each page already queries the same `Booking` collection with different filters; this is not a second booking system, just five unrelated menu entries pointing at filtered views of one collection).
**Safe patch:** Add a collapsible "Bookings" group in the sidebar containing these five as sub-items (plus, per spec, a "Draft Bookings" view — `BookingDraft` model already exists at `server/models/index.ts` `IBookingDraft`, with a `GET`/`PUT`/`DELETE /api/booking-drafts/mine` route already in `routes.ts`, but currently only ever surfaces as an auto-resume prompt inside the booking wizard, never as a browsable list. Adding a "Draft Bookings" list view is new UI on top of an existing, already-tested backend — additive, not duplicative). "Booking Templates" and "Booking Reports" from the spec's suggested tree do not have an existing backing feature; these will be scoped out or added as thin filtered views in a later phase, not fabricated now.
**Regression risk:** None to data/routes if each child continues to route to its existing `ViewType`/page unchanged; only the sidebar's presentation changes.

## Finding 3 — `restrictedForManagers` and `adminOnly` flags are per-item, not per-group

**Current:** Each `navItems` entry independently carries `restrictedForManagers?: boolean` / `adminOnly?: boolean`, checked in `Sidebar`'s `visibleNavItems` filter (`sidebar.tsx`).
**Implication for grouping:** A "Bookings" group must NOT simply hide/show as a unit — e.g. "Payment Collection Due" is not `restrictedForManagers` today while "Vendor Settlement" is. Grouping must preserve each child's existing individual visibility rule; only a group whose *every* child is hidden for a role should itself collapse away. This is a concrete implementation constraint for Phase 2, not just a cosmetic note.

## Finding 4 — `navigation.spec.ts`'s hardcoded page list is the single source of navigation-regression truth

`tests/e2e/navigation.spec.ts`'s `SIDEBAR_PAGES` array independently duplicates the full page list and asserts each loads without bouncing back. This test caught a real gap earlier this project (Vendor Settlement was added to the sidebar but not to this list). Any Phase 2 sidebar restructuring must keep every existing entry in this test passing — it is treated as the regression contract for "no route silently stopped working," per spec §31.

## Finding 5 — No duplicate *modules* found

Explicitly checked for and did not find: a second booking creation flow, a second customer list, a second CRM, a second rewards balance field, or a second referral concept. The only near-duplicate is conceptual (5 booking views under different top-level names, Finding 2), not structural. This means Phase 2 is a pure reorganization task, not a de-duplication/migration task — lower risk than the spec's framing implies for *this* codebase specifically.

## Summary table

| Issue | Classification | Severity | Fix type |
|---|---|---|---|
| Flat 26-item sidebar | CONFUSING | P1 | Rendering-only grouping |
| 5 booking views as separate top-level items | DUPLICATED (nav only) | P1 | Rendering-only grouping into "Bookings" parent |
| No browsable Draft Bookings view | MISSING_NEXT_ACTION | P2 | New thin view over existing API |
| Per-item permission flags must survive grouping | (constraint, not a bug) | — | Design constraint for Phase 2 |
| navigation.spec.ts is the regression contract | (process note) | — | Must stay green throughout Phase 2 |
