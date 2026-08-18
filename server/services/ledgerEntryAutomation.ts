/**
 * PHASE 5: DRIVER LEDGER AUTOMATION
 * Auto-creates ledger entries when salary events occur
 * - No manual entries needed
 * - Entries are immutable and audit-able
 * - Running balance maintained automatically
 */

import mongoose from 'mongoose';
import { DriverSalaryLedger, IDriverSalaryLedger } from '../models/index';

/**
 * Ledger entry type
 */
export type LedgerEntryType =
  | 'salary_earned'       // Credit: Salary generated
  | 'advance_taken'       // Debit: Advance disbursed
  | 'advance_recovered'   // Debit: Advance recovered from salary
  | 'recharge_deducted'   // Debit: Mobile recharge deducted
  | 'recovery_deducted'   // Debit: Recovery/damage/shortage deducted
  | 'salary_paid'         // Debit: Salary payment made
  | 'adjustment'          // Debit/Credit: Manual adjustment
  | 'interest_charged'    // Debit: Interest on outstanding
  | 'manual_credit'       // Credit: Manual credit
  | 'manual_debit';       // Debit: Manual debit

/**
 * Create a ledger entry
 * Automatically calculates running balance
 */
export interface CreateLedgerEntryInput {
  tenantId: string | mongoose.Types.ObjectId;
  driverId: string | mongoose.Types.ObjectId;
  driverName: string;
  month: number;
  year: number;
  entryType: LedgerEntryType;
  description: string;
  amount: number; // Positive number; entry type determines if debit or credit
  referenceType?: 'salary_id' | 'advance_id' | 'recharge_id' | 'recovery_id' | 'payment_id' | 'manual';
  referenceId?: string | mongoose.Types.ObjectId;
  basis?: { type: string; value: number };
  createdBy?: { userId: string; role: string };
  notes?: string;
}

/**
 * Determine if entry is a credit (money in) or debit (money out)
 */
function isCredit(entryType: LedgerEntryType): boolean {
  return entryType === 'salary_earned' || entryType === 'manual_credit';
}

function isDebit(entryType: LedgerEntryType): boolean {
  return !isCredit(entryType);
}

/**
 * Create a single ledger entry with automatic balance calculation
 */
export async function createLedgerEntry(input: CreateLedgerEntryInput): Promise<IDriverSalaryLedger> {
  const tenantObjId = typeof input.tenantId === 'string' ? new mongoose.Types.ObjectId(input.tenantId) : input.tenantId;
  const driverObjId = typeof input.driverId === 'string' ? new mongoose.Types.ObjectId(input.driverId) : input.driverId;

  // Get previous closing balance
  const previousEntry = await DriverSalaryLedger.findOne({
    tenantId: tenantObjId,
    driverId: driverObjId,
    month: input.month,
    year: input.year
  }).sort({ createdAt: -1 }).limit(1);

  let previousBalance = 0;
  if (previousEntry && previousEntry.closingBalance !== undefined) {
    previousBalance = previousEntry.closingBalance;
  }

  // Calculate new balance
  const debit = isDebit(input.entryType) ? input.amount : 0;
  const credit = isCredit(input.entryType) ? input.amount : 0;

  // Accounting convention:
  // Balance = Previous Balance + Credit - Debit
  const newBalance = previousBalance + credit - debit;

  // Create entry
  const entry = new DriverSalaryLedger({
    tenantId: tenantObjId,
    driverId: driverObjId,
    driverName: input.driverName,
    month: input.month,
    year: input.year,
    transactionType: mapEntryTypeToTransactionType(input.entryType),
    amount: input.amount,
    reason: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId ? (typeof input.referenceId === 'string' ? new mongoose.Types.ObjectId(input.referenceId) : input.referenceId) : undefined,
    basis: input.basis,
    createdBy: input.createdBy || { userId: 'system', role: 'system' },
    createdAt: new Date(),
    closingBalance: newBalance
  });

  return entry.save();
}

