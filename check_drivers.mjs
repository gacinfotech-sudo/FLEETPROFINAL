import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://127.0.0.1:27017');
try {
  await client.connect();
  const db = client.db('fleetpro');
  
  // Get Dharvika Travels tenant
  const tenant = await db.collection('tenants').findOne({name: 'Dharvika Travels'});
  console.log('📍 Tenant:', tenant?.name, 'ID:', tenant?._id?.toString());
  
  // Get drivers for this tenant
  const drivers = await db.collection('drivers').find({
    tenantId: tenant?._id?.toString()
  }).toArray();
  
  console.log('\n👥 Drivers found:', drivers.length);
  drivers.forEach((d, i) => {
    console.log(`${i+1}. ${d.name} (ID: ${d._id}) - Status: ${d.status}`);
  });
  
  // Also check for any drivers with different tenantId format
  console.log('\n🔍 Checking all drivers in database:');
  const allDrivers = await db.collection('drivers').find({}).toArray();
  console.log('Total drivers (all tenants):', allDrivers.length);
  
} finally {
  await client.close();
}
