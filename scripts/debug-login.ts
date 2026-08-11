#!/usr/bin/env ts-node
/**
 * Debug login issue - check what's in the database
 */

import mongoose from 'mongoose';
import { User, Tenant } from '../server/models';
import bcrypt from 'bcrypt';

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Check all users named shyam_admin
    console.log('🔍 Searching for shyam_admin users...');
    const users = await User.find({ userId: { $regex: 'shyam', $options: 'i' } }).populate('tenantId');
    console.log(`Found ${users.length} users matching "shyam":\n`);

    users.forEach(u => {
      console.log(`  userId: ${u.userId}`);
      console.log(`  name: ${u.name}`);
      console.log(`  role: ${u.role}`);
      console.log(`  isActive: ${u.isActive}`);
      console.log(`  tenantId: ${u.tenantId}`);
      console.log(`  password hash length: ${u.password?.length}`);
      console.log('');
    });

    // Try to find by exact lowercase
    console.log('🔍 Looking for exact match: shyam_admin (lowercase)\n');
    const exactUser = await User.findOne({ userId: 'shyam_admin' }).populate('tenantId');
    if (exactUser) {
      console.log('Found user:');
      console.log(`  userId: ${exactUser.userId}`);
      console.log(`  password hash: ${exactUser.password}`);
      console.log('');

      // Test password comparison
      const testPassword = 'ShyamAdmin123!';
      console.log(`Testing password comparison with: ${testPassword}`);
      const matches = await bcrypt.compare(testPassword, exactUser.password);
      console.log(`  Result: ${matches ? '✅ MATCH' : '❌ NO MATCH'}\n`);
    } else {
      console.log('❌ No user found with userId: shyam_admin\n');
    }

    // List all users in database
    console.log('📋 All users in database:');
    const allUsers = await User.find({});
    allUsers.forEach(u => {
      console.log(`  - ${u.userId} (${u.role})`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Error:', error);
    process.exit(1);
  }
}

main();
