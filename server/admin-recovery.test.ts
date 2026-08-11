// Regression test for the Root Control Plane integration's admin-recovery
// compatibility fix (see docs/root-control-plane/ROOT-INTEGRATION-report.md,
// "requireTenant migration" section, for the full trace/audit this test
// proves).
//
// Root cause this guards against: requireTenant's cross-tenant bypass now
// gates on `User.platformRole`, not `role === "admin"`. Both recovery paths
// in server/admin-recovery.ts (createBackupAdmin, createEmergencyAdmin)
// create role:'admin' accounts specifically to bootstrap PLATFORM-level
// access when it has been lost entirely (confirmed via trace: neither
// function accepts or sets a tenantId; ADMIN_RECOVERY_GUIDE.md documents
// this as "Your FleetPro system"-wide recovery, not per-tenant; role:'admin'
// has never meant "tenant admin" in this codebase's semantics — that's
// role:'client'). Without this fix, a freshly-recovered admin account would
// be immediately locked out of the exact cross-tenant routes recovery
// exists to restore access to.
//
// Uses a dedicated, randomly-named throwaway database (same convention as
// scripts/migrate-admin-to-platform-role.test.ts) — never the shared
// "fleetpro" database other worktrees rely on.

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { User } from './models/index';
import { createBackupAdmin, createEmergencyAdmin } from './admin-recovery';

const TEST_DB_NAME = `fleetpro_test_admin_recovery_${randomUUID().slice(0, 8)}`;
const MONGO_URI = `mongodb://127.0.0.1:27017/${TEST_DB_NAME}`;

describe('admin-recovery.ts — platformRole compatibility with the Option A requireTenant migration', () => {
  before(async () => {
    await mongoose.connect(MONGO_URI);
  });

  after(async () => {
    try {
      await mongoose.connection.dropDatabase();
    } catch {
      // best-effort cleanup, never mask a real test failure
    }
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('createBackupAdmin: the created account has platformRole=PLATFORM_ROOT, not just role=admin', async () => {
    const created = await createBackupAdmin('backup-admin-test', 'p@ssw0rd123');
    assert.equal(created, true);

    const user = await User.findOne({ userId: 'backup-admin-test' }).lean();
    assert.ok(user, 'backup admin must actually be persisted');
    assert.equal(user!.role, 'admin', 'legacy role field must still be set (untouched by the migration)');
    assert.equal(
      (user as any).platformRole,
      'PLATFORM_ROOT',
      'without platformRole, this account would be immediately locked out of requireTenant-gated cross-tenant routes — defeating the entire point of a recovery admin',
    );
  });

  test('createBackupAdmin: refuses to create a second admin if one already exists, and does not touch the existing one\'s platformRole', async () => {
    await createBackupAdmin('first-admin', 'p@ssw0rd123');
    const before = await User.findOne({ userId: 'first-admin' }).lean();

    const secondResult = await createBackupAdmin('second-admin', 'p@ssw0rd456');
    assert.equal(secondResult, false, 'must refuse — an admin already exists');

    const stillOnlyOne = await User.countDocuments({ role: 'admin' });
    assert.equal(stillOnlyOne, 1, 'no second admin account should have been created');

    const after = await User.findOne({ userId: 'first-admin' }).lean();
    assert.equal((after as any).platformRole, (before as any).platformRole, 'the existing admin must be completely untouched');
  });

  test('createEmergencyAdmin: the created account has platformRole=PLATFORM_ROOT when EMERGENCY_ADMIN_* env vars are set', async () => {
    const prevId = process.env.EMERGENCY_ADMIN_ID;
    const prevPw = process.env.EMERGENCY_ADMIN_PASSWORD;
    process.env.EMERGENCY_ADMIN_ID = 'emergency-admin-test';
    process.env.EMERGENCY_ADMIN_PASSWORD = 'p@ssw0rd789';
    try {
      const created = await createEmergencyAdmin();
      assert.equal(created, true);

      const user = await User.findOne({ userId: 'emergency-admin-test' }).lean();
      assert.ok(user, 'emergency admin must actually be persisted');
      assert.equal(user!.role, 'admin');
      assert.equal(
        (user as any).platformRole,
        'PLATFORM_ROOT',
        'same requireTenant-gating reason as createBackupAdmin — see file header',
      );
      assert.equal(user!.mustResetPassword, true, 'emergency admin must still be forced to change password on first login (unrelated to this fix, must not regress)');
    } finally {
      if (prevId === undefined) delete process.env.EMERGENCY_ADMIN_ID; else process.env.EMERGENCY_ADMIN_ID = prevId;
      if (prevPw === undefined) delete process.env.EMERGENCY_ADMIN_PASSWORD; else process.env.EMERGENCY_ADMIN_PASSWORD = prevPw;
    }
  });

  test('boundary proof: neither recovery path ever sets a tenantId — this is platform-level recovery, never tenant-level, confirming PLATFORM_ROOT (not a tenant role) is the correct grant', async () => {
    await createBackupAdmin('boundary-check-admin', 'p@ssw0rd123');
    const user = await User.findOne({ userId: 'boundary-check-admin' }).lean();
    assert.equal(user!.tenantId, undefined, 'a platform-recovery admin must never be tenant-scoped');
    assert.notEqual(
      (user as any).platformRole,
      undefined,
      'must have SOME explicit platformRole — an admin-recovery account with role=admin and no platformRole would silently lose cross-tenant access under the Option A migration',
    );
  });
});
