/**
 * FleetPro Vehicle & HR Field Enhancement
 *
 * Fills Vehicle and Driver records with realistic 5-7 option selections
 * for comprehensive testing of HR and Fleet Management features.
 *
 * Execution: npx tsx scripts/enhance-vehicle-hr-fields.ts
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';

// Vehicle/HR Options (5-7 each)
const DRIVER_LIFECYCLE_STAGES = ['approved', 'active', 'on_leave', 'suspended', 'offboarding'];
const DRIVER_MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const DRIVER_LANGUAGE_OPTIONS = [
  ['Hindi', 'English'],
  ['Hindi', 'English', 'Marathi'],
  ['Hindi', 'English', 'Gujarati'],
  ['Hindi', 'Marathi'],
  ['English', 'Hindi', 'Punjabi'],
  ['Hindi'],
  ['English', 'Hindi', 'Kannada']
];

const VEHICLE_CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'MUV', 'MPV', 'Coupe', 'Convertible'];
const VEHICLE_COLORS = ['White', 'Black', 'Silver', 'Blue', 'Red', 'Gray', 'Gold'];
const VEHICLE_FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Hybrid'];
const VEHICLE_TRANSMISSIONS = ['Manual', 'Automatic', 'CVT'];
const VEHICLE_TRANSPORT_CLASSIFICATIONS = ['transport', 'non_transport'];
const VEHICLE_OWNERSHIP_TYPES = ['owned', 'leased', 'financed', 'rented'];

async function enhanceTenant(tenantId: string, tenantName: string) {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`ENHANCING: ${tenantName.toUpperCase()}`);
    console.log(`${'='.repeat(70)}`);

    // Enhance Drivers with HR Fields
    await enhanceDrivers(db, tenantId, tenantName);

    // Enhance Vehicles with detailed options
    await enhanceVehicles(db, tenantId, tenantName);

    console.log(`✅ Enhancement complete for ${tenantName}`);

  } finally {
    await client.close();
  }
}

async function enhanceDrivers(db: any, tenantId: string, tenantName: string) {
  console.log('\n[Enhancing Drivers]');

  const drivers = await db.collection('drivers').find({ tenantId: new ObjectId(tenantId) }).toArray();

  let updatedCount = 0;

  for (const driver of drivers) {
    const update = {
      $set: {
        // Lifecycle & Status Variety
        lifecycleStage: DRIVER_LIFECYCLE_STAGES[Math.floor(Math.random() * DRIVER_LIFECYCLE_STAGES.length)],

        // HR Personal Fields (5-7 variations)
        maritalStatus: DRIVER_MARITAL_STATUSES[Math.floor(Math.random() * DRIVER_MARITAL_STATUSES.length)],
        permanentAddress: `Permanent Address, ${tenantName.toUpperCase()}, Indore - 452001`,
        currentAddress: `Current Address, ${tenantName.toUpperCase()}, Indore - 452001`,
        aadharNumber: `${String(Math.floor(Math.random() * 1000000000000)).padStart(12, '0')}`,
        panNumber: `${tenantName.toUpperCase()}${String(driver._id).substring(0, 6).toUpperCase()}`,
        dateOfJoining: driver.dateOfJoining || new Date(2020 + Math.random() * 4, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),

        // Languages (5-7 options)
        languages: DRIVER_LANGUAGE_OPTIONS[Math.floor(Math.random() * DRIVER_LANGUAGE_OPTIONS.length)]
      }
    };

    await db.collection('drivers').updateOne({ _id: driver._id }, update);
    updatedCount++;
  }

  console.log(`  ✓ Enhanced ${updatedCount} drivers with HR fields`);
  console.log(`    - Lifecycle Stages: 5 variations`);
  console.log(`    - Marital Status: 4 variations`);
  console.log(`    - Languages: 7 language combinations`);
}

async function enhanceVehicles(db: any, tenantId: string, tenantName: string) {
  console.log('\n[Enhancing Vehicles]');

  const vehicles = await db.collection('vehicles').find({ tenantId: new ObjectId(tenantId) }).toArray();

  let updatedCount = 0;

  for (const vehicle of vehicles) {
    const idx = Math.random();

    const update = {
      $set: {
        // Physical Attributes (5-7 options each)
        vehicleCategory: VEHICLE_CATEGORIES[Math.floor(Math.random() * VEHICLE_CATEGORIES.length)],
        color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
        fuelType: VEHICLE_FUEL_TYPES[Math.floor(Math.random() * VEHICLE_FUEL_TYPES.length)],
        transmission: VEHICLE_TRANSMISSIONS[Math.floor(Math.random() * VEHICLE_TRANSMISSIONS.length)],

        // Technical Details
        variant: `Variant ${Math.floor(Math.random() * 5) + 1}`,
        registrationDate: new Date(2020 + Math.floor(idx * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        vin: `VIN${tenantName.toUpperCase()}${String(Math.random() * 1000000000).padStart(10, '0')}`,
        chassisNumber: `CH${String(Math.random() * 1000000000000).padStart(12, '0')}`,
        engineNumber: `ENG${String(Math.random() * 10000000000).padStart(10, '0')}`,
        engineHours: Math.floor(Math.random() * 5000),

        // Fleet Management
        transportClassification: VEHICLE_TRANSPORT_CLASSIFICATIONS[Math.floor(Math.random() * VEHICLE_TRANSPORT_CLASSIFICATIONS.length)],
        ownershipType: VEHICLE_OWNERSHIP_TYPES[Math.floor(Math.random() * VEHICLE_OWNERSHIP_TYPES.length)],
        acquisitionDate: new Date(2020 + Math.floor(idx * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        purchaseValue: 800000 + Math.random() * 2000000,
        branch: `Branch-${Math.floor(Math.random() * 5) + 1}`,
        baseLocation: `Location-${tenantName.toUpperCase()}-${Math.floor(Math.random() * 4) + 1}`
      }
    };

    await db.collection('vehicles').updateOne({ _id: vehicle._id }, update);
    updatedCount++;
  }

  console.log(`  ✓ Enhanced ${updatedCount} vehicles with 5-7 field options`);
  console.log(`    - Vehicle Categories: 7 variations`);
  console.log(`    - Colors: 7 variations`);
  console.log(`    - Fuel Types: 4 variations`);
  console.log(`    - Transmissions: 3 variations`);
  console.log(`    - Ownership Types: 4 variations`);
  console.log(`    - Transport Classifications: 2 variations`);
  console.log(`    - Technical Details: Unique VIN, Chassis, Engine numbers`);
}

// MAIN
async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('VEHICLE & HR FIELD ENHANCEMENT');
  console.log('Adds 5-7 realistic options to existing Driver and Vehicle records');
  console.log('='.repeat(70));

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // Find RAM and SHYAM tenants
    const ramTenant = await db.collection('tenants').findOne({ name: 'ram' });
    const shyamTenant = await db.collection('tenants').findOne({ name: { $regex: '^Shyam', $options: 'i' } });

    if (!ramTenant) {
      console.log('❌ RAM tenant not found');
      return;
    }

    await enhanceTenant(ramTenant._id.toString(), 'ram');

    if (shyamTenant) {
      await enhanceTenant(shyamTenant._id.toString(), 'shyam');
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ ENHANCEMENT COMPLETE');
    console.log('='.repeat(70));

    console.log(`\nVEHICLE/HR FIELD OPTIONS ADDED:`);
    console.log(`\nDRIVER HR FIELDS:`);
    console.log(`  • Lifecycle Stages: 5 options`);
    console.log(`  • Marital Status: 4 options`);
    console.log(`  • Languages: 7 combinations`);
    console.log(`  • Aadhar & PAN numbers`);
    console.log(`  • Joining dates`);

    console.log(`\nVEHICLE DETAILS:`);
    console.log(`  • Categories: 7 options`);
    console.log(`  • Colors: 7 options`);
    console.log(`  • Fuel Types: 4 options`);
    console.log(`  • Transmissions: 3 options`);
    console.log(`  • Ownership: 4 options`);
    console.log(`  • VIN, Chassis, Engine numbers (unique)`);
    console.log(`  • Transport Classification: 2 options`);
    console.log(`  • Branch & Base Location assignments`);

  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error('❌ Enhancement failed:', error);
  process.exit(1);
});
