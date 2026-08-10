import mongoose from 'mongoose';
import { DriverSalaryLedger, IDriverSalaryLedger } from '../models/index';

export interface LedgerEntryInput {
  tenantId: string;
  driverId: string;
  driverName: string;
  month: number;
  year: number;
  transactionType: string;
  amount: number;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  createdBy: { userId: string; role: string };
}

export async function recordLedgerEntry(
  input: LedgerEntryInput
): Promise<IDriverSalaryLedger> {
  validateLedgerEntry(input);

  const entry = await DriverSalaryLedger.create({
    tenantId: new mongoose.Types.ObjectId(input.tenantId),
    driverId: new mongoose.Types.ObjectId(input.driverId),
    driverName: input.driverName,
    month: input.month,
    year: input.year,
    transactionType: input.transactionType,
    amount: input.amount,
    reason: input.reason,
    referenceType: input.referenceType,
    referenceId: input.referenceId ? new mongoose.Types.ObjectId(input.referenceId) : undefined,
    createdBy: input.createdBy,
    createdAt: new Date()
  });

  return entry;
}

export async function getDriverLedger(
  tenantId: string,
  driverId: string,
  month?: number,
  year?: number
): Promise<IDriverSalaryLedger[]> {
  const query: any = {
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId)
  };

  if (month !== undefined) {
    query.month = month;
  }

  if (year !== undefined) {
    query.year = year;
  }

  return DriverSalaryLedger.find(query).sort({ createdAt: 1 });
}

export async function getMonthlyLedgerForDriver(
  tenantId: string,
  driverId: string,
  month: number,
  year: number
): Promise<{
  entries: IDriverSalaryLedger[];
  openingBalance: number;
  closingBalance: number;
  totalEarnings: number;
  totalDeductions: number;
}> {
  const entries = await getDriverLedger(tenantId, driverId, month, year);

  let totalEarnings = 0;
  let totalDeductions = 0;

  for (const entry of entries) {
    if (isEarningType(entry.transactionType)) {
      totalEarnings += entry.amount;
    } else {
      totalDeductions += entry.amount;
    }
  }

  // Get previous month's closing balance as opening balance
  const prevMonthEntries = await getDriverLedger(
    tenantId,
    driverId,
    month === 1 ? 12 : month - 1,
    month === 1 ? year - 1 : year
  );

  let openingBalance = 0;
  if (prevMonthEntries.length > 0) {
    const lastEntry = prevMonthEntries[prevMonthEntries.length - 1];
    openingBalance = lastEntry.closingBalance || 0;
  }

  const closingBalance = openingBalance + totalEarnings - totalDeductions;

  return {
    entries,
    openingBalance,
    closingBalance,
    totalEarnings,
    totalDeductions
  };
}

export async function getTenantLedger(
  tenantId: string,
  month: number,
  year: number
): Promise<IDriverSalaryLedger[]> {
  return DriverSalaryLedger.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    month,
    year
  }).sort({ driverId: 1, createdAt: 1 });
}

