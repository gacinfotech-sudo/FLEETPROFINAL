// STEP 6: Platform Root Bootstrap
// Creates initial PLATFORM_ROOT account atomically

import bcrypt from 'bcrypt';
import { User } from '../../models';
import { AuditLog } from '../models/AuditLog';

export async function bootstrapPlatformRoot() {
  try {
    const existingRoot = await User.findOne({ platformRole: 'PLATFORM_ROOT' });

    if (existingRoot) {
      console.log('✅ Platform Root already exists, skipping bootstrap');
      return existingRoot;
    }

    // Get credentials from environment (first-run only)
    const rootId = process.env.FLEETPRO_PLATFORM_ROOT_ID || 'platform_root';
    const rootPassword = process.env.FLEETPRO_PLATFORM_ROOT_PASSWORD;

    if (!rootPassword) {
      throw new Error('FLEETPRO_PLATFORM_ROOT_PASSWORD not set. Cannot bootstrap Root.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(rootPassword, 12);

    // Create Platform Root user
    const root = new User({
      userId: rootId,
      name: 'Platform Root',
      password: hashedPassword,
      platformRole: 'PLATFORM_ROOT',  // Platform role only
      tenantId: null,                 // No tenant association
      isActive: true,
      role: undefined,                // No tenant role
      permissions: [],
      createdAt: new Date(),
      createdBy: 'system'
    });

    await root.save();

    // Audit log
    await AuditLog.create({
      actor: 'system',
      action: 'PLATFORM_ROOT_BOOTSTRAP',
      resource: 'user',
      resourceId: root._id.toString(),
      status: 'success',
      createdAt: new Date()
    });

    console.log('✅ Platform Root bootstrapped successfully');
    console.log('   ID:', rootId);
    console.log('   Password: ****** (set via env var)');

    return root;

  } catch (error) {
    console.error('❌ Platform Root bootstrap failed:', error);
    throw error;
  }
}