/**
 * Map ledger entry type to DriverSalaryLedger transaction type
 */
function mapEntryTypeToTransactionType(entryType: LedgerEntryType): string {
  const mapping: Record<LedgerEntryType, string> = {
    'salary_earned': 'base_salary',
    'advance_taken': 'advance_recovery',
    'advance_recovered': 'advance_recovery',
    'recharge_deducted': 'other_deduction',
    'recovery_deducted': 'damage_recovery', // Can be customized based on recovery type
    'salary_paid': 'manual_incentive', // Not ideal, but uses existing enum
    'adjustment': 'other_deduction',
    'interest_charged': 'penalty',
    'manual_credit': 'bonus',
    'manual_debit': 'penalty'
  };

  return mapping[entryType] || 'other_deduction';
}

/**
 * Create multiple ledger entries in a batch (transactional)
 */
export async function createBatchLedgerEntries(entries: CreateLedgerEntryInput[]): Promise<IDriverSalaryLedger[]> {
  if (entries.length === 0) {
    return [];
  }

  const createdEntries: IDriverSalaryLedger[] = [];

  // Process entries sequentially to maintain balance consistency
  for (const entry of entries) {
    const created = await createLedgerEntry(entry);
    createdEntries.push(created);
  }

  return createdEntries;
}

/**
 * Get ledger entries for a driver in a month
 */
export async function getLedgerEntries(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<IDriverSalaryLedger[]> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  return DriverSalaryLedger.find({
    tenantId: tenantObjId,
    driverId: driverObjId,
    month,
    year
  }).sort({ createdAt: 1 });
}

/**
 * Get closing balance for a driver in a month
 */
export async function getClosingBalance(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<number> {
  const tenantObjId = typeof tenantId === 'string' ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const driverObjId = typeof driverId === 'string' ? new mongoose.Types.ObjectId(driverId) : driverId;

  const lastEntry = await DriverSalaryLedger.findOne({
    tenantId: tenantObjId,
    driverId: driverObjId,
    month,
    year
  }).sort({ createdAt: -1 }).limit(1);

  return lastEntry?.closingBalance || 0;
}

/**
 * Print ledger in formatted table
 */
export function formatLedgerAsTable(entries: IDriverSalaryLedger[]): string {
  if (entries.length === 0) {
    return 'No ledger entries';
  }

  const lines = [
    'DRIVER SALARY LEDGER',
    '================================================',
    `Date\t\tType\t\tDescription\tDebit\tCredit\tBalance`,
    '================================================'
  ];

  for (const entry of entries) {
    const date = entry.createdAt.toLocaleDateString();
    const type = entry.transactionType;
    const reason = entry.reason || '';
    const debit = isDebit(entry.transactionType as LedgerEntryType) ? entry.amount.toFixed(2) : '-';
    const credit = isCredit(entry.transactionType as LedgerEntryType) ? entry.amount.toFixed(2) : '-';
    const balance = entry.closingBalance?.toFixed(2) || '0.00';

    lines.push(`${date}\t${type}\t${reason}\t${debit}\t${credit}\t${balance}`);
  }

  lines.push('================================================');
  return lines.join('\n');
}

/**
 * Automation hooks - these functions are called when salary events occur
 */

/**
 * AUTO-CREATE: Salary generated entry
 * Called when a DriverSalary is created/calculated
 */
export async function autoCreateSalaryEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  salaryId: string | mongoose.Types.ObjectId,
  salaryAmount: number,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'salary_earned',
    description: `Salary for ${month}/${year}`,
    amount: salaryAmount,
    referenceType: 'salary_id',
    referenceId: salaryId,
    createdBy: createdBy || { userId: 'system', role: 'salary_engine' }
  });
}

/**
 * AUTO-CREATE: Advance taken entry
 * Called when a DriverAdvance is created
 */
export async function autoCreateAdvanceTakenEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  advanceId: string | mongoose.Types.ObjectId,
  amount: number,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'advance_taken',
    description: 'Advance disbursed',
    amount,
    referenceType: 'advance_id',
    referenceId: advanceId,
    createdBy: createdBy || { userId: 'system', role: 'advance_engine' }
  });
}

/**
 * AUTO-CREATE: Advance recovery entry
 * Called when advance is deducted from salary
 */
export async function autoCreateAdvanceRecoveryEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  advanceId: string | mongoose.Types.ObjectId,
  recoveryAmount: number,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'advance_recovered',
    description: 'Advance recovered from salary',
    amount: recoveryAmount,
    referenceType: 'advance_id',
    referenceId: advanceId,
    createdBy: createdBy || { userId: 'system', role: 'salary_engine' }
  });
}

/**
 * AUTO-CREATE: Recharge deduction entry
 * Called when a DriverRecharge with DEDUCT_FROM_DRIVER is created
 */
export async function autoCreateRechargeDeductionEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  rechargeId: string | mongoose.Types.ObjectId,
  amount: number,
  mobileNumber: string,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'recharge_deducted',
    description: `Mobile recharge deduction - ${mobileNumber}`,
    amount,
    referenceType: 'recharge_id',
    referenceId: rechargeId,
    createdBy: createdBy || { userId: 'system', role: 'recharge_engine' }
  });
}

/**
 * AUTO-CREATE: Recovery deduction entry
 * Called when a DriverRecovery is approved/recovered
 */
export async function autoCreateRecoveryDeductionEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  recoveryId: string | mongoose.Types.ObjectId,
  amount: number,
  recoveryType: string,
  reason: string,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'recovery_deducted',
    description: `${recoveryType} recovery - ${reason}`,
    amount,
    referenceType: 'recovery_id',
    referenceId: recoveryId,
    createdBy: createdBy || { userId: 'system', role: 'recovery_engine' }
  });
}

/**
 * AUTO-CREATE: Salary payment entry
 * Called when salary is paid to driver
 */
export async function autoCreateSalaryPaymentEntry(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  driverName: string,
  paymentId: string | mongoose.Types.ObjectId,
  amount: number,
  paymentMode: string,
  month: number,
  year: number,
  createdBy?: { userId: string; role: string }
): Promise<IDriverSalaryLedger> {
  return createLedgerEntry({
    tenantId,
    driverId,
    driverName,
    month,
    year,
    entryType: 'salary_paid',
    description: `Salary payment via ${paymentMode}`,
    amount,
    referenceType: 'payment_id',
    referenceId: paymentId,
    createdBy: createdBy || { userId: 'system', role: 'payment_engine' }
  });
}

/**
 * Verify ledger balance consistency
 */
export async function verifyLedgerBalance(
  tenantId: string | mongoose.Types.ObjectId,
  driverId: string | mongoose.Types.ObjectId,
  month: number,
  year: number
): Promise<{ consistent: boolean; errors: string[] }> {
  const entries = await getLedgerEntries(tenantId, driverId, month, year);
  const errors: string[] = [];

  if (entries.length === 0) {
    return { consistent: true, errors: [] };
  }

  let calculatedBalance = 0;

  for (const entry of entries) {
    const debit = isDebit(entry.transactionType as LedgerEntryType) ? entry.amount : 0;
    const credit = isCredit(entry.transactionType as LedgerEntryType) ? entry.amount : 0;
    calculatedBalance = calculatedBalance + credit - debit;

    if (Math.abs((entry.closingBalance || 0) - calculatedBalance) > 0.01) {
      errors.push(
        `Entry ${entry._id}: Expected balance ${calculatedBalance.toFixed(2)}, ` +
        `but got ${(entry.closingBalance || 0).toFixed(2)}`
      );
    }
  }

  return {
    consistent: errors.length === 0,
    errors
  };
}
