import mongoose from 'mongoose';
import {
  MonthlyPayroll,
  IMonthlyPayroll,
  DriverSalaryMaster,
  Driver,
  DriverAdvance,
  DriverSalaryLedger,
  DriverAttendance,
  Booking
} from '../models/index';
import {
  calculateSalary,
  SalaryCalculationInput,
  SalaryBreakup,
  AttendanceData,
  TripIncentiveData,
  DeductionData
} from './salaryCalculationService';

export interface PayrollCalculationRequest {
  tenantId: string;
  month: number;
  year: number;
  drivers?: string[]; // If specified, only calculate for these drivers
  overrideAttendance?: Record<string, AttendanceData>;
  overrideTripIncentives?: Record<string, TripIncentiveData>;
  overrideDeductions?: Record<string, DeductionData>;
}

/**
 * Helper: Fetch attendance data for a driver in given month
 */
async function fetchAttendanceForMonth(
  tenantId: string,
  driverId: mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<AttendanceData | undefined> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const records = await DriverAttendance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      date: { $gte: startDate, $lte: endDate }
    });

    let presentDays = 0;
    let absentDays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0;
    let halfDays = 0;
    let weeklyOffs = 0;

    for (const record of records) {
      switch (record.status) {
        case 'present':
        case 'late':
          presentDays++;
          break;
        case 'absent':
          absentDays++;
          break;
        case 'paid_leave':
          paidLeaves++;
          break;
        case 'unpaid_leave':
          unpaidLeaves++;
          break;
        case 'half_day':
          halfDays++;
          break;
        case 'weekly_off':
          weeklyOffs++;
          break;
      }
    }

    const totalWorkingDays = presentDays + halfDays + paidLeaves + unpaidLeaves;

    return {
      presentDays,
      absentDays,
      paidLeaves,
      unpaidLeaves,
      halfDays,
      weeklyOffs,
      totalWorkingDays: totalWorkingDays || 26 // Default to 26 if no attendance data
    };
  } catch (error) {
    console.error('Error fetching attendance:', error);
    // Return default attendance data if fetch fails
    return {
      presentDays: 0,
      absentDays: 0,
      paidLeaves: 0,
      unpaidLeaves: 0,
      halfDays: 0,
      weeklyOffs: 0,
      totalWorkingDays: 26
    };
  }
}

/**
 * Helper: Fetch trip incentive data for a driver in given month
 * Only counts COMPLETED bookings for the incentive calculation
 */
async function fetchTripIncentivesForMonth(
  tenantId: string,
  driverId: mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<TripIncentiveData | undefined> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    // Only count COMPLETED bookings, as in_progress and confirmed are not finalized
    const bookings = await Booking.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId,
      pickupDate: { $gte: startDate, $lte: endDate },
      status: 'completed'
    });

    let totalTrips = bookings.length;
    let totalKm = 0;
    let nightDutyTrips = 0;
    let outstationTrips = 0;
    let specialDutyTrips = 0;

    for (const booking of bookings) {
      if ((booking as any).tripDistance) totalKm += (booking as any).tripDistance;
      if ((booking as any).isNightDuty) nightDutyTrips++;
      if ((booking as any).isOutstation) outstationTrips++;
      if ((booking as any).specialDuty) specialDutyTrips++;
    }

    return {
      totalTrips,
      totalKm,
      nightDutyTrips,
      outstationTrips,
      specialDutyTrips
    };
  } catch (error) {
    console.error('Error fetching trip incentives:', error);
    // Return default trip data if fetch fails
    return {
      totalTrips: 0,
      totalKm: 0,
      nightDutyTrips: 0,
      outstationTrips: 0,
      specialDutyTrips: 0
    };
  }
}

