import mongoose from 'mongoose';
import {
  DriverAttendance,
  Booking,
  DriverAdvance,
  DriverRecharge,
  DriverRecovery,
  IDriverAttendance,
  IDriverAdvance,
  IDriverRecharge,
  IDriverRecovery
} from '../models/index';

/**
 * PHASE 2: AUTOMATIC DATA FETCHING SERVICE
 * Fetches all required salary calculation data from existing modules
 * - NO manual re-entry needed
 * - Data source: Attendance, Booking, Advances, Recharges, Recoveries
 */

export interface AttendanceDataResult {
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  halfDays: number;
  absentDays: number;
  totalPeriodDays: number;
  onDutyDays: number;
  details: IDriverAttendance[];
}

export interface BookingServiceDataResult {
  uniqueServiceDays: number;
  totalBookingsServed: number;
  totalKilometers?: number;
  nightDutyTrips?: number;
  outstationTrips?: number;
  details: Array<{
    bookingId: string;
    date: Date;
    status: string;
    kilometers?: number;
  }>;
}

export interface FreeAvailableDaysResult {
  totalDays: number;
  bookingServiceDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  absentDays: number;
  freeAvailableDays: number;
}

/**
 * Fetch attendance data from DriverAttendance collection
 * Returns: present days, leaves, weekly offs, absent days, half days
 */
export async function fetchAttendanceData(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<AttendanceDataResult> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  const attendance = await DriverAttendance.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: 1 });

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let weeklyOffDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let onDutyDays = 0;

  for (const record of attendance) {
    switch (record.status) {
      case 'present':
      case 'late':
        presentDays++;
        break;
      case 'on_duty':
        onDutyDays++;
        break;
      case 'paid_leave':
        paidLeaveDays++;
        break;
      case 'unpaid_leave':
        unpaidLeaveDays++;
        break;
      case 'weekly_off':
        weeklyOffDays++;
        break;
      case 'half_day':
        halfDays++;
        break;
      case 'absent':
        absentDays++;
        break;
    }
  }

  // Total working days calculation (exclude weekly offs)
  const totalPeriodDays = attendance.length;

  return {
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    weeklyOffDays,
    halfDays,
    absentDays,
    totalPeriodDays,
    onDutyDays,
    details: attendance
  };
}

/**
 * Fetch booking service days from Booking collection
 * Returns: unique service days, total bookings served, km, night duty trips, etc.
 * Only counts completed/valid bookings with this driver assigned
 */
export async function fetchBookingServiceDays(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<BookingServiceDataResult> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  // Fetch all bookings where this driver is assigned and booking falls within date range
  const bookings = await Booking.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    pickupDate: { $gte: startDate, $lte: endDate },
    // Status filters for valid bookings (adjust based on your Booking status enum)
    status: { $in: ['completed', 'in_progress', 'confirmed'] }
  }).select('_id pickupDate status');

  // Count unique service days (same day, multiple bookings = 1 service day)
  const uniqueDays = new Set<string>();
  let totalBookingsServed = 0;
  let totalKilometers = 0;
  let nightDutyTrips = 0;
  let outstationTrips = 0;

  for (const booking of bookings) {
    totalBookingsServed++;
    // Normalize date to YYYY-MM-DD for unique counting
    const dateKey = booking.pickupDate?.toISOString().split('T')[0];
    if (dateKey) {
      uniqueDays.add(dateKey);
    }

    // Additional metrics (can be expanded based on booking data)
    // These would be calculated from booking details if available
  }

  return {
    uniqueServiceDays: uniqueDays.size,
    totalBookingsServed,
    totalKilometers,
    nightDutyTrips,
    outstationTrips,
    details: bookings.map((b) => ({
      bookingId: b._id?.toString() || '',
      date: b.pickupDate || new Date(),
      status: b.status || 'unknown',
      kilometers: 0
    }))
  };
}

/**
 * Fetch driver advances from DriverAdvance collection
 * Returns: list of advances for the salary period with status
 */
