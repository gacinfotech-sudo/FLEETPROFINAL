import mongoose from 'mongoose';
import {
  DriverSalaryMaster,
  DriverAdvance,
  DriverRecharge,
  DriverRecovery,
  DriverSalaryLedger,
  IDriverSalaryMaster,
  IDriverAdvance,
  IDriverRecharge,
  IDriverRecovery,
  IDriverSalaryLedger
} from '../models/index';

/**
 * CORE SALARY CALCULATION SERVICE
 * Implements the standard monthly salary formula:
 *
 * Monthly Salary = Base + Allowances - Deductions - Advances - Penalties
 *
 * Components:
 * - Base: Base salary from salary master
 * - Allowances: Night, Outstation, Food, and other allowances
 * - Deductions: Absence deductions, damage recovery, challan recovery, etc.
 * - Advances: Driver advances to be recovered
 * - Penalties: Penalties and other administrative charges
 *
 * Net Payable = Base + Allowances - Deductions - Advances - Penalties
 */

export interface SalaryComponentBreakdown {
  // Income components
  baseSalary: number;

  allowances: {
    nightAllowance: number;
    outstationAllowance: number;
    foodAllowance: number;
    otherAllowances: number;
    total: number;
  };

  // Deductions
  deductions: {
    absenceDeduction: number;
    damageRecovery: number;
    challanRecovery: number;
    cashShortage: number;
    fuelExcess: number;
    otherDeductions: number;
    total: number;
  };

  // Advances
  advances: {
    advanceAmount: number;
    total: number;
  };

  // Penalties
  penalties: {
    penaltyAmount: number;
    total: number;
  };
}

export interface MonthlySalaryCalculation {
  tenantId: string;
  driverId: string;
  driverName: string;
  month: number;
  year: number;

  // Component breakdown
  components: SalaryComponentBreakdown;

  // Calculation summary
  grossEarnings: number; // Base + Allowances
  totalDeductions: number; // Deductions + Advances + Penalties
  netPayable: number; // Gross - Total Deductions

  // Payment tracking
  amountPaid: number;
  amountPending: number;

  // Metadata
  calculatedAt: Date;
  calculatedBy?: {
    userId: string;
    role: string;
  };

  // Source data references
  ledgerEntryIds?: string[];
  advanceIds?: string[];
  recoveryIds?: string[];
}

/**
 * Interface for monthly salary calculation input
 */
export interface MonthlySalaryCalculationInput {
  tenantId: string | mongoose.Types.ObjectId;
  driverId: string | mongoose.Types.ObjectId;
  month: number;
  year: number;
  salaryMaster?: IDriverSalaryMaster;
  ledgerEntries?: IDriverSalaryLedger[];
  advances?: IDriverAdvance[];
  recoveries?: IDriverRecovery[];
}

/**
 * Calculate the core salary formula: Base + Allowances - Deductions - Advances - Penalties
 */
export async function calculateMonthlySalary(
  input: MonthlySalaryCalculationInput
): Promise<MonthlySalaryCalculation> {
  const tenantId = typeof input.tenantId === 'string'
    ? input.tenantId
    : input.tenantId.toString();

  const driverId = typeof input.driverId === 'string'
    ? input.driverId
    : input.driverId.toString();

  // Fetch or use provided data
  let salaryMaster = input.salaryMaster;
  if (!salaryMaster) {
    salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: 'active'
    });
  }

  if (!salaryMaster) {
    throw new Error(`No active salary master found for driver ${driverId}`);
  }

  // Fetch ledger entries if not provided
  let ledgerEntries = input.ledgerEntries;
  if (!ledgerEntries) {
    ledgerEntries = await DriverSalaryLedger.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      month: input.month,
      year: input.year
    });
  }

  // Fetch advances if not provided
  let advances = input.advances;
  if (!advances) {
    advances = await DriverAdvance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: { $in: ['approved', 'paid'] }
    });
  }

  // Fetch recoveries if not provided
  let recoveries = input.recoveries;
  if (!recoveries) {
    const periodStart = new Date(input.year, input.month - 1, 1);
    const periodEnd = new Date(input.year, input.month, 0);

    recoveries = await DriverRecovery.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      date: { $gte: periodStart, $lte: periodEnd },
      status: { $in: ['approved', 'recovered'] }
    });
  }

  // Calculate components
  const components = calculateSalaryComponents(
    salaryMaster,
    ledgerEntries,
    advances,
    recoveries
  );

  // Calculate totals
  const grossEarnings = components.baseSalary + components.allowances.total;
  const totalDeductions =
    components.deductions.total +
    components.advances.total +
    components.penalties.total;

  const netPayable = Math.max(0, grossEarnings - totalDeductions);

  // Calculate paid and pending
  const amountPaid = ledgerEntries
    .filter(entry => entry.transactionType === 'payment')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const amountPending = Math.max(0, netPayable - amountPaid);

  return {
    tenantId,
    driverId,
    driverName: salaryMaster.name || 'Unknown',
    month: input.month,
    year: input.year,
    components,
    grossEarnings,
    totalDeductions,
    netPayable,
    amountPaid,
    amountPending,
    calculatedAt: new Date(),
    ledgerEntryIds: ledgerEntries.map(e => e._id?.toString() || ''),
    advanceIds: advances.map(a => a._id?.toString() || ''),
    recoveryIds: recoveries.map(r => r._id?.toString() || '')
  };
}

