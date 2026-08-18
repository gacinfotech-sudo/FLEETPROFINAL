// Migration: Ensure ROOT user has platformRole set to PLATFORM_ROOT
// This migration runs automatically on server startup to fix the ROOT account

import { storage } from "../storage-mongodb";

export async function migrateRootPlatformRole() {
  try {
    console.log("🔄 Checking ROOT user platformRole...");

    // Get ROOT user using storage method
    const rootUser = await storage.getUser('fleet_root_admin_1d2af76b');

    if (!rootUser) {
      console.log("⚠️  ROOT user not found, skipping migration");
      return;
    }

    if (rootUser.platformRole === 'PLATFORM_ROOT') {
      console.log("✅ ROOT user already has platformRole: PLATFORM_ROOT");
      return;
    }

    // Update ROOT user with platformRole
    const updatedUser = await storage.updateUser(rootUser._id.toString(), {
      platformRole: 'PLATFORM_ROOT'
    });

    if (updatedUser) {
      console.log("✅ ROOT user updated: platformRole set to PLATFORM_ROOT");
    } else {
      console.log("ℹ️  ROOT user not modified (update failed)");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error instanceof Error ? error.message : error);
    // Don't throw - migration failures shouldn't crash the server
  }
}

export default migrateRootPlatformRole;
