#!/usr/bin/env ts-node
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
  await mongoose.connect(uri);

  const db = mongoose.connection.db!;

  console.log('\n=== CHECKING CREATED USERS ===\n');

  const users = await db.collection('users').find({
    userId: { $in: ['ram.qa', 'shyam.qa', 'shyam_admin'] }
  }).toArray();

  for (const user of users) {
    console.log(`\nUserId: ${user.userId}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  isActive: ${user.isActive}`);
    console.log(`  Password hash: ${user.password?.substring(0, 20)}...`);

    // Test passwords
    if (user.userId === 'ram.qa') {
      const match = await bcrypt.compare('Ram@Fleet2026#QA', user.password);
      console.log(`  Password test: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    } else if (user.userId === 'shyam.qa') {
      const match = await bcrypt.compare('Shyam@Fleet2026#QA', user.password);
      console.log(`  Password test: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    } else if (user.userId === 'shyam_admin') {
      const match = await bcrypt.compare('ShyamAdmin123!', user.password);
      console.log(`  Password test: ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
