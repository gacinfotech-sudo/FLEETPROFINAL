/**
 * SALARY PROFILE INTEGRATION - PRACTICAL EXAMPLES
 * Real-world usage examples for the salary calculation engine
 * with Driver Salary Profile integration
 */

import mongoose from 'mongoose';
import {
  calculateSalaryWithActiveConfig,
  getActiveSalaryConfig,
  validateSalaryMasterIsActive,
  getSalaryConfigurationStatus,
  getAllSalaryConfigsForDriver,
  validateSalaryCalculationInputWithProfile,
  SalaryConfigurationError
} from '../server/services/salaryCalculationEngine';
import {
  getSalaryConfigurationHealthReport,
  validateTenantSalaryConfigurations,
  linkActiveSalaryMasterToDriver,
  createDriverSalaryConfiguration,
  updateDriverSalaryConfiguration,
  deactivateDriverSalaryConfiguration,
  exportDriverSalaryConfigurationHistory
} from '../server/services/driverSalaryProfileService';

/**
 * EXAMPLE 1: Basic Salary Calculation with Active Config
 * Simple monthly salary calculation using active configuration
 */
export async function exampleBasicCalculation() {
  console.log('\n=== EXAMPLE 1: Basic Salary Calculation ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  try {
    const { result, configStatus } = await calculateSalaryWithActiveConfig({
      driverId: driverId.toString(),
      tenantId: tenantId.toString(),
      useActiveSalaryConfig: true,
      validateSalaryMasterActive: true,
      salaryPeriodStart: new Date('2024-01-01'),
      salaryPeriodEnd: new Date('2024-01-31'),
      payableDays: 26,
      payrollDays: 31,
      presentDays: 25,
      paidLeaveDays: 1,
      unpaidLeaveDays: 0,
      weeklyOffDays: 2,
      halfDays: 0,
      absentDays: 0,
      bookingServiceDays: 20,
      totalKilometers: 5000,
      nightDutyTrips: 5,
      outstationTrips: 2,
      manualAllowances: 500,
      manualDeductions: 0
    });

    console.log('Calculation Result:');
    console.log(`  Base Salary: ₹${result.earnings.baseSalary}`);
    console.log(`  Allowances: ₹${result.earnings.allowances}`);
    console.log(`  Incentives: ₹${result.earnings.incentives}`);
    console.log(`  Gross: ₹${result.grossEarned}`);
    console.log(`  Deductions: ₹${result.totalDeductions}`);
    console.log(`  Net Payable: ₹${result.netPayable}`);
    console.log(`  Config Status: ${configStatus}`);
  } catch (error) {
    if (error instanceof SalaryConfigurationError) {
      console.error(`Configuration Error [${error.code}]: ${error.message}`);
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * EXAMPLE 2: Get Salary Configuration Status
 * Check current salary configuration status for a driver
 */
export async function exampleCheckSalaryStatus() {
  console.log('\n=== EXAMPLE 2: Check Salary Status ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  try {
    const status = await getSalaryConfigurationStatus(driverId, tenantId);

    console.log('Salary Configuration Status:');
    console.log(`  Has Active Salary: ${status.hasActiveSalary}`);
    console.log(`  Config Status: ${status.configurationStatus}`);
    console.log(`  Linked to Driver: ${status.linkedToDriver}`);
    console.log(`  Last Modified: ${status.lastModified}`);

    if (status.issues.length > 0) {
      console.log('  Issues:');
      status.issues.forEach((issue) => console.log(`    - ${issue}`));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 3: Get Health Report
 * Comprehensive health check for driver's salary configuration
 */
export async function exampleGetHealthReport() {
  console.log('\n=== EXAMPLE 3: Get Health Report ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  try {
    const health = await getSalaryConfigurationHealthReport(driverId, tenantId);

    console.log('Health Report:');
    console.log(`  Overall Status: ${health.overallStatus}`);
    console.log(`  Has Active Salary: ${health.configurationStatus.hasActiveSalary}`);
    console.log(`  Properly Linked: ${health.linkingStatus.linkedToDriver}`);
    console.log(`  Total Configs: ${health.history.totalConfigurations}`);

    if (health.recommendations.length > 0) {
      console.log('  Recommendations:');
      health.recommendations.forEach((rec) => console.log(`    - ${rec}`));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 4: Create Salary Configuration
 * Create a new salary configuration for a driver
 */
export async function exampleCreateSalaryConfig() {
  console.log('\n=== EXAMPLE 4: Create Salary Configuration ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const adminId = 'admin-001';

  try {
    const config = await createDriverSalaryConfiguration(
      driverId,
      tenantId,
      {
        baseSalary: 20000,
        salaryType: 'fixed_monthly',
        employmentType: 'permanent',
        perTripSalary: 500,
        kmIncentivePerKm: 5,
        nightAllowancePerNight: 100,
        outstationAllowancePerDay: 500,
        foodAllowance: 2000,
        perBookingFoodCharge: 50,
        overtimeRatePerHour: 250,
        weeklyOffDays: [0, 6], // Sunday and Saturday
        weeklyOffLeaveType: 'paid',
        bankName: 'ICICI Bank',
        accountNumber: '1234567890123456',
        ifscCode: 'ICIC0000001',
        upiId: 'driver@icici'
      },
      { userId: adminId, role: 'admin' }
    );

    console.log('Salary Configuration Created:');
    console.log(`  Config ID: ${config._id}`);
    console.log(`  Status: ${config.status}`);
    console.log(`  Base Salary: ₹${config.baseSalary}`);
    console.log(`  Employment Type: ${config.employmentType}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 5: Update Salary Configuration
 * Update existing salary configuration (creates new version)
 */
export async function exampleUpdateSalaryConfig() {
  console.log('\n=== EXAMPLE 5: Update Salary Configuration ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const adminId = 'admin-001';

  try {
    const updatedConfig = await updateDriverSalaryConfiguration(
      driverId,
      tenantId,
      {
        baseSalary: 22000, // Salary increment
        kmIncentivePerKm: 6, // Increased KM incentive
        nightAllowancePerNight: 150 // Increased night allowance
      },
      { userId: adminId, role: 'admin' }
    );

    console.log('Salary Configuration Updated:');
    console.log(`  Config ID: ${updatedConfig._id}`);
    console.log(`  New Base Salary: ₹${updatedConfig.baseSalary}`);
    console.log(`  Status: ${updatedConfig.status}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 6: Link Salary Master to Driver
 * Create binding between driver profile and salary configuration
 */
export async function exampleLinkSalaryMaster() {
  console.log('\n=== EXAMPLE 6: Link Salary Master to Driver ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const salaryMasterId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439013');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const adminId = 'admin-001';

  try {
    const linkedDriver = await linkActiveSalaryMasterToDriver(
      driverId,
      salaryMasterId,
      tenantId,
      { userId: adminId, role: 'admin' }
    );

    console.log('Salary Master Linked:');
    console.log(`  Driver: ${linkedDriver?.name}`);
    console.log(`  Active Salary Master ID: ${linkedDriver?.activeSalaryMasterId}`);
    console.log(`  Base Salary: ₹${linkedDriver?.baseSalary}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 7: Deactivate Salary Configuration
 * Remove active status from salary configuration
 */
export async function exampleDeactivateSalaryConfig() {
  console.log('\n=== EXAMPLE 7: Deactivate Salary Configuration ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const adminId = 'admin-001';

  try {
    const deactivatedConfig = await deactivateDriverSalaryConfiguration(
      driverId,
      tenantId,
      { userId: adminId, role: 'admin' }
    );

    console.log('Salary Configuration Deactivated:');
    console.log(`  Config ID: ${deactivatedConfig?._id}`);
    console.log(`  Status: ${deactivatedConfig?.status}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 8: Validate Tenant Salary Configurations
 * Check salary configuration health across entire tenant
 */
export async function exampleValidateTenantConfigs() {
  console.log('\n=== EXAMPLE 8: Validate Tenant Configurations ===');

  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  try {
    const validation = await validateTenantSalaryConfigurations(tenantId);

    console.log('Tenant Salary Configuration Validation:');
    console.log(`  Total Drivers: ${validation.totalDrivers}`);
    console.log(`  With Active Salary: ${validation.driversSummary.withActiveSalary}`);
    console.log(`  Properly Linked: ${validation.driversSummary.properlyLinked}`);
    console.log(`  With Issues: ${validation.driversSummary.withIssues}`);

    if (validation.criticalIssues.length > 0) {
      console.log('  Critical Issues:');
      validation.criticalIssues.slice(0, 3).forEach((issue) => {
        console.log(`    - ${issue.driverName}: ${issue.issue}`);
      });
    }

    if (validation.warnings.length > 0) {
      console.log('  Warnings:');
      validation.warnings.slice(0, 3).forEach((warning) => {
        console.log(`    - ${warning.driverName}: ${warning.warning}`);
      });
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 9: Export Configuration History
 * Get complete configuration history for audit
 */
export async function exampleExportConfigHistory() {
  console.log('\n=== EXAMPLE 9: Export Configuration History ===');

  const driverId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

  try {
    const history = await exportDriverSalaryConfigurationHistory(driverId, tenantId);

    console.log('Configuration History:');
    console.log(`  Driver: ${history.driverName}`);
    console.log(`  Total Configurations: ${history.configurations.length}`);

    history.configurations.forEach((config, index) => {
      console.log(`  Config ${index + 1}:`);
      console.log(`    - ID: ${config.configId}`);
      console.log(`    - Status: ${config.status}`);
      console.log(`    - Base Salary: ₹${config.baseSalary}`);
      console.log(`    - Type: ${config.salaryType}`);
      console.log(`    - Updated: ${config.updatedAt}`);
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * EXAMPLE 10: Batch Calculation with Validation
 * Calculate salaries for multiple drivers with error handling
 */
export async function exampleBatchCalculation() {
  console.log('\n=== EXAMPLE 10: Batch Calculation with Validation ===');

  const tenantId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');
  const driverIds = [
    new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
    new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
    new mongoose.Types.ObjectId('507f1f77bcf86cd799439015')
  ];

  const results: Array<{
    driverId: string;
    status: 'success' | 'error';
    netPayable?: number;
    error?: string;
  }> = [];

  for (const driverId of driverIds) {
    try {
      // Validate input first
      const validation = await validateSalaryCalculationInputWithProfile({
        driverId: driverId.toString(),
        tenantId: tenantId.toString(),
        useActiveSalaryConfig: true,
        validateSalaryMasterActive: true,
        salaryPeriodStart: new Date('2024-01-01'),
        salaryPeriodEnd: new Date('2024-01-31'),
        payableDays: 26,
        payrollDays: 31,
        presentDays: 25,
        bookingServiceDays: 20,
        totalKilometers: 5000
      });

      if (!validation.valid) {
        results.push({
          driverId: driverId.toString(),
          status: 'error',
          error: `Validation failed: ${validation.errors.join(', ')}`
        });
        continue;
      }

      // Calculate salary
      const { result } = await calculateSalaryWithActiveConfig({
        driverId: driverId.toString(),
        tenantId: tenantId.toString(),
        useActiveSalaryConfig: true,
        validateSalaryMasterActive: true,
        salaryPeriodStart: new Date('2024-01-01'),
        salaryPeriodEnd: new Date('2024-01-31'),
        payableDays: 26,
        payrollDays: 31,
        presentDays: 25,
        bookingServiceDays: 20,
        totalKilometers: 5000
      });

      results.push({
        driverId: driverId.toString(),
        status: 'success',
        netPayable: result.netPayable
      });
    } catch (error) {
      results.push({
        driverId: driverId.toString(),
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log('Batch Calculation Results:');
  results.forEach((result) => {
    if (result.status === 'success') {
      console.log(`  ✓ ${result.driverId}: ₹${result.netPayable}`);
    } else {
      console.log(`  ✗ ${result.driverId}: ${result.error}`);
    }
  });
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  SALARY PROFILE INTEGRATION - PRACTICAL EXAMPLES           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Note: These examples assume MongoDB is running and seed data exists
  // In production, adapt driver/tenant IDs to match your data

  await exampleBasicCalculation();
  await exampleCheckSalaryStatus();
  await exampleGetHealthReport();
  // await exampleCreateSalaryConfig();
  // await exampleUpdateSalaryConfig();
  // await exampleLinkSalaryMaster();
  // await exampleDeactivateSalaryConfig();
  await exampleValidateTenantConfigs();
  await exampleExportConfigHistory();
  // await exampleBatchCalculation();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Examples completed                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Uncomment to run examples
// runAllExamples().catch(console.error);
