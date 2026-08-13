import mongoose from 'mongoose';
import {
  DriverSalaryMaster,
  DriverSalary,
  DriverSalaryLedger,
  DriverSalaryPayment,
  DriverAdvance,
  DriverRecharge,
  DriverRecovery,
  Driver
} from '../models/index';

/**
 * CONSOLIDATED SALARY SERVICE
 * Unifies salary master configuration, transactions, and payment tracking
 * Properly merges pending, paid, and gross amounts
 *
 * Calculation:
 * - Gross Salary = Base Salary + Incentives + Allowances
 * - Total Deductions = Advances + Recharges + Recoveries + Penalties
 * - Total Paid = Sum of all payment transactions
 * - Pending = Gross - Paid - Deductions (if negative, = 0)
 * - Payment Status = "pending" | "partially_paid" | "paid"
 */

export interface ConsolidatedSalaryData {
  driverId: string;
  driverName: string;
  month: number;
  year: number;

  // Base configuration
  baseSalary: number;

  // Earnings breakdown
  incentives: number;
  allowances: number;
  bonuses: number;
  grossSalary: number; // base + incentives + allowances

  // Deductions breakdown
  advanceDeductions: number;
  rechargeDeductions: number;
  recoveryDeductions: number;
  penaltyDeductions: number;
  totalDeductions: number;

  // Payment tracking
  totalPaid: number;
  totalPending: number; // gross - paid - deductions
  remainingBalance: number; // gross - paid

  // Payment status
  paymentStatus: 'pending' | 'partially_paid' | 'paid';

  // Transactions & details
  transactions: any[];
  ledgerEntries: any[];
  paymentHistory: any[];

  // Metadata
  salaryMaster?: any;
  driverDetails?: any;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
}

export interface DriverSalaryDashboardResponse {
  month: number;
  year: number;
  period: string;
  totalGrossSalary: number;
  totalPaid: number;
  totalPending: number;
  drivers: ConsolidatedSalaryData[];
  summary: {
    driverCount: number;
    paidCount: number;
    partiallyPaidCount: number;
    pendingCount: number;
  };
}

/**
 * Get consolidated salary data for a single driver
 */
