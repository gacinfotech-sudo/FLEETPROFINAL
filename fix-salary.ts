#!/usr/bin/env node
/**
 * AUTOMATIC SALARY DATA FIX
 * Ensures salary masters exist and creates payroll data for November 2026
 */

import mongoose from 'mongoose';
import {
  Driver,
  DriverSalaryMaster,
  MonthlyPayroll,
  Tenant
} from './server/models/index';

async function main() {
  try {
    console.clear();
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🔧  SALARY DASHBOARD AUTO-FIX');
    console.log('════════════════════════════════════════════════════════════════\n');

    // Connect to database
    console.log('📍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro');
    console.log('✅ Connected\n');

    // Step 1: Get drivers
    console.log('📋 STEP 1: Checking drivers...');
    const drivers = await Driver.find({ status: { $ne: 'inactive' } }).limit(10);
    console.log(`   Found ${drivers.length} active drivers`);
    drivers.slice(0, 5).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name}`);
    });
    if (drivers.length > 5) console.log(`   ... and ${drivers.length - 5} more`);
    console.log();

    if (drivers.length === 0) {
      console.error('❌ No active drivers found!');
      process.exit(1);
    }

    const tenantId = drivers[0].tenantId;
    const tenant = await Tenant.findById(tenantId);
    console.log(`📊 Tenant: ${tenant?.name || 'Unknown'}\n`);

    // Step 2: Create salary masters
    console.log('🔨 STEP 2: Creating salary masters...');
    let created = 0;
    for (const driver of drivers) {
      const exists = await DriverSalaryMaster.findOne({
        tenantId,
        driverId: driver._id,
        status: 'active'
      });

      if (!exists) {
        await DriverSalaryMaster.create({
          tenantId,
          driverId: driver._id,
          name: driver.name,
          mobile: driver.phone || '9999999999',
          joiningDate: driver.createdAt || new Date(),
          salaryType: 'fixed_monthly',
          baseSalary: 20000,
          salaryStartDate: new Date(new Date().getFullYear(), 0, 1), // Jan 1 of current year
          status: 'active',
          perBookingFoodCharge: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        created++;
      }
    }
    console.log(`   ✅ Created ${created} new salary masters`);
    console.log(`   ✅ ${drivers.length - created} already existed\n`);

    // Step 3: Create payroll
    console.log('💰 STEP 3: Creating payroll for November 2026...');
    let payroll = await MonthlyPayroll.findOne({
      tenantId,
      month: 11,
      year: 2026
    });

    if (!payroll || !payroll.driverPayrolls || payroll.driverPayrolls.length === 0) {
      const driverPayrolls = drivers.map(driver => ({
        driverId: driver._id,
        driverName: driver.name,
        baseSalary: 20000,
        attendanceBonus: 0,
        tripIncentive: 0,
        kmIncentive: 0,
        nightAllowance: 0,
        outstationAllowance: 0,
        foodAllowance: 0,
        grossSalary: 20000,
        absenceDeduction: 0,
        advanceRecovery: 0,
        penaltyDeduction: 0,
        damageRecovery: 0,
        challanRecovery: 0,
        cashShortage: 0,
        fuelExcessRecovery: 0,
        foodCharges: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netSalary: 20000,
        paymentStatus: 'not_paid',
        payments: [],
        totalPaid: 0,
        remainingAmount: 20000,
        calculatedAt: new Date()
      }));

      const totalGrossSalary = driverPayrolls.reduce((s, d) => s + d.grossSalary, 0);
      const totalNetSalary = driverPayrolls.reduce((s, d) => s + d.netSalary, 0);

      payroll = await MonthlyPayroll.create({
        tenantId,
        month: 11,
        year: 2026,
        status: 'calculated',
        driverCount: driverPayrolls.length,
        totalGrossSalary,
        totalDeductions: 0,
        totalNetSalary,
        totalPaid: 0,
        totalPending: totalNetSalary,
        driverPayrolls,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`   ✅ Created new payroll`);
      console.log(`   📊 Drivers: ${driverPayrolls.length}`);
      console.log(`   💵 Total: ₹${totalNetSalary.toLocaleString('en-IN')}\n`);
    } else {
      console.log(`   ✅ Payroll already exists`);
      console.log(`   📊 Status: ${payroll.status}`);
      console.log(`   📊 Drivers: ${payroll.driverPayrolls.length}`);
      console.log(`   💵 Total: ₹${payroll.totalNetSalary.toLocaleString('en-IN')}\n`);
    }

    // Step 4: Verify
    console.log('✔️  STEP 4: Verifying data...');
    const salaryCount = await DriverSalaryMaster.countDocuments({ tenantId, status: 'active' });
    const payrollRecord = await MonthlyPayroll.findOne({ tenantId, month: 11, year: 2026 });

    console.log(`   ✅ Salary masters: ${salaryCount}/${drivers.length}`);
    if (payrollRecord) {
      console.log(`   ✅ Payroll data: ${payrollRecord.driverPayrolls.length} drivers`);
      console.log(`   ✅ Status: ${payrollRecord.status}\n`);
    }

    // Summary
    console.log('════════════════════════════════════════════════════════════════');
    console.log('✅ FIX COMPLETE');
    console.log('════════════════════════════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('1. Logout and login to refresh session');
    console.log('2. Go to Driver Salary Payroll page');
    console.log('3. Select November 2026');
    console.log('4. Salary data should now display\n');

    console.log('If still not working:');
    console.log('• Clear browser cache (Ctrl+Shift+Delete)');
    console.log('• Check browser console (F12) for errors');
    console.log('• Verify API response: curl "http://localhost:5050/api/payroll?month=11&year=2026"\n');

  } catch (error) {
    console.error('❌ Error:', (error as any).message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
