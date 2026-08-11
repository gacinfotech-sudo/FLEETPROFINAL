// ============================================================================
// FLEET COMPLIANCE & DOCUMENT EXPIRY SYSTEM - TYPE DEFINITIONS
// Phase 1: Core Data Models
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export enum VehicleOwnershipType {
  OWN_FLEET = 'own_fleet',
  VENDOR_VEHICLE = 'vendor_vehicle',
  ATTACHED_VEHICLE = 'attached_vehicle',
  LEASED_VEHICLE = 'leased_vehicle',
}

export enum RegistrationUsageType {
  COMMERCIAL_TRANSPORT = 'commercial_transport',
  PRIVATE_NON_TRANSPORT = 'private_non_transport',
}

export enum VehicleCategory {
  HATCHBACK = 'hatchback',
  SEDAN = 'sedan',
  SUV = 'suv',
  MUV = 'muv',
  TEMPO_TRAVELLER = 'tempo_traveller',
  BUS = 'bus',
  OTHER = 'other',
}

export enum DocumentStatus {
  VALID = 'valid',
  EXPIRING_SOON = 'expiring_soon',
  CRITICAL = 'critical',
  EXPIRED = 'expired',
  MISSING = 'missing',
  NOT_APPLICABLE = 'not_applicable',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  NEEDS_RENEWAL = 'needs_renewal',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ComplianceMode {
  WARNING_ONLY = 'warning_only',
  APPROVAL_REQUIRED = 'approval_required',
  HARD_BLOCK = 'hard_block',
}

export enum VehicleReadiness {
  ROAD_READY = 'road_ready',
  ATTENTION_REQUIRED = 'attention_required',
  NOT_ROAD_READY = 'not_road_ready',
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

/**
 * Extended Vehicle model with compliance fields
 */
export interface Vehicle {
  id: string;
  tenantId: string;
  licensePlate: string;
  ownershipType: VehicleOwnershipType;
  registrationUsage: RegistrationUsageType;
  category: VehicleCategory;
  gpsStatus?: string;
  isActive: boolean;
  readinessStatus: VehicleReadiness;
  lastComplianceCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document type master - defines what documents apply to which vehicles
 */
export interface DocumentTypeMaster {
  id: string;
  tenantId: string;
  documentType: string;
  displayName: string;
  description?: string;

  // Applicability rules
  applicableToCommercial: boolean;
  applicableToPrivate: boolean;
  applicableToOwnFleet: boolean;
  applicableToVendor: boolean;
  applicableToLeased: boolean;
  applicableVehicleCategories?: VehicleCategory[];

  // Validation rules
  isMandatory: boolean;
  requiresVerification: boolean;

  // Renewal
  renewalFrequencyDays?: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vehicle Document - stores actual documents with auto-derived status
 */
export interface VehicleDocument {
  id: string;
  tenantId: string;
  vehicleId: string;

  // Document identification
  documentType: string;
  documentNumber: string;

  // Validity dates
  issueDate: Date;
  validFrom: Date;
  expiryDate: Date;

  // Document details
  issuingAuthority?: string;
  fileReference?: string; // S3/storage path
  remarks?: string;

  // Status (auto-derived)
  status: DocumentStatus;
  daysUntilExpiry?: number; // cached

  // Verification
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: Date;

  // Lifecycle
  isActive: boolean;
  renewalInProgress: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document History - maintains audit trail of renewals
 */
export interface DocumentHistory {
  id: string;
  tenantId: string;
  vehicleId: string;
  documentType: string;

  // Old document
  oldDocumentId?: string;
  oldDocumentNumber?: string;
  oldValidityEnd?: Date;
  oldFileReference?: string;

  // New document
  newDocumentNumber: string;
  newValidityStart: Date;
  newValidityEnd: Date;
  newFileReference?: string;

  // Renewal details
  renewalDate: Date;
  renewedBy: string;
  verifiedBy?: string;
  verifiedAt?: Date;

  // Reason
  renewalReason?: string;

  createdAt: Date;
}

/**
 * Document Alert - tracks active alerts with lifecycle
 */
export interface DocumentAlert {
  id: string;
  tenantId: string;
  vehicleId: string;
  documentId: string;

  // Alert details
  documentType: string;
  alertType: string; // 'expiring_soon', 'expired', 'critical'
  severity: AlertSeverity;

  // Timing
  triggerDate: Date;
  expiryDate: Date;
  daysRemaining: number;

  // Status
  isActive: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;

  // Notification tracking
  notificationSent: boolean;
  notificationCount: number;
  lastNotificationAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compliance Override - tracks exceptions to compliance rules
 */
export interface ComplianceOverride {
  id: string;
  tenantId: string;
  vehicleId: string;
  bookingId?: string;

  // What was overridden
  documentType: string;
  reasonCode: string; // 'pending_renewal', 'admin_approval', etc
  reasonText: string;

