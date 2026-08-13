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
    const { Tenant, MonthlyPayroll, DriverSalaryMaster } =
      await import('../server/models/index.ts');

    const tenant = await Tenant.findOne();
    console.log('========================================');
    console.log('  PAYROLL VERIFICATION');
    console.log('========================================\n');

    console.log('Tenant: ' + tenant._id.toString() + '\n');

    // Count payroll records
    const payrollCount = await MonthlyPayroll.countDocuments({
      tenantId: tenant._id,
      month: MONTH,
      year: YEAR
    });

    console.log('Payroll Records for August ' + YEAR + ': ' + payrollCount);

    if (payrollCount > 0) {
      console.log('\n========== PAYROLL SUMMARY ==========\n');

      const payroll = await MonthlyPayroll.findOne({
        tenantId: tenant._id,
        month: MONTH,
        year: YEAR
      });

      if (!payroll || !payroll.driverPayrolls || payroll.driverPayrolls.length === 0) {
        console.log('\nNo driver payrolls in record!');
      } else {
        const totalGross = payroll.totalGrossSalary;
        const totalDeductions = payroll.totalDeductions;
        const totalNet = payroll.totalNetSalary;
        const driverCount = payroll.driverCount;

        console.log('Driver Payroll Details:');
        console.log('');
        console.log('Idx | Driver Name           | Gross    | Deductions | Net      | Status');
        console.log(''.padEnd(75, '-'));

        payroll.driverPayrolls.forEach((d, idx) => {
          const driverName = d.driverName.substring(0, 21).padEnd(21);
          const gross = String(d.grossSalary).padEnd(8);
          const deductions = String(d.totalDeductions).padEnd(10);
          const net = String(d.netSalary).padEnd(8);
          console.log((idx + 1) + '   | ' + driverName + ' | ' + gross + ' | ' + deductions + ' | ' + net + ' | ' + d.paymentStatus);
        });

        console.log(''.padEnd(75, '-'));
        console.log('TOT | ' + ''.padEnd(21) + ' | ' + String(totalGross).padEnd(8) + ' | ' + String(totalDeductions).padEnd(10) + ' | ' + String(totalNet).padEnd(8));

        console.log('\n========== PAYROLL TOTALS ==========\n');
        console.log('Payroll ID: ' + payroll._id.toString());
        console.log('Period: ' + payroll.month + '/' + payroll.year);
        console.log('Status: ' + payroll.status);
        console.log('Driver Count: ' + driverCount);
        console.log('Total Gross Salary: ₹' + totalGross);
        console.log('Total Deductions: ₹' + totalDeductions);
        console.log('Total Net Salary: ₹' + totalNet);
        console.log('Total Paid: ₹' + payroll.totalPaid);
        console.log('Total Pending: ₹' + payroll.totalPending);

        // Compare with salary masters
        const masters = await DriverSalaryMaster.find({ tenantId: tenant._id });
        const totalBaseSalary = masters.reduce((sum, m) => sum + (m.baseSalary || 0), 0);
        const avgGross = Math.round(totalGross / driverCount);
        const avgNet = Math.round(totalNet / driverCount);

        console.log('\n========== COMPARISON WITH SALARY MASTERS ==========\n');
        console.log('Total Base Salary (11 drivers): ₹' + totalBaseSalary);
        console.log('Total Gross from Payroll: ₹' + totalGross);
        console.log('Average Gross per Driver: ₹' + avgGross);
        console.log('Average Net per Driver: ₹' + avgNet);

        console.log('\n✅ PAYROLL VERIFICATION COMPLETE');

      }

    } else {
      console.log('\nNo payroll records found!');
    }

    await mongoose.disconnect();
    console.log('\n');

  } catch (error) {
    console.error('ERROR: ' + error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
