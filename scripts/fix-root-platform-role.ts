import { MongoClient } from 'mongodb';

async function fixRootPlatformRole() {
  const MONGODB_URI = 'mongodb://127.0.0.1:27017/fleetpro';
  let client: MongoClient | null = null;

  try {
    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db('fleetpro');
    const users = db.collection('users');

    console.log('📋 Checking ROOT user...');
    const rootUser = await users.findOne({ userId: 'fleet_root_admin_1d2af76b' });

    if (!rootUser) {
      console.log('❌ ROOT user not found!');
      return;
    }

    console.log(`✅ Found ROOT user`);
    console.log(`   userId: ${rootUser.userId}`);
    console.log(`   role: ${rootUser.role}`);
    console.log(`   platformRole: ${rootUser.platformRole || '(not set)'}`);
    console.log(`   tenantId: ${rootUser.tenantId || '(none)'}`);

    if (rootUser.platformRole === 'PLATFORM_ROOT') {
      console.log('✅ ROOT user already has platformRole set correctly!');
      return;
    }

    console.log('\n✏️  Setting platformRole to PLATFORM_ROOT...');
    const result = await users.updateOne(
      { userId: 'fleet_root_admin_1d2af76b' },
      {
        $set: {
          platformRole: 'PLATFORM_ROOT',
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ ROOT user updated successfully!');

      // Verify the update
      const updatedUser = await users.findOne({ userId: 'fleet_root_admin_1d2af76b' });
      console.log(`\n✅ VERIFIED:`);
      console.log(`   platformRole: ${updatedUser?.platformRole}`);
    } else {
      console.log('⚠️  No changes made (user may already be correct)');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✅ Database connection closed');
    }
  }
}

fixRootPlatformRole();
