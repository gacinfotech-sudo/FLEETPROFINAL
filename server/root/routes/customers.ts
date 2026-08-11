// TASK-ROOT-DASHBOARD-02 — Global Customer Database + Root Customer 360.
//
// GET /api/root/customers      — cross-tenant customer search, PII masked
//                                 by default in the JSON response itself
//                                 (not just hidden in the UI layer).
// GET /api/root/customers/:id  — single customer detail (Root Customer
//                                 360), also masked by default.
//
// The masking utility (`maskPhone`/`maskEmail`) and the real "View
// Sensitive Data" unmask-with-audit flow are TASK-ROOT-SECURITY-05's
// scope — this route only calls through the masking function (placeholder
// if SECURITY-05 hasn't landed, see server/root/services/piiMaskingService.ts)
// and does not implement an unmask path. A caller asking for unmasked data
// via `?includeSensitive=true` gets a clear 501, not silently-ignored
// unmasked data and not a fake unmask.
//
// Not mounted here — see this task's report for the exact
// `registerRootCustomerRoutes(app)` mount line for server/routes.ts
// (Integrator-only).

import type { Express, NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { localRootAccessService } from '../services/localRootAccessService';
import { rootAccessService } from '../services/rootAccessService';
import { Customer, Booking } from '../../models/index';
import { maskPhone, maskEmail } from '../services/piiMaskingService';
import type { PlatformRole } from '../types';

// Audit writes below deliberately go through the canonical rootAccessService
// (server/root/services/rootAccessService.ts), not localRootAccessService —
// localRootAccessService.recordAuditEvent is a Wave-1-dev-only placeholder
// that only console.logs (see its file header), so routing PII-read audit
// events through it would silently produce no durable audit trail despite
// this file's own comment saying every such read "must be audited". Route
// guarding (requireRole below) and getCustomerAcrossTenants still
// deliberately use the local placeholder pending the Wave 2 contract
// reconciliation already documented on localRootAccessService.ts — only the
// audit sink needed to change here, since PlatformAuditEvent's shape is
// compatible between both (targetType/targetId -> resourceType/resourceId).

const ALL_PLATFORM_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN', 'PLATFORM_SECURITY_ADMIN', 'PLATFORM_READ_ONLY_AUDITOR',
];

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function registerRootCustomerRoutes(app: Express): void {
  const requireRole = localRootAccessService.requirePlatformRole(ALL_PLATFORM_ROLES);

  app.get('/api/root/customers', authenticateUser, requireRole, safeAsync(async (req, res) => {
    if (String(req.query.includeSensitive) === 'true') {
      return res.status(501).json({
        message: 'Unmasked PII access is not implemented by TASK-ROOT-DASHBOARD-02. '
          + 'The "View Sensitive Data" unmask-with-audit flow is TASK-ROOT-SECURITY-05\'s scope.',
      });
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '25'), 10) || 25));

    const result = await localRootAccessService.getCustomerAcrossTenants({
      tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
      name: typeof req.query.name === 'string' ? req.query.name : undefined,
      phone: typeof req.query.phone === 'string' ? req.query.phone : undefined,
      email: typeof req.query.email === 'string' ? req.query.email : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
      bookingId: typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined,
      bookingCode: typeof req.query.bookingCode === 'string' ? req.query.bookingCode : undefined,
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      page,
      pageSize,
    });

    // Cross-tenant PII read — must be audited (RootAccessService.recordAuditEvent
    // contract note: "every Root read/write of sensitive data MUST call this").
    await rootAccessService.recordAuditEvent({
      actorUserId: req.user?.userId ?? 'unknown',
      actorPlatformRole: (req.user as any)?.platformRole,
      action: 'root.customers.search',
      metadata: { resultCount: result.customers.length, filters: req.query },
    });

    res.json(result);
  }));

  app.get('/api/root/customers/:id', authenticateUser, requireRole, safeAsync(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid customer id' });
    }
    const customer = await Customer.findById(id).populate('tenantId', 'name businessName').lean();
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const c: any = customer;
    const recentBookings = await Booking.find({ customerId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('bookingId bookingCode status pickupLocation dropoffLocation pickupDate totalAmount tenantId')
      .lean();

    await rootAccessService.recordAuditEvent({
      actorUserId: req.user?.userId ?? 'unknown',
      actorPlatformRole: (req.user as any)?.platformRole,
      action: 'root.customer360.view',
      resourceType: 'Customer',
      resourceId: id,
    });

    res.json({
      customerId: c._id.toString(),
      tenantId: (c.tenantId?._id ?? c.tenantId)?.toString?.() ?? String(c.tenantId),
      tenantName: c.tenantId?.businessName ?? c.tenantId?.name ?? 'Unknown tenant',
      name: c.name,
      customerCode: c.customerCode,
      maskedPhone: maskPhone(c.primaryMobile),
      maskedEmail: c.email ? maskEmail(c.email) : undefined,
      city: c.city,
      state: c.state,
      customerType: c.customerType,
      customerStatus: c.customerStatus,
      totalBookings: c.totalBookings,
      completedBookings: c.completedBookings,
      cancelledBookings: c.cancelledBookings,
      totalSpending: c.totalSpending,
      firstBookingDate: c.firstBookingDate,
      lastBookingDate: c.lastBookingDate,
      createdAt: c.createdAt,
      recentBookings,
    });
  }));
}
