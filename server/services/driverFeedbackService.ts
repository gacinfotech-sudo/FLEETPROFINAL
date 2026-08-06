import { Booking, CustomerComplaint, CustomerFeedback, Driver } from '../models/index';

const completedStatuses = new Set(['completed', 'payment_pending', 'closed']);

function id(value: any) {
  return value?._id?.toString?.() || value?.toString?.();
}

function average(rows: any[], field: string) {
  const values = rows.map((row) => Number(row[field])).filter((value) => value >= 1 && value <= 5);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function feedbackMetrics(rows: any[]) {
  return {
    averageRating: average(rows, 'driverRating'),
    punctualityRating: average(rows, 'driverPunctualityRating'),
    behaviourRating: average(rows, 'driverBehaviourRating'),
    drivingSafetyRating: average(rows, 'driverSafetyRating'),
    routeKnowledgeRating: average(rows, 'driverRouteKnowledgeRating'),
    communicationRating: average(rows, 'driverCommunicationRating'),
    assistanceRating: average(rows, 'driverAssistanceRating'),
    paymentHandlingRating: average(rows, 'driverPaymentHandlingRating'),
    appreciationCount: rows.filter((row) => row.type === 'appreciation').length,
  };
}

function complaintMetrics(rows: any[]) {
  const verifiedDriverFault = rows.filter((row) => row.responsibleParty === 'driver');
  return {
    totalComplaints: rows.length,
    verifiedDriverFaultComplaints: verifiedDriverFault.length,
    unresolvedComplaints: rows.filter((row) => !['resolved', 'closed'].includes(row.status)).length,
    resolvedComplaints: rows.filter((row) => ['resolved', 'closed'].includes(row.status)).length,
    verifiedLateArrivalCount: verifiedDriverFault.filter((row) => row.category === 'driver_late').length,
    behaviourComplaintCount: verifiedDriverFault.filter((row) => row.category === 'driver_behaviour').length,
    drivingSafetyComplaintCount: verifiedDriverFault.filter((row) => row.category === 'rash_driving').length,
    awaitingResponsibilityCount: rows.filter((row) => !row.responsibleParty || row.responsibleParty === 'unclear').length,
  };
}

async function linkedDriverRecords(tenantId: string, driverId: string, bookingIds: any[]) {
  // A direct driverId is the immutable feedback-time assignment. Only fall
  // back to the booking relation for legacy rows that pre-date driverId;
  // otherwise a later booking reassignment could misattribute old feedback.
  const link = { $or: [{ driverId }, { driverId: null, bookingId: { $in: bookingIds } }] };
  const [feedback, complaints] = await Promise.all([
    CustomerFeedback.find({ tenantId, ...link })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation')
      .sort({ createdAt: -1 }).lean(),
    CustomerComplaint.find({ tenantId, ...link })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation')
      .sort({ createdAt: -1 }).lean(),
  ]);
  return { feedback, complaints };
}

export async function buildDriverFeedbackProfile(tenantId: string, driverId: string) {
  const [driver, bookings] = await Promise.all([
    Driver.findOne({ _id: driverId, tenantId }).lean(),
    Booking.find({ tenantId, driverId })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('vehicleId', 'make vehicleModel licensePlate')
      .sort({ pickupDate: -1, createdAt: -1 }).lean(),
  ]);
  if (!driver) return null;
  const bookingIds = bookings.map((booking: any) => booking._id);
  const { feedback, complaints } = await linkedDriverRecords(tenantId, driverId, bookingIds);
  const feedbackByBooking = new Map<string, any[]>();
  const complaintsByBooking = new Map<string, any[]>();
  for (const row of feedback as any[]) {
    const key = id(row.bookingId);
    if (key) feedbackByBooking.set(key, [...(feedbackByBooking.get(key) || []), row]);
  }
  for (const row of complaints as any[]) {
    const key = id(row.bookingId);
    if (key) complaintsByBooking.set(key, [...(complaintsByBooking.get(key) || []), row]);
  }

  const customerIds = new Set(bookings.map((booking: any) => id(booking.customerId)).filter(Boolean));
  const timeline = [
    ...(feedback as any[]).map((row) => ({
      type: row.type === 'appreciation' ? 'appreciation' : 'feedback', date: row.createdAt,
      description: row.comments || `Driver rating ${row.driverRating || '-'} / 5`,
      customer: row.customerId, booking: row.bookingId, recordId: row._id,
      ratings: {
        overall: row.driverRating, punctuality: row.driverPunctualityRating, behaviour: row.driverBehaviourRating,
        safety: row.driverSafetyRating, routeKnowledge: row.driverRouteKnowledgeRating,
        paymentHandling: row.driverPaymentHandlingRating,
      },
    })),
    ...(complaints as any[]).map((row) => ({
      type: 'complaint', date: row.createdAt, description: row.description,
      customer: row.customerId, booking: row.bookingId, recordId: row._id,
      category: row.category, status: row.status, responsibleParty: row.responsibleParty || 'unclear',
      responsibilityReason: row.responsibilityReason,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    driver,
    totalCustomersServed: customerIds.size,
    totalTrips: bookings.length,
    completedTrips: bookings.filter((booking: any) => completedStatuses.has(booking.status)).length,
    noShowCount: bookings.filter((booking: any) => booking.status === 'no_show').length,
    ...feedbackMetrics(feedback),
    ...complaintMetrics(complaints),
    serviceHistory: bookings.map((booking: any) => ({
      booking, customer: booking.customerId, vehicle: booking.vehicleId,
      feedback: feedbackByBooking.get(id(booking)) || [],
      complaints: complaintsByBooking.get(id(booking)) || [],
    })),
    timeline,
  };
}

export async function buildCustomerDriverHistory(tenantId: string, customerId: string) {
  const bookings = await Booking.find({ tenantId, customerId, driverId: { $exists: true, $ne: null } })
    .populate('driverId', 'name phone status')
    .populate('vehicleId', 'make vehicleModel licensePlate')
    .sort({ pickupDate: -1, createdAt: -1 }).lean();
  const bookingIds = bookings.map((booking: any) => booking._id);
  const [feedback, complaints] = await Promise.all([
    CustomerFeedback.find({ tenantId, customerId, bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).lean(),
    CustomerComplaint.find({ tenantId, customerId, bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).lean(),
  ]);
  const groups = new Map<string, any[]>();
  for (const booking of bookings as any[]) {
    const key = id(booking.driverId);
    if (key) groups.set(key, [...(groups.get(key) || []), booking]);
  }
  return [...groups.entries()].map(([driverId, driverBookings]) => {
    const driverBookingIds = new Set(driverBookings.map(id));
    const driverFeedback = feedback.filter((row: any) => row.driverId
      ? row.driverId.toString() === driverId
      : driverBookingIds.has(row.bookingId?.toString()));
    const driverComplaints = complaints.filter((row: any) => row.driverId
      ? row.driverId.toString() === driverId
      : driverBookingIds.has(row.bookingId?.toString()));
    return {
      driver: driverBookings[0].driverId,
      totalTripsServed: driverBookings.length,
      completedTrips: driverBookings.filter((booking: any) => completedStatuses.has(booking.status)).length,
      tripDates: driverBookings.map((booking: any) => ({
        bookingId: booking.bookingId, bookingRecordId: booking._id, pickupDate: booking.pickupDate,
        pickupLocation: booking.pickupLocation, dropoffLocation: booking.dropoffLocation,
      })),
      ...feedbackMetrics(driverFeedback),
      ...complaintMetrics(driverComplaints),
      feedback: driverFeedback,
      complaints: driverComplaints,
    };
  });
}
