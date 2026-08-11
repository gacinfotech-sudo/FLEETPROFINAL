// TASK-ROOT-DASHBOARD-02 — Tenant Master Database + Tenant 360°.
//
// GET /api/root/tenants                    — paginated/searchable tenant list
// GET /api/root/tenants/:tenantId           — Tenant 360 Overview (summary + counts)
// GET /api/root/tenants/:tenantId/tabs/:tab — on-demand per-tab detail, paginated,
//   never preloaded (§44 of the source brief). `tab` is one of the data tabs
//   whose data already exists per docs/root-control-plane/CURRENT-SUPER-ADMIN-AUDIT.md:
//   users, customers, bookings, drivers, vehicles, vendors, payments,
//   invoices, inquiries, leads, gps, telephony, whatsapp, subscription, usage.
//   ERRORS/SUPPORT/SECURITY/AUDIT LOG and CONFIGURATION/FEATURES tabs are
//   NOT handled here — they are stubs on the frontend only, pointing at
//   where TASK-ROOT-SUPPORT-03 / TASK-ROOT-SECURITY-05 / TASK-ROOT-SALES-CONFIG-04's
//   real UI will mount; this route deliberately returns 404 for those tab
//   names rather than faking data for another task's domain.
//
// Not mounted here — see this task's report for the exact
// `registerRootTenantRoutes(app)` mount line for server/routes.ts
// (Integrator-only).

import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { localRootAccessService } from '../services/localRootAccessService';
import {
  Tenant, User, Booking, Customer, Driver, Vehicle, Vendor,
  PaymentTransaction, Invoice, Inquiry, Lead, WhatsAppMessage,
  TelephonyIdentity, CallSession,
} from '../../models/index';
import { GpsConnection } from '../../gps/models/gpsConnection';
import { GpsDevice } from '../../gps/models/gpsDevice';
import type { PlatformRole } from '../types';

const ALL_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN', 'PLATFORM_SECURITY_ADMIN', 'PLATFORM_READ_ONLY_AUDITOR',
];

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function paginationOf(req: AuthRequest) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10) || 25));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function paginated<T>(model: any, query: Record<string, unknown>, req: AuthRequest, sort: Record<string, 1 | -1> = { createdAt: -1 }) {
  const { page, pageSize, skip } = paginationOf(req);
  const [rows, total] = await Promise.all([
    model.find(query).sort(sort).skip(skip).limit(pageSize).lean(),
    model.countDocuments(query),
  ]);
  return { rows, total, page, pageSize };
}

export function registerRootTenantRoutes(app: Express): void {
  const requireRole = localRootAccessService.requirePlatformRole(ALL_PLATFORM_ROLES);

  app.get('/api/root/tenants', authenticateUser, requireRole, safeAsync(async (req, res) => {
    const { page, pageSize } = paginationOf(req);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await localRootAccessService.listTenants({
      search, status: status as any, page, pageSize,
    });
    res.json(result);
  }));

  app.get('/api/root/tenants/:tenantId', authenticateUser, requireRole, safeAsync(async (req, res) => {
    const { tenantId } = req.params;
    const tenant360 = await localRootAccessService.getTenant360(tenantId);
    if (!tenant360) return res.status(404).json({ message: 'Tenant not found' });
    await localRootAccessService.recordAuditEvent({
      actorUserId: req.user?.userId ?? 'unknown',
      actorPlatformRole: (req.user as any)?.platformRole,
      action: 'root.tenant360.view',
      targetType: 'Tenant',
      targetId: tenantId,
    });
    res.json(tenant360);
  }));

  app.get('/api/root/tenants/:tenantId/tabs/:tab', authenticateUser, requireRole, safeAsync(async (req, res) => {
    const { tenantId, tab } = req.params;
    if (!mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({ message: 'Invalid tenantId' });
    }
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    await localRootAccessService.recordAuditEvent({
      actorUserId: req.user?.userId ?? 'unknown',
      actorPlatformRole: (req.user as any)?.platformRole,
      action: 'root.tenant360.tab.view',
      targetType: 'Tenant',
      targetId: tenantId,
      metadata: { tab },
    });

    switch (tab) {
      case 'users':
        return res.json(await paginated(User, { tenantId }, req));
      case 'customers':
        return res.json(await paginated(Customer, { tenantId }, req));
      case 'bookings':
        return res.json(await paginated(Booking, { tenantId }, req));
      case 'drivers':
        return res.json(await paginated(Driver, { tenantId }, req));
      case 'vehicles':
        return res.json(await paginated(Vehicle, { tenantId }, req));
      case 'vendors':
        return res.json(await paginated(Vendor, { tenantId }, req));
      case 'payments':
        return res.json(await paginated(PaymentTransaction, { tenantId }, req, { receivedAt: -1 }));
      case 'invoices':
        return res.json(await paginated(Invoice, { tenantId }, req, { invoiceDate: -1 }));
      case 'inquiries':
        return res.json(await paginated(Inquiry, { tenantId }, req));
      case 'leads':
        return res.json(await paginated(Lead, { tenantId }, req));
      case 'gps': {
        const [connections, deviceCount] = await Promise.all([
          GpsConnection.find({ tenantId }).lean(),
          GpsDevice.countDocuments({ tenantId }),
        ]);
        return res.json({ connections, deviceCount });
      }
      case 'telephony': {
        const [identities, callCount] = await Promise.all([
          TelephonyIdentity.find({ tenantId }).lean(),
          CallSession.countDocuments({ tenantId }),
        ]);
        return res.json({ identities, callCount });
      }
      case 'whatsapp': {
        const messageCount = await WhatsAppMessage.countDocuments({ tenantId });
        return res.json({ messageCount });
      }
      case 'subscription':
        return res.json({
          subscriptionPlan: tenant.subscriptionPlan,
          limits: tenant.limits,
          isActive: tenant.isActive,
          // Proposed, not-yet-applied fields (see this task's report) —
          // read defensively, absent on every tenant until backfilled.
          trialStartsAt: (tenant as any).trialStartsAt,
          trialEndsAt: (tenant as any).trialEndsAt,
        });
      case 'usage': {
        const [vehicleCount, driverCount, userCount] = await Promise.all([
          Vehicle.countDocuments({ tenantId }),
          Driver.countDocuments({ tenantId }),
          User.countDocuments({ tenantId }),
        ]);
        return res.json({
          vehicles: { used: vehicleCount, limit: tenant.limits?.vehicles ?? null },
          drivers: { used: driverCount, limit: tenant.limits?.drivers ?? null },
          managers: { used: userCount, limit: tenant.limits?.managers ?? null },
        });
      }
      default:
        return res.status(404).json({
          message: `Tab "${tab}" is not implemented by TASK-ROOT-DASHBOARD-02.`,
          note: 'ERRORS/SUPPORT/SECURITY/AUDIT LOG are TASK-ROOT-SUPPORT-03 / TASK-ROOT-SECURITY-05; '
            + 'CONFIGURATION/FEATURES are TASK-ROOT-SALES-CONFIG-04. Rendered as stub panels on the frontend.',
        });
    }
  }));
}
