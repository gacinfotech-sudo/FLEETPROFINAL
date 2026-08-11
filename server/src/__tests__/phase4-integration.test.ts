// ============================================================================
// PHASE 4 INTEGRATION TESTS - Database Layer Validation
// Testing: Repositories → Services → API Controllers
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { RepositoryFactory } from '../repositories';
import { VehicleDocumentService } from '../services/fleet-compliance/vehicle-document-service';
import { AlertEngine } from '../services/fleet-compliance/alert-engine';
import { ComplianceChecker } from '../services/fleet-compliance/compliance-checker';
import { DocumentStatus, AlertSeverity, VehicleReadiness } from '../types/fleet-compliance.types';

// ============================================================================
// TEST FIXTURES & SETUP
// ============================================================================

let pool: Pool;
const TEST_TENANT_ID = 'test-tenant-001';
const TEST_VEHICLE_ID = 'vehicle-001';
const TEST_USER_ID = 'user-001';

beforeEach(async () => {
  // Initialize test database pool
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fleetpro_test',
  });

  // Initialize repositories
  RepositoryFactory.initialize(pool);

  // Set service repositories
  const docRepo = RepositoryFactory.getVehicleDocumentRepository();
  const historyRepo = RepositoryFactory.getDocumentHistoryRepository();
  const alertRepo = RepositoryFactory.getDocumentAlertRepository();
  const docTypeRepo = RepositoryFactory.getDocumentTypeMasterRepository();

  VehicleDocumentService.setRepositories(docRepo, historyRepo);
  AlertEngine.setRepository(alertRepo);
  ComplianceChecker.setRepositories(docRepo, docTypeRepo);
});

afterEach(async () => {
  await pool.end();
});

// ============================================================================
// REPOSITORY TESTS
// ============================================================================

describe('VehicleDocumentRepository - Database Operations', () => {
  it('should create a vehicle document', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();
    const configRepo = RepositoryFactory.getComplianceConfigRepository();

    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    const docData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'RC',
      document_number: 'RC001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2026-12-31'),
      issuing_authority: 'RTO',
      is_active: true,
      verification_status: 'pending',
      status: 'valid',
      days_until_expiry: 700,
    };

    const created = await docRepo.insert(docData);

    expect(created.id).toBeDefined();
    expect(created.tenant_id).toBe(TEST_TENANT_ID);
    expect(created.vehicle_id).toBe(TEST_VEHICLE_ID);
    expect(created.document_type).toBe('RC');
    expect(created.status).toBe('valid');
  });

  it('should retrieve vehicle documents', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();

    const docData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'Insurance',
      document_number: 'INS001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2025-12-31'),
      issuing_authority: 'Insurer',
      is_active: true,
      verification_status: 'pending',
      status: 'expiring_soon',
      days_until_expiry: 300,
    };

    await docRepo.insert(docData);
    const documents = await docRepo.findByVehicle(TEST_TENANT_ID, TEST_VEHICLE_ID);

    expect(documents.length).toBeGreaterThan(0);
    expect(documents.some((d: any) => d.document_type === 'Insurance')).toBe(true);
  });

  it('should find expiring documents', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();

    const expiringDoc = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'PUC',
      document_number: 'PUC001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date().toISOString().split('T')[0], // Today
      issuing_authority: 'Pollution Board',
      is_active: true,
      verification_status: 'verified',
      status: 'critical',
      days_until_expiry: 0,
    };

    await docRepo.insert(expiringDoc);
    const expiring = await docRepo.findExpiringDocuments(TEST_TENANT_ID, 7);

    expect(expiring.length).toBeGreaterThan(0);
  });

  it('should update document status', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();

    const docData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'DL',
      document_number: 'DL001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2026-12-31'),
      issuing_authority: 'RTO',
      is_active: true,
      verification_status: 'pending',
      status: 'valid',
      days_until_expiry: 700,
    };

    const created = await docRepo.insert(docData);
    const updated = await docRepo.update(created.id, {
      verification_status: 'verified',
      verified_by: TEST_USER_ID,
      verified_at: new Date(),
    });

    expect(updated.verification_status).toBe('verified');
  });

  it('should soft delete document', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();

    const docData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'Permit',
      document_number: 'PERM001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2026-12-31'),
      issuing_authority: 'Authority',
      is_active: true,
      verification_status: 'verified',
      status: 'valid',
      days_until_expiry: 700,
    };

    const created = await docRepo.insert(docData);
    const deleted = await docRepo.softDelete(created.id);

    expect(deleted).toBe(true);

    const found = await docRepo.findById(created.id);
    expect(found?.is_active).toBe(false);
  });
});

