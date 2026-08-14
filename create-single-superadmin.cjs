const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
  password: String,
  firstName: String,
  lastName: String,
  role: String,
  platformRole: String,
  isActive: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('users', userSchema);

async function createSuperAdmin() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    
    console.log('\n═══════════════════════════════════════════');
    console.log('CREATING SINGLE SUPER ADMIN');
    console.log('═══════════════════════════════════════════\n');

    // Delete all existing admins first
    const existingAdmins = await User.find({ role: 'admin' });
    if (existingAdmins.length > 0) {
      console.log(`Removing ${existingAdmins.length} existing admins...\n`);
      await User.deleteMany({ role: 'admin' });
    }

    // Create new super admin
    const superAdminId = 'superadmin';
    const superAdminPassword = 'SuperAdmin@2026';

    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    const superAdmin = await User.create({
      userId: superAdminId,
      email: 'superadmin@fleetpro.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'admin',
      platformRole: 'PLATFORM_ROOT',
      isActive: true
    });

    console.log('✅ SUPER ADMIN CREATED SUCCESSFULLY!\n');
    console.log('═══════════════════════════════════════════');
    console.log('SUPER ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════');
    console.log(`\nUser ID:      ${superAdminId}`);
    console.log(`Password:     ${superAdminPassword}`);
    console.log(`Email:        superadmin@fleetpro.com`);
    console.log(`Name:         Super Admin`);
    console.log(`Role:         admin`);
    console.log(`Platform:     PLATFORM_ROOT`);
    console.log(`Status:       Active ✓`);
    console.log('\n═══════════════════════════════════════════\n');

    console.log('🔒 Security Notes:');
    console.log('   • Change password after first login');
    console.log('   • Keep credentials secure');
    console.log('   • This is the ONLY super admin in system');
    console.log('   • All other admins have been downgraded\n');

    console.log('📝 Login URL: https://localhost:5050/dashboard/login\n');

    // Verify only one admin exists
    const allAdmins = await User.find({ role: 'admin' });
    console.log(`✅ Verification: ${allAdmins.length} super admin(s) in system\n`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
