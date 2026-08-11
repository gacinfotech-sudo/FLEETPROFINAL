// TASK-ROOT-DASHBOARD-02 — GET /api/root/dashboard
//
// Aggregate platform metrics for the Root Dashboard. Every metric ships a
// `linkTo` string the frontend uses to deep-link the card into the
// relevant filtered list (Tenant Master Database / Global Customer
// Database), per this task's acceptance criteria ("every card links to
// the underlying filtered record list").
//
// Integration/system-health cards (errors, queue, webhook, GPS/WhatsApp/
// Telephony health) are deliberately STUBS here — real data comes from
// TASK-ROOT-SUPPORT-03's Error Center once it lands. They report
// `available: false` rather than a fake number.
//
// Not mounted here — see this task's report for the exact
// `registerRootDashboardRoutes(app)` mount line for server/routes.ts
// (Integrator-only).

import type { Express, NextFunction, Response } from 'express';
import { authenticateUser, type AuthRequest } from '../../middleware/auth';
import { localRootAccessService } from '../services/localRootAccessService';
import { Tenant, User, Booking, Customer, Driver, Vehicle } from '../../models/index';
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

export function registerRootDashboardRoutes(app: Express): void {
  app.get(
    '/api/root/dashboard',
    authenticateUser,
    localRootAccessService.requirePlatformRole(ALL_PLATFORM_ROLES),
    safeAsync(async (req, res) => {
      const [
        totalTenants, activeTenants, suspendedTenants,
        totalUsers, activeUsers,
        totalCustomers, totalBookings,
        totalDrivers, totalVehicles,
      ] = await Promise.all([
        Tenant.countDocuments({}),
        Tenant.countDocuments({ isActive: true }),
        Tenant.countDocuments({ isActive: false }),
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        Customer.countDocuments({}),
        Booking.countDocuments({}),
        Driver.countDocuments({}),
        Vehicle.countDocuments({}),
      ]);

      // trial/expired both depend on the proposed (not-yet-applied)
      // Tenant.trialEndsAt field — see this task's report for the exact
      // schema patch. Until that field is backfilled, every tenant is
      // either 'active' or 'suspended' (isActive), so trial/expired report
      // 0 honestly rather than guessing.
      const [trialTenants, expiredTenants] = await Promise.all([
        Tenant.countDocuments({ isActive: true, trialEndsAt: { $exists: true, $gte: new Date() } }),
        Tenant.countDocuments({ isActive: true, trialEndsAt: { $exists: true, $lt: new Date() } }),
      ]);

      await localRootAccessService.recordAuditEvent({
        actorUserId: req.user?.userId ?? 'unknown',
        actorPlatformRole: (req.user as any)?.platformRole,
        action: 'root.dashboard.view',
      });

      res.json({
        tenants: {
          total: totalTenants,
          active: activeTenants - trialTenants,
          trial: trialTenants,
          suspended: suspendedTenants,
          expired: expiredTenants,
          linkTo: '/root/tenants',
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          linkTo: '/root/tenants',
        },
        customers: {
          total: totalCustomers,
          linkTo: '/root/customers',
        },
        bookings: {
          total: totalBookings,
          linkTo: '/root/customers',
        },
        drivers: {
          total: totalDrivers,
        },
        vehicles: {
          total: totalVehicles,
        },
        // Stub cards — TASK-ROOT-SUPPORT-03's Error Center / correlation-ID
        // middleware / integration health checks are not implemented by
        // this task. `available: false` tells the frontend to render a
        // "Coming soon" state instead of a zero (a real zero would be
        // misleading — it would look like "0 errors" rather than "unknown").
        systemHealth: {
          errors: { available: false, message: 'Coming soon — Error Center (TASK-ROOT-SUPPORT-03)' },
          queue: { available: false, message: 'Coming soon — Error Center (TASK-ROOT-SUPPORT-03)' },
          webhooks: { available: false, message: 'Coming soon — Error Center (TASK-ROOT-SUPPORT-03)' },
          gps: { available: false, message: 'Coming soon — integration health (TASK-ROOT-SUPPORT-03)' },
          whatsapp: { available: false, message: 'Coming soon — integration health (TASK-ROOT-SUPPORT-03)' },
          telephony: { available: false, message: 'Coming soon — integration health (TASK-ROOT-SUPPORT-03)' },
        },
      });
    }),
  );
}
