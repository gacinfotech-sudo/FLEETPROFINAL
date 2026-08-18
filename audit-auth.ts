import mongoose from 'mongoose';
import { User } from './server/models';

async function auditAuth() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/fleetpro');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔐 AUTHENTICATION AUDIT - CRITICAL P0');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all users
    const allUsers = await User.find({}).lean();

    console.log(`📊 TOTAL USERS: ${allUsers.length}\n`);

    // Separate root from tenant
    const rootUsers = allUsers.filter(u => u.platformRole === 'PLATFORM_ROOT' || u.role === 'root' || !u.tenantId);
    const tenantUsers = allUsers.filter(u => u.tenantId);

    console.log('🔴 ROOT/PLATFORM ACCOUNTS:');
    rootUsers.forEach((u, i) => {
      console.log(`   ${i+1}. userId: ${u.userId}`);
      console.log(`      email: ${u.email || 'N/A'}`);
      console.log(`      tenantId: ${u.tenantId || 'null ✓'}`);
      console.log(`      platformRole: ${u.platformRole || 'N/A'}`);
      console.log(`      role: ${u.role}`);
      console.log('');
    });

    console.log('🟦 TENANT ACCOUNTS:');
    const firstTenant = tenantUsers.slice(0, 3);
    firstTenant.forEach((u, i) => {
      console.log(`   ${i+1}. userId: ${u.userId}`);
      console.log(`      email: ${u.email || 'N/A'}`);
      console.log(`      tenantId: ${u.tenantId}`);
      console.log(`      role: ${u.role}`);
      console.log('');
    });

    // Check collisions
    console.log('🔍 COLLISION CHECK:');
    const userIds = allUsers.map(u => u.userId);
    const dupUserIds = userIds.filter((id, idx) => userIds.indexOf(id) !== idx);
    
    console.log(`   Duplicate userIds: ${dupUserIds.length === 0 ? '✓ 0' : '❌ ' + dupUserIds.length}`);
    dupUserIds.forEach(id => console.log(`      - ${id}`));

    // Check if root userId exists in tenant
    if (rootUsers.length > 0) {
      const rootId = rootUsers[0].userId;
      const collision = tenantUsers.find(u => u.userId === rootId);
      console.log(`\n⚠️  CRITICAL: Root ID "${rootId}" also used by tenant?`);
      console.log(`   ${collision ? '❌ YES - COLLISION FOUND!' : '✓ NO'}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

auditAuth();
