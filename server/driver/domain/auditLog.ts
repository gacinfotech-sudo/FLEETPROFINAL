// TASK-DRIVER-DOMAIN-02 — revision history writer. Mirrors
// server/gps/services/connectionService.ts's writeGpsConnectionAudit
// exactly (read-only reference, not modified). Every lifecycle-stage
// transition, status-relevant change, and contact/employment-history
// verification-status change made through this module's services goes
// through here — never a hard delete, always an audit trail entry.
import { DriverAuditLog } from './models';
import type { ActorRef } from './types';

export interface DriverAuditEvent {
  tenantId: string;
  actor: ActorRef;
  action: string;
  driverId: string;
  contactId?: string;
  employmentHistoryId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}

export async function recordDriverAuditEvent(event: DriverAuditEvent): Promise<void> {
  await DriverAuditLog.create({
    tenantId: event.tenantId,
    userId: event.actor.userId,
    action: event.action,
    driverId: event.driverId,
    contactId: event.contactId,
    employmentHistoryId: event.employmentHistoryId,
    oldValue: event.oldValue,
    newValue: event.newValue,
    reason: event.reason,
  });
}
