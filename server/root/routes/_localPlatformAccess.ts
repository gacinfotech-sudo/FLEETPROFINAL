// PLACEHOLDER — TASK-ROOT-SALES-CONFIG-04
//
// Not part of this task's originally-listed owned files, but required to
// satisfy ROOT-CONTROL-PLANE-MANIFEST.md's dependency contract:
//
//   "If your worktree doesn't have server/root/types.ts present (it won't,
//   until integration), define a local placeholder type file matching the
//   contract above exactly so you can typecheck and test in isolation —
//   flag this explicitly in your report so the Integrator knows to delete
//   the placeholder and repoint imports at the real one."
//
// TASK-ROOT-DOMAIN-01 owns the real `server/root/types.ts` (PlatformRole,
// UserPlatformFields) and `server/root/services/rootAccessService.ts`
// (RootAccessService, including the real recordAuditEvent backed by
// TASK-ROOT-SECURITY-05's audit log model). Neither exists in this worktree
// yet, and this task must not create files at those exact paths (they are
// listed "forbidden to modify" — reserved for DOMAIN-01/SECURITY-05).
//
// INTEGRATOR: once DOMAIN-01 + SECURITY-05 are merged, delete this file,
// delete the `RootSalesConfigPlaceholderAuditEvent` collection usage below,
// and repoint sales.ts / config.ts / features.ts imports at:
//   - `PlatformRole` from '../types'
//   - `requirePlatformRole` / `recordAuditEvent` from
//     '../services/rootAccessService' (the real RootAccessService instance)

import type { NextFunction, Response } from 'express';
import mongoose, { Schema, Document } from 'mongoose';
import type { AuthRequest } from '../../middleware/auth';

// Mirrors ROOT-CONTROL-PLANE-MANIFEST.md's documented `PlatformRole` union
// exactly.
export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

// Mirrors the shape RootAccessService.recordAuditEvent's caller-side
// contract implies (PlatformAuditEvent), generalizing GpsAuditLog's proven
// {tenantId, userId, action, oldValue, newValue, reason, createdAt} shape
// per CURRENT-SUPER-ADMIN-AUDIT.md §8.
export interface PlatformAuditEvent {
  actorUserId: string;
  actorRole?: string;
  action: string;
  tenantId?: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

/**
 * Local stand-in for RootAccessService.requirePlatformRole(allowed).
 * Same signature/behavior contract: 403 if the session has no recognized
 * platform role (this includes every session today, since `platformRole`
 * doesn't exist on any real user until DOMAIN-01's migration runs — a
 * plain tenant-scoped 'client'/'manager'/'admin' session is correctly
 * rejected here, which is exactly this task's tenant-isolation acceptance
 * criterion).
 */
export function requirePlatformRole(allowed: PlatformRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = (req.user as any)?.platformRole as PlatformRole | undefined;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: 'Platform access required' });
    }
    next();
  };
}

// --- Local audit-event fallback --------------------------------------------
// Real destination: TASK-ROOT-SECURITY-05's server/root/models/auditLog.ts
// via RootAccessService.recordAuditEvent. Until both that model and
// DOMAIN-01's service exist in this lineage, this task still needs a real,
// queryable record of every Prospect/Plan/FeatureFlag change so its own
// audit acceptance test isn't just a console.log — this collection is a
// deliberately narrowly-named ledger used only by this task's own routes,
// and is safe to delete once the real service is wired in.
interface IPlaceholderAuditEvent extends Document {
  actorUserId: string;
  actorRole?: string;
  action: string;
  tenantId?: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  createdAt: Date;
}

const PlaceholderAuditEventSchema = new Schema<IPlaceholderAuditEvent>({
  actorUserId: { type: String, required: true },
  actorRole: { type: String },
  action: { type: String, required: true, maxlength: 200 },
  tenantId: { type: String },
  targetType: { type: String, maxlength: 100 },
  targetId: { type: String, maxlength: 200 },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});
PlaceholderAuditEventSchema.index({ tenantId: 1, createdAt: -1 });
PlaceholderAuditEventSchema.index({ action: 1, createdAt: -1 });

export const PlaceholderAuditEvent =
  mongoose.models.RootSalesConfigPlaceholderAuditEvent ||
  mongoose.model<IPlaceholderAuditEvent>(
    'RootSalesConfigPlaceholderAuditEvent',
    PlaceholderAuditEventSchema,
  );

export async function recordAuditEvent(event: PlatformAuditEvent): Promise<void> {
  await PlaceholderAuditEvent.create(event);
}
