/**
 * DRIVER PAYROLL AGGREGATION SERVICE
 * Unified driver view with integrated salary & payroll data
 *
 * Combines:
 * - Driver profile information
 * - Current month salary breakdown
 * - Recent payment history
 * - YTD earnings comparison
 * - Real-time salary calculation
 */

import mongoose from 'mongoose';
import {
  Driver,
  DriverSalaryMaster,
  DriverSalaryPayment,
  DriverAdvance,
  DriverRecovery,
  DriverAttendance,
  Booking,
  IDriver
} from '../models/index';

export interface CurrentMonthSalary {
  base: number;
  incentives: number;
  deductions: number;
  net: number;
  paid: number;
  pending: number;
  paidPercentage: number;
}

export interface LastPayment {
  date: Date | null;
  amount: number;
  status: 'paid' | 'pending' | 'none';
  paymentMode?: string;
}

export interface NextPayment {
  date: Date;
  estimatedAmount: number;
  daysUntil: number;
}

export interface YearToDateEarnings {
  total: number;
  previousYearTotal: number;
  changePercentage: number;
  trend: 'increasing' | 'decreasing' | 'flat';
}

export interface DriverPayrollStatus {
  color: 'green' | 'yellow' | 'red';
  label: 'on_track' | 'pending' | 'overdue';
  message: string;
}

export interface EnhancedDriver360Salary {
  currentMonth: CurrentMonthSalary;
  lastPayment: LastPayment;
  nextPayment: NextPayment;
  ytdEarnings: YearToDateEarnings;
  status: DriverPayrollStatus;
  details: {
    baseSalary: number;
    allowances: {
      nightDuty: number;
      outstation: number;
      food: number;
      other: number;
    };
    advancesDeduction: number;
    penaltyDeduction: number;
    attendanceBonus: number;
    incentives: number;
  };
  paymentHistory: {
    date: Date;
    amount: number;
    mode: string;
    reference: string;
  }[];
}

/**
 * Get current month date range
 */
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Get previous month date range
 */
function getPreviousMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
}

/**
 * Get YTD date range
 */
function getYTDRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return { start, end };
}

/**
 * Get Previous Year YTD date range
 */
function getPreviousYearYTDRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, 0, 1);
  const end = new Date(now.getFullYear() - 1, 11, 31);
  return { start, end };
}

/**
 * Calculate next salary payment date
 * Typically on the last day of the current month
 */
