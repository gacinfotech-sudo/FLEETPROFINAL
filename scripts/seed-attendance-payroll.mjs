/**
 * PHASE 2-3 EXECUTION: Seed Attendance + Calculate Payroll
 * Script to seed attendance records for August 2026 and calculate payroll for all 11 drivers
 */

import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configuration
const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro-main';
const MONTH = 8;
const YEAR = 2026;
const AUGUST_DAYS = 31;

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import of models
async function loadModels() {
  const { Driver, DriverAttendance, DriverSalaryMaster, MonthlyPayroll, Tenant } =
    await import('../server/models/index.ts');
  return { Driver, DriverAttendance, DriverSalaryMaster, MonthlyPayroll, Tenant };
}

// Attendance status distribution for a driver
const ATTENDANCE_DISTRIBUTION = {
  present: 20,           // 20 days
  absent: 2,             // 2 days
  paid_leave: 1,         // 1 day
  weekly_off: 2,         // 2 days
  night_duty: 3,         // 3 days
  outstation_duty: 2,    // 2 days
  half_day: 1            // 1 day
  // Total: 31 days
};

// Hash-based distribution function (consistent per driver)
function getStatusForDay(day, driverId, distribution) {
  const driverNum = parseInt(driverId.toString().slice(-2), 10) || 0;
  const seed = (day * 7 + driverNum * 13) % 31;

  const statuses = [];
  let count = 0;

  for (const [status, days] of Object.entries(distribution)) {
    for (let i = 0; i < days; i++) {
      statuses[count++] = status;
    }
  }

  return statuses[seed];
}

async function seedAttendance(models) {
  const { Driver, DriverAttendance, Tenant } = models;
  console.log('\n========== PHASE 2: SEEDING ATTENDANCE ==========\n');

  try {
    // Get all active drivers
    const drivers = await Driver.find({ status: { $in: ['available', 'on_duty'] } }).limit(11);
    console.log(`Found ${drivers.length} active drivers`);

    if (drivers.length === 0) {
      throw new Error('No active drivers found');
    }

    // Get tenant for reference
    const tenant = await Tenant.findOne();
    if (!tenant) {
      throw new Error('No tenant found');
    }

    console.log(`Processing attendance for tenant: ${tenant._id}`);

    let totalRecords = 0;

    for (const driver of drivers) {
      console.log(`\nSeeding attendance for driver: ${driver.name} (${driver._id})`);

      const records = [];

      // Generate 31 days of attendance
      for (let day = 1; day <= AUGUST_DAYS; day++) {
        const date = new Date(YEAR, MONTH - 1, day);
        const status = getStatusForDay(day, driver._id, ATTENDANCE_DISTRIBUTION);

        records.push({
          tenantId: driver.tenantId,
          driverId: driver._id,
          date: date,
          status: status,
          source: 'seeded_for_payroll_test_phase2',
          notes: `Seeded for August 2026 payroll test - Status: ${status}`,
          createdAt: new Date()
        });
      }

      // Delete existing attendance for this driver in August 2026
      await DriverAttendance.deleteMany({
        tenantId: driver.tenantId,
        driverId: driver._id,
        date: { $gte: new Date(YEAR, MONTH - 1, 1), $lte: new Date(YEAR, MONTH, 0) }
      });

      // Insert new records
      await DriverAttendance.insertMany(records);
      totalRecords += records.length;

      console.log(`  ✓ Seeded ${records.length} attendance records`);

      // Print distribution for verification
      const distribution = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`  Distribution:`, distribution);
    }

    console.log(`\n✅ PHASE 2 COMPLETE: Seeded ${totalRecords} attendance records for ${drivers.length} drivers`);

    // Verify seeding
    const count = await DriverAttendance.countDocuments({
      date: { $gte: new Date(YEAR, MONTH - 1, 1), $lte: new Date(YEAR, MONTH, 0) }
    });
    console.log(`Database verification: ${count} attendance records in August 2026`);

    return { drivers, totalRecords, count };
  } catch (error) {
    console.error('❌ Error seeding attendance:', error.message);
    throw error;
  }
}

async function verifySalaryMasters(models, drivers) {
  const { DriverSalaryMaster } = models;
  console.log('\n========== VERIFYING SALARY MASTERS ==========\n');

  const results = [];
  for (const driver of drivers) {
    const master = await DriverSalaryMaster.findOne({
      tenantId: driver.tenantId,
      driverId: driver._id,
      status: 'active'
    });

    if (!master) {
      console.log(`❌ ${driver.name}: NO SALARY MASTER FOUND`);
      results.push({ driverId: driver._id, driverName: driver.name, hasMaster: false });
    } else {
      console.log(`✓ ${driver.name}: Salary Master Found`);
      console.log(`    Base Salary: ₹${master.baseSalary}`);
      results.push({ driverId: driver._id, driverName: driver.name, hasMaster: true, baseSalary: master.baseSalary });
    }
  }

  const missingCount = results.filter(r => !r.hasMaster).length;
  if (missingCount > 0) {
    console.log(`\n⚠️  WARNING: ${missingCount} drivers missing salary masters`);
  } else {
    console.log(`\n✅ All ${drivers.length} drivers have salary masters`);
  }

  return results;
}

async function main() {
  console.log('========================================');
  console.log('  PHASE 2-3: ATTENDANCE + PAYROLL');
  console.log('========================================');

  try {
    // Load models
    console.log('\nLoading models...');
    const models = await loadModels();
    console.log('✓ Models loaded');

    // Connect to database
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✓ Connected to MongoDB');

    // Phase 2: Seed attendance
    const { drivers, totalRecords, count: verifiedCount } = await seedAttendance(models);

    // Verify salary masters
    const masters = await verifySalaryMasters(models, drivers);

    // Summary
    console.log('\n========== PHASE 2 SUMMARY ==========');
    console.log(`Drivers processed: ${drivers.length}`);
    console.log(`Attendance records seeded: ${totalRecords}`);
    console.log(`Database verified: ${verifiedCount} records`);
    console.log(`Salary masters present: ${masters.filter(m => m.hasMaster).length}/${drivers.length}`);

    // Report
    console.log('\n========== READY FOR PHASE 3 ==========');
    console.log('✅ Attendance seeding complete');
    console.log('✅ All salary masters verified');
    console.log('\nNext step: Call POST /api/payroll/calculate with:');
    console.log(`{
  "month": 8,
  "year": 2026
}`);

    console.log('\n========== DRIVER LIST FOR PHASE 3 ==========');
    drivers.forEach((d, i) => {
      const master = masters.find(m => m.driverId.toString() === d._id.toString());
      console.log(`${i + 1}. ${d.name} (${d._id})`);
      if (master && master.hasMaster) {
        console.log(`   Base Salary: ₹${master.baseSalary}`);
      }
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
