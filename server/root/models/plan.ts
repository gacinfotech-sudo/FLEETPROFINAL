// TASK-ROOT-SALES-CONFIG-04 — Plans + centralized entitlements.
//
// Today's *entire* subscription model (CURRENT-SUPER-ADMIN-AUDIT.md §5) is
// `Tenant.subscriptionPlan: 'starter'|'pro'|'custom'` plus
// `Tenant.limits: {vehicles, drivers, managers}` — three numeric counters,
// no entitlement table, no feature flags. This file adds a real `Plan`
// catalog (Starter/Professional/Enterprise/Custom) that other code COULD
// read from via `resolvePlanLimit`/`resolveEntitlement` (see
// featureFlag.ts for the feature-flag-layered version) instead of hardcoded
// numbers — see this task's report for the explicit list of existing
// hardcoded limit checks that were intentionally NOT retrofitted.
//
// Relationship to Tenant.subscriptionPlan (per this task's "Expected
// database impact" spec): `Tenant.subscriptionPlan` is untouched and stays
// the source of truth for *today's* three legacy plan buckets. Each `Plan`
// document optionally declares `legacySubscriptionPlan` + `isDefaultForLegacyCode`
// to say "I am the canonical new-model Plan that
// `subscriptionPlan: 'pro'` (etc.) maps to." `resolvePlanForTenant` below
// reads `tenant.subscriptionPlan` and looks up the matching default Plan —
// no new field is added to the Tenant schema (server/models/index.ts is
// forbidden to modify by this task), so every existing tenant keeps working
// completely unchanged. A future task can add an explicit `Tenant.planId`
// override (e.g. for a tenant on a custom-negotiated Enterprise deal) — flagged
// as follow-up work in this task's report, not built here.

import mongoose, { Schema, Document } from 'mongoose';
import { Tenant } from '../../models';

export const PLAN_CODES = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

// The three legacy Tenant.subscriptionPlan enum values. ENTERPRISE has no
// legacy equivalent (it didn't exist before this task) — a tenant only ends
// up on ENTERPRISE via an explicit future assignment mechanism, not through
// legacy fallback.
export const LEGACY_SUBSCRIPTION_PLANS = ['starter', 'pro', 'custom'] as const;
export type LegacySubscriptionPlan = (typeof LEGACY_SUBSCRIPTION_PLANS)[number];

// Limit keys other code could resolve via resolveEntitlement/resolvePlanLimit.
// The first three map 1:1 onto today's Tenant.limits counters for legacy
// fallback purposes; the rest are genuinely new (no legacy equivalent).
export const PLAN_LIMIT_KEYS = [
  'maxVehicles',
  'maxDrivers',
  'maxManagers',
  'maxCustomers',
  'maxStorageGB',
  'maxApiCallsPerDay',
] as const;
export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export interface IPlanLimits {
  maxVehicles: number;
  maxDrivers: number;
  maxManagers: number;
  maxCustomers: number;
  maxStorageGB: number;
  maxApiCallsPerDay: number;
}

export interface IPlan extends Document {
  code: PlanCode;
  name: string;
  description?: string;
  isActive: boolean;

  // Which legacy Tenant.subscriptionPlan value (if any) this Plan is the
  // canonical resolved target for. Only one Plan per legacy value should
  // have isDefaultForLegacyCode: true (enforced by a partial unique index
  // below) — resolvePlanForTenant relies on that invariant.
  legacySubscriptionPlan?: LegacySubscriptionPlan;
  isDefaultForLegacyCode: boolean;

  limits: IPlanLimits;
  // Feature entitlement map — feature key -> default-on/off for tenants on
  // this plan. Per-tenant Tenant Feature Flags (featureFlag.ts) can override
  // this default in either direction.
  features: Record<string, boolean>;