function calculateNextPaymentDate(): Date {
  const now = new Date();
  // Last day of current month
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

/**
 * Calculate days until next payment
 */
function daysUntilDate(date: Date): number {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determine payment status based on pending amount
 */
function getPayrollStatus(
  pending: number,
  net: number
): DriverPayrollStatus {
  if (pending === 0) {
    return {
      color: 'green',
      label: 'on_track',
      message: 'All payments current'
    };
  }

  const percentPending = (pending / net) * 100;

  if (percentPending <= 25) {
    return {
      color: 'yellow',
      label: 'pending',
      message: `₹${pending.toLocaleString('en-IN')} pending (${percentPending.toFixed(0)}%)`
    };
  }

  return {
    color: 'red',
    label: 'overdue',
    message: `₹${pending.toLocaleString('en-IN')} overdue - Action required`
  };
}

/**
 * Aggregate driver payroll data
 * Main function that combines all salary & payroll information
 */
export async function getDriverPayrollAggregation(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId
): Promise<EnhancedDriver360Salary | null> {
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);
  const driverObjId = new mongoose.Types.ObjectId(driverId);

  console.log(`[PAYROLL-AGG] Fetching payroll aggregation for driver ${driverId}`);

  try {
    // Fetch driver
    const driver = await Driver.findOne({
      _id: driverObjId,
      tenantId: tenantObjId
    }).lean();

    if (!driver) {
      console.error(`[PAYROLL-AGG] Driver not found: ${driverId}`);
      return null;
    }

    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: tenantObjId,
      driverId: driverObjId,
      status: 'active'
    }).lean();

    if (!salaryMaster) {
      console.warn(`[PAYROLL-AGG] No active salary master for driver ${driverId}`);
      return null;
    }

    // Get date ranges
    const currentMonth = getCurrentMonthRange();
    const previousMonth = getPreviousMonthRange();
    const ytd = getYTDRange();
    const prevYearYtd = getPreviousYearYTDRange();

    // Fetch all data in parallel
    const [
      attendanceCurrentMonth,
      attendancePreviousMonth,
      bookingsCurrentMonth,
      advancesActive,
      recoveryCurrentMonth,
      paymentsCurrentMonth,
      paymentsPreviousMonth,
      paymentsYTD,
      paymentsYTDPrevYear
    ] = await Promise.all([
      // Current month attendance
      DriverAttendance.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        date: { $gte: currentMonth.start, $lte: currentMonth.end }
      }).lean(),

      // Previous month attendance
      DriverAttendance.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        date: { $gte: previousMonth.start, $lte: previousMonth.end }
      }).lean(),

      // Current month bookings
      Booking.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: currentMonth.start, $lte: currentMonth.end },
        status: 'completed'
      }).lean(),

      // Active advances
      DriverAdvance.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        status: { $in: ['paid', 'partially_recovered'] }
      }).lean(),

      // Current month recoveries
      DriverRecovery.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: currentMonth.start, $lte: currentMonth.end }
      }).lean(),

      // Current month payments
      DriverSalaryPayment.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: currentMonth.start, $lte: currentMonth.end }
      }).lean(),

      // Previous month payments
      DriverSalaryPayment.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: previousMonth.start, $lte: previousMonth.end }
      }).lean(),

      // YTD payments
      DriverSalaryPayment.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: ytd.start, $lte: ytd.end }
      }).lean(),

      // Previous year YTD payments
      DriverSalaryPayment.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: prevYearYtd.start, $lte: prevYearYtd.end }
      }).lean()
    ]);

    // Calculate salary components
    const baseSalary = salaryMaster.baseSalary || 15000;

    // Allowances
    const nightDutyAllowance = (salaryMaster.nightAllowancePerNight || 0) *
      bookingsCurrentMonth.filter((b: any) =>
        b.pickupTime && new Date(b.pickupTime).getHours() >= 22
      ).length;

    const outstationAllowance = (salaryMaster.outstationAllowancePerDay || 0) *
      bookingsCurrentMonth.filter((b: any) =>
        b.tripType === 'outstation' || b.tripType === 'long_distance'
      ).length;

    const foodAllowance = salaryMaster.foodAllowance || 0;
    const otherAllowances = salaryMaster.allowances?.reduce((sum: number, a: any) =>
      sum + (a.amount || 0), 0) || 0;

    // Attendance bonus (13.33% for perfect attendance)
    const presentDays = attendanceCurrentMonth.filter((a: any) =>
      a.status === 'present' || a.status === 'on_duty'
    ).length;
    const attendanceBonus = Math.floor(baseSalary * 0.1333 * (presentDays / 26));

    // KM incentive
    const totalKms = bookingsCurrentMonth.reduce((sum: number, b: any) =>
      sum + (b.totalKilometers || 0), 0);
    const kmIncentive = totalKms * (salaryMaster.kmIncentivePerKm || 1.5);

    // Total incentives
    const totalIncentives = nightDutyAllowance + outstationAllowance + foodAllowance +
      otherAllowances + attendanceBonus + kmIncentive;

    // Deductions
    const advancesDeduction = advancesActive.reduce((sum: number, a: any) =>
      sum + (a.remaining || 0), 0);

    const penaltyDeduction = recoveryCurrentMonth.reduce((sum: number, r: any) =>
      sum + (r.amount || 0), 0);

    const totalDeductions = advancesDeduction + penaltyDeduction;

    // Salary calculations
    const grossSalary = baseSalary + totalIncentives;
    const netPayable = grossSalary - totalDeductions;
    const totalPaid = paymentsCurrentMonth.reduce((sum: number, p: any) =>
      sum + (p.amount || 0), 0);
    const pending = Math.max(0, netPayable - totalPaid);

    // Payment history
    const paymentHistory = paymentsCurrentMonth
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((p: any) => ({
        date: new Date(p.createdAt),
        amount: p.amount || 0,
        mode: p.paymentMode || 'bank_transfer',
        reference: p.reference || ''
      }));

    // Last payment
    const lastPaymentRecord = paymentsCurrentMonth.length > 0
      ? paymentsCurrentMonth[0]
      : paymentsPreviousMonth.length > 0
      ? paymentsPreviousMonth[0]
      : null;

    const lastPayment: LastPayment = lastPaymentRecord
      ? {
          date: new Date(lastPaymentRecord.createdAt),
          amount: lastPaymentRecord.amount || 0,
          status: 'paid',
          paymentMode: lastPaymentRecord.paymentMode || 'bank_transfer'
        }
      : {
          date: null,
          amount: 0,
          status: pending > 0 ? 'pending' : 'none'
        };

    // Next payment date
    const nextPaymentDate = calculateNextPaymentDate();
    const nextPayment: NextPayment = {
      date: nextPaymentDate,
      estimatedAmount: netPayable,
      daysUntil: daysUntilDate(nextPaymentDate)
    };

    // YTD earnings
    const ytdTotal = paymentsYTD.reduce((sum: number, p: any) =>
      sum + (p.amount || 0), 0);

    const prevYearYtdTotal = paymentsYTDPrevYear.reduce((sum: number, p: any) =>
      sum + (p.amount || 0), 0);

    const ytdChangePercentage = prevYearYtdTotal > 0
      ? ((ytdTotal - prevYearYtdTotal) / prevYearYtdTotal) * 100
      : 0;

    const ytdTrend = ytdChangePercentage > 5 ? 'increasing' :
                     ytdChangePercentage < -5 ? 'decreasing' : 'flat';

    // Build result
    const result: EnhancedDriver360Salary = {
      currentMonth: {
        base: baseSalary,
        incentives: totalIncentives,
        deductions: totalDeductions,
        net: netPayable,
        paid: totalPaid,
        pending: pending,
        paidPercentage: netPayable > 0 ? (totalPaid / netPayable) * 100 : 0
      },
      lastPayment,
      nextPayment,
      ytdEarnings: {
        total: ytdTotal,
        previousYearTotal: prevYearYtdTotal,
        changePercentage: ytdChangePercentage,
        trend: ytdTrend
      },
      status: getPayrollStatus(pending, netPayable),
      details: {
        baseSalary,
        allowances: {
          nightDuty: nightDutyAllowance,
          outstation: outstationAllowance,
          food: foodAllowance,
          other: otherAllowances
        },
        advancesDeduction,
        penaltyDeduction,
        attendanceBonus,
        incentives: kmIncentive
      },
      paymentHistory
    };

    console.log(`[PAYROLL-AGG] ✅ Aggregation complete:`, {
      baseSalary,
      totalIncentives,
      netPayable,
      paid: totalPaid,
      pending
    });

    return result;
  } catch (error) {
    console.error(`[PAYROLL-AGG] ❌ Failed to aggregate payroll:`, error);
    throw error;
  }
}

/**
 * Get enhanced Driver 360 data with integrated salary
 * Combines driver info from driver360Service with payroll aggregation
 */
export async function getEnhancedDriver360WithSalary(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  baseDriver360Data?: any
) {
  const payrollData = await getDriverPayrollAggregation(tenantId, driverId);

  return {
    ...baseDriver360Data,
    salary: payrollData,
    salaryLastUpdated: new Date()
  };
}
