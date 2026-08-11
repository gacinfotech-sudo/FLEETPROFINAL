// TASK-ROOT-SALES-CONFIG-04 — Tenant Feature Flags.
//
// Per-tenant module state: ENABLED / DISABLED / BETA / TRIAL / RESTRICTED.
// Every change must produce an audit event (this task uses the local
// placeholder in routes/_localPlatformAccess.ts until DOMAIN-01 +
// SECURITY-05's real RootAccessService.recordAuditEvent lands — see that
// file's header comment).
//
// CRITICAL invariant, proven by server/root/__tests__/featureFlagDataPreservation.test.ts:
// disabling a feature flag NEVER deletes or mutates any document in that
// module's own collections (e.g. GpsConnection). This model only ever
// writes to its own `FeatureFlag` collection.

import mongoose, { Schema, Document } from 'mongoose';
import { resolvePlanForTenant } from './plan';

export const FEATURE_FLAG_STATES = ['ENABLED', 'DISABLED', 'BETA', 'TRIAL', 'RESTRICTED'] as const;
export type FeatureFlagState = (typeof FEATURE_FLAG_STATES)[number];

// The module list this task's Tenant Feature Flags UI/API covers. Inferred
// from the modules that actually exist in this codebase today (GPS,
// Telephony, WhatsApp, Booking Queues, Vehicle 360, Driver lifecycle,
// Rewards/Referrals, Reports, API access, Customer portal) — the source
// brief's §20 verbatim module list was not available to this worktree
// (docs/root-control-plane/ only carries the audit + gap matrix, not the
// full numbered brief). Flagged in this task's report: confirm/replace this
// list against the real §20 text before relying on it as final.
export const FEATURE_MODULES = [
  'gps_tracking',
  'telephony',
  'whatsapp_messaging',
  'booking_queues',
  'vehicle_360',
  'driver_lifecycle',
  'rewards_referrals',
  'reports_analytics',
  'api_access',
  'customer_portal',
] as const;
export type FeatureModule = (typeof FEATURE_MODULES)[number];

export interface IFeatureFlag extends Document {
  tenantId: mongoose.Types.ObjectId;
  feature: FeatureModule;
  state: FeatureFlagState;
  updatedBy: string; // platform userId who last changed this
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  feature: { type: String, enum: FEATURE_MODULES, required: true },
  state: { type: String, enum: FEATURE_FLAG_STATES, required: true, default: 'ENABLED' },
  updatedBy: { type: String, required: true },
  reason: { type: String, maxlength: 1000 },
}, { timestamps: true });

FeatureFlagSchema.index({ tenantId: 1, feature: 1 }, { unique: true });

export const FeatureFlag =
  mongoose.models.FeatureFlag || mongoose.model<IFeatureFlag>('FeatureFlag', FeatureFlagSchema);

/**
 * resolveFeatureState(tenantId, feature) — the effective state for a
 * tenant: an explicit per-tenant FeatureFlag row wins; otherwise falls back
 * to the tenant's resolved Plan's `features[feature]` default (true ->
 * ENABLED, false/missing -> DISABLED); if no Plan can be resolved either
 * (no tenant, or catalog unseeded), defaults to ENABLED — matching today's
 * reality that every module is simply always-on for every tenant (no
 * feature-flag infrastructure exists yet per CURRENT-SUPER-ADMIN-AUDIT.md
 * §5), so introducing this system does not silently turn anything off for
 * existing tenants who have never been touched by it.
 */
export async function resolveFeatureState(tenantId: string, feature: FeatureModule): Promise<FeatureFlagState> {
  const explicit = await FeatureFlag.findOne({ tenantId, feature });
  if (explicit) return explicit.state;

  const { plan } = await resolvePlanForTenant(tenantId);
  if (plan && typeof plan.features?.[feature] === 'boolean') {
    return plan.features[feature] ? 'ENABLED' : 'DISABLED';
  }
  return 'ENABLED';
}

/**
 * resolveEntitlement(tenantId, key) — unified helper mentioned in this
 * task's spec: for a Plan limit key (see plan.ts's PLAN_LIMIT_KEYS) returns
 * the numeric limit; for anything else (treated as a feature module key)
 * returns a boolean — true unless the resolved FeatureFlagState is
 * DISABLED. (RESTRICTED is intentionally still "true" here — it means
 * "on, but constrained," not "off"; callers that need the nuance should
 * call resolveFeatureState directly instead of this boolean-collapsing
 * convenience wrapper.)
 */
export async function resolveEntitlement(tenantId: string, key: string): Promise<number | boolean | null> {
  const { PLAN_LIMIT_KEYS, resolvePlanLimit } = await import('./plan');
  if ((PLAN_LIMIT_KEYS as readonly string[]).includes(key)) {
    return resolvePlanLimit(tenantId, key as any);
  }
  const state = await resolveFeatureState(tenantId, key as FeatureModule);
  return state !== 'DISABLED';
}
