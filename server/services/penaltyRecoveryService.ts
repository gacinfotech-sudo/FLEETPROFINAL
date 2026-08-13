/**
 * PENALTY & RECOVERY MANAGEMENT SERVICE
 * Handles creation, approval, and tracking of driver penalties and recoveries
 * Automatically creates ledger entries for audit trail
 */

import mongoose from 'mongoose';
import { DriverSalaryLedger, Penalty, Recovery } from '../models/index';
import { createLedgerEntry } from './ledgerEntryAutomation';

export interface CreatePenaltyInput {
  tenantId: string | mongoose.Types.ObjectId;
  driverId: string | mongoose.Types.ObjectId;
  penaltyType: 'damage' | 'challan' | 'cash_shortage' | 'fuel_excess' | 'attendance' | 'behavior' | 'other';
  amount: number;
  reason: string;
  deductionMode: 'full_next_salary' | 'emi' | 'manual';
  installments?: number;
  notes?: string;
  approvedBy?: { userId: string; role: string };
  createdBy?: { userId: string; role: string };
}

export interface CreateRecoveryInput {
  tenantId: string | mongoose.Types.ObjectId;
  driverId: string | mongoose.Types.ObjectId;
  recoveryType: 'advance' | 'loan' | 'penalty' | 'damage' | 'shortage' | 'fuel_excess' | 'other';
  amount: number;
  description: string;
  recoveryMode: 'single' | 'emi' | 'manual';
  installments?: number;
  startDate?: Date;
  createdBy?: { userId: string; role: string };
}

export interface ApplyPenaltyDeductionInput {
  penaltyId: string | mongoose.Types.ObjectId;
  month: number;
  year: number;
  deductedAmount: number;
}

/**
 * Create a new penalty
 */
export async function createPenalty(input: CreatePenaltyInput): Promise<any> {
  const tenantObjId = typeof input.tenantId === 'string' ? new mongoose.Types.ObjectId(input.tenantId) : input.tenantId;
  const driverObjId = typeof input.driverId === 'string' ? new mongoose.Types.ObjectId(input.driverId) : input.driverId;

  // Fetch driver details for name
  let driverName = 'Unknown Driver';
  try {
    // Assuming there's a Driver model
    // const driver = await Driver.findById(driverObjId);
    // if (driver) driverName = driver.name;
  } catch (err) {
    console.error('Error fetching driver details:', err);
  }

  const penalty = new Penalty({
    tenantId: tenantObjId,
    driverId: driverObjId,
    driverName,
    penaltyType: input.penaltyType,
    amount: input.amount,
    reason: input.reason,
    status: input.approvedBy ? 'approved' : 'pending',
    deductionMode: input.deductionMode,
    installments: input.installments || 1,
    appliedTo: 0,
    approvedBy: input.approvedBy,
    createdBy: input.createdBy || { userId: 'system', role: 'admin' },
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: input.notes,
  });

  const saved = await penalty.save();

  // If approved, create an initial ledger entry
  if (input.approvedBy) {
    await createLedgerEntry({
      tenantId: tenantObjId,
      driverId: driverObjId,
      driverName,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      entryType: 'recovery_deducted',
      description: `${input.penaltyType.replace(/_/g, ' ')}: ${input.reason}`,
      amount: input.amount,
      referenceType: 'penalty_id',
      referenceId: saved._id,
      createdBy: input.approvedBy,
      notes: input.notes,
    });
  }

  return saved;
}

/**
 * Approve a penalty
 */
export async function approvePenalty(
  penaltyId: string | mongoose.Types.ObjectId,
  approvedBy: { userId: string; role: string }
): Promise<any> {
  const penaltyObjId = typeof penaltyId === 'string' ? new mongoose.Types.ObjectId(penaltyId) : penaltyId;

  const penalty = await Penalty.findByIdAndUpdate(
    penaltyObjId,
    {
      status: 'approved',
      approvedBy,
      updatedAt: new Date(),
    },
    { new: true }
  );

  if (!penalty) throw new Error('Penalty not found');

  // Create ledger entry for approval
  await createLedgerEntry({
    tenantId: penalty.tenantId,
    driverId: penalty.driverId,
    driverName: penalty.driverName,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    entryType: 'recovery_deducted',
    description: `Approved: ${penalty.penaltyType.replace(/_/g, ' ')} - ${penalty.reason}`,
    amount: penalty.amount,
    referenceType: 'penalty_id',
    referenceId: penaltyId,
    createdBy: approvedBy,
  });

  return penalty;
}

/**
 * Get penalties by filter
 */
