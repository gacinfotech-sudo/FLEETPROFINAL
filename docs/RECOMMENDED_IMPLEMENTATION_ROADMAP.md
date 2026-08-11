# FleetPro — Recommended Implementation Roadmap

Ordered by (impact × how cheap the fix is), not strictly by severity label alone — a P2 that's a one-line change is sequenced before a P1 that's a multi-week subsystem, since the goal is fastest path to a materially more solid product.

## Phase 0 — Branch reconciliation (do this before anything else)

The single highest-leverage action available. Three branches contain real, substantial, already-tested work that isn't part of what this audit evaluated as "the product":
- `feature/vendor-360-patch` — Vendor Master, Vendor Drivers/Vehicles, Vendor Duty, real time-window overlap checking, plus the already-fixed sidebar scroll bug.
- `repair/full-saas-stabilization` — GPS foundation (tenant device/connection/assignment management), plus its own dashboard-stabilization and tenant-data-preservation commits.
- `feature/customer-360-complete` — appears to be an ancestor of the currently-audited invoice branch; confirm it's fully subsumed, not divergent.

**Action:** reconcile these into a single mainline before further feature work, since every subsequent roadmap item below assumes one coherent codebase to patch, not three parallel ones. This is integration + regression-testing effort, not new feature design — the vendor and GPS branches already include their own Playwright specs.

## Phase 1 — Small, high-impact, low-risk fixes (days, not weeks)

Each of these is a narrow, well-understood change with an existing correct pattern elsewhere in the codebase to copy:

1. **Sidebar scroll fix** — one line, already proven correct on another branch. See [SIDEBAR_SCROLL_DIAGNOSIS.md](./SIDEBAR_SCROLL_DIAGNOSIS.md). *(Pending your explicit approval per the audit brief — see the question at the end of this audit.)*
2. **Fix `/api/vehicles/available`** to use the same conflict-check logic already used everywhere else (Gap 6).
3. **Add `requirePermission` to Expenses, customer-merge, rewards-adjust routes**, and to `VIEW_BOOKINGS`/`VIEW_REVENUE`-gated endpoints (Gaps 7–8).
4. **Wire idempotency key into the primary payment-recording endpoint** (Gap 9).
5. **Fix booking creation to verify `vehicleId`/`driverId` tenant ownership** before use (Security finding S7 / Multi-tenant finding T1).
6. **Add `BookingSchema.index({tenantId, customerId, pickupDate})`** (data-risk finding B7).
7. **Fix Dashboard Vehicle/Driver List search and filter controls** to actually filter (currently dead, UI action audit).
8. **Exempt password fields from the general input sanitizer**; require current-password confirmation on self-service password change; normalize the lockout key (Security S1, S4, S5).

## Phase 2 — Medium-effort, real operational gaps (1–3 weeks each)

1. **Vehicle document expiry tracking** (RC/insurance/permit/fitness/PUC) — schema fields, form inputs, an expiry-alert dashboard widget (Gap 3). This is P0 for legal/liability reasons and should be prioritized ahead of some P1 items despite the "medium" sizing.
2. **Driver licence expiry tracking** — same pattern, smaller scope (Gap 4).
3. **Pagination on Bookings and Expenses list endpoints** — both backend and the consuming UI tables (Gap 10 / data-risk B8). Time this before any tenant approaches meaningful booking volume.
4. **Wrap payment-ledger write + balance recompute in a transaction** (data-risk B1).
5. **Make customer phone number unique per tenant** with a migration/normalization pass and duplicate-key handling (data-risk B3).
6. **Centralized audit log (at least for deletes and admin actions)**, and/or convert booking delete to a soft-delete consistent with the existing `Customer.isDeleted` pattern (Gap 11).
7. **Driver cash-settlement reconciliation screen** — investigate and either restore the commented-out salary system or design a dedicated `DriverSettlement` view (Gap 5).
8. **Rate limiting beyond login**, moved to a shared/distributed store ahead of any horizontal scaling (Security S3).

## Phase 3 — Larger subsystems (multi-week, real product decisions needed)

1. **GPS integration** — bring in the already-built foundation from `repair/full-saas-stabilization` and connect it to the dispatch/booking UI (live map, ETA) — the device/connection layer exists but the "show it on a map during booking/dispatch" UI does not yet, even on that branch.
2. **Vendor 360 integration** — bring in `feature/vendor-360-patch` and reconcile with the invoice/customer-360 work that diverged from a different checkpoint.
3. **Tenant-scoped data export** (backup Phase 1 — export only, not full restore) (Gap 12).
4. **SaaS subscription billing automation** — payment gateway integration, webhook-driven plan activation/suspension (Gap 13). This is a business-model decision as much as an engineering one; sequence after the product-completeness gaps above, since billing automation only matters once there's more to sell.
5. **Quotation stage** before booking (Gap 14).

## Phase 4 — Structural, only if the target market requires it

1. **Multi-brand/multi-branch support** (Gap 15 / [MULTI_BRAND_BRANCH_AUDIT.md](./MULTI_BRAND_BRANCH_AUDIT.md)) — this is a genuine re-architecture of the scoping layer used by nearly every route, not a bolt-on. Recommend making this a deliberate go/no-go product decision (is a multi-location operator actually the near-term target customer?) rather than default-building it, since the cost is high and the current single-branch model is a legitimate, well-served product on its own.

## What not to do

- Do not attempt Phase 3/4 items before Phase 0 branch reconciliation — building further on three diverging branches compounds the merge cost every week it's deferred.
- Do not treat the 62/100 overall score (see [SAAS_READINESS_SCORE.md](./SAAS_READINESS_SCORE.md)) as a signal to rewrite the core booking/payment/invoice/CRM engine — that part of the product is genuinely well-built and evidence-backed; the score is dragged down by whole missing/unmerged subsystems, not by weak foundations in what exists.
