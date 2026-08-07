import { storage } from '../../storage-mongodb';
import { telephonyProvider } from '../providers/registry';
import type { ICallSession } from '../../models';
import type { NormalizedTelephonyEvent } from '../types';

export type ActingUser = { userId: string; role: 'admin' | 'client' | 'manager' };

/** `public` here means "safe to return over HTTP", not "publicly
 * accessible" — this is what every telephony route response passes
 * through. No provider secret ever lives on CallSession, but this keeps
 * the shape stable/explicit regardless. */
export function publicCallSession(call: ICallSession) {
  return {
    id: call.id,
    tenantId: call.tenantId,
    direction: call.direction,
    status: call.status,
    userId: call.userId,
    assignedUserId: call.assignedUserId,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    virtualNumber: call.virtualNumber,
    providerKey: call.providerKey,
    providerCallId: call.providerCallId,
    customerId: call.customerId,
    inquiryId: call.inquiryId,
    leadId: call.leadId,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSeconds: call.durationSeconds,
    notes: call.notes,
    reassignmentHistory: call.reassignmentHistory,
    createdBy: call.createdBy,
    updatedBy: call.updatedBy,
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}

// ---------------------------------------------------------------------
// Real-time hand-off point. No WebSocket layer exists in this codebase yet
// (bootstrapping one into server/index.ts is reserved for the Integrator —
// see TASK-02-report.md's "Proposed WebSocket bootstrap + room design").
// Rather than block this module's own call-attribution/ownership logic on
// that, every place a room event *would* fire calls emitTelephonyEvent()
// below, which is a no-op until the Integrator wires a real emitter in via
// setTelephonyEventEmitter() — no edit to this module is required to
// activate it.
// ---------------------------------------------------------------------
export interface TelephonyEvent {
  type: 'call.ringing' | 'call.updated' | 'call.ended' | 'call.reassigned';
  tenantId: string;
  /** Room routing hint for the eventual WS layer: tenant:<tenantId>,
   * team:<tenantId> (manager/owner aggregation), user:<userId>,
   * call:<callSessionId> — see the room design in TASK-02-report.md. */
  targetUserId?: string;
  callSessionId: string;
  payload: unknown;
}
type TelephonyEventEmitter = (event: TelephonyEvent) => void;
let telephonyEventEmitter: TelephonyEventEmitter = () => {};
export function setTelephonyEventEmitter(fn: TelephonyEventEmitter) {
  telephonyEventEmitter = fn;
}
function emitTelephonyEvent(event: TelephonyEvent) {
  try {
    telephonyEventEmitter(event);
  } catch (error) {
    console.error('telephony event emitter threw:', error);
  }
}

// ---------------------------------------------------------------------
// Ownership-scoped reads. Role mapping (see TASK-02-report.md Context):
// admin -> cross-tenant bypass (existing scopeTenant() convention).
// client -> tenant owner: full tenant/team view, optionally filtered to
//           one executive.
// manager -> executive: own calls only, regardless of any filter param the
//           caller tries to pass — this is the hard isolation boundary
//           ("Ram cannot see Shyam's calls").
// ---------------------------------------------------------------------
export async function listCallSessionsForActor(
  actor: ActingUser,
  tenantId: string | undefined,
  filters: { executiveUserId?: string; status?: string } = {},
): Promise<ICallSession[]> {
  if (actor.role === 'manager') {
    if (!tenantId) return [];
    return storage.getCallSessionsForUser(tenantId, actor.userId, { status: filters.status });
  }
  // client (tenant owner) or admin acting within a tenant context.
  if (!tenantId) return [];
  return storage.getCallSessionsForTenant(tenantId, {
    executiveUserId: filters.executiveUserId,
    status: filters.status,
  });
}

/** Tenant-scoped single-record read — returns null (route turns this into
 * 404, never leaking a 403-vs-404 tenant-existence signal) for another
 * tenant's CallSession._id, and null for a manager reading a different
 * executive's call even within their own tenant. */
export async function getCallSessionForActor(
  actor: ActingUser,
  tenantId: string | undefined,
  callSessionId: string,
): Promise<ICallSession | null> {
  const call = await storage.getCallSessionById(callSessionId, actor.role === 'admin' ? tenantId : tenantId);
  if (!call) return null;
  if (actor.role === 'manager' && call.userId !== actor.userId.toLowerCase()) return null;
  return call;
}

export async function initiateOutboundCall(params: {
  actor: ActingUser;
  tenantId: string;
  toNumber: string;
  customerId?: string;
  inquiryId?: string;
  leadId?: string;
}): Promise<ICallSession> {
  const identity = await storage.getTelephonyIdentityForUser(params.tenantId, params.actor.userId);
  if (!identity) {
    throw new Error('No telephony identity is configured for this user yet.');
  }
  if (!identity.outgoingEnabled) {
    throw new Error('Outbound calling is disabled for this user\'s telephony identity.');
  }
  const fromNumber = identity.registeredNumber || identity.virtualNumber || '';
  const handle = await telephonyProvider.placeCall({
    tenantId: params.tenantId,
    fromProviderAgentId: identity.providerAgentId || identity.userId,
    fromNumber,
    toNumber: params.toNumber,
  });

  const call = await storage.createCallSessionRecord({
    tenantId: params.tenantId as any,
    direction: 'outbound',
    status: handle.status,
    // The caller's own identity is selected and stored as both creator and
    // current owner — this is "when Ram initiates a call, Ram's telephony
    // identity must be selected; Call Session must store Ram's userId".
    userId: params.actor.userId,
    assignedUserId: params.actor.userId,
    fromNumber,
    toNumber: params.toNumber,
    providerKey: telephonyProvider.providerKey,
    providerCallId: handle.providerCallId,
    providerAgentId: identity.providerAgentId,
    customerId: params.customerId as any,
    inquiryId: params.inquiryId as any,
    leadId: params.leadId as any,
    startedAt: new Date(),
    notes: [],
    reassignmentHistory: [],
    createdBy: { userId: params.actor.userId, role: params.actor.role },
    updatedBy: { userId: params.actor.userId, role: params.actor.role },
  } as Partial<ICallSession>);

  emitTelephonyEvent({
    type: 'call.ringing',
    tenantId: params.tenantId,
    targetUserId: params.actor.userId,
    callSessionId: call.id,
    payload: publicCallSession(call),
  });
  return call;
}

export interface CallUpdateInput {
  status?: ICallSession['status'];
  endedAt?: Date;
  durationSeconds?: number;
  note?: string;
}

/** Creator or a permitted manager/owner only — enforced by the route
 * (requirePermission + ownership check), not here. Never accepts/writes
 * userId/createdBy, so historical attribution can't be rewritten through
 * this path. */
export async function updateCallSession(
  actor: ActingUser,
  tenantId: string,
  callSessionId: string,
  input: CallUpdateInput,
): Promise<ICallSession | null> {
  const fieldUpdate: Partial<ICallSession> = {
    updatedBy: { userId: actor.userId, role: actor.role },
  };
  if (input.status) fieldUpdate.status = input.status;
  if (input.endedAt) fieldUpdate.endedAt = input.endedAt;
  if (typeof input.durationSeconds === 'number') fieldUpdate.durationSeconds = input.durationSeconds;

  let call = await storage.updateCallSessionFields(callSessionId, tenantId, fieldUpdate);
  if (!call) return null;

  if (input.note && input.note.trim()) {
    call = await storage.addCallSessionNote(callSessionId, tenantId, {
      text: input.note.trim(),
      createdBy: { userId: actor.userId, role: actor.role },
    });
  }
  if (call) {
    emitTelephonyEvent({
      type: input.status === 'completed' || input.status === 'failed' || input.status === 'missed' ? 'call.ended' : 'call.updated',
      tenantId,
      targetUserId: call.userId,
      callSessionId: call.id,
      payload: publicCallSession(call),
    });
  }
  return call;
}

export async function reassignCallSession(
  actor: ActingUser,
  tenantId: string,
  callSessionId: string,
  toUserId: string,
  reason?: string,
): Promise<ICallSession | null> {
  const call = await storage.reassignCallSession(callSessionId, tenantId, {
    toUserId,
    changedBy: { userId: actor.userId, role: actor.role },
    reason,
  });
  if (call) {
    emitTelephonyEvent({
      type: 'call.reassigned',
      tenantId,
      targetUserId: call.assignedUserId,
      callSessionId: call.id,
      payload: publicCallSession(call),
    });
  }
  return call;
}

/** Inbound webhook resolution: tenant + queue/virtual-number + routed
 * executive, with duplicate-event protection (the (tenantId,
 * providerCallId) unique index plus an explicit pre-check here). Signature
 * verification happens in the route before this is ever called — this
 * function trusts its input. */
export async function resolveInboundEvent(event: NormalizedTelephonyEvent): Promise<ICallSession | null> {
  if (!event.virtualNumber) {
    console.warn('Inbound telephony event with no virtualNumber — cannot resolve tenant/executive.', event.providerCallId);
    return null;
  }
  const identity = await storage.getTelephonyIdentityByVirtualNumber(event.virtualNumber);
  if (!identity) {
    console.warn(`Inbound telephony event on unrecognized virtual number ${event.virtualNumber}.`);
    return null;
  }
  const tenantId = String(identity.tenantId);

  const existing = await storage.findCallSessionByProviderCallId(tenantId, event.providerCallId);
  if (existing) {
    // Duplicate delivery of the same provider event — update in place
    // instead of creating a second popup/record.
    return storage.updateCallSessionFields(existing.id, tenantId, {
      status: event.status,
      durationSeconds: event.durationSeconds,
      updatedBy: { userId: 'system', role: 'admin' },
    } as Partial<ICallSession>);
  }

  const call = await storage.createCallSessionRecord({
    tenantId: tenantId as any,
    direction: 'inbound',
    status: event.status,
    userId: identity.userId,
    assignedUserId: identity.userId,
    fromNumber: event.fromNumber,
    toNumber: event.toNumber,
    virtualNumber: event.virtualNumber,
    providerKey: telephonyProvider.providerKey,
    providerCallId: event.providerCallId,
    providerAgentId: event.providerAgentId,
    startedAt: event.occurredAt,
    notes: [],
    reassignmentHistory: [],
    createdBy: { userId: 'system', role: 'admin' },
    updatedBy: { userId: 'system', role: 'admin' },
  } as Partial<ICallSession>);

  // Screen-pop goes to exactly the routed executive's user channel — not
  // broadcast tenant-wide (spec: "Do not broadcast every incoming customer
  // popup to every executive unless the configured queue explicitly
  // requires it"). Manager/owner aggregation visibility is a separate
  // team:<tenantId> emit the WS layer can add without this module's
  // knowledge, per the room design in TASK-02-report.md.
  emitTelephonyEvent({
    type: 'call.ringing',
    tenantId,
    targetUserId: identity.userId,
    callSessionId: call.id,
    payload: publicCallSession(call),
  });
  return call;
}
