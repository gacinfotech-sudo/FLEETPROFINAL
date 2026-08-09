/**
 * P0 AUTH FIX: Reset tenant passwords affected by sanitizer
 *
 * ROOT CAUSE: The global input sanitizer was stripping special characters
 * from passwords (+, &, (, ), etc.) causing passwords to be hashed
 * differently than what users entered. Login failed with "Invalid credentials".
 *
 * SCOPE: All tenant/client users created before the sanitizer exemption was added
 *
 * ACTION: Reset passwords to a temporary value, force users to change on next login
 */

import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';

async function fixTenantPasswords() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');

    console.log('='.repeat(70));
    console.log('P0 AUTH FIX: Resetting tenant passwords affected by sanitizer');
    console.log('='.repeat(70));

    // Find all tenant/client users
    const tenantUsers = await usersCollection.find({ role: 'client' }).toArray();
    console.log(`\nFound ${tenantUsers.length} tenant/client users`);

    let resetCount = 0;
    let errorCount = 0;

    // Temporary password for all affected users (they'll be forced to change)
    const tempPassword = `TempReset_${Date.now()}`;
    const hashedTempPassword = await bcrypt.hash(tempPassword, 12);

    console.log('\nResetting passwords...');
    console.log('Temporary password: ' + tempPassword);
    console.log('Users will be forced to change on next login\n');

    for (const user of tenantUsers) {
      try {
        // Update password and force password reset
        await usersCollection.updateOne(
          { _id: user._id },
          {
            $set: {
              password: hashedTempPassword,
              mustResetPassword: true,
              lastPasswordReset: new Date().toISOString(),
              passwordResetReason: 'Security fix: special characters in password'
            }
          }
        );

        console.log(`✅ Reset: ${user.userId}`);
        resetCount++;

      } catch (error) {
        console.log(`❌ Error resetting ${user.userId}:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`RESULTS:`);
    console.log(`  ✅ Passwords reset: ${resetCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(70));

    if (resetCount > 0) {
      console.log(`\n📋 NEXT STEPS:`);
      console.log(`1. Users will see "Password Reset Required" on next login`);
      console.log(`2. Provide temporary password: ${tempPassword}`);
      console.log(`3. Users MUST change password to a new strong password`);
      console.log(`4. Passwords can now contain: & + ( ) and all other special characters`);
    }

  } finally {
    await client.close();
  }
}

fixTenantPasswords().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
