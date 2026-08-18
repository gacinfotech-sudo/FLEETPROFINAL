/**
 * DRIVER 360: ATTENDANCE SERVICE
 * Automatic daily attendance classification from operational data
 *
 * Sources:
 * - Booking assignments & completions
 * - Leave records
 * - Explicit absence marks
 * - Driver status
 */

import mongoose from 'mongoose';
import { Driver, DriverLeave, Booking } from '../models/index';

export interface DailyAttendance {
  date: string; // YYYY-MM-DD
  driverId: string;
  status: 'PRESENT' | 'IDLE' | 'LEAVE' | 'ABSENT' | 'WEEKLY_OFF';
  bookingsServed?: number;
  bookingIds?: string[];
  leaveType?: 'paid' | 'unpaid' | 'compensatory' | 'weekly_off';
  reason?: string;
}

export interface MonthlyAttendanceSummary {
  driverId: string;
  year: number;
  month: number;
  calendarDays: number;
  employmentDays: number;
  presentDays: number;
  idleDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  absentDays: number;
  bookingsServed: number;
  dailyBreakdown: DailyAttendance[];
}

/**
 * Get daily attendance for a driver on a specific date
 * Precedence:
 * 1. Approved Leave → LEAVE
 * 2. Booking Served → PRESENT
 * 3. Explicit Absent → ABSENT
 * 4. Available/Active → IDLE
 */
export async function getDailyAttendance(
  driverId: mongoose.Types.ObjectId | string,
  date: Date,
  tenantId: mongoose.Types.ObjectId | string
): Promise<DailyAttendance> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const driverIdObj = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;
  const tenantIdObj = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // 1. CHECK FOR APPROVED LEAVE
  const leave = await DriverLeave.findOne({
    tenantId: tenantIdObj,
    driverId: driverIdObj,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    status: 'approved'
  });

  if (leave) {
    return {
      date: date.toISOString().split('T')[0],
      driverId: driverId.toString(),
      status: 'LEAVE',
      leaveType: leave.leaveType || 'unpaid',
      reason: `${leave.leaveType || 'Unpaid'} Leave`
    };
  }

  // 2. CHECK FOR BOOKINGS SERVED
  const bookings = await Booking.find({
    tenantId: tenantIdObj,
    assignedDriver: driverIdObj,
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['completed', 'active', 'on_trip'] }
  }).select('_id status');

  if (bookings && bookings.length > 0) {
    return {
      date: date.toISOString().split('T')[0],
      driverId: driverId.toString(),
      status: 'PRESENT',
      bookingsServed: bookings.length,
      bookingIds: bookings.map(b => b._id.toString()),
      reason: `Booking Served (${bookings.length})`
    };
  }

  // 3. CHECK FOR EXPLICIT ABSENCE
  // (Can be extended to check absence table when created)

  // 4. DEFAULT: IDLE (driver available but no booking)
  const driver = await Driver.findById(driverIdObj).select('status');
  if (driver && driver.status === 'active') {
    return {
      date: date.toISOString().split('T')[0],
      driverId: driverId.toString(),
      status: 'IDLE',
      reason: 'Available, No Booking'
    };
  }

  // Driver inactive
  return {
    date: date.toISOString().split('T')[0],
    driverId: driverId.toString(),
    status: 'IDLE',
    reason: 'Driver Inactive'
  };
}

/**
 * Get monthly attendance summary for a driver
 */
export async function getMonthlyAttendanceSummary(
  driverId: mongoose.Types.ObjectId | string,
  year: number,
  month: number,
  tenantId: mongoose.Types.ObjectId | string
): Promise<MonthlyAttendanceSummary> {
  const driverIdObj = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  // Get calendar days in month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const calendarDays = lastDay.getDate();

  const summary: MonthlyAttendanceSummary = {
    driverId: driverId.toString(),
    year,
    month,
    calendarDays,
    employmentDays: 0,
    presentDays: 0,
    idleDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    weeklyOffDays: 0,
    absentDays: 0,
    bookingsServed: 0,
    dailyBreakdown: []
  };

  // Iterate through each day
  for (let day = 1; day <= calendarDays; day++) {
    const date = new Date(year, month - 1, day);
    const attendance = await getDailyAttendance(driverIdObj, date, tenantId);

    summary.dailyBreakdown.push(attendance);

    // Count attendance
    switch (attendance.status) {
      case 'PRESENT':
        summary.presentDays++;
        summary.employmentDays++;
        summary.bookingsServed += attendance.bookingsServed || 0;
        break;
      case 'IDLE':
        summary.idleDays++;
        summary.employmentDays++;
        break;
      case 'LEAVE':
        if (attendance.leaveType === 'paid') {
          summary.paidLeaveDays++;
        } else if (attendance.leaveType === 'weekly_off') {
          summary.weeklyOffDays++;
        } else {
          summary.unpaidLeaveDays++;
        }
        summary.employmentDays++;
        break;
      case 'ABSENT':
        summary.absentDays++;
        summary.employmentDays++;
        break;
      case 'WEEKLY_OFF':
        summary.weeklyOffDays++;
        break;
    }
  }

  return summary;
}

/**
 * Get attendance for multiple drivers (bulk)
 */
export async function getAttendanceForDrivers(
  driverIds: (mongoose.Types.ObjectId | string)[],
  year: number,
  month: number,
  tenantId: mongoose.Types.ObjectId | string
): Promise<MonthlyAttendanceSummary[]> {
  const summaries: MonthlyAttendanceSummary[] = [];

  for (const driverId of driverIds) {
    const summary = await getMonthlyAttendanceSummary(driverId, year, month, tenantId);
    summaries.push(summary);
  }

  return summaries;
}

/**
 * Cache monthly attendance (optional optimization)
 */
export interface CachedAttendance {
  driverId: mongoose.Types.ObjectId;
  year: number;
  month: number;
  summary: MonthlyAttendanceSummary;
  cachedAt: Date;
  expiresAt: Date;
}

// In-memory cache (can be extended to Redis)
const attendanceCache = new Map<string, CachedAttendance>();

export function getCacheKey(driverId: string, year: number, month: number): string {
  return `${driverId}-${year}-${month}`;
}

export function invalidateCache(driverId: string, year?: number, month?: number): void {
  if (!year || !month) {
    // Invalidate all for this driver
    const keysToDelete: string[] = [];
    for (const key of attendanceCache.keys()) {
      if (key.startsWith(driverId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => attendanceCache.delete(key));
  } else {
    const key = getCacheKey(driverId, year, month);
    attendanceCache.delete(key);
  }
}
