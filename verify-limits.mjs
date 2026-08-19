import mongoose from 'mongoose';

async function verifyLimits() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const tenantId = '6a85a8f72a327d84cead8194';
    
    console.log('\n✅ TENANT LIMITS VERIFICATION\n');
    console.log('=' . repeat(50));
    
    // Get tenant
    const tenant = await db.collection('tenants').findOne({
      _id: new mongoose.Types.ObjectId(tenantId)
    });
    
    console.log('\n📊 Tenant Information:');
    console.log(`  Name: ${tenant.name}`);
    console.log(`  Email: ${tenant.email}`);
    console.log(`  Plan: ${tenant.subscriptionPlan}`);
    
    console.log('\n🔒 Current Resource Limits:');
    console.log(`  ├─ Admins: ${tenant.limits.admins}`);
    console.log(`  ├─ Managers: ${tenant.limits.managers}`);
    console.log(`  ├─ Vehicles: ${tenant.limits.vehicles}`);
    console.log(`  └─ Drivers: ${tenant.limits.drivers}`);
    
    // Count current usage
    const adminCount = await db.collection('users').countDocuments({
      tenantId: tenantId,
      role: 'admin'
    });
    
    const managerCount = await db.collection('users').countDocuments({
      tenantId: tenantId,
      role: 'manager'
    });
    
    const vehicleCount = await db.collection('vehicles').countDocuments({
      tenantId: tenantId
    });
    
    const driverCount = await db.collection('drivers').countDocuments({
      tenantId: tenantId
    });
    
    console.log('\n📈 Current Usage:');
    console.log(`  ├─ Admins: ${adminCount}/${tenant.limits.admins} ${adminCount >= tenant.limits.admins ? '❌ LIMIT REACHED' : '✅ OK'}`);
    console.log(`  ├─ Managers: ${managerCount}/${tenant.limits.managers} ${managerCount >= tenant.limits.managers ? '❌ LIMIT REACHED' : '✅ OK'}`);
    console.log(`  ├─ Vehicles: ${vehicleCount}/${tenant.limits.vehicles} ${vehicleCount >= tenant.limits.vehicles ? '❌ LIMIT REACHED' : '✅ OK'}`);
    console.log(`  └─ Drivers: ${driverCount}/${tenant.limits.drivers} ${driverCount >= tenant.limits.drivers ? '❌ LIMIT REACHED' : '✅ OK'}`);
    
    console.log('\n💡 Can Add More:');
    console.log(`  ├─ Can add admin: ${adminCount < tenant.limits.admins ? '✅ YES' : '❌ NO'}`);
    console.log(`  ├─ Can add manager: ${managerCount < tenant.limits.managers ? '✅ YES' : '❌ NO'}`);
    console.log(`  ├─ Can add vehicle: ${vehicleCount < tenant.limits.vehicles ? '✅ YES' : '❌ NO'}`);
    console.log(`  └─ Can add driver: ${driverCount < tenant.limits.drivers ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

verifyLimits();
