#!/usr/bin/env ts-node
/**
 * Create admin user for Shyam tenant QA testing
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
    console.log('🔍 Finding Shyam tenant...');
    let tenant = await Tenant.findOne({ name: /shyam/i });
    if (!tenant) {
      console.log('❌ Shyam tenant not found');
      process.exit(1);
    }
    console.log(`✅ Found Shyam tenant: ${tenant._id}\n`);

    // Delete any existing admin user (to recreate with proper bcrypt hashing)
    await User.deleteOne({
      userId: 'shyam_admin',
      tenantId: tenant._id,
    });

    // Create new admin user with bcrypt hashing
    const password = 'ShyamAdmin123!'; // Simple test password
    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      userId: 'shyam_admin',
      name: 'Shyam Admin',
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant._id,
      isActive: true,
    });

    console.log('✅ Created admin user:');
    console.log(`   userId: shyam_admin`);
    console.log(`   password: ${password}`);
    console.log(`   tenantId: ${tenant._id}\n`);

    console.log('='.repeat(70));
    console.log('LOGIN CREDENTIALS:');
    console.log('='.repeat(70));
    console.log('URL:      https://192.168.29.142:5050/dashboard/dashboard');
    console.log('User ID:  shyam_admin');
    console.log('Password: ShyamAdmin123!');
    console.log('Tenant:   Shyam');
    console.log('='.repeat(70));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Failed:', error);
    process.exit(1);
  }
}

main();
