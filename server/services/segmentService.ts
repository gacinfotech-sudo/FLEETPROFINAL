import mongoose from 'mongoose';
import { Customer, Booking, CustomerFeedback, CustomerComplaint, GoogleReviewTracking } from '../models/index';
import { getRewardRule } from './rewardService';

export interface SegmentDefinition {
  key: string;
  label: string;
  count: number;
  query: Record<string, any>; // Mongo filter usable against GET /api/customers-style queries
}

const REAL_BOOKING_STATUSES = [
  'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
  'trip_started', 'ongoing', 'extended', 'return_pending', 'completed', 'closed',
];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// Every count here comes from a real query against the underlying
// collections — nothing is a fixed number.
export async function computeSegments(tenantId: string): Promise<SegmentDefinition[]> {
  const base = { tenantId, isDeleted: { $ne: true } };

  const [
    total, newCount, repeatCount, frequentCount, highValueCount, inactiveCount,
    vip, corporate, selfDrive, religious, airport, outstation,
    inactive30, inactive60, inactive90,
    birthdayThisMonth, anniversaryThisMonth,
  ] = await Promise.all([
    Customer.countDocuments(base),
    Customer.countDocuments({ ...base, customerStatus: 'new' }),
    Customer.countDocuments({ ...base, customerStatus: 'repeat' }),
    Customer.countDocuments({ ...base, customerStatus: 'frequent' }),
    Customer.countDocuments({ ...base, customerStatus: 'high_value' }),
    Customer.countDocuments({ ...base, customerStatus: 'inactive' }),
    Customer.countDocuments({ ...base, customerType: 'vip' }),
    Customer.countDocuments({ ...base, customerType: 'corporate' }),
    Customer.countDocuments({ ...base, customerType: 'self_drive' }),
    Customer.countDocuments({ ...base, customerType: 'religious_traveller' }),
    Customer.countDocuments({ ...base, customerType: 'airport' }),
    Customer.countDocuments({ ...base, customerType: 'outstation' }),
    Customer.countDocuments({ ...base, lastBookingDate: { $lt: daysAgo(30) } }),
    Customer.countDocuments({ ...base, lastBookingDate: { $lt: daysAgo(60) } }),
    Customer.countDocuments({ ...base, lastBookingDate: { $lt: daysAgo(90) } }),
    countByMonthDay(tenantId, 'dateOfBirth'),
    countByMonthDay(tenantId, 'anniversary'),
  ]);

  const [ujjain, omkareshwar] = await Promise.all([
    Customer.countDocuments({ ...base, preferredRoute: { $regex: 'Ujjain', $options: 'i' } }),
    Customer.countDocuments({ ...base, preferredRoute: { $regex: 'Omkareshwar', $options: 'i' } }),
  ]);

  const rule = await getRewardRule(tenantId);
  const rewardEligible = await Customer.countDocuments({ ...base, rewardPointsBalance: { $gte: rule.minPointsToRedeem } });

  const pendingDuesCustomerIds = await pendingDuesCustomers(tenantId);
  const [positiveFeedbackIds, unresolvedComplaintIds, googleReviewPendingIds] = await Promise.all([
    positiveFeedbackCustomers(tenantId),
    unresolvedComplaintCustomers(tenantId),
    googleReviewPendingCustomers(tenantId),
  ]);

  return [
    { key: 'new', label: 'New Customers', count: newCount, query: { customerStatus: 'new' } },
    { key: 'repeat', label: 'Repeat Customers', count: repeatCount, query: { customerStatus: 'repeat' } },
    { key: 'frequent', label: 'Frequent Customers', count: frequentCount, query: { customerStatus: 'frequent' } },
    { key: 'high_value', label: 'High-Value Customers', count: highValueCount, query: { customerStatus: 'high_value' } },
    { key: 'vip', label: 'VIP Customers', count: vip, query: { customerType: 'vip' } },
    { key: 'corporate', label: 'Corporate Customers', count: corporate, query: { customerType: 'corporate' } },
    { key: 'religious', label: 'Religious-Tour Customers', count: religious, query: { customerType: 'religious_traveller' } },
    { key: 'ujjain', label: 'Ujjain Customers', count: ujjain, query: { preferredRoute: 'Ujjain' } },
    { key: 'omkareshwar', label: 'Omkareshwar Customers', count: omkareshwar, query: { preferredRoute: 'Omkareshwar' } },
    { key: 'airport', label: 'Airport Customers', count: airport, query: { customerType: 'airport' } },
    { key: 'outstation', label: 'Outstation Customers', count: outstation, query: { customerType: 'outstation' } },
    { key: 'self_drive', label: 'Self-Drive Customers', count: selfDrive, query: { customerType: 'self_drive' } },
    { key: 'pending_dues', label: 'Customers with Pending Dues', count: pendingDuesCustomerIds.length, query: { _id: pendingDuesCustomerIds } },
    { key: 'inactive_30', label: 'Inactive 30+ Days', count: inactive30, query: { customerStatus: 'inactive' } },
    { key: 'inactive_60', label: 'Inactive 60+ Days', count: inactive60, query: { customerStatus: 'inactive' } },
    { key: 'inactive_90', label: 'Inactive 90+ Days', count: inactive90, query: { customerStatus: 'inactive' } },
    { key: 'birthday_this_month', label: 'Birthday This Month', count: birthdayThisMonth, query: {} },
    { key: 'anniversary_this_month', label: 'Anniversary This Month', count: anniversaryThisMonth, query: {} },
    { key: 'reward_eligible', label: 'Reward Eligible Customers', count: rewardEligible, query: { rewardPointsBalance: { $gte: rule.minPointsToRedeem } } },
    { key: 'positive_feedback', label: 'Customers with Positive Feedback', count: positiveFeedbackIds.length, query: { _id: positiveFeedbackIds } },
    { key: 'unresolved_complaints', label: 'Customers with Unresolved Complaints', count: unresolvedComplaintIds.length, query: { _id: unresolvedComplaintIds } },
    { key: 'google_review_pending', label: 'Google Review Pending', count: googleReviewPendingIds.length, query: { _id: googleReviewPendingIds } },
    { key: 'all', label: 'All Customers', count: total, query: {} },
  ];
}

