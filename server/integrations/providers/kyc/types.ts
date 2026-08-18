/**
 * KYC/DigiLocker Integration Types
 * Defines interfaces and types for Know Your Customer and DigiLocker integration
 * Supports OAuth2, document fetching, verification, and compliance tracking
 */

/**
 * Document types supported
 */
export type DocumentType =
  | 'AADHAR'
  | 'DRIVING_LICENSE'
  | 'VEHICLE_REGISTRATION'
  | 'PAN_CARD'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'BANK_STATEMENT'
  | 'UTILITY_BILL'
  | 'CUSTOM';

/**
 * Document verification status
 */
export type DocumentVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'UNDER_REVIEW'
  | 'MANUAL_REVIEW_REQUIRED';

/**
 * KYC verification status
 */
export type KYCVerificationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUSPENDED';

/**
 * KYC risk level assessment
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * DigiLocker OAuth states
 */
export type DigiLockerOAuthState = 'pending' | 'authorized' | 'token_received' | 'revoked' | 'error';

/**
 * Document metadata from DigiLocker
 */
export interface DigiLockerDocument {
  documentId: string;
  type: DocumentType;
  issueDate?: Date;
  expiryDate?: Date;
  issuer?: string;
  number?: string;
  status: DocumentVerificationStatus;
  metadata?: Record<string, any>;
}

/**
 * KYC document stored in system
 */
export interface KYCDocument {
  id: string;
  tenantId: string;
  customerId?: string;
  type: DocumentType;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  issuer?: string;
  status: DocumentVerificationStatus;
  verificationTimestamp?: Date;
  verificationScore?: number; // 0-100
  encryptedData: {
    encrypted: string;
    iv: string;
    authTag: string;
    algorithm: string;
  };
  fileUrl?: string;
  fileHash?: string;
  mimeType?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  archivedAt?: Date;
}

/**
 * KYC verification result
 */
export interface KYCVerificationResult {
  verificationId: string;
  customerId: string;
  tenantId: string;
  status: KYCVerificationStatus;
  riskLevel: RiskLevel;
  verifiedDocuments: string[]; // Document IDs
  rejectedDocuments?: string[]; // Document IDs
  verificationScore: number; // 0-100
  verifiedAt?: Date;
  expiresAt?: Date;
  reason?: string;
  checks: {
    documentAuthenticity: boolean;
    documentExpiry: boolean;
    selfieMatch?: boolean;
    addressVerification?: boolean;
    pep?: boolean; // Politically Exposed Person
  };
  metadata?: Record<string, any>;
}

/**
 * DigiLocker OAuth session
 */
export interface DigiLockerSession {
  tenantId: string;
  customerId?: string;
  state: DigiLockerOAuthState;
  stateToken?: string;
  stateOAuth?: DigiLockerOAuthState;
  clientId: string;
  redirectUri: string;
  authorizationCode?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  codeVerifier?: string;
  scopesRequested: string[];
  scopesGranted?: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Webhook event from DigiLocker
 */
export interface DigiLockerWebhookEvent {
  eventId: string;
  eventType: 'document.verified' | 'document.rejected' | 'verification.completed' | 'verification.failed';
  timestamp: Date;
  customerId?: string;
  tenantId: string;
  data: Record<string, any>;
  signature?: string;
  retryCount?: number;
}

/**
 * KYC provider interface
 */
export interface IKYCProvider {
  readonly providerKey: string;

  /**
   * Get DigiLocker OAuth authorization URL
   */
  getAuthorizationUrl(tenantId: string, customerId?: string): Promise<{ url: string; state: string }>;

  /**
   * Exchange authorization code for token
   */
  exchangeAuthorizationCode(
    tenantId: string,
    code: string,
    state: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }>;

  /**
   * Get session status
   */
  getSessionStatus(tenantId: string, customerId?: string): Promise<DigiLockerSession>;

  /**
   * Fetch documents from DigiLocker
   */
  fetchDocuments(tenantId: string, accessToken: string, customerId?: string): Promise<DigiLockerDocument[]>;

