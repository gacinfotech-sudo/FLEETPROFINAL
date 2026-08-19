import mongoose from 'mongoose';

async function checkDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro-final');
    const db = mongoose.connection.db;
    
    const collections = await db.listCollections().toArray();
    console.log(`\n📊 Database has ${collections.length} collections:\n`);
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  • ${col.name}: ${count} documents`);
    }
    
    // Check if there's any tenant
    const tenants = await db.collection('tenants').find({}).toArray();
    console.log(`\n🏢 Tenants found: ${tenants.length}`);
    if (tenants.length > 0) {
      tenants.forEach(t => {
        console.log(`  - ${t.tenantName} (${t._id})`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDB();
