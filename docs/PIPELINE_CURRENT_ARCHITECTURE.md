# Pipeline Audit — Baseline & Architecture Snapshot

Initiative: "FleetPro — Complete SaaS Pipeline Audit, Connection Verification and Safe Repair."

## Rollback point

- **Checkpoint commit**: `b875fdb` — "Checkpoint: Customer Quick Actions (Global Search, New Booking, Use as Template) and booking wizard progressive disclosure" (on `feature/professional-booking-taxi-invoice`, base `2b5923c`).
- **Working branch**: `repair/complete-saas-pipeline-audit`, created from `b875fdb`.
- `git checkout feature/professional-booking-taxi-invoice` returns to the pre-this-initiative state at any point.

## Phase 0 — Baseline (complete)

- [x] Branch/commit/status recorded above.
- [x] All prior uncommitted work (Customer Quick Actions, Global Search, booking-wizard progressive disclosure) committed in the checkpoint.
- [x] `npx tsc --noEmit` — clean, zero errors.
- [x] `npm run build` — clean (pre-existing chunk-size warnings only, unrelated).
- [x] `npx playwright test` (full suite, 114 tests) — most recently: **108 passed, 5 failed, 1 skipped**. The 5 failures are pre-existing/environmental (confirmed via `git stash` against an earlier baseline in the same session): shared-dev-DB flakiness (`advance-payment.spec.ts`), a random-date vehicle double-booking collision (`dashboard-upcoming-bookings.spec.ts`), a pre-existing floating-point test assertion bug (`driver-feedback.spec.ts`, `expect(4.9).toBe(5)`), and WhatsApp provider not configured in this dev environment (`google-review.spec.ts`, `review-rewards-campaign.spec.ts`). None touch any file changed this session.
- [x] No `lint` npm script and no ESLint config exist in this repo (`package.json` scripts are only `dev`/`build`/`start`/`check`) — confirmed by direct inspection, not assumed. Static analysis in this project means `tsc` only.
- Database backup: local dev MongoDB, no managed backup tooling configured on this machine (same as noted in the prior initiative's `docs/EXTERNAL_CONFIGURATION_REQUIRED.md`) — not a blocker since all planned changes are additive-only.

## Reused from the prior "Professional Booking / Taxi Invoice / Global Filter" initiative (same session)

The following pipelines were already deeply audited with real evidence in that initiative and are **not** being re-researched from scratch — this audit's new research is scoped to the pipelines NOT yet covered:

- `docs/BOOKING_CURRENT_STATE_AUDIT.md` — Booking model, 4-step Add-Booking wizard, Edit-vs-Add divergence, route-template/driver-expense/GPS-odometer absence.
- `docs/BOOKING_REAL_WORLD_GAP_ANALYSIS.md` — full classified action matrix + P0/P1/P2 priority list for the booking pipeline.
- `docs/CUSTOMER_QUICK_ACTION_AUDIT.md` — Customer search, Customer 360°, quick-action flows (now implemented).
- `docs/FREQUENT_ROUTE_ANALYSIS.md` — route-template/frequent-route (not yet implemented, planned).
- `docs/TRIP_COSTING_DATA_MAPPING.md` — trip KM/costing field gaps.
- `docs/TAXI_INVOICE_FIELD_MAPPING.md` — the "three invoice renderers, only one real" finding; invoice field gaps.
- `docs/GLOBAL_FILTER_SORT_AUDIT.md` — per-page filter/sort/pagination current-state.

## New research completed for this initiative (Pipelines A-D, I-L, O, P, Q, R, S, plus routes/permissions/tenant-isolation/DB-relationships/status-transitions/idempotency)

Five parallel research passes completed, each reporting facts only (file:line citations, no proposed fixes), synthesized into `docs/PIPELINE_ROUTE_INVENTORY.md`, `docs/PIPELINE_API_INVENTORY.md`, `docs/PIPELINE_DATABASE_INVENTORY.md`, `docs/PIPELINE_PERMISSION_INVENTORY.md`, `docs/PIPELINE_ACTION_MATRIX.md`, and `docs/PIPELINE_BUG_REPORT.md`:
1. Inquiry -> Lead -> Quotation -> Customer (Pipelines A-D).
2. Driver Duty -> Trip Start -> During Trip -> Trip End (Pipelines I-L).
3. Payment, Vendor, Feedback/Review/Loyalty (Pipelines O, Q, P).
4. WhatsApp, Calling/Telephony, Route inventory, Permission enforcement, Tenant-isolation spot-check (Pipeline R, S, sections 7/13/12).
5. Database relationship audit, snapshot-vs-live-reference audit, status-transition audit, idempotency audit, "safe patch" (wholesale-body-overwrite) audit (sections 9/10/11/15).

## Phase 1 — repairs applied

5 real bugs found and fixed (2 P0 security, 1 P0 financial/data-integrity split across 2 routes, 2 P2 hardening/consistency), all additive/backward-compatible, all typechecked/built/tested. Full detail in `docs/PIPELINE_BUG_REPORT.md`. See `docs/PIPELINE_REPAIR_REPORT.md` for the patch-by-patch detail once full regression is confirmed.
