// Monthly driver performance — computed entirely from real operational
// records (bookings), never a hand-entered or mysterious score. Every
// number here traces back to a specific field on a specific booking.

const ON_TIME_GRACE_MINUTES = 15;

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

export interface DriverPerformanceSummary {
  driverId: string;
  driverName: string;
  totalAssignedTrips: number;
  completedTrips: number;
  cancelledDuties: number;
  noShows: number;
  onTimeReportingCount: number;
  onTimeReportingPercentage: number | null;
  averageDelayMinutes: number | null;
  totalKilometers: number;
  revenueHandled: number;
}

export function buildDriverPerformance(
  bookings: any[],
  monthStart: Date,
  monthEnd: Date
): DriverPerformanceSummary[] {
  const byDriver = new Map<string, any[]>();

  for (const b of bookings) {
    if (!b.driverId) continue;
    const pickup = new Date(b.pickupDate);
    if (pickup < monthStart || pickup >= monthEnd) continue;
    const driver = typeof b.driverId === 'object' ? b.driverId : null;
    const driverId = driver ? (driver._id?.toString?.() || driver._id) : b.driverId.toString();
    if (!byDriver.has(driverId)) byDriver.set(driverId, []);
    byDriver.get(driverId)!.push(b);
  }

  const results: DriverPerformanceSummary[] = [];

  for (const [driverId, driverBookings] of byDriver) {
    const driverObj = driverBookings[0].driverId;
    const driverName = typeof driverObj === 'object' ? driverObj.name : 'Unknown';

    let completedTrips = 0;
    let cancelledDuties = 0;
    let noShows = 0;
    let onTimeCount = 0;
    let reportingSamples = 0;
    let totalDelayMinutes = 0;
    let delaySamples = 0;
    let totalKilometers = 0;
    let revenueHandled = 0;

    for (const b of driverBookings) {
      if (['completed', 'payment_pending', 'closed'].includes(b.status)) completedTrips++;
      if (b.status === 'cancelled') cancelledDuties++;
      if (b.status === 'no_show') noShows++;
      totalKilometers += b.totalKilometers || 0;
      revenueHandled += b.totalAmount || 0;

      const scheduled = combineDateTime(b.pickupDate, b.pickupTime);
      const actual = b.actualStartDateTime ? new Date(b.actualStartDateTime) : null;
      if (scheduled && actual) {
        reportingSamples++;
        const delayMinutes = (actual.getTime() - scheduled.getTime()) / 60000;
        if (delayMinutes <= ON_TIME_GRACE_MINUTES) {
          onTimeCount++;
        } else {
          totalDelayMinutes += delayMinutes;
          delaySamples++;
        }
      }
    }

    results.push({
      driverId,
      driverName,
      totalAssignedTrips: driverBookings.length,
      completedTrips,
      cancelledDuties,
      noShows,
      onTimeReportingCount: onTimeCount,
      onTimeReportingPercentage: reportingSamples > 0 ? Math.round((onTimeCount / reportingSamples) * 1000) / 10 : null,
      averageDelayMinutes: delaySamples > 0 ? Math.round(totalDelayMinutes / delaySamples) : null,
      totalKilometers,
      revenueHandled,
    });
  }

  return results.sort((a, b) => b.totalAssignedTrips - a.totalAssignedTrips);
}
