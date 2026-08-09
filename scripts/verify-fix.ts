#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import { User, Tenant } from '../server/models';
import bcrypt from 'bcrypt';

async function verify() {
  console.log('\n=== VERIFY FIX ===\n');

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  console.log('Connecting to:', uri);

  await mongoose.connect(uri);

  // 1. Find Shyam tenant
  console.log('\n✓ Step 1: Shyam Tenant');
  const shyamTenant = await Tenant.findOne({ name: 'Shyam' });
  if (shyamTenant) {
    console.log(`  ✓ Found: ${shyamTenant._id}`);
  } else {
    console.log('  ✗ NOT FOUND');
  }

  // 2. Find shyam_admin user
  console.log('\n✓ Step 2: shyam_admin User');
  const user = await User.findOne({ userId: 'shyam_admin' });
  if (user) {
    console.log(`  ✓ Found: ${user._id}`);
    console.log(`  ✓ Active: ${user.isActive}`);
    console.log(`  ✓ Role: ${user.role}`);
    console.log(`  ✓ Password hash exists: ${user.password ? 'YES' : 'NO'}`);
  } else {
    console.log('  ✗ NOT FOUND');
  }

  // 3. Test password comparison
  console.log('\n✓ Step 3: Password Verification');
  if (user) {
    const testPassword = 'ShyamAdmin123!';
    const matches = await bcrypt.compare(testPassword, user.password);
    console.log(`  ✓ Password "ShyamAdmin123!" matches: ${matches ? 'YES ✓' : 'NO ✗'}`);
  }

  // 4. Count seed data
  console.log('\n✓ Step 4: Seed Data Present');
  if (shyamTenant) {
    const customers = await User.collection.db.collection('customers')
      .countDocuments({ tenantId: shyamTenant._id });
    const drivers = await User.collection.db.collection('drivers')
      .countDocuments({ tenantId: shyamTenant._id });
    const bookings = await User.collection.db.collection('bookings')
      .countDocuments({ tenantId: shyamTenant._id });

    console.log(`  ✓ Customers: ${customers}`);
    console.log(`  ✓ Drivers: ${drivers}`);
    console.log(`  ✓ Bookings: ${bookings}`);
  }

  console.log('\n=== FIX VERIFICATION COMPLETE ===\n');

  await mongoose.disconnect();
  process.exit(0);
}

verify().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
