const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
  role: String,
  platformRole: String,
  isActive: Boolean,
  createdAt: Date
});

const User = mongoose.model('users', userSchema);

async function checkSuperAdmins() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    
    // Find all super admins
    const superAdmins = await User.find({
      $or: [
        { platformRole: 'PLATFORM_ROOT' },
        { role: 'admin' }
      ]
    }).lean();

    console.log('\n═══════════════════════════════════════════');
    console.log('SUPER ADMIN CHECK');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`Total Super Admins Found: ${superAdmins.length}\n`);
    
    if (superAdmins.length > 0) {
      console.log('Super Admin Details:');
      console.log('───────────────────────────────────────────');
      superAdmins.forEach((admin, idx) => {
        console.log(`${idx + 1}. User ID: ${admin.userId}`);
        console.log(`   Email: ${admin.email || 'N/A'}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Platform Role: ${admin.platformRole || 'N/A'}`);
        console.log(`   Active: ${admin.isActive}`);
        console.log(`   Created: ${new Date(admin.createdAt).toLocaleString()}`);
        console.log('');
      });
    }

    if (superAdmins.length > 1) {
      console.log('⚠️  WARNING: Multiple super admins found!');
      console.log('\n🔧 Fix: Keeping only the oldest one, removing others...\n');
      
      // Sort by created date, keep the first one
      const sorted = superAdmins.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      const keepAdmin = sorted[0];
      const removeAdmins = sorted.slice(1);

      console.log(`✅ Keeping: ${keepAdmin.userId} (created: ${new Date(keepAdmin.createdAt).toLocaleString()})`);
      console.log(`❌ Removing: ${removeAdmins.map(a => a.userId).join(', ')}\n`);

      // Update the keeper to ensure PLATFORM_ROOT
      await User.updateOne(
        { _id: keepAdmin._id },
        { 
          platformRole: 'PLATFORM_ROOT',
          role: 'admin'
        }
      );

      // Remove others from admin role
      for (const admin of removeAdmins) {
        await User.updateOne(
          { _id: admin._id },
          { 
            role: 'client',
            platformRole: null
          }
        );
        console.log(`  ✓ Downgraded ${admin.userId} to client role`);
      }

      console.log('\n✅ Database cleaned! Only 1 super admin remains.\n');
    } else if (superAdmins.length === 1) {
      console.log('✅ Perfect! Only 1 super admin exists.\n');
    } else {
      console.log('⚠️  No super admin found! You should create one.\n');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSuperAdmins();
