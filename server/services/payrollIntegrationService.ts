/**
 * PAYROLL INTEGRATION SERVICE
 * Links salary calculations to ledger entries
 * - Ensures every salary calculation creates corresponding ledger entries
 * - Maintains accounting integrity
 * - Provides batch processing for monthly payroll
 * - Supports rollback and reconciliation
 */

import mongoose from 'mongoose';
import {
  DriverSalary,
  DriverSalaryLedger,
  DriverSalaryMaster,
  DriverAdvance,
  DriverRecharge,
  DriverRecovery,
  Driver,
  IDriverSalary
} from '../models/index';
import {
  createLedgerEntry,
  createBatchLedgerEntries,
  getLedgerEntries,
  getClosingBalance,
  verifyLedgerBalance
} from './ledgerEntryAutomation';

/**
 * Integration result tracking
 */
export interface PayrollIntegrationResult {
  salaryId: string;
  driverId: string;
  driverName: string;
  month: number;
  year: number;
  status: 'success' | 'partial' | 'failed';
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  ledgerEntriesCreated: number;
  ledgerEntries: string[]; // IDs of created ledger entries
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

/**
 * Salary component breakdown for ledger creation
 */
export interface SalaryComponentBreakdown {
  baseSalary: number;
  tripIncentive: number;
  kmIncentive: number;
  nightAllowance: number;
  outstationAllowance: number;
  foodAllowance: number;
  overtimeEarning: number;
  bonus: number;
  manualCredits: number;
  totalEarnings: number;

  absenceDeduction: number;
  advanceRecovery: number;
  loanRecovery: number;
  penalty: number;
  damageRecovery: number;
  challanRecovery: number;
  cashShortage: number;
  fuelExcess: number;
  otherDeductions: number;
  totalDeductions: number;

  grossSalary: number;
  netSalary: number;
}

/**
 * Ledger entry definition for batch creation
 */
interface LedgerEntryDefinition {
  transactionType: string;
  description: string;
  amount: number;
  entryType: 'salary_earned' | 'advance_taken' | 'advance_recovered' | 'recharge_deducted' |
             'recovery_deducted' | 'salary_paid' | 'adjustment' | 'interest_charged' |
             'manual_credit' | 'manual_debit';
  referenceType?: string;
  referenceId?: string;
  basis?: { type: string; value: number };
}

/**
 * Extract salary component breakdown from DriverSalary document
 */
export function extractSalaryComponentBreakdown(salary: IDriverSalary): SalaryComponentBreakdown {
  const breakdown: SalaryComponentBreakdown = {
    baseSalary: salary.baseSalary || 0,
    tripIncentive: salary.tripIncentive || 0,
    kmIncentive: salary.kmIncentive || 0,
    nightAllowance: salary.nightAllowance || 0,
    outstationAllowance: salary.outstationAllowance || 0,
    foodAllowance: salary.foodAllowance || 0,
    overtimeEarning: salary.overtimeEarning || 0,
    bonus: salary.bonus || 0,
    manualCredits: salary.manualCredits || 0,
    totalEarnings: 0,

    absenceDeduction: salary.absenceDeduction || 0,
    advanceRecovery: salary.advanceRecovery || 0,
    loanRecovery: salary.loanRecovery || 0,
    penalty: salary.penalty || 0,
    damageRecovery: salary.damageRecovery || 0,
    challanRecovery: salary.challanRecovery || 0,
    cashShortage: salary.cashShortage || 0,
    fuelExcess: salary.fuelExcess || 0,
    otherDeductions: salary.otherDeductions || 0,
    totalDeductions: 0,

    grossSalary: 0,
    netSalary: 0
  };

  // Calculate totals
  breakdown.totalEarnings =
    breakdown.baseSalary +
    breakdown.tripIncentive +
    breakdown.kmIncentive +
    breakdown.nightAllowance +
    breakdown.outstationAllowance +
    breakdown.foodAllowance +
    breakdown.overtimeEarning +
    breakdown.bonus +
    breakdown.manualCredits;

  breakdown.totalDeductions =
    breakdown.absenceDeduction +
    breakdown.advanceRecovery +
    breakdown.loanRecovery +
    breakdown.penalty +
    breakdown.damageRecovery +
    breakdown.challanRecovery +
    breakdown.cashShortage +
    breakdown.fuelExcess +
    breakdown.otherDeductions;

  breakdown.grossSalary = breakdown.totalEarnings;
  breakdown.netSalary = breakdown.grossSalary - breakdown.totalDeductions;

  return breakdown;
}

/**
 * Generate ledger entry definitions from salary components
 */
export function generateLedgerEntryDefinitions(
  breakdown: SalaryComponentBreakdown,
  salaryId: string | mongoose.Types.ObjectId
): LedgerEntryDefinition[] {
  const entries: LedgerEntryDefinition[] = [];
  const salaryIdStr = typeof salaryId === 'string' ? salaryId : salaryId.toString();

  // Earnings entries
  if (breakdown.baseSalary > 0) {
    entries.push({
      transactionType: 'base_salary',
      description: 'Base salary',
      amount: breakdown.baseSalary,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'monthly', value: breakdown.baseSalary }
    });
  }

