// Tests for TASK-ROOT-DOMAIN-01's migrate-admin-to-platform-role script.
//
// Run directly via tsx (same convention as
// server/services/bookingCodeService.test.ts and this task's own
// rootAccessService.test.ts):
//
//   npx tsx --test scripts/migrate-admin-to-platform-role.test.ts
//
// This is a real, live-DB integration test (the acceptance criteria call
// for "a dry-run test of the migration script against a throwaway seeded
// dataset" — the script's whole job is a real DB write, so testing it
// against a mocked DB layer would not actually prove the acceptance
// criteria). To stay safe in this heavily-shared, multi-worktree
// environment:
//
//   - It connects to a DEDICATED, randomly-named throwaway database on the
//     same local mongod every worktree's dev server already uses
//     (127.0.0.1:27017) — never the shared "fleetpro" database other
//     worktrees' dev servers/manual testing rely on.
//   - It drops that throwaway database in an `after()` hook, so it leaves
//     no residue even on failure (best-effort — wrapped so a drop failure
//     doesn't mask the real test failure).
//   - The migration script itself is invoked exactly as an operator would
//     run it (`npx tsx scripts/migrate-admin-to-platform-role.ts ...` as a
//     real subprocess, MONGODB_URI overridden to the throwaway DB) rather
//     than importing internals — this proves the actual CLI contract
//     (argv parsing, exit codes, stdout JSON shape), not a refactored
//     testable-only version of it.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { User } from '../server/models/index';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TEST_DB_NAME = `fleetpro_test_root_domain_migration_${randomUUID().slice(0, 8)}`;
const MONGO_URI = `mongodb://127.0.0.1:27017/${TEST_DB_NAME}`;

let tmpDir: string;
let mapPath: string;

function runScript(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npx', ['tsx', 'scripts/migrate-admin-to-platform-role.ts', ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, MONGODB_URI: MONGO_URI },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error: any) {
    return { status: error.status ?? 1, stdout: error.stdout?.toString() ?? '', stderr: error.stderr?.toString() ?? '' };
  }
}

function writeMap(map: Record<string, string>): string {
  const file = join(tmpDir, `map-${randomUUID().slice(0, 6)}.json`);
  writeFileSync(file, JSON.stringify(map));
  return file;
}

async function seedUser(overrides: Record<string, unknown>) {
  // `platformRole` is not a declared Mongoose schema path yet (this task's
  // proposed patch to server/models/index.ts hasn't been applied — that's
  // the Integrator's job). Mongoose's strict document mode would silently
  // drop it if passed to `User.create(...)`, so it's created through the
  // normal Model API for its real schema fields, then `platformRole` (when
  // present) is patched in via the raw MongoDB driver collection — the
  // exact same bypass technique the script itself uses, so this test seeds
  // data the same way the script reads/writes it.
  const doc = await User.create({
    userId: overrides.userId,
    password: 'hashed-not-relevant-for-this-test',
    role: overrides.role,
    name: overrides.name,
    loginAttempts: 0,
    failedLoginAttempts: 0,
    accountLocked: false,
    isActive: true,
    mustResetPassword: false,
    hasCompletedOnboarding: true,
    permissions: [],
  });
  if ('platformRole' in overrides) {
    await User.collection.updateOne({ _id: doc._id }, { $set: { platformRole: overrides.platformRole } });
  }
  return doc;
}

async function findUserRaw(userId: string): Promise<any> {
  return User.collection.findOne({ userId });
}

async function findUsersRaw(filter: Record<string, unknown>): Promise<any[]> {
  return User.collection.find(filter).toArray();
}

