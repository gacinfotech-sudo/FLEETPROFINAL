/**
 * VERIFY PAYROLL CALCULATION RESULTS
 * Check payroll records in database for August 2026
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro-main';
const MONTH = 8;
const YEAR = 2026;

async function main() {
  await mongoose.connect(MONGODB_URI);

  try {
    const { Tenant, Driver, MonthlyPayroll, DriverSalaryMaster } =
      await import('../server/models/index.ts');

    const tenant = await Tenant.findOne();
    console.log('========================================');
    console.log('  PAYROLL VERIFICATION');
    console.log('========================================\n');

    console.log(`Tenant: ${tenant._id}\n`);

    // Count payroll records
    const payrollCount = await MonthlyPayroll.countDocuments({
      tenantId: tenant._id,
      month: MONTH,
      year: YEAR
    });

    console.log(`Payroll Records for August ${YEAR}: ${payrollCount}`);

    if (payrollCount > 0) {
      console.log('\n========== PAYROLL SUMMARY ==========\n');

      const payroll = await MonthlyPayroll.findOne({
        tenantId: tenant._id,
        month: MONTH,
        year: YEAR
      });

      if (!payroll || !payroll.driverPayrolls || payroll.driverPayrolls.length === 0) {
        console.log('\n❌ No driver payrolls in record!');
      } else {
        const totalGross = payroll.totalGrossSalary;
        const totalDeductions = payroll.totalDeductions;
        const totalNet = payroll.totalNetSalary;
        const driverCount = payroll.driverCount;

        console.log(`Index | Driver Name           | Gross Salary | Deductions | Net Salary | Payment Status`);
        console.log('-'.repeat(100));

        payroll.driverPayrolls.forEach((d, idx) => {
          console.log(`${String(idx + 1).padEnd(5)} | ${d.driverName.padEnd(21)} | ₹${String(d.grossSalary).padEnd(11)} | ₹${String(d.totalDeductions).padEnd(9)} | ₹${String(d.netSalary).padEnd(9)} | ${d.paymentStatus}`);
        });

        console.log('-'.repeat(100));
        console.log(`${'TOTAL'.padEnd(5)} | ${''.padEnd(21)} | ₹${String(totalGross).padEnd(11)} | ₹${String(totalDeductions).padEnd(9)} | ₹${String(totalNet).padEnd(9)}`);

        console.log(`\n========== DETAILED BREAKDOWN (FIRST 3 DRIVERS) ==========\n`);

        payroll.driverPayrolls.slice(0, 3).forEach((d, idx) => {
          console.log(`\n${idx + 1}. ${d.driverName}`);
          console.log(`   Driver ID: ${d.driverId}`);
          console.log(`   Base Salary: ₹${d.baseSalary}`);
          if (d.attendanceBonus) console.log(`   Attendance Bonus: ₹${d.attendanceBonus}`);
          if (d.tripIncentive) console.log(`   Trip Incentive: ₹${d.tripIncentive}`);
          if (d.kmIncentive) console.log(`   KM Incentive: ₹${d.kmIncentive}`);
          if (d.nightAllowance) console.log(`   Night Allowance: ₹${d.nightAllowance}`);
          if (d.outstationAllowance) console.log(`   Outstation Allowance: ₹${d.outstationAllowance}`);
          console.log(`   Gross Salary: ₹${d.grossSalary}`);
          if (d.absenceDeduction) console.log(`   Absence Deduction: ₹${d.absenceDeduction}`);
          console.log(`   Total Deductions: ₹${d.totalDeductions}`);
          console.log(`   Net Salary: ₹${d.netSalary}`);
          console.log(`   Payment Status: ${d.paymentStatus}`);
        });

        console.log('\n✅ PAYROLL VERIFICATION COMPLETE');
        console.log(`\nSummary:`);
        console.log(`  - Payroll ID: ${payroll._id}`);
        console.log(`  - Period: ${payroll.month}/${payroll.year}`);
        console.log(`  - Status: ${payroll.status}`);
        console.log(`  - Driver Count: ${driverCount}`);
        console.log(`  - Total Gross Salary: ₹${totalGross}`);
        console.log(`  - Total Deductions: ₹${totalDeductions}`);
        console.log(`  - Total Net Salary: ₹${totalNet}`);
        console.log(`  - Total Paid: ₹${payroll.totalPaid}`);
        console.log(`  - Total Pending: ₹${payroll.totalPending}`);

        // Compare with salary masters
        const masters = await DriverSalaryMaster.find({ tenantId: tenant._id });
        const totalBaseSalary = masters.reduce((sum, m) => sum + (m.baseSalary || 0), 0);
        console.log(`\n  - Total Base Salary (11 drivers): ₹${totalBaseSalary}`);
        console.log(`  - Average Gross per Driver: ₹${Math.round(totalGross / driverCount)}`);
        console.log(`  - Average Net per Driver: ₹${Math.round(totalNet / driverCount)}`);

    } else {
      console.log('\n❌ No payroll records found!');
    }

    await mongoose.disconnect();
    console.log('\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
