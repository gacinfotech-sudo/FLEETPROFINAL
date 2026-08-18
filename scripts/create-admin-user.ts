import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../server/models/index';

async function createAdminUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    
    const adminId = 'fleetpro_admin';
    const adminPassword = 'Admin@123456';
    
    // Check if admin exists
    const existing = await User.findOne({ userId: adminId });
    
    if (existing) {
      // Update password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.updateOne(
        { userId: adminId },
        { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      );
      console.log('\n✅ Admin password updated!');
    } else {
      // Create new admin
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
    
    console.log('\n📋 Admin Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:       ${adminId}`);
    console.log(`Password: ${adminPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💾 Save these credentials securely!');
    console.log('🔐 Change password after first login');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser();
