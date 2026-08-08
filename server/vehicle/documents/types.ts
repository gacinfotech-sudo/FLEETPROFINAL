// Vehicle Document & Compliance Registry (TASK-VEHICLE-COMPLIANCE-02).
// Grounded in docs/vehicle-research/VEHICLE-COMPLIANCE-MATRIX.md — every
// document type and confidence level below traces to a row in that matrix,
// none invented.

/**
 * `ComplianceStatus` is defined here to match TASK-VEHICLE-DOMAIN-01's report
 * exactly (`COMPLIANT|EXPIRING_SOON|PENDING|EXPIRED|COMPLIANCE_HOLD`) rather
 * than imported from it — DOMAIN-01 lives in a separate, not-yet-merged
 * worktree/branch (`vehicle-domain`), and per this batch's manifest
 * ("Tasks... must design against the documented contract in the research
 * docs, not a live import, since branching off those specific worktrees
 * would create its own coordination problem"), this is deliberate,
 * temporary duplication for the Integrator to reconcile into one shared
 * type once both branches land in trunk — not a second, drifting
 * definition invented independently.
 */
export type ComplianceStatus =
  | 'COMPLIANT'
  | 'EXPIRING_SOON'
  | 'PENDING'
  | 'EXPIRED'
  | 'COMPLIANCE_HOLD';

/** Every row in VEHICLE-COMPLIANCE-MATRIX.md's table, plus 'other' for the
 * open-ended "other state/category-specific documents" the original
 * requirement calls out. PSV Badge is deliberately excluded — the matrix
 * itself notes it is "tracked on Driver, not Vehicle". FASTag is deliberately
 * excluded — VEHICLE-360-SPEC.md assigns `FastagRecord` to
 * TASK-VEHICLE-FUEL-EXPENSE-04's `server/vehicle/fastag/**`, and the matrix
 * itself notes it is account/balance-tracked, not expiry-document-tracked,
 * so it does not fit this registry's shape anyway. */
export type VehicleDocumentType =
  | 'registration_certificate'
  | 'insurance_third_party'
  | 'insurance_comprehensive'
  | 'fitness_certificate'
  | 'puc_certificate'
  | 'road_tax'
  | 'permit_goods'
  | 'permit_passenger'
  | 'speed_governor_calibration'
  | 'retro_reflective_tape'
  | 'hypothecation'
  | 'noc'
  | 'gps_sos_authorization'
  | 'other';

/** Whether a document type is legally mandated vs. a tenant-chosen policy —
 * matrix's "Legally required or policy" column. Never used to force
 * applicability; only to label it once resolved. */
export type ComplianceRequirementBasis = 'legal' | 'policy' | 'not_applicable';

/** Matrix's own "Confidence" column — surfaced, not hidden, so a
 * "not_researched" rule is visibly weaker than a "sourced" one anywhere this
 * is displayed, per the matrix's own instruction to never collapse the two. */
export type ComplianceRuleConfidence = 'sourced' | 'provisional' | 'not_researched';

/**
 * Resolution inputs — "Country → State → Vehicle category → Usage → Tenant
 * policy" per the matrix and the original requirement, verbatim order.
 * `usage` intentionally has no default: a vehicle's usage must be resolved
 * from real data (booking type / vehicleCategory), never assumed.
 */
export interface ApplicabilityContext {
  country: string; // ISO 3166-1 alpha-2, e.g. 'IN'. Non-'IN' tenants get zero
                    // hardcoded-legal rules (see applicability.ts) — this
                    // research pass is India-only; nothing here should be
                    // assumed to generalize to other countries.
  state?: string;
  vehicleCategory?: string; // free text per TASK-VEHICLE-DOMAIN-01's own
                             // decision not to hardcode a category enum.
  usage: 'passenger_commercial' | 'goods_commercial' | 'private' | 'other';
  isFinanced?: boolean; // gates 'hypothecation'
  /** Tenant policy can both ADD applicability for a provisional/unconfirmed
   * document type (e.g. a tenant operating in a state that mandates Speed
   * Governor calibration can turn it on) and REMOVE applicability for a
   * policy-only one — but can never override a `legal` requirement to false.
   * See `resolveApplicability`'s enforcement of that rule. */
  tenantPolicyOverrides?: Partial<Record<VehicleDocumentType, boolean>>;
}

export interface ApplicabilityResult {
  documentType: VehicleDocumentType;
  applicable: boolean;
  basis: ComplianceRequirementBasis;
  confidence: ComplianceRuleConfidence;
  /** Human-readable citation back to the matrix, for audit/UI display —
   * never just "true", always traceable to why. */
  reason: string;
}

/** A document type with no fixed expiry concept at all (RC has no periodic
 * renewal date to track the same way Insurance/PUC do; hypothecation clears
 * on loan closure, not a calendar date; FASTag/GPS-SOS excluded above
 * anyway) — used by complianceStatus.ts to avoid demanding an expiry date
 * from a document type that the matrix explicitly says doesn't have one.
 * This is the concrete code proof against the matrix's own rejected claim
 * "every document has a legally fixed expiry". */
export const DOCUMENT_TYPES_WITHOUT_EXPIRY: ReadonlySet<VehicleDocumentType> = new Set([
  'registration_certificate', // long-cycle, tracked but not periodically renewed
  'hypothecation', // event-cleared (loan closure), not calendar-expiry
  'noc', // event-triggered, not periodic
]);
