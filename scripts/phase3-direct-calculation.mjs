/**
 * PHASE 3: DIRECT PAYROLL CALCULATION
 * Calls the payroll calculation service directly
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro-main';
const MONTH = 8;
const YEAR = 2026;

async function main() {
  console.log('========================================');
  console.log('  PHASE 3: CALCULATE PAYROLL (DIRECT)');
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  try {
    const { Tenant, Driver, DriverSalaryMaster, DriverAttendance, MonthlyPayroll } =
      await import('../server/models/index.ts');
    const { calculatePayroll } = await import('../server/services/monthlyPayrollService.ts');

    // Get tenant
    const tenant = await Tenant.findOne();
    if (!tenant) {
      throw new Error('No tenant found');
    }

    console.log(`\n✓ Tenant: ${tenant._id}`);

    // Get drivers
    const drivers = await Driver.find({ tenantId: tenant._id });
    console.log(`✓ Found ${drivers.length} drivers`);

    // Verify prerequisites
    const masters = await DriverSalaryMaster.find({ tenantId: tenant._id });
    console.log(`✓ Found ${masters.length} salary masters`);

    const attendance = await DriverAttendance.countDocuments({
      tenantId: tenant._id,
      date: { $gte: new Date(YEAR, MONTH - 1, 1), $lte: new Date(YEAR, MONTH, 0) }
    });
    console.log(`✓ Found ${attendance} attendance records for August ${YEAR}`);

    console.log('\n========== CALLING PAYROLL CALCULATION SERVICE ==========\n');

    // Prepare input
    const calculateInput = {
      tenantId: tenant._id.toString(),
      month: MONTH,
      year: YEAR,
      drivers: undefined  // Calculate for all drivers
    };

    console.log('Calculation Input:', JSON.stringify(calculateInput, null, 2));

    // Call the payroll calculation service
    const result = await calculatePayroll(calculateInput, {
      userId: 'system-seed',
      role: 'admin'
    });

    console.log('\n========== PAYROLL CALCULATION RESULT ==========\n');
    console.log('Status:', result.status);
    console.log('Month:', result.month);
    console.log('Year:', result.year);

    if (result.drivers && result.drivers.length > 0) {
      console.log(`\n✅ Drivers Processed: ${result.drivers.length}\n`);

      console.log('========== DRIVER PAYROLL BREAKDOWN ==========\n');

      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      result.drivers.forEach((d, idx) => {
        console.log(`${idx + 1}. ${d.driverName} (${d.driverId})`);
        console.log(`   Base Salary: ₹${d.baseSalary}`);
        console.log(`   Gross Salary: ₹${d.grossSalary}`);
        console.log(`   Deductions: ₹${d.deductions}`);
        console.log(`   Net Payable: ₹${d.netPayable}`);
        console.log(`   Status: ${d.status}\n`);

        totalGross += d.grossSalary || 0;
        totalDeductions += d.deductions || 0;
        totalNet += d.netPayable || 0;
      });

      console.log('========== PAYROLL SUMMARY ==========\n');
      console.log(`Total Drivers: ${result.drivers.length}`);
      console.log(`Total Gross Salary: ₹${totalGross}`);
      console.log(`Total Deductions: ₹${totalDeductions}`);
      console.log(`Total Net Payable: ₹${totalNet}`);

      if (result.summary) {
        console.log(`\n========== API SUMMARY ==========\n`);
        console.log('Summary:', JSON.stringify(result.summary, null, 2));
      }
    } else {
      console.log('\n⚠️  No drivers in calculation result');
    }

    // Verify in database
    console.log('\n========== DATABASE VERIFICATION ==========\n');

    const payrolls = await MonthlyPayroll.countDocuments({
      tenantId: tenant._id,
      month: MONTH,
      year: YEAR
    });

    console.log(`Payroll records created: ${payrolls}`);

    if (payrolls > 0) {
      const payrollSample = await MonthlyPayroll.find({
        tenantId: tenant._id,
        month: MONTH,
        year: YEAR
      }).limit(3);

      console.log('\nSample payroll records:');
      payrollSample.forEach((p, idx) => {
        console.log(`  ${idx + 1}. Driver: ${p.driverId} - Net: ₹${p.netPayable}`);
      });
    }

    console.log('\n✅ PHASE 3 COMPLETE - PAYROLL CALCULATED\n');

    await mongoose.disconnect();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main().catch(console.error);
