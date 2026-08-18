# Rewards and Referral — Current State Audit

**Headline finding: a real reward engine already exists and is well-built (immutable ledger, idempotency keys, atomic balance updates, reversals). The gap is narrower than the mega-spec implies — mainly "single hard-coded rule" → "configurable multi-rule," and "no Referral entity at all."** This audit exists specifically to prevent Phase 5 from duplicating what already works.

## What already exists (do not rebuild)

### Models
- `RewardRule` (`server/models/index.ts:1159`) — **one document per tenant** (`unique: true` on `tenantId`). Fields: `earningRatePerAmount`, `earningRateBaseAmount`, `minQualifyingAmount`, `maxPointsPerBooking`, `expiryDays`, `redemptionValuePerPoint`, `minPointsToRedeem`, `maxRedemptionPercentOfBooking`, `repeatBookingBonusPoints`/`Threshold`, `referralBonusPoints`, `reviewBonusPoints`, `eligibleBookingStatuses`.
- `RewardTransaction` (`server/models/index.ts:1206`) — **immutable ledger, exactly matching spec §21's `RewardTransaction` interface in spirit**: signed `points`, `balanceAfter`, `transactionType` enum (`booking_reward`, `repeat_booking_bonus`, `referral_bonus`, `review_bonus`, `campaign_reward`, `redemption`, `expiry`, `manual_credit`, `manual_debit`, `reversal`), `idempotencyKey` with a unique partial index, `reversalOf` self-reference. Balance is never stored as a single editable field on Customer that anything writes directly — `rewardService.ts`'s `createTransaction` is the **only** place a ledger row or `Customer.rewardPointsBalance` is ever mutated, inside a Mongo session/transaction (with a documented non-transactional fallback for single-node dev Mongo).
- `LoyaltyTier` — tenant-configurable rank/threshold tiers, already supports the "loyalty tier" half of spec §27.

### Service (`server/services/rewardService.ts`)
- `creditBookingReward` — awards points on booking completion, idempotency-keyed per booking (`{tenantId}_{bookingId}_booking_reward`), plus a one-time repeat-booking-bonus keyed separately so it can never double-fire.
- `creditVerifiedGoogleReviewReward` — **only** fires for a review with `reviewReceived: true`, a rating, and evidence (link or reference) — already matches spec §24's "do not award merely because a request was sent" requirement.
- `reverseBookingReward` — creates offsetting `reversal` rows (never edits/deletes the original), idempotent per original transaction.
- `previewRedemption` / `commitRedemption` — linear redemption (`points × redemptionValuePerPoint`), minimum-points and max-percent-of-booking guards, balance re-checked at commit time (not just preview time) to close a race window.
- `computeLoyaltyTier` — highest-rank tier a customer qualifies for by bookings/spending/points.

