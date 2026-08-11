#!/usr/bin/env ts-node
import mongoose from 'mongoose';

async function audit() {
  const mainUri = 'mongodb://127.0.0.1:27017/fleetpro';
  const e2eUri = 'mongodb://127.0.0.1:27017/fleetpro-e2e-tests';

  console.log('\n=== AUDIT: SEED DATA LOCATION ===\n');

  // Check fleetpro database
  console.log('📊 Database: fleetpro (where we seeded)\n');
  await mongoose.connect(mainUri);
  const mainDb = mongoose.connection.db!;

  const shyamTenant = await mainDb.collection('tenants').findOne({ name: 'Shyam' });
  console.log(`Shyam Tenant: ${shyamTenant ? 'FOUND' : 'NOT FOUND'}`);

  if (shyamTenant) {
    const tenantId = shyamTenant._id;
    const customers = await mainDb.collection('customers').countDocuments({ tenantId });
    const drivers = await mainDb.collection('drivers').countDocuments({ tenantId });
    const vehicles = await mainDb.collection('vehicles').countDocuments({ tenantId });
    const bookings = await mainDb.collection('bookings').countDocuments({ tenantId });

    console.log(`  → Customers: ${customers}`);
    console.log(`  → Drivers: ${drivers}`);
    console.log(`  → Vehicles: ${vehicles}`);
    console.log(`  → Bookings: ${bookings}`);
  }

  await mongoose.disconnect();

  // Check fleetpro-e2e-tests database
  console.log('\n📊 Database: fleetpro-e2e-tests (configured in .env)\n');
  await mongoose.connect(e2eUri);
  const e2eDb = mongoose.connection.db!;

  const e2eShyamTenant = await e2eDb.collection('tenants').findOne({ name: 'Shyam' });
  console.log(`Shyam Tenant: ${e2eShyamTenant ? 'FOUND' : 'NOT FOUND'}`);

  if (e2eShyamTenant) {
    const tenantId = e2eShyamTenant._id;
    const customers = await e2eDb.collection('customers').countDocuments({ tenantId });
    const drivers = await e2eDb.collection('drivers').countDocuments({ tenantId });
    const vehicles = await e2eDb.collection('vehicles').countDocuments({ tenantId });
    const bookings = await e2eDb.collection('bookings').countDocuments({ tenantId });

    console.log(`  → Customers: ${customers}`);
    console.log(`  → Drivers: ${drivers}`);
    console.log(`  → Vehicles: ${vehicles}`);
    console.log(`  → Bookings: ${bookings}`);
  }

  console.log('\n=== RECOMMENDATION ===\n');
  console.log('FIX: Migrate all Shyam seed data from "fleetpro" to "fleetpro-e2e-tests"');
  console.log('     OR update .env MONGODB_URI to point to "fleetpro"\n');

  await mongoose.disconnect();
  process.exit(0);
}

audit().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
