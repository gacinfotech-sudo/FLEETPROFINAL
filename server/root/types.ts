// PLACEHOLDER — TASK-ROOT-DOMAIN-01 owns the real implementation of this file.
//
// This is a local stand-in, created by TASK-ROOT-DASHBOARD-02 solely so this
// worktree can typecheck and test against the documented contract in
// `.claude/tasks/active/ROOT-CONTROL-PLANE-MANIFEST.md` ("Dependency contract
// for Wave 1's parallel tasks") before TASK-ROOT-DOMAIN-01 merges its real
// `server/root/types.ts`.
//
// Integrator: once TASK-ROOT-DOMAIN-01 lands, delete this file and repoint
// every `from '../types'` / `from '../../types'` import in `server/root/**`
// at the real one. The `PlatformRole` union and the `RootAccessService`
// method signatures below are copied verbatim from the manifest; everything
// else (TenantSummary, Tenant360, GlobalCustomerFilter, MaskedCustomerRow,
// PlatformAuditEvent, TenantListFilter) is this task's own reasonable
// interpretation of the shapes those methods need, since the manifest only
// specified the RootAccessService method signatures, not their full payload
// types — reconcile against DOMAIN-01's real versions if they differ.

import type { NextFunction, Request, Response } from 'express';

export type PlatformRole =
  | 'PLATFORM_ROOT'
  | 'PLATFORM_SUPER_ADMIN'
  | 'PLATFORM_SUPPORT_ADMIN'
  | 'PLATFORM_FINANCE_ADMIN'
  | 'PLATFORM_SECURITY_ADMIN'
  | 'PLATFORM_READ_ONLY_AUDITOR';

// Additive optional field on the existing User model (proposed patch, not
// applied by this task — server/models/index.ts is Integrator-only). The
// existing `role: 'admin'|'client'|'manager'` stays completely untouched.
export interface UserPlatformFields {
  platformRole?: PlatformRole;
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void;

export type ComputedTenantStatus = 'active' | 'trial' | 'suspended' | 'expired';

export interface TenantListFilter {
  search?: string;
  status?: ComputedTenantStatus;
  page?: number;
  pageSize?: number;
}

export interface TenantSummary {
  tenantId: string;
  tenantCode?: string;
  name: string;
  businessName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  subscriptionPlan: string;
  status: ComputedTenantStatus;
  createdAt: Date;
  trialEndsAt?: Date;
  healthRiskFlag?: 'none' | 'watch' | 'at_risk';
  userCount: number;
  vehicleCount: number;
  driverCount: number;
  bookingCount: number;
}

export interface Tenant360 {
  tenant: TenantSummary;
  // Per-tab counts only, for the Overview tab's summary cards — the data
  // tabs themselves (bookings, drivers, vehicles, ...) fetch their own
  // paginated detail on demand, never preloaded here (see §44 of the
  // source brief: never load everything at once).
  counts: Record<string, number>;
}

export interface GlobalCustomerFilter {
  tenantId?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  customerId?: string;
  bookingId?: string;
  bookingCode?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface MaskedCustomerRow {
  customerId: string;
  tenantId: string;
  tenantName: string;
  name: string;
  maskedPhone: string;
  maskedEmail?: string;
  city?: string;
  totalBookings: number;
  createdAt: Date;
}

export interface PlatformAuditEvent {
  actorUserId: string;
  actorPlatformRole?: PlatformRole;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// NOTE: the manifest's documented signatures return bare arrays
// (`Promise<TenantSummary[]>`, `Promise<MaskedCustomerRow[]>`). This task's
// acceptance criteria requires server-side pagination ("never loads every
// tenant's every field into the browser at once" / "Tenant list is
// paginated server-side"), which needs a total count alongside the page of
// rows. Flagged deviation: both list methods below return
// `{ rows, total }` instead of a bare array — reconcile with DOMAIN-01's
// real interface at integration time (either DOMAIN-01 adopts this shape,
// or this task's routes adapt to the bare-array version).
export interface RootAccessService {
  requirePlatformRole(allowed: PlatformRole[]): Middleware;
  listTenants(filter: TenantListFilter): Promise<{ tenants: TenantSummary[]; total: number }>;
  getTenant360(tenantId: string): Promise<Tenant360 | null>;
  getCustomerAcrossTenants(filter: GlobalCustomerFilter): Promise<{ customers: MaskedCustomerRow[]; total: number }>;
  recordAuditEvent(event: PlatformAuditEvent): Promise<void>;
}
