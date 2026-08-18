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

async function createAdmin() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    
    const adminId = 'fleetpro_admin';
    const adminPassword = 'Admin@123456';
    
    const existing = await User.findOne({ userId: adminId });
    
    if (existing) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.updateOne(
        { userId: adminId },
        { password: hashedPassword, updatedAt: new Date() }
      );
      console.log('\n✅ Admin password updated!');
    } else {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        userId: adminId,
        email: 'admin@fleetpro.local',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'FleetPro',
        role: 'admin',
        platformRole: 'PLATFORM_ROOT',
        isActive: true
      });
      console.log('\n✅ New Admin account created!');
    }
    
    console.log('\n📋 ADMIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Username:  ${adminId}`);
    console.log(`Password:  ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔒 Security Notes:');
    console.log('• Save these credentials securely');
    console.log('• Change password after first login');
    console.log('• Do not share password publicly');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createAdmin();
