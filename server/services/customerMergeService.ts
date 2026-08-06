import mongoose from 'mongoose';
import {
  Booking, CampaignRecipient, Customer, CustomerBillingProfile, CustomerComplaint, CustomerConsentEvent, Invoice,
  CustomerFeedback, CustomerFollowUp, CustomerMerge, CustomerRequirement, GoogleReviewTracking,
  CustomerTagEvent, RewardTransaction, WhatsAppMessage,
} from '../models/index';
import { normalizeIndianPhone } from '../whatsapp/phone';
import { recomputeCustomerStats } from './customerService';
import { computeLoyaltyTier } from './rewardService';

const compact = (values: Array<string | undefined | null>) => [...new Set(values.filter(Boolean) as string[])];
const normalizedText = (value?: string) => value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function customerPhones(customer: any) {
  return compact([
    normalizeIndianPhone(customer.primaryMobile), normalizeIndianPhone(customer.alternateMobile),
    normalizeIndianPhone(customer.whatsappNumber), ...(customer.phoneAliases || []).map(normalizeIndianPhone),
  ]);
}

function customerEmails(customer: any) {
  return compact([customer.email, ...(customer.emailAliases || [])]).map(normalizedText).filter(Boolean);
}

function customerGstNumbers(customer: any) {
  return compact([customer.gstNumber, ...(customer.gstAliases || [])]).map(normalizedText).filter(Boolean);
}

function customerCompanies(customer: any) {
  return compact([customer.companyName, ...(customer.companyAliases || [])]).map(normalizedText).filter(Boolean);
}

function matchReasons(customer: any, candidate: any) {
  const reasons: string[] = [];
  const phones = new Set(customerPhones(customer));
  if (customerPhones(candidate).some((phone) => phones.has(phone))) reasons.push('mobile');
  const emails = new Set(customerEmails(customer));
  if (customerEmails(candidate).some((value) => emails.has(value))) reasons.push('email');
  const gstNumbers = new Set(customerGstNumbers(customer));
  if (customerGstNumbers(candidate).some((value) => gstNumbers.has(value))) reasons.push('gst');
  const companies = new Set(customerCompanies(customer));
  if (customerCompanies(candidate).some((value) => companies.has(value))) reasons.push('company');
  return reasons;
}

export async function findDuplicateCandidates(tenantId: string, customerId: string) {
  const customer = await Customer.findOne({ _id: customerId, tenantId, isDeleted: { $ne: true } }).lean();
  if (!customer) return null;
  const phones = customerPhones(customer);
  const conditions: Record<string, any>[] = [];
  if (phones.length) conditions.push(
    { primaryMobile: { $in: phones } }, { alternateMobile: { $in: phones } },
    { whatsappNumber: { $in: phones } }, { phoneAliases: { $in: phones } },
  );
  for (const email of customerEmails(customer)) conditions.push({ email: new RegExp(`^${escaped(email)}$`, 'i') }, { emailAliases: email });
  for (const gst of customerGstNumbers(customer)) conditions.push({ gstNumber: new RegExp(`^${escaped(gst)}$`, 'i') }, { gstAliases: gst });
  for (const company of customerCompanies(customer)) conditions.push({ companyName: new RegExp(`^${escaped(company)}$`, 'i') }, { companyAliases: company });
  if (!conditions.length) return { customer, candidates: [] };

  const candidates = await Customer.find({
    _id: { $ne: customer._id }, tenantId, isDeleted: { $ne: true }, $or: conditions,
  }).limit(20).lean();
  const enriched = await Promise.all(candidates.map(async (candidate: any) => {
    const bookings = await Booking.find({ tenantId, customerId: candidate._id })
      .select('bookingId pickupDate pickupLocation dropoffLocation totalAmount advanceReceived status')
      .sort({ pickupDate: -1 }).lean();
    const pendingDue = bookings
      .filter((booking: any) => !['cancelled', 'no_show'].includes(booking.status))
      .reduce((sum: number, booking: any) => sum + Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0)), 0);
    return { ...candidate, matchReasons: matchReasons(customer, candidate), pendingDue, recentBookings: bookings.slice(0, 5) };
  }));
  return { customer, candidates: enriched.filter((candidate) => candidate.matchReasons.length > 0) };
}

