# Phase 8 — Verified Review Rewards and Pending Campaign Segment

## Delivered

- Evidence-confirmed Google reviews now credit the tenant's existing `reviewBonusPoints` rule through the existing immutable reward ledger.
- Review reward credit is idempotent per Google review record and retry-safe if the ledger write succeeds before the tracking link is saved.
- Reward eligibility is independent of rating: an honestly submitted 1-star review earns the same configured participation bonus as any other verified rating.
- Google review tracking responses expose their linked reward transaction, and Customer Dashboard refreshes both the review and rewards panels after confirmation.
- A computed `Google Review Pending` segment includes active customers with at least one completed, payment-pending, or closed booking that lacks an evidence-confirmed review.
- Campaign creation, editing, preview, and send resolve the same segment definition. Promotional consent, invalid-phone exclusion, and do-not-contact enforcement remain in the existing campaign pipeline.
- Unknown segment keys now fail closed with HTTP 400 instead of accidentally resolving to all customers.

## Database compatibility

- Added only the optional `GoogleReviewTracking.rewardTransactionId` reference.
- Reused existing `RewardRule.reviewBonusPoints`, `RewardTransaction`, `review_bonus`, customer balance, and campaign collections.
- Existing Google review records remain readable; a retried receipt confirmation can backfill a missing reward link safely.
- No destructive migration or source database write is required.

## Verification

- `npm run check`
- `npm run build`
- `git diff --check`
- Targeted Phase 8 Playwright scenario: 1 passed.
- Final clean-database Playwright regression: 51 passed.
- The regression test verifies configured points, 1-star participation reward, one ledger row after retry, pending-segment inclusion/exclusion, unknown-segment rejection, campaign recipient selection, and Customer Dashboard rendering.
- Existing vehicle integration test was stabilized by explicitly closing its nested Booking Details dialog and waiting for the modal state to clear before sidebar navigation.
- Final screenshot: `/Users/pradeep/fleetpro-backups/customer360-baseline-20260805-0030/review-reward-campaign-after-phase8.png`.
- Final automated verification used the session-free isolated database `fleetpro_customer360_phase8_clean_20260805`, restored from the pre-change EJSON backup. The source `fleetpro` database and original Claude workspace were not modified.