  /**
   * Retrieve and store a document
   */
  retrieveDocument(
    tenantId: string,
    documentId: string,
    accessToken: string,
  ): Promise<KYCDocument>;

  /**
   * Verify KYC
   */
  verifyKYC(
    tenantId: string,
    customerId: string,
    documents: string[], // Document IDs
  ): Promise<KYCVerificationResult>;

  /**
   * Get verification result
   */
  getVerificationResult(verificationId: string): Promise<KYCVerificationResult>;

  /**
   * Re-verify KYC (for expired verifications)
   */
  reverifyKYC(tenantId: string, customerId: string): Promise<KYCVerificationResult>;

  /**
   * Revoke OAuth session
   */
  revokeSession(tenantId: string, customerId?: string): Promise<void>;

  /**
   * Handle incoming webhook
   */
  handleWebhook(event: DigiLockerWebhookEvent): Promise<void>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;

  /**
   * Get document storage
   */
  getDocumentStorage(): DocumentStorage;

  /**
   * Get audit trail
   */
  getAuditTrail(
    tenantId: string,
    customerId?: string,
    limit?: number,
  ): Promise<AuditEntry[]>;
}

/**
 * Document storage interface
 */
export interface DocumentStorage {
  /**
   * Store document
   */
  store(document: KYCDocument): Promise<void>;

  /**
   * Retrieve document
   */
  retrieve(documentId: string): Promise<KYCDocument | null>;

  /**
   * Retrieve customer documents
   */
  retrieveByCustomer(customerId: string, tenantId: string): Promise<KYCDocument[]>;

  /**
   * Update document status
   */
  updateStatus(documentId: string, status: DocumentVerificationStatus): Promise<void>;

  /**
   * Archive document
   */
  archive(documentId: string): Promise<void>;

  /**
   * Delete document (GDPR)
   */
  delete(documentId: string): Promise<void>;

  /**
   * Search documents
   */
  search(
    tenantId: string,
    filters: {
      customerId?: string;
      type?: DocumentType;
      status?: DocumentVerificationStatus;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<KYCDocument[]>;
}

/**
 * Audit entry
 */
export interface AuditEntry {
  id: string;
  tenantId: string;
  customerId?: string;
  action: AuditAction;
  resource: string;
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  timestamp: Date;
  changes?: Record<string, any>;
  reason?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit actions
 */
export type AuditAction =
  | 'OAUTH_START'
  | 'OAUTH_AUTHORIZE'
  | 'OAUTH_REVOKE'
  | 'DOCUMENT_FETCH'
  | 'DOCUMENT_STORE'
  | 'DOCUMENT_VERIFY'
  | 'DOCUMENT_ARCHIVE'
  | 'KYC_VERIFY'
  | 'KYC_REVERIFY'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_PROCESSED'
  | 'COMPLIANCE_CHECK'
  | 'GDPR_EXPORT'
  | 'GDPR_DELETE'
  | 'ERROR';

/**
 * Compliance data for GDPR
 */
export interface ComplianceData {
  tenantId: string;
  customerId: string;
  dataCollectionDate: Date;
  dataTypes: string[];
  purpose: string;
  legalBasis: string;
  consentObtained: boolean;
  consentDate?: Date;
  retention: number; // Days
  expiryDate: Date;
}

/**
 * KYC adapter initialization options
 */
export interface KYCAdapterOptions {
  tenantId: string;
  provider: 'digilocker' | 'mock' | 'custom';
  config?: Record<string, any>;
  credentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    webhookSecret?: string;
  };
  encryptionKey?: string;
  logger?: any;
}

/**
 * KYC re-verification configuration
 */
export interface ReVerificationConfig {
  enabled: boolean;
  intervalDays?: number; // Days between re-verification
  autoReVerify?: boolean;
  notifyDaysBeforeExpiry?: number;
}

/**
 * KYC batch verification result
 */
export interface BatchVerificationResult {
  batchId: string;
  totalDocuments: number;
  verifiedDocuments: number;
  rejectedDocuments: number;
  pendingDocuments: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  results: {
    documentId: string;
    status: DocumentVerificationStatus;
    verificationScore?: number;
    reason?: string;
  }[];
}
