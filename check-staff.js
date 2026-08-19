const mongoose = require('mongoose');

async function checkStaff() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    
    const UserModel = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const users = await UserModel.find({}).lean();
    
    console.log(`\n✓ Total users in database: ${users.length}\n`);
    
    if (users.length === 0) {
      console.log('⚠️  No users found! You need to create some test users first.\n');
      process.exit(1);
    }
    
    // Group by tenant
    const byTenant = {};
    users.forEach(u => {
      const tid = u.tenantId || 'no-tenant';
      if (!byTenant[tid]) byTenant[tid] = [];
      byTenant[tid].push(u);
    });
    
    console.log('Users by Tenant:');
    Object.entries(byTenant).forEach(([tenantId, tenantUsers]) => {
      console.log(`\n  Tenant: ${tenantId}`);
      console.log(`  Count: ${tenantUsers.length}`);
      tenantUsers.slice(0, 3).forEach(u => {
        console.log(`    - ${u.name || u.email} (${u.role})`);
      });
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkStaff();
