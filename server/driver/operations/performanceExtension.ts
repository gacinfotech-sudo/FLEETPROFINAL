// TASK-DRIVER-OPERATIONS-06 — optional extension of
// server/services/driverPerformance.ts's live-computed-from-real-bookings
// approach, folding in incident counts.
//
// server/services/driverPerformance.ts is a FORBIDDEN file for this task
// (see task file) and, more importantly, is explicitly documented as
// "computed entirely from real operational records ... never a hand-entered
// or mysterious score" — this module preserves that property exactly. It
// does not modify buildDriverPerformance(), does not store a score
// anywhere, and does not replace anything: it imports the real function
// unmodified and wraps its live output with a second, equally live query
// against this task's own DriverIncident/DriverChallan collections for the
// same month window. Every additional field here is directly traceable to
// specific DriverIncident/DriverChallan documents, exactly like every
// existing field in DriverPerformanceSummary is traceable to a specific
// Booking field.
import { Booking } from '../../models/index';
import { buildDriverPerformance, type DriverPerformanceSummary } from '../../services/driverPerformance';
import { DriverChallan, DriverIncident } from './models';

export interface DriverPerformanceWithIncidents extends DriverPerformanceSummary {
  incidentCountInMonth: number;
  criticalIncidentCountInMonth: number;
  challanCountInMonth: number;
  unpaidChallanAmountInMonth: number;
}

interface IncidentLikeRow {
  driverId: any;
  date: Date;
  severity?: string;
  status?: string;
  fineAmount?: number;
}

// Pure function — mirrors buildDriverPerformance's own shape (takes
// pre-fetched arrays, returns a plain computed array, no I/O inside). The
// caller (fetchDriverPerformanceWithIncidents below, or a future route) is
// responsible for fetching bookings/incidents/challans for the same
// tenant+month window, exactly like the existing
// GET /api/reports/driver-performance route already fetches bookings
// itself before calling buildDriverPerformance.
export function buildDriverPerformanceWithIncidents(
  bookings: any[],
  monthStart: Date,
  monthEnd: Date,
  incidents: IncidentLikeRow[],
  challans: IncidentLikeRow[],
): DriverPerformanceWithIncidents[] {
  const base = buildDriverPerformance(bookings, monthStart, monthEnd);

  const incidentsByDriver = new Map<string, IncidentLikeRow[]>();
  for (const row of incidents) {
    const d = new Date(row.date);
    if (d < monthStart || d >= monthEnd) continue;
    const key = row.driverId?.toString?.() || String(row.driverId);
    if (!incidentsByDriver.has(key)) incidentsByDriver.set(key, []);
    incidentsByDriver.get(key)!.push(row);
  }

  const challansByDriver = new Map<string, IncidentLikeRow[]>();
  for (const row of challans) {
    const d = new Date(row.date);
    if (d < monthStart || d >= monthEnd) continue;
    const key = row.driverId?.toString?.() || String(row.driverId);
    if (!challansByDriver.has(key)) challansByDriver.set(key, []);
    challansByDriver.get(key)!.push(row);
  }

  return base.map((summary) => {
    const driverIncidents = incidentsByDriver.get(summary.driverId) || [];
    const driverChallans = challansByDriver.get(summary.driverId) || [];
    return {
      ...summary,
      incidentCountInMonth: driverIncidents.length,
      criticalIncidentCountInMonth: driverIncidents.filter((row) => row.severity === 'critical').length,
      challanCountInMonth: driverChallans.length,
      unpaidChallanAmountInMonth: driverChallans
        .filter((row) => row.status === 'pending' || row.status === 'disputed')
        .reduce((sum, row) => sum + (row.fineAmount || 0), 0),
    };
  });
}

// Convenience async wrapper that fetches the same-shaped inputs the plain
// route handler would, for tenant+month, then delegates to the pure
// function above. Uses the Booking/DriverIncident/DriverChallan models
// directly (same pattern eligibility.ts uses the Driver model) rather than
// touching storage.ts or routes.ts.
export async function fetchDriverPerformanceWithIncidents(
  tenantId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<DriverPerformanceWithIncidents[]> {
  const [bookings, incidents, challans] = await Promise.all([
    Booking.find({ tenantId }).populate('driverId', 'name').lean(),
    DriverIncident.find({ tenantId, incidentDate: { $gte: monthStart, $lt: monthEnd } }).lean(),
    DriverChallan.find({ tenantId, challanDate: { $gte: monthStart, $lt: monthEnd } }).lean(),
  ]);
  const incidentRows: IncidentLikeRow[] = incidents.map((row: any) => ({
    driverId: row.driverId, date: row.incidentDate, severity: row.severity, status: row.status,
  }));
  const challanRows: IncidentLikeRow[] = challans.map((row: any) => ({
    driverId: row.driverId, date: row.challanDate, status: row.status, fineAmount: row.fineAmount,
  }));
  return buildDriverPerformanceWithIncidents(bookings, monthStart, monthEnd, incidentRows, challanRows);
}
