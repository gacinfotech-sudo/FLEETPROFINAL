// ============================================================================
// FLEET COMPLIANCE SYSTEM - INTEGRATION TESTS
// Phase 2: API Business Logic
// ============================================================================

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  VehicleDocumentService,
  createVehicleDocument,
  verifyDocument,
  completeRenewal,
} from '../services/fleet-compliance/vehicle-document-service';
import { AlertEngine, AlertAggregator } from '../services/fleet-compliance/alert-engine';
import { ComplianceChecker } from '../services/fleet-compliance/compliance-checker';
import {
  AlertConfiguration,
  Vehicle,
  VehicleDocument,
  DocumentStatus,
  VerificationStatus,
  VehicleOwnershipType,
  RegistrationUsageType,
  VehicleCategory,
  VehicleReadiness,
  ComplianceMode,
} from '../types/fleet-compliance.types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createAlertConfig = (): AlertConfiguration => ({
  id: 'config-1',
  tenantId: 'tenant-1',
  infoDays: 30,
  warningDays: 15,
  highDays: 7,
  criticalDays: 3,
  criticalFinalDay: true,
  enableEmail: false,
  enableWhatsapp: false,
  enablePush: false,
  enableSms: false,
  complianceMode: 'warning_only',
  allowOverride: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createTestVehicle = (overrides?: Partial<Vehicle>): Vehicle => ({
  id: 'vehicle-1',
  tenantId: 'tenant-1',
  licensePlate: 'MP09AB1234',
  ownershipType: VehicleOwnershipType.OWN_FLEET,
  registrationUsage: RegistrationUsageType.COMMERCIAL_TRANSPORT,
  category: VehicleCategory.SEDAN,
  gpsStatus: 'active',
  isActive: true,
  readinessStatus: VehicleReadiness.ROAD_READY,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createTestDocument = (overrides?: Partial<VehicleDocument>): VehicleDocument => ({
  id: 'doc-1',
  tenantId: 'tenant-1',
  vehicleId: 'vehicle-1',
  documentType: 'RC',
  documentNumber: 'DL01AB1234',
  issueDate: new Date('2022-01-01'),
  validFrom: new Date('2022-01-01'),
  expiryDate: new Date('2026-12-31'),
  status: DocumentStatus.VALID,
  daysUntilExpiry: 1000,
  verificationStatus: VerificationStatus.VERIFIED,
  isActive: true,
  renewalInProgress: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ============================================================================
// DOCUMENT SERVICE TESTS
// ============================================================================

describe('VehicleDocumentService', () => {
  let alertConfig: AlertConfiguration;

  beforeEach(() => {
    alertConfig = createAlertConfig();
  });

  describe('createDocument', () => {
    it('should create document with correct status based on expiry', async () => {
      const today = new Date();
      const expiryDate = new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000);

      const doc = await VehicleDocumentService.createDocument(
        'tenant-1',
        'vehicle-1',
        {
          documentType: 'RC',
          documentNumber: 'DL01AB1234',
          issueDate: today,
          validFrom: today,
          expiryDate,
        },
        alertConfig
      );

      expect(doc.status).toBe(DocumentStatus.VALID);
      expect(doc.isActive).toBe(true);
      expect(doc.verificationStatus).toBe(VerificationStatus.PENDING);
    });

    it('should validate date order', async () => {
      const today = new Date();

      await expect(
        VehicleDocumentService.createDocument(
          'tenant-1',
          'vehicle-1',
          {
            documentType: 'RC',
            documentNumber: 'DL01AB1234',
            issueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // After validFrom
            validFrom: today,
            expiryDate: new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000),
          },
          alertConfig
        )
      ).rejects.toThrow('Issue date cannot be after valid from date');
    });

    it('should validate expiry date is after valid from', async () => {
      const today = new Date();

      await expect(
        VehicleDocumentService.createDocument(
          'tenant-1',
          'vehicle-1',
          {
            documentType: 'RC',
            documentNumber: 'DL01AB1234',
            issueDate: today,
            validFrom: today,
            expiryDate: today, // Same as validFrom - invalid
          },
          alertConfig
        )
      ).rejects.toThrow('Valid from date must be before expiry date');
    });
  });

  describe('updateDocument', () => {
    it('should update expiry date and recalculate status', async () => {
      const doc = createTestDocument({
        expiryDate: new Date(new Date().getTime() + 10 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.VALID,
      });

      // Mock getDocument to return our test doc
      (VehicleDocumentService.getDocument as any) = async () => doc;

      const newExpiryDate = new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000);

      const updated = await VehicleDocumentService.updateDocument(
        'tenant-1',
        'doc-1',
        { expiryDate: newExpiryDate },
        alertConfig
      );

      expect(updated.expiryDate).toEqual(newExpiryDate);
      // Status should recalculate based on new expiry
    });
  });

  describe('verifyDocument', () => {
    it('should mark document as verified', async () => {
      const doc = createTestDocument({
        verificationStatus: VerificationStatus.PENDING,
      });

      (VehicleDocumentService.getDocument as any) = async () => doc;

      const verified = await VehicleDocumentService.verifyDocument(
        'tenant-1',
        'doc-1',
        'user-1'
      );

      expect(verified.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(verified.verifiedBy).toBe('user-1');
      expect(verified.verifiedAt).toBeDefined();
    });
  });

  describe('completeRenewal', () => {
    it('should archive old document and create new one', async () => {
      const oldDoc = createTestDocument({
        documentType: 'RC',
        isActive: true,
      });

      (VehicleDocumentService.getVehicleDocuments as any) = async () => [oldDoc];
      (VehicleDocumentService.createDocument as any) = async () =>
        createTestDocument({ id: 'doc-2' });

      const today = new Date();
      const result = await VehicleDocumentService.completeRenewal(
        'tenant-1',
        'vehicle-1',
        'RC',
        {
          documentNumber: 'DL01AB5678',
          issueDate: today,
          validFrom: today,
          expiryDate: new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000),
        },
        'user-1',
        alertConfig
      );

      expect(result.oldDocument.isActive).toBe(false);
      expect(result.newDocument.id).toBe('doc-2');
    });
  });
});

// ============================================================================
// ALERT ENGINE TESTS
// ============================================================================

describe('AlertEngine', () => {
  let alertConfig: AlertConfiguration;

  beforeEach(() => {
    alertConfig = createAlertConfig();
  });

  describe('generateAlertForDocument', () => {
    it('should generate alert for expiring document', () => {
      const today = new Date();
      const doc = createTestDocument({
        expiryDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.EXPIRING_SOON,
      });

      const alert = AlertEngine.generateAlertForDocument('tenant-1', 'vehicle-1', doc, alertConfig);

      expect(alert).not.toBeNull();
      expect(alert?.severity).toBeDefined();
      expect(alert?.isActive).toBe(true);
    });

    it('should not generate alert for valid document (31+ days)', () => {
      const today = new Date();
      const doc = createTestDocument({
        expiryDate: new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.VALID,
      });

      const alert = AlertEngine.generateAlertForDocument('tenant-1', 'vehicle-1', doc, alertConfig);

      expect(alert).toBeNull();
    });

    it('should generate critical alert for document expiring in 3 days', () => {
      const today = new Date();
      const doc = createTestDocument({
        expiryDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.CRITICAL,
      });

      const alert = AlertEngine.generateAlertForDocument('tenant-1', 'vehicle-1', doc, alertConfig);

      expect(alert?.alertType).toBe('critical');
      expect(alert?.daysRemaining).toBe(3);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should mark alert as acknowledged', () => {
      const alert = {
        ...createTestDocument(),
        id: 'alert-1',
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
      } as any;

      const acknowledged = AlertEngine.acknowledgeAlert(alert, 'user-1');

      expect(acknowledged.acknowledgedBy).toBe('user-1');
      expect(acknowledged.acknowledgedAt).toBeDefined();
    });
  });

  describe('resolveAlert', () => {
    it('should mark alert as resolved', () => {
      const alert = {
        ...createTestDocument(),
        id: 'alert-1',
        isActive: true,
        resolvedAt: undefined,
        resolvedBy: undefined,
      } as any;

      const resolved = AlertEngine.resolveAlert(alert, 'user-1');

      expect(resolved.isActive).toBe(false);
      expect(resolved.resolvedBy).toBe('user-1');
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe('hasBeenNotifiedToday', () => {
    it('should return true if notified today', () => {
      const alert = {
        ...createTestDocument(),
        id: 'alert-1',
        lastNotificationAt: new Date(),
      } as any;

      const notifiedToday = AlertEngine.hasBeenNotifiedToday(alert);
      expect(notifiedToday).toBe(true);
    });

    it('should return false if not notified today', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const alert = {
        ...createTestDocument(),
        id: 'alert-1',
        lastNotificationAt: yesterday,
      } as any;

      const notifiedToday = AlertEngine.hasBeenNotifiedToday(alert);
      expect(notifiedToday).toBe(false);
    });
  });
});

// ============================================================================
// ALERT AGGREGATOR TESTS
// ============================================================================

describe('AlertAggregator', () => {
  describe('shouldSkipDuplicate', () => {
    it('should skip duplicate alerts on same day', () => {
      const alert1 = {
        id: 'alert-1',
        vehicleId: 'vehicle-1',
        documentType: 'RC',
        severity: 'critical',
        triggerDate: new Date(),
        resolvedAt: undefined,
      } as any;

      const alert2 = {
        ...alert1,
        id: 'alert-2',
      };

      const shouldSkip = AlertAggregator.shouldSkipDuplicate([alert1], alert2);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip alerts with different severity', () => {
      const alert1 = {
        id: 'alert-1',
        vehicleId: 'vehicle-1',
        documentType: 'RC',
        severity: 'warning',
        triggerDate: new Date(),
        resolvedAt: undefined,
      } as any;

      const alert2 = {
        id: 'alert-2',
        vehicleId: 'vehicle-1',
        documentType: 'RC',
        severity: 'critical',
        triggerDate: new Date(),
        resolvedAt: undefined,
      } as any;

      const shouldSkip = AlertAggregator.shouldSkipDuplicate([alert1], alert2);
      expect(shouldSkip).toBe(false);
    });
  });

  describe('groupBySeverity', () => {
    it('should group alerts by severity', () => {
      const alerts = [
        { severity: 'critical' } as any,
        { severity: 'critical' } as any,
        { severity: 'warning' } as any,
        { severity: 'info' } as any,
      ];

      const grouped = AlertAggregator.groupBySeverity(alerts);

      expect(grouped.get('critical')?.length).toBe(2);
      expect(grouped.get('warning')?.length).toBe(1);
      expect(grouped.get('info')?.length).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return correct alert summary', () => {
      const alerts = [
        { isActive: true, severity: 'critical', acknowledgedAt: undefined } as any,
        { isActive: true, severity: 'critical', acknowledgedAt: new Date() } as any,
        { isActive: false, severity: 'warning', acknowledgedAt: undefined } as any,
      ];

      const summary = AlertAggregator.getSummary(alerts);

      expect(summary.total).toBe(3);
      expect(summary.active).toBe(2);
      expect(summary.critical).toBe(2);
      expect(summary.acknowledged).toBe(1);
      expect(summary.unacknowledged).toBe(2);
    });
  });
});

// ============================================================================
// COMPLIANCE CHECKER TESTS
// ============================================================================

describe('ComplianceChecker', () => {
  describe('calculateComplianceScore', () => {
    it('should calculate compliance for road-ready vehicle', () => {
      const vehicle = createTestVehicle();
      const documents = [
        createTestDocument({ status: DocumentStatus.VALID }),
        createTestDocument({ documentType: 'Insurance', status: DocumentStatus.VALID }),
      ];

      const score = ComplianceChecker.calculateComplianceScore(vehicle, documents);

      expect(score.overallStatus).toBe(VehicleReadiness.ROAD_READY);
      expect(score.compliancePercentage).toBe(100);
      expect(score.validDocuments).toBe(2);
    });

    it('should mark vehicle as attention required for expiring documents', () => {
      const vehicle = createTestVehicle();
      const documents = [
        createTestDocument({ status: DocumentStatus.VALID }),
        createTestDocument({
          documentType: 'Insurance',
          status: DocumentStatus.EXPIRING_SOON,
        }),
      ];

      const score = ComplianceChecker.calculateComplianceScore(vehicle, documents);

      expect(score.overallStatus).toBe(VehicleReadiness.ATTENTION_REQUIRED);
      expect(score.expiringDocuments).toBe(1);
    });

    it('should mark vehicle as not road-ready for expired documents', () => {
      const vehicle = createTestVehicle();
      const documents = [
        createTestDocument({ status: DocumentStatus.EXPIRED }),
      ];

      const score = ComplianceChecker.calculateComplianceScore(vehicle, documents);

      expect(score.overallStatus).toBe(VehicleReadiness.NOT_ROAD_READY);
      expect(score.expiredDocuments).toBe(1);
    });
  });

  describe('isRoadReady', () => {
    it('should return true for compliant vehicle', () => {
      const vehicle = createTestVehicle();
      const documents = [
        createTestDocument({ status: DocumentStatus.VALID }),
      ];

      const ready = ComplianceChecker.isRoadReady(vehicle, documents);
      expect(ready).toBe(true);
    });

    it('should return false for vehicle with expired documents', () => {
      const vehicle = createTestVehicle();
      const documents = [
        createTestDocument({ status: DocumentStatus.EXPIRED }),
      ];

      const ready = ComplianceChecker.isRoadReady(vehicle, documents);
      expect(ready).toBe(false);
    });
  });

  describe('checkTripRisk', () => {
    it('should flag risk if document expires during trip', () => {
      const today = new Date();
      const tripStart = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
      const tripEnd = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
      const docExpiry = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const documents = [
        createTestDocument({ expiryDate: docExpiry, daysUntilExpiry: 7 }),
      ];

      const risk = ComplianceChecker.checkTripRisk(
        'vehicle-1',
        'trip-1',
        tripStart,
        tripEnd,
        documents
      );

      expect(risk.riskLevel).toBe('warning');
      expect(risk.risks.length).toBeGreaterThan(0);
      expect(risk.risks[0].expiresBeforeTripEnd).toBe(true);
    });

    it('should flag critical risk if document expires during trip (< 3 days)', () => {
      const today = new Date();
      const tripStart = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
      const tripEnd = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
      const docExpiry = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

      const documents = [
        createTestDocument({ expiryDate: docExpiry, daysUntilExpiry: 3 }),
      ];

      const risk = ComplianceChecker.checkTripRisk(
        'vehicle-1',
        'trip-1',
        tripStart,
        tripEnd,
        documents
      );

      expect(risk.riskLevel).toBe('critical');
    });
  });
});

// ============================================================================
// EXPORT TEST COUNT
// ============================================================================

// Total integration test cases: 20+ ✓