export async function calculatePayroll(
  request: PayrollCalculationRequest,
  calculatedBy: { userId: string; role: string }
): Promise<IMonthlyPayroll> {
  // Validate month and year
  if (request.month < 1 || request.month > 12) {
    throw new Error('Invalid month. Must be between 1 and 12');
  }
  if (request.year < 2020) {
    throw new Error('Invalid year. Must be 2020 or later');
  }

  // Check if payroll already exists for this month
  const existing = await MonthlyPayroll.findOne({
    tenantId: new mongoose.Types.ObjectId(request.tenantId),
    month: request.month,
    year: request.year
  });

  if (existing && ['closed', 'paid'].includes(existing.status)) {
    throw new Error(`Cannot recalculate a ${existing.status} payroll`);
  }

  if (existing && existing.status === 'approved' && existing.totalPaid > 0) {
    throw new Error('Cannot recalculate an approved payroll with payments recorded');
  }

  // Get list of drivers to process
  let drivers;
  if (request.drivers && request.drivers.length > 0) {
    drivers = await Driver.find({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      _id: { $in: request.drivers.map(id => new mongoose.Types.ObjectId(id)) }
    }).catch(err => {
      console.error('Error fetching specified drivers:', err);
      throw new Error('Failed to fetch drivers');
    });
  } else {
    drivers = await Driver.find({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      status: { $ne: 'inactive' }
    }).catch(err => {
      console.error('Error fetching drivers:', err);
      throw new Error('Failed to fetch drivers');
    });
  }

  if (!drivers || drivers.length === 0) {
    throw new Error('No active drivers found for payroll calculation');
  }

  // Calculate salary for each driver
  const driverPayrolls = [];

  for (const driver of drivers) {
    try {
      const salaryMaster = await DriverSalaryMaster.findOne({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        driverId: driver._id,
        status: 'active'
      });

      if (!salaryMaster) {
        console.warn(`Skipping driver ${driver.name} - no active salary configuration`);
        continue; // Skip drivers without salary configuration
      }

      // Get advances
      const advances = await DriverAdvance.find({
        tenantId: new mongoose.Types.ObjectId(request.tenantId),
        driverId: driver._id,
        status: { $in: ['paid', 'approved'] }
      }).catch(() => []);

      // Fetch attendance data (use override if provided, otherwise fetch from DB)
      let attendance = request.overrideAttendance?.[driver._id.toString()];
      if (!attendance) {
        attendance = await fetchAttendanceForMonth(
          request.tenantId,
          driver._id,
          request.month,
          request.year
        );
      }

      // Fetch trip incentive data (use override if provided, otherwise fetch from DB)
      let tripIncentives = request.overrideTripIncentives?.[driver._id.toString()];
      if (!tripIncentives) {
        tripIncentives = await fetchTripIncentivesForMonth(
          request.tenantId,
          driver._id,
          request.month,
          request.year
        );
      }

      // Use override deductions if provided
      const deductions = request.overrideDeductions?.[driver._id.toString()];

      // Prepare calculation input
      const calcInput: SalaryCalculationInput = {
        salaryMaster,
        month: request.month,
        year: request.year,
        attendance,
        tripIncentives,
        deductions,
        advances
      };

      const breakup = calculateSalary(calcInput);

      // Driver name fallback
      const driverName = driver.name || `Driver ${driver._id}`;

      // Create payroll entry for this driver
      driverPayrolls.push({
        driverId: driver._id,
        driverName,
        baseSalary: breakup.earnings.baseSalary,
        attendanceBonus: breakup.earnings.attendanceBonus || undefined,
        tripIncentive: breakup.earnings.tripIncentive || undefined,
        kmIncentive: breakup.earnings.kmIncentive || undefined,
        nightAllowance: breakup.earnings.nightAllowance || undefined,
        outstationAllowance: breakup.earnings.outstationAllowance || undefined,
        foodAllowance: breakup.earnings.foodAllowance || undefined,
        grossSalary: breakup.grossSalary,
        absenceDeduction: breakup.deductions.absenceDeduction || undefined,
        advanceRecovery: breakup.deductions.advanceRecovery || undefined,
        penaltyDeduction: breakup.deductions.penaltyDeduction || undefined,
        damageRecovery: breakup.deductions.damageRecovery || undefined,
        challanRecovery: breakup.deductions.challanRecovery || undefined,
        cashShortage: breakup.deductions.cashShortage || undefined,
        fuelExcessRecovery: breakup.deductions.fuelExcessRecovery || undefined,
        otherDeductions: breakup.deductions.otherDeductions || undefined,
        totalDeductions: breakup.totalDeductions,
        netSalary: breakup.netSalary,
        paymentStatus: 'not_paid',
        payments: [],
        totalPaid: 0,
        remainingAmount: breakup.netSalary,
        calculatedBy,
        calculatedAt: new Date()
      });
    } catch (error) {
      console.error(`Error calculating payroll for driver ${driver.name}:`, error);
      // Continue with next driver instead of failing entire payroll
    }
  }

  // Ensure we have at least one driver payroll
  if (driverPayrolls.length === 0) {
    throw new Error('No driver payrolls could be calculated. Check that drivers have active salary configuration.');
  }

  // Calculate payroll totals
  const totalGrossSalary = driverPayrolls.reduce((sum, dp) => sum + dp.grossSalary, 0);
  const totalDeductions = driverPayrolls.reduce((sum, dp) => sum + dp.totalDeductions, 0);
  const totalNetSalary = driverPayrolls.reduce((sum, dp) => sum + dp.netSalary, 0);

  console.log(`Payroll calculation complete: ${driverPayrolls.length} drivers, Total: ₹${totalNetSalary}`);

  // Create or update payroll
  if (existing) {
    // Preserve payment information from existing payroll
    const existingPaymentInfo = new Map(
      existing.driverPayrolls.map(dp => [dp.driverId.toString(), { totalPaid: dp.totalPaid, payments: dp.payments }])
    );

    // Merge new calculations with existing payment data
    const mergedPayrolls = driverPayrolls.map(newDp => {
      const existingPayment = existingPaymentInfo.get(newDp.driverId.toString());
      if (existingPayment) {
        return {
          ...newDp,
          totalPaid: existingPayment.totalPaid,
          payments: existingPayment.payments,
          remainingAmount: Math.max(0, newDp.netSalary - existingPayment.totalPaid),
          paymentStatus:
            existingPayment.totalPaid === 0 ? 'not_paid' :
            existingPayment.totalPaid >= newDp.netSalary ? 'paid' :
            'partially_paid'
        };
      }
      return newDp;
    });

    // Recalculate totals with preserved payment data
    const recalculatedTotalPaid = mergedPayrolls.reduce((sum, dp) => sum + dp.totalPaid, 0);
    const recalculatedTotalPending = totalNetSalary - recalculatedTotalPaid;

    existing.driverPayrolls = mergedPayrolls;
    existing.driverCount = driverPayrolls.length;
    existing.totalGrossSalary = totalGrossSalary;
    existing.totalDeductions = totalDeductions;
    existing.totalNetSalary = totalNetSalary;
    existing.totalPaid = recalculatedTotalPaid;
    existing.totalPending = recalculatedTotalPending;
    existing.status = 'calculated';
    existing.updatedAt = new Date();
    return existing.save();
  }

  return MonthlyPayroll.create({
    tenantId: new mongoose.Types.ObjectId(request.tenantId),
    month: request.month,
    year: request.year,
    status: 'calculated',
    driverCount: driverPayrolls.length,
    totalGrossSalary,
    totalDeductions,
    totalNetSalary,
    totalPaid: 0,
    totalPending: totalNetSalary,
    driverPayrolls
  });
}

