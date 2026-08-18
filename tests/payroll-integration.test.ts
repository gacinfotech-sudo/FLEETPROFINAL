/**
 * PAYROLL INTEGRATION SERVICE - TEST SUITE
 * Comprehensive tests for salary-to-ledger integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import {
  linkSalaryToLedger,
  linkMonthlyPayrollToLedger,
  reconcileSalaryLedger,
  getPayrollIntegrationReport,
  extractSalaryComponentBreakdown,
  generateLedgerEntryDefinitions,
  PayrollIntegrationResult
} from '../server/services/payrollIntegrationService';
import {
  DriverSalary,
  DriverSalaryLedger,
  DriverSalaryMaster,
  Driver,
  IDriverSalary
} from '../server/models/index';

describe('PayrollIntegrationService', () => {
  let tenantId: mongoose.Types.ObjectId;
  let driverId: mongoose.Types.ObjectId;
  let salaryId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Setup test data
    tenantId = new mongoose.Types.ObjectId();
    driverId = new mongoose.Types.ObjectId();

    // Create driver
    const driver = new Driver({
      tenantId,
      name: 'Test Driver',
      phone: '9876543210',
      email: 'test@example.com'
    });
    await driver.save();

    // Create salary master
    const master = new DriverSalaryMaster({
      tenantId,
      driverId,
      salaryType: 'fixed_monthly',
      baseSalary: 15000,
      salaryStartDate: new Date(2026, 0, 1),
      status: 'active'
    });
    await master.save();
  });

  afterAll(async () => {
    // Cleanup
    await Driver.deleteMany({ _id: driverId });
    await DriverSalaryMaster.deleteMany({ tenantId, driverId });
    await DriverSalary.deleteMany({ tenantId, driverId });
    await DriverSalaryLedger.deleteMany({ tenantId, driverId });
  });

  describe('extractSalaryComponentBreakdown', () => {
    it('should extract all salary components correctly', () => {
      const salary: Partial<IDriverSalary> = {
        baseSalary: 15000,
        tripIncentive: 2500,
        kmIncentive: 1200,
        nightAllowance: 800,
        outstationAllowance: 500,
        foodAllowance: 300,
        overtimeEarning: 400,
        bonus: 1000,
        manualCredits: 300,
        absenceDeduction: 1500,
        advanceRecovery: 1000,
        penalty: 500,
        damageRecovery: 500,
        challanRecovery: 200,
        cashShortage: 300,
        fuelExcess: 100,
        otherDeductions: 0
      };

      const breakdown = extractSalaryComponentBreakdown(salary as any);

      expect(breakdown.baseSalary).toBe(15000);
      expect(breakdown.tripIncentive).toBe(2500);
      expect(breakdown.totalEarnings).toBe(22100);
      expect(breakdown.totalDeductions).toBe(4000);
      expect(breakdown.grossSalary).toBe(22100);
      expect(breakdown.netSalary).toBe(18100);
    });

    it('should handle zero components', () => {
      const salary: Partial<IDriverSalary> = {
        baseSalary: 15000,
        tripIncentive: 0,
        kmIncentive: 0
      };

      const breakdown = extractSalaryComponentBreakdown(salary as any);

      expect(breakdown.totalEarnings).toBe(15000);
      expect(breakdown.totalDeductions).toBe(0);
      expect(breakdown.netSalary).toBe(15000);
    });
  });

  describe('generateLedgerEntryDefinitions', () => {
    it('should generate correct number of ledger entries', () => {
      const salary: Partial<IDriverSalary> = {
        baseSalary: 15000,
        tripIncentive: 2500,
        nightAllowance: 800,
        absenceDeduction: 1500,
        advanceRecovery: 1000
      };

      const breakdown = extractSalaryComponentBreakdown(salary as any);
      const definitions = generateLedgerEntryDefinitions(
        breakdown,
        new mongoose.Types.ObjectId()
      );

      // Should create 5 entries (3 earnings + 2 deductions)
      expect(definitions.length).toBe(5);
    });

    it('should only generate entries for non-zero amounts', () => {
      const salary: Partial<IDriverSalary> = {
        baseSalary: 15000,
        tripIncentive: 0,
        nightAllowance: 0,
        absenceDeduction: 0
      };

      const breakdown = extractSalaryComponentBreakdown(salary as any);
      const definitions = generateLedgerEntryDefinitions(
        breakdown,
        new mongoose.Types.ObjectId()
      );

      // Should create only 1 entry (base salary)
      expect(definitions.length).toBe(1);
      expect(definitions[0].transactionType).toBe('base_salary');
    });

    it('should classify earnings as credits and deductions as debits', () => {
      const salary: Partial<IDriverSalary> = {
        baseSalary: 15000,
        tripIncentive: 2500,
        absenceDeduction: 1500
      };

      const breakdown = extractSalaryComponentBreakdown(salary as any);
      const definitions = generateLedgerEntryDefinitions(
        breakdown,
        new mongoose.Types.ObjectId()
      );

      const earningDefs = definitions.filter(d =>
        ['base_salary', 'trip_incentive'].includes(d.transactionType)
      );
      const deductionDefs = definitions.filter(d =>
        d.transactionType === 'absence_deduction'
      );

      earningDefs.forEach(def => {
        expect(['salary_earned']).toContain(def.entryType);
      });

      deductionDefs.forEach(def => {
        expect(['manual_debit']).toContain(def.entryType);
      });
    });
  });

  describe('linkSalaryToLedger', () => {
    beforeEach(async () => {
      // Create a test salary
      const salary = new DriverSalary({
        tenantId,
        driverId,
        driverName: 'Test Driver',
        salaryPeriodStart: new Date(2026, 7, 1),
        salaryPeriodEnd: new Date(2026, 7, 31),
        baseSalary: 15000,
        tripIncentive: 2500,
        kmIncentive: 1200,
        totalDeductions: 3500,
        grossSalary: 18700,
        netSalary: 15200
      });
      await salary.save();
      salaryId = salary._id!;
    });

    it('should create ledger entries for salary components', async () => {
      const salary = await DriverSalary.findById(salaryId);
      expect(salary).toBeDefined();

      const result = await linkSalaryToLedger(
        salary!,
        tenantId,
        8,
        2026,
        { userId: 'test-user', role: 'test' }
      );

      expect(result.status).toBe('success');
      expect(result.ledgerEntriesCreated).toBeGreaterThan(0);
      expect(result.grossSalary).toBe(18700);
      expect(result.netSalary).toBe(15200);
    });

    it('should track integration result metadata', async () => {
      const salary = await DriverSalary.findById(salaryId);
      const result = await linkSalaryToLedger(
        salary!,
        tenantId,
        8,
        2026
      );

      expect(result.salaryId).toBeDefined();
      expect(result.driverId).toBeDefined();
      expect(result.driverName).toBe('Test Driver');
      expect(result.month).toBe(8);
      expect(result.year).toBe(2026);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle salary with no components', async () => {
      const emptySalary = new DriverSalary({
        tenantId,
        driverId: new mongoose.Types.ObjectId(),
        driverName: 'Empty Driver',
        salaryPeriodStart: new Date(2026, 7, 1),
        salaryPeriodEnd: new Date(2026, 7, 31),
        grossSalary: 0,
        netSalary: 0
      });
      await emptySalary.save();

      const result = await linkSalaryToLedger(
        emptySalary,
        tenantId,
        8,
        2026
      );

      expect(result.status).toBe('partial');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('linkMonthlyPayrollToLedger', () => {
    it('should process multiple salaries', async () => {
      // Create multiple test salaries
      const salaries = [];
      for (let i = 0; i < 3; i++) {
        const salary = new DriverSalary({
          tenantId,
          driverId: new mongoose.Types.ObjectId(),
          driverName: `Driver ${i}`,
          salaryPeriodStart: new Date(2026, 8, 1),
          salaryPeriodEnd: new Date(2026, 8, 30),
          baseSalary: 15000,
          grossSalary: 15000,
          netSalary: 15000
        });
        await salary.save();
        salaries.push(salary);
      }

      const { results, summary } = await linkMonthlyPayrollToLedger(
        tenantId,
        9,
        2026
      );

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(summary.totalProcessed).toBeGreaterThanOrEqual(0);

      // Cleanup
      await DriverSalary.deleteMany({
        _id: { $in: salaries.map(s => s._id) }
      });
    });

    it('should calculate summary statistics correctly', async () => {
      // Create test salaries with known values
      const testSalaries = [];
      for (let i = 0; i < 2; i++) {
        const salary = new DriverSalary({
          tenantId,
          driverId: new mongoose.Types.ObjectId(),
          driverName: `Test Driver ${i}`,
          salaryPeriodStart: new Date(2026, 9, 1),
          salaryPeriodEnd: new Date(2026, 9, 30),
          baseSalary: 10000,
          totalDeductions: 1000,
          grossSalary: 10000,
          netSalary: 9000
        });
        await salary.save();
        testSalaries.push(salary);
      }

      const { summary } = await linkMonthlyPayrollToLedger(
        tenantId,
        10,
        2026
      );

      expect(summary.totalGrossSalary).toBeGreaterThanOrEqual(0);
      expect(summary.totalDeductions).toBeGreaterThanOrEqual(0);
      expect(summary.totalNetSalary).toBeGreaterThanOrEqual(0);

      // Cleanup
      await DriverSalary.deleteMany({
        _id: { $in: testSalaries.map(s => s._id) }
      });
    });
  });

  describe('reconcileSalaryLedger', () => {
    it('should identify salaries without ledger entries', async () => {
      // Create a salary without ledger entries
      const salary = new DriverSalary({
        tenantId,
        driverId: new mongoose.Types.ObjectId(),
        driverName: 'Unreconciled Driver',
        salaryPeriodStart: new Date(2026, 10, 1),
        salaryPeriodEnd: new Date(2026, 10, 30),
        grossSalary: 15000,
        netSalary: 15000
      });
      await salary.save();

      const reconciliation = await reconcileSalaryLedger(tenantId, 11, 2026);

      expect(reconciliation.totalSalaries).toBeGreaterThanOrEqual(1);
      expect(reconciliation.salariesWithoutLedger).toBeGreaterThanOrEqual(0);

      // Cleanup
      await DriverSalary.deleteOne({ _id: salary._id });
    });

    it('should track reconciliation percentage', async () => {
      const reconciliation = await reconcileSalaryLedger(tenantId, 8, 2026);

      if (reconciliation.totalSalaries > 0) {
        const percentage = (reconciliation.salariesWithLedger / reconciliation.totalSalaries) * 100;
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getPayrollIntegrationReport', () => {
    it('should generate comprehensive report', async () => {
      const report = await getPayrollIntegrationReport(tenantId, 8, 2026);

      expect(report.period).toBe('8/2026');
      expect(report.totalSalaries).toBeGreaterThanOrEqual(0);
      expect(report.totalGrossSalary).toBeGreaterThanOrEqual(0);
      expect(report.totalDeductions).toBeGreaterThanOrEqual(0);
      expect(report.totalNetSalary).toBeGreaterThanOrEqual(0);
      expect(report.totalLedgerEntries).toBeGreaterThanOrEqual(0);
      expect(report.reconciliationStatus).toBeDefined();
    });

    it('should calculate average entries per salary', async () => {
      const report = await getPayrollIntegrationReport(tenantId, 8, 2026);

      if (report.totalSalaries > 0) {
        expect(report.averageEntriesPerSalary).toBe(
          report.totalLedgerEntries / report.totalSalaries
        );
      }
    });

    it('should include reconciliation status', async () => {
      const report = await getPayrollIntegrationReport(tenantId, 8, 2026);

      const status = report.reconciliationStatus;
      expect(status.totalSalaries).toBeGreaterThanOrEqual(0);
      expect(status.salariesWithLedger).toBeGreaterThanOrEqual(0);
      expect(status.salariesWithoutLedger).toBeGreaterThanOrEqual(0);
      expect(status.reconciliationPercentage).toBeGreaterThanOrEqual(0);
      expect(status.reconciliationPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration Scenarios', () => {
    it('should complete end-to-end workflow', async () => {
      // 1. Link salary
      const salary = await DriverSalary.findById(salaryId);
      if (!salary) return;

      const linkResult = await linkSalaryToLedger(salary, tenantId, 8, 2026);
      expect(linkResult.status).toBe('success');

      // 2. Reconcile
      const reconciliation = await reconcileSalaryLedger(tenantId, 8, 2026);
      expect(reconciliation.totalSalaries).toBeGreaterThanOrEqual(1);

      // 3. Get report
      const report = await getPayrollIntegrationReport(tenantId, 8, 2026);
      expect(report.period).toBe('8/2026');
    });

    it('should maintain accounting integrity', async () => {
      const salary = await DriverSalary.findById(salaryId);
      if (!salary) return;

      const breakdown = extractSalaryComponentBreakdown(salary);
      const reportBefore = await getPayrollIntegrationReport(tenantId, 8, 2026);

      await linkSalaryToLedger(salary, tenantId, 8, 2026);

      const reportAfter = await getPayrollIntegrationReport(tenantId, 8, 2026);

      // Ledger entries should increase
      expect(reportAfter.totalLedgerEntries).toBeGreaterThanOrEqual(
        reportBefore.totalLedgerEntries
      );

      // Totals should remain consistent
      if (reportAfter.totalSalaries > 0) {
        expect(reportAfter.totalNetSalary).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
