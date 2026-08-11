#!/usr/bin/env ts-node
/**
 * Fix Shyam admin login - ensure proper bcrypt hashing and lowercase userId
 */

import mongoose from 'mongoose';
import { Tenant, User } from '../server/models';
import bcrypt from 'bcrypt';

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Find Shyam tenant
    const tenant = await Tenant.findOne({ name: /shyam/i });
    if (!tenant) {
      console.log('❌ Shyam tenant not found');
      process.exit(1);
    }

    const password = 'ShyamAdmin123!';
    const userId = 'shyam_admin'; // Will be stored as lowercase

    // Delete any existing user with this ID
    await User.deleteOne({ userId: userId.toLowerCase(), tenantId: tenant._id });
    console.log('🗑️  Deleted old user if existed\n');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('🔐 Password hashed with bcrypt (12 rounds)\n');

    // Create new user with all fields properly set
    const user = await User.create({
      userId: userId.toLowerCase(), // Explicitly lowercase
      name: 'Shyam Admin',
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant._id,
      isActive: true,
    });

    console.log('✅ User created successfully\n');

    // Verify the password can be compared correctly
    const testCompare = await bcrypt.compare(password, hashedPassword);
    console.log(`✓ Password verification test: ${testCompare ? 'PASS' : 'FAIL'}\n`);

    // Verify user exists and can be retrieved
    const verifyUser = await User.findOne({ userId: userId.toLowerCase() });
    console.log(`✓ User retrieval test: ${verifyUser ? 'PASS' : 'FAIL'}\n`);

    console.log('='.repeat(70));
    console.log('✅ LOGIN CREDENTIALS (NOW FIXED):');
    console.log('='.repeat(70));
    console.log('URL:      https://192.168.29.142:5050/login');
    console.log('User ID:  shyam_admin');
    console.log('Password: ShyamAdmin123!');
    console.log('='.repeat(70));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Error:', error);
    process.exit(1);
  }
}

main();
