import 'dotenv/config';
import mongoose from 'mongoose';
import { storage } from '../server/storage-mongodb';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await storage.getUsers();
  const admins = users.filter((u) => u.role === 'admin');

  if (admins.length === 0) {
    console.log('No Super Admin account exists yet. Run: npm run admin:bootstrap');
  } else {
    console.log(`Super Admin account(s): ${admins.length}\n`);
    for (const admin of admins) {
      console.log(`- ${admin.userId}`);
      console.log(`  active:              ${admin.isActive}`);
      console.log(`  mustResetPassword:   ${admin.mustResetPassword}`);
      console.log(`  lastLogin:           ${admin.lastLogin ? admin.lastLogin.toISOString() : 'never'}`);
      console.log(`  accountLocked:       ${admin.accountLocked ?? false}`);
      console.log();
    }
  }
  // Never print password hashes or any secret material here.

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ admin:status failed:', error?.message || error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
