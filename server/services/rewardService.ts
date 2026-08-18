import mongoose from 'mongoose';
import { Customer, RewardRule, RewardTransaction, LoyaltyTier, Booking, GoogleReviewTracking, type IRewardEventRule } from '../models/index';

const DEFAULT_RULE = {
  earningRatePerAmount: 1,
  earningRateBaseAmount: 100,
  minQualifyingAmount: 0,
  maxPointsPerBooking: undefined as number | undefined,
  expiryDays: undefined as number | undefined,
  redemptionValuePerPoint: 1,
  minPointsToRedeem: 100,
  maxRedemptionPercentOfBooking: 50,
  repeatBookingBonusPoints: 100,
  repeatBookingBonusThreshold: 5,
  referralBonusPoints: 50,
  reviewBonusPoints: 25,
  eligibleBookingStatuses: ['completed', 'closed'],
};

// A tenant that has never visited reward settings still earns/redeems
// points using these defaults — not persisted until the tenant actually
// customizes something, so "no rule configured yet" and "explicitly using
// the defaults" aren't different database states to reason about.
export async function getRewardRule(tenantId: string) {
  const rule = await RewardRule.findOne({ tenantId });
  return rule || { tenantId, ...DEFAULT_RULE };
}

async function getBalance(tenantId: string, customerId: string): Promise<number> {
  const rows = await RewardTransaction.find({ tenantId, customerId }).select('points');
  return rows.reduce((sum, r: any) => sum + r.points, 0);
}

