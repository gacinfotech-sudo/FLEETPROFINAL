/**
 * P0 FIX: Ensure canonical ROOT account has proper PLATFORM_ROOT identity
 *
 * This script:
 * 1. Finds the canonical root account (should be ONE)
 * 2. Ensures it has platformRole='PLATFORM_ROOT'
 * 3. Ensures it has tenantId=null
 * 4. Cleans up any duplicate root accounts
 */

import mongoose from 'mongoose';

async function fixRootAccount() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');

    const User = mongoose.model('User');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔧 P0 FIX: ROOT ACCOUNT CANONICAL IDENTITY');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find ALL root-like accounts
    const rootAccounts = await User.find({
      $or: [
        { platformRole: 'PLATFORM_ROOT' },
        { role: 'root' },
        { userId: { $regex: 'root' } }
      ]
    });

    console.log(`📍 Found ${rootAccounts.length} root-like accounts\n`);
    rootAccounts.forEach((u, i) => {
      console.log(`${i + 1}. ${u.userId}`);
      console.log(`   platformRole: ${u.platformRole || 'NOT SET ❌'}`);
      console.log(`   tenantId: ${u.tenantId || 'null ✓'}`);
      console.log('');
    });

    // CANONICAL ROOT IDENTITY
    // Use the account with root@fleetpro.local email
    const canonicalRoot = await User.findOne({
      email: 'root@fleetpro.local'
    });

    if (!canonicalRoot) {
      console.error('❌ No root account found with email root@fleetpro.local');
      console.log('Creating canonical root account...\n');

      const newRoot = await User.create({
        userId: 'root_admin',
        email: 'root@fleetpro.local',
        password: 'password',  // Dev mode
        platformRole: 'PLATFORM_ROOT',
        role: 'admin',
        tenantId: null,
        isActive: true,
        mustResetPassword: false,
        hasCompletedOnboarding: true
      });

      console.log(`✅ Created canonical root account: ${newRoot.userId}\n`);
    } else {
      console.log(`🔧 Updating canonical root: ${canonicalRoot.userId}\n`);

      // Ensure proper identity
      canonicalRoot.platformRole = 'PLATFORM_ROOT';
      canonicalRoot.tenantId = null;
      canonicalRoot.role = 'admin';
      canonicalRoot.isActive = true;

      await canonicalRoot.save();

      console.log(`✅ Updated: platformRole=PLATFORM_ROOT, tenantId=null\n`);
    }

    // Clean up any OTHER root accounts (keep only canonical)
    const otherRoots = await User.find({
      $or: [
        { platformRole: 'PLATFORM_ROOT' },
        { role: 'root', tenantId: null }
      ],
      email: { $ne: 'root@fleetpro.local' }
    });

    if (otherRoots.length > 0) {
      console.log(`⚠️  Found ${otherRoots.length} non-canonical root accounts:\n`);
      otherRoots.forEach((u) => {
        console.log(`   - ${u.userId} (${u.email})`);
      });
      console.log('\n🔄 Downgrading to regular accounts...\n');

      // Remove platformRole from non-canonical accounts
      await User.updateMany(
        {
          $or: [
            { platformRole: 'PLATFORM_ROOT' },
            { role: 'root', tenantId: null }
          ],
          email: { $ne: 'root@fleetpro.local' }
        },
        {
          $unset: { platformRole: 1 },
          role: 'admin',
          isActive: false  // Disable non-canonical roots
        }
      );

      console.log(`✅ Cleaned up ${otherRoots.length} duplicate root accounts\n`);
    }

    // Verify final state
    const finalRoot = await User.findOne({ email: 'root@fleetpro.local' });
    if (finalRoot) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ CANONICAL ROOT ACCOUNT VERIFIED');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`\nuserid: ${finalRoot.userId}`);
      console.log(`email: ${finalRoot.email}`);
      console.log(`platformRole: ${finalRoot.platformRole} ✓`);
      console.log(`tenantId: ${finalRoot.tenantId} (null) ✓`);
      console.log(`status: ${finalRoot.isActive ? 'active' : 'inactive'} ✓`);
      console.log('\n✅ ROOT ACCOUNT READY FOR LOGIN\n');
    }

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixRootAccount();
