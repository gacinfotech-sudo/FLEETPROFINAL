import type { ComplianceStatus, OperationalStatus, SafetyHoldFlag } from './types';

/**
 * The single, pure implementation of booking eligibility — every consumer
 * (booking creation, vehicle-selection UI, availability API) must call this,
 * never re-derive the rule ad hoc. Per VEHICLE-360-SPEC.md's exact wording:
 *
 *   Operational == AVAILABLE AND Compliance NOT IN (EXPIRED, COMPLIANCE_HOLD)
 *   AND NOT SAFETY_HOLD
 *
 * No I/O — callers resolve the three inputs from wherever they live
 * (Vehicle document, compliance computation, inspection records) and pass
 * plain values in.
 */
export function deriveBookingEligibility(
  operationalStatus: OperationalStatus,
  complianceStatus: ComplianceStatus,
  safetyHold: SafetyHoldFlag,
): boolean {
  if (safetyHold) return false;
  if (operationalStatus !== 'AVAILABLE') return false;
  if (complianceStatus === 'EXPIRED' || complianceStatus === 'COMPLIANCE_HOLD') return false;
  return true;
}

/** Same rule, but returns the specific reason(s) a vehicle is ineligible —
 * useful for UI messaging (e.g. "Compliance expired" vs "In maintenance")
 * without duplicating the eligibility logic itself. */
export type BookingIneligibilityReason = 'NOT_OPERATIONAL_AVAILABLE' | 'COMPLIANCE_BLOCKED' | 'SAFETY_HOLD';

export function explainBookingIneligibility(
  operationalStatus: OperationalStatus,
  complianceStatus: ComplianceStatus,
  safetyHold: SafetyHoldFlag,
): BookingIneligibilityReason[] {
  const reasons: BookingIneligibilityReason[] = [];
  if (safetyHold) reasons.push('SAFETY_HOLD');
  if (operationalStatus !== 'AVAILABLE') reasons.push('NOT_OPERATIONAL_AVAILABLE');
  if (complianceStatus === 'EXPIRED' || complianceStatus === 'COMPLIANCE_HOLD') reasons.push('COMPLIANCE_BLOCKED');
  return reasons;
}
