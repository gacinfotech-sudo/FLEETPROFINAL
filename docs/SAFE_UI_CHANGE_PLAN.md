# Safe UI Change Plan

Retrospective record of the plan this initiative actually followed (spec §38's phase sequence), for traceability. Each phase was implemented, typechecked, built, tested, and committed independently before the next began — no phase started until the previous one's regression suite was green.

## Phase 0 — Protection
Checkpoint (`main @ 594a1cd`), dedicated branch (`feature/booking-first-ui-referral-rewards`), baseline typecheck/build/full-regression run, route/menu/model/permission inventory — before any product change.

## Phase 1 — Senior Audit
Four evidence-based audit docs (`CURRENT_INTERFACE_AUDIT.md`, `NAVIGATION_COMPLEXITY_AUDIT.md`, `BOOKING_PIPELINE_AUDIT.md`, `REWARDS_REFERRAL_CURRENT_AUDIT.md`), each grounded in file:line citations. Key finding that shaped every later phase: much of the spec's ask was **already built** (Dashboard's "Create New Booking" primacy, Customer→New Booking quick flow, every pipeline transition's data carry-forward, a real reward ledger with idempotency) — the audit exists specifically to stop later phases from rebuilding what already worked.

## Phase 2 — Navigation Simplification
Grouped 5 scattered booking-primary sidebar entries under one collapsible "Bookings" parent. Rendering-only change — every item's id/route/permission-flags/page component untouched. Verified: `navigation.spec.ts` (the established regression contract for "every sidebar item loads and doesn't bounce back") unchanged and green.

## Phase 3 — Connected Workspaces
New `PipelineStepper`/`ContextualActionBar` components, wired into Inquiry/Lead/Booking. Every underlying transition already worked (Phase 1's finding) — this phase added only the presentational "where am I / what's next" layer over them, reusing each page's existing mutations verbatim.

## Phase 4 — Booking Experience
Found the one real gap in the wizard's Previous/Next/Save-Draft machinery (already present): stale vehicle/driver selections could survive a backward date edit. Added revalidation that clears them with a "review required" notice.

## Phase 5 — Rewards/Referral Engine (5a–5d)
- 5a: `Referral`/`RewardEventRule` models + `referralService.ts`, additive alongside the existing, working `RewardRule`/`RewardTransaction`. Fixed a real fractional-points bug found while wiring it.
- 5b: Referral capture UI in Add Booking, kept deliberately separate from the existing Booking Source panel (two different concerns).
- 5c: Customer 360° Referral Summary panel. Found and fixed a real display bug (referrer's own name shown for a pending referred contact).
- 5d: Settings page for both the existing `RewardRule` (never had a UI before this) and the new `RewardEventRule`s. Found and fixed a real pre-existing race in `InvoiceSettingsPanel` that this phase's extra page load exposed.

## Phase 6 — Dashboard
12 real metric cards + Top Referrers, every card with underlying records clickable and opening a real filtered table. New tenant-wide `/api/reward-transactions` route added specifically to back this (every prior rewards route was single-customer-scoped).

## Phase 7 — Final Verification
Full regression suite, a second audit pass against spec §37's completion checklist, an explicit tenant-isolation test (the one completion condition that wasn't yet directly proven), and this document set.

## What stayed untouched throughout
No existing route, field, model, or permission was removed or renamed. The only pre-existing files modified were `sidebar.tsx` (Phase 2, additive grouping), `dashboard.tsx` (import + case-statement additions per phase), `enhanced-booking-form.tsx` (Phase 4 revalidation + Phase 5b capture UI, both additive), `rewardService.ts` (Phase 5a: one bug fix + one new function), `customer-rewards-panel.tsx` (Phase 5c: one validation relaxation), and `invoice-settings-panel.tsx`/its own test (a genuine pre-existing bug this initiative's own added page load exposed, fixed rather than worked around).