### API
- `GET/PUT /api/reward-rules` (`server/routes.ts:5628`) — read/update the one-per-tenant rule; `PUT` is owner/admin-only. **No dedicated settings UI consumes this yet** (grep of `client/src/` found zero references outside `enhanced-booking-form.tsx`'s redemption preview) — this is a real, clean gap: the backend contract already exists, only the Settings page is missing.
- `GET /api/customers/:id/rewards` — feeds `CustomerRewardsPanel` (`client/src/components/customers/customer-rewards-panel.tsx`), already shown inside Customer 360°.

### Tests already green
`tests/e2e/reward-ledger.spec.ts`, `review-rewards-campaign.spec.ts` — booking-completion earning, manual adjustment, redemption, and verified-review bonuses are all under real test coverage already.

## Genuine gaps (this is what Phase 5 actually needs to build)

### 1. Fractional points are silently broken for review rewards — concrete, fixable bug
`creditVerifiedGoogleReviewReward` (`rewardService.ts:235`): `const points = Math.floor(Number(rule.reviewBonusPoints) || 0);`. If an owner configures `reviewBonusPoints = 0.5` (the spec's own named example), this **floors it to 0** — the review-reward event would silently award nothing. By contrast, `creditBookingReward`'s formula (`Math.floor(bookingAmount / base) * earningRatePerAmount`) only floors the *multiplier*, not the final product, so it already tolerates a fractional `earningRatePerAmount`. **Fix scope: remove the `Math.floor` on `reviewBonusPoints`, add the same fractional support to the new referral event rules.**

### 2. `referralBonusPoints` is a dead field
Defined on the schema, has a default (50), is editable via `PUT /api/reward-rules` — but is **never read** anywhere in `rewardService.ts` or `routes.ts`. No code path awards it. This is not "referral rewards partially work" — it's an unused column. Confirmed via full-repo grep.

### 3. No Referral entity — the actual structural gap
There is no model tracking "Customer A referred Customer B," no referral code, no referral status workflow (Captured → Verified → Booking Confirmed → Completed → Reward Released), no self-referral/duplicate detection. The only trace of "referral" in the whole codebase is a free-text `source: "referral"` option in the Booking Source dropdown (`enhanced-booking-form.tsx:1336`) and Inquiry source tag (`quick-inquiry-form.tsx:18`) — a category label, not a linked-customer relationship with a reward attached. This is exactly the anti-pattern spec §16 warns against ("do not use only free-text names where an existing Customer can be linked") and is the single largest genuinely new build in this initiative.

### 4. Single rule per tenant, not a configurable multi-rule engine
Spec §18 wants named, per-`eventKey` rules with independent `awardTiming`/`holdDays`/`maximumPerCustomer`/`maximumPerMonth`/`validFrom`/`validUntil`/`enabled`. The current `RewardRule` is one flat document mixing booking-earning-rate, redemption terms, and two dead/underused bonus numbers. **Decision for Phase 5: do not migrate or restructure the existing `RewardRule` schema** (it is working, tested, and depended on by `creditBookingReward`/redemption). Instead, add a new, separate, additive collection (e.g. `RewardEventRule`) scoped specifically to the new event-keyed rules (referral.*, review.verified, and optionally repeat_booking/booking.completed as opt-in overrides) — the existing single-rule booking-earn/redemption path keeps working unchanged for tenants who never touch the new settings.

### 5. Redemption is linear only
`previewRedemption`/`commitRedemption` only support `points × redemptionValuePerPoint`. No tiered table (spec §20's `1pt=₹50, 2pt=₹120, 5pt=₹350`) exists. **Decision: add an optional `RedemptionTier` collection; when a tenant has tiers configured, redemption checks tiers first, otherwise falls back to the existing linear calculation** — so linear remains the working default and tiers are additive, not a replacement.

### 6. Decimal safety
Points are stored as plain JS `Number` (IEEE754 double), not Decimal128 or an integer-minor-unit representation. For the spec's own examples (0.5 increments), binary floating point is exact (0.5 = 2⁻¹), so `0.5+0.5+0.5=1.5` will not drift in practice. But an owner-configured value like `0.1` or `0.3` could accumulate drift over many transactions. **Decision: do not migrate the existing `points`/`balanceAfter` fields' underlying type (high risk to a working, tested ledger) — instead, round every new ledger write to 2 decimal places at the point of `createTransaction`, and round every computed balance sum to 2 decimals on read.** This closes the drift risk without touching existing data or its type.

### 7. No customer-facing referral code, no Settings UI, no Rewards/Referral dashboard
Confirmed absent by grep — genuinely new UI, not a duplicate of anything existing.

## What Phase 5 will NOT touch
- `RewardTransaction` schema and its idempotency-key/unique-index mechanism (already correct).
- `createTransaction`'s atomic balance-update + session/fallback logic (already correct, already tested, high-risk to touch).
- `creditBookingReward`'s booking-completion earning path (already correct).
- `RewardRule`'s existing fields and the existing `GET/PUT /api/reward-rules` contract (extended additively with new optional fields only, never removed/renamed fields).
- `LoyaltyTier` (already configurable; Phase 5 reads it, doesn't change it).

## Summary table

| Capability | State | Phase 5 action |
|---|---|---|
| Immutable reward ledger | Already correct | None |
| Idempotency / duplicate-event protection | Already correct | Reuse pattern for new referral events |
| Booking-completion earning | Already correct | None |
| Reversal on cancellation | Already correct | Extend to referral rewards |
| Verified-review earning | Fractional-points bug | Fix: remove `Math.floor` |
| Referral bonus points field | Dead/unused | Wire into new Referral workflow, or supersede with new event-rule engine |
| Referral entity/code/status workflow | Missing entirely | Build (new, additive) |
| Multi-rule, per-event configurable engine | Missing (single flat rule) | Build new `RewardEventRule` collection alongside existing `RewardRule` |
| Tiered redemption | Missing (linear only) | Build new optional `RedemptionTier`, linear stays default |
| Decimal safety for new fractional flows | Not yet addressed | Round to 2dp at write/read, no type migration |
| Settings UI for reward rules | Missing (API exists, no page) | Build new Settings page |
| Rewards/Referral dashboard | Missing | Build new |
