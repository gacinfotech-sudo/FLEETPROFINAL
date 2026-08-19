import mongoose from 'mongoose';

async function checkTenantLimits() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    console.log('\n📊 Checking Tenant Limits...\n');
    
    // Find tenant by email or name containing "dharvika"
    const tenants = await db.collection('tenants').find({
      $or: [
        { email: /dharvika/i },
        { businessName: /dharvika/i },
        { name: /dharvika/i }
      ]
    }).toArray();
    
    console.log(`Found ${tenants.length} tenants:\n`);
    
    tenants.forEach(t => {
      console.log(`Name: ${t.name || t.businessName}`);
      console.log(`Email: ${t.email}`);
      console.log(`ID: ${t._id}`);
      console.log(`Current Limits:`, t.limits);
      console.log(`Max Managers: ${t.maxManagers || 'not set'}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTenantLimits();
