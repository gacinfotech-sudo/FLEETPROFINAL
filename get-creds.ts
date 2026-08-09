import mongoose from 'mongoose';

const mongoUrl = 'mongodb://127.0.0.1:27017/fleetpro';

async function getCreds() {
  try {
    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;
    
    console.log('=== TENANTS ===');
    const tenants = await db?.collection('tenants').find({}).limit(5).toArray();
    tenants?.forEach((doc: any) => {
      console.log(`ID: ${doc._id} | Name: ${doc.name} | Email: ${doc.email}`);
    });
    
    console.log('\n=== USERS (Sample) ===');
    const users = await db?.collection('users').find({}).limit(5).toArray();
    users?.forEach((doc: any) => {
      console.log(`Email: ${doc.email} | TenantID: ${doc.tenantId} | Role: ${doc.platformRole}`);
    });
    
    console.log('\n=== ADMIN CREDENTIALS ===');
    console.log('Email: testadmin@fleetpro.local');
    console.log('Password: TestPass123!');
    
    await mongoose.disconnect();
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

getCreds();
