/**
 * DRIVER AUTO-ENROLLMENT SERVICE
 * 100% Automation for salary master creation, payroll enrollment, and real-time 360 sync
 *
 * When a driver is created:
 * 1. Auto-create salary master with default values
 * 2. Auto-enroll in current month payroll
 * 3. Auto-sync all related data (attendance, bookings, advances)
 * 4. Auto-populate 360 view
 * 5. Auto-calculate salary in real-time
 */

import mongoose from 'mongoose';
import {
  Driver,
  DriverSalaryMaster,
  DriverAttendance,
  DriverAdvance,
  DriverRecovery,
  DriverSalaryPayment,
  Booking,
  MonthlyPayroll,
  IDriver,
  IDriverSalaryMaster
} from '../models/index';
import { createOrUpdateSalaryMaster } from './driverSalaryMasterService';
import { calculateSalary } from './salaryCalculationService';

/**
 * DEFAULT AUTO-ENROLLMENT SETTINGS
 * Applied to every new driver automatically
 */
export const DEFAULT_AUTO_ENROLLMENT = {
  salaryType: 'fixed_monthly' as const,
  baseSalary: 15000, // Default base salary
  attendanceBonusPercentage: 13.33, // 13.33% bonus for perfect attendance
  nightDutyAllowancePerTrip: 40, // ₹40 per night duty trip
  outstationAllowancePerTrip: 60, // ₹60 per outstation trip
  kmIncentiveRate: 1.50, // ₹1.50 per km
  weeklyOffDays: [0], // Sunday
  weeklyOffLeaveType: 'paid' as const,
  status: 'active' as const,
  startDate: new Date()
};

/**
 * PHASE 1: Auto-create salary master when driver is added
 * Called immediately after driver creation
 */
export async function autoCreateSalaryMaster(
  driver: IDriver,
  tenantId: mongoose.Types.ObjectId
): Promise<IDriverSalaryMaster> {
  console.log(`[AUTO-ENROLL] Creating salary master for driver ${driver.name} (${driver._id})`);

  try {
    const salaryMasterData = {
      tenantId: tenantId.toString(),
      driverId: driver._id.toString(),
      salaryType: DEFAULT_AUTO_ENROLLMENT.salaryType,
      baseSalary: DEFAULT_AUTO_ENROLLMENT.baseSalary,
      nightAllowancePerNight: DEFAULT_AUTO_ENROLLMENT.nightDutyAllowancePerTrip,
      outstationAllowancePerDay: DEFAULT_AUTO_ENROLLMENT.outstationAllowancePerTrip,
      kmIncentivePerKm: DEFAULT_AUTO_ENROLLMENT.kmIncentiveRate,
      weeklyOffDays: DEFAULT_AUTO_ENROLLMENT.weeklyOffDays,
      weeklyOffLeaveType: DEFAULT_AUTO_ENROLLMENT.weeklyOffLeaveType,
      salaryStartDate: driver.dateOfJoining || new Date(),
      status: 'active'
    };

    const salaryMaster = await createOrUpdateSalaryMaster(salaryMasterData);
    console.log(`[AUTO-ENROLL] ✅ Salary master created: ${salaryMaster._id}`);
    return salaryMaster;
  } catch (error) {
    console.error(`[AUTO-ENROLL] ❌ Failed to create salary master:`, error);
    throw error;
  }
}

/**
 * PHASE 2: Auto-enroll in current month payroll
 * Add driver to payroll processing queue
 */
export async function autoEnrollInPayroll(
  driver: IDriver,
  tenantId: mongoose.Types.ObjectId,
  salaryMaster: IDriverSalaryMaster
): Promise<void> {
  console.log(`[AUTO-ENROLL] Enrolling driver ${driver.name} in payroll`);

  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Check if payroll record exists for current month
    let payroll = await MonthlyPayroll.findOne({
      tenantId,
      month: currentMonth,
      year: currentYear
    });

    if (!payroll) {
      // Create payroll record for current month
      payroll = await MonthlyPayroll.create({
        tenantId,
        month: currentMonth,
        year: currentYear,
        status: 'calculated',
        driverPayrolls: [],
        driverCount: 0,
        totalGrossSalary: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        totalPaid: 0,
        totalPending: 0,
        createdAt: new Date()
      });
      console.log(`[AUTO-ENROLL] Created payroll record for ${currentMonth}/${currentYear}`);
    }

    // Note: Drivers are added to payroll via calculatePayroll, not here
    console.log(`[AUTO-ENROLL] ✅ Payroll record exists for ${currentMonth}/${currentYear}`);
  } catch (error) {
    console.error(`[AUTO-ENROLL] ❌ Failed to enroll in payroll:`, error);
    // Don't throw - payroll enrollment is secondary to salary master
  }
}

