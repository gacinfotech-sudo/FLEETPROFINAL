import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import {
  calculateMonthlySalary,
  formatSalaryCalculation,
  validateSalaryCalculation,
  calculateTeamSalaryStatistics,
  MonthlySalaryCalculation
} from '../server/services/salaryCoreCalculationService';
import {
  DriverSalaryMaster,
  DriverSalaryLedger,
  DriverAdvance,
  DriverRecovery,
  Tenant,
  Driver
} from '../server/models/index';

describe('Monthly Salary Formula Tests', () => {
  let tenantId: string;
  let driverId: string;
  let salaryMasterId: string;

  beforeAll(async () => {
    // Connect to test database
    if (!mongoose.connection.readyState) {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro-test'
      );
    }

    // Create test tenant
    const tenantDoc = new Tenant({
      name: 'Test Tenant',
      status: 'active'
    });
    await tenantDoc.save();
    tenantId = tenantDoc._id.toString();

    // Create test driver
    const driverDoc = new Driver({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      name: 'Test Driver',
      phone: '9876543210',
      status: 'active'
    });
    await driverDoc.save();
    driverId = driverDoc._id.toString();

    // Create salary master
    const salaryMasterDoc = new DriverSalaryMaster({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      name: 'Test Driver',
      salaryType: 'fixed_monthly',
      baseSalary: 25000, // Base: 25,000
      nightAllowancePerNight: 500,
      outstationAllowancePerDay: 300,
      foodAllowance: 1000,
      status: 'active',
      salaryStartDate: new Date('2026-01-01')
    });
    await salaryMasterDoc.save();
    salaryMasterId = salaryMasterDoc._id.toString();
  });

  afterAll(async () => {
    // Cleanup test data
    await DriverSalaryMaster.deleteMany({ _id: salaryMasterId });
    await Driver.deleteMany({ _id: driverId });
    await Tenant.deleteMany({ _id: tenantId });
    await DriverSalaryLedger.deleteMany({});
    await DriverAdvance.deleteMany({});
    await DriverRecovery.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Basic Salary Formula: Base + Allowances - Deductions - Advances - Penalties', () => {

    it('should calculate salary with only base salary', async () => {
      // Create ledger entry for base salary only
      const ledgerEntry = new DriverSalaryLedger({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        driverName: 'Test Driver',
        month: 8,
        year: 2026,
        transactionType: 'base_salary',
        amount: 25000,
        createdBy: { userId: 'system', role: 'admin' }
      });
      await ledgerEntry.save();

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries: [ledgerEntry]
      });

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.allowances.total).toBe(0);
      expect(calculation.components.deductions.total).toBe(0);
      expect(calculation.components.advances.total).toBe(0);
      expect(calculation.components.penalties.total).toBe(0);
      expect(calculation.grossEarnings).toBe(25000); // Base only
      expect(calculation.totalDeductions).toBe(0);
      expect(calculation.netPayable).toBe(25000); // 25000 - 0 = 25000

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });

    it('should calculate salary with base + allowances', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'night_allowance',
          amount: 2000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'outstation_allowance',
          amount: 1500,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'food_allowance',
          amount: 1000,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      await Promise.all(ledgerEntries.map(e => e.save()));

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries
      });

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.allowances.nightAllowance).toBe(2000);
      expect(calculation.components.allowances.outstationAllowance).toBe(1500);
      expect(calculation.components.allowances.foodAllowance).toBe(1000);
      expect(calculation.components.allowances.total).toBe(4500);
      expect(calculation.grossEarnings).toBe(29500); // 25000 + 4500
      expect(calculation.totalDeductions).toBe(0);
      expect(calculation.netPayable).toBe(29500); // 29500 - 0 = 29500

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });

    it('should calculate salary with deductions applied', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'absence_deduction',
          amount: 2000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'cash_shortage',
          amount: 500,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      await Promise.all(ledgerEntries.map(e => e.save()));

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries
      });

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.allowances.total).toBe(0);
      expect(calculation.components.deductions.absenceDeduction).toBe(2000);
      expect(calculation.components.deductions.cashShortage).toBe(500);
      expect(calculation.components.deductions.total).toBe(2500);
      expect(calculation.grossEarnings).toBe(25000);
      expect(calculation.totalDeductions).toBe(2500);
      expect(calculation.netPayable).toBe(22500); // 25000 - 2500 = 22500

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });

    it('should calculate salary with advances deduction', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      const advance = new DriverAdvance({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        approvedAmount: 5000,
        remaining: 5000,
        amount: 5000,
        reason: 'Emergency',
        deductionMode: 'full_next_salary',
        status: 'paid',
        requestDate: new Date()
      });

      await Promise.all([...ledgerEntries.map(e => e.save()), advance.save()]);

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries,
        advances: [advance]
      });

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.advances.advanceAmount).toBe(5000);
      expect(calculation.components.advances.total).toBe(5000);
      expect(calculation.grossEarnings).toBe(25000);
      expect(calculation.totalDeductions).toBe(5000);
      expect(calculation.netPayable).toBe(20000); // 25000 - 5000 = 20000

      await Promise.all([
        DriverSalaryLedger.deleteMany({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId)
        }),
        DriverAdvance.deleteMany({ _id: advance._id })
      ]);
    });

    it('should calculate salary with penalties', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'penalty',
          amount: 1000,
          reason: 'Late arrival',
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      await Promise.all(ledgerEntries.map(e => e.save()));

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries
      });

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.penalties.penaltyAmount).toBe(1000);
      expect(calculation.components.penalties.total).toBe(1000);
      expect(calculation.grossEarnings).toBe(25000);
      expect(calculation.totalDeductions).toBe(1000);
      expect(calculation.netPayable).toBe(24000); // 25000 - 1000 = 24000

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });

    it('should calculate complete salary formula: Base + Allowances - Deductions - Advances - Penalties', async () => {
      const ledgerEntries = [
        // Income
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'night_allowance',
          amount: 1500,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'food_allowance',
          amount: 800,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        // Deductions
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'absence_deduction',
          amount: 1000,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'fuel_excess',
          amount: 500,
          createdBy: { userId: 'system', role: 'admin' }
        }),
        // Penalties
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'penalty',
          amount: 800,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      const advance = new DriverAdvance({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        approvedAmount: 3000,
        remaining: 3000,
        amount: 3000,
        reason: 'Personal',
        deductionMode: 'full_next_salary',
        status: 'paid',
        requestDate: new Date()
      });

      await Promise.all([...ledgerEntries.map(e => e.save()), advance.save()]);

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries,
        advances: [advance]
      });

      // Expected calculation:
      // Base: 25000
      // Allowances: 1500 + 800 = 2300
      // Gross: 27300
      // Deductions: 1000 + 500 = 1500
      // Advances: 3000
      // Penalties: 800
      // Total Deductions: 1500 + 3000 + 800 = 5300
      // Net: 27300 - 5300 = 22000

      expect(calculation.components.baseSalary).toBe(25000);
      expect(calculation.components.allowances.total).toBe(2300);
      expect(calculation.grossEarnings).toBe(27300);
      expect(calculation.components.deductions.total).toBe(1500);
      expect(calculation.components.advances.total).toBe(3000);
      expect(calculation.components.penalties.total).toBe(800);
      expect(calculation.totalDeductions).toBe(5300);
      expect(calculation.netPayable).toBe(22000);

      // Verify formula output
      const formatted = formatSalaryCalculation(calculation);
      expect(formatted).toContain('₹27300.00'); // Gross earnings
      expect(formatted).toContain('₹22000.00'); // Net payable

      await Promise.all([
        DriverSalaryLedger.deleteMany({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId)
        }),
        DriverAdvance.deleteMany({ _id: advance._id })
      ]);
    });
  });

  describe('Validation and Error Handling', () => {

    it('should validate salary calculation', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      await ledgerEntries[0].save();

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries
      });

      const validation = validateSalaryCalculation(calculation);
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });

    it('should format salary calculation for display', async () => {
      const ledgerEntries = [
        new DriverSalaryLedger({
          tenantId: new mongoose.Types.ObjectId(tenantId),
          driverId: new mongoose.Types.ObjectId(driverId),
          driverName: 'Test Driver',
          month: 8,
          year: 2026,
          transactionType: 'base_salary',
          amount: 25000,
          createdBy: { userId: 'system', role: 'admin' }
        })
      ];

      await ledgerEntries[0].save();

      const calculation = await calculateMonthlySalary({
        tenantId,
        driverId,
        month: 8,
        year: 2026,
        ledgerEntries
      });

      const formatted = formatSalaryCalculation(calculation);
      expect(formatted).toContain('Test Driver');
      expect(formatted).toContain('8/2026');
      expect(formatted).toContain('GROSS EARNINGS');
      expect(formatted).toContain('NET PAYABLE');

      await DriverSalaryLedger.deleteMany({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId)
      });
    });
  });
});
