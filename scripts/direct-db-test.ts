#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function test() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  console.log('\nTesting direct database access...');
  console.log('Database URI:', uri);

  await mongoose.connect(uri);

  const db = mongoose.connection.db!;
  const user = await db.collection('users').findOne({ userId: 'shyam_admin' });

  console.log('\n=== USER FOUND ===');
  if (user) {
    console.log('✓ userId:', user.userId);
    console.log('✓ _id:', user._id);
    console.log('✓ role:', user.role);
    console.log('✓ isActive:', user.isActive);
    console.log('✓ password (hash):', user.password?.substring(0, 20) + '...');
    console.log('✓ tenantId:', user.tenantId);

    console.log('\n=== PASSWORD TEST ===');
    const testPassword = 'ShyamAdmin123!';
    const matches = await bcrypt.compare(testPassword, user.password);
    console.log(`Testing password "${testPassword}"`);
    console.log(`bcrypt.compare result: ${matches ? '✓ MATCH' : '✗ NO MATCH'}`);

    if (!matches) {
      console.log('\n🔴 CRITICAL: Password does not match!');
      console.log('This is why login fails.');
    }
  } else {
    console.log('✗ User NOT FOUND');
  }

  await mongoose.disconnect();
  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
