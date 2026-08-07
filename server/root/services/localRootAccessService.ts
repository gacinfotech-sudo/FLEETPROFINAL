// PLACEHOLDER — TASK-ROOT-DOMAIN-01 owns the real
// `server/root/services/rootAccessService.ts`. This file is deliberately
// named DIFFERENTLY (not `rootAccessService.ts`) so it never collides with
// or gets silently overwritten by DOMAIN-01's real file when that
// worktree's branch merges — the task file's "forbidden to modify" list
// for `server/root/services/rootAccessService.ts` did not extend
// permission to placeholder AT that exact path (unlike
// `piiMaskingService.ts`, which the task file explicitly did authorize
// placeholdering at its real path). This is this task's own local,
// route-testable implementation of the `RootAccessService` contract from
// `server/root/types.ts` (also a placeholder — see that file's header),
// used ONLY by this task's own `server/root/routes/*.ts` files.
//
// Integrator: once TASK-ROOT-DOMAIN-01's real
// server/root/services/rootAccessService.ts lands, repoint the imports in
// server/root/routes/dashboard.ts, tenants.ts, customers.ts from
// './localRootAccessService' to the real service, verify the real
// service's method signatures match (or adapt the routes), and delete this
// file.
//
// Cross-tenant queries in this file intentionally build their OWN explicit
// multi-tenant query functions (no `tenantId` filter, or an
// explicitly-optional one) rather than reusing any tenant-scoped storage
// helper with the filter stripped out — per
// docs/root-control-plane/CURRENT-SUPER-ADMIN-AUDIT.md §13's guidance, to
// avoid inheriting an assumption that baked-in tenant scoping elsewhere
// might rely on.

import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  Tenant, User, Booking, Customer, Driver, Vehicle,
} from '../../models/index';
import type { AuthRequest } from '../../middleware/auth';
import { maskPhone, maskEmail } from './piiMaskingService';
import type {
  PlatformRole, Middleware, RootAccessService, TenantListFilter, TenantSummary,
  Tenant360, GlobalCustomerFilter, MaskedCustomerRow, PlatformAuditEvent, ComputedTenantStatus,
} from '../types';

function computeTenantStatus(tenant: any): ComputedTenantStatus {
  if (!tenant.isActive) return 'suspended';
  // trialEndsAt is a proposed additive field (see this task's report for
  // the exact Tenant schema patch) — not present on the real schema yet,
  // so this only activates once/if that field is backfilled. Read
  // defensively via `any` since it's not on the current ITenant interface.
  const trialEndsAt: Date | undefined = tenant.trialEndsAt;
  if (trialEndsAt) {
    return new Date(trialEndsAt).getTime() >= Date.now() ? 'trial' : 'expired';
  }
  return 'active';
}

function toTenantSummary(tenant: any, counts: { userCount: number; vehicleCount: number; driverCount: number; bookingCount: number }): TenantSummary {
  return {
    tenantId: tenant._id.toString(),
    tenantCode: tenant.tenantCode,
    name: tenant.name,
    businessName: tenant.businessName,
    email: tenant.email,
    phone: tenant.phone,
    isActive: tenant.isActive,
    subscriptionPlan: tenant.subscriptionPlan,
    status: computeTenantStatus(tenant),
    createdAt: tenant.createdAt,
    trialEndsAt: tenant.trialEndsAt,
    healthRiskFlag: tenant.healthRiskFlag,
    ...counts,
  };
}

/**
 * requirePlatformRole — the gate every /api/root/** route in this task
 * calls through. Checks the additive `platformRole` field the manifest's
 * contract documents (`User.platformRole`, not yet on the real schema —
 * DOMAIN-01's migration owns actually populating it).
 *
 * Deliberately does NOT accept the legacy `role === 'admin'` bypass that
 * grants unscoped cross-tenant access today (server/middleware/auth.ts's
 * `requireTenant`) — even though an `admin` session isn't literally
 * "tenant-scoped" so a bridge would satisfy that specific acceptance
 * criterion's wording, admitting it here would mean every existing
 * `admin` account can already reach the new PII-touching /api/root/**
 * surface (Global Customer Database, Tenant 360) before anyone has been
 * explicitly granted a platform role — the exact gap Option A exists to
 * close. Reconciled to match TASK-ROOT-SUPPORT-03/TASK-ROOT-SALES-CONFIG-04's
 * independent placeholders, which both reject this same case (see their
 * "legacy 'admin' role session (no platformRole) -> 403" tests). Until
 * DOMAIN-01's migration lands and populates `platformRole` on real
 * accounts, this route surface is simply unreachable by anyone — a
 * stricter, safer default than a temporarily-open bridge.
 */
function requirePlatformRole(allowed: PlatformRole[]): Middleware {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const platformRole: PlatformRole | undefined = (req.user as any)?.platformRole;
    if (platformRole && allowed.includes(platformRole)) {
      return next();
    }
    return res.status(403).json({ message: 'Platform access required' });
  };
}

