// Breakdown / Accident / Challan tracking (TASK-VEHICLE-INCIDENTS-05).
// The genuinely-missing three pieces confirmed by CURRENT-FLEET-MODULE-
// AUDIT.md's duplication check — VehicleHandover already exists and is not
// rebuilt here.

/** Strict forward sequence — the dispatch requirement's own workflow,
 * verbatim. No skipping, no backward transition modeled (not asked for by
 * the requirement; if a real misdiagnosis-reopen flow is needed later,
 * that's a new, explicit transition to design, not a silent allowance
 * here). */
export const BREAKDOWN_WORKFLOW_SEQUENCE = [
  'reported',
  'diagnosis',
  'assistance_tow',
  'workshop',
  'repair',
  'qa',
  'available',
] as const;
export type BreakdownWorkflowState = typeof BREAKDOWN_WORKFLOW_SEQUENCE[number];

/**
 * `reviewStatus` is deliberately an open review-state enum, never a boolean
 * "driverAtFault" shortcut — per the requirement's explicit "Do not
 * automatically decide driver fault." `under_review` is the only state a
 * new AccidentEvent can start in; every other value requires a human
 * reviewer action.
 */
export type AccidentReviewStatus = 'under_review' | 'fault_determined_driver' | 'fault_determined_other_party' | 'fault_determined_no_fault' | 'closed_no_determination';

/** Same principle as AccidentReviewStatus — an explicit, human-set
 * liability record, never inferred or defaulted. `null`/unset means "not
 * yet decided," which is the only safe default. */
export type ChallanResponsibilityDecision = 'driver_responsible' | 'company_responsible' | 'disputed' | 'waived';
