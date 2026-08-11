import { resolveAllApplicability } from './applicability';
import { DOCUMENT_TYPES_WITHOUT_EXPIRY, type ApplicabilityContext, type ComplianceStatus, type VehicleDocumentType } from './types';

/** Minimal shape this module needs from a stored VehicleDocument — kept
 * narrow and DB-agnostic so this function stays a pure, unit-testable
 * computation (models/vehicleDocument.ts's IVehicleDocument satisfies it). */
export interface DocumentRecordInput {
  documentType: VehicleDocumentType;
  expiryDate?: Date;
  verified: boolean;
}

export interface ComplianceStatusOptions {
  /** Matrix: "default suggestion: 30 days, tenant-configurable". */
  expiringSoonThresholdDays?: number;
  /** Days past EXPIRED before a tenant-policy escalation to
   * COMPLIANCE_HOLD — matrix: "expired document past a grace period... a
   * policy decision layered on top of EXPIRED, not a separate research
   * question". `undefined` (the default) means no escalation: EXPIRED stays
   * EXPIRED forever unless a tenant explicitly configures a grace period. */
  complianceHoldGraceDays?: number;
  now?: Date;
}

export interface ComplianceStatusResult {
  status: ComplianceStatus;
  /** Every applicable-and-legally-required document type that is missing,
   * expired, or expiring soon — for UI display ("3 documents need attention"),
   * not just a single opaque status string. */
  blockingDocumentTypes: VehicleDocumentType[];
  expiringSoonDocumentTypes: VehicleDocumentType[];
  missingDocumentTypes: VehicleDocumentType[];
  expiredDocumentTypes: VehicleDocumentType[];
}

/**
 * Computes a vehicle's overall Compliance status from its recorded
 * documents, per VEHICLE-COMPLIANCE-MATRIX.md's derivation rule exactly.
 * Pure function — no I/O, no Drive access, no DB query. Concrete code proof
 * against the matrix's rejected claim "Compliance status is derived by
 * reading Drive at request time" — this only ever looks at
 * `DocumentRecordInput[]`, values already computed and stored in FleetPo,
 * never a live file-storage read.
 */
export function computeComplianceStatus(
  documents: DocumentRecordInput[],
  ctx: ApplicabilityContext,
  options: ComplianceStatusOptions = {},
): ComplianceStatusResult {
  const now = options.now ?? new Date();
  const thresholdDays = options.expiringSoonThresholdDays ?? 30;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  const applicableResults = resolveAllApplicability(ctx).filter((r) => r.applicable);
  const byType = new Map(documents.map((d) => [d.documentType, d]));

  const missingDocumentTypes: VehicleDocumentType[] = [];
  const expiredDocumentTypes: VehicleDocumentType[] = [];
  const expiringSoonDocumentTypes: VehicleDocumentType[] = [];

  for (const result of applicableResults) {
    const doc = byType.get(result.documentType);
    if (!doc || !doc.verified) {
      // PENDING contributor: never uploaded/recorded (or not yet verified).
      missingDocumentTypes.push(result.documentType);
      continue;
    }
    if (DOCUMENT_TYPES_WITHOUT_EXPIRY.has(result.documentType)) {
      continue; // present + verified is sufficient; no expiry to check.
    }
    if (!doc.expiryDate) {
      // Has an expiry concept but none recorded — treat as missing data,
      // not silently compliant.
      missingDocumentTypes.push(result.documentType);
      continue;
    }
    const msUntilExpiry = doc.expiryDate.getTime() - now.getTime();
    if (msUntilExpiry < 0) {
      expiredDocumentTypes.push(result.documentType);
    } else if (msUntilExpiry <= thresholdMs) {
      expiringSoonDocumentTypes.push(result.documentType);
    }
  }

  // Only LEGALLY required missing/expired documents drive PENDING/EXPIRED —
  // a missing/expired policy-only document (e.g. comprehensive insurance)
  // is visible in the arrays above for UI purposes but does not, by itself,
  // block the vehicle's overall compliance status. This matches the
  // matrix's basis distinction (legal vs. policy) actually mattering, not
  // just being decorative metadata.
  const legalTypes = new Set(applicableResults.filter((r) => r.basis === 'legal').map((r) => r.documentType));
  const legallyExpired = expiredDocumentTypes.filter((t) => legalTypes.has(t));
  const legallyMissing = missingDocumentTypes.filter((t) => legalTypes.has(t));
  const legallyExpiringSoon = expiringSoonDocumentTypes.filter((t) => legalTypes.has(t));

  let status: ComplianceStatus;
  if (legallyExpired.length > 0) {
    const graceDays = options.complianceHoldGraceDays;
    const escalated = graceDays !== undefined && legallyExpired.some((t) => {
      const doc = byType.get(t);
      if (!doc?.expiryDate) return false;
      const daysPastExpiry = (now.getTime() - doc.expiryDate.getTime()) / (24 * 60 * 60 * 1000);
      return daysPastExpiry >= graceDays;
    });
    status = escalated ? 'COMPLIANCE_HOLD' : 'EXPIRED';
  } else if (legallyMissing.length > 0) {
    status = 'PENDING';
  } else if (legallyExpiringSoon.length > 0) {
    status = 'EXPIRING_SOON';
  } else {
    status = 'COMPLIANT';
  }

  return {
    status,
    blockingDocumentTypes: [...legallyExpired, ...legallyMissing],
    expiringSoonDocumentTypes,
    missingDocumentTypes,
    expiredDocumentTypes,
  };
}
