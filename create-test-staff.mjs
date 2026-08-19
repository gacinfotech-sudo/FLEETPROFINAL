import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function createTestStaff() {
  try {
    console.log('🔌 Connecting to database...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    
    // Get the User model
    const UserModel = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    // First, get an existing tenant to use
    const existingUser = await UserModel.findOne({}).lean();
    if (!existingUser) {
      console.error('❌ No existing users found. Please create a tenant first via the app.');
      process.exit(1);
    }
    
    const tenantId = existingUser.tenantId;
    console.log(`✓ Using tenant: ${tenantId}\n`);
    
    const testStaff = [
      {
        userId: 'staff_rajesh_001',
        email: 'rajesh@fleetpro.local',
        name: 'Rajesh Kumar',
        phone: '9876543210',
        role: 'manager',
        password: 'Staff@123'
      },
      {
        userId: 'staff_priya_002',
        email: 'priya@fleetpro.local',
        name: 'Priya Singh',
        phone: '9876543211',
        role: 'manager',
        password: 'Staff@123'
      },
      {
        userId: 'staff_amit_003',
        email: 'amit@fleetpro.local',
        name: 'Amit Patel',
        phone: '9876543212',
        role: 'admin',
        password: 'Staff@123'
      }
    ];
    
    console.log('📝 Creating test staff members...\n');
    
    for (const staff of testStaff) {
      const hashedPassword = await bcrypt.hash(staff.password, 10);
      
      const newUser = {
        userId: staff.userId,
        email: staff.email,
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        tenantId: tenantId,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date()
      };
      
      // Check if user already exists
      const existing = await UserModel.findOne({ $or: [{ userId: staff.userId }, { email: staff.email }] });
      if (existing) {
        console.log(`⚠️  ${staff.name} (${staff.email}) - Already exists, skipping`);
        continue;
      }
      
      await UserModel.insertOne(newUser);
      console.log(`✅ ${staff.name}`);
      console.log(`   📧 Email: ${staff.email}`);
      console.log(`   📱 Phone: ${staff.phone}`);
      console.log(`   🔑 Password: ${staff.password}`);
      console.log(`   👤 Role: ${staff.role}\n`);
    }
    
    // Verify creation
    const allStaff = await UserModel.find({ tenantId }).lean();
    console.log(`\n✨ Total staff members now: ${allStaff.length}`);
    
    console.log('\n🎉 Setup complete! You can now:');
    console.log('1. Go to Staff WhatsApp Numbers page');
    console.log('2. See all staff members listed');
    console.log('3. Add WhatsApp numbers for each person\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createTestStaff();
