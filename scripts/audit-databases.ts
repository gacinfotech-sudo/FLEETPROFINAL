#!/usr/bin/env ts-node
import mongoose from 'mongoose';

async function audit() {
  console.log('\n=== AUDIT: DATABASE MISMATCH ===\n');
  console.log('Configured (.env):', process.env.MONGODB_URI);
  console.log('Default (fallback):', 'mongodb://127.0.0.1:27017/fleetpro\n');

  // Check both databases
  const e2eUri = 'mongodb://127.0.0.1:27017/fleetpro-e2e-tests';
  const mainUri = 'mongodb://127.0.0.1:27017/fleetpro';

  // Connect to fleetpro-e2e-tests (what .env says)
  console.log('Connecting to fleetpro-e2e-tests...');
  await mongoose.connect(e2eUri);
  const e2eDb = mongoose.connection.db;
  const e2eUsers = await e2eDb!.collection('users').countDocuments();
  const e2eShyam = await e2eDb!.collection('users').findOne({ userId: 'shyam_admin' });
  const e2eTestadmin = await e2eDb!.collection('users').findOne({ userId: 'testadmin' });

  console.log(`  Users count: ${e2eUsers}`);
  console.log(`  shyam_admin: ${e2eShyam ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  testadmin: ${e2eTestadmin ? 'FOUND' : 'NOT FOUND'}\n`);

  await mongoose.disconnect();

  // Connect to fleetpro (where we seeded)
  console.log('Connecting to fleetpro...');
  await mongoose.connect(mainUri);
  const mainDb = mongoose.connection.db;
  const mainUsers = await mainDb!.collection('users').countDocuments();
  const mainShyam = await mainDb!.collection('users').findOne({ userId: 'shyam_admin' });
  const mainTestadmin = await mainDb!.collection('users').findOne({ userId: 'testadmin' });

  console.log(`  Users count: ${mainUsers}`);
  console.log(`  shyam_admin: ${mainShyam ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`  testadmin: ${mainTestadmin ? 'FOUND' : 'NOT FOUND'}\n`);

  console.log('=== DIAGNOSIS ===\n');

  if (e2eShyam) {
    console.log('✓ shyam_admin EXISTS in fleetpro-e2e-tests (configured DB)');
  } else if (mainShyam) {
    console.log('✗ shyam_admin ONLY in fleetpro (wrong DB) - CREATED IN WRONG DATABASE');
  } else {
    console.log('✗ shyam_admin NOT FOUND in either database');
  }

  await mongoose.disconnect();
  process.exit(0);
}

audit().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
