import type { Express, NextFunction, Response } from 'express';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/permissions';
import { TELEPHONY_PERMISSIONS } from '../permissions';
import { getTelephonyIdentity, publicTelephonyIdentity, upsertTelephonyIdentity } from '../services/identityService';

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function resolveTenantId(req: AuthRequest): string | undefined {
  if (req.user?.role === 'admin') {
    const queryTenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    return queryTenantId || req.tenantId;
  }
  return req.tenantId;
}

const writeIdentitySchema = z.object({
  providerKey: z.string().trim().toLowerCase().max(64).optional(),
  providerAgentId: z.string().trim().max(200).optional(),
  registeredNumber: z.string().trim().max(32).optional(),
  virtualNumber: z.string().trim().max(32).optional(),
  extension: z.string().trim().max(16).optional(),
  incomingEnabled: z.boolean().optional(),
  outgoingEnabled: z.boolean().optional(),
  status: z.enum(['available', 'busy', 'wrap_up', 'offline', 'disabled']).optional(),
  // Plaintext in the request body only — encrypted before persistence by
  // identityService.upsertTelephonyIdentity(), never stored or echoed back.
  credentials: z.record(z.string(), z.unknown()).optional(),
}).strict();

function validationMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join('; ');
}

export function registerTelephonyIdentityRoutes(app: Express): void {
  app.get(
    '/api/telephony/identities/:userId',
    authenticateUser,
    requireTenant,
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(403).json({ message: 'Tenant context is required.' });
      const targetUserId = req.params.userId.toLowerCase();
      const isSelf = req.userId?.toLowerCase() === targetUserId;
      const isOwnerOrAdmin = req.user?.role === 'client' || req.user?.role === 'admin';
      // An executive may always read their own telephony identity (to know
      // their own extension/status); reading anyone else's requires the
      // tenant-owner/admin role, mirroring "Executive: own assigned work...
      // restricted company... configuration access" from the spec.
      if (!isSelf && !isOwnerOrAdmin) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      const identity = await getTelephonyIdentity(tenantId, targetUserId);
      if (!identity) return res.status(404).json({ message: 'Telephony identity not found.' });
      res.json(publicTelephonyIdentity(identity));
    }),
  );

  app.put(
    '/api/telephony/identities/:userId',
    authenticateUser,
    requireTenant,
    requirePermission(TELEPHONY_PERMISSIONS.TELEPHONY_IDENTITY_MANAGE),
    safeAsync(async (req, res) => {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(403).json({ message: 'Tenant context is required.' });
      // Hard rule regardless of permissions array contents: "never expose
      // provider secrets... owner/admin only to write."
      if (req.user?.role !== 'client' && req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Only a tenant owner or admin may manage telephony identities.' });
      }
      try {
        const input = writeIdentitySchema.parse(req.body);
        const identity = await upsertTelephonyIdentity(tenantId, req.params.userId, input, req.userId!);
        res.json(publicTelephonyIdentity(identity));
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
        throw error;
      }
    }),
  );
}
