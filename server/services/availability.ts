import mongoose from 'mongoose';
import { Booking, DriverLeave } from '../models/index';

// Bookings store the calendar date and the clock time as SEPARATE fields
// (pickupDate is always midnight; the real time-of-day lives in the
// pickupTime string). Every overlap check in this file — and every call
// site of it — must pass a true combined instant, not a bare pickupDate.
// Passing pickupDate alone silently truncates to midnight, which made two
// same-day bookings with different, overlapping times (e.g. 2pm-10pm vs
// 3pm-11pm) collapse to a zero-width "start === end" window that could
// never register as overlapping — the exact bug where an already-assigned
// driver kept showing as available for a same-day conflicting booking.
export function combineDateTime(date: any, time?: string): Date {
  const d = new Date(date);
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

// Statuses where a booking is genuinely "occupying" its driver/vehicle —
// the single source of truth for overlap checks, used by every call site
// including booking creation (which used to have its own separate, stale
// list that predated the 17-status pipeline and let almost every active
// status through unchecked).
const OCCUPYING_STATUSES = [
  'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch',
  'trip_started', 'ongoing', 'extended', 'return_pending',
];

export interface ConflictingBooking {
  id: string;
  bookingId: string;
  customerName: string;
  pickupDate: Date;
  pickupTime?: string;
  returnDate?: Date;
  returnTime?: string;
  status: string;
}

function toConflict(b: any): ConflictingBooking {
  return {
    id: b._id.toString(),
    bookingId: b.bookingId,
    customerName: b.customerName,
    pickupDate: b.pickupDate,
    pickupTime: b.pickupTime,
    returnDate: b.returnDate,
    returnTime: b.returnTime,
    status: b.status,
  };
}

// Compares against scheduledStartDateTime/scheduledEndDateTime — real
// combined instants kept in sync by the model's pre-save /
// pre-findOneAndUpdate hooks — never the raw pickupDate/returnDate. Those
// raw fields are always midnight, so comparing a real end-of-window query
// bound against a permanently-midnight stored returnDate silently breaks
// same-day overlap detection (a midnight returnDate can never be "after"
// a same-day afternoon start once the query itself uses real times).
// Every existing booking is backfilled with these fields as part of this
// fix (see scripts/backfill-scheduled-datetime.ts) — there is no legacy
// fallback here on purpose, so a booking that's somehow missing them
// (schema drift, manual DB edit) fails LOUD by never matching as a
// conflict source, rather than silently reintroducing the midnight bug.
export async function findVehicleConflicts(
  tenantId: string, vehicleId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession
): Promise<ConflictingBooking[]> {
  const query: any = {
    tenantId, vehicleId,
    status: { $in: OCCUPYING_STATUSES },
    scheduledStartDateTime: { $lt: end },
    scheduledEndDateTime: { $gt: start },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const rows = await Booking.find(query).session(session ?? null);
  return rows.map(toConflict);
}

export async function findDriverConflicts(
  tenantId: string, driverId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession
): Promise<ConflictingBooking[]> {
  const query: any = {
    tenantId, driverId,
    status: { $in: OCCUPYING_STATUSES },
    scheduledStartDateTime: { $lt: end },
    scheduledEndDateTime: { $gt: start },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const rows = await Booking.find(query).session(session ?? null);
  return rows.map(toConflict);
}

export interface LeaveConflict {
  leaveId: string;
  startDate: Date;
  endDate: Date;
  leaveType: string;
}

export async function findDriverLeaveConflicts(
  tenantId: string, driverId: string, start: Date, end: Date, session?: mongoose.ClientSession
): Promise<LeaveConflict[]> {
  const rows = await DriverLeave.find({
    tenantId, driverId,
    status: 'approved',
    startDate: { $lt: end },
    endDate: { $gt: start },
  }).session(session ?? null);
  return rows.map((l: any) => ({
    leaveId: l._id.toString(),
    startDate: l.startDate,
    endDate: l.endDate,
    leaveType: l.leaveType,
  }));
}

export interface DriverAvailabilityResult {
  available: boolean;
  bookingConflicts: ConflictingBooking[];
  leaveConflicts: LeaveConflict[];
}

// start/end MUST be full date+time instants (use combineDateTime) — see
// the file-level comment. A bare pickupDate silently truncates to
// midnight and breaks same-day overlap detection.
export async function checkDriverAvailability(
  tenantId: string, driverId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession
): Promise<DriverAvailabilityResult> {
  const [bookingConflicts, leaveConflicts] = await Promise.all([
    findDriverConflicts(tenantId, driverId, start, end, excludeBookingId, session),
    findDriverLeaveConflicts(tenantId, driverId, start, end, session),
  ]);
  return {
    available: bookingConflicts.length === 0 && leaveConflicts.length === 0,
    bookingConflicts,
    leaveConflicts,
  };
}