describe('migrate-admin-to-platform-role.ts (live throwaway-DB integration test)', () => {
  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'root-domain-migration-test-'));
    // autoIndex: false — importing server/models/index.ts (for the real
    // User model) registers every model in that file, including ones this
    // test never touches (Customer, Booking, ...). Mongoose's default
    // autoIndex behavior kicks off background index-build calls for every
    // registered model right after connect(), which silently recreates
    // those collections (empty) moments after this suite's after() hook
    // drops the throwaway database — a race that left phantom empty
    // collections/databases behind during development of this test.
    // Disabling autoIndex removes the race entirely (and these tests don't
    // need any indexes anyway).
    await mongoose.connect(MONGO_URI, { autoIndex: false });
    await seedUser({ userId: 'admin-one', role: 'admin', name: 'Admin One' });
    await seedUser({ userId: 'admin-two', role: 'admin', name: 'Admin Two' });
    await seedUser({ userId: 'admin-already', role: 'admin', name: 'Already Migrated', platformRole: 'PLATFORM_READ_ONLY_AUDITOR' });
    await seedUser({ userId: 'client-one', role: 'client', name: 'Tenant Owner' });
    await seedUser({ userId: 'manager-one', role: 'manager', name: 'Tenant Manager' });
  });

  after(async () => {
    try {
      await mongoose.connection.dropDatabase();
    } catch (error) {
      console.error('[test cleanup] failed to drop throwaway test database', TEST_DB_NAME, error);
    }
    await mongoose.disconnect();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dry-run (default, no flags) lists every admin account, changes nothing', async () => {
    const result = runScript([]);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout);

    assert.equal(output.mode, 'dry-run');
    assert.equal(output.totalAdminAccounts, 3, 'admin-one, admin-two, admin-already — client/manager excluded');
    assert.equal(output.alreadyMigrated.length, 1);
    assert.equal(output.alreadyMigrated[0].userId, 'admin-already');
    assert.equal(output.alreadyMigrated[0].platformRole, 'PLATFORM_READ_ONLY_AUDITOR');

    // Neither admin-one nor admin-two has a --map/--default-role, so both
    // must be listed as unresolved, NOT silently assigned a role.
    const unresolvedIds = output.unresolved.map((u: any) => u.userId).sort();
    assert.deepEqual(unresolvedIds, ['admin-one', 'admin-two']);
    assert.equal(output.toMigrate.length, 0);

    // Confirm literally nothing changed in the DB.
    const stillUnset = await findUsersRaw({ role: 'admin', userId: { $in: ['admin-one', 'admin-two'] } });
    for (const doc of stillUnset) assert.equal(doc.platformRole, undefined);
  });

  test('client/manager accounts never appear anywhere in the script output', async () => {
    const result = runScript([]);
    const output = JSON.parse(result.stdout);
    const allUserIds = [
      ...output.alreadyMigrated.map((u: any) => u.userId),
      ...output.toMigrate.map((u: any) => u.userId),
      ...output.unresolved.map((u: any) => u.userId),
    ];
    assert.ok(!allUserIds.includes('client-one'));
    assert.ok(!allUserIds.includes('manager-one'));
  });

  test('--apply with no --map and no --default-role ABORTS (refuses to blanket-assign), changes nothing', async () => {
    const result = runScript(['--apply']);
    assert.notEqual(result.status, 0, 'must exit non-zero when it refuses to proceed');
    const output = JSON.parse(result.stderr);
    assert.equal(output.mode, 'apply-aborted');
    const unresolvedIds = output.unresolved.map((u: any) => u.userId).sort();
    assert.deepEqual(unresolvedIds, ['admin-one', 'admin-two']);

    const stillUnset = await findUsersRaw({ role: 'admin', userId: { $in: ['admin-one', 'admin-two'] } });
    for (const doc of stillUnset) assert.equal(doc.platformRole, undefined);
  });

  test('--apply with a --map covering every unresolved account applies exactly the mapped roles', async () => {
    mapPath = writeMap({ 'admin-one': 'PLATFORM_ROOT', 'admin-two': 'PLATFORM_SUPPORT_ADMIN' });
    const result = runScript(['--apply', `--map=${mapPath}`]);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, 'applied');
    assert.equal(output.matched, 2);
    assert.equal(output.modified, 2);
    assert.equal(output.alreadyMigratedSkipped, 1, 'admin-already must be reported as skipped, not re-touched');

    const one = await findUserRaw('admin-one');
    const two = await findUserRaw('admin-two');
    assert.equal(one.platformRole, 'PLATFORM_ROOT');
    assert.equal(two.platformRole, 'PLATFORM_SUPPORT_ADMIN');

    // The existing `role` field's 'admin' value must be completely untouched.
    assert.equal(one.role, 'admin');
    assert.equal(two.role, 'admin');
  });

  test('the already-migrated account (admin-already) was never modified by the apply run above', async () => {
    const doc = await findUserRaw('admin-already');
    assert.equal(doc.platformRole, 'PLATFORM_READ_ONLY_AUDITOR', 'must remain exactly what it was before this script ever ran');
    assert.equal(doc.role, 'admin');
  });

  test('idempotency: running the exact same --apply command again changes nothing further', async () => {
    const result = runScript(['--apply', `--map=${mapPath}`]);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, 'applied');
    assert.equal(output.matched, 0, 'both accounts are already migrated — nothing left to match');
    assert.equal(output.modified, 0);
    assert.equal(output.applied.length, 0);
    assert.equal(output.alreadyMigratedSkipped, 3, 'admin-already + the two just-migrated accounts');

    // End state identical to right after the first apply.
    const one = await findUserRaw('admin-one');
    const two = await findUserRaw('admin-two');
    assert.equal(one.platformRole, 'PLATFORM_ROOT');
    assert.equal(two.platformRole, 'PLATFORM_SUPPORT_ADMIN');
  });

  test('a fresh dry-run after migration shows all three admin accounts as already migrated, none unresolved', async () => {
    const result = runScript([]);
    const output = JSON.parse(result.stdout);
    assert.equal(output.totalAdminAccounts, 3);
    assert.equal(output.alreadyMigrated.length, 3);
    assert.equal(output.unresolved.length, 0);
    assert.equal(output.toMigrate.length, 0);
  });

  test('--skip-unresolved lets apply proceed and leaves the unresolved account untouched', async () => {
    // Seed one more, deliberately unmapped, admin account for this case.
    await seedUser({ userId: 'admin-three', role: 'admin', name: 'Admin Three' });
    const partialMap = writeMap({}); // covers nobody
    const result = runScript(['--apply', `--map=${partialMap}`, '--skip-unresolved']);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.matched, 0);
    assert.equal(output.modified, 0);
    assert.equal(output.skippedUnresolved.length, 1);
    assert.equal(output.skippedUnresolved[0].userId, 'admin-three');

    const three = await findUserRaw('admin-three');
    assert.equal(three.platformRole, undefined);
    assert.equal(three.role, 'admin');
  });

  test('--default-role assigns the fallback role to every remaining unresolved account', async () => {
    const emptyMap = writeMap({});
    const result = runScript(['--apply', `--map=${emptyMap}`, '--default-role=PLATFORM_FINANCE_ADMIN']);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.matched, 1);
    assert.equal(output.applied[0].userId, 'admin-three');
    assert.equal(output.applied[0].platformRole, 'PLATFORM_FINANCE_ADMIN');

    const three = await findUserRaw('admin-three');
    assert.equal(three.platformRole, 'PLATFORM_FINANCE_ADMIN');
  });

  test('an invalid PlatformRole in --map is rejected before any DB write (fail closed)', async () => {
    const badMap = writeMap({ 'admin-one': 'PLATFORM_SUPERUSER' as any });
    const result = runScript(['--apply', `--map=${badMap}`]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid PlatformRole/i);

    // admin-one must remain exactly what it was (PLATFORM_ROOT from the earlier test).
    const one = await findUserRaw('admin-one');
    assert.equal(one.platformRole, 'PLATFORM_ROOT');
  });

  test('an invalid --default-role is rejected before any DB write (fail closed)', async () => {
    const result = runScript(['--apply', '--default-role=NOT_A_ROLE']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--default-role must be one of/i);
  });
});
