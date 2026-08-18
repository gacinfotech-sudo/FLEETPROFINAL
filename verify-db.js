const { MongoClient } = require('mongodb');

async function verify() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  try {
    await client.connect();
    const db = client.db('fleetpro');
    
    console.log('=== CHECKING ROOT USER ===');
    const rootUser = await db.collection('users').findOne(
      {email: 'fleet_root_admin_1d2af76b'},
      {projection: {email: 1, platformRole: 1, sessionId: 1}}
    );
    console.log('Root user:', JSON.stringify(rootUser, null, 2));
    
    if (rootUser) {
      console.log('\n✅ Root user found');
      console.log('  - Email:', rootUser.email);
      console.log('  - Platform Role:', rootUser.platformRole);
      console.log('  - Has SessionId:', rootUser.sessionId ? 'YES' : 'NO');
      
      if (rootUser.platformRole === 'PLATFORM_ROOT') {
        console.log('\n✅ DATABASE INITIALIZATION VERIFIED');
      }
    } else {
      console.log('\n❌ Root user NOT found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

verify();
