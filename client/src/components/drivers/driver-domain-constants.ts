// Shared client-side mirrors of TASK-DRIVER-DOMAIN-02 and
// TASK-DRIVER-DOCUMENTS-03's proposed-but-not-yet-applied server enums and
// transition rules (see .claude/tasks/reports/TASK-DRIVER-DOMAIN-02-REPORT.md
// and TASK-DRIVER-DOCUMENTS-03-REPORT.md — both worktrees' actual shipped
// route/model files were read directly to source these exact values, not
// guessed). Kept as plain constants (no import from server code — this is
// the client bundle) so the wizard/360 UI can render valid options and
// client-side hints without an extra round trip; the server remains the
// real source of truth/validation for every mutation.

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

export const DEFAULT_LIFECYCLE_STAGE: LifecycleStage = 'active';

export function effectiveLifecycleStage(driver: { lifecycleStage?: string | null } | null | undefined): LifecycleStage {
  const stage = driver?.lifecycleStage;
  return stage && (LIFECYCLE_STAGES as readonly string[]).includes(stage) ? (stage as LifecycleStage) : DEFAULT_LIFECYCLE_STAGE;
}

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  candidate: 'Candidate',
  application: 'Application',
  document_collection: 'Document Collection',
  identity_verification: 'Identity Verification',
  police_verification: 'Police Verification',
  medical_fitness: 'Medical Fitness',
  reference_verification: 'Reference Verification',
  employment_verification: 'Employment Verification',
  training: 'Training',
  approved: 'Approved',
  active: 'Active',
  suspended: 'Suspended',
  on_leave: 'On Leave',
  offboarding: 'Offboarding',
  offboarded: 'Offboarded',
};

// The onboarding "happy path" chain, used only to render a progress
// stepper — mirrors lifecycleService.ts's ONBOARDING_CHAIN exactly.
export const ONBOARDING_CHAIN: LifecycleStage[] = [
  'candidate', 'application', 'document_collection', 'identity_verification',
  'police_verification', 'medical_fitness', 'reference_verification',
  'employment_verification', 'training', 'approved', 'active',
];

function buildTransitionMap(): Record<LifecycleStage, LifecycleStage[]> {
  const map = {} as Record<LifecycleStage, LifecycleStage[]>;
  for (const stage of LIFECYCLE_STAGES) map[stage] = [];
  ONBOARDING_CHAIN.forEach((stage, i) => {
    const next = ONBOARDING_CHAIN[i + 1];
    if (next) map[stage].push(next);
  });
  map.active.push('suspended', 'on_leave', 'offboarding');
  map.suspended.push('active', 'offboarding');
  map.on_leave.push('active', 'offboarding');
  map.offboarding.push('offboarded');
  for (const stage of LIFECYCLE_STAGES) {
    if (stage !== 'offboarding' && stage !== 'offboarded' && !map[stage].includes('offboarding')) {
      map[stage].push('offboarding');
    }
  }
  return map;
}

// Client-side hint only — the server (lifecycleService.ts's own copy of
// this exact map) is the real gate; a stale client render never allows an
// actually-invalid transition to succeed, it can only make the UI's
// "next stage" picker slightly out of date until refetch.
export const LIFECYCLE_TRANSITIONS = buildTransitionMap();

export function getValidNextStages(current: LifecycleStage): LifecycleStage[] {
  return LIFECYCLE_TRANSITIONS[current] ?? [];
}

export function lifecycleStageBadgeClass(stage: LifecycleStage): string {
  if (stage === 'active' || stage === 'approved') return 'bg-green-100 text-green-800 border-green-200';
  if (stage === 'suspended' || stage === 'offboarding' || stage === 'offboarded') return 'bg-red-100 text-red-800 border-red-200';
  if (stage === 'on_leave') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-blue-100 text-blue-800 border-blue-200'; // onboarding-in-progress stages
}

export const CONTACT_CATEGORIES = [
  'spouse', 'parent', 'sibling', 'other_family', 'friend',
  'professional_reference', 'previous_employer', 'local_guardian',
  'emergency_medical_contact', 'nominee', 'other',
] as const;
export type ContactCategory = typeof CONTACT_CATEGORIES[number];

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  spouse: 'Spouse', parent: 'Parent', sibling: 'Sibling', other_family: 'Other Family',
  friend: 'Friend', professional_reference: 'Professional Reference', previous_employer: 'Previous Employer',
  local_guardian: 'Local Guardian', emergency_medical_contact: 'Emergency/Medical Contact',
  nominee: 'Nominee', other: 'Other',
};

export const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

export const CONSENT_STATUSES = ['not_requested', 'pending', 'granted', 'declined'] as const;
export type ConsentStatus = typeof CONSENT_STATUSES[number];

export const NOTIFICATION_STATUSES = ['not_notified', 'notified', 'acknowledged'] as const;
export type NotificationStatus = typeof NOTIFICATION_STATUSES[number];

// Zero-block onboarding policy: tenant contact target is 10 by default
// (mirrors server/driver/domain/types.ts's DEFAULT_CONTACT_THRESHOLD — keep
// these two constants in sync). Was 4; raising it removed a real block
// where a driver's 5th contact was rejected unless an admin had opted the
// tenant into a higher policy limit.
export const DEFAULT_CONTACT_THRESHOLD = 10;