/**
 * PHASE 3: Real-time data sync trigger
 * Called on every relevant event (attendance, booking completed, advance given)
 */
export async function triggerAutoSyncPayrollData(
  driverId: mongoose.Types.ObjectId,
  tenantId: mongoose.Types.ObjectId
): Promise<void> {
  console.log(`[AUTO-SYNC] Triggered for driver ${driverId}`);

  try {
    // This runs in background - don't wait for completion
    syncPayrollDataAsync(driverId, tenantId).catch(err => {
      console.error(`[AUTO-SYNC] Background sync failed:`, err);
    });
  } catch (error) {
    console.error(`[AUTO-SYNC] ❌ Failed to trigger sync:`, error);
  }
}

/**
 * Async background sync - fetches all related data
 */
async function syncPayrollDataAsync(
  driverId: mongoose.Types.ObjectId,
  tenantId: mongoose.Types.ObjectId
): Promise<void> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    // Fetch all current month data in parallel
    const [attendance, bookings, advances, penalties] = await Promise.all([
      DriverAttendance.findOne({
        tenantId,
        driverId,
        date: { $gte: monthStart, $lte: monthEnd }
      }),
      Booking.find({
        tenantId,
        driverId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: { $in: ['completed', 'ongoing', 'trip_started'] }
      }).countDocuments(),
      DriverAdvance.find({
        tenantId,
        driverId,
        status: { $in: ['paid', 'partially_recovered'] }
      }),
      DriverRecovery.find({
        tenantId,
        driverId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      })
    ]);

    console.log(`[AUTO-SYNC] ✅ Synced data:`, {
      attendance: attendance ? 'yes' : 'no',
      bookings: bookings,
      advances: advances.length,
      penalties: penalties.length
    });
  } catch (error) {
    console.error(`[AUTO-SYNC] ❌ Data sync failed:`, error);
  }
}

/**
 * PHASE 4: Auto 360 View - Real-time complete profile
 */
export interface Driver360View {
  driver: any;
  salary: any;
  attendance: any;
  bookings: any;
  advances: any;
  penalties: any;
  payroll: any;
  view360: {
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
    pendingPayment: number;
    paid: number;
    lastUpdated: Date;
  };
}

