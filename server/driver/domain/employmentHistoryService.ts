// TASK-DRIVER-DOMAIN-02 — employment history service layer (spec §3).
import { Driver } from '../../models/index';
import { recordDriverAuditEvent } from './auditLog';
import { DriverEmploymentHistory, type IDriverEmploymentHistory } from './models';
import type { ActorRef, VerificationStatus } from './types';

export class DriverNotFoundError extends Error {
  constructor() { super('Driver not found.'); this.name = 'DriverNotFoundError'; }
}

async function assertDriverExists(tenantId: string, driverId: string): Promise<void> {
  const exists = await Driver.exists({ _id: driverId, tenantId });
  if (!exists) throw new DriverNotFoundError();
}

export async function createEmploymentHistoryEntry(params: {
  tenantId: string; driverId: string; actor: ActorRef;
  employerName: string; role?: string; startDate: Date | string; endDate?: Date | string;
  contactForVerification?: string; notes?: string;
}): Promise<IDriverEmploymentHistory> {
  const { tenantId, driverId, actor } = params;
  await assertDriverExists(tenantId, driverId);

  const entry = await DriverEmploymentHistory.create({
    tenantId, driverId,
    employerName: params.employerName,
    role: params.role,
    startDate: params.startDate,
    endDate: params.endDate,
    contactForVerification: params.contactForVerification,
    notes: params.notes,
  });

  await recordDriverAuditEvent({
    tenantId, actor, action: 'employment_history_created', driverId,
    employmentHistoryId: entry._id.toString(),
    newValue: { employerName: entry.employerName, startDate: entry.startDate, endDate: entry.endDate },
  });

  return entry;
}

export async function listEmploymentHistory(params: { tenantId: string; driverId: string }): Promise<IDriverEmploymentHistory[]> {
  const { tenantId, driverId } = params;
  await assertDriverExists(tenantId, driverId);
  return DriverEmploymentHistory.find({ tenantId, driverId, isActive: true }).sort({ startDate: -1 }).lean() as any;
}

export async function setEmploymentHistoryVerificationStatus(params: {
  tenantId: string; driverId: string; entryId: string; actor: ActorRef;
  status: VerificationStatus; reason?: string;
}): Promise<IDriverEmploymentHistory | null> {
  const { tenantId, driverId, entryId, actor, status, reason } = params;
  const entry = await DriverEmploymentHistory.findOne({ _id: entryId, tenantId, driverId });
  if (!entry) return null;

  const oldStatus = entry.verificationStatus;
  entry.verificationStatus = status;
  if (status === 'verified') {
    entry.verifiedBy = actor;
    entry.verifiedAt = new Date();
  }
  await entry.save();

  await recordDriverAuditEvent({
    tenantId, actor, action: 'employment_history_verification_status_changed', driverId,
    employmentHistoryId: entryId,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: status },
    reason,
  });

  return entry;
}

// No hard delete — "removing" an entry is isActive=false + audit entry.
export async function deactivateEmploymentHistoryEntry(params: {
  tenantId: string; driverId: string; entryId: string; actor: ActorRef; reason?: string;
}): Promise<IDriverEmploymentHistory | null> {
  const { tenantId, driverId, entryId, actor, reason } = params;
  const entry = await DriverEmploymentHistory.findOne({ _id: entryId, tenantId, driverId });
  if (!entry) return null;
  if (!entry.isActive) return entry;

  entry.isActive = false;
  await entry.save();

  await recordDriverAuditEvent({
    tenantId, actor, action: 'employment_history_deactivated', driverId,
    employmentHistoryId: entryId,
    oldValue: { isActive: true }, newValue: { isActive: false }, reason,
  });

  return entry;
}
