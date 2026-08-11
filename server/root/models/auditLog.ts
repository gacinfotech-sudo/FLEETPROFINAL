// TASK-ROOT-SECURITY-05 — Platform Audit Log.
//
// Generalizes `GpsAuditLog`'s proven shape (`server/gps/models/gpsConnection.ts`,
// `{tenantId, userId, action, oldValue, newValue, reason, createdAt}`) into the
// canonical cross-module Root audit-event sink, per
// `docs/root-control-plane/CURRENT-SUPER-ADMIN-AUDIT.md` §8 and
// `ROOT-GAP-MATRIX.md` #17. Every Wave-1 task's `recordAuditEvent` call is
// expected to eventually write through this model (directly, or via
// `RootAccessService.recordAuditEvent` once TASK-ROOT-DOMAIN-01's real
// implementation delegates to it — see this task's report for the proposed
// coordination).
//
// Field-by-field relationship to GpsAuditLog's base shape:
//   tenantId    -> KEPT, now optional (some Root actions, e.g. a root login,
//                  aren't scoped to a single tenant at all).
//   userId      -> KEPT as the actor's userId, for shape parity with GpsAuditLog.
//   action      -> KEPT.
//   oldValue    -> KEPT.
//   newValue    -> KEPT. NEVER put a raw secret/PII value in here — see the
//                  explicit note on `recordPlatformAuditEvent` below.
//   reason      -> KEPT.
//   createdAt   -> KEPT.
//   actorPlatformRole -> NEW (source brief §23's exact field list).
//   targetTenantId    -> NEW. The tenant whose data/resource was the *target*
//                  of the action, which can differ conceptually from `tenantId`
//                  once Root cross-tenant actions are common; kept as a
//                  separate field rather than overloading `tenantId` so a
//                  query for "everything that happened to tenant X" and
//                  "everything actor Y did while scoped to tenant X" don't
//                  silently collide.
//   targetEntity      -> NEW, e.g. "Customer:<id>", "BreakGlassEvent:<id>".
//   correlationId     -> NEW, for cross-request tracing (pairs with
//                  TASK-ROOT-SUPPORT-03's proposed correlation-ID middleware).

import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformAuditEvent extends Document {
  tenantId?: mongoose.Types.ObjectId;
  userId: string;
  actorPlatformRole?: string;
  action: string;
  targetTenantId?: mongoose.Types.ObjectId;
  targetEntity?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  correlationId?: string;
  createdAt: Date;
}

const PlatformAuditEventSchema = new Schema<IPlatformAuditEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  userId: { type: String, required: true },
  actorPlatformRole: { type: String, maxlength: 64 },
  action: { type: String, required: true, maxlength: 100 },
  targetTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  targetEntity: { type: String, maxlength: 200 },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, maxlength: 1000 },
  correlationId: { type: String, maxlength: 100 },
  createdAt: { type: Date, default: Date.now },
});

// Same `{tenantId, ...}`-first convention as GpsAuditLog and the rest of the
// codebase (per CURRENT-SUPER-ADMIN-AUDIT.md §12), plus new non-tenant-first
// indexes for cross-tenant Root audit review — a genuinely new indexing need
// this codebase's existing tenant-first convention doesn't cover on its own.
PlatformAuditEventSchema.index({ tenantId: 1, createdAt: -1 });
PlatformAuditEventSchema.index({ targetTenantId: 1, createdAt: -1 });
PlatformAuditEventSchema.index({ createdAt: -1 });
PlatformAuditEventSchema.index({ actorPlatformRole: 1, createdAt: -1 });
PlatformAuditEventSchema.index({ action: 1, createdAt: -1 });
PlatformAuditEventSchema.index({ correlationId: 1 });

export const PlatformAuditEventModel = mongoose.model<IPlatformAuditEvent>(
  'PlatformAuditEvent',
  PlatformAuditEventSchema,
);

// The contract shape other Wave-1 tasks' `RootAccessService.recordAuditEvent`
// callers code against (per `ROOT-CONTROL-PLANE-MANIFEST.md`). Intentionally
// a plain data shape, not `IPlatformAuditEvent`, so callers never need to
// import Mongoose Document typing just to log an event.
export interface PlatformAuditEvent {
  tenantId?: string;
  userId: string;
  actorPlatformRole?: string;
  action: string;
  targetTenantId?: string;
  targetEntity?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  correlationId?: string;
}

/**
 * The canonical, directly-owned audit-write function for this task (per
 * TASK-ROOT-SECURITY-05's brief: "you own the real PlatformAuditEvent/
 * audit-log model in this task, so coordinate the final shape, don't just
 * consume a stub forever"). Every Root read/write of sensitive data in this
 * task's own routes calls through here.
 *
 * SECURITY NOTE: never pass a raw secret/PII value as `oldValue`/`newValue`.
 * The audit log is itself a Root-readable surface — logging the very value a
 * masking/unmask control exists to protect would recreate the leak the
 * control is meant to close. Callers should log *that* a field was
 * unmasked/changed (e.g. `{ field: 'phone' }`), never the value itself,
 * except for genuinely non-sensitive config fields.
 */
export async function recordPlatformAuditEvent(event: PlatformAuditEvent): Promise<void> {
  if (!event.userId) {
    throw new Error('recordPlatformAuditEvent requires userId (the acting user)');
  }
  if (!event.action) {
    throw new Error('recordPlatformAuditEvent requires action');
  }

  await PlatformAuditEventModel.create({
    tenantId: event.tenantId ? new mongoose.Types.ObjectId(event.tenantId) : undefined,
    userId: event.userId,
    actorPlatformRole: event.actorPlatformRole,
    action: event.action,
    targetTenantId: event.targetTenantId ? new mongoose.Types.ObjectId(event.targetTenantId) : undefined,
    targetEntity: event.targetEntity,
    oldValue: event.oldValue,
    newValue: event.newValue,
    reason: event.reason,
    correlationId: event.correlationId,
  });
}