  if (breakdown.tripIncentive > 0) {
    entries.push({
      transactionType: 'trip_incentive',
      description: 'Trip incentive',
      amount: breakdown.tripIncentive,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'trips', value: breakdown.tripIncentive }
    });
  }

  if (breakdown.kmIncentive > 0) {
    entries.push({
      transactionType: 'km_incentive',
      description: 'Kilometer incentive',
      amount: breakdown.kmIncentive,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'kilometers', value: breakdown.kmIncentive }
    });
  }

  if (breakdown.nightAllowance > 0) {
    entries.push({
      transactionType: 'night_allowance',
      description: 'Night duty allowance',
      amount: breakdown.nightAllowance,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'night_trips', value: breakdown.nightAllowance }
    });
  }

  if (breakdown.outstationAllowance > 0) {
    entries.push({
      transactionType: 'outstation_allowance',
      description: 'Outstation allowance',
      amount: breakdown.outstationAllowance,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'outstation_days', value: breakdown.outstationAllowance }
    });
  }

  if (breakdown.foodAllowance > 0) {
    entries.push({
      transactionType: 'food_allowance',
      description: 'Food allowance',
      amount: breakdown.foodAllowance,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'food_allowance', value: breakdown.foodAllowance }
    });
  }

  if (breakdown.overtimeEarning > 0) {
    entries.push({
      transactionType: 'overtime_earning',
      description: 'Overtime earnings',
      amount: breakdown.overtimeEarning,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'overtime_hours', value: breakdown.overtimeEarning }
    });
  }

  if (breakdown.bonus > 0) {
    entries.push({
      transactionType: 'bonus',
      description: 'Bonus',
      amount: breakdown.bonus,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'bonus', value: breakdown.bonus }
    });
  }

  if (breakdown.manualCredits > 0) {
    entries.push({
      transactionType: 'manual_incentive',
      description: 'Manual credits',
      amount: breakdown.manualCredits,
      entryType: 'salary_earned',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'manual', value: breakdown.manualCredits }
    });
  }

  // Deductions entries
  if (breakdown.absenceDeduction > 0) {
    entries.push({
      transactionType: 'absence_deduction',
      description: 'Absence deduction',
      amount: breakdown.absenceDeduction,
      entryType: 'manual_debit',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'absent_days', value: breakdown.absenceDeduction }
    });
  }

  if (breakdown.advanceRecovery > 0) {
    entries.push({
      transactionType: 'advance_recovery',
      description: 'Advance recovery from salary',
      amount: breakdown.advanceRecovery,
      entryType: 'advance_recovered',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'advance', value: breakdown.advanceRecovery }
    });
  }

  if (breakdown.loanRecovery > 0) {
    entries.push({
      transactionType: 'loan_recovery',
      description: 'Loan recovery from salary',
      amount: breakdown.loanRecovery,
      entryType: 'manual_debit',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'loan', value: breakdown.loanRecovery }
    });
  }

  if (breakdown.penalty > 0) {
    entries.push({
      transactionType: 'penalty',
      description: 'Penalty deduction',
      amount: breakdown.penalty,
      entryType: 'manual_debit',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'penalty', value: breakdown.penalty }
    });
  }

  if (breakdown.damageRecovery > 0) {
    entries.push({
      transactionType: 'damage_recovery',
      description: 'Damage recovery',
      amount: breakdown.damageRecovery,
      entryType: 'recovery_deducted',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'damage', value: breakdown.damageRecovery }
    });
  }

  if (breakdown.challanRecovery > 0) {
    entries.push({
      transactionType: 'challan_recovery',
      description: 'Challan/Traffic fine recovery',
      amount: breakdown.challanRecovery,
      entryType: 'recovery_deducted',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'challan', value: breakdown.challanRecovery }
    });
  }

  if (breakdown.cashShortage > 0) {
    entries.push({
      transactionType: 'cash_shortage',
      description: 'Cash shortage recovery',
      amount: breakdown.cashShortage,
      entryType: 'recovery_deducted',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'cash_shortage', value: breakdown.cashShortage }
    });
  }

  if (breakdown.fuelExcess > 0) {
    entries.push({
      transactionType: 'fuel_excess',
      description: 'Fuel excess deduction',
      amount: breakdown.fuelExcess,
      entryType: 'recovery_deducted',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'fuel_excess', value: breakdown.fuelExcess }
    });
  }

  if (breakdown.otherDeductions > 0) {
    entries.push({
      transactionType: 'other_deduction',
      description: 'Other deductions',
      amount: breakdown.otherDeductions,
      entryType: 'manual_debit',
      referenceType: 'salary_id',
      referenceId: salaryIdStr,
      basis: { type: 'other', value: breakdown.otherDeductions }
    });
  }

  return entries;
}

