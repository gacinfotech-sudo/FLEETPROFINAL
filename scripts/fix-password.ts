#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function fix() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  await mongoose.connect(uri);

  console.log('\n=== FIXING PASSWORD HASH ===\n');

  const db = mongoose.connection.db!;
  const password = 'ShyamAdmin123!';

  // Hash with 12 rounds (matching server standard)
  console.log('Creating new bcrypt hash...');
  const newHash = await bcrypt.hash(password, 12);
  console.log('✓ New hash created');

  // Verify it works
  const testMatch = await bcrypt.compare(password, newHash);
  console.log(`✓ Verification test: ${testMatch ? 'PASS' : 'FAIL'}`);

  // Update in database
  console.log('\nUpdating database...');
  const result = await db.collection('users').updateOne(
    { userId: 'shyam_admin' },
    { $set: { password: newHash } }
  );

  console.log(`✓ Updated ${result.modifiedCount} document(s)`);

  // Verify update
  console.log('\nVerifying update...');
  const updated = await db.collection('users').findOne({ userId: 'shyam_admin' });
  const finalMatch = await bcrypt.compare(password, updated!.password);

  console.log(`✓ Final verification: ${finalMatch ? '✓✓ SUCCESS' : '✗ FAILED'}`);

  console.log('\n=== LOGIN CREDENTIALS NOW FIXED ===');
  console.log('User ID: shyam_admin');
  console.log('Password: ShyamAdmin123!');
  console.log('\n✓ Try login now!\n');

  await mongoose.disconnect();
  process.exit(0);
}

fix().catch(e => {
  console.error(e);
  process.exit(1);
});
