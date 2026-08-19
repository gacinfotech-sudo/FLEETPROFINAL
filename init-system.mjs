import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

async function initSystem() {
  try {
    console.log('🚀 Initializing FleetPro System...\n');
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    // Create Tenant
    console.log('1️⃣  Creating tenant...');
    const tenantCol = db.collection('tenants');
    const tenantResult = await tenantCol.insertOne({
      tenantName: 'Demo Taxi Fleet',
      tenantCode: 'DEMO001',
      status: 'active',
      plan: 'premium',
      maxUsers: 100,
      maxVehicles: 50,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const tenantId = tenantResult.insertedId.toString();
    console.log(`   ✅ Tenant created: ${tenantId}\n`);
    
    // Create Admin User
    console.log('2️⃣  Creating admin user...');
    const userCol = db.collection('users');
    const adminPassword = await bcrypt.hash('Admin@123', 10);
    const adminResult = await userCol.insertOne({
      userId: 'admin_001',
      email: 'admin@fleetpro.local',
      name: 'Admin User',
      phone: '9999999999',
      role: 'admin',
      tenantId: tenantId,
      password: adminPassword,
      isActive: true,
      hasCompletedOnboarding: true,
      createdAt: new Date()
    });
    console.log(`   ✅ Admin user created\n`);
    
    // Create Staff Users
    console.log('3️⃣  Creating staff members...');
    const staffMembers = [
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
    
    for (const staff of staffMembers) {
      const hashedPassword = await bcrypt.hash(staff.password, 10);
      await userCol.insertOne({
        userId: staff.userId,
        email: staff.email,
        name: staff.name,
        phone: staff.phone,
        role: staff.role,
        tenantId: tenantId,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date()
      });
      console.log(`   ✅ ${staff.name} (${staff.email})`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✨ SYSTEM INITIALIZED SUCCESSFULLY!');
    console.log('='.repeat(60) + '\n');
    
    console.log('📝 LOGIN CREDENTIALS:\n');
    console.log('Admin Account:');
    console.log('  Email: admin@fleetpro.local');
    console.log('  Password: Admin@123\n');
    
    console.log('Staff Accounts:');
    staffMembers.forEach(staff => {
      console.log(`  • ${staff.name}`);
      console.log(`    Email: ${staff.email}`);
      console.log(`    Password: ${staff.password}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 NEXT STEPS:\n');
    console.log('1. Login with admin account');
    console.log('2. Go to: Communications → Staff WhatsApp Numbers');
    console.log('3. You should see 3 staff members listed');
    console.log('4. Add WhatsApp numbers for each staff member');
    console.log('5. Test booking reminders\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

initSystem();