export async function fetchDriverAdvances(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  salaryPeriodStart: Date
): Promise<IDriverAdvance[]> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  return DriverAdvance.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    requestDate: { $lte: salaryPeriodStart },
    status: { $in: ['approved', 'paid'] } // Only approved/paid advances
  }).sort({ requestDate: -1 });
}

/**
 * Fetch recharges from DriverRecharge collection
 * Returns: list of recharges with treatment field
 * Only DEDUCT_FROM_DRIVER recharges affect driver salary
 */
export async function fetchRecharges(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<IDriverRecharge[]> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  return DriverRecharge.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: startDate, $lte: endDate },
    status: 'completed'
  }).sort({ date: 1 });
}

/**
 * Fetch recoveries from DriverRecovery collection
 * Returns: list of recoveries with type and reason
 */
export async function fetchRecoveries(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<IDriverRecovery[]> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  return DriverRecovery.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: startDate, $lte: endDate },
    status: { $in: ['approved', 'recovered'] }
  }).sort({ date: 1 });
}

/**
 * Calculate free available days (days not accounted for by bookings, leaves, offs, or absences)
 * Returns the count of days not used for any duty/leave/off
 */
export function calculateFreeAvailableDays(
  input: FreeAvailableDaysResult | {
    totalDays: number;
    bookingServiceDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    weeklyOffDays: number;
    absentDays: number;
  }
): number {
  const {
    totalDays,
    bookingServiceDays,
    paidLeaveDays,
    unpaidLeaveDays,
    weeklyOffDays,
    absentDays
  } = input;

  const accountedDays =
    bookingServiceDays +
    paidLeaveDays +
    unpaidLeaveDays +
    weeklyOffDays +
    absentDays;

  const freeAvailableDays = Math.max(0, totalDays - accountedDays);
  return freeAvailableDays;
}

/**
 * Comprehensive data aggregator for salary calculation
 * Fetches all data needed for salary calculation in one call
 */
export interface SalaryCalculationDataInput {
  tenantId: string | mongoose.Types.ObjectId;
  driverId: string | mongoose.Types.ObjectId;
  salaryPeriodStart: Date;
  salaryPeriodEnd: Date;
}

export interface SalaryCalculationData extends SalaryCalculationDataInput {
  attendance: AttendanceDataResult;
  bookingServiceDays: BookingServiceDataResult;
  advances: IDriverAdvance[];
  recharges: IDriverRecharge[];
  recoveries: IDriverRecovery[];
}

/**
 * Fetch all data needed for salary calculation
 * Single call to aggregate all data from all sources
 */
export async function fetchAllSalaryCalculationData(
  input: SalaryCalculationDataInput
): Promise<SalaryCalculationData> {
  const [attendance, bookingServiceDays, advances, recharges, recoveries] = await Promise.all([
    fetchAttendanceData(input.tenantId, input.driverId, input.salaryPeriodStart, input.salaryPeriodEnd),
    fetchBookingServiceDays(input.tenantId, input.driverId, input.salaryPeriodStart, input.salaryPeriodEnd),
    fetchDriverAdvances(input.tenantId, input.driverId, input.salaryPeriodStart),
    fetchRecharges(input.tenantId, input.driverId, input.salaryPeriodStart, input.salaryPeriodEnd),
    fetchRecoveries(input.tenantId, input.driverId, input.salaryPeriodStart, input.salaryPeriodEnd)
  ]);

  return {
    tenantId: input.tenantId,
    driverId: input.driverId,
    salaryPeriodStart: input.salaryPeriodStart,
    salaryPeriodEnd: input.salaryPeriodEnd,
    attendance,
    bookingServiceDays,
    advances,
    recharges,
    recoveries
  };
}

/**
 * Validate that all required data is available for salary calculation
 */
export function validateSalaryCalculationData(data: SalaryCalculationData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.attendance || data.attendance.totalPeriodDays === 0) {
    errors.push('No attendance data available for the salary period');
  }

  if (!data.advances) {
    errors.push('Failed to fetch advances data');
  }

  if (!data.recharges) {
    errors.push('Failed to fetch recharges data');
  }

  if (!data.recoveries) {
    errors.push('Failed to fetch recoveries data');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
