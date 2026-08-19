import mongoose from 'mongoose';

async function updateTenantLimits() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const tenantId = '6a85a8f72a327d84cead8194';
    
    console.log('\n🔧 Updating Tenant Limits...\n');
    
    // Update tenant with limits and info
    const result = await db.collection('tenants').updateOne(
      { _id: mongoose.Types.ObjectId.createFromHexString(tenantId) },
      {
        $set: {
          name: 'Demo Taxi Fleet',
          email: 'dharvika@gmail.com',
          businessName: 'Demo Taxi Fleet',
          limits: {
            admins: 20,      // Increased from default 5
            managers: 50,    // Increased from default 10
            vehicles: 200,   // Increased from default 50
            drivers: 500     // Increased from default 100
          },
          maxManagers: 50,
          subscriptionPlan: 'enterprise',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Tenant Updated: ${result.modifiedCount} document(s) modified\n`);
    
    // Verify the update
    const tenant = await db.collection('tenants').findOne({
      _id: mongoose.Types.ObjectId.createFromHexString(tenantId)
    });
    
    console.log('📊 Updated Tenant Details:\n');
    console.log(`Name: ${tenant.name}`);
    console.log(`Email: ${tenant.email}`);
    console.log(`Business: ${tenant.businessName}`);
    console.log(`Plan: ${tenant.subscriptionPlan}`);
    console.log(`\nLimits:`);
    console.log(`  Admins: ${tenant.limits.admins}`);
    console.log(`  Managers: ${tenant.limits.managers}`);
    console.log(`  Vehicles: ${tenant.limits.vehicles}`);
    console.log(`  Drivers: ${tenant.limits.drivers}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

updateTenantLimits();
