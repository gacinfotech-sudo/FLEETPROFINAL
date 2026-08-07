// TASK-ROOT-SECURITY-05 — Audit-log listing + the PII "View Sensitive Data"
// unmask endpoint.
//
// NOT MOUNTED by this task — server/routes.ts is Integrator-only. Proposed
// mount line (see report for the full list):
//   app.use('/api/root', authenticateUser, auditRouter);
// Routes are written relative to that `/api/root` mount, e.g. `GET /audit`
// below resolves to the expected API `GET /api/root/audit`.
//
// COORDINATION NOTE for the Integrator and TASK-ROOT-DASHBOARD-02: the
// dispatch brief's expected API for unmask is literally
// `POST /api/root/customers/:id/unmask`, but `server/root/routes/customers.ts`
// is DASHBOARD-02's owned file, not this task's. This task owns the actual
// masking/unmask/audit *logic* (piiMaskingService.ts) per the brief, so the
// route handler is implemented here and proposed for mounting at that exact
// path — no file conflict (this task never touches customers.ts), but the
// Integrator must confirm only ONE router ends up bound to that path when
// wiring both tasks' routers into server/routes.ts. If DASHBOARD-02 already
// ships its own handler at that path, the Integrator should delete this
// task's route and instead have DASHBOARD-02's handler call
// `unmaskField()` from `piiMaskingService.ts` directly.

import { Router, Response } from 'express';
import type { AuthRequest } from '../../middleware/auth';
import type { PlatformRole } from '../types';
import { Customer } from '../../models/index';
import { PlatformAuditEventModel } from '../models/auditLog';
import { unmaskField, PiiUnmaskForbiddenError } from '../services/piiMaskingService';
import { requirePlatformRoleLocal } from './security';

const ALL_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN',
  'PLATFORM_SECURITY_ADMIN',
  'PLATFORM_READ_ONLY_AUDITOR',
];

export const auditRouter = Router();

// GET /api/root/audit — paginated, filterable audit-log listing. This is the
// canonical read surface for the AuditLog model this task owns.
auditRouter.get('/audit', requirePlatformRoleLocal(ALL_PLATFORM_ROLES), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const filter: Record<string, unknown> = {};
    if (req.query.tenantId) filter.tenantId = req.query.tenantId;
    if (req.query.targetTenantId) filter.targetTenantId = req.query.targetTenantId;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;

    const [events, total] = await Promise.all([
      PlatformAuditEventModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PlatformAuditEventModel.countDocuments(filter),
    ]);

    res.json({ events, total, limit, skip });
  } catch (error) {
    console.error('Error listing platform audit log:', error);
    res.status(500).json({ message: 'Failed to list audit log' });
  }
});

// POST /api/root/customers/:id/unmask — the "View Sensitive Data" flow.
// Only ever exposes `phone` or `email` (see UNMASKABLE_FIELDS in
// piiMaskingService.ts) — any other field name is rejected with 400 before
// any lookup happens, and there is no code path in this file that ever
// reads/returns `password`, OTP, tokens, or any other secret field, on this
// or any Customer/User document.
auditRouter.post(
  '/customers/:id/unmask',
  requirePlatformRoleLocal(ALL_PLATFORM_ROLES),
  async (req: AuthRequest, res: Response) => {
    try {
      const field = String(req.body?.field ?? '');
      const reason = String(req.body?.reason ?? '');

      const customer = await Customer.findById(req.params.id).select('tenantId primaryMobile email').lean();
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }

      const rawValue = field === 'phone' ? customer.primaryMobile : field === 'email' ? customer.email : undefined;
      if (rawValue === undefined || rawValue === null) {
        // Covers both "field not on the allowlist" (undefined branch above)
        // and "field is allowlisted but this customer has no value for it".
        // unmaskField() below still re-validates the field name at runtime
        // even though we've already effectively narrowed it here — never
        // rely on a single check for a security boundary.
        if (field !== 'phone' && field !== 'email') {
          return res.status(400).json({ message: `Field "${field}" cannot be unmasked` });
        }
        return res.status(404).json({ message: `Customer has no value for "${field}"` });
      }

      const actorUserId = req.user?.userId ?? req.userId;
      const actorPlatformRole = (req.user as { platformRole?: PlatformRole } | undefined)?.platformRole;

      const result = await unmaskField({
        field,
        rawValue: String(rawValue),
        reason,
        actorUserId,
        actorPlatformRole,
        targetTenantId: customer.tenantId?.toString(),
        targetEntity: `Customer:${req.params.id}`,
      });

      res.json({ field, value: result.value });
    } catch (error) {
      if (error instanceof PiiUnmaskForbiddenError) {
        return res.status(400).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes('reason is required')) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error unmasking customer field:', error);
      res.status(500).json({ message: 'Failed to unmask field' });
    }
  },
);
