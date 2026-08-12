/**
 * PHASE 3: SALARY CALCULATION ENGINE
 * Precise decimal-based salary calculations
 * Uses standard arithmetic for rounding (JavaScript's native Number precision)
 * All monetary values stored as integers (paise/cents) for accuracy
 */

import {
  IDriverSalaryMaster,
  IDriverAdvance,
  IDriverRecharge,
  IDriverRecovery
} from '../models/index';

/**
 * Convert Rupees to paise (cents) for precise calculations
 * Example: 18000 -> 1800000 paise
 */
function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise (cents) back to Rupees
 * Example: 1800000 -> 18000 rupees
 */
function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Round to nearest paisa (2 decimal places)
 */
function roundToPaise(rupees: number): number {
  return Math.round(rupees * 100) / 100;
}

export interface SalaryCalculationInput {
  salaryMaster: IDriverSalaryMaster;
  salaryPeriodStart: Date;
  salaryPeriodEnd: Date;
  payableDays: number; // Days for which salary is payable
  payrollDays: number; // Total days in period (e.g., 31 for Jan)
  // Attendance data
  presentDays?: number;
  paidLeaveDays?: number;
  unpaidLeaveDays?: number;
  weeklyOffDays?: number;
  halfDays?: number;
  absentDays?: number;
  // Incentives
  bookingServiceDays?: number;
  totalKilometers?: number;
  nightDutyTrips?: number;
  outstationTrips?: number;
  // Recharges & Recoveries
  recharges?: IDriverRecharge[];
  recoveries?: IDriverRecovery[];
  advances?: IDriverAdvance[];
  // Manual adjustments
  manualAllowances?: number;
  manualDeductions?: number;
}

export interface SalaryCalculationResult {
  // Period info
  salaryPeriodStart: Date;
  salaryPeriodEnd: Date;
  driverId: string;
  driverName: string;
  salaryType: string;

  // Daily rate calculation
  baseMonthly: number;
  payrollDays: number;
  dailyRate: number; // baseMonthly / payrollDays
  payableDays: number;

  // Earnings breakdown
  earnings: {
    baseSalary: number; // dailyRate * payableDays
    allowances: number; // Fixed allowances from master
    incentives: number; // Trip, KM, night, outstation
    bonuses: number; // Other bonuses
    manualAllowances: number;
    total: number;
  };
  grossEarned: number; // Total earnings

  // Deductions breakdown
  deductions: {
    advanceDeduction: number; // From DriverAdvance
    rechargeDeduction: number; // From DriverRecharge (DEDUCT_FROM_DRIVER only)
    recoveryDeduction: number; // From DriverRecovery
    manualDeductions: number;
    total: number;
  };
  totalDeductions: number;

  // Net payable
  netPayable: number; // Gross - Total Deductions (never negative)

  // Calculation audit trail
  calculationNotes: {
    presentDays?: number;
    paidLeaveDays?: number;
    unpaidLeaveDays?: number;
    weeklyOffDays?: number;
    absentDays?: number;
    bookingServiceDays?: number;
    totalKilometers?: number;
    nightDutyTrips?: number;
    outstationTrips?: number;
    rechargesDeducted?: Array<{ id: string; amount: number; treatment: string }>;
    recoveriesDeducted?: Array<{ id: string; amount: number; type: string }>;
    advancesDeducted?: Array<{ id: string; amount: number; mode: string }>;
  };
}

/**
 * CORE: Calculate gross earned salary
 * Formula: Daily Rate = Base Monthly / Payroll Days
 *          Gross Earned = Daily Rate * Payable Days
 */
export function calculateGrossEarned(
  baseMonthly: number,
  payrollDays: number,
  payableDays: number
): { dailyRate: number; grossEarned: number } {
  // Convert to paise for precise calculation
  const baseInPaise = rupeesToPaise(baseMonthly);
  const dailyRateInPaise = Math.round(baseInPaise / payrollDays);
  const grossInPaise = dailyRateInPaise * payableDays;

  return {
    dailyRate: paiseToRupees(dailyRateInPaise),
    grossEarned: paiseToRupees(grossInPaise)
  };
}

/**
 * CORE: Calculate net payable salary
 * Formula: Net = Gross Earned + Allowances - All Deductions
 * Net is always >= 0 (cannot be negative)
 */
export function calculateNetPayable(
  grossEarned: number,
  allowances: number = 0,
  incentives: number = 0,
  bonuses: number = 0,
  manualAllowances: number = 0,
  advanceDeduction: number = 0,
  rechargeDeduction: number = 0,
  recoveryDeduction: number = 0,
  manualDeductions: number = 0
): number {
  // Total earnings
  const totalEarnings = grossEarned + allowances + incentives + bonuses + manualAllowances;

  // Total deductions
  const totalDeductionsAmount =
    advanceDeduction + rechargeDeduction + recoveryDeduction + manualDeductions;

  // Net = Earnings - Deductions (minimum 0)
  const netInPaise = rupeesToPaise(totalEarnings) - rupeesToPaise(totalDeductionsAmount);
  return Math.max(0, paiseToRupees(netInPaise));
}