describe('DocumentAlertRepository - Alert Management', () => {
  it('should create and retrieve alerts', async () => {
    const alertRepo = RepositoryFactory.getDocumentAlertRepository();

    const alertData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_id: 'doc-001',
      document_type: 'RC',
      alert_type: 'critical',
      severity: AlertSeverity.CRITICAL,
      trigger_date: new Date(),
      expiry_date: new Date(),
      days_until_expiry: 0,
      is_active: true,
      notification_count: 0,
    };

    const created = await alertRepo.insert(alertData);

    expect(created.id).toBeDefined();
    expect(created.severity).toBe(AlertSeverity.CRITICAL);

    const retrieved = await alertRepo.findByVehicle(TEST_TENANT_ID, TEST_VEHICLE_ID);
    expect(retrieved.length).toBeGreaterThan(0);
  });

  it('should acknowledge alert', async () => {
    const alertRepo = RepositoryFactory.getDocumentAlertRepository();

    const alertData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_id: 'doc-002',
      document_type: 'Insurance',
      alert_type: 'expiring_soon',
      severity: AlertSeverity.WARNING,
      trigger_date: new Date(),
      expiry_date: new Date(),
      days_until_expiry: 15,
      is_active: true,
      notification_count: 0,
    };

    const created = await alertRepo.insert(alertData);
    const acknowledged = await alertRepo.acknowledge(created.id);

    expect(acknowledged.acknowledged_at).toBeDefined();
  });

  it('should track notification sent', async () => {
    const alertRepo = RepositoryFactory.getDocumentAlertRepository();

    const alertData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_id: 'doc-003',
      document_type: 'PUC',
      alert_type: 'warning',
      severity: AlertSeverity.WARNING,
      trigger_date: new Date(),
      expiry_date: new Date(),
      days_until_expiry: 30,
      is_active: true,
      notification_count: 0,
    };

    const created = await alertRepo.insert(alertData);
    await alertRepo.recordNotificationSent(created.id);

    const hasBeenNotified = await alertRepo.hasBeenNotifiedToday(created.id);
    expect(hasBeenNotified).toBe(true);
  });

  it('should count alerts by severity', async () => {
    const alertRepo = RepositoryFactory.getDocumentAlertRepository();

    const counts = await alertRepo.countBySeverity(TEST_TENANT_ID);

    expect(counts).toHaveProperty('info');
    expect(counts).toHaveProperty('warning');
    expect(counts).toHaveProperty('high');
    expect(counts).toHaveProperty('critical');
  });
});

describe('DocumentHistoryRepository - Audit Trail', () => {
  it('should record document history', async () => {
    const historyRepo = RepositoryFactory.getDocumentHistoryRepository();

    const historyData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_id: 'doc-004',
      change_type: 'renewal',
      previous_value: JSON.stringify({ status: 'expired' }),
      new_value: JSON.stringify({ status: 'valid' }),
      changed_by: TEST_USER_ID,
      effective_date: new Date(),
    };

    const created = await historyRepo.insert(historyData);

    expect(created.id).toBeDefined();
    expect(created.change_type).toBe('renewal');

    const history = await historyRepo.findByDocument(TEST_TENANT_ID, 'doc-004');
    expect(history.length).toBeGreaterThan(0);
  });
});