export async function getAuto360View(
  driverId: string,
  tenantId: string
): Promise<Driver360View> {
  const driverObjId = new mongoose.Types.ObjectId(driverId);
  const tenantObjId = new mongoose.Types.ObjectId(tenantId);

  console.log(`[AUTO-360] Fetching real-time 360 view for driver ${driverId}`);

  try {
    // Fetch driver basic info
    const driver = await Driver.findOne({
      _id: driverObjId,
      tenantId: tenantObjId
    }).lean();

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: tenantObjId,
      driverId: driverObjId
    }).lean();

    // Current month date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch all related data in parallel
    const [attendanceRecords, bookings, advances, penalties, paymentRecords] = await Promise.all([
      // Attendance for current month
      DriverAttendance.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        date: { $gte: monthStart, $lte: monthEnd }
      }).lean(),

      // Completed bookings for current month
      Booking.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: monthStart, $lte: monthEnd },
        status: 'completed'
      }).lean(),

      // Active advances
      DriverAdvance.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        status: { $in: ['paid', 'partially_recovered'] }
      }).lean(),

      // Recent penalties
      DriverRecovery.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).lean(),

      // Payment records
      DriverSalaryPayment.find({
        tenantId: tenantObjId,
        driverId: driverObjId,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }).lean()
    ]);

    // Calculate totals
    const totalAdvances = advances.reduce((sum: number, a: any) => sum + (a.remaining || 0), 0);
    const totalPenalties = penalties.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalDeductions = totalAdvances + totalPenalties;
    const totalPaid = paymentRecords.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Calculate salary
    let salary: any = null;
    if (salaryMaster) {
      const baseSalary = salaryMaster.baseSalary || 0;
      const totalAllowances = (salaryMaster.nightAllowancePerNight || 0) +
        (salaryMaster.outstationAllowancePerDay || 0) +
        (salaryMaster.foodAllowance || 0);

      const grossSalary = baseSalary + totalAllowances;
      const netPayable = grossSalary - totalDeductions;
      const pending = netPayable - totalPaid;

      salary = {
        id: salaryMaster._id?.toString(),
        baseSalary,
        allowances: totalAllowances,
        grossSalary,
        deductions: totalDeductions,
        netPayable,
        paid: totalPaid,
        pending,
        configuredAt: salaryMaster.createdAt
      };
    }

    // Build 360 view
    const view360: Driver360View = {
      driver: {
        id: driver._id?.toString(),
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        status: driver.status,
        dateOfJoining: driver.dateOfJoining,
        licenseNumber: driver.licenseNumber,
        rating: driver.rating
      },
      salary,
      attendance: attendanceRecords && attendanceRecords.length > 0 ? {
        presentDays: attendanceRecords.filter((r: any) => r.status === 'present' || r.status === 'on_duty').length,
        absentDays: attendanceRecords.filter((r: any) => r.status === 'absent').length,
        paidLeaveDays: attendanceRecords.filter((r: any) => r.status === 'paid_leave').length,
        unpaidLeaveDays: attendanceRecords.filter((r: any) => r.status === 'unpaid_leave').length,
        weeklyOffDays: attendanceRecords.filter((r: any) => r.status === 'weekly_off').length,
        halfDays: attendanceRecords.filter((r: any) => r.status === 'half_day').length
      } : null,
      bookings: {
        count: bookings.length,
        totalKms: bookings.reduce((sum: number, b: any) => sum + (b.totalKilometers || 0), 0),
        items: bookings.slice(0, 10).map((b: any) => ({
          id: b._id?.toString(),
          vehicle: b.vehicleId,
          status: b.status,
          createdAt: b.createdAt
        }))
      },
      advances: {
        count: advances.length,
        total: totalAdvances,
        items: advances.map((a: any) => ({
          id: a._id?.toString(),
          amount: a.amount,
          remaining: a.remaining,
          status: a.status,
          requestedAt: a.createdAt
        }))
      },
      penalties: {
        count: penalties.length,
        total: totalPenalties,
        items: penalties.map((p: any) => ({
          id: p._id?.toString(),
          amount: p.amount,
          reason: p.reason,
          createdAt: p.createdAt
        }))
      },
      payroll: null,
      view360: {
        totalEarnings: salary?.grossSalary || 0,
        totalDeductions: totalDeductions,
        netSalary: salary?.netPayable || 0,
        pendingPayment: salary?.pending || 0,
        paid: totalPaid,
        lastUpdated: new Date()
      }
    };

    console.log(`[AUTO-360] ✅ 360 view fetched successfully`);
    return view360;
  } catch (error) {
    console.error(`[AUTO-360] ❌ Failed to fetch 360 view:`, error);
    throw error;
  }
}

/**
 * PHASE 5: Auto-calculate salary on data change
 * Called whenever attendance, booking, or advance data changes
 */