  // Who overrode
  overriddenBy: string;
  overriddenAt: Date;

  // Duration
  validUntil?: Date;

  // Audit
  isActive: boolean;
}

/**
 * Insurance Details
 */
export interface InsuranceDetails {
  id: string;
  tenantId: string;
  vehicleId: string;

  // Policy
  policyNumber: string;
  insurer: string;
  policyType?: string;

  // Validity
  startDate: Date;
  expiryDate: Date;

  // Reference
  fileReference?: string;
  idv?: number; // Insured Declared Value

  // Contact
  claimContact?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permit Records - supports multiple permits per vehicle
 */
export interface PermitRecord {
  id: string;
  tenantId: string;
  vehicleId: string;

  // Permit
  permitNumber: string;
  permitType?: string; // 'national', 'state', 'local'
  territory?: string; // State/region

  // Validity
  validFrom: Date;
  validUntil: Date;

  // Document
  fileReference?: string;

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vehicle Maintenance
 */
export interface VehicleMaintenance {
  id: string;
  tenantId: string;
  vehicleId: string;

  // Due dates/KM
  serviceDueDate?: Date;
  serviceDueKm?: number;

  oilChangeKm?: number;
  tyreCheckKm?: number;
  brakeCheckKm?: number;
  batteryCheckKm?: number;
  generalServiceKm?: number;

  // Current status
  lastServiceDate?: Date;
  lastServiceKm?: number;

  // Alert
  isOverdue: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert Configuration - tenant-specific thresholds
 */
export interface AlertConfiguration {
  id: string;
  tenantId: string;

  // Thresholds (days before expiry)
  infoDays: number; // 30
  warningDays: number; // 15
  highDays: number; // 7
  criticalDays: number; // 3
  criticalFinalDay: boolean; // 1 day before

  // Notifications
  enableEmail: boolean;
  enableWhatsapp: boolean;
  enablePush: boolean;
  enableSms: boolean;

  // Behavior
  complianceMode: ComplianceMode;
  allowOverride: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CALCULATED/DERIVED TYPES
// ============================================================================

/**
 * Compliance Score - overall vehicle compliance status
 */
export interface ComplianceScore {
  vehicleId: string;
  overallStatus: VehicleReadiness;
  compliancePercentage: number; // 0-100
  totalDocuments: number;
  validDocuments: number;
  expiringDocuments: number;
  criticalDocuments: number;
  expiredDocuments: number;
  missingDocuments: number;
  lastCalculated: Date;
  nextAlertDate?: Date;
}

/**
 * Trip Risk Assessment - check if trip is safe given document expiry
 */
export interface TripRiskAssessment {
  vehicleId: string;
  tripId: string;
  tripStartDate: Date;
  tripEndDate: Date;
  riskLevel: 'safe' | 'warning' | 'critical' | 'blocked';
  risks: {
    documentType: string;
    expiryDate: Date;
    expiresBeforeTripEnd: boolean;
    message: string;
  }[];
  recommendedAction: string;
}

/**
 * Booking Compliance Check Result
 */
export interface BookingComplianceResult {
  vehicleId: string;
  bookingId: string;
  isCompliant: boolean;
  mode: ComplianceMode;
  issues: {
    documentType: string;
    status: DocumentStatus;
    severity: AlertSeverity;
    message: string;
  }[];
  requiresApproval: boolean;
  isBlocked: boolean;
  approvalRequired?: {
    approvedBy?: string;
    approvedAt?: Date;
    reason?: string;
  };
}

/**
 * Vehicle Compliance Summary (for UI display)
 */
export interface VehicleComplianceSummary {
  vehicleId: string;
  licensePlate: string;
  overallStatus: VehicleReadiness;
  documents: {
    documentType: string;
    documentNumber?: string;
    expiryDate: Date;
    daysRemaining: number;
    status: DocumentStatus;
    severity?: AlertSeverity;
    actions: string[];
  }[];
  latestAlerts: DocumentAlert[];
  nextExpiryDate?: Date;
  compliancePercentage: number;
  lastUpdated: Date;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateDocumentRequest {
  documentType: string;
  documentNumber: string;
  issueDate: Date;
  validFrom: Date;
  expiryDate: Date;
  issuingAuthority?: string;
  fileReference?: string;
  remarks?: string;
}

export interface UpdateDocumentRequest {
  documentNumber?: string;
  expiryDate?: Date;
  issuingAuthority?: string;
  remarks?: string;
  verificationStatus?: VerificationStatus;
}

export interface RenewDocumentRequest {
  newDocumentNumber: string;
  newValidFrom: Date;
  newExpiryDate: Date;
  fileReference?: string;
  renewalReason?: string;
}

export interface CreateAlertRequest {
  documentType: string;
  severity: AlertSeverity;
}

export interface AcknowledgeAlertRequest {
  acknowledgedAt: Date;
}
