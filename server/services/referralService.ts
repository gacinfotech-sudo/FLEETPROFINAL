import mongoose from 'mongoose';
import { Customer, Referral, RewardEventRule, type IReferral, type ReferralStatus, type RewardEventKey } from '../models/index';
import { normalizeIndianPhone } from '../whatsapp/phone';
import { creditReferralEventReward, reverseRewardTransactionsByIds } from './rewardService';

const DEFAULT_EVENT_RULES: Record<RewardEventKey, { name: string; points: number; awardTiming: 'immediate' | 'after_booking_completed' }> = {
  'referral.registered': { name: 'Successful Referral Registered', points: 0.5, awardTiming: 'immediate' },
  'referral.booking_confirmed': { name: 'Referred Booking Confirmed', points: 0, awardTiming: 'immediate' },
  'referral.booking_completed': { name: 'Referred Booking Completed', points: 0.5, awardTiming: 'after_booking_completed' },
  'review.verified': { name: 'Verified Review Submitted', points: 0.5, awardTiming: 'immediate' },
};

// A tenant that has never visited reward-event settings still uses these
// in-memory defaults, matching the exact convention getRewardRule already
// established — "no rule configured yet" and "explicitly using the
// defaults" are not different database states to reason about.
export async function getRewardEventRules(tenantId: string) {
  const configured = await RewardEventRule.find({ tenantId });
  const byKey = new Map(configured.map((r) => [r.eventKey, r]));
  return (Object.keys(DEFAULT_EVENT_RULES) as RewardEventKey[]).map((eventKey) => {
    const existing = byKey.get(eventKey);
    if (existing) return existing;
    const def = DEFAULT_EVENT_RULES[eventKey];
    return { tenantId, eventKey, ...def, enabled: true } as any;
  });
}

export async function getRewardEventRule(tenantId: string, eventKey: RewardEventKey) {
  const existing = await RewardEventRule.findOne({ tenantId, eventKey });
  if (existing) return existing;
  const def = DEFAULT_EVENT_RULES[eventKey];
  return { tenantId, eventKey, ...def, enabled: true } as any;
}

function randomCode(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids misread-over-phone ambiguity
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

// Generates on demand rather than for every customer up front (spec §17:
// "optional tenant-scoped referral code for each ELIGIBLE customer") —
// idempotent: a customer who already has one just gets it back unchanged.
export async function generateReferralCode(tenantId: string, customerId: string): Promise<string> {
  const customer = await Customer.findOne({ _id: customerId, tenantId, isDeleted: { $ne: true } });
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  if (customer.referralCode) return customer.referralCode;

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode(6);
    try {
      await Customer.updateOne({ _id: customerId, tenantId }, { $set: { referralCode: code, referralCodeActive: true } });
      return code;
    } catch (error: any) {
      if (error?.code === 11000) continue; // extremely rare collision — retry with a new random code
      throw error;
    }
  }
  throw new Error('Could not generate a unique referral code after 8 attempts.');
}

export async function findReferrerCustomer(
  tenantId: string,
  input: { customerId?: string; mobile?: string; referralCode?: string },
): Promise<any> {
  if (input.customerId) {
    return Customer.findOne({ _id: input.customerId, tenantId, isDeleted: { $ne: true } });
  }
  if (input.referralCode) {
    return Customer.findOne({
      tenantId, isDeleted: { $ne: true },
      referralCode: input.referralCode.trim().toUpperCase(), referralCodeActive: true,
    });
  }
  if (input.mobile) {
    const normalized = normalizeIndianPhone(input.mobile);
    if (!normalized) return null;
    return Customer.findOne({
      tenantId, isDeleted: { $ne: true },
      $or: [{ primaryMobile: normalized }, { alternateMobile: normalized }, { whatsappNumber: normalized }, { phoneAliases: normalized }],
    });
  }
  return null;
}

async function appendStatus(referral: any, status: ReferralStatus, actorId?: string) {
  referral.status = status;
  referral.statusHistory.push({ status, at: new Date(), actorId });
  await referral.save();
}

export interface CaptureReferralInput {
  tenantId: string;
  referrer: { customerId?: string; mobile?: string; referralCode?: string };
  referredCustomerId?: string;
  referredMobile?: string; // used only for the self-referral check when no Customer record exists yet
  referredInquiryId?: string;
  referredLeadId?: string;
  source: IReferral['source'];
  notes?: string;
  actor: { userId: string; role: string };
}

