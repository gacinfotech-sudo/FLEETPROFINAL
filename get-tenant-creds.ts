import mongoose from 'mongoose';

const mongoUrl = 'mongodb://127.0.0.1:27017/fleetpro';

async function getCreds() {
  try {
    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;
    
    console.log('=== TENANTS WITH USERS ===\n');
    
    const tenants = await db?.collection('tenants').find({}).toArray();
    
    for (const tenant of tenants || []) {
      console.log(`\n📦 TENANT: ${tenant.name}`);
      console.log(`   ID: ${tenant._id}`);
      
      const users = await db?.collection('users').find({ tenantId: tenant._id }).toArray();
      
      if (users && users.length > 0) {
        users.slice(0, 3).forEach((user: any) => {
          console.log(`   👤 User: ${user.email || user.name || user._id}`);
          console.log(`      ID: ${user._id}`);
          console.log(`      Role: ${user.role || user.platformRole || 'N/A'}`);
        });
      }
    }
    
    console.log('\n\n=== QUICK LOGIN ===');
    console.log('Admin Email: testadmin@fleetpro.local');
    console.log('Admin Password: TestPass123!');
    console.log('\nURL: http://192.168.29.142:5050');
    
    await mongoose.disconnect();
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

getCreds();