export async function getPenalties(filters: {
  tenantId?: string | mongoose.Types.ObjectId;
  driverId?: string | mongoose.Types.ObjectId;
  status?: string;
  month?: number;
  year?: number;
  penaltyType?: string;
}): Promise<any[]> {
  const query: any = {};

  if (filters.tenantId) {
    query.tenantId = filters.tenantId;
  }
  if (filters.driverId) {
    query.driverId = filters.driverId;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.penaltyType) {
    query.penaltyType = filters.penaltyType;
  }

  let penalties = await Penalty.find(query).sort({ createdAt: -1 });

  // Filter by month/year if provided
  if (filters.month !== undefined && filters.year !== undefined) {
    penalties = penalties.filter((p: any) => {
      const date = new Date(p.createdAt);
      return date.getMonth() + 1 === filters.month && date.getFullYear() === filters.year;
    });
  }

  return penalties;
}

/**
 * Create a new recovery
 */
export async function createRecovery(input: CreateRecoveryInput): Promise<any> {
  const tenantObjId = typeof input.tenantId === 'string' ? new mongoose.Types.ObjectId(input.tenantId) : input.tenantId;
  const driverObjId = typeof input.driverId === 'string' ? new mongoose.Types.ObjectId(input.driverId) : input.driverId;

  let driverName = 'Unknown Driver';
  try {
    // Fetch driver details if available
  } catch (err) {
    console.error('Error fetching driver details:', err);
  }

  const emiAmount = input.recoveryMode === 'emi' && input.installments
    ? Math.ceil(input.amount / input.installments)
    : input.amount;

  const recovery = new Recovery({
    tenantId: tenantObjId,
    driverId: driverObjId,
    driverName,
    recoveryType: input.recoveryType,
    amount: input.amount,
    originalAmount: input.amount,
    description: input.description,
    startDate: input.startDate || new Date(),
    status: 'active',
    recoveryMode: input.recoveryMode,
    installments: input.installments || 1,
    emiAmount,
    recoveredAmount: 0,
    remainingAmount: input.amount,
    ledgerEntries: [],
    createdBy: input.createdBy || { userId: 'system', role: 'admin' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const saved = await recovery.save();

  // Create initial ledger entry
  await createLedgerEntry({
    tenantId: tenantObjId,
    driverId: driverObjId,
    driverName,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    entryType: 'recovery_deducted',
    description: `Recovery initiated: ${input.recoveryType} - ${input.description}`,
    amount: input.amount,
    referenceType: 'recovery_id',
    referenceId: saved._id,
    createdBy: input.createdBy,
  });

  return saved;
}

/**
 * Record recovery payment
 */
export async function recordRecoveryPayment(
  recoveryId: string | mongoose.Types.ObjectId,
  paidAmount: number,
  recordedBy: { userId: string; role: string }
): Promise<any> {
  const recoveryObjId = typeof recoveryId === 'string' ? new mongoose.Types.ObjectId(recoveryId) : recoveryId;

  const recovery = await Recovery.findById(recoveryObjId);
  if (!recovery) throw new Error('Recovery not found');

  const newRecoveredAmount = recovery.recoveredAmount + paidAmount;
  const newRemainingAmount = recovery.remainingAmount - paidAmount;
  const status = newRemainingAmount <= 0 ? 'completed' : 'active';

  // Create ledger entry for recovery payment
  const ledgerEntry = await createLedgerEntry({
    tenantId: recovery.tenantId,
    driverId: recovery.driverId,
    driverName: recovery.driverName,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    entryType: 'recovery_deducted',
    description: `Recovery payment: ${recovery.recoveryType} - ${paidAmount / 100} paid`,
    amount: paidAmount,
    referenceType: 'recovery_id',
    referenceId: recoveryObjId,
    createdBy: recordedBy,
  });

  const updated = await Recovery.findByIdAndUpdate(
    recoveryObjId,
    {
      recoveredAmount: newRecoveredAmount,
      remainingAmount: newRemainingAmount,
      status,
      $push: { ledgerEntries: ledgerEntry._id },
      updatedAt: new Date(),
    },
    { new: true }
  );

  return updated;
}

/**
 * Get recoveries by filter
 */
export async function getRecoveries(filters: {
  tenantId?: string | mongoose.Types.ObjectId;
  driverId?: string | mongoose.Types.ObjectId;
  status?: string;
  recoveryType?: string;
}): Promise<any[]> {
  const query: any = {};

  if (filters.tenantId) {
    query.tenantId = filters.tenantId;
  }
  if (filters.driverId) {
    query.driverId = filters.driverId;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.recoveryType) {
    query.recoveryType = filters.recoveryType;
  }

  return await Recovery.find(query).sort({ createdAt: -1 });
}

/**
 * Get penalty and recovery statistics
 */
export async function getPenaltyRecoveryStats(filters: {
  tenantId?: string | mongoose.Types.ObjectId;
  driverId?: string | mongoose.Types.ObjectId;
  month?: number;
  year?: number;
}): Promise<any> {
  const penaltiesQuery: any = {};
  const recoveriesQuery: any = {};

  if (filters.tenantId) {
    penaltiesQuery.tenantId = filters.tenantId;
    recoveriesQuery.tenantId = filters.tenantId;
  }
  if (filters.driverId) {
    penaltiesQuery.driverId = filters.driverId;
    recoveriesQuery.driverId = filters.driverId;
  }

  const [penalties, recoveries] = await Promise.all([
    Penalty.find(penaltiesQuery),
    Recovery.find(recoveriesQuery),
  ]);

  let filteredPenalties = penalties;
  let filteredRecoveries = recoveries;

  if (filters.month !== undefined && filters.year !== undefined) {
    filteredPenalties = penalties.filter((p: any) => {
      const date = new Date(p.createdAt);
      return date.getMonth() + 1 === filters.month && date.getFullYear() === filters.year;
    });

    filteredRecoveries = recoveries.filter((r: any) => {
      const date = new Date(r.startDate);
      return date.getMonth() + 1 === filters.month && date.getFullYear() === filters.year;
    });
  }

  const totalPenalties = filteredPenalties.reduce((sum: number, p: any) => sum + p.amount, 0);
  const totalRecoveries = filteredRecoveries.reduce((sum: number, r: any) => sum + r.amount, 0);
  const totalRecovered = filteredRecoveries.reduce((sum: number, r: any) => sum + r.recoveredAmount, 0);
  const totalRemaining = filteredRecoveries.reduce((sum: number, r: any) => sum + r.remainingAmount, 0);

  return {
    totalPenalties,
    totalRecoveries,
    totalRecovered,
    totalRemaining,
    pendingPenalties: filteredPenalties.filter((p: any) => p.status === 'pending').length,
    approvedPenalties: filteredPenalties.filter((p: any) => p.status === 'approved').length,
    deductedPenalties: filteredPenalties.filter((p: any) => p.status === 'deducted').length,
    activePenalties: filteredPenalties.filter((p: any) => p.status === 'approved' || p.status === 'pending').length,
    activeRecoveries: filteredRecoveries.filter((r: any) => r.status === 'active').length,
    completedRecoveries: filteredRecoveries.filter((r: any) => r.status === 'completed').length,
    penaltyByType: getPenaltyBreakdown(filteredPenalties),
    recoveryByType: getRecoveryBreakdown(filteredRecoveries),
  };
}

/**
 * Get penalty breakdown by type
 */
function getPenaltyBreakdown(penalties: any[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  penalties.forEach((p: any) => {
    const type = p.penaltyType || 'other';
    breakdown[type] = (breakdown[type] || 0) + p.amount;
  });
  return breakdown;
}

/**
 * Get recovery breakdown by type
 */
function getRecoveryBreakdown(recoveries: any[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  recoveries.forEach((r: any) => {
    const type = r.recoveryType || 'other';
    breakdown[type] = (breakdown[type] || 0) + r.amount;
  });
  return breakdown;
}

/**
 * Generate penalty/recovery report for a period
 */
export async function generateReport(filters: {
  tenantId: string | mongoose.Types.ObjectId;
  driverId?: string | mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
}): Promise<any> {
  const query: any = { tenantId: filters.tenantId };
  if (filters.driverId) {
    query.driverId = filters.driverId;
  }

  const [penalties, recoveries, ledgerEntries] = await Promise.all([
    Penalty.find({
      ...query,
      createdAt: { $gte: filters.startDate, $lte: filters.endDate },
    }),
    Recovery.find({
      ...query,
      startDate: { $gte: filters.startDate, $lte: filters.endDate },
    }),
    DriverSalaryLedger.find({
      ...query,
      createdAt: { $gte: filters.startDate, $lte: filters.endDate },
      transactionType: {
        $in: ['penalty', 'damage_recovery', 'challan_recovery', 'cash_shortage', 'fuel_excess'],
      },
    }),
  ]);

  return {
    period: {
      from: filters.startDate,
      to: filters.endDate,
    },
    penalties: {
      count: penalties.length,
      total: penalties.reduce((sum: number, p: any) => sum + p.amount, 0),
      byType: getPenaltyBreakdown(penalties),
      byStatus: {
        pending: penalties.filter((p: any) => p.status === 'pending').length,
        approved: penalties.filter((p: any) => p.status === 'approved').length,
        deducted: penalties.filter((p: any) => p.status === 'deducted').length,
        reversed: penalties.filter((p: any) => p.status === 'reversed').length,
      },
    },
    recoveries: {
      count: recoveries.length,
      total: recoveries.reduce((sum: number, r: any) => sum + r.amount, 0),
      recovered: recoveries.reduce((sum: number, r: any) => sum + r.recoveredAmount, 0),
      remaining: recoveries.reduce((sum: number, r: any) => sum + r.remainingAmount, 0),
      byType: getRecoveryBreakdown(recoveries),
      byStatus: {
        active: recoveries.filter((r: any) => r.status === 'active').length,
        completed: recoveries.filter((r: any) => r.status === 'completed').length,
        paused: recoveries.filter((r: any) => r.status === 'paused').length,
        cancelled: recoveries.filter((r: any) => r.status === 'cancelled').length,
      },
    },
    ledgerImpact: {
      entriesCreated: ledgerEntries.length,
      totalDeduction: ledgerEntries.reduce((sum: number, e: any) => sum + e.amount, 0),
    },
  };
}
