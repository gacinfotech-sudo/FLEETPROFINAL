// TASK-DRIVER-OPERATIONS-06 — shared types/constants for driver operations:
// incidents, challans, training, and suspension/offboarding.
//
// These are genuinely NEW record types. They are deliberately NOT a
// duplication of server/services/driverFeedbackService.ts's customer-
// complaint-driven view (CustomerComplaint, linked by driverId) — that
// mechanism stays untouched and is READ, not rebuilt, by
// incidentService.ts's combined view. An "incident" here is an internally
// reported/administrative event (accident, internal safety report, policy
// violation, etc.), which today has no representation at all in the schema
// — the audit found only customer-complaint-driven signal existed.

export const INCIDENT_TYPES = [
  'accident',
  'vehicle_damage',
  'safety_violation',
  'rash_driving_report', // internally reported, distinct from a customer complaint's 'rash_driving' category
  'policy_violation',
  'altercation',
  'documentation_issue',
  'other',
] as const;
export type IncidentType = typeof INCIDENT_TYPES[number];

export const INCIDENT_SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const;
export type IncidentSeverity = typeof INCIDENT_SEVERITIES[number];

export const INCIDENT_STATUSES = ['reported', 'under_review', 'substantiated', 'unsubstantiated', 'closed'] as const;
export type IncidentStatus = typeof INCIDENT_STATUSES[number];

export const CHALLAN_VIOLATION_TYPES = [
  'speeding',
  'signal_jump',
  'illegal_parking',
  'overloading',
  'no_documents',
  'lane_violation',
  'mobile_phone_use',
  'other',
] as const;
export type ChallanViolationType = typeof CHALLAN_VIOLATION_TYPES[number];

export const CHALLAN_STATUSES = ['pending', 'paid', 'disputed', 'waived'] as const;
export type ChallanStatus = typeof CHALLAN_STATUSES[number];

export const TRAINING_TYPES = [
  'defensive_driving',
  'first_aid',
  'company_orientation',
  'vehicle_specific',
  'safety_refresher',
  'regulatory_compliance',
  'customer_service',
  'other',
] as const;
export type TrainingType = typeof TRAINING_TYPES[number];

export const TRAINING_STATUSES = ['scheduled', 'completed', 'expired', 'cancelled'] as const;
export type TrainingStatus = typeof TRAINING_STATUSES[number];

export interface ActorRef {
  userId: string;
  role: string;
}
