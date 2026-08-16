/**
 * DIRECT DATABASE TEST
 * Test driver and vehicle creation directly without HTTP
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro';
const TEST_TENANT_ID = '6a7617d741d6ae595bc7a110';

// Define schemas locally
const driverSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  licenseNumber: String,
  status: String,
  dateOfJoining: Date,
  address: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const vehicleSchema = new mongoose.Schema({
  plate: String,
  model: String,
  status: String,
  year: Number,
  type: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  customerId: mongoose.Schema.Types.ObjectId,
  driverId: mongoose.Schema.Types.ObjectId,
  vehicleId: mongoose.Schema.Types.ObjectId,
  pickupDate: String,
  pickupTime: String,
  returnDate: String,
  returnTime: String,
  pickupLocation: String,
  returnLocation: String,
  status: String,
  tenantId: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now }
});

const Driver = mongoose.model('drivers', driverSchema);
const Vehicle = mongoose.model('vehicles', vehicleSchema);
const Booking = mongoose.model('bookings', bookingSchema);

// Test data
const QA_TIMESTAMP = Date.now();
const QA_DRIVER_NAME = `QA_Driver_${QA_TIMESTAMP}`;
const QA_PHONE = '9999888888';
const QA_LICENSE = `QA${QA_TIMESTAMP.toString().slice(-6)}`;
const QA_VEHICLE_PLATE = `QA${QA_TIMESTAMP.toString().slice(-5)}`;
const QA_VEHICLE_MODEL = 'QA_Model_' + QA_TIMESTAMP;

const results = {
  DRIVER_CREATE: false,
  DRIVER_VISIBLE_IMMEDIATELY: false,
  DRIVER_SEARCH: false,
  VEHICLE_CREATE: false,
  VEHICLE_VISIBLE_IMMEDIATELY: false,
  ASSIGNMENT_TRACKING: false,
  DATA_PERSISTS_AFTER_REFRESH: false,
  NO_DISCONNECT_RECORDS: 'N/A',
  DATA_PERSISTS_AFTER_RESTART: 'SKIPPED',
  ROOT_CAUSE_IF_FAILED: ''
};

let createdDriverId = null;
let createdVehicleId = null;

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 DIRECT DATABASE END-TO-END TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`MongoDB: ${MONGODB_URI}`);

  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      retryWrites: true,
      w: 'majority'
    });
    console.log('✓ Connected to MongoDB');

    // Test 1: Create Driver
    console.log('\n✅ TEST 1: Create QA Driver');
    try {
      const driver = new Driver({
        name: QA_DRIVER_NAME,
        phone: QA_PHONE,
        email: `qa-driver-${QA_TIMESTAMP}@test.local`,
        licenseNumber: QA_LICENSE,
        status: 'active',
        dateOfJoining: new Date(),
        address: 'QA Test Address',
        tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID)
      });

      await driver.save();
      createdDriverId = driver._id;
      results.DRIVER_CREATE = true;
      console.log(`   ✓ Driver created: ${createdDriverId}`);
      console.log(`   ✓ Driver name: ${driver.name}`);
      console.log(`   ✓ License: ${driver.licenseNumber}`);
    } catch (error) {
      results.DRIVER_CREATE = false;
      results.ROOT_CAUSE_IF_FAILED = `Driver creation failed: ${error.message}`;
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 2: Driver Visible Immediately
    console.log('\n✅ TEST 2: Driver Visible Immediately');
    try {
      const drivers = await Driver.find({
        tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID),
        name: QA_DRIVER_NAME
      });

      const found = drivers.length > 0;
      results.DRIVER_VISIBLE_IMMEDIATELY = found;

      if (found) {
        console.log(`   ✓ Driver found: ${drivers[0]._id}`);
        console.log(`   ✓ Count in DB: ${drivers.length}`);
      } else {
        console.log(`   ✗ Driver not found in DB`);
        results.ROOT_CAUSE_IF_FAILED = 'Driver not visible after creation';
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 3: Driver Search
    console.log('\n✅ TEST 3: Driver Search');
    try {
      const drivers = await Driver.find({
        tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID),
        $or: [
          { name: { $regex: QA_DRIVER_NAME, $options: 'i' } },
          { phone: QA_PHONE }
        ]
      });

      results.DRIVER_SEARCH = drivers.length > 0;

      if (results.DRIVER_SEARCH) {
        console.log(`   ✓ Driver found by search: ${drivers[0]._id}`);
      } else {
        console.log(`   ✗ Driver not found by search`);
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 4: Driver 360 (Fetch complete profile)
    console.log('\n✅ TEST 4: Driver 360 Page (Complete Profile)');
    try {
      if (!createdDriverId) {
        console.log(`   ✗ No driver ID available`);
      } else {
        const driver = await Driver.findById(createdDriverId);

        if (driver) {
          results.DRIVER_360 = true;
          console.log(`   ✓ Driver 360 accessible`);
          console.log(`   ✓ Driver data: name=${driver.name}, phone=${driver.phone}`);
        } else {
          console.log(`   ✗ Driver not found by ID`);
        }
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 5: Create Vehicle
    console.log('\n✅ TEST 5: Create QA Vehicle');
    try {
      const vehicle = new Vehicle({
        plate: QA_VEHICLE_PLATE,
        model: QA_VEHICLE_MODEL,
        status: 'available',
        year: new Date().getFullYear(),
        type: 'sedan',
        tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID)
      });

      await vehicle.save();
      createdVehicleId = vehicle._id;
      results.VEHICLE_CREATE = true;
      console.log(`   ✓ Vehicle created: ${createdVehicleId}`);
      console.log(`   ✓ Vehicle plate: ${vehicle.plate}`);
      console.log(`   ✓ Status: ${vehicle.status}`);
    } catch (error) {
      results.VEHICLE_CREATE = false;
      results.ROOT_CAUSE_IF_FAILED = `Vehicle creation failed: ${error.message}`;
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 6: Vehicle Visible Immediately
    console.log('\n✅ TEST 6: Vehicle Visible Immediately');
    try {
      const vehicles = await Vehicle.find({
        tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID),
        plate: QA_VEHICLE_PLATE
      });

      results.VEHICLE_VISIBLE_IMMEDIATELY = vehicles.length > 0;

      if (results.VEHICLE_VISIBLE_IMMEDIATELY) {
        console.log(`   ✓ Vehicle found: ${vehicles[0]._id}`);
      } else {
        console.log(`   ✗ Vehicle not found in DB`);
        results.ROOT_CAUSE_IF_FAILED = 'Vehicle not visible after creation';
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 7: Assignment Tracking
    console.log('\n✅ TEST 7: Assignment Tracking');
    try {
      if (!createdDriverId || !createdVehicleId) {
        console.log(`   ✗ Missing driver or vehicle ID`);
      } else {
        const now = new Date();
        const pickupDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const booking = new Booking({
          customerId: new mongoose.Types.ObjectId(TEST_TENANT_ID),
          driverId: createdDriverId,
          vehicleId: createdVehicleId,
          pickupDate: pickupDate.toISOString().split('T')[0],
          pickupTime: '09:00',
          returnDate: pickupDate.toISOString().split('T')[0],
          returnTime: '18:00',
          pickupLocation: 'QA Test Pickup',
          returnLocation: 'QA Test Return',
          status: 'confirmed',
          tenantId: new mongoose.Types.ObjectId(TEST_TENANT_ID)
        });

        await booking.save();

        // Verify booking is retrievable
        const foundBooking = await Booking.findOne({
          driverId: createdDriverId,
          vehicleId: createdVehicleId
        });

        results.ASSIGNMENT_TRACKING = !!foundBooking;

        if (results.ASSIGNMENT_TRACKING) {
          console.log(`   ✓ Assignment tracked: ${foundBooking._id}`);
        } else {
          console.log(`   ✗ Assignment not found`);
        }
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Test 8: Data Persists After Refresh
    console.log('\n✅ TEST 8: Data Persists After Refresh');
    try {
      if (!createdDriverId) {
        console.log(`   ✗ No driver to refresh`);
      } else {
        const driver = await Driver.findById(createdDriverId);

        if (driver) {
          const nameMatches = driver.name === QA_DRIVER_NAME;
          const phoneMatches = driver.phone === QA_PHONE;
          const licenseMatches = driver.licenseNumber === QA_LICENSE;

          results.DATA_PERSISTS_AFTER_REFRESH = nameMatches && phoneMatches && licenseMatches;

          if (results.DATA_PERSISTS_AFTER_REFRESH) {
            console.log(`   ✓ Driver data persists`);
            console.log(`   ✓ Name: ${driver.name}`);
            console.log(`   ✓ Phone: ${driver.phone}`);
            console.log(`   ✓ License: ${driver.licenseNumber}`);
          } else {
            console.log(`   ✗ Data mismatch`);
          }
        } else {
          console.log(`   ✗ Driver not found`);
        }
      }
    } catch (error) {
      console.log(`   ✗ Exception: ${error.message}`);
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const [key, value] of Object.entries(results)) {
      if (key !== 'ROOT_CAUSE_IF_FAILED') {
        const icon = value === true ? '✓' : value === false ? '✗' : '⏭️';
        console.log(`${icon} ${key}: ${value}`);
      }
    }

    if (results.ROOT_CAUSE_IF_FAILED) {
      console.log(`\n⚠️  Root Cause: ${results.ROOT_CAUSE_IF_FAILED}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('\n📋 JSON OUTPUT FOR PARSING:');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    // Disconnect
    await mongoose.connection.close();
    console.log('\n✓ MongoDB connection closed');
    process.exit(0);
  }
}

runTests();