export async function getDriverSalaryConsolidated(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<ConsolidatedSalaryData> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  // Fetch salary master configuration (check both active and inactive)
  const salaryMaster = await DriverSalaryMaster.findOne({
    tenantId: tenantObjId,
    driverId: driverObjId,
    status: { $in: ['active', 'inactive'] }
  });

  if (!salaryMaster) {
    throw new Error(`No active salary configuration found for driver: ${driverId}`);
  }

  // Calculate period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  // Fetch driver details
  const driverDetails = await Driver.findById(driverObjId).select('name phone email');

  // Fetch salary record for this period
  const driverSalary = await DriverSalary.findOne({
    tenantId: tenantObjId,
    driverId: driverObjId,
    salaryPeriodStart: { $gte: periodStart },
    salaryPeriodEnd: { $lte: periodEnd }
  });

  // Fetch ledger entries for this period
  const ledgerEntries = await DriverSalaryLedger.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    month,
    year
  }).sort({ createdAt: 1 });

  // Fetch payment records for this period
  const payments = await DriverSalaryPayment.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: periodStart, $lte: periodEnd }
  }).sort({ date: -1 });

  // Fetch advances (that impact this period)
  const advances = await DriverAdvance.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    status: { $in: ['approved', 'paid'] }
  });

  // Fetch recharges for this period (DEDUCT_FROM_DRIVER only)
  const recharges = await DriverRecharge.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: periodStart, $lte: periodEnd },
    treatment: 'DEDUCT_FROM_DRIVER',
    status: 'completed'
  });

  // Fetch recoveries for this period
  const recoveries = await DriverRecovery.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    date: { $gte: periodStart, $lte: periodEnd },
    status: { $in: ['approved', 'recovered'] }
  });

  // Calculate earnings from ledger entries
  let baseSalary = 0;
  let incentives = 0;
  let allowances = 0;
  let bonuses = 0;

  const earningTypes = [
    'base_salary', 'attendance_bonus', 'trip_incentive', 'km_incentive',
    'night_allowance', 'outstation_allowance', 'food_allowance',
    'overtime_earning', 'bonus', 'manual_incentive'
  ];

  const deductionTypes = [
    'absence_deduction', 'advance_recovery', 'loan_recovery',
    'penalty', 'damage_recovery', 'challan_recovery',
    'cash_shortage', 'fuel_excess', 'other_deduction'
  ];

  for (const entry of ledgerEntries) {
    if (entry.transactionType === 'base_salary') {
      baseSalary += entry.amount;
    } else if (entry.transactionType === 'bonus' || entry.transactionType === 'manual_incentive') {
      bonuses += entry.amount;
    } else if (['night_allowance', 'outstation_allowance', 'food_allowance'].includes(entry.transactionType)) {
      allowances += entry.amount;
    } else if (['trip_incentive', 'km_incentive', 'attendance_bonus', 'overtime_earning'].includes(entry.transactionType)) {
      incentives += entry.amount;
    }
  }

  // Use salary master base if no ledger entry yet
  if (baseSalary === 0) {
    baseSalary = salaryMaster.baseSalary;
  }

  // Calculate gross salary
  const grossSalary = baseSalary + incentives + allowances + bonuses;

  // Calculate deductions
  let penaltyDeductions = 0;
  for (const entry of ledgerEntries) {
    if (deductionTypes.includes(entry.transactionType)) {
      penaltyDeductions += entry.amount;
    }
  }

  // Advances deduction (only amounts deducted during this period)
  const advanceDeductions = advances.reduce((sum, advance) => {
    if (advance.status === 'paid') {
      if (advance.deductionMode === 'full_next_salary' && advance.remaining > 0) {
        return sum + advance.remaining;
      } else if (advance.deductionMode === 'emi' && advance.emiAmount) {
        return sum + advance.emiAmount;
      }
    }
    return sum;
  }, 0);

  // Recharge deductions
  const rechargeDeductions = recharges.reduce((sum, r) => sum + r.amount, 0);

  // Recovery deductions
  const recoveryDeductions = recoveries.reduce((sum, r) => sum + r.amount, 0);

  // Total deductions
  const totalDeductions = advanceDeductions + rechargeDeductions + recoveryDeductions + penaltyDeductions;

  // Calculate payments
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  // Calculate pending amount
  // Pending = Gross - Paid - Deductions (but not less than 0)
  const totalPending = Math.max(0, grossSalary - totalPaid - totalDeductions);

  // Remaining balance (amount still to be paid from net payable)
  const remainingBalance = Math.max(0, grossSalary - totalPaid);

  // Determine payment status
  let paymentStatus: 'pending' | 'partially_paid' | 'paid';
  if (totalPaid === 0) {
    paymentStatus = 'pending';
  } else if (totalPaid >= grossSalary) {
    paymentStatus = 'paid';
  } else {
    paymentStatus = 'partially_paid';
  }

  // Get last payment date
  const lastPayment = payments.length > 0 ? payments[0] : null;
  const lastPaymentDate = lastPayment?.date;

  // Calculate next expected payment date (1st of next month)
  const nextPaymentDate = new Date(year, month, 1);

  return {
    driverId: driverId.toString(),
    driverName: driverDetails?.name || salaryMaster.name,
    month,
    year,
    baseSalary,
    incentives,
    allowances,
    bonuses,
    grossSalary,
    advanceDeductions,
    rechargeDeductions,
    recoveryDeductions,
    penaltyDeductions,
    totalDeductions,
    totalPaid,
    totalPending,
    remainingBalance,
    paymentStatus,
    transactions: driverSalary ? [driverSalary] : [],
    ledgerEntries,
    paymentHistory: payments,
    salaryMaster,
    driverDetails,
    lastPaymentDate,
    nextPaymentDate
  };
}

/**
 * Get salary dashboard data for all drivers in a month
 */