// Fraud/duplicate protection (spec §23): self-referral (same customer or
// same mobile on both sides) and duplicate capture for an already-referred
// customer are both rejected before a Referral row is ever created — the
// partial-unique index on (tenantId, referredCustomerId) backstops the
// duplicate case at the database level too, not just here.
export async function captureReferral(input: CaptureReferralInput): Promise<any> {
  const referrer = await findReferrerCustomer(input.tenantId, input.referrer);
  if (!referrer) throw Object.assign(new Error('Referrer customer not found.'), { status: 404 });

  const referrerMobile = normalizeIndianPhone(referrer.primaryMobile) || referrer.primaryMobile;
  const referredMobileNormalized = input.referredMobile ? normalizeIndianPhone(input.referredMobile) : null;

  const isSelfReferral =
    (!!input.referredCustomerId && input.referredCustomerId === String(referrer._id)) ||
    (!!referredMobileNormalized && referredMobileNormalized === referrerMobile);
  if (isSelfReferral) {
    throw Object.assign(new Error('A customer cannot refer themselves.'), { status: 400, code: 'SELF_REFERRAL' });
  }

  if (input.referredCustomerId) {
    const existingActive = await Referral.findOne({
      tenantId: input.tenantId, referredCustomerId: input.referredCustomerId,
      status: { $nin: ['invalid', 'duplicate', 'self_referral', 'cancelled', 'reversed'] },
    });
    if (existingActive) {
      throw Object.assign(new Error('This customer has already been referred.'), { status: 409, code: 'DUPLICATE_REFERRAL' });
    }
  }

  const referral = await Referral.create({
    tenantId: input.tenantId,
    referrerCustomerId: referrer._id,
    referrerDisplaySnapshot: { name: referrer.name, mobile: referrer.primaryMobile },
    referredCustomerId: input.referredCustomerId,
    referredInquiryId: input.referredInquiryId,
    referredLeadId: input.referredLeadId,
    referralCodeUsed: input.referrer.referralCode,
    source: input.source,
    status: 'captured',
    statusHistory: [{ status: 'captured', at: new Date(), actorId: input.actor.userId }],
    notes: input.notes,
    createdBy: input.actor,
  });

  // "Successful Referral Registered" fires immediately on capture, per the
  // spec's own default preset — not gated on the referred person ever
  // booking anything.
  const rule = await getRewardEventRule(input.tenantId, 'referral.registered');
  if (rule.enabled) {
    const tx = await creditReferralEventReward(
      input.tenantId, String(referrer._id), rule,
      {
        idempotencyKey: `${input.tenantId}_${referral._id}_referral.registered`,
        referralId: String(referral._id),
        reason: `Referral registered (referred: ${input.referredMobile || input.referredCustomerId || 'pending'})`,
        actor: input.actor,
      },
    );
    if (tx) {
      referral.rewardsIssued.registered = true;
      referral.rewardTransactionIds.push(tx._id);
      await referral.save();
    }
  }

  return referral;
}

// Called when a Booking that carries a referral link (Booking.referralId,
// set at booking-creation time) is created/confirmed — links the referral
// forward to a real Booking without ever needing the caller to already
// know the referral's own _id.
export async function linkReferralToBooking(tenantId: string, referralId: string, bookingId: string, actorId?: string) {
  const referral = await Referral.findOne({ _id: referralId, tenantId });
  if (!referral) return null;
  referral.referredBookingId = new mongoose.Types.ObjectId(bookingId);
  await appendStatus(referral, 'booking_confirmed', actorId);
  return referral;
}

// Called from the existing booking-completion path (same place
// creditBookingReward already fires) — additive, no change to that path's
// own behavior for bookings with no linked referral.
export async function markReferralBookingCompleted(tenantId: string, bookingId: string, actor: { userId: string; role: string }) {
  const referral = await Referral.findOne({ tenantId, referredBookingId: bookingId, status: { $ne: 'reversed' } });
  if (!referral) return null;
  await appendStatus(referral, 'booking_completed', actor.userId);

  const rule = await getRewardEventRule(tenantId, 'referral.booking_completed');
  if (rule.enabled && !referral.rewardsIssued.bookingCompleted) {
    const tx = await creditReferralEventReward(
      tenantId, String(referral.referrerCustomerId), rule,
      {
        idempotencyKey: `${tenantId}_${referral._id}_referral.booking_completed`,
        referralId: String(referral._id), bookingId,
        reason: 'Referred customer completed a booking',
        actor,
      },
    );
    if (tx) {
      referral.rewardsIssued.bookingCompleted = true;
      referral.rewardTransactionIds.push(tx._id);
      await referral.save();
    }
  }
  return referral;
}

// Called from the existing booking-cancellation/refund reversal path
// (alongside reverseBookingReward) — reverses every reward this specific
// referral issued via offsetting ledger rows (never edits/deletes the
// original earn transactions), then marks the referral itself reversed so
// it stops counting toward "Confirmed Referrals" reporting.
export async function reverseReferralRewardsForBooking(tenantId: string, bookingId: string, actor: { userId: string; role: string }) {
  const referral = await Referral.findOne({ tenantId, referredBookingId: bookingId, status: { $ne: 'reversed' } });
  if (!referral || referral.rewardTransactionIds.length === 0) return referral;

  await reverseRewardTransactionsByIds(
    tenantId, referral.rewardTransactionIds.map((id) => id.toString()),
    'Referred booking cancelled/refunded', actor,
  );
  await appendStatus(referral, 'reversed', actor.userId);
  return referral;
}