function fillMissing(target: any, source: any) {
  const result = { ...(target || {}) };
  for (const [key, value] of Object.entries(source || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (result[key] === undefined || result[key] === null || result[key] === '') result[key] = value;
  }
  return result;
}

export async function mergeCustomers(input: {
  tenantId: string;
  sourceCustomerId: string;
  targetCustomerId: string;
  reason: string;
  actor: { userId: string; role: string };
}) {
  const { tenantId, sourceCustomerId, targetCustomerId, actor } = input;
  const reason = input.reason.trim();
  if (!mongoose.isValidObjectId(sourceCustomerId) || !mongoose.isValidObjectId(targetCustomerId)) {
    throw Object.assign(new Error('Invalid customer ID.'), { status: 400 });
  }
  if (sourceCustomerId === targetCustomerId) {
    throw Object.assign(new Error('Source and target customers must be different.'), { status: 400 });
  }
  if (reason.length < 5) throw Object.assign(new Error('A merge reason of at least 5 characters is required.'), { status: 400 });

  let audit: any = await CustomerMerge.findOne({ tenantId, sourceCustomerId });
  if (audit?.status === 'completed') {
    if (audit.targetCustomerId.toString() !== targetCustomerId) {
      throw Object.assign(new Error('This customer was already merged into a different customer.'), { status: 409 });
    }
    return audit;
  }

  const [source, target] = await Promise.all([
    Customer.findOne({ _id: sourceCustomerId, tenantId }),
    Customer.findOne({ _id: targetCustomerId, tenantId, isDeleted: { $ne: true } }),
  ]);
  if (!source || !target) throw Object.assign(new Error('Source or target customer not found.'), { status: 404 });
  if (source.mergedIntoCustomerId && source.mergedIntoCustomerId.toString() !== targetCustomerId) {
    throw Object.assign(new Error('Source customer was already merged into a different customer.'), { status: 409 });
  }

  if (!audit) {
    audit = await CustomerMerge.create({
      tenantId, sourceCustomerId, targetCustomerId, reason, performedBy: actor, status: 'in_progress',
    });
  } else {
    audit.status = 'in_progress';
    audit.targetCustomerId = new mongoose.Types.ObjectId(targetCustomerId);
    audit.reason = reason;
    audit.error = undefined;
    await audit.save();
  }

  try {
    const movedCounts: Record<string, number> = {};
    const move = async (name: string, model: any) => {
      const result = await model.updateMany(
        { tenantId, customerId: source._id },
        { $set: { customerId: target._id } },
      );
      movedCounts[name] = result.modifiedCount;
    };

    await move('bookings', Booking);
    await move('rewards', RewardTransaction);
    await move('tagEvents', CustomerTagEvent);
    await move('feedback', CustomerFeedback);
    await move('complaints', CustomerComplaint);
    await move('followUps', CustomerFollowUp);
    await move('requirements', CustomerRequirement);
    await move('consentEvents', CustomerConsentEvent);
    await move('messages', WhatsAppMessage);
    await move('billingProfiles', CustomerBillingProfile);
    await move('invoices', Invoice);
    await move('googleReviews', GoogleReviewTracking);

    let movedCampaignRecipients = 0;
    let retainedSourceCampaignRecipients = 0;
    const sourceRecipients = await CampaignRecipient.find({ tenantId, customerId: source._id }).select('_id campaignId');
    for (const recipient of sourceRecipients) {
      const collision = await CampaignRecipient.exists({ campaignId: recipient.campaignId, customerId: target._id });
      if (collision) {
        // Preserve both immutable campaign delivery records. The source
        // customer remains as a merge tombstone, so this reference is valid.
        retainedSourceCampaignRecipients++;
      } else {
        await CampaignRecipient.updateOne({ _id: recipient._id }, { $set: { customerId: target._id } });
        movedCampaignRecipients++;
      }
    }
    movedCounts.campaignRecipients = movedCampaignRecipients;

    const targetObject: any = target.toObject();
    const sourceObject: any = source.toObject();
    const phoneAliases = compact([...customerPhones(targetObject), ...customerPhones(sourceObject)])
      .filter((phone) => phone !== target.primaryMobile && phone !== target.alternateMobile && phone !== target.whatsappNumber);
    const emailAliases = compact([
      ...(target.emailAliases || []), ...(source.emailAliases || []),
      source.email && normalizedText(source.email) !== normalizedText(target.email) ? source.email.toLowerCase() : undefined,
    ]);
    const gstAliases = compact([
      ...(target.gstAliases || []), ...(source.gstAliases || []),
      source.gstNumber && normalizedText(source.gstNumber) !== normalizedText(target.gstNumber) ? source.gstNumber.toUpperCase() : undefined,
    ]);
    const companyAliases = compact([
      ...(target.companyAliases || []), ...(source.companyAliases || []),
      source.companyName && normalizedText(source.companyName) !== normalizedText(target.companyName) ? source.companyName : undefined,
    ]);
    const conservativeConsent = {
      whatsapp: target.consent?.whatsapp !== false && source.consent?.whatsapp !== false,
      promotional: target.consent?.promotional === true && source.consent?.promotional === true,
      email: target.consent?.email !== false && source.consent?.email !== false,
      sms: target.consent?.sms !== false && source.consent?.sms !== false,
    };
    const restrictedStatus = [target.status, source.status].includes('blacklisted')
      ? 'blacklisted'
      : [target.status, source.status].includes('do_not_contact') ? 'do_not_contact' : target.status;
    const basicFields = [
      'alternateMobile', 'whatsappNumber', 'email', 'dateOfBirth', 'anniversary', 'address', 'city', 'state',
      'pinCode', 'companyName', 'gstNumber', 'emergencyContact', 'preferredLanguage', 'photoUrl',
    ];
    const targetUpdate: Record<string, any> = {
      phoneAliases, emailAliases, gstAliases, companyAliases, tags: compact([...(target.tags || []), ...(source.tags || [])]),
      consent: conservativeConsent, status: restrictedStatus,
      billing: fillMissing(targetObject.billing, sourceObject.billing),
      preferences: fillMissing(targetObject.preferences, sourceObject.preferences),
      updatedBy: actor, updatedAt: new Date(),
    };
    for (const field of basicFields) {
      if (!targetObject[field] && sourceObject[field]) targetUpdate[field] = sourceObject[field];
    }
    await Customer.updateOne({ _id: target._id, tenantId }, { $set: targetUpdate });

    const recomputed = await recomputeCustomerStats(targetCustomerId);
    if (!recomputed) throw new Error('Could not recompute canonical customer statistics.');
    const rewardRows = await RewardTransaction.find({ tenantId, customerId: target._id }).select('points');
    recomputed.rewardPointsBalance = rewardRows.reduce((sum: number, row: any) => sum + row.points, 0);
    const tier = await computeLoyaltyTier(tenantId, recomputed);
    recomputed.loyaltyTier = tier.name;
    await recomputed.save();

    source.isDeleted = true;
    source.status = 'inactive';
    source.mergedIntoCustomerId = target._id;
    source.mergedAt = new Date();
    source.updatedBy = actor;
    await source.save();

    audit.status = 'completed';
    audit.movedCounts = movedCounts;
    audit.retainedSourceCampaignRecipients = retainedSourceCampaignRecipients;
    audit.completedAt = new Date();
    audit.error = undefined;
    await audit.save();
    return audit;
  } catch (error: any) {
    audit.status = 'failed';
    audit.error = String(error?.message || error).slice(0, 500);
    await audit.save();
    throw error;
  }
}
