/**
 * COMPLETE PAYROLL PHASES 1-3
 * Phase 1: Create salary masters for 11 drivers
 * Phase 2: Seed attendance for August 2026
 * Phase 3: Prepare for payroll calculation
 */

import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro-main';
const MONTH = 8;
const YEAR = 2026;

async function main() {
  console.log('========================================');
  console.log('  PHASE 1-2-3: COMPLETE PAYROLL SETUP');
  console.log('========================================\n');

  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const { Tenant, Driver, DriverSalaryMaster, DriverAttendance } =
    await import('../server/models/index.ts');

  try {
    // ========== PHASE 0: Setup Tenant ==========
    console.log('\n========== PHASE 0: TENANT SETUP ==========');

    let tenant = await Tenant.findOne();
    if (!tenant) {
      console.log('Creating test tenant...');
      tenant = new Tenant({
        name: 'Test Fleet Company',
        businessName: 'Test Fleet Company Ltd.',
        email: 'test@fleet.local',
        phone: '+919876543210',
        address: 'Test Address, City',
        isActive: true,
        maxManagers: 5,
        subscriptionPlan: 'pro',
        limits: {
          vehicles: 100,
          drivers: 50,
          managers: 5
        }
      });
      await tenant.save();
      console.log(`✓ Tenant created: ${tenant._id}`);
    } else {
      console.log(`✓ Using existing tenant: ${tenant._id}`);
    }

    // ========== PHASE 1: CREATE 11 DRIVERS ==========
    console.log('\n========== PHASE 1: CREATE DRIVERS ==========');

    const driverNames = [
      'Ajay Kumar', 'Ramesh Singh', 'Pradeep Patel', 'Suresh Reddy',
      'Vikram Sharma', 'Bhavesh Joshi', 'Mahesh Verma', 'Sandeep Gupta',
      'Ravi Kumar', 'Arjun Singh', 'Nitin Desai'
    ];

    const drivers = [];
    for (const name of driverNames) {
      let driver = await Driver.findOne({ tenantId: tenant._id, name });

      if (!driver) {
        driver = new Driver({
          tenantId: tenant._id,
          name,
          phone: `981${Math.random().toString().slice(2, 9).padEnd(7, '0')}`,
          email: `${name.toLowerCase().replace(' ', '.')}@fleet.local`,
          licenseNumber: `DL-${Math.random().toString().slice(2, 10).toUpperCase()}`,
          experience: Math.floor(Math.random() * 15) + 1,
          rating: (Math.random() * 2 + 3).toFixed(1),
          status: 'available',
          lifecycleStage: 'active',
          dateOfJoining: new Date('2023-01-01')
        });
        await driver.save();
        console.log(`✓ Created driver: ${name}`);
      } else {
        console.log(`✓ Using existing driver: ${name}`);
      }
      drivers.push(driver);
    }

    console.log(`\n✅ Total drivers: ${drivers.length}`);

    // ========== PHASE 1B: CREATE SALARY MASTERS ==========
    console.log('\n========== PHASE 1B: CREATE SALARY MASTERS ==========');

    const baseSalaries = [
      15000, 16000, 15500, 17000, 18000,
      15800, 16500, 17500, 15200, 16800, 17200
    ];

    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      const baseSalary = baseSalaries[i];

      let master = await DriverSalaryMaster.findOne({
        tenantId: tenant._id,
        driverId: driver._id
      });

      if (!master) {
        master = new DriverSalaryMaster({
          tenantId: tenant._id,
          driverId: driver._id,
          name: driver.name,
          mobile: driver.phone,
          joiningDate: driver.dateOfJoining || new Date('2023-01-01'),
          salaryType: 'fixed_monthly',
          baseSalary,
          perDaySalary: Math.floor(baseSalary / 26),
          kmIncentivePerKm: 2,
          nightAllowancePerNight: 500,
          outstationAllowancePerDay: 300,
          foodAllowance: 1000,
          weeklyOffDays: [6], // Sunday
          weeklyOffLeaveType: 'paid',
          salaryStartDate: new Date('2026-08-01'),
          status: 'active'
        });
        await master.save();
        console.log(`✓ Created salary master for ${driver.name}: ₹${baseSalary}`);
      } else {
        console.log(`✓ Using existing salary master for ${driver.name}: ₹${baseSalary}`);
      }
    }

    console.log(`\n✅ Salary masters created/verified: ${drivers.length}`);

    // ========== PHASE 2: SEED ATTENDANCE ==========
    console.log('\n========== PHASE 2: SEED ATTENDANCE ==========');

    const ATTENDANCE_DISTRIBUTION = {
      present: 20,
      absent: 2,
      paid_leave: 1,
      weekly_off: 2,
      on_duty: 3,    // was night_duty
      late: 2,       // was outstation_duty
      half_day: 1
    };

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

    let totalAttendanceRecords = 0;

    for (const driver of drivers) {
      // Clear existing August 2026 attendance
      await DriverAttendance.deleteMany({
        tenantId: tenant._id,
        driverId: driver._id,
        date: { $gte: new Date(YEAR, MONTH - 1, 1), $lte: new Date(YEAR, MONTH, 0) }
      });

      const records = [];
      for (let day = 1; day <= 31; day++) {
        const date = new Date(YEAR, MONTH - 1, day);
        const status = getStatusForDay(day, driver._id, ATTENDANCE_DISTRIBUTION);

        records.push({
          tenantId: tenant._id,
          driverId: driver._id,
          date,
          status,
          source: 'manual',
          notes: `Seeded for August 2026 - Status: ${status}`,
          createdAt: new Date(),
          markedBy: {
            userId: 'system-seed',
            role: 'admin'
          }
        });
      }

      await DriverAttendance.insertMany(records);
      totalAttendanceRecords += records.length;

      const dist = records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      console.log(`✓ ${driver.name}: 31 records seeded`);
      console.log(`  Distribution: ${JSON.stringify(dist)}`);
    }

    console.log(`\n✅ PHASE 2 COMPLETE: ${totalAttendanceRecords} attendance records seeded`);

    // ========== PHASE 3: SUMMARY ==========
    console.log('\n========== PHASE 3: SUMMARY & NEXT STEPS ==========');

    const attendanceCount = await DriverAttendance.countDocuments({
      date: { $gte: new Date(YEAR, MONTH - 1, 1), $lte: new Date(YEAR, MONTH, 0) }
    });

    const masterCount = await DriverSalaryMaster.countDocuments({
      tenantId: tenant._id,
      status: 'active'
    });

    const driverCount = await Driver.countDocuments({
      tenantId: tenant._id,
      status: 'available'
    });

    console.log(`
✅ Setup Complete:
   - Tenant ID: ${tenant._id}
   - Drivers: ${driverCount}
   - Salary Masters: ${masterCount}
   - Attendance Records (Aug 2026): ${attendanceCount}

📋 Driver List for Payroll Calculation:
`);

    for (let i = 0; i < drivers.length; i++) {
      console.log(`   ${i + 1}. ${drivers[i].name} (${drivers[i]._id})`);
    }

    console.log(`
🚀 Next Step: Calculate Payroll

Call API:
  POST /api/payroll/calculate
  Body: {
    "month": 8,
    "year": 2026
  }

Expected Response:
  - 11 drivers processed
  - Each with baseSalary, gross, deductions, net payable
  - Summary with totals

⚠️  Note: Server is running on port 5050
    Use authentication headers from your session
`);

    await mongoose.disconnect();
    console.log('\n✅ Database setup complete\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main().catch(console.error);
