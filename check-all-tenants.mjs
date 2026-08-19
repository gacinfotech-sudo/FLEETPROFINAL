import mongoose from 'mongoose';

async function checkAllTenants() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    console.log('\n📊 All Tenants in Database:\n');
    
    const tenants = await db.collection('tenants').find({}).toArray();
    
    console.log(`Total tenants: ${tenants.length}\n`);
    
    tenants.forEach(t => {
      console.log(`✓ Tenant: ${t.name || t.businessName || 'Unknown'}`);
      console.log(`  Email: ${t.email || 'N/A'}`);
      console.log(`  ID: ${t._id}`);
      console.log(`  Current Limits:`, JSON.stringify(t.limits, null, 2));
      console.log(`  Max Managers: ${t.maxManagers || 'not set'}`);
      console.log('  ---\n');
    });
    
    // Also check users
    console.log('\n👥 Sample Users:\n');
    const users = await db.collection('users').find({}).limit(5).toArray();
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}) - Tenant: ${u.tenantId}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAllTenants();
