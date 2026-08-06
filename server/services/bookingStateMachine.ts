import { Booking, DriverAttendance } from '../models/index';

const ATTENDANCE_LATE_GRACE_MINUTES = 15;

function combineDateTime(date: any, time?: string): Date | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  if (time && /^\d{1,2}:\d{2}/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

// Duty-based attendance: starting a trip is real, verified evidence the
// driver reported — this is the one legitimate place attendance gets
// auto-marked, as opposed to "the date exists so mark everyone present".
// Never fatal: a logging/attendance hiccup must not block the actual
// trip-start action the driver/office is waiting on.
async function markDutyBasedAttendance(booking: any) {
  try {
    if (!booking.driverId) return;
    const actualStart: Date = booking.actualStartDateTime;
    const dayKey = new Date(actualStart);
    dayKey.setHours(0, 0, 0, 0);

    const scheduled = combineDateTime(booking.pickupDate, booking.pickupTime);
    let status: string = 'on_duty';
    let lateDurationMinutes: number | undefined;
    if (scheduled) {
      const diffMinutes = (actualStart.getTime() - scheduled.getTime()) / 60000;
      if (diffMinutes > ATTENDANCE_LATE_GRACE_MINUTES) {
        status = 'late';
        lateDurationMinutes = Math.round(diffMinutes);
      }
    }

    await DriverAttendance.findOneAndUpdate(
      { tenantId: booking.tenantId, driverId: booking.driverId, date: dayKey },
      {
        $set: {
          status,
          actualCheckIn: actualStart,
          reportingTime: booking.pickupTime,
          dutyBookingId: booking._id,
          lateDurationMinutes,
          source: 'duty_based',
        },
      },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    console.error('Duty-based attendance marking failed (non-fatal):', err?.message || err);
  }
}

export const BOOKING_STATUSES = [
  'enquiry',
  'quotation_sent',
  'tentative',
  'on_hold',
  'confirmed',
  'vehicle_assigned',
  'driver_assigned',
  'ready_for_dispatch',
  'trip_started',
  'ongoing',
  'extended',
  'return_pending',
  'completed',
  'payment_pending',
  'closed',
  'cancelled',
  'no_show',
] as const;

export type BookingStatus = typeof BOOKING_STATUSES[number];

// Terminal states nothing can leave from (except an explicit reopen, which
// this system deliberately does not support — a new booking should be
// created instead, per "a completed trip cannot be started again").
const TERMINAL_STATES: BookingStatus[] = ['closed', 'cancelled', 'no_show'];

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  enquiry: ['quotation_sent', 'tentative', 'confirmed', 'cancelled'],
  quotation_sent: ['tentative', 'on_hold', 'confirmed', 'cancelled'],
  tentative: ['on_hold', 'confirmed', 'cancelled'],
  on_hold: ['tentative', 'confirmed', 'cancelled'],
  confirmed: ['vehicle_assigned', 'driver_assigned', 'ready_for_dispatch', 'cancelled', 'no_show'],
  vehicle_assigned: ['driver_assigned', 'ready_for_dispatch', 'cancelled', 'no_show'],
  driver_assigned: ['vehicle_assigned', 'ready_for_dispatch', 'cancelled', 'no_show'],
  ready_for_dispatch: ['trip_started', 'cancelled', 'no_show'],
  trip_started: ['ongoing', 'return_pending', 'completed'],
  ongoing: ['extended', 'return_pending', 'completed'],
  extended: ['ongoing', 'return_pending', 'completed'],
  return_pending: ['completed'],
  completed: ['payment_pending', 'closed'],
  payment_pending: ['closed'],
  closed: [],
  cancelled: [],
  no_show: [],
};

// Statuses that represent "the vehicle/driver must already be attached"
// before entering, unless a manager records an override reason.
const REQUIRES_ASSIGNMENT: BookingStatus[] = ['ready_for_dispatch', 'trip_started'];

export class InvalidTransitionError extends Error {
  code = 'INVALID_TRANSITION';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionActor {
  userId: string;
  role: string;
}

export interface TransitionOptions {
  reason?: string;
  override?: boolean;
  startOdometer?: number;
  endOdometer?: number;
}

export function isValidStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function getAllowedNextStatuses(current: BookingStatus): BookingStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

/**
 * The single place booking.status is ever allowed to change. Every route
 * that used to write `status` directly must call this instead — that's
 * what makes "a cancelled booking cannot become ongoing" etc. actually
 * enforced rather than just documented.
 */
export async function transitionBooking(
  bookingId: string,
  tenantId: string | undefined,
  toStatus: string,
  actor: TransitionActor,
  options: TransitionOptions = {}
) {
  if (!isValidStatus(toStatus)) {
    throw new InvalidTransitionError(`Unknown booking status: ${toStatus}`);
  }

  const query: any = { _id: bookingId };
  if (tenantId) query.tenantId = tenantId;
  const booking = await Booking.findOne(query);
  if (!booking) {
    return null;
  }

  const fromStatus = booking.status as BookingStatus;

  if (fromStatus === toStatus) {
    // No-op transitions are not an error — just return as-is.
    return booking;
  }

  if (TERMINAL_STATES.includes(fromStatus)) {
    throw new InvalidTransitionError(
      `Booking ${booking.bookingId} is ${fromStatus} and cannot change status. Create a new booking or an adjustment entry instead.`
    );
  }

  const allowed = getAllowedNextStatuses(fromStatus);
  if (!allowed.includes(toStatus)) {
    throw new InvalidTransitionError(
      `Cannot move booking ${booking.bookingId} from '${fromStatus}' to '${toStatus}'. Allowed next statuses: ${allowed.join(', ') || 'none'}.`
    );
  }

  if (REQUIRES_ASSIGNMENT.includes(toStatus) && (!booking.vehicleId || !booking.driverId) && booking.bookingType !== 'self_drive') {
    if (!options.override) {
      throw new InvalidTransitionError(
        `Booking ${booking.bookingId} is missing vehicle/driver assignment. A manager must override with a recorded reason to proceed to '${toStatus}'.`
      );
    }
    if (!options.reason || !options.reason.trim()) {
      throw new InvalidTransitionError('An override reason is required to bypass the vehicle/driver assignment check.');
    }
  }

  booking.status = toStatus;
  (booking as any).statusHistory = (booking as any).statusHistory || [];
  (booking as any).statusHistory.push({
    fromStatus,
    toStatus,
    changedBy: { userId: actor.userId, role: actor.role },
    reason: options.reason || undefined,
    override: !!options.override,
    changedAt: new Date(),
  });

  // The one and only place actualStartDateTime/actualEndDateTime ever get
  // set — never by a scheduled-time comparison, only by this explicit,
  // validated transition (a real Start Trip / Complete Trip action).
  if (toStatus === 'trip_started' && !(booking as any).actualStartDateTime) {
    (booking as any).actualStartDateTime = new Date();
    if (options.startOdometer !== undefined) {
      if (!Number.isFinite(options.startOdometer) || options.startOdometer < 0) {
        throw new InvalidTransitionError('Start odometer must be a non-negative number.');
      }
      (booking as any).startOdometer = options.startOdometer;
    }
  }
  if (toStatus === 'completed' && !(booking as any).actualEndDateTime) {
    (booking as any).actualEndDateTime = new Date();
    if (options.endOdometer !== undefined) {
      if (!Number.isFinite(options.endOdometer) || options.endOdometer < 0) {
        throw new InvalidTransitionError('End odometer must be a non-negative number.');
      }
      const startOdometer = Number((booking as any).startOdometer);
      if (Number.isFinite(startOdometer) && options.endOdometer < startOdometer) {
        throw new InvalidTransitionError('End odometer cannot be lower than start odometer.');
      }
      (booking as any).endOdometer = options.endOdometer;
      if (Number.isFinite(startOdometer)) {
        (booking as any).totalKilometers = options.endOdometer - startOdometer;
      }
    }
  }

  await booking.save();

  if (toStatus === 'trip_started') {
    await markDutyBasedAttendance(booking);
  }

  return booking;
}