export function verificationBadgeClass(status: string): string {
  switch (status) {
    case 'verified': return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
    case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

// ---------------------------------------------------------------------------
// TASK-DRIVER-DOCUMENTS-03 mirrors (DRIVER-DOCUMENT-MATRIX.md).
// ---------------------------------------------------------------------------
export const DOCUMENT_TYPES = [
  'driving_license',
  'psv_badge',
  'police_verification_certificate',
  'medical_fitness_certificate',
  'identity_proof',
  'address_proof',
  'photograph',
  'educational_certificate',
  'bank_proof',
  'insurance_proof',
  'previous_employment_reference_letter',
  'training_completion_certificate',
  'vehicle_handover_acknowledgement',
  'other',
] as const;
export type DocumentType = typeof DOCUMENT_TYPES[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  driving_license: 'Driving License',
  psv_badge: 'PSV Badge',
  police_verification_certificate: 'Police Verification Certificate',
  medical_fitness_certificate: 'Medical Fitness Certificate',
  identity_proof: 'Identity Proof (Aadhaar/PAN/Passport/Voter ID)',
  address_proof: 'Address Proof',
  photograph: 'Photograph',
  educational_certificate: 'Educational Certificate',
  bank_proof: 'Bank Proof',
  insurance_proof: 'Insurance Proof',
  previous_employment_reference_letter: 'Previous Employment Reference Letter',
  training_completion_certificate: 'Training Completion Certificate',
  vehicle_handover_acknowledgement: 'Vehicle Handover Acknowledgement',
  other: 'Other',
};

export const DOCUMENT_TYPE_EXPIRY_BEARING: Record<DocumentType, boolean> = {
  driving_license: true,
  psv_badge: true,
  police_verification_certificate: false,
  medical_fitness_certificate: true,
  identity_proof: false,
  address_proof: false,
  photograph: false,
  educational_certificate: false,
  bank_proof: false,
  insurance_proof: true,
  previous_employment_reference_letter: false,
  training_completion_certificate: false,
  vehicle_handover_acknowledgement: false,
  other: false,
};

export interface DriverDocumentListView {
  id: string;
  driverId: string;
  documentType: DocumentType;
  label?: string;
  maskedDocumentNumber?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationReason?: string;
  verifiedBy?: string;
  verificationTime?: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadTime: string;
  currentVersionNumber: number;
  versionCount: number;
  retentionStatus: 'active' | 'retention_hold' | 'eligible_for_erasure';
  accessClassification: 'standard' | 'medium' | 'high';
  hasFileAccess: boolean;
}

export type DocumentComplianceStatus = 'expired' | 'expiring_soon' | 'rejected' | 'pending_verification' | 'verified' | 'uploaded';

const EXPIRING_SOON_WINDOW_DAYS = 30;

export function documentComplianceStatus(doc: DriverDocumentListView): DocumentComplianceStatus {
  if (doc.verificationStatus === 'rejected') return 'rejected';
  if (doc.expiryDate) {
    const expiry = new Date(doc.expiryDate).getTime();
    const now = Date.now();
    if (expiry < now) return 'expired';
    if (expiry - now < EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000) return 'expiring_soon';
  }
  if (doc.verificationStatus === 'pending') return 'pending_verification';
  if (doc.verificationStatus === 'verified') return 'verified';
  return 'uploaded';
}

export const COMPLIANCE_STATUS_LABELS: Record<DocumentComplianceStatus, string> = {
  expired: 'Expired',
  expiring_soon: 'Expiring Soon',
  rejected: 'Rejected',
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  uploaded: 'Uploaded',
};

export function complianceBadgeClass(status: DocumentComplianceStatus): string {
  switch (status) {
    case 'expired':
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'expiring_soon':
    case 'pending_verification':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'verified':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function accessClassificationBadgeClass(tier: string): string {
  if (tier === 'high') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (tier === 'medium') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

// ---------------------------------------------------------------------------
// Display-only PII masking (defense-in-depth). The legacy Driver.aadharNumber
// / Driver.panNumber fields (server/models/index.ts) are plaintext at rest
// and TASK-DRIVER-DOMAIN-02's server-side maskDriverPII() is proposed but not
// yet wired into GET /api/drivers (see that task's report, "Proposed
// patches" §3) — this is a UI-only fallback so the 360 view never renders
// the raw number even before that server patch lands. It is NOT a substitute
// for the server-side patch (a network inspector still sees the raw
// response) and the edit form still uses the real value so it can be edited.
export function maskAadharForDisplay(value?: string | null): string {
  if (!value) return 'Not provided';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return 'XXXX XXXX XXXX';
  const last4 = digits.slice(-4);
  return `XXXX XXXX ${last4}`;
}

export function maskPanForDisplay(value?: string | null): string {
  if (!value) return 'Not provided';
  const v = value.trim().toUpperCase();
  if (v.length < 4) return 'XXXXXXXXXX';
  return `${'X'.repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}