/**
 * Calculate salary with full breakdown
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const {
    salaryMaster,
    salaryPeriodStart,
    salaryPeriodEnd,
    payableDays,
    payrollDays,
    presentDays = 0,
    paidLeaveDays = 0,
    unpaidLeaveDays = 0,
    weeklyOffDays = 0,
    halfDays = 0,
    absentDays = 0,
    bookingServiceDays = 0,
    totalKilometers = 0,
    nightDutyTrips = 0,
    outstationTrips = 0,
    recharges = [],
    recoveries = [],
    advances = [],
    manualAllowances = 0,
    manualDeductions = 0
  } = input;

  // Calculate daily rate and gross earned
  const { dailyRate, grossEarned } = calculateGrossEarned(
    salaryMaster.baseSalary,
    payrollDays,
    payableDays
  );

  // Calculate allowances
  const fixedAllowances = roundToPaise(
    (salaryMaster.foodAllowance || 0)
  );

  // Calculate incentives
  let incentivesAmount = 0;
  if (salaryMaster.perTripSalary && bookingServiceDays) {
    incentivesAmount += salaryMaster.perTripSalary * bookingServiceDays;
  }
  if (salaryMaster.kmIncentivePerKm && totalKilometers) {
    incentivesAmount += salaryMaster.kmIncentivePerKm * totalKilometers;
  }
  if (salaryMaster.nightAllowancePerNight && nightDutyTrips) {
    incentivesAmount += salaryMaster.nightAllowancePerNight * nightDutyTrips;
  }
  if (salaryMaster.outstationAllowancePerDay && outstationTrips) {
    incentivesAmount += salaryMaster.outstationAllowancePerDay * outstationTrips;
  }

  // Calculate deductions
  let advanceDeduction = 0;
  const advancesDeducted: Array<{ id: string; amount: number; mode: string }> = [];

  for (const advance of advances) {
    if (advance.status === 'paid') {
      if (advance.deductionMode === 'full_next_salary') {
        const deductAmount = advance.remaining || 0;
        advanceDeduction += deductAmount;
        advancesDeducted.push({
          id: advance._id?.toString() || '',
          amount: deductAmount,
          mode: advance.deductionMode
        });
      } else if (advance.deductionMode === 'emi' && advance.emiAmount) {
        advanceDeduction += advance.emiAmount;
        advancesDeducted.push({
          id: advance._id?.toString() || '',
          amount: advance.emiAmount,
          mode: advance.deductionMode
        });
      }
    }
  }

  // Calculate recharge deduction (only DEDUCT_FROM_DRIVER)
  let rechargeDeduction = 0;
  const rechargesDeducted: Array<{ id: string; amount: number; treatment: string }> = [];

  for (const recharge of recharges) {
    if (recharge.treatment === 'DEDUCT_FROM_DRIVER' && recharge.status === 'completed') {
      rechargeDeduction += recharge.amount;
      rechargesDeducted.push({
        id: recharge._id?.toString() || '',
        amount: recharge.amount,
        treatment: recharge.treatment
      });
    }
  }

  // Calculate recovery deduction
  let recoveryDeduction = 0;
  const recoveriesDeducted: Array<{ id: string; amount: number; type: string }> = [];

  for (const recovery of recoveries) {
    if (recovery.status === 'approved' || recovery.status === 'recovered') {
      recoveryDeduction += recovery.amount;
      recoveriesDeducted.push({
        id: recovery._id?.toString() || '',
        amount: recovery.amount,
        type: recovery.type
      });
    }
  }

  // Calculate net payable
  const netPayable = calculateNetPayable(
    grossEarned,
    fixedAllowances,
    incentivesAmount,
    0, // bonuses
    manualAllowances,
    advanceDeduction,
    rechargeDeduction,
    recoveryDeduction,
    manualDeductions
  );

  // Compile result
  const result: SalaryCalculationResult = {
    salaryPeriodStart,
    salaryPeriodEnd,
    driverId: salaryMaster.driverId.toString(),
    driverName: salaryMaster.name,
    salaryType: salaryMaster.salaryType,

    baseMonthly: salaryMaster.baseSalary,
    payrollDays,
    dailyRate: roundToPaise(dailyRate),
    payableDays,

    earnings: {
      baseSalary: roundToPaise(grossEarned),
      allowances: roundToPaise(fixedAllowances),
      incentives: roundToPaise(incentivesAmount),
      bonuses: 0,
      manualAllowances: roundToPaise(manualAllowances),
      total: roundToPaise(grossEarned + fixedAllowances + incentivesAmount + manualAllowances)
    },
    grossEarned: roundToPaise(grossEarned + fixedAllowances + incentivesAmount + manualAllowances),

    deductions: {
      advanceDeduction: roundToPaise(advanceDeduction),
      rechargeDeduction: roundToPaise(rechargeDeduction),
      recoveryDeduction: roundToPaise(recoveryDeduction),
      manualDeductions: roundToPaise(manualDeductions),
      total: roundToPaise(advanceDeduction + rechargeDeduction + recoveryDeduction + manualDeductions)
    },
    totalDeductions: roundToPaise(advanceDeduction + rechargeDeduction + recoveryDeduction + manualDeductions),

    netPayable: roundToPaise(netPayable),

    calculationNotes: {
      presentDays,
      paidLeaveDays,
      unpaidLeaveDays,
      weeklyOffDays,
      absentDays,
      bookingServiceDays,
      totalKilometers,
      nightDutyTrips,
      outstationTrips,
      rechargesDeducted,
      recoveriesDeducted,
      advancesDeducted
    }
  };

  return result;
}

/**
 * Format salary calculation result for display/printing
 */