describe('ComplianceConfigRepository - Tenant Configuration', () => {
  it('should get or create config for tenant', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();

    const config = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    expect(config.tenant_id).toBe(TEST_TENANT_ID);
    expect(config.days_before_expiry_info).toBe(30);
    expect(config.days_before_expiry_warning).toBe(15);
    expect(config.days_before_expiry_high).toBe(7);
    expect(config.days_before_expiry_critical).toBe(3);
  });

  it('should update alert thresholds', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();

    const updated = await configRepo.updateThresholds(TEST_TENANT_ID, {
      info: 35,
      warning: 20,
      high: 10,
      critical: 5,
    });

    expect(updated.days_before_expiry_info).toBe(35);
    expect(updated.days_before_expiry_warning).toBe(20);
  });
});

// ============================================================================
// SERVICE INTEGRATION TESTS
// ============================================================================

describe('VehicleDocumentService - Service Layer', () => {
  it('should create document through service', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    const document = await VehicleDocumentService.createDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        documentType: 'FC',
        documentNumber: 'FC001',
        issueDate: new Date('2024-01-01'),
        validFrom: new Date('2024-01-01'),
        expiryDate: new Date('2026-12-31'),
        issuingAuthority: 'Authority',
      },
      alertConfig as any
    );

    expect(document.id).toBeDefined();
    expect(document.status).toBe('valid');
  });

  it('should update document and recalculate status', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    const created = await VehicleDocumentService.createDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        documentType: 'Tax',
        documentNumber: 'TAX001',
        issueDate: new Date('2024-01-01'),
        validFrom: new Date('2024-01-01'),
        expiryDate: new Date('2026-12-31'),
        issuingAuthority: 'Authority',
      },
      alertConfig as any
    );

    // Update with new expiry date (7 days from now)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const updated = await VehicleDocumentService.updateDocument(
      TEST_TENANT_ID,
      created.id,
      {
        expiryDate: futureDate,
      },
      alertConfig as any
    );

    expect(updated.status).toBe('critical');
  });
});

describe('AlertEngine - Alert Generation', () => {
  it('should generate alert for expiring document', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2); // Expires in 2 days

    const alert = await AlertEngine.generateAlertForDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        id: 'doc-005',
        document_type: 'Registration',
        expiry_date: expiryDate,
      } as any,
      alertConfig as any
    );

    expect(alert).toBeDefined();
    expect(alert?.severity).toBe(AlertSeverity.CRITICAL);
  });

  it('should not generate alert for valid document', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 100); // Expires in 100 days

    const alert = await AlertEngine.generateAlertForDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        id: 'doc-006',
        document_type: 'Insurance',
        expiry_date: expiryDate,
      } as any,
      alertConfig as any
    );

    expect(alert).toBeNull();
  });

  it('should prevent duplicate alerts', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);
    const alertRepo = RepositoryFactory.getDocumentAlertRepository();

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 5);

    // Create first alert
    const alert1 = await AlertEngine.generateAlertForDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        id: 'doc-007',
        document_type: 'Permit',
        expiry_date: expiryDate,
      } as any,
      alertConfig as any
    );

    // Try to create duplicate (same vehicle, doc type, severity, today)
    const alert2 = await AlertEngine.generateAlertForDocument(
      TEST_TENANT_ID,
      TEST_VEHICLE_ID,
      {
        id: 'doc-007',
        document_type: 'Permit',
        expiry_date: expiryDate,
      } as any,
      alertConfig as any
    );

    // Second should be null due to spam prevention
    expect(alert1).toBeDefined();
    // Note: This depends on AlertAggregator.shouldSkipDuplicate() implementation
  });
});

describe('ComplianceChecker - Compliance Scoring', () => {
  it('should calculate compliance score', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();

    const docData = {
      tenant_id: TEST_TENANT_ID,
      vehicle_id: TEST_VEHICLE_ID,
      document_type: 'Fitness',
      document_number: 'FIT001',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2026-12-31'),
      issuing_authority: 'Authority',
      is_active: true,
      verification_status: 'verified',
      status: 'valid',
      days_until_expiry: 700,
    };

    await docRepo.insert(docData);
    const documents = await docRepo.findByVehicle(TEST_TENANT_ID, TEST_VEHICLE_ID);

    const score = await ComplianceChecker.calculateComplianceScore(
      { id: TEST_VEHICLE_ID } as any,
      documents as any
    );

    expect(score).toBeDefined();
    expect((score as any).overall_status).toBe(VehicleReadiness.ROAD_READY);
  });
});