/**
 * Convert ledger entry definitions to ledger entry input objects
 */
function definitionsToLedgerInputs(
  definitions: LedgerEntryDefinition[],
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
) {
  return definitions.map(def => ({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: def.entryType as any,
    description: def.description,
    amount: def.amount,
    referenceType: def.referenceType,
    referenceId: def.referenceId,
    basis: def.basis,
    createdBy: createdBy || { userId: 'system', role: 'payroll_engine' }
  }));
}

/**
 * Link a single salary calculation to ledger entries
 */
export async function linkSalaryToLedger(
  salary: IDriverSalary,
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<PayrollIntegrationResult> {
  const result: PayrollIntegrationResult = {
    salaryId: salary._id?.toString() || '',
    driverId: salary.driverId?.toString() || '',
    driverName: salary.driverName || 'Unknown',
    month,
    year,
    status: 'success',
    grossSalary: 0,
    totalDeductions: 0,
    netSalary: 0,
    ledgerEntriesCreated: 0,
    ledgerEntries: [],
    errors: [],
    warnings: [],
    timestamp: new Date()
  };

  try {
    // Extract salary component breakdown
    const breakdown = extractSalaryComponentBreakdown(salary);
    result.grossSalary = breakdown.grossSalary;
    result.totalDeductions = breakdown.totalDeductions;
    result.netSalary = breakdown.netSalary;

    // Generate ledger entry definitions
    const definitions = generateLedgerEntryDefinitions(breakdown, salary._id!);

    if (definitions.length === 0) {
      result.status = 'partial';
      result.warnings.push('No salary components to create ledger entries for');
      return result;
    }

    // Convert to ledger inputs
    const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
    const ledgerInputs = definitionsToLedgerInputs(
      definitions,
      tenantObjId,
      salary.driverId!,
      salary.driverName || 'Unknown',
      month,
      year,
      createdBy
    );

    // Create batch ledger entries
    const ledgerEntries = await createBatchLedgerEntries(ledgerInputs);
    result.ledgerEntriesCreated = ledgerEntries.length;
    result.ledgerEntries = ledgerEntries.map(e => e._id?.toString() || '');

    // Verify ledger integrity
    const verification = await verifyLedgerBalance(tenantObjId, salary.driverId!, month, year);
    if (!verification.consistent) {
      result.status = 'partial';
      result.warnings.push(`Ledger balance inconsistency: ${verification.errors.join('; ')}`);
    }

    return result;
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
}

/**
 * Link multiple salary calculations to ledger entries (batch processing)
 */
export async function linkBatchSalariesToLedger(
  salaries: IDriverSalary[],
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<PayrollIntegrationResult[]> {
  const results: PayrollIntegrationResult[] = [];

  for (const salary of salaries) {
    const result = await linkSalaryToLedger(salary, tenantId, month, year, createdBy);
    results.push(result);
  }

  return results;
}

/**
 * Link all salaries for a tenant/month to ledger entries
 */
export async function linkMonthlyPayrollToLedger(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<{
  results: PayrollIntegrationResult[];
  summary: {
    totalProcessed: number;
    successCount: number;
    partialCount: number;
    failedCount: number;
    totalGrossSalary: number;
    totalDeductions: number;
    totalNetSalary: number;
    totalLedgerEntries: number;
  };
}> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Get period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  // Fetch all salaries for this period
  const salaries = await DriverSalary.find({
    tenantId: tenantObjId,
    salaryPeriodStart: { $gte: periodStart },
    salaryPeriodEnd: { $lte: periodEnd }
  });

  // Link each salary to ledger
  const results = await linkBatchSalariesToLedger(salaries, tenantObjId, month, year, createdBy);

  // Calculate summary
  const summary = {
    totalProcessed: results.length,
    successCount: results.filter(r => r.status === 'success').length,
    partialCount: results.filter(r => r.status === 'partial').length,
    failedCount: results.filter(r => r.status === 'failed').length,
    totalGrossSalary: results.reduce((sum, r) => sum + r.grossSalary, 0),
    totalDeductions: results.reduce((sum, r) => sum + r.totalDeductions, 0),
    totalNetSalary: results.reduce((sum, r) => sum + r.netSalary, 0),
    totalLedgerEntries: results.reduce((sum, r) => sum + r.ledgerEntriesCreated, 0)
  };

  return { results, summary };
}

/**
 * Reconcile salary calculations with ledger entries
 * Verifies that every salary has corresponding ledger entries
 */
export async function reconcileSalaryLedger(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<{
  totalSalaries: number;
  salariesWithLedger: number;
  salariesWithoutLedger: number;
  missingReconciliations: Array<{
    salaryId: string;
    driverId: string;
    driverName: string;
    grossSalary: number;
    ledgerEntriesCount: number;
  }>;
}> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Get period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  // Fetch all salaries
  const salaries = await DriverSalary.find({
    tenantId: tenantObjId,
    salaryPeriodStart: { $gte: periodStart },
    salaryPeriodEnd: { $lte: periodEnd }
  });

  let salariesWithLedger = 0;
  const missingReconciliations = [];

  // Check ledger entries for each salary
  for (const salary of salaries) {
    const ledgerEntries = await getLedgerEntries(
      tenantObjId,
      salary.driverId!,
      month,
      year
    );

    if (ledgerEntries.length > 0) {
      salariesWithLedger++;
    } else {
      missingReconciliations.push({
        salaryId: salary._id?.toString() || '',
        driverId: salary.driverId?.toString() || '',
        driverName: salary.driverName || 'Unknown',
        grossSalary: salary.grossSalary || 0,
        ledgerEntriesCount: 0
      });
    }
  }

  return {
    totalSalaries: salaries.length,
    salariesWithLedger,
    salariesWithoutLedger: salaries.length - salariesWithLedger,
    missingReconciliations
  };
}

/**
 * Get integration report for payroll period
 */
export async function getPayrollIntegrationReport(
  tenantId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<{
  period: string;
  totalSalaries: number;
  totalGrossSalary: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalLedgerEntries: number;
  averageEntriesPerSalary: number;
  reconciliationStatus: {
    totalSalaries: number;
    salariesWithLedger: number;
    salariesWithoutLedger: number;
    reconciliationPercentage: number;
  };
}> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;

  // Get period dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  // Fetch salaries
  const salaries = await DriverSalary.find({
    tenantId: tenantObjId,
    salaryPeriodStart: { $gte: periodStart },
    salaryPeriodEnd: { $lte: periodEnd }
  });

  // Fetch ledger entries
  const ledgerEntries = await DriverSalaryLedger.find({
    tenantId: tenantObjId,
    month,
    year
  });

  // Get reconciliation status
  const reconciliation = await reconcileSalaryLedger(tenantObjId, month, year);

  const totalGrossSalary = salaries.reduce((sum, s) => sum + (s.grossSalary || 0), 0);
  const totalDeductions = salaries.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);
  const totalNetSalary = salaries.reduce((sum, s) => sum + (s.netSalary || 0), 0);

  const reconciliationPercentage = salaries.length > 0
    ? (reconciliation.salariesWithLedger / salaries.length) * 100
    : 0;

  return {
    period: `${month}/${year}`,
    totalSalaries: salaries.length,
    totalGrossSalary,
    totalDeductions,
    totalNetSalary,
    totalLedgerEntries: ledgerEntries.length,
    averageEntriesPerSalary: salaries.length > 0 ? ledgerEntries.length / salaries.length : 0,
    reconciliationStatus: {
      totalSalaries: reconciliation.totalSalaries,
      salariesWithLedger: reconciliation.salariesWithLedger,
      salariesWithoutLedger: reconciliation.salariesWithoutLedger,
      reconciliationPercentage: Math.round(reconciliationPercentage * 100) / 100
    }
  };
}
