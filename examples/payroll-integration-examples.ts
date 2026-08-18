/**
 * PAYROLL INTEGRATION SERVICE - EXAMPLE USAGE
 * Real-world scenarios and implementation examples
 */

import mongoose from 'mongoose';
import {
  linkSalaryToLedger,
  linkBatchSalariesToLedger,
  linkMonthlyPayrollToLedger,
  reconcileSalaryLedger,
  getPayrollIntegrationReport,
  extractSalaryComponentBreakdown
} from '../server/services/payrollIntegrationService';
import { DriverSalary, DriverSalaryLedger } from '../server/models/index';

/**
 * SCENARIO 1: Link a single salary calculation
 * When a driver's salary is manually calculated/corrected
 */
async function scenario1_linkSingleSalary(tenantId: string, salaryId: string) {
  console.log('\n=== SCENARIO 1: Link Single Salary ===');

  try {
    // Fetch the salary record
    const salary = await DriverSalary.findById(salaryId);
    if (!salary) {
      console.error('Salary not found');
      return;
    }

    // Extract breakdown to verify components
    const breakdown = extractSalaryComponentBreakdown(salary);
    console.log('Salary Breakdown:');
    console.log(`  Base Salary: ₹${breakdown.baseSalary}`);
    console.log(`  Incentives: ₹${breakdown.totalEarnings - breakdown.baseSalary}`);
    console.log(`  Deductions: ₹${breakdown.totalDeductions}`);
    console.log(`  Net Salary: ₹${breakdown.netSalary}`);

    // Link to ledger
    const result = await linkSalaryToLedger(
      salary,
      tenantId,
      8,  // August
      2026,
      {
        userId: 'payroll-admin-001',
        role: 'payroll_manager'
      }
    );

    console.log('\nIntegration Result:');
    console.log(`  Status: ${result.status}`);
    console.log(`  Ledger Entries Created: ${result.ledgerEntriesCreated}`);
    console.log(`  Gross Salary: ₹${result.grossSalary}`);
    console.log(`  Net Salary: ₹${result.netSalary}`);

    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }

    return result;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * SCENARIO 2: Link all salaries for a month
 * Monthly payroll batch processing
 */
async function scenario2_linkMonthlyPayroll(tenantId: string, month: number, year: number) {
  console.log('\n=== SCENARIO 2: Link Monthly Payroll ===');

  try {
    console.log(`Processing payroll for ${month}/${year}...`);

    const { results, summary } = await linkMonthlyPayrollToLedger(
      tenantId,
      month,
      year,
      {
        userId: 'payroll-system',
        role: 'system'
      }
    );

    console.log('\nPayroll Processing Summary:');
    console.log(`  Total Drivers: ${summary.totalProcessed}`);
    console.log(`  Successful: ${summary.successCount}`);
    console.log(`  Partial: ${summary.partialCount}`);
    console.log(`  Failed: ${summary.failedCount}`);
    console.log(`  Total Gross Salary: ₹${summary.totalGrossSalary.toLocaleString('en-IN')}`);
    console.log(`  Total Deductions: ₹${summary.totalDeductions.toLocaleString('en-IN')}`);
    console.log(`  Total Net Salary: ₹${summary.totalNetSalary.toLocaleString('en-IN')}`);
    console.log(`  Total Ledger Entries: ${summary.totalLedgerEntries}`);

    // Show any failures
    const failures = results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      console.warn('\n⚠️ Failed Integrations:');
      failures.forEach(f => {
        console.warn(`  - ${f.driverName}: ${f.errors.join(', ')}`);
      });
    }

    return { results, summary };
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * SCENARIO 3: Verify integration completeness
 * Ensure all salaries have corresponding ledger entries
 */
async function scenario3_reconcilePayroll(tenantId: string, month: number, year: number) {
  console.log('\n=== SCENARIO 3: Reconcile Payroll ===');

  try {
    console.log(`Reconciling payroll for ${month}/${year}...`);

    const reconciliation = await reconcileSalaryLedger(tenantId, month, year);

    console.log('\nReconciliation Status:');
    console.log(`  Total Salaries: ${reconciliation.totalSalaries}`);
    console.log(`  With Ledger Entries: ${reconciliation.salariesWithLedger}`);
    console.log(`  Missing Ledger Entries: ${reconciliation.salariesWithoutLedger}`);

    const percentage = reconciliation.totalSalaries > 0
      ? (reconciliation.salariesWithLedger / reconciliation.totalSalaries) * 100
      : 0;
    console.log(`  Reconciliation Rate: ${percentage.toFixed(2)}%`);

    if (reconciliation.missingReconciliations.length > 0) {
      console.warn('\n⚠️ Missing Reconciliations:');
      reconciliation.missingReconciliations.forEach(m => {
        console.warn(`  - ${m.driverName}: ₹${m.grossSalary} (${m.ledgerEntriesCount} entries)`);
      });
    } else {
      console.log('\n✅ All salaries reconciled successfully!');
    }

    return reconciliation;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * SCENARIO 4: Get comprehensive integration report
 * Monthly audit and compliance reporting
 */
async function scenario4_getIntegrationReport(tenantId: string, month: number, year: number) {
  console.log('\n=== SCENARIO 4: Integration Report ===');

  try {
    const report = await getPayrollIntegrationReport(tenantId, month, year);

    console.log(`\nPayroll Integration Report - ${report.period}`);
    console.log('='.repeat(50));
    console.log(`  Total Salaries Processed: ${report.totalSalaries}`);
    console.log(`  Total Gross Salary: ₹${report.totalGrossSalary.toLocaleString('en-IN')}`);
    console.log(`  Total Deductions: ₹${report.totalDeductions.toLocaleString('en-IN')}`);
    console.log(`  Total Net Salary: ₹${report.totalNetSalary.toLocaleString('en-IN')}`);
    console.log(`  Total Ledger Entries: ${report.totalLedgerEntries}`);
    console.log(`  Avg Entries per Salary: ${report.averageEntriesPerSalary.toFixed(1)}`);

    console.log('\nReconciliation Status:');
    console.log(`  Total Salaries: ${report.reconciliationStatus.totalSalaries}`);
    console.log(`  With Ledger: ${report.reconciliationStatus.salariesWithLedger}`);
    console.log(`  Without Ledger: ${report.reconciliationStatus.salariesWithoutLedger}`);
    console.log(`  Reconciliation %: ${report.reconciliationStatus.reconciliationPercentage}%`);

    return report;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * SCENARIO 5: Complete monthly payroll workflow
 * End-to-end integration, reconciliation, and reporting
 */
async function scenario5_completePayrollWorkflow(tenantId: string, month: number, year: number) {
  console.log('\n=== SCENARIO 5: Complete Payroll Workflow ===');

  try {
    // Step 1: Link all salaries to ledger
    console.log('\n[Step 1] Linking salaries to ledger...');
    const { summary } = await linkMonthlyPayrollToLedger(
      tenantId,
      month,
      year,
      { userId: 'payroll-workflow', role: 'system' }
    );

    console.log(`✓ Processed ${summary.totalProcessed} drivers`);
    console.log(`✓ Created ${summary.totalLedgerEntries} ledger entries`);

    if (summary.failedCount > 0) {
      console.error(`✗ ${summary.failedCount} drivers failed`);
      return false;
    }

    // Step 2: Reconcile
    console.log('\n[Step 2] Reconciling payroll...');
    const reconciliation = await reconcileSalaryLedger(tenantId, month, year);

    if (reconciliation.salariesWithoutLedger > 0) {
      console.error(`✗ Reconciliation failed: ${reconciliation.salariesWithoutLedger} salaries missing ledger entries`);
      return false;
    }
    console.log(`✓ All ${reconciliation.totalSalaries} salaries reconciled`);

    // Step 3: Generate report
    console.log('\n[Step 3] Generating integration report...');
    const report = await getPayrollIntegrationReport(tenantId, month, year);

    console.log('\n✅ PAYROLL INTEGRATION COMPLETE');
    console.log('='.repeat(50));
    console.log(`Period: ${report.period}`);
    console.log(`Total Gross Salary: ₹${report.totalGrossSalary.toLocaleString('en-IN')}`);
    console.log(`Total Net Salary: ₹${report.totalNetSalary.toLocaleString('en-IN')}`);
    console.log(`Ledger Entries: ${report.totalLedgerEntries}`);
    console.log(`Reconciliation: ${report.reconciliationStatus.reconciliationPercentage}%`);
    console.log('='.repeat(50));

    return true;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * SCENARIO 6: Verify salary component breakdown
 * For audit and compliance purposes
 */
async function scenario6_verifySalaryComponents(salaryId: string) {
  console.log('\n=== SCENARIO 6: Verify Salary Components ===');

  try {
    const salary = await DriverSalary.findById(salaryId);
    if (!salary) {
      console.error('Salary not found');
      return;
    }

    const breakdown = extractSalaryComponentBreakdown(salary);

    console.log(`\nSalary Components for ${salary.driverName}`);
    console.log('='.repeat(50));

    console.log('\nEarnings:');
    if (breakdown.baseSalary > 0) console.log(`  Base Salary: ₹${breakdown.baseSalary}`);
    if (breakdown.tripIncentive > 0) console.log(`  Trip Incentive: ₹${breakdown.tripIncentive}`);
    if (breakdown.kmIncentive > 0) console.log(`  KM Incentive: ₹${breakdown.kmIncentive}`);
    if (breakdown.nightAllowance > 0) console.log(`  Night Allowance: ₹${breakdown.nightAllowance}`);
    if (breakdown.outstationAllowance > 0) console.log(`  Outstation Allowance: ₹${breakdown.outstationAllowance}`);
    if (breakdown.foodAllowance > 0) console.log(`  Food Allowance: ₹${breakdown.foodAllowance}`);
    if (breakdown.overtimeEarning > 0) console.log(`  Overtime Earning: ₹${breakdown.overtimeEarning}`);
    if (breakdown.bonus > 0) console.log(`  Bonus: ₹${breakdown.bonus}`);
    if (breakdown.manualCredits > 0) console.log(`  Manual Credits: ₹${breakdown.manualCredits}`);

    console.log(`\n  Total Earnings: ₹${breakdown.totalEarnings}`);

    console.log('\nDeductions:');
    if (breakdown.absenceDeduction > 0) console.log(`  Absence Deduction: ₹${breakdown.absenceDeduction}`);
    if (breakdown.advanceRecovery > 0) console.log(`  Advance Recovery: ₹${breakdown.advanceRecovery}`);
    if (breakdown.loanRecovery > 0) console.log(`  Loan Recovery: ₹${breakdown.loanRecovery}`);
    if (breakdown.penalty > 0) console.log(`  Penalty: ₹${breakdown.penalty}`);
    if (breakdown.damageRecovery > 0) console.log(`  Damage Recovery: ₹${breakdown.damageRecovery}`);
    if (breakdown.challanRecovery > 0) console.log(`  Challan Recovery: ₹${breakdown.challanRecovery}`);
    if (breakdown.cashShortage > 0) console.log(`  Cash Shortage: ₹${breakdown.cashShortage}`);
    if (breakdown.fuelExcess > 0) console.log(`  Fuel Excess: ₹${breakdown.fuelExcess}`);
    if (breakdown.otherDeductions > 0) console.log(`  Other Deductions: ₹${breakdown.otherDeductions}`);

    console.log(`\n  Total Deductions: ₹${breakdown.totalDeductions}`);

    console.log('\nSummary:');
    console.log(`  Gross Salary: ₹${breakdown.grossSalary}`);
    console.log(`  Net Salary: ₹${breakdown.netSalary}`);

    return breakdown;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * SCENARIO 7: Batch process multiple drivers
 * For large payroll operations
 */
async function scenario7_batchProcessMultipleDrivers(
  tenantId: string,
  driverIds: string[],
  month: number,
  year: number
) {
  console.log('\n=== SCENARIO 7: Batch Process Multiple Drivers ===');

  try {
    // Fetch salaries for specific drivers
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const salaries = await DriverSalary.find({
      tenantId,
      driverId: { $in: driverIds.map(id => new mongoose.Types.ObjectId(id)) },
      salaryPeriodStart: { $gte: periodStart },
      salaryPeriodEnd: { $lte: periodEnd }
    });

    console.log(`Found ${salaries.length} salaries for ${driverIds.length} drivers`);

    if (salaries.length === 0) {
      console.warn('No salaries found for the specified drivers');
      return;
    }

    // Process in batches of 5
    const batchSize = 5;
    let processed = 0;

    for (let i = 0; i < salaries.length; i += batchSize) {
      const batch = salaries.slice(i, Math.min(i + batchSize, salaries.length));
      const results = await linkBatchSalariesToLedger(
        batch,
        tenantId,
        month,
        year,
        { userId: 'batch-processor', role: 'system' }
      );

      processed += results.length;
      const successful = results.filter(r => r.status === 'success').length;
      console.log(`✓ Batch ${Math.floor(i / batchSize) + 1}: ${successful}/${results.length} successful`);
    }

    console.log(`\n✅ Batch processing complete: ${processed} drivers processed`);
    return processed;
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  const tenantId = 'sample-tenant-id';
  const month = 8;
  const year = 2026;

  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  PAYROLL INTEGRATION SERVICE - EXAMPLES            ║');
  console.log('╚════════════════════════════════════════════════════╝');

  // Example scenarios (modify with real IDs)
  // await scenario1_linkSingleSalary(tenantId, 'salary-id');
  // await scenario2_linkMonthlyPayroll(tenantId, month, year);
  // await scenario3_reconcilePayroll(tenantId, month, year);
  // await scenario4_getIntegrationReport(tenantId, month, year);
  // await scenario5_completePayrollWorkflow(tenantId, month, year);
  // await scenario6_verifySalaryComponents('salary-id');
  // await scenario7_batchProcessMultipleDrivers(tenantId, ['driver-1', 'driver-2'], month, year);
}

// Export for testing
export {
  scenario1_linkSingleSalary,
  scenario2_linkMonthlyPayroll,
  scenario3_reconcilePayroll,
  scenario4_getIntegrationReport,
  scenario5_completePayrollWorkflow,
  scenario6_verifySalaryComponents,
  scenario7_batchProcessMultipleDrivers,
  runAllExamples
};