// The one place a reward-ledger row is ever created, so balanceAfter is
// always computed against the true current balance and idempotency is
// enforced in exactly one spot.
async function createTransaction(input: {
  tenantId: string; customerId: string; bookingId?: string;
  transactionType: string; points: number; reason?: string;
  expiryDate?: Date; idempotencyKey?: string; reversalOf?: string;
  createdBy: { userId: string; role: string };
}) {
  if (input.idempotencyKey) {
    const existing = await RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
  }

  // Rounded once, here, at the single choke point every ledger row passes
  // through — so no caller (existing or future) can let binary-float
  // drift accumulate in the ledger, without migrating points'/
  // balanceAfter's underlying Number type. Exact for the halves this
  // project's own examples use (0.5 = 2^-1, exact in IEEE754); this
  // guards owner-configured values like 0.1/0.3 that are not.
  input = { ...input, points: Math.round(input.points * 100) / 100 };

  const session = await mongoose.startSession();
  try {
    let created: any;
    await session.withTransaction(async () => {
      if (input.idempotencyKey) {
        const existing = await RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey }).session(session);
        if (existing) { created = existing; return; }
      }

      const customerQuery: any = { _id: input.customerId, tenantId: input.tenantId };
      // Redemptions/manual debits must never push a balance below zero. A
      // reversal may legitimately do so when already-spent points from a
      // later-cancelled booking become customer debt.
      if (input.points < 0 && input.transactionType !== 'reversal') {
        customerQuery.rewardPointsBalance = { $gte: -input.points };
      }
      const customer = await Customer.findOneAndUpdate(
        customerQuery,
        { $inc: { rewardPointsBalance: input.points } },
        { new: true, session }
      );
      if (!customer) {
        throw Object.assign(new Error('Customer not found or insufficient reward balance.'), { code: 'INSUFFICIENT_POINTS' });
      }

      const [tx] = await RewardTransaction.create([{
        tenantId: input.tenantId,
        customerId: input.customerId,
        bookingId: input.bookingId,
        transactionType: input.transactionType,
        points: input.points,
        balanceAfter: customer.rewardPointsBalance,
        reason: input.reason,
        expiryDate: input.expiryDate,
        idempotencyKey: input.idempotencyKey,
        reversalOf: input.reversalOf,
        createdBy: input.createdBy,
      }], { session });
      created = tx;
    });
    return created;
  } catch (err: any) {
    if (typeof err?.message === 'string' && err.message.includes('Transaction numbers')) {
      // Local/single-node MongoDB does not support transactions. Keep the
      // balance mutation atomic and compensate it if ledger insertion loses
      // an idempotency race or otherwise fails. Production replica sets use
      // the stronger transaction path above.
      if (input.idempotencyKey) {
        const existing = await RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey });
        if (existing) return existing;
      }

      const customerQuery: any = { _id: input.customerId, tenantId: input.tenantId };
      if (input.points < 0 && input.transactionType !== 'reversal') {
        customerQuery.rewardPointsBalance = { $gte: -input.points };
      }
      const customer = await Customer.findOneAndUpdate(
        customerQuery,
        { $inc: { rewardPointsBalance: input.points } },
        { new: true }
      );
      if (!customer) {
        throw Object.assign(new Error('Customer not found or insufficient reward balance.'), { code: 'INSUFFICIENT_POINTS' });
      }

      try {
        return await RewardTransaction.create({
          tenantId: input.tenantId,
          customerId: input.customerId,
          bookingId: input.bookingId,
          transactionType: input.transactionType,
          points: input.points,
          balanceAfter: customer.rewardPointsBalance,
          reason: input.reason,
          expiryDate: input.expiryDate,
          idempotencyKey: input.idempotencyKey,
          reversalOf: input.reversalOf,
          createdBy: input.createdBy,
        });
      } catch (fallbackError: any) {
        // Undo our increment before returning the winner of an idempotency
        // race (or surfacing another ledger failure).
        await Customer.updateOne(
          { _id: input.customerId, tenantId: input.tenantId },
          { $inc: { rewardPointsBalance: -input.points } }
        );
        if (fallbackError?.code === 11000 && input.idempotencyKey) {
          const existing = await RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey });
          if (existing) return existing;
        }
        throw fallbackError;
      }
    }
    if (err?.code === 11000) {
      // Duplicate idempotencyKey — this exact reward was already
      // credited (e.g. a retried request), not a new event. Return the
      // existing transaction instead of erroring the caller.
      const existing = await RewardTransaction.findOne({ idempotencyKey: input.idempotencyKey });
      return existing;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function adjustRewardPoints(
  tenantId: string,
  customerId: string,
  points: number,
  reason: string,
  actor: { userId: string; role: string },
  idempotencyKey?: string,
) {
  return createTransaction({
    tenantId,
    customerId,
    transactionType: points > 0 ? 'manual_credit' : 'manual_debit',
    points,
    reason,
    idempotencyKey,
    createdBy: actor,
  });
}

// Credits points for a completed booking, plus a one-time repeat-booking
// bonus if this booking is the one that crosses the configured threshold.
// Both are idempotency-keyed per booking, so calling this twice for the
// same booking (e.g. completed -> closed both trigger a recompute) never
// double-credits.
export async function creditBookingReward(
  tenantId: string, customerId: string, bookingId: string, bookingAmount: number,
  actor: { userId: string; role: string }, completedBookingCount?: number
) {
  const rule = await getRewardRule(tenantId);
  if (bookingAmount < rule.minQualifyingAmount) return null;

  let points = Math.floor(bookingAmount / rule.earningRateBaseAmount) * rule.earningRatePerAmount;
  if (rule.maxPointsPerBooking) points = Math.min(points, rule.maxPointsPerBooking);
  if (points <= 0) return null;

  const expiryDate = rule.expiryDays ? new Date(Date.now() + rule.expiryDays * 24 * 60 * 60 * 1000) : undefined;
  const tx = await createTransaction({
    tenantId, customerId, bookingId,
    transactionType: 'booking_reward',
    points, expiryDate,
    reason: `Reward for completed booking (₹${bookingAmount})`,
    idempotencyKey: `${tenantId}_${bookingId}_booking_reward`,
    createdBy: actor,
  });

  if (completedBookingCount !== undefined && rule.repeatBookingBonusThreshold
    && completedBookingCount === rule.repeatBookingBonusThreshold && rule.repeatBookingBonusPoints) {
    await createTransaction({
      tenantId, customerId, bookingId,
      transactionType: 'repeat_booking_bonus',
      points: rule.repeatBookingBonusPoints,
      reason: `Bonus for reaching ${rule.repeatBookingBonusThreshold} completed bookings`,
      idempotencyKey: `${tenantId}_${bookingId}_repeat_bonus_${rule.repeatBookingBonusThreshold}`,
      createdBy: actor,
    });
  }

  return tx;
}

// A review bonus is granted for an evidence-confirmed Google review,
// regardless of its rating. Rewarding only positive ratings would create
// review gating; the configured bonus recognizes honest participation.
// The review ID, rather than only the booking ID, is the idempotency unit.
export async function creditVerifiedGoogleReviewReward(
  tenantId: string,
  customerId: string,
  reviewId: string,
  actor: { userId: string; role: string },
) {
  const review = await GoogleReviewTracking.findOne({
    _id: reviewId, tenantId, customerId, reviewReceived: true,
    reviewRating: { $gte: 1, $lte: 5 },
    $or: [
      { reviewLink: { $exists: true, $nin: [null, ''] } },
      { reviewReference: { $exists: true, $nin: [null, ''] } },
    ],
  });
  if (!review) throw Object.assign(new Error('Only an evidence-confirmed Google review can earn review points.'), { status: 400 });

  const rule = await getRewardRule(tenantId);
  // Not floored — reviewBonusPoints is allowed to be fractional (e.g. 0.5,
  // per docs/REWARDS_REFERRAL_CURRENT_AUDIT.md's finding #1: flooring here
  // silently zeroed any owner-configured fractional review bonus).
  // Rounded to 2dp to avoid binary-float drift accumulating across many
  // transactions, without migrating the ledger's underlying Number type.
  const points = Math.round((Number(rule.reviewBonusPoints) || 0) * 100) / 100;
  if (points <= 0) return null;
  const expiryDate = rule.expiryDays ? new Date(Date.now() + rule.expiryDays * 24 * 60 * 60 * 1000) : undefined;
  return createTransaction({
    tenantId, customerId, bookingId: review.bookingId?.toString(),
    transactionType: 'review_bonus', points, expiryDate,
    reason: `Reward for verified Google review (${review.reviewRating}★)`,
    idempotencyKey: `${tenantId}_${review._id}_google_review_bonus`,
    createdBy: actor,
  });
}

// Reverses a booking's reward credit (and any repeat-bonus it triggered)
// when the booking is cancelled after the reward was already given —
// never edits the original row, adds an offsetting 'reversal' instead, so
// the ledger stays a true history of what happened and when.
export async function reverseBookingReward(tenantId: string, customerId: string, bookingId: string, actor: { userId: string; role: string }) {
  const originals = await RewardTransaction.find({
    tenantId, bookingId,
    transactionType: { $in: ['booking_reward', 'repeat_booking_bonus'] },
  });
  const reversals = [];
  for (const original of originals as any[]) {
    const alreadyReversed = await RewardTransaction.findOne({ reversalOf: original._id });
    if (alreadyReversed) continue;
    reversals.push(await createTransaction({
      tenantId, customerId, bookingId,
      transactionType: 'reversal',
      points: -original.points,
      reason: `Reversal of ${original.transactionType} for cancelled booking`,
      reversalOf: original._id.toString(),
      idempotencyKey: `${tenantId}_${original._id}_reversal`,
      createdBy: actor,
    }));
  }
  return reversals;
}

// Same "offsetting reversal row, never edit the original" rule as
// reverseBookingReward above, generalized to an explicit list of
// transaction ids — used by referralService, whose reward transactions
// aren't all reliably findable by a single bookingId (referral.registered
// fires at capture time, before any booking exists).
export async function reverseRewardTransactionsByIds(
  tenantId: string, transactionIds: string[], reason: string, actor: { userId: string; role: string },
) {
  const originals = await RewardTransaction.find({ tenantId, _id: { $in: transactionIds } });
  const reversals = [];
  for (const original of originals as any[]) {
    const alreadyReversed = await RewardTransaction.findOne({ reversalOf: original._id });
    if (alreadyReversed) continue;
    reversals.push(await createTransaction({
      tenantId, customerId: original.customerId.toString(), bookingId: original.bookingId?.toString(),
      transactionType: 'reversal',
      points: -original.points,
      reason,
      reversalOf: original._id.toString(),
      idempotencyKey: `${tenantId}_${original._id}_reversal`,
      createdBy: actor,
    }));
  }
  return reversals;
}

export interface RedeemResult {
  transaction: any;
  discountValue: number;
}

// Pure validation, no DB write — used at booking-creation time to
// compute the discount and apply it to the booking's final price BEFORE
// the booking (and therefore a real bookingId) exists. Deliberately
// separate from commitRedemption below: the redemption ledger
// transaction must never be created against a placeholder bookingId,
// since that would make every redemption on every booking created before
// the real ID exists share the same idempotency key and collide.
export async function previewRedemption(tenantId: string, customerId: string, pointsToRedeem: number, bookingAmount: number): Promise<number> {
  const rule = await getRewardRule(tenantId);
  if (pointsToRedeem < rule.minPointsToRedeem) {
    throw Object.assign(new Error(`Minimum ${rule.minPointsToRedeem} points required to redeem.`), { code: 'BELOW_MINIMUM' });
  }
  const balance = await getBalance(tenantId, customerId);
  if (pointsToRedeem > balance) {
    throw Object.assign(new Error(`Insufficient points: has ${balance}, tried to redeem ${pointsToRedeem}.`), { code: 'INSUFFICIENT_POINTS' });
  }
  const discountValue = pointsToRedeem * rule.redemptionValuePerPoint;
  if (rule.maxRedemptionPercentOfBooking && discountValue > bookingAmount * (rule.maxRedemptionPercentOfBooking / 100)) {
    throw Object.assign(new Error(`Cannot redeem more than ${rule.maxRedemptionPercentOfBooking}% of the booking value.`), { code: 'EXCEEDS_MAX_REDEMPTION' });
  }
  return discountValue;
}

// Creates the actual ledger transaction once a real bookingId exists.
// Idempotency-keyed per booking so retrying the create-booking request
// (e.g. a client-side network retry) can never redeem the same points twice.
// Re-checks the balance right before writing — previewRedemption already
// checked it, but a moment passed (the booking itself got created in
// between), so this catches the same customer being double-redeemed by a
// near-simultaneous request rather than trusting a stale earlier check.
export async function commitRedemption(
  tenantId: string, customerId: string, bookingId: string, pointsToRedeem: number, actor: { userId: string; role: string }
): Promise<RedeemResult['transaction']> {
  const balance = await getBalance(tenantId, customerId);
  if (pointsToRedeem > balance) {
    throw Object.assign(new Error(`Insufficient points at commit time: has ${balance}, tried to redeem ${pointsToRedeem}.`), { code: 'INSUFFICIENT_POINTS' });
  }
  return createTransaction({
    tenantId, customerId, bookingId,
    transactionType: 'redemption',
    points: -pointsToRedeem,
    reason: `Redeemed on booking`,
    idempotencyKey: `${tenantId}_${bookingId}_redemption`,
    createdBy: actor,
  });
}

// Credits a configurable Referral/Review reward event (RewardEventRule) —
// the one place that new, multi-rule engine's points ever actually reach
// the ledger, still funneled through createTransaction above so every
// invariant that function enforces (atomic balance update, idempotency,
// rounding) applies here identically. Enabled/validity/limit checks are
// generic across all four event keys rather than hard-coded per event.
export async function creditReferralEventReward(
  tenantId: string,
  customerId: string,
  rule: Pick<IRewardEventRule, 'eventKey' | 'points' | 'enabled' | 'validFrom' | 'validUntil' | 'maximumPerCustomer' | 'maximumPerMonth'>,
  opts: { idempotencyKey: string; referralId?: string; bookingId?: string; reason: string; actor: { userId: string; role: string } },
): Promise<any> {
  if (!rule.enabled) return null;
  const now = new Date();
  if (rule.validFrom && now < new Date(rule.validFrom)) return null;
  if (rule.validUntil && now > new Date(rule.validUntil)) return null;
  if (rule.points <= 0) return null;

  if (rule.maximumPerCustomer) {
    const customerCount = await RewardTransaction.countDocuments({
      tenantId, customerId, sourceEvent: rule.eventKey, transactionType: { $ne: 'reversal' },
    });
    if (customerCount >= rule.maximumPerCustomer) return null;
  }
  if (rule.maximumPerMonth) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = await RewardTransaction.countDocuments({
      tenantId, sourceEvent: rule.eventKey, transactionType: { $ne: 'reversal' },
      createdAt: { $gte: monthStart },
    });
    if (monthCount >= rule.maximumPerMonth) return null;
  }

  const transactionType = rule.eventKey === 'review.verified' ? 'review_bonus' : 'referral_bonus';
  const tx = await createTransaction({
    tenantId, customerId, bookingId: opts.bookingId,
    transactionType, points: rule.points,
    reason: opts.reason,
    idempotencyKey: opts.idempotencyKey,
    createdBy: opts.actor,
  });
  if (tx && opts.referralId && !(tx as any).sourceEvent) {
    // createTransaction doesn't accept sourceEvent/referralId (kept
    // generic for its other, older callers) — set them in a single
    // follow-up update rather than widening every existing call site's
    // input shape for two optional fields only this caller uses.
    await RewardTransaction.updateOne(
      { _id: (tx as any)._id },
      { $set: { sourceEvent: rule.eventKey, referralId: opts.referralId } }
    );
  }
  return tx;
}

const TIER_DEFAULT = { name: 'Regular', rank: 0, discountPercent: 0, benefits: [] as string[] };

// Picks the highest-rank tier the customer actually qualifies for — a
// tenant with no LoyaltyTier documents configured gets everyone at the
// implicit "Regular" tier rather than an error.
export async function computeLoyaltyTier(tenantId: string, customer: { totalBookings: number; totalSpending: number; rewardPointsBalance: number }) {
  const tiers = await LoyaltyTier.find({ tenantId }).sort({ rank: -1 });
  for (const tier of tiers) {
    const meetsBookings = tier.minTotalBookings === undefined || customer.totalBookings >= tier.minTotalBookings;
    const meetsSpending = tier.minLifetimeSpending === undefined || customer.totalSpending >= tier.minLifetimeSpending;
    const meetsPoints = tier.minRewardPoints === undefined || customer.rewardPointsBalance >= tier.minRewardPoints;
    if (meetsBookings && meetsSpending && meetsPoints) return tier;
  }
  return TIER_DEFAULT;
}
