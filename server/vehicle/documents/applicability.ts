import type {
  ApplicabilityContext,
  ApplicabilityResult,
  ComplianceRequirementBasis,
  ComplianceRuleConfidence,
  VehicleDocumentType,
} from './types';

/**
 * One row per VEHICLE-COMPLIANCE-MATRIX.md entry. `baseline` decides
 * applicability from country/usage alone — deliberately conservative:
 * anything the matrix marks "not researched" or "applicability not
 * confirmed" returns `false` here unconditionally, so it can only become
 * applicable via an explicit tenant-policy override, never a silent
 * default. This is the concrete code proof against the matrix's own
 * rejected claim "Speed Governor / retro-reflective tape are always
 * required".
 */
interface DocumentRule {
  documentType: VehicleDocumentType;
  basis: ComplianceRequirementBasis;
  confidence: ComplianceRuleConfidence;
  baseline: (ctx: ApplicabilityContext) => boolean;
  citation: string;
}

const RULES: DocumentRule[] = [
  {
    documentType: 'registration_certificate',
    basis: 'legal',
    confidence: 'sourced',
    baseline: (ctx) => ctx.country === 'IN',
    citation: 'Matrix: "All motorised vehicles", national baseline, sourced this pass.',
  },
  {
    documentType: 'insurance_third_party',
    basis: 'legal',
    confidence: 'sourced',
    baseline: (ctx) => ctx.country === 'IN',
    citation: 'Matrix: "All motorised vehicles", legally required, sourced this pass.',
  },
  {
    documentType: 'insurance_comprehensive',
    basis: 'policy',
    confidence: 'sourced',
    // Never a legal baseline — matrix: "advisable, not universally mandated".
    baseline: () => false,
    citation: 'Matrix: tenant/policy, "advisable, not universally mandated" — never a legal default.',
  },
  {
    documentType: 'fitness_certificate',
    basis: 'legal',
    confidence: 'provisional',
    baseline: (ctx) => ctx.country === 'IN' && (ctx.usage === 'passenger_commercial' || ctx.usage === 'goods_commercial'),
    citation: 'Matrix: "Legally required for commercial vehicles" — exact renewal cadence unconfirmed, applicability itself is not.',
  },
  {
    documentType: 'puc_certificate',
    basis: 'legal',
    confidence: 'sourced',
    baseline: (ctx) => ctx.country === 'IN',
    citation: 'Matrix: "All fuel-based vehicles", national baseline, sourced this pass.',
  },
  {
    documentType: 'road_tax',
    basis: 'legal',
    confidence: 'sourced',
    baseline: (ctx) => ctx.country === 'IN',
    citation: 'Matrix: "All registered vehicles", state-dependent cadence but existence itself sourced.',
  },
  {
    documentType: 'permit_goods',
    basis: 'legal',
    confidence: 'sourced',
    baseline: (ctx) => ctx.country === 'IN' && ctx.usage === 'goods_commercial',
    citation: 'Matrix: "Goods-carrying commercial vehicles", existence sourced this pass.',
  },
  {
    documentType: 'permit_passenger',
    basis: 'legal',
    confidence: 'provisional',
    baseline: (ctx) => ctx.country === 'IN' && ctx.usage === 'passenger_commercial',
    citation: 'Matrix: "Provisionally legally required" for passenger-carrying commercial vehicles — FleetPro\'s core use case, but flagged provisional, not confirmed.',
  },
  {
    documentType: 'speed_governor_calibration',
    basis: 'policy',
    confidence: 'not_researched',
    // Never a baseline default — matrix explicitly: "do not default to required".
    baseline: () => false,
    citation: 'Matrix: "Applicability not confirmed — do not default to required." Only reachable via explicit tenant policy override.',
  },
  {
    documentType: 'retro_reflective_tape',
    basis: 'policy',
    confidence: 'not_researched',
    baseline: () => false,
    citation: 'Matrix: "Applicability not confirmed." Only reachable via explicit tenant policy override.',
  },
  {
    documentType: 'hypothecation',
    basis: 'policy',
    confidence: 'sourced',
    baseline: (ctx) => Boolean(ctx.isFinanced),
    citation: 'Matrix: "Tenant/policy (only if financed) — Financed vehicles only." Internal financial record, not a regulatory item.',
  },
  {
    documentType: 'noc',
    basis: 'legal',
    confidence: 'provisional',
    // Event-triggered (inter-state transfer), never a standing baseline —
    // no vehicle is "always" mid-transfer, so this only ever becomes
    // applicable via an explicit tenant-policy/event flag, matching the
    // matrix's "event-triggered, not periodic" note.
    baseline: () => false,
    citation: 'Matrix: "Only on inter-state registration transfer or similar events" — event-triggered, never a standing baseline default.',
  },
  {
    documentType: 'gps_sos_authorization',
    basis: 'policy',
    confidence: 'not_researched',
    baseline: () => false,
    citation: 'Matrix: "Category-dependent, not researched in detail." Only reachable via explicit tenant policy override.',
  },
  {
    documentType: 'other',
    basis: 'policy',
    confidence: 'not_researched',
    baseline: () => false,
    citation: 'Open-ended "other state/category-specific documents" — always tenant-declared, never a system default.',
  },
];

/**
 * Resolves whether `documentType` applies to a vehicle in `ctx`.
 * Tenant policy can only ADD applicability to a non-`legal` rule, or
 * REMOVE applicability from a `legal` rule that would otherwise fail an
 * actual legal requirement — wait: a tenant must never be able to switch
 * OFF a genuine legal requirement. Enforcement: an override can only move a
 * `false` baseline to `true`, or a `policy`/`false`-basis baseline to
 * `false`-stays-false; it can never turn a `legal`-basis `true` result to
 * `false`. This keeps "tenant policy" purely additive for compliance
 * purposes, per the matrix's own access-control spirit (compliance decisions
 * are Ops Manager+/Owner territory, not something a misconfigured policy
 * flag can silently switch off a real legal requirement).
 */
export function resolveApplicability(
  documentType: VehicleDocumentType,
  ctx: ApplicabilityContext,
): ApplicabilityResult {
  const rule = RULES.find((r) => r.documentType === documentType);
  if (!rule) {
    return {
      documentType, applicable: false, basis: 'not_applicable', confidence: 'not_researched',
      reason: `Unknown document type "${documentType}" — no rule defined.`,
    };
  }
  const baselineApplicable = rule.baseline(ctx);
  const override = ctx.tenantPolicyOverrides?.[documentType];

  let applicable = baselineApplicable;
  if (override !== undefined) {
    if (rule.basis === 'legal' && baselineApplicable && override === false) {
      // Refuse to let a policy override switch off a genuine legal
      // requirement — ignore the override in this direction.
      applicable = true;
    } else {
      applicable = override;
    }
  }

  return {
    documentType,
    applicable,
    basis: applicable ? rule.basis : 'not_applicable',
    confidence: rule.confidence,
    reason: override !== undefined && applicable !== baselineApplicable
      ? `${rule.citation} Tenant policy override applied.`
      : rule.citation,
  };
}

/** Resolves every known document type at once — the shape the Compliance
 * tab and the status-computation function both consume. */
export function resolveAllApplicability(ctx: ApplicabilityContext): ApplicabilityResult[] {
  return RULES.map((rule) => resolveApplicability(rule.documentType, ctx));
}

export const ALL_DOCUMENT_TYPES: readonly VehicleDocumentType[] = RULES.map((r) => r.documentType);
