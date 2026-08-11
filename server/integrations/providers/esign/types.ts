/**
 * eSign/Digital Agreement Provider Types
 * Defines interfaces for electronic signatures, digital agreements, and compliance tracking
 * Supports IS 2509, ISO 27001, GDPR compliance
 */

/**
 * Digital signature status
 */
export type SignatureStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'revoked'
  | 'archived';

/**
 * Agreement status
 */
export type AgreementStatus =
  | 'draft'
  | 'active'
  | 'pending_signature'
  | 'fully_signed'
  | 'partially_signed'
  | 'declined'
  | 'expired'
  | 'terminated'
  | 'archived';

/**
 * Signing flow type
 */
export type SigningFlowType = 'sequential' | 'parallel';

/**
 * Party type in agreement
 */
export type PartyType =
  | 'individual'
  | 'business'
  | 'representative'
  | 'witness'
  | 'notary';

/**
 * DSC (Digital Signature Certificate) type
 */
export type DSCType = 'class2' | 'class3';

/**
 * Signature method
 */
export type SignatureMethod =
  | 'dsc'
  | 'otp'
  | 'biometric'
  | 'password'
  | 'multi_factor';

/**
 * Audit action type
 */
export type AuditAction =
  | 'created'
  | 'sent'
  | 'initiated'
  | 'viewed'
  | 'signed'
  | 'declined'
  | 'modified'
  | 'expired'
  | 'revoked'
  | 'downloaded'
  | 'archived';

/**
 * Compliance framework
 */
export type ComplianceFramework =
  | 'IS_2509'
  | 'IEC_61508'
  | 'ISO_27001'
  | 'GDPR'
  | 'EIDAS';

/**
 * eSign provider credentials
 */
export interface ESignProviderCredentials {
  apiKey: string;
  apiSecret: string;
  dscPath?: string;
  dscPassword?: string;
  webhookUrl?: string;
  timestampAuthority?: string;
  encryptionKey?: string;
}

/**
 * Digital Signature Certificate info
 */
export interface DSCInfo {
  certificateId: string;
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
  dscType: DSCType;
  keyLength: number;
  algorithm: string;
  fingerprint: string;
  status: 'valid' | 'expired' | 'revoked' | 'suspended';
}

/**
 * Agreement template variable
 */
export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'address';
  required: boolean;
  defaultValue?: string;
  validation?: string;
  description?: string;
}

/**
 * Agreement template
 */
export interface AgreementTemplate {
  templateId: string;
  name: string;
  description: string;
  category: string;
  content: string; // Handlebars template
  variables: TemplateVariable[];
  requiredSignatories: number;
  signingFlow: SigningFlowType;
  expiryDays: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  complianceFrameworks: ComplianceFramework[];
}

/**
 * Party in agreement
 */
export interface AgreementParty {
  partyId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  type: PartyType;
  identityProof?: {
    documentType: string;
    documentNumber: string;
    verifiedAt?: Date;
  };
  signatureOrder?: number; // For sequential signing
  signedAt?: Date;
  signatureMethod?: SignatureMethod;
  dscSerialNumber?: string; // For DSC-based signatures
}

/**
 * Agreement instance
 */
