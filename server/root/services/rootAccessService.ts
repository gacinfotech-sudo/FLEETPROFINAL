// server/root/services/rootAccessService.ts
//
// TASK-ROOT-DOMAIN-01 — the real implementation of `RootAccessService`
// (contract: server/root/types.ts). This is the ONE place in the Root
// Control Plane that is allowed to query tenant-owned collections without a
// `tenantId` filter. Every Wave-1 Root route (dashboard, support, sales,
// security) must call through an instance of this service rather than
// writing its own unscoped query — that is the whole point of this file
// existing (see docs/root-control-plane/ROOT-GAP-MATRIX.md, item #6: "the
// admin-bypass-in-requireTenant pattern is the *wrong* precedent to copy —
// build explicit Root data-access services instead").
//
// Grep guard for reviewers: the only unscoped (`{}`/no-tenantId-filter)
// queries anywhere in this file are inside `defaultListTenants`,
// `defaultGetTenant360`, and `defaultGetCustomerAcrossTenants` below — all
// three are read-only cross-tenant aggregate lookups, gated by
// `requirePlatformRole` at the route layer (never inside this file itself,
// since this file has no access to the route wiring — callers MUST wrap
// their route with `requirePlatformRole(...)` before calling into this
// service; see this task's report for the exact call-site pattern).
//
// Testability: every default (real-DB) implementation is swappable via
// `RootAccessServiceDeps` passed to `createRootAccessService(...)`. Unit
// tests inject fake `listTenantsImpl`/etc. functions directly and never
// need a live MongoDB connection — see rootAccessService.test.ts.

import type {
  PlatformRole,
  RootAccessService,
  TenantListFilter,
  TenantSummary,
  Tenant360,
  GlobalCustomerFilter,
  MaskedCustomerRow,
  PlatformAuditEvent,
  Middleware,
} from '../types';

// ---------------------------------------------------------------------------
// PII masking (temporary, safe-by-default placeholder)
// ---------------------------------------------------------------------------
//
// TASK-ROOT-SECURITY-05 owns the real `piiMaskingService.ts`. Until it
// lands, `getCustomerAcrossTenants` must still never return raw PII, so
// this file implements a conservative, dependency-free mask inline. When
// SECURITY-05's service exists, the Integrator should replace the two
// functions below with calls into it (same output shape expected:
// masked-but-still-useful-for-support strings, never the raw value).

/** "9876543210" -> "98******10". Keeps first 2 + last 2 digits only. */
export function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 4)}${digits.slice(-2)}`;
}

/** "jane.doe@example.com" -> "ja***@example.com". */
export function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf('@');
  if (at <= 0) return '*'.repeat(email.length);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}${domain}`;
}

// ---------------------------------------------------------------------------
// Dependency injection surface
// ---------------------------------------------------------------------------

