import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function resetPassword() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.getClient().db('fleetpro');
    const users = db.collection('users');
    
    const newPassword = 'Superadmin@123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update superadmin password
    const result = await users.updateOne(
      { userId: 'fleet_root_admin_1d2af76b' },
      { $set: { password: hashedPassword, mustResetPassword: false } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Superadmin password updated!');
      console.log('');
      console.log('📝 SUPERADMIN CREDENTIALS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Username: fleet_root_admin_1d2af76b');
      console.log('Password: Superadmin@123');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('❌ User not found');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

resetPassword();