export interface Agreement {
  agreementId: string;
  templateId: string;
  tenantId: string;
  title: string;
  description: string;
  content: string;
  variables: Record<string, string>;
  parties: AgreementParty[];
  status: AgreementStatus;
  signingFlow: SigningFlowType;
  createdBy: string;
  createdAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  documentHash: string; // SHA-256 hash for integrity
  documentEncryption?: {
    algorithm: string;
    encryptedContent: string;
    iv: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Signature record
 */
export interface SignatureRecord {
  signatureId: string;
  agreementId: string;
  partyId: string;
  signatureMethod: SignatureMethod;
  signatureHash: string; // Hash of signature bytes
  timestamp: Date;
  timestampToken?: string; // RFC 3161 timestamp
  dscSerialNumber?: string;
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  signatureImage?: string; // Base64 encoded for wet signatures
  biometricData?: {
    type: 'fingerprint' | 'face' | 'iris';
    templateData: string; // Encrypted biometric template
  };
  auditTrail?: AuditTrailEntry[];
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  action: AuditAction;
  performedBy: string;
  performedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  description?: string;
  changes?: Record<string, [string, string]>; // Before/after values
}

/**
 * Signature initiation request
 */
export interface SignatureInitiationRequest {
  agreementId: string;
  partyId: string;
  signatureMethod: SignatureMethod;
  dscCertificate?: DSCInfo;
  redirectUrl?: string;
  otpDeliveryMethod?: 'email' | 'sms' | 'whatsapp';
  metadata?: Record<string, unknown>;
}

/**
 * Signature completion request
 */
export interface SignatureCompletionRequest {
  agreementId: string;
  partyId: string;
  signatureMethod: SignatureMethod;
  signatureData: {
    hash: string;
    signature: string; // Base64 encoded signature bytes
    timestamp?: string;
    dscSerialNumber?: string;
    certificateChain?: string[];
  };
  biometricData?: {
    type: 'fingerprint' | 'face' | 'iris';
    liveness: boolean;
    confidence: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  signatureId: string;
  agreementId: string;
  partyId: string;
  verifiedAt: Date;
  signatureMethod: SignatureMethod;
  certificateValid: boolean;
  timestampValid: boolean;
  documentHashValid: boolean;
  dscStatus?: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Agreement search query
 */
export interface AgreementSearchQuery {
  tenantId: string;
  status?: AgreementStatus;
  partyId?: string;
  templateId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchText?: string;
  limit?: number;
  offset?: number;
}

/**
 * Agreement search result
 */
export interface AgreementSearchResult {
  agreements: Agreement[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * eSign provider interface
 */
export interface IESignProvider {
  readonly providerKey: string;

  /**
   * Test connection with credentials
   */
  testConnection(credentials: ESignProviderCredentials): Promise<{ ok: boolean; message: string }>;

  /**
   * Create agreement from template
   */
  createAgreement(params: {
    tenantId: string;
    templateId: string;
    title: string;
    variables: Record<string, string>;
    parties: AgreementParty[];
    signingFlow: SigningFlowType;
    expiryDays: number;
  }): Promise<Agreement>;

  /**
   * Send agreement for signing
   */
  sendForSignature(agreementId: string): Promise<{ sentAt: Date; nextSigner?: string }>;

  /**
   * Initiate signature process
   */
  initiateSignature(request: SignatureInitiationRequest): Promise<{
    signatureSessionId: string;
    signingUrl?: string;
    otpSent?: boolean;
  }>;

  /**
   * Complete signature
   */
  completeSignature(request: SignatureCompletionRequest): Promise<SignatureRecord>;

  /**
   * Verify signature
   */
  verifySignature(signatureId: string): Promise<SignatureVerificationResult>;

  /**
   * Get agreement
   */
  getAgreement(agreementId: string): Promise<Agreement>;

  /**
   * List agreements
   */
  listAgreements(query: AgreementSearchQuery): Promise<AgreementSearchResult>;

  /**
   * Download signed document
   */
  downloadDocument(agreementId: string): Promise<Buffer>;

  /**
   * Get audit trail
   */
  getAuditTrail(agreementId: string): Promise<AuditTrailEntry[]>;

  /**
   * Revoke signature
   */
  revokeSignature(signatureId: string, reason: string): Promise<void>;

  /**
   * Archive agreement
   */
  archiveAgreement(agreementId: string): Promise<void>;

  /**
   * Get compliance report
   */
  getComplianceReport(
    agreementId: string,
    frameworks: ComplianceFramework[],
  ): Promise<Record<ComplianceFramework, Record<string, boolean>>>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(rawBody: Buffer): Promise<Record<string, unknown>>;
}

/**
 * Webhook payload for signing events
 */
export interface ESignWebhookPayload {
  eventType:
    | 'agreement.created'
    | 'agreement.sent'
    | 'signature.initiated'
    | 'signature.completed'
    | 'signature.declined'
    | 'agreement.fully_signed'
    | 'agreement.expired'
    | 'agreement.revoked';
  timestamp: Date;
  agreementId: string;
  partyId?: string;
  signatureId?: string;
  data: Record<string, unknown>;
  signature?: string;
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  framework: ComplianceFramework;
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    description: string;
    evidence?: string;
  }[];
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;
  createdAt: Date;
  modifiedAt: Date;
  hash: string;
  encryption?: {
    algorithm: string;
    keyId: string;
  };
}