export async function getLedgerEntryById(
  tenantId: string,
  entryId: string
): Promise<IDriverSalaryLedger | null> {
  return DriverSalaryLedger.findOne({
    _id: new mongoose.Types.ObjectId(entryId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });
}

export async function getDriverLedgerSummary(
  tenantId: string,
  driverId: string
): Promise<{
  totalEarnings: number;
  totalDeductions: number;
  netBalance: number;
  lastTransactionDate: Date | null;
  transactionCount: number;
}> {
  const entries = await getDriverLedger(tenantId, driverId);

  let totalEarnings = 0;
  let totalDeductions = 0;

  for (const entry of entries) {
    if (isEarningType(entry.transactionType)) {
      totalEarnings += entry.amount;
    } else {
      totalDeductions += entry.amount;
    }
  }

  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  return {
    totalEarnings,
    totalDeductions,
    netBalance: totalEarnings - totalDeductions,
    lastTransactionDate: lastEntry?.createdAt || null,
    transactionCount: entries.length
  };
}

export async function exportLedgerToCSV(
  tenantId: string,
  month: number,
  year: number
): Promise<string> {
  const entries = await getTenantLedger(tenantId, month, year);

  const headers = [
    'Driver ID',
    'Driver Name',
    'Date',
    'Transaction Type',
    'Amount',
    'Reason',
    'Reference',
    'Created By'
  ];

  const rows = entries.map((entry) => [
    entry.driverId.toString(),
    entry.driverName,
    new Date(entry.createdAt).toLocaleDateString(),
    entry.transactionType,
    entry.amount.toFixed(2),
    entry.reason || '',
    entry.referenceId?.toString() || '',
    `${entry.createdBy.userId} (${entry.createdBy.role})`
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
  ].join('\n');

  return csv;
}

function isEarningType(transactionType: string): boolean {
  const earningTypes = [
    'base_salary',
    'attendance_bonus',
    'trip_incentive',
    'km_incentive',
    'night_allowance',
    'outstation_allowance',
    'food_allowance',
    'overtime_earning',
    'bonus',
    'manual_incentive'
  ];
  return earningTypes.includes(transactionType);
}

function validateLedgerEntry(input: LedgerEntryInput) {
  if (!input.driverId) {
    throw new Error('Driver ID is required');
  }

  if (!input.month || input.month < 1 || input.month > 12) {
    throw new Error('Invalid month');
  }

  if (!input.year || input.year < 2020) {
    throw new Error('Invalid year');
  }

  if (!input.transactionType) {
    throw new Error('Transaction type is required');
  }

  if (input.amount === undefined || input.amount < 0) {
    throw new Error('Invalid amount');
  }

  const validTypes = [
    'base_salary', 'attendance_bonus', 'trip_incentive', 'km_incentive',
    'night_allowance', 'outstation_allowance', 'food_allowance',
    'overtime_earning', 'bonus', 'manual_incentive',
    'absence_deduction', 'advance_recovery', 'loan_recovery',
    'penalty', 'damage_recovery', 'challan_recovery',
    'cash_shortage', 'fuel_excess', 'other_deduction'
  ];

  if (!validTypes.includes(input.transactionType)) {
    throw new Error(`Invalid transaction type: ${input.transactionType}`);
  }
}

export interface LedgerReport {
  month: number;
  year: number;
  tenantId: string;
  totalEarnings: number;
  totalDeductions: number;
  totalNetSalary: number;
  driverCount: number;
  driverLedgers: Array<{
    driverId: string;
    driverName: string;
    earnings: number;
    deductions: number;
    netSalary: number;
  }>;
}

export async function generateLedgerReport(
  tenantId: string,
  month: number,
  year: number
): Promise<LedgerReport> {
  const entries = await getTenantLedger(tenantId, month, year);

  const driverMap = new Map<string, { name: string; earnings: number; deductions: number }>();

  for (const entry of entries) {
    const driverId = entry.driverId.toString();
    if (!driverMap.has(driverId)) {
      driverMap.set(driverId, {
        name: entry.driverName,
        earnings: 0,
        deductions: 0
      });
    }

    const driver = driverMap.get(driverId)!;
    if (isEarningType(entry.transactionType)) {
      driver.earnings += entry.amount;
    } else {
      driver.deductions += entry.amount;
    }
  }

  let totalEarnings = 0;
  let totalDeductions = 0;

  const driverLedgers = Array.from(driverMap.entries()).map(([driverId, data]) => {
    const netSalary = data.earnings - data.deductions;
    totalEarnings += data.earnings;
    totalDeductions += data.deductions;

    return {
      driverId,
      driverName: data.name,
      earnings: data.earnings,
      deductions: data.deductions,
      netSalary
    };
  });

  return {
    month,
    year,
    tenantId,
    totalEarnings,
    totalDeductions,
    totalNetSalary: totalEarnings - totalDeductions,
    driverCount: driverLedgers.length,
    driverLedgers
  };
}
