// TASK-DRIVER-DOMAIN-02 — read-side of the revision history collection.
// Kept separate from auditLog.ts (the write-side) so services that only
// need to record events don't pull in a query surface, and vice versa.
import { DriverAuditLog, type IDriverAuditLog } from './models';

export async function listDriverAuditLog(params: { tenantId: string; driverId: string; limit?: number }): Promise<IDriverAuditLog[]> {
  const { tenantId, driverId, limit = 100 } = params;
  return DriverAuditLog.find({ tenantId, driverId }).sort({ createdAt: -1 }).limit(limit).lean() as any;
}
