#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import { Tenant } from '../server/models';

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  await mongoose.connect(uri);

  console.log('\n=== CHECKING EXISTING TENANTS ===\n');

  const ram = await Tenant.findOne({ name: /^ram$/i });
  const shyam = await Tenant.findOne({ name: /^shyam$/i });

  console.log('RAM:');
  if (ram) {
    console.log(`  ✓ EXISTS: ${ram._id}`);
    console.log(`  name: ${ram.name}`);
    console.log(`  isActive: ${ram.isActive}`);
  } else {
    console.log(`  ✗ NOT FOUND`);
  }

  console.log('\nSHYAM:');
  if (shyam) {
    console.log(`  ✓ EXISTS: ${shyam._id}`);
    console.log(`  name: ${shyam.name}`);
    console.log(`  isActive: ${shyam.isActive}`);
  } else {
    console.log(`  ✗ NOT FOUND`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