async function countByMonthDay(tenantId: string, field: 'dateOfBirth' | 'anniversary'): Promise<number> {
  const currentMonth = new Date().getMonth() + 1;
  const rows = await Customer.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), [field]: { $exists: true, $ne: null }, isDeleted: { $ne: true } } },
    { $addFields: { _month: { $month: `$${field}` } } },
    { $match: { _month: currentMonth } },
    { $count: 'total' },
  ]);
  return rows[0]?.total || 0;
}

async function pendingDuesCustomers(tenantId: string) {
  const rows = await Booking.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: { $in: REAL_BOOKING_STATUSES }, customerId: { $exists: true } } },
    { $addFields: { due: { $subtract: ['$totalAmount', { $ifNull: ['$advanceReceived', 0] }] } } },
    { $match: { due: { $gt: 0 } } },
    { $group: { _id: '$customerId' } },
  ]);
  return rows.map((r: any) => r._id);
}

// "Positive" = an average of whichever ratings were given (driver/
// vehicle/service) is 4 or higher on that feedback entry.
async function positiveFeedbackCustomers(tenantId: string) {
  // $avg on an array expression ignores missing/null entries on its own
  // (per Mongo's accumulator semantics) — no need to coalesce unset
  // rating fields first.
  const rows = await CustomerFeedback.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
    { $addFields: { _avg: { $avg: ['$driverRating', '$vehicleRating', '$serviceRating'] } } },
    { $match: { _avg: { $gte: 4 } } },
    { $group: { _id: '$customerId' } },
  ]);
  return rows.map((r: any) => r._id);
}

async function unresolvedComplaintCustomers(tenantId: string) {
  const rows = await CustomerComplaint.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: { $in: ['open', 'in_progress'] } } },
    { $group: { _id: '$customerId' } },
  ]);
  return rows.map((r: any) => r._id);
}

