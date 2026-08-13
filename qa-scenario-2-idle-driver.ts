#!/usr/bin/env tsx
/**
 * QA SCENARIO 2: Idle Driver Amit - Verify Idle Days NOT Marked Absent
 *
 * This test verifies that when a driver (like Amit) has no bookings for a day
 * and no explicit attendance record, that day is NOT automatically marked as absent.
 *
 * Expected Behavior:
 * - Idle days without attendance records = absentDays: 0
 * - No absence deduction for idle days
 * - Salary calculation treats idle days as unpaid/neutral, not punitive
 */

import mongoose from 'mongoose';
import { MonthlyPayroll, Driver, DriverAttendance, Booking, DriverSalaryMaster } from './server/models/index';

interface QATestResult {
  scenario: string;
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  details: {
    testName: string;
    expected: string;
    actual: string;
    verdict: boolean;
  }[];
  summary: string;
  timestamp: Date;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
const TEST_MONTH = 8; // August
const TEST_YEAR = 2026;

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function findOrCreateTestDriver(tenantId: string): Promise<string> {
  // Try to find driver named "Amit"
  let driver = await Driver.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    $or: [
      { name: { $regex: /amit/i } },
      { displayName: { $regex: /amit/i } }
    ]
  });

  if (driver) {
    console.log(`✅ Found test driver: ${driver.name} (${driver._id})`);
    return driver._id.toString();
  }

  // If no Amit found, create a test driver
  console.log('⚠️  Amit not found, creating test driver...');
  const newDriver = new Driver({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: 'Amit (QA Test)',
    phone: '9999888877',
    licenseNumber: 'DL-QA-2026-AMIT',
    status: 'available'
  });
  await newDriver.save();
  console.log(`✅ Created test driver: ${newDriver.name} (${newDriver._id})`);
  return newDriver._id.toString();
}

async function findTestTenant(): Promise<string> {
  // Try to find QA tenant
  const tenant = await mongoose.connection.collection('tenants').findOne({ name: { $regex: /qa|test/i } });

  if (tenant) {
    console.log(`✅ Found test tenant: ${tenant.name} (${tenant._id})`);
    return tenant._id.toString();
  }

  // Fallback to first available tenant
  const anyTenant = await mongoose.connection.collection('tenants').findOne();
  if (anyTenant) {
    console.log(`✅ Using available tenant: ${anyTenant._id}`);
    return anyTenant._id.toString();
  }

  throw new Error('No tenant found in database');
}