export interface RootAccessServiceDeps {
  listTenantsImpl?: (filter: TenantListFilter) => Promise<TenantSummary[]>;
  getTenant360Impl?: (tenantId: string) => Promise<Tenant360>;
  getCustomerAcrossTenantsImpl?: (filter: GlobalCustomerFilter) => Promise<MaskedCustomerRow[]>;
  /**
   * Where audit events are ultimately persisted/logged. Defaults to
   * `defaultAuditSink`, which tries the real platform audit log model
   * (TASK-ROOT-SECURITY-05's `server/root/models/auditLog.ts`, not present
   * in this worktree) and falls back to a structured console log so events
   * are never silently dropped even before that model exists.
   */
  auditSink?: (event: Required<Pick<PlatformAuditEvent, 'createdAt'>> & PlatformAuditEvent) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Default (real-DB) implementations — lazy-imported so importing this
// module (or unit-testing it with injected deps) never requires a live
// MongoDB connection.
// ---------------------------------------------------------------------------

async function loadModels() {
  // Lazy/dynamic import: only touched when a default implementation
  // actually runs (i.e. no override was injected via deps).
  return import('../../models/index');
}

async function defaultListTenants(filter: TenantListFilter): Promise<TenantSummary[]> {
  const { Tenant } = await loadModels();
  const query: Record<string, unknown> = {};
  if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;
  if (filter.subscriptionPlan) query.subscriptionPlan = filter.subscriptionPlan;
  if (filter.search && filter.search.trim()) {
    const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    query.$or = [{ name: re }, { businessName: re }, { email: re }];
  }

  const docs = await Tenant.find(query)
    .sort({ createdAt: -1 })
    .skip(filter.offset ?? 0)
    .limit(Math.min(filter.limit ?? 50, 200))
    .lean();

  return docs.map((doc: any): TenantSummary => ({
    tenantId: doc._id.toString(),
    name: doc.name,
    businessName: doc.businessName,
    email: doc.email,
    isActive: doc.isActive,
    subscriptionPlan: doc.subscriptionPlan,
    createdAt: doc.createdAt,
  }));
}

async function defaultGetTenant360(tenantId: string): Promise<Tenant360> {
  const { Tenant, User, Vehicle, Driver, Booking } = await loadModels();
  const tenantDoc: any = await Tenant.findById(tenantId).lean();
  if (!tenantDoc) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const [users, vehicles, drivers, bookings] = await Promise.all([
    User.countDocuments({ tenantId }),
    Vehicle.countDocuments({ tenantId }),
    Driver.countDocuments({ tenantId }),
    Booking.countDocuments({ tenantId }),
  ]);

  return {
    tenant: {
      tenantId: tenantDoc._id.toString(),
      name: tenantDoc.name,
      businessName: tenantDoc.businessName,
      email: tenantDoc.email,
      isActive: tenantDoc.isActive,
      subscriptionPlan: tenantDoc.subscriptionPlan,
      createdAt: tenantDoc.createdAt,
    },
    counts: { users, vehicles, drivers, bookings },
  };
}

async function defaultGetCustomerAcrossTenants(filter: GlobalCustomerFilter): Promise<MaskedCustomerRow[]> {
  const { Customer } = await loadModels();
  const query: Record<string, unknown> = {};
  if (filter.tenantId) query.tenantId = filter.tenantId;
  if (filter.search && filter.search.trim()) {
    const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.name = new RegExp(escaped, 'i');
  }

  const docs = await Customer.find(query)
    .sort({ createdAt: -1 })
    .skip(filter.offset ?? 0)
    .limit(Math.min(filter.limit ?? 50, 200))
    .lean();

  return docs.map((doc: any): MaskedCustomerRow => ({
    customerId: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    name: doc.name,
    maskedPhone: maskPhone(doc.primaryMobile),
    maskedEmail: maskEmail(doc.email),
    createdAt: doc.createdAt,
  }));
}

async function defaultAuditSink(
  event: Required<Pick<PlatformAuditEvent, 'createdAt'>> & PlatformAuditEvent,
): Promise<void> {
  try {
    // TASK-ROOT-SECURITY-05 owns the real PlatformAuditLog model at
    // server/root/models/auditLog.ts. It does not exist in this worktree
    // yet, so this dynamic import resolves to null until that task lands
    // and the Integrator merges it. Once it exists, every audit event is
    // persisted there automatically with zero code change required here.
    //
    // The module specifier is deliberately built from a variable rather
    // than a string literal: with a literal, `tsc` resolves the import at
    // type-check time and `npm run check` fails on every worktree that
    // doesn't have server/root/models/auditLog.ts yet (i.e. every worktree
    // except SECURITY-05's, until integration). A variable specifier is
    // typed `any` and skips that static resolution, while the runtime
    // behavior (Node's dynamic `import()`) is identical either way.
    const auditLogModulePath = '../models/auditLog';
    const auditModule: any = await import(auditLogModulePath).catch(() => null);
    const PlatformAuditLog = auditModule?.PlatformAuditLog;
    if (PlatformAuditLog?.create) {
      await PlatformAuditLog.create(event);
      return;
    }
  } catch (error) {
    console.error('[RootAccessService] audit sink DB write failed, falling back to log:', error);
  }
  // Fail open to a structured console log rather than silently dropping
  // the event — audit events must never vanish silently, even before the
  // real persisted sink exists.
  console.warn('[RootAccessService][AUDIT]', JSON.stringify(event));
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRootAccessService(deps: RootAccessServiceDeps = {}): RootAccessService {
  const auditSink = deps.auditSink ?? defaultAuditSink;

  return {
    requirePlatformRole(allowed: PlatformRole[]): Middleware {
      if (!Array.isArray(allowed) || allowed.length === 0) {
        throw new Error('requirePlatformRole() requires a non-empty list of allowed PlatformRole values');
      }
      return (req, res, next) => {
        const platformRole = req.user?.platformRole;
        if (!platformRole) {
          res.status(403).json({ message: 'Platform access required' });
          return;
        }
        if (!allowed.includes(platformRole)) {
          res.status(403).json({ message: 'Insufficient platform role', requiredAny: allowed });
          return;
        }
        next();
      };
    },

    async listTenants(filter: TenantListFilter): Promise<TenantSummary[]> {
      return (deps.listTenantsImpl ?? defaultListTenants)(filter);
    },

    async getTenant360(tenantId: string): Promise<Tenant360> {
      return (deps.getTenant360Impl ?? defaultGetTenant360)(tenantId);
    },

    async getCustomerAcrossTenants(filter: GlobalCustomerFilter): Promise<MaskedCustomerRow[]> {
      return (deps.getCustomerAcrossTenantsImpl ?? defaultGetCustomerAcrossTenants)(filter);
    },

    async recordAuditEvent(event: PlatformAuditEvent): Promise<void> {
      const withTimestamp = { ...event, createdAt: event.createdAt ?? new Date() };
      await auditSink(withTimestamp);
    },
  };
}

/** Default singleton, wired to the real DB-backed implementations above. */
export const rootAccessService: RootAccessService = createRootAccessService();
