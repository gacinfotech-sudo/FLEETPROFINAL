// Categorizes a tenant's bookings into the Operations -> Live Bookings
// buckets. Pure function over already-fetched bookings (no DB access) so
// it's cheap to unit-test and reused by both the API route and tests.

const PRE_DISPATCH = ['enquiry', 'quotation_sent', 'tentative', 'on_hold', 'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch'];
const ACTIVE = ['trip_started', 'ongoing', 'extended', 'return_pending'];
const DONE = ['completed', 'payment_pending', 'closed'];
const STOPPED = ['cancelled', 'no_show'];

type WindowKey = '1h' | '3h' | 'today' | 'tomorrow';

function windowEnd(now: Date, key: WindowKey): Date {
  const end = new Date(now);
  if (key === '1h') { end.setHours(end.getHours() + 1); return end; }
  if (key === '3h') { end.setHours(end.getHours() + 3); return end; }
  if (key === 'tomorrow') {
    end.setDate(end.getDate() + 2);
    end.setHours(0, 0, 0, 0);
    return end;
  }
  // today
  end.setHours(23, 59, 59, 999);
  return end;
}

function windowStart(now: Date, key: WindowKey): Date {
  if (key !== 'tomorrow') return now;
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

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

function expectedEnd(booking: any): Date | null {
  return combineDateTime(booking.returnDate, booking.returnTime) || combineDateTime(booking.pickupDate, booking.pickupTime);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function driverMissing(booking: any): boolean {
  return booking.bookingType !== 'self_drive' && !booking.driverId;
}

function vehicleMissing(booking: any): boolean {
  return !booking.vehicleId;
}

function paymentDue(booking: any): boolean {
  return booking.paymentStatus === 'pending' || booking.paymentStatus === 'refund_pending';
}

function lastCompletedAt(booking: any): Date | null {
  const history = Array.isArray(booking.statusHistory) ? booking.statusHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].toStatus === 'completed') return new Date(history[i].changedAt);
  }
  return null;
}

// Grace period after scheduled pickup before "Start Due" becomes "Start
// Delayed". Purely a display classification computed at read time — it
// never writes to the booking, and never sets actualStartDateTime.
const START_DUE_GRACE_MINUTES = 30;
const COMPLETION_OVERDUE_GRACE_MINUTES = 30;

type OperationalLabel = 'start_due' | 'start_delayed' | 'ongoing' | 'completion_overdue' | null;

function computeOperationalLabel(booking: any, now: Date): OperationalLabel {
  const status = booking.status;
  const pickupAt = combineDateTime(booking.pickupDate, booking.pickupTime);
  const endAt = expectedEnd(booking);

  if (PRE_DISPATCH.includes(status) && pickupAt) {
    if (pickupAt > now) return null; // genuinely upcoming, not due yet
    const minutesPastDue = (now.getTime() - pickupAt.getTime()) / 60000;
    return minutesPastDue > START_DUE_GRACE_MINUTES ? 'start_delayed' : 'start_due';
  }
  if (ACTIVE.includes(status)) {
    if (endAt) {
      const minutesPastEnd = (now.getTime() - endAt.getTime()) / 60000;
      if (minutesPastEnd > COMPLETION_OVERDUE_GRACE_MINUTES) return 'completion_overdue';
    }
    return 'ongoing';
  }
  return null;
}

