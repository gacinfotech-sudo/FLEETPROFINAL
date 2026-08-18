# Autonomous Pending Tasks — Professional Booking / Taxi Invoice / Global Filter Initiative

Live task list. Updated as phases complete. See docs/AUTONOMOUS_EXECUTION_PROGRESS.md for the full narrative log.

## Pending (in execution order)

- [ ] Phase 3: Booking usability — progressive sections (daily-use fields first, advanced collapsed), Previous/Next preserving data, Save Draft / Continue Later (reuse Phase 8's BookingDraft), Edit-preserves-unrelated-fields.
- [ ] Phase 4: Route intelligence — tenant-DB-derived Frequent Routes, Route Template master (Settings), route click prefills without auto-assigning driver/vehicle or auto-confirming price.
- [ ] Phase 5: Trip costing — 4 separate distance values (Estimated/Quoted/Actual/Billable KM), odometer/GPS reconciliation with variance + approval, centralized Pricing Service reusing existing Vehicle rate cards.
- [ ] Phase 6: Driver expense integration — customer-chargeable vs internal split, approval workflow, links into Trip Cost Summary.
- [ ] Phase 7: Professional taxi invoice — trip/route/KM/rate line items via the existing Invoice module, GST/non-GST visibility, internal Trip Statement kept separate and permission-gated.
- [ ] Phase 8: Global filter/sort standard — reusable FilterBar, correct default sort per module, server-side pagination, Saved Views, indexes.
- [ ] Phase 9: Verification — typecheck/lint/unit/integration/E2E, tenant isolation, permissions, 10x repeated workflow runs, production build, Git diff review, second + third-pass regression.

## Blocked / external

- Route Estimation Service (§17): needs a configured Maps provider (Google Routes API or equivalent) with real credentials. No such credential exists in this environment. Will build the provider-independent adapter + "Configuration Required" state and continue everything else; documented in docs/EXTERNAL_CONFIGURATION_REQUIRED.md once confirmed against the audit.

## Completed this initiative

- [x] Phase 0: checkpoint commit, dedicated branch, pre-flight typecheck/build.
- [x] Phase 1: all 7 audit docs written from real repo evidence.
- [x] Phase 2: Inquiries/Leads pagination fix, Fleet/Drivers/History search-box isolation, Customer 360 "New Booking", "Use as template", Unknown-number → Quick Inquiry CTA, Global Customer Search (Sidebar) with Customer 360 auto-open. Real search bug (`GET /api/customers` empty-regex-matches-everything) found and fixed. Two pre-existing, unrelated test bugs found and fixed in `invoice-send-gating.spec.ts` (non-unique email; loose "View" substring match) — confirmed pre-existing via `git stash` against the pristine baseline, not caused by this phase's changes. Full project regression suite run after all fixes.