// A customer is pending when at least one financially finished trip has no
// evidence-confirmed Google review. A review on an older trip must not hide a
// newer unreviewed trip from this segment.
async function googleReviewPendingCustomers(tenantId: string) {
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const completedBookings = await Booking.find({
    tenantId: tenantObjectId,
    status: { $in: ['completed', 'payment_pending', 'closed'] },
    customerId: { $exists: true, $ne: null },
  }).select('_id customerId').lean();
  if (!completedBookings.length) return [];

  const reviewedBookingIds = await GoogleReviewTracking.distinct('bookingId', {
    tenantId: tenantObjectId,
    bookingId: { $in: completedBookings.map((booking: any) => booking._id) },
    reviewReceived: true,
  });
  const reviewed = new Set(reviewedBookingIds.map((id: any) => id.toString()));
  const pendingCustomerIds = new Map<string, any>();
  for (const booking of completedBookings as any[]) {
    if (!reviewed.has(booking._id.toString()) && booking.customerId) {
      pendingCustomerIds.set(booking.customerId.toString(), booking.customerId);
    }
  }
  return Customer.find({
    _id: { $in: [...pendingCustomerIds.values()] },
    tenantId: tenantObjectId,
    isDeleted: { $ne: true },
  }).distinct('_id');
}

// Resolves a segment key into an actual Mongo filter against Customer —
// the single source of truth clicking a segment card uses (via GET
// /api/customers?segment=key) to see the SAME customers the count on the
// segment card was computed from, rather than a second, parallel
// definition of what each segment means.
export async function getSegmentFilter(tenantId: string, key: string): Promise<Record<string, any>> {
  switch (key) {
    case 'new': case 'repeat': case 'frequent': case 'high_value': case 'inactive':
      return { customerStatus: key };
    case 'vip': case 'corporate': case 'self_drive': case 'airport': case 'outstation':
      return { customerType: key };
    case 'religious':
      return { customerType: 'religious_traveller' };
    case 'ujjain':
      return { preferredRoute: { $regex: 'Ujjain', $options: 'i' } };
    case 'omkareshwar':
      return { preferredRoute: { $regex: 'Omkareshwar', $options: 'i' } };
    case 'pending_dues': {
      const ids = await pendingDuesCustomers(tenantId);
      return { _id: { $in: ids } };
    }
    case 'inactive_30': return { lastBookingDate: { $lt: daysAgo(30) } };
    case 'inactive_60': return { lastBookingDate: { $lt: daysAgo(60) } };
    case 'inactive_90': return { lastBookingDate: { $lt: daysAgo(90) } };
    case 'birthday_this_month': return { $expr: { $eq: [{ $month: '$dateOfBirth' }, new Date().getMonth() + 1] } };
    case 'anniversary_this_month': return { $expr: { $eq: [{ $month: '$anniversary' }, new Date().getMonth() + 1] } };
    case 'reward_eligible': {
      const rule = await getRewardRule(tenantId);
      return { rewardPointsBalance: { $gte: rule.minPointsToRedeem } };
    }
    case 'positive_feedback': {
      const ids = await positiveFeedbackCustomers(tenantId);
      return { _id: { $in: ids } };
    }
    case 'unresolved_complaints': {
      const ids = await unresolvedComplaintCustomers(tenantId);
      return { _id: { $in: ids } };
    }
    case 'google_review_pending': {
      const ids = await googleReviewPendingCustomers(tenantId);
      return { _id: { $in: ids } };
    }
    case 'all':
      return {};
    default:
      throw Object.assign(new Error(`Unknown customer segment: ${key}`), { status: 400 });
  }
}

// Distinct tags currently in use, with how many customers carry each —
// drives the tag-based segment list in the UI without a hardcoded tag set.
export async function computeTagCounts(tenantId: string) {
  const rows = await Customer.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), isDeleted: { $ne: true }, tags: { $exists: true, $ne: [] } } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r: any) => ({ tag: r._id, count: r.count }));
}
