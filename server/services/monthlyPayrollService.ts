import mongoose from 'mongoose';
import {
  MonthlyPayroll,
  IMonthlyPayroll,
  DriverSalaryMaster,
  Driver,
  DriverAdvance,
  DriverSalaryLedger
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

export async function calculatePayroll(
  request: PayrollCalculationRequest,
  calculatedBy: { userId: string; role: string }
): Promise<IMonthlyPayroll> {
  // Check if payroll already exists for this month
  const existing = await MonthlyPayroll.findOne({
    tenantId: new mongoose.Types.ObjectId(request.tenantId),
    month: request.month,
    year: request.year
  });

  if (existing && existing.status === 'closed') {
    throw new Error('Cannot recalculate a closed payroll');
  }

  // Get list of drivers to process
  let drivers;
  if (request.drivers && request.drivers.length > 0) {
    drivers = await Driver.find({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      _id: { $in: request.drivers.map(id => new mongoose.Types.ObjectId(id)) }
    });
  } else {
    drivers = await Driver.find({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      status: { $ne: 'inactive' }
    });
  }

  // Calculate salary for each driver
  const driverPayrolls = [];

  for (const driver of drivers) {
    const salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      driverId: driver._id,
      status: 'active'
    });

    if (!salaryMaster) {
      continue; // Skip drivers without salary configuration
    }

    // Get advances
    const advances = await DriverAdvance.find({
      tenantId: new mongoose.Types.ObjectId(request.tenantId),
      driverId: driver._id,
      status: { $in: ['paid', 'approved'] }
    });

    // Prepare calculation input
    const calcInput: SalaryCalculationInput = {
      salaryMaster,
      month: request.month,
      year: request.year,
      attendance: request.overrideAttendance?.[driver._id.toString()],
      tripIncentives: request.overrideTripIncentives?.[driver._id.toString()],
      deductions: request.overrideDeductions?.[driver._id.toString()],
      advances
    };

    const breakup = calculateSalary(calcInput);

    // Create payroll entry for this driver
    driverPayrolls.push({
      driverId: driver._id,
      driverName: driver.name,
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
  }

  // Calculate payroll totals
  const totalGrossSalary = driverPayrolls.reduce((sum, dp) => sum + dp.grossSalary, 0);
  const totalDeductions = driverPayrolls.reduce((sum, dp) => sum + dp.totalDeductions, 0);
  const totalNetSalary = driverPayrolls.reduce((sum, dp) => sum + dp.netSalary, 0);

  // Create or update payroll
  if (existing) {
    existing.driverPayrolls = driverPayrolls;
    existing.driverCount = driverPayrolls.length;
    existing.totalGrossSalary = totalGrossSalary;
    existing.totalDeductions = totalDeductions;
    existing.totalNetSalary = totalNetSalary;
    existing.totalPaid = 0;
    existing.totalPending = totalNetSalary;
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