export function formatSalaryCalculation(result: SalaryCalculationResult): string {
  const lines = [
    `SALARY BREAKDOWN - ${result.driverName}`,
    `Period: ${result.salaryPeriodStart.toLocaleDateString()} to ${result.salaryPeriodEnd.toLocaleDateString()}`,
    `Salary Type: ${result.salaryType}`,
    '',
    '=== EARNINGS ===',
    `Base Salary (${result.payableDays} days @ ₹${result.dailyRate}/day): ₹${result.earnings.baseSalary}`,
    ...(result.earnings.allowances > 0 ? [`Allowances: ₹${result.earnings.allowances}`] : []),
    ...(result.earnings.incentives > 0 ? [`Incentives: ₹${result.earnings.incentives}`] : []),
    ...(result.earnings.manualAllowances > 0 ? [`Manual Allowances: ₹${result.earnings.manualAllowances}`] : []),
    `---`,
    `Gross Earned: ₹${result.grossEarned}`,
    '',
    '=== DEDUCTIONS ===',
    ...(result.deductions.advanceDeduction > 0 ? [`Advance Deduction: ₹${result.deductions.advanceDeduction}`] : []),
    ...(result.deductions.rechargeDeduction > 0 ? [`Recharge Deduction: ₹${result.deductions.rechargeDeduction}`] : []),
    ...(result.deductions.recoveryDeduction > 0 ? [`Recovery Deduction: ₹${result.deductions.recoveryDeduction}`] : []),
    ...(result.deductions.manualDeductions > 0 ? [`Manual Deductions: ₹${result.deductions.manualDeductions}`] : []),
    `---`,
    `Total Deductions: ₹${result.totalDeductions}`,
    '',
    `NET PAYABLE: ₹${result.netPayable}`,
    '',
    '=== ATTENDANCE NOTES ===',
    `Present Days: ${result.calculationNotes.presentDays}`,
    `Paid Leaves: ${result.calculationNotes.paidLeaveDays}`,
    `Unpaid Leaves: ${result.calculationNotes.unpaidLeaveDays}`,
    `Weekly Offs: ${result.calculationNotes.weeklyOffDays}`,
    `Absent Days: ${result.calculationNotes.absentDays}`,
    ...(result.calculationNotes.bookingServiceDays && result.calculationNotes.bookingServiceDays > 0
      ? [`Booking Service Days: ${result.calculationNotes.bookingServiceDays}`]
      : [])
  ];

  return lines.join('\n');
}

/**
 * Validate salary calculation input
 */
export function validateSalaryCalculationInput(input: SalaryCalculationInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.salaryMaster) {
    errors.push('Salary master configuration is required');
  }

  if (input.payableDays < 0 || input.payableDays > input.payrollDays) {
    errors.push(`Payable days (${input.payableDays}) must be between 0 and ${input.payrollDays}`);
  }

  if (input.payrollDays <= 0 || input.payrollDays > 31) {
    errors.push(`Payroll days (${input.payrollDays}) must be between 1 and 31`);
  }

  if (input.salaryMaster && input.salaryMaster.baseSalary < 0) {
    errors.push('Base salary cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Compare two salary calculations (e.g., for audit trail)
 */
export interface SalaryCalculationDifference {
  field: string;
  oldValue: number;
  newValue: number;
  difference: number;
  percentChange: number;
}

export function compareSalaryCalculations(
  oldResult: SalaryCalculationResult,
  newResult: SalaryCalculationResult
): SalaryCalculationDifference[] {
  const differences: SalaryCalculationDifference[] = [];

  const fields = [
    { key: 'baseMonthly', label: 'baseMonthly' },
    { key: 'dailyRate', label: 'dailyRate' },
    { key: 'grossEarned', label: 'grossEarned' },
    { key: 'totalDeductions', label: 'totalDeductions' },
    { key: 'netPayable', label: 'netPayable' }
  ];

  for (const field of fields) {
    const oldVal = (oldResult as any)[field.key];
    const newVal = (newResult as any)[field.key];

    if (oldVal !== newVal) {
      const diff = newVal - oldVal;
      const percentChange = oldVal !== 0 ? (diff / oldVal) * 100 : 0;

      differences.push({
        field: field.label,
        oldValue: oldVal,
        newValue: newVal,
        difference: diff,
        percentChange
      });
    }
  }

  return differences;
}