export async function getPayroll(
  tenantId: string,
  payrollId: string
): Promise<IMonthlyPayroll | null> {
  return MonthlyPayroll.findOne({
    _id: new mongoose.Types.ObjectId(payrollId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });
}

export async function getPayrollByMonth(
  tenantId: string,
  month: number,
  year: number
): Promise<IMonthlyPayroll | null> {
  return MonthlyPayroll.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    month,
    year
  });
}

export async function approvePayroll(
  tenantId: string,
  payrollId: string,
  approvedBy: { userId: string; role: string },
  notes?: string
): Promise<IMonthlyPayroll | null> {
  const payroll = await MonthlyPayroll.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(payrollId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: { $in: ['calculated', 'under_review'] }
    },
    {
      status: 'approved',
      updatedAt: new Date(),
      'driverPayrolls.$[].approvedBy': approvedBy,
      'driverPayrolls.$[].approvedAt': new Date(),
      'driverPayrolls.$[].approvalNotes': notes
    },
    { new: true }
  );

  return payroll;
}

export async function recordPaymentForDriver(
  tenantId: string,
  payrollId: string,
  driverId: string,
  paidAmount: number,
  paymentMode: 'cash' | 'bank_transfer' | 'upi' | 'split',
  paidBy: { userId: string; role: string },
  transactionReference?: string
): Promise<IMonthlyPayroll | null> {
  const payroll = await MonthlyPayroll.findOne({
    _id: new mongoose.Types.ObjectId(payrollId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });

  if (!payroll) {
    throw new Error('Payroll not found');
  }

  const driverPayroll = payroll.driverPayrolls.find(
    (dp) => dp.driverId.toString() === driverId
  );

  if (!driverPayroll) {
    throw new Error('Driver not found in payroll');
  }

  // Validate payment amount
  if (paidAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  if (paidAmount > driverPayroll.remainingAmount) {
    throw new Error(`Payment amount ₹${paidAmount} exceeds remaining amount ₹${driverPayroll.remainingAmount}`);
  }

  // Add payment
  driverPayroll.payments.push({
    paidAmount,
    paymentDate: new Date(),
    paymentMode,
    transactionReference,
    paidBy
  });

  // Update totals
  driverPayroll.totalPaid += paidAmount;
  driverPayroll.remainingAmount = Math.max(0, driverPayroll.netSalary - driverPayroll.totalPaid);

  // Update payment status
  if (driverPayroll.remainingAmount === 0) {
    driverPayroll.paymentStatus = 'paid';
    driverPayroll.paidAt = new Date();
  } else if (driverPayroll.totalPaid > 0) {
    driverPayroll.paymentStatus = 'partially_paid';
  }

  // Update payroll totals
  payroll.totalPaid = payroll.driverPayrolls.reduce((sum, dp) => sum + dp.totalPaid, 0);
  payroll.totalPending = payroll.totalNetSalary - payroll.totalPaid;

  // Update payroll status
  if (payroll.totalPending === 0) {
    payroll.status = 'paid';
  } else if (payroll.totalPaid > 0) {
    payroll.status = 'partially_paid';
  }

  payroll.updatedAt = new Date();
  return payroll.save();
}

export async function closePayroll(
  tenantId: string,
  payrollId: string
): Promise<IMonthlyPayroll | null> {
  const payroll = await MonthlyPayroll.findOne({
    _id: new mongoose.Types.ObjectId(payrollId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });

  if (!payroll) {
    throw new Error('Payroll not found');
  }

  // Create ledger entries for all transactions in this payroll
  for (const driverPayroll of payroll.driverPayrolls) {
    const transactionTypes = [
      { key: 'baseSalary', type: 'base_salary' },
      { key: 'attendanceBonus', type: 'attendance_bonus' },
      { key: 'tripIncentive', type: 'trip_incentive' },
      { key: 'kmIncentive', type: 'km_incentive' },
      { key: 'nightAllowance', type: 'night_allowance' },
      { key: 'outstationAllowance', type: 'outstation_allowance' },
      { key: 'foodAllowance', type: 'food_allowance' },
      { key: 'overtimeEarnings', type: 'overtime_earning' },
      { key: 'bonusAmount', type: 'bonus' },
      { key: 'absenceDeduction', type: 'absence_deduction' },
      { key: 'advanceRecovery', type: 'advance_recovery' },
      { key: 'penaltyDeduction', type: 'penalty' },
      { key: 'damageRecovery', type: 'damage_recovery' },
      { key: 'challanRecovery', type: 'challan_recovery' },
      { key: 'cashShortage', type: 'cash_shortage' },
      { key: 'fuelExcessRecovery', type: 'fuel_excess' },
      { key: 'otherDeductions', type: 'other_deduction' }
    ];

    for (const { key, type } of transactionTypes) {
      const amount = (driverPayroll as any)[key];
      if (amount && amount > 0) {
        await DriverSalaryLedger.create({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: driverPayroll.driverId,
          driverName: driverPayroll.driverName,
          month: payroll.month,
          year: payroll.year,
          transactionType: type,
          amount,
          referenceType: 'manual',
          createdBy: { userId: 'system', role: 'system' }
        });
      }
    }
  }

  payroll.status = 'closed';
  payroll.closedAt = new Date();
  payroll.updatedAt = new Date();

  return payroll.save();
}

export async function listPayrolls(
  tenantId: string,
  filter?: { status?: string; month?: number; year?: number }
): Promise<IMonthlyPayroll[]> {
  const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  if (filter?.status) {
    query.status = filter.status;
  }

  if (filter?.month !== undefined) {
    query.month = filter.month;
  }

  if (filter?.year) {
    query.year = filter.year;
  }

  return MonthlyPayroll.find(query).sort({ year: -1, month: -1 });
}