/**
 * Calculate individual salary components
 */
function calculateSalaryComponents(
  salaryMaster: IDriverSalaryMaster,
  ledgerEntries: IDriverSalaryLedger[],
  advances: IDriverAdvance[],
  recoveries: IDriverRecovery[]
): SalaryComponentBreakdown {

  // ===== INCOME COMPONENTS =====

  // Base Salary
  const baseSalary = salaryMaster.baseSalary || 0;

  // Allowances
  const allowances = {
    nightAllowance: sumLedgerByType(ledgerEntries, 'night_allowance'),
    outstationAllowance: sumLedgerByType(ledgerEntries, 'outstation_allowance'),
    foodAllowance: sumLedgerByType(ledgerEntries, 'food_allowance'),
    otherAllowances: 0, // Can be populated from ledger if needed
    total: 0
  };

  allowances.total =
    allowances.nightAllowance +
    allowances.outstationAllowance +
    allowances.foodAllowance +
    allowances.otherAllowances;

  // ===== DEDUCTIONS =====

  const deductions = {
    absenceDeduction: sumLedgerByType(ledgerEntries, 'absence_deduction'),
    damageRecovery: sumRecoveriesByType(recoveries, 'damage'),
    challanRecovery: sumRecoveriesByType(recoveries, 'challan'),
    cashShortage: sumLedgerByType(ledgerEntries, 'cash_shortage'),
    fuelExcess: sumLedgerByType(ledgerEntries, 'fuel_excess'),
    otherDeductions: sumLedgerByType(ledgerEntries, 'other_deduction'),
    total: 0
  };

  deductions.total =
    deductions.absenceDeduction +
    deductions.damageRecovery +
    deductions.challanRecovery +
    deductions.cashShortage +
    deductions.fuelExcess +
    deductions.otherDeductions;

  // ===== ADVANCES =====

  const advances_obj = {
    advanceAmount: calculateAdvanceDeduction(advances),
    total: 0
  };

  advances_obj.total = advances_obj.advanceAmount;

  // ===== PENALTIES =====

  const penalties = {
    penaltyAmount: sumLedgerByType(ledgerEntries, 'penalty'),
    total: 0
  };

  penalties.total = penalties.penaltyAmount;

  return {
    baseSalary,
    allowances,
    deductions,
    advances: advances_obj,
    penalties
  };
}

/**
 * Sum ledger entries by transaction type
 */
