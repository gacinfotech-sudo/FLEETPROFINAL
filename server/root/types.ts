// server/root/types.ts
//
// TASK-ROOT-DOMAIN-01 — the foundation contract for FleetPro's Root Control
// Plane. Every other Wave-1 Root task (DASHBOARD-02, SUPPORT-03,
// SALES-CONFIG-04, SECURITY-05) imports types from this file and codes
// against the shapes below, per `.claude/tasks/active/ROOT-CONTROL-PLANE-MANIFEST.md`.
//
// Do not change an already-shipped exported name/shape here without
// updating the manifest and flagging it to the other four tasks — they are
// coding against this exact contract in parallel, before integration.
//
// This file has ZERO runtime dependency on MongoDB/Mongoose models — it is
// pure types (+ one small constant array), so it can be imported by
// route/service code in every other task's worktree without pulling in a
// live DB connection.

import type { Request, Response, NextFunction } from 'express';

// -----------------------------------------------------------------------
// Platform roles
// -----------------------------------------------------------------------

/**
 * Platform-staff roles — an entirely separate axis from the existing
 * tenant-side `User.role` ('admin' | 'client' | 'manager', defined in
 * server/models/index.ts). NEVER mix the two enums or compare one against
 * the other: `role` describes what a user is *inside a tenant*;
 * `platformRole` describes whether (and how) a user can act *across
 * tenants* as FleetPro platform staff. A user with a `platformRole` set is
 * not required to also have a tenant-side `role`/`tenantId` — platform
 * staff accounts are expected to be standalone, not also be a tenant
 * owner/manager.
 */
export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

/** Runtime-checkable list mirroring the `PlatformRole` union above. Keep in sync. */
export const PLATFORM_ROLES: readonly PlatformRole[] = [
  'PLATFORM_ROOT',
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN',
  'PLATFORM_SECURITY_ADMIN',
  'PLATFORM_READ_ONLY_AUDITOR',
];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return typeof value === 'string' && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/**
 * Additive, optional field PROPOSED for the existing `User` model
 * (`server/models/index.ts` — Integrator-only shared file, not edited by
 * this task; see this task's report for the exact verbatim patch).
 *
 * Existing `role: 'admin' | 'client' | 'manager'` is COMPLETELY UNTOUCHED
 * by this field — this is a new, separate, optional field, never a
 * replacement value inside the old enum. Absent/undefined means "not
 * platform staff, tenant-only user" — the overwhelming common case, and
 * the safe default (no cross-tenant access) for every account that hasn't
 * been explicitly reviewed and migrated.
 */
export interface UserPlatformFields {
  platformRole?: PlatformRole;
}

// -----------------------------------------------------------------------
// Request / middleware shapes
// -----------------------------------------------------------------------

/**
 * Minimal shape `RootAccessService.requirePlatformRole` needs from
 * `req.user`. Deliberately narrower than the app's real `AuthRequest`
 * (server/middleware/auth.ts) so this module has no import-time dependency
 * on that file — callers pass their real authenticated request through,
 * which structurally satisfies this interface.
 */
export interface RootAccessRequest extends Request {
  user?: ({ userId?: string } & UserPlatformFields) | null;
}

export type Middleware = (
  req: RootAccessRequest,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

// -----------------------------------------------------------------------
// Tenant listing / Tenant 360
// -----------------------------------------------------------------------

export interface TenantListFilter {
  search?: string;
  isActive?: boolean;
  subscriptionPlan?: 'starter' | 'pro' | 'custom';
  limit?: number;
  offset?: number;
}

export interface TenantSummary {
  tenantId: string;
  name: string;
  businessName: string;
  email?: string;
  isActive: boolean;
  subscriptionPlan: 'starter' | 'pro' | 'custom';
  createdAt: Date;
}

/**
 * Foundation-level Tenant 360 shape: identity + cross-module aggregate
 * counts only. TASK-ROOT-DASHBOARD-02 owns the real Tenant 360 *workspace*
 * (tabs, drill-downs, UI) built on top of this — this is deliberately the
 * minimal data contract, not the full page's data model.
 */
export interface Tenant360 {
  tenant: TenantSummary;
  counts: {
    users: number;
    vehicles: number;
    drivers: number;
    bookings: number;
  };
}

// -----------------------------------------------------------------------
// Global customer search (PII-sensitive — masked by default)
// -----------------------------------------------------------------------

export interface GlobalCustomerFilter {
  /** Matched against name only. Phone/email search happens server-side on the unmasked value; never pass raw PII search terms through client-controlled logging. */
  search?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

/**
 * PII fields are masked by default and stay masked — this task does not
 * implement an unmask flow (that is TASK-ROOT-SECURITY-05's
 * `piiMaskingService.ts` + its audited unmask endpoint). The masking done
 * here is a conservative, safe-by-default placeholder so this service never
 * returns raw PII; see rootAccessService.ts's `maskPhone`/`maskEmail` for
 * the exact algorithm, and that file's top-of-file note on the handoff to
 * SECURITY-05.
 */
export interface MaskedCustomerRow {
  customerId: string;
  tenantId: string;
  name?: string;
  maskedPhone?: string;
  maskedEmail?: string;
  createdAt: Date;
}

// -----------------------------------------------------------------------
// Platform audit log (generalizing GpsAuditLog's shape, per the audit doc)
// -----------------------------------------------------------------------

/**
 * Every Root read/write of sensitive data (tenant data, cross-tenant
 * customer PII, platform-staff management, etc.) must call
 * `RootAccessService.recordAuditEvent` with one of these. Shape
 * deliberately generalizes `GpsAuditLog`
 * (`server/gps/models/gpsConnection.ts`) — `{tenantId, userId, action,
 * oldValue, newValue, reason, createdAt}` — to a platform-wide event that
 * may or may not be scoped to a single tenant.
 *
 * TASK-ROOT-SECURITY-05 owns the real persisted model
 * (`server/root/models/auditLog.ts`, not present in this worktree). This
 * task is the *first consumer* of this interface — see
 * `rootAccessService.ts`'s `defaultAuditSink` for how events are handled
 * until that model lands.
 */
export interface PlatformAuditEvent {
  actorUserId: string;
  actorPlatformRole: PlatformRole;
  action: string; // e.g. 'root.tenant.view', 'root.customer.search', 'root.migration.apply'
  targetTenantId?: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  /** Set by the sink if omitted — callers should not normally set this themselves. */
  createdAt?: Date;
}

// -----------------------------------------------------------------------
// RootAccessService — the one place all cross-tenant Root queries go through
// -----------------------------------------------------------------------

/**
 * The ONE explicit, auditable place all cross-tenant Root queries go
 * through. No other task (or future code) should ever write its own
 * unscoped-filter query against a tenant-owned collection — everything
 * routes through an instance of this interface.
 *
 * Real implementation: `server/root/services/rootAccessService.ts`
 * (`rootAccessService` / `createRootAccessService`).
 */
export interface RootAccessService {
  /** Returns a middleware that 403s unless req.user.platformRole is set and is one of `allowed`. */
  requirePlatformRole(allowed: PlatformRole[]): Middleware;
  listTenants(filter: TenantListFilter): Promise<TenantSummary[]>;
  getTenant360(tenantId: string): Promise<Tenant360>;
  getCustomerAcrossTenants(filter: GlobalCustomerFilter): Promise<MaskedCustomerRow[]>;
  recordAuditEvent(event: PlatformAuditEvent): Promise<void>;
}