  pricing?: {
    monthlyUsd?: number;
    yearlyUsd?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>({
  code: { type: String, enum: PLAN_CODES, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, maxlength: 2000 },
  isActive: { type: Boolean, default: true },

  legacySubscriptionPlan: { type: String, enum: LEGACY_SUBSCRIPTION_PLANS },
  isDefaultForLegacyCode: { type: Boolean, default: false },

  limits: {
    maxVehicles: { type: Number, required: true, min: 0 },
    maxDrivers: { type: Number, required: true, min: 0 },
    maxManagers: { type: Number, required: true, min: 0 },
    maxCustomers: { type: Number, required: true, min: 0 },
    maxStorageGB: { type: Number, required: true, min: 0 },
    maxApiCallsPerDay: { type: Number, required: true, min: 0 },
  },
  features: { type: Schema.Types.Mixed, default: {} },

  pricing: {
    monthlyUsd: { type: Number, min: 0 },
    yearlyUsd: { type: Number, min: 0 },
  },
}, { timestamps: true });

PlanSchema.index({ code: 1 }, { unique: true });
// At most one canonical default Plan per legacy subscriptionPlan value.
PlanSchema.index(
  { legacySubscriptionPlan: 1 },
  { unique: true, partialFilterExpression: { isDefaultForLegacyCode: true } },
);

export const Plan = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);

// --- Default catalog seeding -----------------------------------------------
// Idempotent: safe to call on every server start / first API hit. Ensures
// resolveEntitlement has real Plan data to resolve against even before any
// Root operator has visited the Product Configuration UI.
const DEFAULT_PLANS: Array<Pick<IPlan, 'code' | 'name' | 'legacySubscriptionPlan' | 'isDefaultForLegacyCode' | 'limits' | 'features' | 'pricing'>> = [
  {
    code: 'STARTER',
    name: 'Starter',
    legacySubscriptionPlan: 'starter',
    isDefaultForLegacyCode: true,
    limits: { maxVehicles: 6, maxDrivers: 3, maxManagers: 1, maxCustomers: 200, maxStorageGB: 5, maxApiCallsPerDay: 1000 },
    features: { gps_tracking: false, telephony: false, whatsapp_messaging: true, reports_analytics: false, api_access: false, custom_branding: false, priority_support: false },
    pricing: { monthlyUsd: 29 },
  } as any,
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    legacySubscriptionPlan: 'pro',
    isDefaultForLegacyCode: true,
    limits: { maxVehicles: 25, maxDrivers: 15, maxManagers: 5, maxCustomers: 2000, maxStorageGB: 50, maxApiCallsPerDay: 20000 },
    features: { gps_tracking: true, telephony: true, whatsapp_messaging: true, reports_analytics: true, api_access: true, custom_branding: false, priority_support: false },
    pricing: { monthlyUsd: 99 },
  } as any,
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    // No legacy mapping — reachable only via explicit future assignment.
    isDefaultForLegacyCode: false,
    limits: { maxVehicles: 500, maxDrivers: 300, maxManagers: 50, maxCustomers: 100000, maxStorageGB: 1000, maxApiCallsPerDay: 500000 },
    features: { gps_tracking: true, telephony: true, whatsapp_messaging: true, reports_analytics: true, api_access: true, custom_branding: true, priority_support: true },
    pricing: { monthlyUsd: 499 },
  } as any,
  {
    code: 'CUSTOM',
    name: 'Custom',
    legacySubscriptionPlan: 'custom',
    isDefaultForLegacyCode: true,
    limits: { maxVehicles: 100, maxDrivers: 60, maxManagers: 20, maxCustomers: 20000, maxStorageGB: 200, maxApiCallsPerDay: 100000 },
    features: { gps_tracking: true, telephony: true, whatsapp_messaging: true, reports_analytics: true, api_access: true, custom_branding: true, priority_support: true },
    pricing: {},
  } as any,
];

let seedInFlight: Promise<void> | null = null;

export async function ensureDefaultPlansSeeded(): Promise<void> {
  if (seedInFlight) return seedInFlight;
  seedInFlight = (async () => {
    const existingCount = await Plan.countDocuments({});
    if (existingCount > 0) return;
    for (const def of DEFAULT_PLANS) {
      await Plan.updateOne(
        { code: def.code },
        { $setOnInsert: def },
        { upsert: true },
      );
    }
  })();
  try {
    await seedInFlight;
  } finally {
    seedInFlight = null;
  }
}

// --- Resolution helpers ------------------------------------------------

export interface ResolvedPlanForTenant {
  plan: IPlan | null;
  source: 'plan' | 'legacy-fallback';
}

/**
 * Resolves the canonical Plan document for a tenant, purely by reading
 * `Tenant.subscriptionPlan` (untouched, existing field) and matching it
 * against the Plan flagged `isDefaultForLegacyCode` for that legacy value.
 * Falls back to `source: 'legacy-fallback'` (no Plan document) if the
 * catalog hasn't been seeded yet — callers must handle that case by
 * reading `Tenant.limits` directly, exactly as all existing code does today.
 */
export async function resolvePlanForTenant(tenantId: string): Promise<ResolvedPlanForTenant> {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return { plan: null, source: 'legacy-fallback' };
  }
  await ensureDefaultPlansSeeded();
  const plan = await Plan.findOne({
    legacySubscriptionPlan: tenant.subscriptionPlan,
    isDefaultForLegacyCode: true,
    isActive: true,
  });
  return plan ? { plan, source: 'plan' } : { plan: null, source: 'legacy-fallback' };
}

/**
 * resolvePlanLimit(tenantId, key) — the numeric half of this task's
 * resolveEntitlement helper (see featureFlag.ts for the feature-key half,
 * which layers per-tenant Tenant Feature Flags on top of this).
 *
 * Returns `null` when no plan-level value is knowable (e.g. a brand new
 * limit key with no legacy Tenant.limits equivalent, and no Plan seeded) —
 * callers should treat `null` as "not enforced," matching today's silent
 * absence of any limit for those fields.
 */
export async function resolvePlanLimit(tenantId: string, key: PlanLimitKey): Promise<number | null> {
  const { plan, source } = await resolvePlanForTenant(tenantId);
  if (plan) {
    return plan.limits[key];
  }
  if (source === 'legacy-fallback') {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return null;
    // Only these three legacy counters exist pre-Plan; everything else has
    // no legacy equivalent to fall back to.
    if (key === 'maxVehicles') return tenant.limits?.vehicles ?? null;
    if (key === 'maxDrivers') return tenant.limits?.drivers ?? null;
    if (key === 'maxManagers') return tenant.limits?.managers ?? null;
    return null;
  }
  return null;
}
