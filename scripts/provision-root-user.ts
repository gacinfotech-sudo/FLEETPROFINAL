import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../server/models';

const ROOT_EMAIL = 'root@fleetpro.platform';
const ROOT_PASSWORD = 'Root@Platform123!';
const PLATFORM_ROLE = 'PLATFORM_ROOT';

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if root user already exists
    let rootUser = await User.findOne({ email: ROOT_EMAIL });
    if (rootUser && rootUser.platformRole === PLATFORM_ROLE) {
      console.log('✅ Root user already exists with PLATFORM_ROOT role.');
      console.log(`   Email: ${rootUser.email}`);
      console.log(`   Platform Role: ${rootUser.platformRole}`);
      await mongoose.disconnect();
      return;
    }

    // Check for any user with PLATFORM_ROOT role
    const existingRootUser = await User.findOne({ platformRole: PLATFORM_ROLE });
    if (existingRootUser) {
      console.log('✅ A PLATFORM_ROOT user already exists.');
      console.log(`   Email: ${existingRootUser.email}`);
      await mongoose.disconnect();
      return;
    }

    // If root user exists but doesn't have platformRole, update it
    if (rootUser) {
      console.log(`Updating existing root user (${ROOT_EMAIL}) with PLATFORM_ROOT role...`);
      rootUser.platformRole = PLATFORM_ROLE;
      await rootUser.save();
      console.log('✅ Root user updated with PLATFORM_ROOT role.');
      console.log(`   Email: ${rootUser.email}`);
      console.log(`   Platform Role: ${rootUser.platformRole}`);
      await mongoose.disconnect();
      return;
    }

    // Create new root user
    console.log('Creating new root user...');
    const passwordHash = await bcrypt.hash(ROOT_PASSWORD, 10);

    const newRootUser = new User({
      email: ROOT_EMAIL,
      passwordHash: passwordHash,
      platformRole: PLATFORM_ROLE,
      tenantId: null,
      isActive: true,
      createdAt: new Date(),
      role: 'admin',
    });

    await newRootUser.save();
    console.log('✅ Root user created successfully.');
    console.log(`   Email: ${newRootUser.email}`);
    console.log(`   Platform Role: ${newRootUser.platformRole}`);
    console.log(`   Default Password: ${ROOT_PASSWORD}`);
    console.log('   ⚠️  Change password immediately after first login!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error provisioning root user:', error instanceof Error ? error.message : error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  }
}

main();
