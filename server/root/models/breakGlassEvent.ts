// TASK-ROOT-SECURITY-05 — Break-glass access events.
//
// A time-boxed elevated-access grant: reason + ticket/incident + duration +
// scope required (per source brief §16 / ROOT-GAP-MATRIX.md #11 — "no
// time-boxed elevated-access mechanism exists anywhere"). `expiresAt` is
// computed once at creation time from `durationMinutes` and is the sole
// source of truth for whether the grant is still active — see
// `server/root/services/breakGlassService.ts`'s `isBreakGlassEventActive`,
// which re-checks this on every access, not a client-side timer.

import mongoose, { Schema, Document } from 'mongoose';

export type BreakGlassScope = 'platform' | 'tenant';

export interface IBreakGlassEvent extends Document {
  tenantId?: mongoose.Types.ObjectId; // required when scope === 'tenant'
  actorUserId: string;
  actorPlatformRole?: string;
  reason: string;
  ticketReference: string;
  scope: BreakGlassScope;
  durationMinutes: number;
  expiresAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  createdAt: Date;
}

const BreakGlassEventSchema = new Schema<IBreakGlassEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  actorUserId: { type: String, required: true },
  actorPlatformRole: { type: String, maxlength: 64 },
  reason: { type: String, required: true, maxlength: 1000 },
  ticketReference: { type: String, required: true, maxlength: 200 },
  scope: { type: String, enum: ['platform', 'tenant'], required: true },
  durationMinutes: { type: Number, required: true, min: 0.01, max: 480 },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  revokedBy: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Same `{tenantId, field}` convention as the rest of the codebase, plus a
// non-tenant-first index for the Security Command Center's cross-tenant
// "recent break-glass events" listing.
BreakGlassEventSchema.index({ tenantId: 1, createdAt: -1 });
BreakGlassEventSchema.index({ createdAt: -1 });
BreakGlassEventSchema.index({ expiresAt: 1 });
BreakGlassEventSchema.index({ actorUserId: 1, createdAt: -1 });

export const BreakGlassEvent = mongoose.model<IBreakGlassEvent>('BreakGlassEvent', BreakGlassEventSchema);
