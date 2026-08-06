import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { TELEPHONY_PERMISSIONS } from '../permissions';
import {
  getCallSessionForActor,
  initiateOutboundCall,
  listCallSessionsForActor,
  publicCallSession,
  reassignCallSession,
  updateCallSession,
  type ActingUser,
} from '../services/callService';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function actingUser(req: AuthRequest): ActingUser {
  return { userId: req.userId!, role: (req.user?.role || 'manager') as ActingUser['role'] };
}

/** Admin bypasses tenant scoping like everywhere else in this codebase
 * (scopeTenant() in server/routes.ts); everyone else must have a tenant. */
function resolveTenantId(req: AuthRequest): string | undefined {
  if (req.user?.role === 'admin') {
    const queryTenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    return queryTenantId || req.tenantId;
  }
  return req.tenantId;
}

const initiateCallSchema = z.object({
  toNumber: z.string().trim().min(3).max(32),
  customerId: z.string().optional(),
  inquiryId: z.string().optional(),
  leadId: z.string().optional(),
}).strict();

const updateCallSchema = z.object({
  status: z.enum(['ringing', 'in_progress', 'completed', 'failed', 'missed', 'no_answer', 'cancelled']).optional(),
  endedAt: z.string().optional(),
  durationSeconds: z.number().min(0).optional(),
  note: z.string().max(5000).optional(),
  // Reassignment is a distinct, owner/admin-only action folded into the
  // same PATCH endpoint per the "Expected APIs" list in TASK-02.md (a
  // dedicated /reassign sub-route is additive and can be added later
  // without breaking this shape).
  assignedUserId: z.string().optional(),
  reassignReason: z.string().max(500).optional(),
}).strict();

const listQuerySchema = z.object({
  userId: z.string().optional(),
  status: z.string().optional(),
}).strict();

function validationMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join('; ');
}

export function registerTelephonyCallRoutes(app: Express): void {
  app.post(
    '/api/telephony/calls',
    authenticateUser,
    requireTenant,
    requirePermission(TELEPHONY_PERMISSIONS.CALL_INITIATE),
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(403).json({ message: 'Tenant context is required.' });
      try {
        const input = initiateCallSchema.parse(req.body);
        for (const idField of ['customerId', 'inquiryId', 'leadId'] as const) {
          const value = input[idField];
          if (value && !mongoose.isValidObjectId(value)) {
            return res.status(400).json({ message: `Invalid ${idField}.` });
          }
        }
        const call = await initiateOutboundCall({
          actor: actingUser(req),
          tenantId,
          toNumber: input.toNumber,
          customerId: input.customerId,
          inquiryId: input.inquiryId,
          leadId: input.leadId,
        });
        res.status(201).json(publicCallSession(call));
      } catch (error: any) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
        console.error('Initiate call error:', error?.message || error);
        res.status(400).json({ message: error?.message || 'Failed to initiate call.' });
      }
    }),
  );

  app.get(
    '/api/telephony/calls',
    authenticateUser,
    requireTenant,
    requirePermission(TELEPHONY_PERMISSIONS.CALL_VIEW_OWN),
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(403).json({ message: 'Tenant context is required.' });
      try {
        const query = listQuerySchema.parse(req.query);
        const actor = actingUser(req);
        // Executives can never override this with a userId query param —
        // listCallSessionsForActor ignores executiveUserId entirely when
        // actor.role === 'manager' (see callService.ts).
        const calls = await listCallSessionsForActor(actor, tenantId, {
          executiveUserId: query.userId,
          status: query.status,
        });
        res.json(calls.map(publicCallSession));
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
        throw error;
      }
    }),
  );

  app.get(
    '/api/telephony/calls/:id',
    authenticateUser,
    requireTenant,
    requirePermission(TELEPHONY_PERMISSIONS.CALL_VIEW_OWN),
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Call not found.' });
      const call = await getCallSessionForActor(actingUser(req), tenantId, req.params.id);
      if (!call) return res.status(404).json({ message: 'Call not found.' });
      res.json(publicCallSession(call));
    }),
  );

  app.patch(
    '/api/telephony/calls/:id',
    authenticateUser,
    requireTenant,
    requirePermission(TELEPHONY_PERMISSIONS.CALL_MANAGE),
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(403).json({ message: 'Tenant context is required.' });
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Call not found.' });
      const actor = actingUser(req);

      // Creator or a permitted manager/owner only (spec: "update/end a
      // call session (creator or permitted manager only)"). An executive
      // (role=manager) may only ever act on their own call —
      // getCallSessionForActor already returns null for a different
      // executive's call when actor.role === 'manager', which is exactly
      // "Shyam must not receive or control Ram's active call".
      const existing = await getCallSessionForActor(actor, tenantId, req.params.id);
      if (!existing) return res.status(404).json({ message: 'Call not found.' });

      try {
        const input = updateCallSchema.parse(req.body);

        if (input.assignedUserId) {
          // Reassignment is an owner/admin action, not something an
          // executive does to their own call.
          if (actor.role === 'manager') {
            return res.status(403).json({ message: 'Only a tenant owner or admin may reassign a call.' });
          }
          const reassigned = await reassignCallSession(actor, tenantId, req.params.id, input.assignedUserId, input.reassignReason);
          if (!reassigned) return res.status(404).json({ message: 'Call not found.' });
          return res.json(publicCallSession(reassigned));
        }

        const updated = await updateCallSession(actor, tenantId, req.params.id, {
          status: input.status,
          endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
          durationSeconds: input.durationSeconds,
          note: input.note,
        });
        if (!updated) return res.status(404).json({ message: 'Call not found.' });
        res.json(publicCallSession(updated));
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
        throw error;
      }
    }),
  );
}