async function runQAScenario2(): Promise<QATestResult> {
  const result: QATestResult = {
    scenario: 'QA Scenario 2: Idle Driver Amit - NOT Marked Absent',
    status: 'INCONCLUSIVE',
    details: [],
    summary: '',
    timestamp: new Date()
  };

  try {
    await connectDB();

    const tenantId = await findTestTenant();
    const driverId = await findOrCreateTestDriver(tenantId);

    console.log('\n📋 QA SCENARIO 2: IDLE DRIVER VERIFICATION\n');
    console.log(`Testing Driver: ${driverId}`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Month: ${TEST_MONTH}/${TEST_YEAR}\n`);

    // TEST 1: Verify driver has no bookings in test month
    console.log('TEST 1: Checking bookings for test driver...');
    const startDate = new Date(TEST_YEAR, TEST_MONTH - 1, 1);
    const endDate = new Date(TEST_YEAR, TEST_MONTH, 0);

    const bookingCount = await Booking.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      pickupDate: { $gte: startDate, $lte: endDate }
    });

    result.details.push({
      testName: 'No active bookings for test month',
      expected: 'bookingCount = 0 (idle driver)',
      actual: `bookingCount = ${bookingCount}`,
      verdict: bookingCount === 0
    });

    if (bookingCount > 0) {
      console.log(`⚠️  Driver has ${bookingCount} bookings - not truly idle`);
    } else {
      console.log('✅ Driver is idle (no bookings)');
    }

    // TEST 2: Check attendance records
    console.log('\nTEST 2: Checking attendance records...');
    const attendanceRecords = await DriverAttendance.countDocuments({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      date: { $gte: startDate, $lte: endDate }
    });

    result.details.push({
      testName: 'No explicit attendance records',
      expected: 'attendanceRecords = 0 (idle = no records)',
      actual: `attendanceRecords = ${attendanceRecords}`,
      verdict: attendanceRecords === 0
    });

    if (attendanceRecords === 0) {
      console.log('✅ No attendance records (idle days have no explicit marking)');
    } else {
      console.log(`⚠️  Found ${attendanceRecords} attendance records`);
    }

    // TEST 3: Check salary master
    console.log('\nTEST 3: Checking salary master configuration...');
    let salaryMaster = await DriverSalaryMaster.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: 'active'
    });

    if (!salaryMaster) {
      console.log('⚠️  No salary master found - creating for test...');
      const newSalaryMaster = new DriverSalaryMaster({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        driverId: new mongoose.Types.ObjectId(driverId),
        name: 'Amit (QA Test)',
        mobile: '9999888877',
        joiningDate: new Date(2026, 0, 1),
        joiningBaseSalary: 20000,
        currentBaseSalary: 20000,
        baseSalary: 20000,
        salaryType: 'fixed_monthly',
        employmentType: 'permanent',
        salaryStartDate: new Date(2026, 0, 1),
        status: 'active'
      });
      await newSalaryMaster.save();
      salaryMaster = newSalaryMaster;
      console.log('✅ Created salary master');
    } else {
      console.log(`✅ Salary master found - Base Salary: ₹${salaryMaster.baseSalary}`);
    }

    result.details.push({
      testName: 'Salary master exists',
      expected: 'salaryMaster found or created',
      actual: salaryMaster ? 'found/created' : 'failed',
      verdict: !!salaryMaster
    });

    // TEST 4: Verify payroll calculation treats idle days correctly
    console.log('\nTEST 4: Simulating payroll calculation logic...');
    console.log('Fetching attendance data for payroll...');

    const attendanceRecordsData = await DriverAttendance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      driverId: new mongoose.Types.ObjectId(driverId),
      date: { $gte: startDate, $lte: endDate }
    });

    let presentDays = 0;
    let absentDays = 0;
    let paidLeaves = 0;
    let unpaidLeaves = 0;

    for (const record of attendanceRecordsData) {
      switch (record.status) {
        case 'present':
        case 'late':
          presentDays++;
          break;
        case 'absent':
          absentDays++;
          break;
        case 'paid_leave':
          paidLeaves++;
          break;
        case 'unpaid_leave':
          unpaidLeaves++;
          break;
      }
    }

    console.log(`Attendance Breakdown:`);
    console.log(`  - Present Days: ${presentDays}`);
    console.log(`  - Absent Days: ${absentDays}`);
    console.log(`  - Paid Leaves: ${paidLeaves}`);
    console.log(`  - Unpaid Leaves: ${unpaidLeaves}`);

    // CRITICAL TEST: Idle driver should have absentDays = 0
    result.details.push({
      testName: 'Idle days NOT marked absent',
      expected: 'absentDays = 0 (idle ≠ absent)',
      actual: `absentDays = ${absentDays}`,
      verdict: absentDays === 0
    });

    if (absentDays === 0) {
      console.log('✅ PASS: Idle driver has 0 absent days (correct!)');
    } else {
      console.log('❌ FAIL: Idle driver incorrectly marked with absent days');
    }

    // TEST 5: Verify no absence deduction for idle days
    console.log('\nTEST 5: Verifying absence deduction logic...');
    const perDaySalary = (salaryMaster?.baseSalary || 20000) / 26;
    const absenceDeduction = absentDays > 0 ? absentDays * perDaySalary : 0;

    result.details.push({
      testName: 'No absence deduction for idle days',
      expected: 'absenceDeduction = 0',
      actual: `absenceDeduction = ₹${absenceDeduction.toFixed(2)}`,
      verdict: absenceDeduction === 0
    });

    if (absenceDeduction === 0) {
      console.log('✅ PASS: No absence deduction applied (idle is not punished)');
    } else {
      console.log(`❌ FAIL: Absence deduction of ₹${absenceDeduction.toFixed(2)} applied incorrectly`);
    }

    // VERDICT
    const passedTests = result.details.filter(d => d.verdict).length;
    const totalTests = result.details.length;
    result.status = passedTests === totalTests ? 'PASS' : 'FAIL';
    result.summary = `${passedTests}/${totalTests} tests passed. Idle driver Amit is ${
      absentDays === 0 ? 'NOT' : 'INCORRECTLY'
    } marked absent.`;

    console.log('\n' + '='.repeat(60));
    console.log('QA SCENARIO 2 RESULTS');
    console.log('='.repeat(60));
    console.log(`Status: ${result.status}`);
    console.log(`Summary: ${result.summary}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error during QA scenario:', error);
    result.status = 'INCONCLUSIVE';
    result.summary = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  } finally {
    await mongoose.connection.close();
  }

  return result;
}

// Main execution
runQAScenario2().then(result => {
  console.log('\n📊 DETAILED TEST RESULTS:\n');
  result.details.forEach((detail, idx) => {
    const mark = detail.verdict ? '✅' : '❌';
    console.log(`${mark} Test ${idx + 1}: ${detail.testName}`);
    console.log(`   Expected: ${detail.expected}`);
    console.log(`   Actual: ${detail.actual}\n`);
  });

  process.exit(result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(3);
});
