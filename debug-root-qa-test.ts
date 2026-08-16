#!/usr/bin/env ts-node
/**
 * Debug root_qa_test login issue
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB Connected\n');

    // Access raw MongoDB driver to check the actual fields
    const db = mongoose.connection.getClient().db('fleetpro');
    const collection = db.collection('users');

    // Find root_qa_test
    console.log('🔍 Searching for root_qa_test in database...');
    const user = await collection.findOne({
      userId: { $regex: 'root_qa_test', $options: 'i' }
    });

    if (!user) {
      console.log('❌ NO USER FOUND matching "root_qa_test"\n');

      // List all users
      console.log('📋 All users in database:');
      const allUsers = await collection.find({}).toArray();
      allUsers.forEach((u: any) => {
        console.log(`  - userId: ${u.userId}`);
        console.log(`    role: ${u.role}`);
        console.log(`    isActive: ${u.isActive}`);
        console.log(`    password field exists: ${!!u.password}`);
        console.log(`    passwordHash field exists: ${!!u.passwordHash}`);
        console.log(`    password length: ${u.password ? u.password.length : 'N/A'}`);
        console.log(`    passwordHash length: ${u.passwordHash ? u.passwordHash.length : 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('✅ Found user!\n');
      console.log('User document:');
      console.log(`  _id: ${user._id}`);
      console.log(`  userId: ${user.userId}`);
      console.log(`  name: ${user.name}`);
      console.log(`  role: ${user.role}`);
      console.log(`  isActive: ${user.isActive}`);
      console.log(`  password field: ${user.password ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`  passwordHash field: ${user.passwordHash ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log('');

      // Check which field has the hash
      const hashField = user.password || user.passwordHash;
      if (hashField) {
        console.log(`Using field: ${user.password ? 'password' : 'passwordHash'}`);
        console.log(`Hash: ${hashField.substring(0, 20)}...`);
        console.log(`Hash length: ${hashField.length}`);
        console.log('');

        // Test password comparison
        const testPassword = 'password';
        console.log(`Testing bcrypt.compare("${testPassword}", hash)...`);
        const matches = await bcrypt.compare(testPassword, hashField);
        console.log(`Result: ${matches ? '✅ MATCH' : '❌ NO MATCH'}\n`);

        // Also test the hash that was mentioned in the task
        const providedHash = '$2b$12$4Gns2CgcgZPvH.p6LBGnyerlkFNEqeT7heT9Q0omf1.icP4w5u48q';
        console.log(`Testing if provided hash matches stored hash...`);
        console.log(`Provided: ${providedHash}`);
        console.log(`Stored:   ${hashField}`);
        console.log(`Match: ${providedHash === hashField ? '✅ IDENTICAL' : '❌ DIFFERENT'}`);
      }
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('🔴 Error:', error);
    process.exit(1);
  }
}

main();
