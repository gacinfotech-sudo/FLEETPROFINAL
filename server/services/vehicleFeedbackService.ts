import { Booking, CustomerComplaint, CustomerFeedback, Vehicle } from '../models/index';

const completedStatuses = new Set(['completed', 'payment_pending', 'closed']);
const vehicleIssueCategories = new Set(['vehicle_problem', 'vehicle_cleanliness', 'vehicle_breakdown', 'ac_problem', 'wrong_vehicle', 'self_drive_issue']);

function id(value: any) {
  return value?._id?.toString?.() || value?.toString?.();
}

function average(rows: any[], field: string) {
  const values = rows.map((row) => Number(row[field])).filter((value) => value >= 1 && value <= 5);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function bookingKilometers(booking: any) {
  const start = Number(booking.startOdometer);
  const end = Number(booking.endOdometer);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return end - start;
  const stored = Number(booking.totalKilometers);
  return Number.isFinite(stored) && stored >= 0 ? stored : 0;
}

function feedbackMetrics(rows: any[]) {
  return {
    averageVehicleRating: average(rows, 'vehicleRating'),
    cleanlinessRating: average(rows, 'vehicleCleanlinessRating'),
    comfortRating: average(rows, 'vehicleComfortRating'),
    acRating: average(rows, 'vehicleAcRating'),
    conditionRating: average(rows, 'vehicleConditionRating'),
    feedbackCount: rows.length,
    appreciationCount: rows.filter((row) => row.type === 'appreciation').length,
    feedbackIssueCount: rows.filter((row) => row.vehicleIssueReported).length,
    feedbackBreakdownCount: rows.filter((row) => row.breakdownOccurred).length,
  };
}

function complaintMetrics(rows: any[]) {
  const verifiedVehicleFault = rows.filter((row) => row.responsibleParty === 'vehicle');
  return {
    totalComplaints: rows.length,
    resolvedComplaints: rows.filter((row) => ['resolved', 'closed'].includes(row.status)).length,
    unresolvedComplaints: rows.filter((row) => !['resolved', 'closed'].includes(row.status)).length,
    verifiedVehicleFaultComplaints: verifiedVehicleFault.length,
    verifiedVehicleIssueCount: verifiedVehicleFault.filter((row) => vehicleIssueCategories.has(row.category)).length,
    cleanlinessComplaintCount: verifiedVehicleFault.filter((row) => row.category === 'vehicle_cleanliness').length,
    acComplaintCount: verifiedVehicleFault.filter((row) => row.category === 'ac_problem').length,
    breakdownComplaintCount: verifiedVehicleFault.filter((row) => row.category === 'vehicle_breakdown').length,
    awaitingResponsibilityCount: rows.filter((row) => !row.responsibleParty || row.responsibleParty === 'unclear').length,
  };
}

async function linkedVehicleRecords(tenantId: string, vehicleId: string, bookingIds: any[]) {
  // Direct vehicleId preserves the feedback-time Fleet assignment. The
  // booking fallback is intentionally limited to legacy rows that have no
  // vehicleId, so later reassignment cannot move old feedback to a new car.
  const link = { $or: [{ vehicleId }, { vehicleId: null, bookingId: { $in: bookingIds } }] };
  const [feedback, complaints] = await Promise.all([
    CustomerFeedback.find({ tenantId, ...link })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation startOdometer endOdometer totalKilometers')
      .sort({ createdAt: -1 }).lean(),
    CustomerComplaint.find({ tenantId, ...link })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('bookingId', 'bookingId pickupDate pickupLocation dropoffLocation startOdometer endOdometer totalKilometers')
      .sort({ createdAt: -1 }).lean(),
  ]);
  return { feedback, complaints };
}

export async function buildVehicleFeedbackProfile(tenantId: string, vehicleId: string) {
  const [vehicle, bookings] = await Promise.all([
    Vehicle.findOne({ _id: vehicleId, tenantId }).lean(),
    Booking.find({ tenantId, vehicleId })
      .populate('customerId', 'name primaryMobile customerCode')
      .populate('driverId', 'name phone status')
      .sort({ pickupDate: -1, createdAt: -1 }).lean(),
  ]);
  if (!vehicle) return null;

  const bookingIds = bookings.map((booking: any) => booking._id);
  const { feedback, complaints } = await linkedVehicleRecords(tenantId, vehicleId, bookingIds);
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

  const timeline = [
    ...(feedback as any[]).map((row) => ({
      type: row.type === 'appreciation' ? 'appreciation' : 'feedback',
      date: row.createdAt,
      description: row.comments || row.vehicleIssueDescription || `Vehicle rating ${row.vehicleRating || '-'} / 5`,
      customer: row.customerId,
      booking: row.bookingId,
      recordId: row._id,
      issueReported: !!row.vehicleIssueReported,
      breakdownOccurred: !!row.breakdownOccurred,
      ratings: {
        overall: row.vehicleRating,
        cleanliness: row.vehicleCleanlinessRating,
        comfort: row.vehicleComfortRating,
        ac: row.vehicleAcRating,
        condition: row.vehicleConditionRating,
      },
    })),
    ...(complaints as any[]).map((row) => ({
      type: 'complaint', date: row.createdAt, description: row.description,
      customer: row.customerId, booking: row.bookingId, recordId: row._id,
      category: row.category, status: row.status, responsibleParty: row.responsibleParty || 'unclear',
      responsibilityReason: row.responsibilityReason, resolution: row.resolution,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    vehicle,
    totalCustomersServed: new Set(bookings.map((booking: any) => id(booking.customerId)).filter(Boolean)).size,
    totalTrips: bookings.length,
    completedTrips: bookings.filter((booking: any) => completedStatuses.has(booking.status)).length,
    totalKilometers: bookings.reduce((sum: number, booking: any) => sum + bookingKilometers(booking), 0),
    ...feedbackMetrics(feedback),
    ...complaintMetrics(complaints),
    serviceHistory: bookings.map((booking: any) => ({
      booking,
      customer: booking.customerId,
      driver: booking.driverId,
      kilometers: bookingKilometers(booking),
      feedback: feedbackByBooking.get(id(booking)) || [],
      complaints: complaintsByBooking.get(id(booking)) || [],
    })),
    timeline,
  };
}

export async function buildCustomerVehicleHistory(tenantId: string, customerId: string) {
  const bookings = await Booking.find({ tenantId, customerId, vehicleId: { $exists: true, $ne: null } })
    .populate('vehicleId', 'make vehicleModel licensePlate type status')
    .populate('driverId', 'name phone')
    .sort({ pickupDate: -1, createdAt: -1 }).lean();
  const bookingIds = bookings.map((booking: any) => booking._id);
  const [feedback, complaints] = await Promise.all([
    CustomerFeedback.find({ tenantId, customerId, bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).lean(),
    CustomerComplaint.find({ tenantId, customerId, bookingId: { $in: bookingIds } }).sort({ createdAt: -1 }).lean(),
  ]);

  const groups = new Map<string, any[]>();
  for (const booking of bookings as any[]) {
    const key = id(booking.vehicleId);
    if (key) groups.set(key, [...(groups.get(key) || []), booking]);
  }

  return [...groups.entries()].map(([vehicleId, vehicleBookings]) => {
    const vehicleBookingIds = new Set(vehicleBookings.map(id));
    const vehicleFeedback = feedback.filter((row: any) => row.vehicleId
      ? row.vehicleId.toString() === vehicleId
      : vehicleBookingIds.has(row.bookingId?.toString()));
    const vehicleComplaints = complaints.filter((row: any) => row.vehicleId
      ? row.vehicleId.toString() === vehicleId
      : vehicleBookingIds.has(row.bookingId?.toString()));
    return {
      vehicle: vehicleBookings[0].vehicleId,
      totalTrips: vehicleBookings.length,
      completedTrips: vehicleBookings.filter((booking: any) => completedStatuses.has(booking.status)).length,
      totalKilometers: vehicleBookings.reduce((sum: number, booking: any) => sum + bookingKilometers(booking), 0),
      tripHistory: vehicleBookings.map((booking: any) => ({
        bookingId: booking.bookingId,
        bookingRecordId: booking._id,
        pickupDate: booking.pickupDate,
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        startOdometer: booking.startOdometer,
        endOdometer: booking.endOdometer,
        kilometers: bookingKilometers(booking),
        driver: booking.driverId,
      })),
      ...feedbackMetrics(vehicleFeedback),
      ...complaintMetrics(vehicleComplaints),
      feedback: vehicleFeedback,
      complaints: vehicleComplaints,
    };
  });
}