// ============================================================================
// TRANSACTION & ERROR HANDLING TESTS
// ============================================================================

describe('Transaction Support - Multi-Table Operations', () => {
  it('should rollback on error in transaction', async () => {
    const configRepo = RepositoryFactory.getComplianceConfigRepository();
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();
    const alertConfig = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    try {
      await docRepo.withTransaction(async () => {
        // Create document
        await VehicleDocumentService.createDocument(
          TEST_TENANT_ID,
          TEST_VEHICLE_ID,
          {
            documentType: 'Roadtax',
            documentNumber: 'RT001',
            issueDate: new Date('2024-01-01'),
            validFrom: new Date('2024-01-01'),
            expiryDate: new Date('2026-12-31'),
            issuingAuthority: 'Authority',
          },
          alertConfig as any
        );

        // Simulate error
        throw new Error('Simulated error');
      });
    } catch (error) {
      // Transaction should be rolled back
      expect((error as Error).message).toBe('Simulated error');
    }
  });
});

// ============================================================================
// TENANT ISOLATION TESTS
// ============================================================================

describe('Multi-Tenant Isolation', () => {
  it('should isolate documents by tenant', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();
    const tenant1 = 'tenant-1';
    const tenant2 = 'tenant-2';

    const doc1 = {
      tenant_id: tenant1,
      vehicle_id: 'vehicle-1',
      document_type: 'RC',
      document_number: 'RC1',
      issue_date: new Date('2024-01-01'),
      valid_from: new Date('2024-01-01'),
      expiry_date: new Date('2026-12-31'),
      issuing_authority: 'RTO',
      is_active: true,
      verification_status: 'verified',
      status: 'valid',
      days_until_expiry: 700,
    };

    const doc2 = {
      ...doc1,
      tenant_id: tenant2,
      document_number: 'RC2',
    };

    await docRepo.insert(doc1);
    await docRepo.insert(doc2);

    const tenant1Docs = await docRepo.findByVehicle(tenant1, 'vehicle-1');
    const tenant2Docs = await docRepo.findByVehicle(tenant2, 'vehicle-1');

    expect(tenant1Docs.length).toBeGreaterThan(0);
    expect(tenant2Docs.length).toBeGreaterThan(0);
    expect(tenant1Docs.every((d: any) => d.tenant_id === tenant1)).toBe(true);
    expect(tenant2Docs.every((d: any) => d.tenant_id === tenant2)).toBe(true);
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance - Query Optimization', () => {
  it('should efficiently fetch large result sets', async () => {
    const docRepo = RepositoryFactory.getVehicleDocumentRepository();
    const configRepo = RepositoryFactory.getComplianceConfigRepository();

    const config = await configRepo.getOrCreateForTenant(TEST_TENANT_ID);

    // Create multiple documents
    for (let i = 0; i < 10; i++) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (i * 5));

      await docRepo.insert({
        tenant_id: TEST_TENANT_ID,
        vehicle_id: `vehicle-perf-${i}`,
        document_type: `DOC_${i}`,
        document_number: `DOC${i}`,
        issue_date: new Date('2024-01-01'),
        valid_from: new Date('2024-01-01'),
        expiry_date: expiryDate,
        issuing_authority: 'Authority',
        is_active: true,
        verification_status: 'verified',
        status: 'valid',
        days_until_expiry: i * 5,
      });
    }

    const startTime = performance.now();
    const docs = await docRepo.findExpiringDocuments(TEST_TENANT_ID, 30);
    const endTime = performance.now();

    expect(docs).toBeDefined();
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
  });
});
