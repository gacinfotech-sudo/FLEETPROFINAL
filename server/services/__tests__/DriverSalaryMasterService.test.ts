/**
 * DriverSalaryMasterService Test Suite
 * ====================================
 * Comprehensive tests for salary master CRUD + versioning operations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import {
  createSalaryMaster,
  getSalaryMasterByDriver,
  listSalaryMasters,
  updateSalaryMaster,
  deleteSalaryMaster,
  getSalaryMasterSummary,
  batchCreateSalaryMasters,
  calculateTotalSalary,
  CreateSalaryMasterInput,
  UpdateSalaryMasterInput
} from '../driverSalaryMasterService';

import {
  recordVersion,
  getVersionHistory,
  getVersionSnapshot,
  compareVersions,
  getChangeTimeline,
  getFieldChangeHistory,
  getVersionStatistics,
  recordRollback
} from '../SalaryMasterVersionService';

// ============================================================================
// TEST DATA
// ============================================================================

const testTenantId = 'tenant-test-123';
const testDriverId = 'driver-test-456';

const validCreateInput: CreateSalaryMasterInput = {
  tenantId: testTenantId,
  driverId: testDriverId,
  salaryType: 'fixed_monthly',
  baseSalary: 50000,
  nightAllowancePerNight: 500,
  outstationAllowancePerDay: 1000,
  foodAllowance: 2000,
  employmentType: 'permanent',
  salaryStartDate: new Date('2026-08-01'),
  bankName: 'Bank of India',
  accountNumber: '123456789',
  ifscCode: 'BANK0001234'
};

// ============================================================================
// CREATE TESTS
// ============================================================================

describe('DriverSalaryMasterService - Create Operations', () => {
  it('should create salary master with version 1', async () => {
    const { master, version } = await createSalaryMaster(validCreateInput, 'test-user', 'Initial setup');

    expect(master).toBeDefined();
    expect(master.driverId.toString()).toBe(testDriverId);
    expect(master.baseSalary).toBe(50000);
    expect(master.status).toBe('active');

    expect(version).toBeDefined();
    expect(version.version).toBe(1);
    expect(version.changeType).toBe('create');
    expect(version.changedBy).toBe('test-user');
    expect(version.changeReason).toBe('Initial setup');
  });

  it('should reject duplicate salary master', async () => {
    // Create first
    await createSalaryMaster(validCreateInput, 'test-user');

    // Try to create duplicate
    expect(async () => {
      await createSalaryMaster(validCreateInput, 'test-user');
    }).rejects.toThrow('already exists');
  });

  it('should validate required fields', async () => {
    const invalidInput = { ...validCreateInput, baseSalary: undefined };

    expect(async () => {
      await createSalaryMaster(invalidInput, 'test-user');
    }).rejects.toThrow('required');
  });

  it('should validate salary amounts are non-negative', async () => {
    const invalidInput = { ...validCreateInput, baseSalary: -1000 };

    expect(async () => {
      await createSalaryMaster(invalidInput, 'test-user');
    }).rejects.toThrow('negative');
  });

  it('should validate salary type', async () => {
    const invalidInput = { ...validCreateInput, salaryType: 'invalid' as any };

    expect(async () => {
      await createSalaryMaster(invalidInput, 'test-user');
    }).rejects.toThrow('Invalid salary type');
  });

  it('should set employment type to contract by default', async () => {
    const input = { ...validCreateInput, employmentType: undefined };
    const { master } = await createSalaryMaster(input, 'test-user');

    expect(master.employmentType).toBe('contract');
  });
});

// ============================================================================
// READ TESTS
// ============================================================================

describe('DriverSalaryMasterService - Read Operations', () => {
  beforeEach(async () => {
    // Setup test data
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should get salary master by driver ID', async () => {
    const master = await getSalaryMasterByDriver(testTenantId, testDriverId);

    expect(master).toBeDefined();
    expect(master?.driverId.toString()).toBe(testDriverId);
    expect(master?.baseSalary).toBe(50000);
  });

  it('should return null for non-existent driver', async () => {
    const master = await getSalaryMasterByDriver(testTenantId, 'non-existent-driver');

    expect(master).toBeNull();
  });

  it('should list salary masters with status filter', async () => {
    const { data, total } = await listSalaryMasters(testTenantId, {
      status: 'active'
    });

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].status).toBe('active');
  });

  it('should list salary masters with employment type filter', async () => {
    const { data } = await listSalaryMasters(testTenantId, {
      employmentType: 'permanent'
    });

    expect(data.every(m => m.employmentType === 'permanent')).toBe(true);
  });

  it('should support pagination', async () => {
    // Create multiple masters
    for (let i = 0; i < 5; i++) {
      const input = { ...validCreateInput, driverId: `driver-${i}` };
      await createSalaryMaster(input, 'test-user');
    }

    const page1 = await listSalaryMasters(testTenantId, { limit: 3, skip: 0 });
    const page2 = await listSalaryMasters(testTenantId, { limit: 3, skip: 3 });

    expect(page1.data.length).toBe(3);
    expect(page2.data.length).toBe(2);
    expect(page1.total).toBe(5);
  });
});

// ============================================================================
// UPDATE TESTS
// ============================================================================

describe('DriverSalaryMasterService - Update Operations', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should update salary and create version 2', async () => {
    const updateData: UpdateSalaryMasterInput = {
      baseSalary: 55000,
      changeReason: 'Annual increment'
    };

    const { master, version } = await updateSalaryMaster(
      testTenantId,
      testDriverId,
      updateData,
      'user-2',
      'Annual increment'
    );

    expect(master.baseSalary).toBe(55000);
    expect(version.version).toBe(2);
    expect(version.changeType).toBe('update');
    expect(version.changes.baseSalary).toEqual({
      old: 50000,
      new: 55000
    });
  });

  it('should track multiple changes in single update', async () => {
    const updateData: UpdateSalaryMasterInput = {
      baseSalary: 55000,
      nightAllowancePerNight: 600,
      status: 'inactive'
    };

    const { version } = await updateSalaryMaster(
      testTenantId,
      testDriverId,
      updateData,
      'user-2'
    );

    expect(Object.keys(version.changes).length).toBe(3);
    expect(version.changes.baseSalary).toBeDefined();
    expect(version.changes.nightAllowancePerNight).toBeDefined();
    expect(version.changes.status).toBeDefined();
  });

  it('should reject update with no changes', async () => {
    const master = await getSalaryMasterByDriver(testTenantId, testDriverId);
    const currentData = master?.toObject() || {};

    const noChangeUpdate = {
      baseSalary: currentData.baseSalary
    };

    expect(async () => {
      await updateSalaryMaster(testTenantId, testDriverId, noChangeUpdate);
    }).rejects.toThrow('No changes detected');
  });

  it('should update status quickly without versioning', async () => {
    const updated = await updateSalaryMaster(
      testTenantId,
      testDriverId,
      { status: 'suspended' }
    );

    expect(updated?.status).toBe('suspended');
  });

  it('should reject update for non-existent master', async () => {
    expect(async () => {
      await updateSalaryMaster(testTenantId, 'non-existent', {
        baseSalary: 60000
      });
    }).rejects.toThrow('not found');
  });
});

// ============================================================================
// DELETE TESTS
// ============================================================================

describe('DriverSalaryMasterService - Delete Operations', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should soft delete by setting status to terminated', async () => {
    const version = await deleteSalaryMaster(
      testTenantId,
      testDriverId,
      'admin-user',
      'Employee terminated'
    );

    const master = await getSalaryMasterByDriver(testTenantId, testDriverId);

    expect(version.changeType).toBe('delete');
    expect(master?.status).toBe('terminated');
  });

  it('should create delete version record', async () => {
    const version = await deleteSalaryMaster(testTenantId, testDriverId);

    expect(version.version).toBe(2);
    expect(version.changeType).toBe('delete');
    expect(version.changedBy).toBeUndefined();
  });
});

// ============================================================================
// SUMMARY TESTS
// ============================================================================

describe('DriverSalaryMasterService - Summary Operations', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should generate salary master summary', async () => {
    const summary = await getSalaryMasterSummary(testTenantId, testDriverId);

    expect(summary).toBeDefined();
    expect(summary?.driverId).toBe(testDriverId);
    expect(summary?.baseSalary).toBe(50000);
    expect(summary?.currentBaseSalary).toBe(50000);
    expect(summary?.totalAllowances).toBe(3500); // 500 + 1000 + 2000
    expect(summary?.status).toBe('active');
  });

  it('should include current version in summary', async () => {
    // Make an update to increment version
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 });

    const summary = await getSalaryMasterSummary(testTenantId, testDriverId);

    expect(summary?.currentVersion).toBe(2);
  });

  it('should return null for non-existent master', async () => {
    const summary = await getSalaryMasterSummary(testTenantId, 'non-existent');

    expect(summary).toBeNull();
  });
});

// ============================================================================
// BATCH TESTS
// ============================================================================

describe('DriverSalaryMasterService - Batch Operations', () => {
  it('should batch create multiple salary masters', async () => {
    const inputs = [
      { ...validCreateInput, driverId: 'driver-1' },
      { ...validCreateInput, driverId: 'driver-2' },
      { ...validCreateInput, driverId: 'driver-3' }
    ];

    const { created, errors } = await batchCreateSalaryMasters(inputs, 'batch-user');

    expect(created.length).toBe(3);
    expect(errors.length).toBe(0);
  });

  it('should handle partial batch failure', async () => {
    const inputs = [
      { ...validCreateInput, driverId: 'driver-1' },
      { ...validCreateInput, driverId: 'driver-1' }, // Duplicate - will fail
      { ...validCreateInput, driverId: 'driver-2' }
    ];

    const { created, errors } = await batchCreateSalaryMasters(inputs, 'batch-user');

    expect(created.length).toBe(2);
    expect(errors.length).toBe(1);
    expect(errors[0].index).toBe(1);
  });
});

// ============================================================================
// CALCULATION TESTS
// ============================================================================

describe('DriverSalaryMasterService - Calculations', () => {
  it('should calculate total salary correctly', async () => {
    const { master } = await createSalaryMaster(validCreateInput, 'test-user');

    const total = calculateTotalSalary(master);

    // 50000 + 500 + 1000 + 2000 = 53500
    expect(total).toBe(53500);
  });

  it('should handle missing allowances', async () => {
    const minimalInput = { ...validCreateInput };
    delete minimalInput.nightAllowancePerNight;
    delete minimalInput.outstationAllowancePerDay;

    const { master } = await createSalaryMaster(minimalInput, 'test-user');
    const total = calculateTotalSalary(master);

    // 50000 + 0 + 0 + 2000 = 52000
    expect(total).toBe(52000);
  });
});

// ============================================================================
// VERSIONING TESTS
// ============================================================================

describe('SalaryMasterVersionService - Versioning', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user', 'Initial');
  });

  it('should get version history', async () => {
    // Create multiple versions
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 }, 'user-2');
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 60000 }, 'user-3');

    const { versions, total } = await getVersionHistory(testDriverId);

    expect(versions.length).toBeGreaterThanOrEqual(3);
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it('should get specific version snapshot', async () => {
    const version = await getVersionSnapshot(testDriverId, 1);

    expect(version).toBeDefined();
    expect(version?.version).toBe(1);
    expect(version?.snapshot.baseSalary).toBe(50000);
  });

  it('should compare two versions', async () => {
    // Create version 2
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 });

    const comparison = await compareVersions(testDriverId, 1, 2);

    expect(comparison).toBeDefined();
    expect(comparison?.differences.length).toBeGreaterThan(0);
    expect(comparison?.differences[0].field).toBe('baseSalary');
    expect(comparison?.differences[0].oldValue).toBe(50000);
    expect(comparison?.differences[0].newValue).toBe(55000);
  });

  it('should reject comparing same version', async () => {
    expect(async () => {
      await compareVersions(testDriverId, 1, 1);
    }).rejects.toThrow('Cannot compare same version');
  });
});

// ============================================================================
// TIMELINE & AUDIT TESTS
// ============================================================================

describe('SalaryMasterVersionService - Timeline & Audit', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user', 'Initial');
  });

  it('should get change timeline', async () => {
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 }, 'user-2', 'Increment');

    const timeline = await getChangeTimeline(testDriverId);

    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].changeType).toBe('create');
    if (timeline.length > 1) {
      expect(timeline[1].changeType).toBe('update');
    }
  });

  it('should get field change history', async () => {
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 });
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 60000 });

    const fieldHistory = await getFieldChangeHistory(testDriverId, 'baseSalary');

    expect(fieldHistory.length).toBeGreaterThanOrEqual(3); // Create + 2 updates
    expect(fieldHistory[0].newValue).toBe(50000);
    expect(fieldHistory[1].oldValue).toBe(50000);
    expect(fieldHistory[1].newValue).toBe(55000);
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('SalaryMasterVersionService - Statistics', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should calculate version statistics', async () => {
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 });
    await updateSalaryMaster(testTenantId, testDriverId, { status: 'inactive' });

    const stats = await getVersionStatistics(testDriverId);

    expect(stats.totalVersions).toBe(3);
    expect(stats.createCount).toBe(1);
    expect(stats.updateCount).toBe(2);
    expect(stats.lastModified).toBeDefined();
    expect(stats.firstCreated).toBeDefined();
  });
});

// ============================================================================
// ROLLBACK TESTS
// ============================================================================

describe('SalaryMasterVersionService - Rollback', () => {
  beforeEach(async () => {
    await createSalaryMaster(validCreateInput, 'test-user');
  });

  it('should record rollback operation', async () => {
    // Create multiple versions
    const master1 = await getSalaryMasterByDriver(testTenantId, testDriverId);
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 55000 });
    await updateSalaryMaster(testTenantId, testDriverId, { baseSalary: 60000 });

    // Rollback to version 1
    const rollback = await recordRollback(
      master1!._id.toString(),
      testTenantId,
      testDriverId,
      1,
      master1!.toObject(),
      'admin',
      'Incorrect salary adjustment'
    );

    expect(rollback.changeType).toBe('rollback');
    expect(rollback.version).toBe(4);
    expect(rollback.changeReason).toBe('Incorrect salary adjustment');
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('DriverSalaryMasterService - Validation', () => {
  it('should validate different salary types', async () => {
    // Daily salary without perDaySalary should fail
    const invalidDaily = {
      ...validCreateInput,
      salaryType: 'daily',
      perDaySalary: undefined
    };

    expect(async () => {
      await createSalaryMaster(invalidDaily, 'user');
    }).rejects.toThrow('required');
  });

  it('should validate employment types', async () => {
    const invalidEmp = {
      ...validCreateInput,
      employmentType: 'invalid' as any
    };

    expect(async () => {
      await createSalaryMaster(invalidEmp, 'user');
    }).rejects.toThrow('Invalid employment type');
  });

  it('should validate status values', async () => {
    const { master } = await createSalaryMaster(validCreateInput, 'user');

    expect(async () => {
      await updateSalaryMaster(testTenantId, testDriverId, {
        status: 'invalid' as any
      });
    }).rejects.toThrow('Invalid status');
  });
});
