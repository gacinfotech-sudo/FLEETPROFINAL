# Final Regression Report

Branch: `feature/booking-first-ui-referral-rewards` (off `main @ 594a1cd`, the untouched rollback point). Full suite run in an isolated git worktree (`/tmp/fleetpro-phase7`, port 5054) against the same shared dev MongoDB the rest of this long session has used, so results are read against that DB's accumulated state, not a fresh fixture set.

## Final numbers

**169 passed / 7 failed / 1 skipped** (177 total), `npx playwright test --reporter=list`, single chromium worker.

`npx tsc --noEmit` — clean. `npm run build` — clean.

## Every failure, individually accounted for

None of the 7 failures touch code this initiative added or changed. Each is pre-existing/environmental, evidenced below rather than assumed.

| Test | Cause | Evidence |
|---|---|---|
| `advance-payment.spec.ts` | Fixed-price-button lookup (`₹1500/day`) timed out — depends on which vehicle sorts first in a shared, growing fleet inventory | Documented pre-existing flake class from earlier in this session; test targets a specific price point rather than "any vehicle" |
| `dashboard-upcoming-bookings.spec.ts` | No vehicle/time slot free on the specific hardcoded date across 5 vehicles/5 windows | Direct DB query during this same session confirmed 16+ bookings already scheduled that day against a 17-vehicle fleet — resource exhaustion, not a logic bug. This is the one test in the suite that uses "today" instead of a randomized far-future date. |
| `driver-feedback.spec.ts` | `punctualityRating` expected `4`, got `4.1` | Average-rating drift from accumulated prior test runs against the same driver in the shared dev DB — not a rounding change; this initiative never touched driver-feedback code |
| `driver-overlap.spec.ts` | "Amit must have exactly one active duty" — found 2 | Directly queried the DB: 344 cumulative bookings exist for this one test driver, spread across the test's own ~4970-day randomization window; 62 different days already have 2+ colliding bookings purely from repeated runs over this long-lived session. The test's own code comment already predicts and documents this exact failure mode (a 300-day window collided after ~15 runs; the window was already widened once). Steps 1–4 of the test — the actual product behavior (exclusion from availability, 409 rejection, conflict detail, alternative-driver assignment) — all passed; only the final "nothing else exists anywhere in the DB for this day" assertion hit unrelated leftover data. |
| `google-review.spec.ts` | `POST .../request` returned 502, "WhatsApp session not connected for this tenant" | Environmental: this dev tenant's WhatsApp session was not connected at run time. `pipeline-audit-timeline-clickthrough.spec.ts` (same run, passed) explicitly tests and expects this exact "Not Connected" state as normal for this environment. |
| `raju-acceptance.spec.ts` | Same 502 / WhatsApp-not-connected, one step into a larger scenario | Same root cause as above |
| `review-rewards-campaign.spec.ts` | Same 502 / WhatsApp-not-connected | Same root cause as above |

## What this proves

- Every test this initiative added (`booking-wizard-review-required.spec.ts`, `referral-rewards-engine.spec.ts` — 15 cases including a dedicated cross-tenant isolation test) passed.
- Every test this initiative modified (`navigation.spec.ts`'s new sidebar entry, `invoice-settings.spec.ts` after the race-condition fix) passed.
- No previously-passing test outside this initiative's own files started failing for a reason connected to this initiative's changes.
- The one test-level bug this initiative's own work exposed (`invoice-settings.spec.ts`, a pre-existing `InvoiceSettingsPanel` populate-vs-typing race made newly visible by an extra sibling API call on the same page) was root-caused via commit bisection in an isolated worktree, fixed at both the production-code layer (`hasInteractedRef` guard) and the test layer (`waitForLoadState('networkidle')`), and reconfirmed with 6 consecutive clean runs before being folded into this final suite run.

## Rollback point

`main @ 594a1cd` remains untouched. This branch has not been merged; merging is the user's decision.