function summarize(booking: any, now: Date) {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === 'object' ? booking.driverId : null;
  return {
    id: booking._id?.toString?.() || booking._id,
    bookingId: booking.bookingId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    pickupDate: booking.pickupDate,
    pickupTime: booking.pickupTime,
    returnDate: booking.returnDate,
    returnTime: booking.returnTime,
    actualStartDateTime: booking.actualStartDateTime || null,
    actualEndDateTime: booking.actualEndDateTime || null,
    pickupLocation: booking.pickupLocation,
    dropoffLocation: booking.dropoffLocation,
    bookingType: booking.bookingType,
    status: booking.status,
    operationalLabel: computeOperationalLabel(booking, now),
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount,
    bookingSource: booking.bookingSource || 'direct_customer',
    fulfilmentType: booking.fulfilmentType || 'own',
    vendorName: booking.vendorName || null,
    vehicle: vehicle ? { id: vehicle._id?.toString?.() || vehicle._id, make: vehicle.make, model: vehicle.vehicleModel, registrationNumber: vehicle.licensePlate } : null,
    driver: driver ? { id: driver._id?.toString?.() || driver._id, name: driver.name, phone: driver.phone } : null,
    flags: {
      driverNotAssigned: driverMissing(booking),
      vehicleNotAssigned: vehicleMissing(booking),
      customerConfirmationPending: ['enquiry', 'quotation_sent', 'tentative', 'on_hold'].includes(booking.status),
      advancePaymentPending: paymentDue(booking),
    },
  };
}

export interface LiveOperationsResult {
  generatedAt: string;
  startDue: ReturnType<typeof summarize>[];
  startDelayed: ReturnType<typeof summarize>[];
  startingSoon: ReturnType<typeof summarize>[];
  ongoing: ReturnType<typeof summarize>[];
  endingSoon: ReturnType<typeof summarize>[];
  completionOverdue: ReturnType<typeof summarize>[];
  paymentPending: ReturnType<typeof summarize>[];
  completedToday: ReturnType<typeof summarize>[];
  delayed: ReturnType<typeof summarize>[];
  unassigned: ReturnType<typeof summarize>[];
  cancelled: ReturnType<typeof summarize>[];
}

export function buildLiveOperations(
  bookings: any[],
  now: Date = new Date(),
  startingWindow: WindowKey = 'today',
  endingWindow: WindowKey = 'today'
): LiveOperationsResult {
  const startWinStart = windowStart(now, startingWindow);
  const startWinEnd = windowEnd(now, startingWindow);
  const endWinEnd = windowEnd(now, endingWindow);

  const startDue: any[] = [];
  const startDelayed: any[] = [];
  const startingSoon: any[] = [];
  const ongoing: any[] = [];
  const endingSoon: any[] = [];
  const completionOverdue: any[] = [];
  const paymentPending: any[] = [];
  const completedToday: any[] = [];
  const delayed: any[] = [];
  const unassigned: any[] = [];
  const cancelled: any[] = [];

  for (const booking of bookings) {
    const status = booking.status;
    const pickupAt = combineDateTime(booking.pickupDate, booking.pickupTime);
    const endAt = expectedEnd(booking);
    const label = computeOperationalLabel(booking, now);

    if (STOPPED.includes(status)) {
      cancelled.push(summarize(booking, now));
      continue;
    }

    if (PRE_DISPATCH.includes(status)) {
      if (label === 'start_due') startDue.push(summarize(booking, now));
      if (label === 'start_delayed') startDelayed.push(summarize(booking, now));
      if (pickupAt && pickupAt >= startWinStart && pickupAt <= startWinEnd) {
        startingSoon.push(summarize(booking, now));
      }
      if (pickupAt && pickupAt < now) {
        delayed.push(summarize(booking, now));
      }
      if (vehicleMissing(booking) || driverMissing(booking)) {
        unassigned.push(summarize(booking, now));
      }
    }

    if (ACTIVE.includes(status)) {
      ongoing.push(summarize(booking, now));
      if (label === 'completion_overdue') completionOverdue.push(summarize(booking, now));
      if (endAt && endAt <= endWinEnd) {
        endingSoon.push(summarize(booking, now));
      }
      if (endAt && endAt < now) {
        delayed.push(summarize(booking, now));
      }
    }

    if (DONE.includes(status)) {
      if (paymentDue(booking)) {
        paymentPending.push(summarize(booking, now));
      }
      const completedAt = lastCompletedAt(booking);
      if (completedAt && isSameLocalDay(completedAt, now)) {
        completedToday.push(summarize(booking, now));
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    startDue,
    startDelayed,
    startingSoon,
    ongoing,
    endingSoon,
    completionOverdue,
    paymentPending,
    completedToday,
    delayed,
    unassigned,
    cancelled,
  };
}