function sumLedgerByType(
  ledgerEntries: IDriverSalaryLedger[],
  transactionType: string
): number {
  return ledgerEntries
    .filter(entry => entry.transactionType === transactionType)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Sum recoveries by type
 */
function sumRecoveriesByType(
  recoveries: IDriverRecovery[],
  recoveryType: string
): number {
  return recoveries
    .filter(r => r.recoveryType === recoveryType)
    .reduce((sum, r) => sum + r.amount, 0);
}

/**
 * Calculate advance deduction amount based on deduction mode
 */
function calculateAdvanceDeduction(advances: IDriverAdvance[]): number {
  let totalAdvanceDeduction = 0;

  for (const advance of advances) {
    if (advance.status !== 'paid') continue;

    if (advance.deductionMode === 'full_next_salary') {
      // Deduct full remaining amount
      totalAdvanceDeduction += advance.remaining || advance.approvedAmount || 0;
    } else if (advance.deductionMode === 'emi') {
      // Deduct EMI amount for this month
      totalAdvanceDeduction += advance.emiAmount || 0;
    } else if (advance.deductionMode === 'manual') {
      // No automatic deduction for manual mode
      continue;
    }
  }

  return totalAdvanceDeduction;
}

/**
 * Generate human-readable salary calculation breakdown
 */
export function formatSalaryCalculation(calculation: MonthlySalaryCalculation): string {
  const { components } = calculation;

  return `
Monthly Salary Calculation - ${calculation.driverName}
Period: ${calculation.month}/${calculation.year}

===== INCOME =====
Base Salary:              ₹${components.baseSalary.toFixed(2)}

Allowances:
  - Night Allowance:      ₹${components.allowances.nightAllowance.toFixed(2)}
  - Outstation Allow:     ₹${components.allowances.outstationAllowance.toFixed(2)}
  - Food Allowance:       ₹${components.allowances.foodAllowance.toFixed(2)}
  - Other Allow:          ₹${components.allowances.otherAllowances.toFixed(2)}

Total Allowances:         ₹${components.allowances.total.toFixed(2)}

GROSS EARNINGS:           ₹${calculation.grossEarnings.toFixed(2)}

===== DEDUCTIONS =====
  - Absence Deduction:    ₹${components.deductions.absenceDeduction.toFixed(2)}
  - Damage Recovery:      ₹${components.deductions.damageRecovery.toFixed(2)}
  - Challan Recovery:     ₹${components.deductions.challanRecovery.toFixed(2)}
  - Cash Shortage:        ₹${components.deductions.cashShortage.toFixed(2)}
  - Fuel Excess:          ₹${components.deductions.fuelExcess.toFixed(2)}
  - Other Deductions:     ₹${components.deductions.otherDeductions.toFixed(2)}

Total Deductions:         ₹${components.deductions.total.toFixed(2)}

Advances Deduction:       ₹${components.advances.total.toFixed(2)}

Penalties:                ₹${components.penalties.total.toFixed(2)}

TOTAL DEDUCTIONS:         ₹${calculation.totalDeductions.toFixed(2)}

===== NET PAYABLE =====
Net Salary:               ₹${calculation.netPayable.toFixed(2)}
Amount Paid:              ₹${calculation.amountPaid.toFixed(2)}
Amount Pending:           ₹${calculation.amountPending.toFixed(2)}
  `;
}

/**
 * Validate salary calculation
 */
export function validateSalaryCalculation(
  calculation: MonthlySalaryCalculation
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (calculation.netPayable < 0) {
    errors.push('Net payable cannot be negative');
  }

  if (calculation.amountPending < 0) {
    errors.push('Pending amount cannot be negative');
  }

  if (calculation.grossEarnings === 0) {
    errors.push('Gross earnings should not be zero');
  }

  if (calculation.totalDeductions > calculation.grossEarnings * 1.5) {
    errors.push('Total deductions exceed 150% of gross earnings (possible data error)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate salary for multiple drivers in a period
 */
export async function calculateTeamSalaries(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number,
  driverIds?: string[]
): Promise<MonthlySalaryCalculation[]> {

  const tenantObjId = typeof tenantId === 'string'
    ? new mongoose.Types.ObjectId(tenantId)
    : tenantId;

  // Get all active salary masters for this tenant
  const query: any = {
    tenantId: tenantObjId,
    status: 'active'
  };

  if (driverIds && driverIds.length > 0) {
    query.driverId = {
      $in: driverIds.map(id => new mongoose.Types.ObjectId(id))
    };
  }

  const salaryMasters = await DriverSalaryMaster.find(query);

  const calculations = await Promise.all(
    salaryMasters.map(master =>
      calculateMonthlySalary({
        tenantId: tenantObjId,
        driverId: master.driverId,
        month,
        year,
        salaryMaster: master
      })
    )
  );

  return calculations;
}

/**
 * Calculate salary statistics for a period
 */
export interface TeamsalaryStatistics {
  period: string;
  driverCount: number;
  totalGrossEarnings: number;
  totalDeductions: number;
  totalNetPayable: number;
  totalAmountPaid: number;
  totalAmountPending: number;
  averageSalary: number;
  lowestSalary: number;
  highestSalary: number;
}

export async function calculateTeamSalaryStatistics(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<TeamsalaryStatistics> {

  const calculations = await calculateTeamSalaries(tenantId, month, year);

  if (calculations.length === 0) {
    return {
      period: `${month}/${year}`,
      driverCount: 0,
      totalGrossEarnings: 0,
      totalDeductions: 0,
      totalNetPayable: 0,
      totalAmountPaid: 0,
      totalAmountPending: 0,
      averageSalary: 0,
      lowestSalary: 0,
      highestSalary: 0
    };
  }

  const totalGrossEarnings = calculations.reduce((sum, c) => sum + c.grossEarnings, 0);
  const totalDeductions = calculations.reduce((sum, c) => sum + c.totalDeductions, 0);
  const totalNetPayable = calculations.reduce((sum, c) => sum + c.netPayable, 0);
  const totalAmountPaid = calculations.reduce((sum, c) => sum + c.amountPaid, 0);
  const totalAmountPending = calculations.reduce((sum, c) => sum + c.amountPending, 0);

  const averageSalary = totalNetPayable / calculations.length;
  const salaries = calculations.map(c => c.netPayable).sort((a, b) => a - b);
  const lowestSalary = salaries[0];
  const highestSalary = salaries[calculations.length - 1];

  return {
    period: `${month}/${year}`,
    driverCount: calculations.length,
    totalGrossEarnings,
    totalDeductions,
    totalNetPayable,
    totalAmountPaid,
    totalAmountPending,
    averageSalary,
    lowestSalary,
    highestSalary
  };
}
