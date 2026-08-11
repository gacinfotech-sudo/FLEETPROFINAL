// Operations -> Upcoming Bookings: groups bookings into Today / Tomorrow /
// Day After Tomorrow (or further, if `days` is increased), sorted by
// pickup time, with the missing-action highlights the ops team needs
// before pickup arrives.

const PRE_DISPATCH = ['enquiry', 'quotation_sent', 'tentative', 'on_hold', 'confirmed', 'vehicle_assigned', 'driver_assigned', 'ready_for_dispatch'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Local YYYY-MM-DD — NOT toISOString(), which converts to UTC and would
// show yesterday's date for most of the day in timezones ahead of UTC
// (e.g. IST) even though the bucketing above correctly uses local time.
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function driverMissing(booking: any): boolean {
  return booking.bookingType !== 'self_drive' && !booking.driverId;
}
function vehicleMissing(booking: any): boolean {
  return !booking.vehicleId;
}

function summarize(booking: any) {
  const vehicle = booking.vehicleId && typeof booking.vehicleId === 'object' ? booking.vehicleId : null;
  const driver = booking.driverId && typeof booking.driverId === 'object' ? booking.driverId : null;
  return {
    id: booking._id?.toString?.() || booking._id,
    bookingId: booking.bookingId,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    pickupDate: booking.pickupDate,
    pickupTime: booking.pickupTime,
    pickupLocation: booking.pickupLocation,
    dropoffLocation: booking.dropoffLocation,
    status: booking.status,
    totalAmount: booking.totalAmount,
    advanceReceived: booking.advanceReceived || 0,
    remainingBalance: Math.max(0, (booking.totalAmount || 0) - (booking.advanceReceived || 0)),
    bookingSource: booking.bookingSource || 'direct_customer',
    fulfilmentType: booking.fulfilmentType || 'own',
    vendorName: booking.vendorName || null,
    vehicle: vehicle ? { id: vehicle._id?.toString?.() || vehicle._id, make: vehicle.make, registrationNumber: vehicle.licensePlate } : null,
    driver: driver ? { id: driver._id?.toString?.() || driver._id, name: driver.name, phone: driver.phone } : null,
    flags: {
      driverNotAssigned: driverMissing(booking),
      vehicleNotAssigned: vehicleMissing(booking),
      invalidCustomerPhone: !/^[6-9]\d{9}$/.test((booking.customerPhone || '').replace(/\D/g, '').slice(-10)),
    },
  };
}

export interface UpcomingBookingsDay {
  date: string; // YYYY-MM-DD
  label: string;
  bookings: ReturnType<typeof summarize>[];
}

export function buildUpcomingBookings(bookings: any[], now: Date = new Date(), days: number = 3): UpcomingBookingsDay[] {
  const dayLabels = ['Today', 'Tomorrow', 'Day After Tomorrow'];
  const buckets: UpcomingBookingsDay[] = [];

  for (let i = 0; i < days; i++) {
    const dayStart = startOfDay(now);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayBookings = bookings
      .filter((b) => PRE_DISPATCH.includes(b.status))
      .filter((b) => {
        const pickupAt = combineDateTime(b.pickupDate, b.pickupTime);
        return pickupAt && pickupAt >= dayStart && pickupAt < dayEnd;
      })
      .sort((a, b) => (a.pickupTime || '').localeCompare(b.pickupTime || ''))
      .map(summarize);

    buckets.push({
      date: localDateString(dayStart),
      label: dayLabels[i] || `+${i} days`,
      bookings: dayBookings,
    });
  }

  return buckets;
}

// Dashboard "Upcoming Bookings" (Today / Tomorrow / Future / All Upcoming)
// needs the same centralized "is this booking upcoming" rule as
// buildUpcomingBookings() above (same PRE_DISPATCH status set, same
// tenant-local day boundary, same combined date+time comparison), but
// callers need to reopen the existing full Booking Details dialog — which
// reads many raw fields buildUpcomingBookings()'s summarize() step doesn't
// keep — so this returns full booking documents instead of the summarized
// shape, bucketed into today/tomorrow/future rather than a day-by-day array.
// `future`/`all` are capped so this endpoint's response payload stays
// bounded even though the underlying tenant booking query itself isn't.
const MAX_FUTURE_ROWS = 200;

export interface ClassifiedUpcomingBookings {
  today: any[];
  tomorrow: any[];
  future: any[];
  all: any[];
  truncated: boolean;
}

export function classifyUpcomingBookings(bookings: any[], now: Date = new Date()): ClassifiedUpcomingBookings {
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrowStart = new Date(todayStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);

  const withPickupAt = bookings
    .filter((b) => PRE_DISPATCH.includes(b.status))
    .map((b) => ({ booking: b, pickupAt: combineDateTime(b.pickupDate, b.pickupTime) }))
    .filter((x): x is { booking: any; pickupAt: Date } => x.pickupAt !== null && x.pickupAt >= todayStart)
    .sort((a, b) => a.pickupAt.getTime() - b.pickupAt.getTime());

  const today = withPickupAt.filter((x) => x.pickupAt < tomorrowStart).map((x) => x.booking);
  const tomorrow = withPickupAt.filter((x) => x.pickupAt >= tomorrowStart && x.pickupAt < dayAfterTomorrowStart).map((x) => x.booking);
  const futureAll = withPickupAt.filter((x) => x.pickupAt >= dayAfterTomorrowStart).map((x) => x.booking);
  const future = futureAll.slice(0, MAX_FUTURE_ROWS);
  const truncated = futureAll.length > MAX_FUTURE_ROWS;

  return { today, tomorrow, future, all: [...today, ...tomorrow, ...future], truncated };
}
