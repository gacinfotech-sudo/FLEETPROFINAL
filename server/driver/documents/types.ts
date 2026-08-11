// Shared types for the driver-document / Google Drive module.
// Governed by docs/driver-research/GOOGLE-DRIVE-SECURITY-SPEC.md and
// docs/driver-research/DRIVER-DOCUMENT-MATRIX.md — every DocumentType value
// below must have a matching Drive subfolder name (see services/folderService.ts's
// DOCUMENT_TYPE_FOLDER_NAMES, which reuses these exact strings as folder names)
// and a matching row in the matrix doc. Keep the three in sync.

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

// Access tiers, reusing DRIVER-DATA-MINIMIZATION-MATRIX.md's field-level PII
// sensitivity tiers, applied here to whole documents. Standard < Medium < High.
export const ACCESS_CLASSIFICATIONS = ['standard', 'medium', 'high'] as const;
export type AccessClassification = typeof ACCESS_CLASSIFICATIONS[number];

// Per DRIVER-DOCUMENT-MATRIX.md's Classification/Access tier column.
export const DOCUMENT_TYPE_ACCESS_CLASSIFICATION: Record<DocumentType, AccessClassification> = {
  driving_license: 'standard',
  psv_badge: 'standard',
  police_verification_certificate: 'high',
  medical_fitness_certificate: 'high',
  identity_proof: 'high',
  address_proof: 'medium',
  photograph: 'standard',
  educational_certificate: 'standard',
  bank_proof: 'high',
  insurance_proof: 'high',
  previous_employment_reference_letter: 'medium',
  training_completion_certificate: 'standard',
  vehicle_handover_acknowledgement: 'standard',
  other: 'medium', // tenant-defined per upload; medium is a safe default, never auto-downgraded to standard
};

// Per DRIVER-DOCUMENT-MATRIX.md's "Expiry-bearing?" column.
export const DOCUMENT_TYPE_EXPIRY_BEARING: Record<DocumentType, boolean> = {
  driving_license: true,
  psv_badge: true,
  police_verification_certificate: false, // "optionally" per matrix — not enforced, but allowed
  medical_fitness_certificate: true,
  identity_proof: false,
  address_proof: false,
  photograph: false,
  educational_certificate: false,
  bank_proof: false,
  insurance_proof: true,
  previous_employment_reference_letter: false,
  training_completion_certificate: false, // "optionally" per matrix
  vehicle_handover_acknowledgement: false,
  other: false,
};

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = typeof VERIFICATION_STATUSES[number];

// Retention lifecycle per GOOGLE-DRIVE-SECURITY-SPEC.md's "Retention" section —
// offboarding moves a driver's documents into retention_hold, never straight to
// deletion. eligible_for_erasure is a tenant-policy-driven, adviser-informed
// transition out of retention_hold; this module never performs the actual erasure
// automatically.
export const RETENTION_STATUSES = ['active', 'retention_hold', 'eligible_for_erasure'] as const;
export type RetentionStatus = typeof RETENTION_STATUSES[number];

export const DRIVE_AUTH_TYPES = ['service_account', 'oauth_consent'] as const;
export type DriveAuthType = typeof DRIVE_AUTH_TYPES[number];

export const DRIVE_CONNECTION_STATUSES = [
  'configuration_required',
  'testing',
  'connected',
  'authentication_failed',
  'provider_unavailable',
  'disabled',
] as const;
export type DriveConnectionStatus = typeof DRIVE_CONNECTION_STATUSES[number];
