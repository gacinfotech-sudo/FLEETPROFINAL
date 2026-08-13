#!/usr/bin/env node
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function runAudit() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';

  console.log('\n' + '='.repeat(100));
  console.log('PHASE 1 EXECUTION: PAYROLL AUDIT & CLEANUP');
  console.log('='.repeat(100) + '\n');

  try {
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    console.log('✅ Connected to MongoDB\n');

    // ============================================================================
    // TASK 1: IDENTIFY ACTIVE DRIVERS
    // ============================================================================
    console.log('📋 TASK 1: IDENTIFY ACTIVE DRIVERS');
    console.log('-'.repeat(100));

    const activeDrivers = await db.collection('drivers').find({
      status: 'active'
    }).project({
      _id: 1,
      name: 1,
      phone: 1,
      email: 1,
      status: 1,
      dateOfJoining: 1,
      tenantId: 1
    }).toArray();

    console.log(`✅ Found ${activeDrivers.length} active drivers\n`);

    // ============================================================================
    // TASK 2: CHECK SALARY CONFIG STATUS
    // ============================================================================
    console.log('📋 TASK 2: CHECK SALARY CONFIG STATUS');
    console.log('-'.repeat(100));

    const configStatus = [];
    const needsConfig = [];

    for (const driver of activeDrivers) {
      const salaryMaster = await db.collection('driversalarymaster').findOne({
        driverId: driver._id
      });

      const status = {
        id: driver._id.toString(),
        name: driver.name || 'Unknown',
        phone: driver.phone || 'N/A',
        driverStatus: driver.status,
        salaryConfigured: !!salaryMaster,
        baseSalary: salaryMaster?.baseSalary || null,
        salaryType: salaryMaster?.salaryType || null
      };

      configStatus.push(status);

      if (!salaryMaster) {
        needsConfig.push({
          id: driver._id.toString(),
          name: driver.name || 'Unknown',
          tenantId: driver.tenantId.toString()
        });
      }
    }

    console.log('Active Drivers Salary Config Status:');
    configStatus.forEach((d, i) => {
      const configStatus = d.salaryConfigured ? '✅' : '❌';
      const salary = d.baseSalary ? `₹${d.baseSalary}` : 'NEEDS CONFIG';
      console.log(`${i + 1}. ${d.name} (${d.id.slice(0, 8)}...) - ${configStatus} ${salary}`);
    });

    console.log(`\nSummary: ${configStatus.filter(d => d.salaryConfigured).length} configured, ${needsConfig.length} need config\n`);

    // ============================================================================
    // TASK 3: CREATE SALARY CONFIG FOR UNCONFIGURED DRIVERS
    // ============================================================================
    console.log('📋 TASK 3: CREATE SALARY CONFIG FOR UNCONFIGURED DRIVERS');
    console.log('-'.repeat(100));

    let newConfigCreated = 0;

    for (const driverToConfig of needsConfig) {
      const driver = activeDrivers.find(d => d._id.toString() === driverToConfig.id);
      if (!driver) {
        console.log(`   ⚠️  Driver not found: ${driverToConfig.name}`);
        continue;
      }

      const newConfig = {
        tenantId: driver.tenantId,
        driverId: driver._id,
        name: driver.name,
        mobile: driver.phone,
        baseSalary: 20000,
        salaryType: 'fixed_monthly',
        foodAllowance: 150,
        nightAllowancePerNight: 500,
        outstationAllowancePerDay: 1000,
        weeklyOffLeaveType: 'paid',
        status: 'active',
        salaryStartDate: new Date(),
        joiningDate: driver.dateOfJoining || new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await db.collection('driversalarymaster').insertOne(newConfig);
        newConfigCreated++;
        console.log(`   ✅ Created config for ${driver.name} (₹${newConfig.baseSalary})`);
      } catch (error) {
        console.log(`   ⚠️  Failed to create config for ${driver.name}: ${error.message}`);
      }
    }

    console.log(`\n✅ Created ${newConfigCreated} new salary configs\n`);

    // ============================================================================
    // TASK 4: IDENTIFY ORPHANED SALARY MASTERS
    // ============================================================================
    console.log('📋 TASK 4: IDENTIFY ORPHANED SALARY MASTERS');
    console.log('-'.repeat(100));

    const allSalaryMasters = await db.collection('driversalarymaster').find({
      status: { $ne: 'archived' }
    }).toArray();
    const orphanedMasters = [];

    for (const master of allSalaryMasters) {
      const driver = activeDrivers.find(
        d => d._id.toString() === master.driverId.toString()
      );
      if (!driver) {
        orphanedMasters.push({
          driverId: master.driverId.toString(),
          driverName: master.name || 'Unknown',
          baseSalary: master.baseSalary,
          salaryType: master.salaryType
        });
      }
    }

    console.log(`Orphaned Salary Masters: ${orphanedMasters.length}`);
    if (orphanedMasters.length > 0) {
      const toShow = orphanedMasters.slice(0, 10);
      toShow.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.driverName} (${m.salaryType}) - ₹${m.baseSalary}`);
      });
      if (orphanedMasters.length > 10) {
        console.log(`   ... and ${orphanedMasters.length - 10} more`);
      }
    }
    console.log('');

    console.log('Cleanup Option (DO NOT EXECUTE YET):');
    console.log(`   Would mark ${orphanedMasters.length} salary masters as archived`);
    console.log('   Strategy: Set status="archived" to preserve historical records\n');

    // ============================================================================
    // TASK 5: MISSING ATTENDANCE DATA WARNING
    // ============================================================================
    console.log('📋 TASK 5: CHECK ATTENDANCE DATA');
    console.log('-'.repeat(100));

    let attendanceCount = 0;
    try {
      const attendanceCollection = db.collection('driverattendances');
      attendanceCount = await attendanceCollection.countDocuments({});
    } catch (error) {
      console.log('   ⚠️  Attendance collection not found');
    }

    console.log(`Attendance Records: ${attendanceCount}`);
    if (attendanceCount === 0) {
      console.log('⚠️  WARNING: No attendance records found.');
      console.log('   Payroll will calculate GROSS SALARY ONLY.');
      console.log('   Bonuses/incentives requiring attendance will be ₹0 until attendance is added.\n');
    } else {
      console.log(`   ✅ Attendance data available for calculations\n`);
    }

    // ============================================================================
    // TASK 6: PREPARE PAYROLL FOR CALCULATION
    // ============================================================================
    console.log('📋 TASK 6: PREPARE PAYROLL FOR CALCULATION');
    console.log('-'.repeat(100));

    const configuredDriversCount = configStatus.filter(d => d.salaryConfigured).length;
    const readyForCalculation =
      activeDrivers.length > 0 &&
      configuredDriversCount === activeDrivers.length &&
      orphanedMasters.length === 0;

    console.log(`Active drivers: ${activeDrivers.length}`);
    console.log(`Configured: ${configuredDriversCount}/${activeDrivers.length}`);
    console.log(`Orphaned masters: ${orphanedMasters.length}`);
    console.log(`Attendance records: ${attendanceCount}`);
    console.log(`Ready for calculation: ${readyForCalculation ? '✅ YES' : '❌ NO'}\n`);

    // ============================================================================
    // FINAL REPORT
    // ============================================================================
    console.log('='.repeat(100));
    console.log('FINAL OUTPUT');
    console.log('='.repeat(100) + '\n');

    const blockers = [];
    if (attendanceCount === 0) {
      blockers.push('attendance data missing - payroll will calculate gross salary only');
    }
    if (configuredDriversCount < activeDrivers.length) {
      blockers.push(`${activeDrivers.length - configuredDriversCount} drivers missing salary config`);
    }
    if (orphanedMasters.length > 0) {
      blockers.push(`${orphanedMasters.length} orphaned salary masters`);
    }

    const result = {
      activedrivers: configStatus.map(d => ({
        id: d.id,
        name: d.name,
        status: d.driverStatus,
        salaryConfigured: d.salaryConfigured,
        baseSalary: d.baseSalary
      })),
      needsConfig: needsConfig.map(d => ({ id: d.id, name: d.name })),
      newConfigCreated,
      orphanedMasters: orphanedMasters.length,
      attendanceRecords: attendanceCount,
      readyForCalculation,
      blockers,
      nextStep: readyForCalculation
        ? 'Run payroll calculation for current month'
        : `Fix blockers: ${blockers.join('; ')}`
    };

    console.log(JSON.stringify(result, null, 2));

    console.log('\n' + '='.repeat(100));
    console.log('AUDIT COMPLETE');
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Error during payroll audit:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runAudit();