export async function getSalaryDashboard(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<DriverSalaryDashboardResponse> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Fetch ALL drivers for the tenant (not just those with salary masters)
  const allDrivers = await Driver.find({
    tenantId: tenantObjId,
    status: { $in: ['active', 'on_leave', 'inactive'] }
  }).select('_id name phone email');

  if (allDrivers.length === 0) {
    return {
      month,
      year,
      period: `${month}/${year}`,
      totalGrossSalary: 0,
      totalPaid: 0,
      totalPending: 0,
      drivers: [],
      summary: {
        driverCount: 0,
        paidCount: 0,
        partiallyPaidCount: 0,
        pendingCount: 0
      }
    };
  }

  // Get consolidated data for each driver
  const drivers: ConsolidatedSalaryData[] = [];
  for (const driver of allDrivers) {
    try {
      const consolidatedData = await getDriverSalaryConsolidated(
        tenantId,
        driver._id,
        month,
        year
      );
      drivers.push(consolidatedData);
    } catch (error) {
      // Skip drivers that don't have salary configuration yet
      console.debug(`Skipping driver ${driver.name} (${driver._id}): no salary configuration`);
    }
  }

  // Calculate summary
  const totalGrossSalary = drivers.reduce((sum, d) => sum + d.grossSalary, 0);
  const totalPaid = drivers.reduce((sum, d) => sum + d.totalPaid, 0);
  const totalPending = drivers.reduce((sum, d) => sum + d.totalPending, 0);

  const paidCount = drivers.filter(d => d.paymentStatus === 'paid').length;
  const partiallyPaidCount = drivers.filter(d => d.paymentStatus === 'partially_paid').length;
  const pendingCount = drivers.filter(d => d.paymentStatus === 'pending').length;

  return {
    month,
    year,
    period: `${month}/${year}`,
    totalGrossSalary,
    totalPaid,
    totalPending,
    drivers: drivers.sort((a, b) => b.totalPending - a.totalPending), // Sort by pending amount
    summary: {
      driverCount: drivers.length,
      paidCount,
      partiallyPaidCount,
      pendingCount
    }
  };
}

/**
 * Get salary summary for a driver (for Driver 360)
 */
export async function getDriverSalarySummary(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId
): Promise<{
  currentMonth: ConsolidatedSalaryData | null;
  previousMonth: ConsolidatedSalaryData | null;
  ytdEarnings: number;
  ytdPaid: number;
  ytdPending: number;
  totalOutstandingAdvances: number;
}> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // Get current month salary
  let currentMonthData: ConsolidatedSalaryData | null = null;
  try {
    currentMonthData = await getDriverSalaryConsolidated(
      tenantId,
      driverId,
      currentMonth,
      currentYear
    );
  } catch (error) {
    console.warn(`No salary data for current month: ${error}`);
  }

  // Get previous month salary
  let previousMonthData: ConsolidatedSalaryData | null = null;
  try {
    previousMonthData = await getDriverSalaryConsolidated(
      tenantId,
      driverId,
      previousMonth,
      previousYear
    );
  } catch (error) {
    console.warn(`No salary data for previous month: ${error}`);
  }

  // Calculate YTD figures
  let ytdEarnings = 0;
  let ytdPaid = 0;
  let ytdPending = 0;

  for (let m = 1; m <= currentMonth; m++) {
    try {
      const monthData = await getDriverSalaryConsolidated(
        tenantId,
        driverId,
        m,
        currentYear
      );
      ytdEarnings += monthData.grossSalary;
      ytdPaid += monthData.totalPaid;
      ytdPending += monthData.totalPending;
    } catch {
      // Skip months with no data
    }
  }

  // Get outstanding advances
  const advances = await DriverAdvance.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    status: { $in: ['approved', 'paid'] },
    remaining: { $gt: 0 }
  });

  const totalOutstandingAdvances = advances.reduce((sum, a) => sum + a.remaining, 0);

  return {
    currentMonth: currentMonthData,
    previousMonth: previousMonthData,
    ytdEarnings,
    ytdPaid,
    ytdPending,
    totalOutstandingAdvances
  };
}

/**
 * Validate salary calculations for accuracy
 */
export async function validateSalaryConsolidation(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<{
  valid: boolean;
  warnings: string[];
  errors: string[];
  details: ConsolidatedSalaryData;
}> {
  const details = await getDriverSalaryConsolidated(tenantId, driverId, month, year);
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate calculations
  if (details.grossSalary <= 0) {
    warnings.push('Gross salary is zero or negative');
  }

  if (details.totalPaid > details.grossSalary) {
    errors.push(`Total paid (${details.totalPaid}) exceeds gross salary (${details.grossSalary})`);
  }

  if (details.totalDeductions > details.grossSalary) {
    warnings.push(`Total deductions (${details.totalDeductions}) exceed gross salary (${details.grossSalary})`);
  }

  if (details.totalPending < 0) {
    errors.push(`Pending amount cannot be negative: ${details.totalPending}`);
  }

  // Validate that pending + paid = gross (approximately)
  const calculatedNetPayable = details.grossSalary - details.totalDeductions;
  if (details.totalPaid + details.totalPending !== calculatedNetPayable) {
    warnings.push(
      `Payment reconciliation mismatch: paid (${details.totalPaid}) + pending (${details.totalPending}) = ${details.totalPaid + details.totalPending}, expected ${calculatedNetPayable}`
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    details
  };
}
