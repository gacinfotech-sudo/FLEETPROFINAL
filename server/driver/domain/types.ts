// TASK-DRIVER-DOMAIN-02 — shared types/constants for the driver lifecycle domain.
//
// lifecycleStage is a NEW, second axis alongside the EXISTING Driver.status
// field (`'available' | 'on_duty' | 'inactive'`, unchanged — see
// server/models/index.ts:90). Do not conflate the two: status answers "is
// this driver on a duty right now", lifecycleStage answers "where is this
// driver in the hiring/employment lifecycle". A driver can be
// lifecycleStage='active' and status='on_duty' simultaneously.
//
// Per docs/driver-research/DRIVER-LIFECYCLE-SPEC.md §1, this also resolves
// the confirmed dead-code inconsistency at server/routes.ts:1921
// (`d.status === 'suspended'` — 'suspended' was never in Driver.status's
// enum). Resolution chosen: 'suspended' becomes a lifecycleStage value (it
// was already listed as one in the spec's state-machine diagram), NOT a
// status value — status's existing 3-value enum is left completely
// untouched, matching the manifest's explicit "do not touch status's
// semantics" instruction. See eligibility.ts and the proposed routes.ts
// patch in the task report for the call-site fix.

export const LIFECYCLE_STAGES = [
  'candidate',
  'application',
  'document_collection',
  'identity_verification',
  'police_verification',
  'medical_fitness',
  'reference_verification',
  'employment_verification',
  'training',
  'approved',
  'active',
  'suspended',
  'on_leave',
  'offboarding',
  'offboarded',
] as const;

export type LifecycleStage = typeof LIFECYCLE_STAGES[number];

// Every existing Driver document today predates this field entirely, and
// (until the server/models/index.ts patch in this task's report is
// applied) the field isn't even declared on the schema, so Mongoose never
// hydrates it — `driver.lifecycleStage` reads as `undefined` for every
// document, old or new. Every read in this module must go through this
// helper rather than trusting a schema `default`, so behavior is identical
// before and after the schema patch lands. Per the spec: absent means the
// driver already exists today, so it is — by construction — already past
// onboarding.
export const DEFAULT_LIFECYCLE_STAGE: LifecycleStage = 'active';

export function effectiveLifecycleStage(driver: { lifecycleStage?: string | null } | null | undefined): LifecycleStage {
  const stage = driver?.lifecycleStage;
  return (stage && (LIFECYCLE_STAGES as readonly string[]).includes(stage))
    ? (stage as LifecycleStage)
    : DEFAULT_LIFECYCLE_STAGE;
}

export const CONTACT_CATEGORIES = [
  'spouse', 'parent', 'sibling', 'other_family', 'friend',
  'professional_reference', 'previous_employer', 'local_guardian',
  'emergency_medical_contact', 'nominee', 'other',
] as const;
export type ContactCategory = typeof CONTACT_CATEGORIES[number];

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const CONSENT_STATUSES = ['not_requested', 'pending', 'granted', 'declined'] as const;
export type ConsentStatus = typeof CONSENT_STATUSES[number];

export const NOTIFICATION_STATUSES = ['not_notified', 'notified', 'acknowledged'] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

// Zero-block onboarding policy (docs/driver-recovery/DRIVER-ZERO-BLOCK-ONBOARDING-REPORT.md
// §6): the tenant's standing contact target is 10, not an opt-in exception —
// "CONTACT TARGET = 10" is the default, so the free-to-add threshold equals
// the hard ceiling and no tenant has to configure a businessPurpose just to
// reach the number the business already asked for. Contacts remain
// completely optional for onboarding either way; this only governs where
// the (still-enforced) absolute ceiling and its consent/notification
// bookkeeping kick in. Was previously 4 — raising it to 10 is the fix for a
// real, verified block: contactService.createDriverContact() threw
// ContactPolicyViolationError on a driver's 5th contact by default.
export const DEFAULT_CONTACT_THRESHOLD = 10;
// Absolute ceiling regardless of tenant policy (matrix: "configurable
// maximum up to 10").
export const HARD_MAX_CONTACTS = 10;

// Advisory-only targets for lifecycle stages that legitimately gate actual
// road-operation readiness (e.g. 'approved') rather than Driver
// creation/save/onboarding, which must never be blocked by these. Not
// currently enforced as a hard requirement anywhere in this module — see
// eligibility.ts for the one real (and narrowly-scoped, assignment-only)
// gate this codebase enforces today.
export const MIN_EMERGENCY_CONTACTS = 2;
export const MIN_VERIFIED_REFERENCES = 2;

export interface ActorRef {
  userId: string;
  role: string;
}