async function listTenants(filter: TenantListFilter) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

  const query: Record<string, unknown> = {};
  if (filter.search && filter.search.trim()) {
    const rx = new RegExp(filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ name: rx }, { businessName: rx }, { email: rx }, { phone: rx }, { tenantCode: rx }];
  }
  if (filter.status === 'suspended') {
    query.isActive = false;
  } else if (filter.status) {
    // trial/expired/active all require isActive: true today (trial/expired
    // further depend on the not-yet-backfilled trialEndsAt field) — filter
    // client-side-computed status post-fetch for those three, since the
    // real distinguishing field doesn't exist on every tenant yet.
    query.isActive = true;
  }

  const [tenantsRaw, total] = await Promise.all([
    Tenant.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Tenant.countDocuments(query),
  ]);

  const tenantIds = tenantsRaw.map((t) => t._id);
  const [userCounts, vehicleCounts, driverCounts, bookingCounts] = await Promise.all([
    User.aggregate([{ $match: { tenantId: { $in: tenantIds } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
    Vehicle.aggregate([{ $match: { tenantId: { $in: tenantIds } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
    Driver.aggregate([{ $match: { tenantId: { $in: tenantIds } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { tenantId: { $in: tenantIds } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
  ]);
  const toMap = (rows: any[]) => new Map(rows.map((r) => [r._id.toString(), r.n]));
  const userMap = toMap(userCounts), vehicleMap = toMap(vehicleCounts), driverMap = toMap(driverCounts), bookingMap = toMap(bookingCounts);

  let tenants = tenantsRaw.map((t) => toTenantSummary(t, {
    userCount: userMap.get(t._id.toString()) ?? 0,
    vehicleCount: vehicleMap.get(t._id.toString()) ?? 0,
    driverCount: driverMap.get(t._id.toString()) ?? 0,
    bookingCount: bookingMap.get(t._id.toString()) ?? 0,
  }));

  if (filter.status === 'trial' || filter.status === 'expired' || filter.status === 'active') {
    tenants = tenants.filter((t) => t.status === filter.status);
  }

  return { tenants, total };
}

async function getTenant360(tenantId: string): Promise<Tenant360 | null> {
  if (!mongoose.Types.ObjectId.isValid(tenantId)) return null;
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) return null;

  const [userCount, vehicleCount, driverCount, bookingCount] = await Promise.all([
    User.countDocuments({ tenantId }),
    Vehicle.countDocuments({ tenantId }),
    Driver.countDocuments({ tenantId }),
    Booking.countDocuments({ tenantId }),
  ]);

  const summary = toTenantSummary(tenant, { userCount, vehicleCount, driverCount, bookingCount });
  return { tenant: summary, counts: { userCount, vehicleCount, driverCount, bookingCount } };
}

function buildCustomerSearchQuery(filter: GlobalCustomerFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.tenantId && mongoose.Types.ObjectId.isValid(filter.tenantId)) query.tenantId = filter.tenantId;
  if (filter.customerId && mongoose.Types.ObjectId.isValid(filter.customerId)) query._id = filter.customerId;
  if (filter.name && filter.name.trim()) {
    query.name = new RegExp(filter.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (filter.phone && filter.phone.trim()) {
    const digits = filter.phone.replace(/\D/g, '');
    if (digits) {
      query.$or = [
        { primaryMobile: new RegExp(digits) },
        { alternateMobile: new RegExp(digits) },
        { whatsappNumber: new RegExp(digits) },
        { phoneAliases: new RegExp(digits) },
      ];
    }
  }
  if (filter.email && filter.email.trim()) {
    query.email = new RegExp(filter.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (filter.city && filter.city.trim()) {
    query.city = new RegExp(filter.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (filter.dateFrom || filter.dateTo) {
    const range: Record<string, Date> = {};
    if (filter.dateFrom) range.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) range.$lte = new Date(filter.dateTo);
    query.createdAt = range;
  }
  return query;
}

async function getCustomerAcrossTenants(filter: GlobalCustomerFilter) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

  let customerIdsFromBooking: mongoose.Types.ObjectId[] | null = null;
  if (filter.bookingId || filter.bookingCode) {
    const bookingQuery: Record<string, unknown> = {};
    if (filter.bookingId && mongoose.Types.ObjectId.isValid(filter.bookingId)) bookingQuery._id = filter.bookingId;
    if (filter.bookingCode) bookingQuery.bookingCode = filter.bookingCode.trim().toUpperCase();
    const matchingBookings = await Booking.find(bookingQuery).select('customerId').lean();
    customerIdsFromBooking = matchingBookings
      .map((b) => b.customerId)
      .filter((id): id is mongoose.Types.ObjectId => !!id);
    if (customerIdsFromBooking.length === 0) {
      return { customers: [], total: 0 };
    }
  }

  const query = buildCustomerSearchQuery(filter);
  if (customerIdsFromBooking) {
    query._id = { $in: customerIdsFromBooking };
  }

  const [rows, total] = await Promise.all([
    Customer.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize)
      .populate('tenantId', 'name businessName').lean(),
    Customer.countDocuments(query),
  ]);

  const customers: MaskedCustomerRow[] = rows.map((c: any) => ({
    customerId: c._id.toString(),
    tenantId: (c.tenantId?._id ?? c.tenantId)?.toString?.() ?? String(c.tenantId),
    tenantName: c.tenantId?.businessName ?? c.tenantId?.name ?? 'Unknown tenant',
    name: c.name,
    maskedPhone: maskPhone(c.primaryMobile),
    maskedEmail: c.email ? maskEmail(c.email) : undefined,
    city: c.city,
    totalBookings: c.totalBookings ?? 0,
    createdAt: c.createdAt,
  }));

  return { customers, total };
}

async function recordAuditEvent(event: PlatformAuditEvent): Promise<void> {
  // TODO(TASK-ROOT-SECURITY-05): replace with real Platform Audit Log
  // persistence once server/root/models/auditLog.ts lands (generalizing
  // GpsAuditLog's shape, per ROOT-GAP-MATRIX.md #17). This placeholder
  // only logs to the server console so Root reads of sensitive data
  // (customer PII, cross-tenant listings) aren't silently unaudited during
  // Wave 1 development — it is NOT a durable audit trail.
  console.log('[root-audit-placeholder]', JSON.stringify({ ...event, at: new Date().toISOString() }));
}

export const localRootAccessService: RootAccessService = {
  requirePlatformRole,
  listTenants,
  getTenant360,
  getCustomerAcrossTenants,
  recordAuditEvent,
};
