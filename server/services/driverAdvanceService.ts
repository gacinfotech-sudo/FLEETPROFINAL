import mongoose from 'mongoose';
import { DriverAdvance, IDriverAdvance, DriverSalaryLedger } from '../models/index';

export interface CreateAdvanceRequestInput {
  tenantId: string;
  driverId: string;
  amount: number;
  reason?: string;
  deductionMode: 'full_next_salary' | 'emi' | 'manual';
  emiInstallments?: number;
}

export async function requestAdvance(
  input: CreateAdvanceRequestInput
): Promise<IDriverAdvance> {
  validateAdvanceInput(input);

  const advance = await DriverAdvance.create({
    tenantId: new mongoose.Types.ObjectId(input.tenantId),
    driverId: new mongoose.Types.ObjectId(input.driverId),
    amount: input.amount,
    remaining: input.amount,
    requestDate: new Date(),
    status: 'requested',
    totalDeducted: 0,
    deductionMode: input.deductionMode,
    emiInstallments: input.emiInstallments,
    reason: input.reason
  });

  return advance;
}

export async function approveAdvance(
  tenantId: string,
  advanceId: string,
  approvedBy: { userId: string; role: string },
  notes?: string
): Promise<IDriverAdvance | null> {
  const advance = await DriverAdvance.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(advanceId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: 'requested'
    },
    {
      status: 'approved',
      approvalDate: new Date(),
      approvedBy,
      approvalNotes: notes,
      updatedAt: new Date()
    },
    { new: true }
  );

  return advance;
}

export async function recordAdvancePayment(
  tenantId: string,
  advanceId: string,
  paidBy: { userId: string; role: string },
  paymentMode: 'cash' | 'bank_transfer' | 'upi',
  transactionReference?: string
): Promise<IDriverAdvance | null> {
  const advance = await DriverAdvance.findOne({
    _id: new mongoose.Types.ObjectId(advanceId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    status: 'approved'
  });

  if (!advance) {
    throw new Error('Advance not found or not approved');
  }

  advance.status = 'paid';
  advance.paymentDate = new Date();
  advance.paidBy = paidBy;
  advance.paymentMode = paymentMode;
  advance.transactionReference = transactionReference;
  advance.updatedAt = new Date();

  return advance.save();
}

export async function recordAdvanceDeduction(
  tenantId: string,
  advanceId: string,
  deductedAmount: number,
  month: number,
  year: number,
  recordedBy: { userId: string; role: string }
): Promise<IDriverAdvance | null> {
  const advance = await DriverAdvance.findOne({
    _id: new mongoose.Types.ObjectId(advanceId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });

  if (!advance) {
    throw new Error('Advance not found');
  }

  const newDeducted = advance.totalDeducted + deductedAmount;
  const newRemaining = Math.max(0, advance.amount - newDeducted);

  advance.totalDeducted = newDeducted;
  advance.remaining = newRemaining;

  if (newRemaining <= 0) {
    advance.status = 'closed';
  }

  advance.updatedAt = new Date();
  await advance.save();

  // Record ledger entry for this deduction
  await DriverSalaryLedger.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: advance.driverId,
    driverName: '', // Will be populated by service
    month,
    year,
    transactionType: 'advance_recovery',
    amount: deductedAmount,
    reason: `Advance recovery from request ${advance._id}`,
    referenceType: 'advance_id',
    referenceId: advance._id,
    createdBy: recordedBy,
    closingBalance: newRemaining
  });

  return advance;
}

export async function getAdvancesByDriver(
  tenantId: string,
  driverId: string
): Promise<{
  totalAdvance: number;
  recovered: number;
  pending: number;
  advances: IDriverAdvance[];
}> {
  const advances = await DriverAdvance.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId)
  }).sort({ createdAt: -1 });

  let totalAdvance = 0;
  let recovered = 0;

  advances.forEach((adv) => {
    totalAdvance += adv.amount;
    recovered += adv.totalDeducted;
  });

  return {
    totalAdvance,
    recovered,
    pending: totalAdvance - recovered,
    advances
  };
}

export async function getAdvanceById(
  tenantId: string,
  advanceId: string
): Promise<IDriverAdvance | null> {
  return DriverAdvance.findOne({
    _id: new mongoose.Types.ObjectId(advanceId),
    tenantId: new mongoose.Types.ObjectId(tenantId)
  });
}

export async function listAdvances(
  tenantId: string,
  filter?: { status?: string; driverId?: string }
): Promise<IDriverAdvance[]> {
  const query: any = { tenantId: new mongoose.Types.ObjectId(tenantId) };

  if (filter?.status) {
    query.status = filter.status;
  }

  if (filter?.driverId) {
    query.driverId = new mongoose.Types.ObjectId(filter.driverId);
  }

  return DriverAdvance.find(query).sort({ createdAt: -1 });
}

function validateAdvanceInput(input: CreateAdvanceRequestInput) {
  if (!input.amount || input.amount <= 0) {
    throw new Error('Advance amount must be greater than 0');
  }

  if (input.amount > 1000000) {
    throw new Error('Advance amount exceeds maximum limit');
  }

  if (!input.deductionMode) {
    throw new Error('Deduction mode is required');
  }

  if (input.deductionMode === 'emi') {
    if (!input.emiInstallments || input.emiInstallments < 2) {
      throw new Error('EMI installments must be at least 2');
    }

    if (input.emiInstallments > 24) {
      throw new Error('EMI installments cannot exceed 24 months');
    }
  }
}

export interface AdvanceSummaryPerDriver {
  driverId: string;
  totalRequested: number;
  totalApproved: number;
  totalPaid: number;
  totalDeducted: number;
  remainingPending: number;
}

export async function getAdvanceSummary(
  tenantId: string,
  driverId: string
): Promise<AdvanceSummaryPerDriver> {
  const advances = await DriverAdvance.find({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    driverId: new mongoose.Types.ObjectId(driverId)
  });

  const summary: AdvanceSummaryPerDriver = {
    driverId,
    totalRequested: 0,
    totalApproved: 0,
    totalPaid: 0,
    totalDeducted: 0,
    remainingPending: 0
  };

  advances.forEach((adv) => {
    summary.totalRequested += adv.amount;

    if (adv.status === 'approved' || adv.status === 'paid') {
      summary.totalApproved += adv.amount;
    }

    if (adv.status === 'paid') {
      summary.totalPaid += adv.amount;
    }

    summary.totalDeducted += adv.totalDeducted;
  });

  summary.remainingPending = summary.totalRequested - summary.totalDeducted;

  return summary;
}