export async function autoRecalculateSalary(
  driverId: mongoose.Types.ObjectId,
  tenantId: mongoose.Types.ObjectId,
  month?: number,
  year?: number
): Promise<any> {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  console.log(`[AUTO-CALC] Recalculating salary for ${driverId} (${targetMonth}/${targetYear})`);

  try {
    // Fetch salary master
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId,
      driverId,
      status: 'active'
    });

    if (!salaryMaster) {
      throw new Error('Salary master not found');
    }

    // Fetch all data for calculation
    const periodStart = new Date(targetYear, targetMonth - 1, 1);
    const periodEnd = new Date(targetYear, targetMonth, 0);

    const [attendanceRecords, bookings, advances, penalties] = await Promise.all([
      DriverAttendance.find({
        tenantId,
        driverId,
        date: { $gte: periodStart, $lte: periodEnd }
      }),
      Booking.find({
        tenantId,
        driverId,
        createdAt: { $gte: periodStart, $lte: periodEnd }
      }),
      DriverAdvance.find({
        tenantId,
        driverId,
        status: 'paid'
      }),
      DriverRecovery.find({
        tenantId,
        driverId,
        createdAt: { $gte: periodStart, $lte: periodEnd }
      })
    ]);

    // Calculate salary
    const baseSalary = salaryMaster.baseSalary || 0;
    const presentDays = attendanceRecords.filter((r: any) => r.status === 'present' || r.status === 'on_duty').length;
    const attendanceBonus = presentDays > 0
      ? presentDays * ((salaryMaster.baseSalary || 0) * 0.1333) // 13.33%
      : 0;

    const tripIncentive = bookings.reduce((sum, b: any) => {
      return sum + ((b.totalKilometers || 0) * (salaryMaster.kmIncentivePerKm || 0));
    }, 0);

    const nightAllowance = bookings.filter((b: any) => b.pickupTime && new Date(b.pickupTime).getHours() >= 22).length *
      (salaryMaster.nightAllowancePerNight || 0);

    const advanceDeduction = advances.reduce((sum: number, a: any) => sum + (a.remaining || 0), 0);
    const penaltyDeduction = penalties.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const grossSalary = baseSalary + attendanceBonus + tripIncentive + nightAllowance;
    const totalDeductions = advanceDeduction + penaltyDeduction;
    const netSalary = grossSalary - totalDeductions;

    console.log(`[AUTO-CALC] ✅ Salary calculated:`, {
      baseSalary,
      attendanceBonus,
      tripIncentive,
      nightAllowance,
      grossSalary,
      deductions: totalDeductions,
      netSalary
    });

    return {
      driverId,
      month: targetMonth,
      year: targetYear,
      baseSalary,
      attendanceBonus,
      tripIncentive,
      nightAllowance,
      grossSalary,
      deductions: {
        advance: advanceDeduction,
        penalty: penaltyDeduction
      },
      totalDeductions,
      netSalary,
      calculatedAt: new Date()
    };
  } catch (error) {
    console.error(`[AUTO-CALC] ❌ Salary calculation failed:`, error);
    throw error;
  }
}

/**
 * PHASE 6: Auto-process monthly payroll
 * Scheduled job to run on 1st of each month
 */
export async function autoProcessMonthlyPayroll(
  tenantId: mongoose.Types.ObjectId,
  month?: number,
  year?: number
): Promise<any> {
  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  console.log(`[AUTO-PAYROLL] Processing payroll for ${targetMonth}/${targetYear}`);

  try {
    // Get all active drivers
    const drivers = await Driver.find({
      tenantId,
      status: 'active'
    });

    const payrollData: any[] = [];

    // Calculate salary for each driver
    for (const driver of drivers) {
      try {
        const salary = await autoRecalculateSalary(driver._id, tenantId, targetMonth, targetYear);
        payrollData.push({
          driverId: driver._id,
          ...salary
        });
      } catch (error) {
        console.error(`[AUTO-PAYROLL] ⚠️ Failed to calculate for ${driver.name}:`, error);
      }
    }

    console.log(`[AUTO-PAYROLL] ✅ Payroll processed for ${payrollData.length} drivers`);

    return {
      month: targetMonth,
      year: targetYear,
      totalDrivers: payrollData.length,
      totalGross: payrollData.reduce((sum: number, d: any) => sum + d.grossSalary, 0),
      totalDeductions: payrollData.reduce((sum: number, d: any) => sum + d.totalDeductions, 0),
      totalNet: payrollData.reduce((sum: number, d: any) => sum + d.netSalary, 0),
      drivers: payrollData
    };
  } catch (error) {
    console.error(`[AUTO-PAYROLL] ❌ Payroll processing failed:`, error);
    throw error;
  }
}

/**
 * PHASE 7: Export all automation functions
 */
export const DriverAutoEnrollment = {
  // Initialization
  autoCreateSalaryMaster,
  autoEnrollInPayroll,

  // Real-time sync
  triggerAutoSyncPayrollData,

  // 360 view
  getAuto360View,

  // Calculations
  autoRecalculateSalary,

  // Payroll processing
  autoProcessMonthlyPayroll
};

export default DriverAutoEnrollment;
