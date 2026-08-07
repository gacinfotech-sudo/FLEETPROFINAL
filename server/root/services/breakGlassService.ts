// TASK-ROOT-SECURITY-05 — Break-glass access service.
//
// Real, testable expiry: `expiresAt` is computed once at creation time
// (`Date.now() + durationMinutes * 60_000`) and every access check compares
// it against the current wall-clock time. There is no separate "is this
// still valid" flag that a caller could leave stale — `isBreakGlassEventActive`
// is the only source of truth, and it's re-evaluated on every call, not
// cached. This is what makes the expiry provable by a real short-duration
// test rather than "a timestamp field exists but isn't enforced" (the
// acceptance criterion this task must not fail).

import { BreakGlassEvent, IBreakGlassEvent, BreakGlassScope } from '../models/breakGlassEvent';
import { recordPlatformAuditEvent } from '../models/auditLog';

export interface CreateBreakGlassEventParams {
  actorUserId: string;
  actorPlatformRole?: string;
  reason: string;
  ticketReference: string;
  scope: BreakGlassScope;
  tenantId?: string; // required when scope === 'tenant'
  durationMinutes: number;
  correlationId?: string;
}

export class BreakGlassValidationError extends Error {}

export async function createBreakGlassEvent(params: CreateBreakGlassEventParams): Promise<IBreakGlassEvent> {
  const reason = (params.reason ?? '').trim();
  const ticketReference = (params.ticketReference ?? '').trim();

  if (!reason) throw new BreakGlassValidationError('reason is required');
  if (!ticketReference) throw new BreakGlassValidationError('ticketReference is required');
  if (!params.actorUserId) throw new BreakGlassValidationError('actorUserId is required');
  if (params.scope !== 'platform' && params.scope !== 'tenant') {
    throw new BreakGlassValidationError('scope must be "platform" or "tenant"');
  }
  if (params.scope === 'tenant' && !params.tenantId) {
    throw new BreakGlassValidationError('tenantId is required when scope is "tenant"');
  }
  if (!(params.durationMinutes > 0) || params.durationMinutes > 480) {
    throw new BreakGlassValidationError('durationMinutes must be > 0 and <= 480 (8 hours)');
  }

  const expiresAt = new Date(Date.now() + params.durationMinutes * 60_000);

  const event = await BreakGlassEvent.create({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorPlatformRole: params.actorPlatformRole,
    reason,
    ticketReference,
    scope: params.scope,
    durationMinutes: params.durationMinutes,
    expiresAt,
  });

  await recordPlatformAuditEvent({
    userId: params.actorUserId,
    actorPlatformRole: params.actorPlatformRole,
    action: 'break_glass.create',
    tenantId: params.tenantId,
    targetTenantId: params.tenantId,
    targetEntity: `BreakGlassEvent:${event.id}`,
    reason,
    correlationId: params.correlationId,
    newValue: {
      scope: params.scope,
      ticketReference,
      durationMinutes: params.durationMinutes,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return event;
}

/** The sole source of truth for whether a break-glass grant is still usable:
 * not revoked, and `expiresAt` still in the future at the moment of the call. */
export function isBreakGlassEventActive(event: Pick<IBreakGlassEvent, 'expiresAt' | 'revokedAt'>, now: Date = new Date()): boolean {
  if (event.revokedAt) return false;
  return event.expiresAt.getTime() > now.getTime();
}

/** Re-fetches the event from the database (never trusts an in-memory copy
 * that might be stale) and returns it only if still active; throws otherwise
 * so callers can 403 without duplicating the active-check logic. */
export async function requireActiveBreakGlassEvent(eventId: string): Promise<IBreakGlassEvent> {
  const event = await BreakGlassEvent.findById(eventId);
  if (!event) {
    throw new Error('Break-glass event not found');
  }
  if (!isBreakGlassEventActive(event)) {
    throw new Error('Break-glass access has expired or been revoked');
  }
  return event;
}

export async function revokeBreakGlassEvent(eventId: string, revokedBy: string, revokedByPlatformRole?: string): Promise<IBreakGlassEvent> {
  const event = await BreakGlassEvent.findById(eventId);
  if (!event) {
    throw new Error('Break-glass event not found');
  }
  if (!event.revokedAt) {
    event.revokedAt = new Date();
    event.revokedBy = revokedBy;
    await event.save();
  }

  await recordPlatformAuditEvent({
    userId: revokedBy,
    actorPlatformRole: revokedByPlatformRole,
    action: 'break_glass.revoke',
    tenantId: event.tenantId?.toString(),
    targetTenantId: event.tenantId?.toString(),
    targetEntity: `BreakGlassEvent:${event.id}`,
    reason: 'Manual revocation',
  });

  return event;
}

export async function listRecentBreakGlassEvents(limit = 50): Promise<IBreakGlassEvent[]> {
  return BreakGlassEvent.find().sort({ createdAt: -1 }).limit(limit);
}
