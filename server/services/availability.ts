import mongoose from 'mongoose';
import { Booking, DriverLeave, BookingDraft } from '../models/index';

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
// Reporting/return/rest buffers (spec §29-32) — genuinely new, additive
// concept. All default to 0, which produces a query window byte-identical
// to the pre-buffer behavior, so every existing call site that doesn't
// pass this argument is completely unaffected. A non-zero buffer widens
// which EXISTING bookings count as still occupying the resource around the
// requested [start, end) window: a reporting buffer means the vehicle/
// driver must already be free *reportingBufferMinutes before* the new
// booking's start; return+rest buffers mean they must stay free *that
// long after* an existing booking's end. Expressed as widening the query
// window in the opposite direction (rather than the existing bookings'
// stored times) so the same simple $lt/$gt shape still applies.
export interface AvailabilityBuffers {
  reportingBufferMinutes?: number;
  returnBufferMinutes?: number;
  restBufferMinutes?: number;
}

function widenWindowForBuffers(start: Date, end: Date, buffers?: AvailabilityBuffers): { queryStart: Date; queryEnd: Date } {
  const reportingMs = (buffers?.reportingBufferMinutes ?? 0) * 60_000;
  const returnRestMs = ((buffers?.returnBufferMinutes ?? 0) + (buffers?.restBufferMinutes ?? 0)) * 60_000;
  return {
    queryStart: returnRestMs > 0 ? new Date(start.getTime() - returnRestMs) : start,
    queryEnd: reportingMs > 0 ? new Date(end.getTime() + reportingMs) : end,
  };
}

export async function findVehicleConflicts(
  tenantId: string, vehicleId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession, buffers?: AvailabilityBuffers
): Promise<ConflictingBooking[]> {
  const { queryStart, queryEnd } = widenWindowForBuffers(start, end, buffers);
  const query: any = {
    tenantId, vehicleId,
    status: { $in: OCCUPYING_STATUSES },
    scheduledStartDateTime: { $lt: queryEnd },
    scheduledEndDateTime: { $gt: queryStart },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const rows = await Booking.find(query).session(session ?? null);
  return rows.map(toConflict);
}

export async function findDriverConflicts(
  tenantId: string, driverId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession, buffers?: AvailabilityBuffers
): Promise<ConflictingBooking[]> {
  const { queryStart, queryEnd } = widenWindowForBuffers(start, end, buffers);
  const query: any = {
    tenantId, driverId,
    status: { $in: OCCUPYING_STATUSES },
    scheduledStartDateTime: { $lt: queryEnd },
    scheduledEndDateTime: { $gt: queryStart },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };
  const rows = await Booking.find(query).session(session ?? null);
  return rows.map(toConflict);
}

// Parity wrapper — checkDriverAvailability already existed; no equivalent
// existed for vehicles, so every call site did `findVehicleConflicts(...).length
// === 0` directly (documented gap, see docs/AVAILABILITY_RULE_MATRIX.md).
export async function checkVehicleAvailability(
  tenantId: string, vehicleId: string, start: Date, end: Date, excludeBookingId?: string, session?: mongoose.ClientSession, buffers?: AvailabilityBuffers
): Promise<{ available: boolean; bookingConflicts: ConflictingBooking[] }> {
  const bookingConflicts = await findVehicleConflicts(tenantId, vehicleId, start, end, excludeBookingId, session, buffers);
  return { available: bookingConflicts.length === 0, bookingConflicts };
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

export interface TentativeDraftConflict {
  userId: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  updatedAt: Date;
}

// A real, minimal slice of the spec's "centralized zero-overlap
// Availability Engine with reservations" (§29-38) — deliberately built as
// a live read over the existing BookingDraft collection (Phase 8) rather
// than a new ResourceReservation model with its own create/expire/release
// lifecycle to keep in sync. BookingDraft already IS a per-user record of
// "I have this vehicle provisionally selected, for these dates, right
// now" — the moment two staff are filling out the wizard for the same
// vehicle and overlapping dates at the same time is exactly what this
// closes: whichever one actually submits first still wins (this is a
// pre-submit guard, not a hold/lock), but the second one gets a clear,
// specific "someone else is currently booking this vehicle" error instead
// of either double-booking or a generic failure.
//
// Staleness window: a draft older than STALE_DRAFT_MINUTES is treated as
// abandoned (the user closed the tab without discarding) and never counts
// as a conflict — there is no background expiry job in this codebase, so
// staleness is enforced lazily, at read time, exactly like every other
// lazy-expiry pattern already used here.
const STALE_DRAFT_MINUTES = 20;

export async function findTentativeDraftConflicts(
  tenantId: string, vehicleId: string, start: Date, end: Date, excludeUserId?: string, session?: mongoose.ClientSession
): Promise<TentativeDraftConflict[]> {
  const staleCutoff = new Date(Date.now() - STALE_DRAFT_MINUTES * 60_000);
  const query: any = {
    tenantId,
    'formData.vehicleId': vehicleId,
    updatedAt: { $gte: staleCutoff },
  };
  if (excludeUserId) query.userId = { $ne: excludeUserId };
  const drafts = await BookingDraft.find(query).session(session ?? null);

  const conflicts: TentativeDraftConflict[] = [];
  for (const draft of drafts) {
    const fd = draft.formData || {};
    if (!fd.pickupDate) continue;
    const draftStart = combineDateTime(fd.pickupDate, fd.pickupTime);
    const draftEnd = fd.returnDate ? combineDateTime(fd.returnDate, fd.returnTime) : draftStart;
    if (draftStart < end && draftEnd > start) {
      conflicts.push({
        userId: draft.userId,
        pickupDate: fd.pickupDate, pickupTime: fd.pickupTime,
        returnDate: fd.returnDate, returnTime: fd.returnTime,
        updatedAt: draft.updatedAt,
      });
    }
  }
  return conflicts;
}
