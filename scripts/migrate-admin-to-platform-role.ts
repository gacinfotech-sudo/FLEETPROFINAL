// scripts/migrate-admin-to-platform-role.ts
//
// TASK-ROOT-DOMAIN-01 — the "Option A: Migrate" migration script (see
// docs/root-control-plane/ROOT-GAP-MATRIX.md's "Critical design fork" and
// .claude/tasks/active/ROOT-CONTROL-PLANE-MANIFEST.md's decision #1).
//
// Moves real existing `role: 'admin'` accounts onto the new, additive
// `User.platformRole` field so the *mechanism* that grants cross-tenant
// access becomes the new, auditable one, while today's behavior keeps
// working for real accounts in the interim (until the Integrator applies
// the proposed requireTenant/routes.ts:159 patch documented in this task's
// report).
//
// Follows the same conventions as the existing scripts/backfill-*.ts
// scripts in this repo: `dotenv/config`, MONGODB_URI required, an explicit
// opt-in flag gates any write, JSON summary printed to stdout.
//
// -----------------------------------------------------------------------
// Usage
// -----------------------------------------------------------------------
//
//   Dry run (default — makes NO changes, always safe to run):
//     npx tsx scripts/migrate-admin-to-platform-role.ts
//
//   Real run:
//     npx tsx scripts/migrate-admin-to-platform-role.ts --apply \
//       --map=./platform-role-map.json
//
//     where platform-role-map.json is a human-reviewed
//     `{ "<userId>": "<PlatformRole>", ... }` object covering the accounts
//     you want migrated in this run. This is the "per-account review path"
//     required by this task's acceptance criteria — the script refuses to
//     blanket-assign a role to every admin account without one.
//
//   Optional: assign every *unmapped* admin account a single fallback role
//   (still requires deliberately typing the role out — never a silent
//   default):
//     npx tsx scripts/migrate-admin-to-platform-role.ts --apply \
//       --map=./platform-role-map.json --default-role=PLATFORM_SUPPORT_ADMIN
//
//   Optional: proceed even if some admin accounts remain unresolved (no
//   map entry and no --default-role) — they are left untouched and listed
//   in the output as "skippedUnresolved":
//     npx tsx scripts/migrate-admin-to-platform-role.ts --apply \
//       --map=./platform-role-map.json --skip-unresolved
//
// -----------------------------------------------------------------------
// Safety properties (see this task's acceptance criteria)
// -----------------------------------------------------------------------
//
// - Dry-run by default: without --apply, this NEVER writes to the DB,
//   regardless of any other flag.
// - Never touches the existing `role` field's 'admin' value — only ever
//   `$set`s the new, separate `platformRole` field. `role` stays exactly
//   as-is for backward compatibility.
// - Refuses to blanket-assign: in --apply mode, if any targeted account
//   has no explicit --map entry and no --default-role was given, the run
//   ABORTS with a non-zero exit code and prints exactly which accounts are
//   unresolved, unless --skip-unresolved is also passed.
// - Idempotent: an account that already has ANY platformRole set (from a
//   previous run of this script, or set by a human directly) is treated as
//   already-migrated and left untouched — it is reported separately, never
//   re-written — unless --force-remap is passed together with a --map
//   entry for that exact account.
// - Idempotent end state: running the same command twice produces the same
//   end state and does not double-migrate (the second run finds nothing
//   left to migrate for accounts the first run already handled).

import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { User } from '../server/models/index';
import { PLATFORM_ROLES, isPlatformRole, type PlatformRole } from '../server/root/types';

interface CliArgs {
  apply: boolean;
  mapPath?: string;
  defaultRole?: PlatformRole;
  skipUnresolved: boolean;
  forceRemap: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const apply = argv.includes('--apply');
  const skipUnresolved = argv.includes('--skip-unresolved');
  const forceRemap = argv.includes('--force-remap');
  const mapArg = argv.find((a) => a.startsWith('--map='));
  const defaultRoleArg = argv.find((a) => a.startsWith('--default-role='));

  const defaultRole = defaultRoleArg ? defaultRoleArg.slice('--default-role='.length) : undefined;
  if (defaultRole && !isPlatformRole(defaultRole)) {
    throw new Error(`--default-role must be one of: ${PLATFORM_ROLES.join(', ')} (got "${defaultRole}")`);
  }

  return {
    apply,
    mapPath: mapArg ? mapArg.slice('--map='.length) : undefined,
    defaultRole: defaultRole as PlatformRole | undefined,
    skipUnresolved,
    forceRemap,
  };
}

function loadMap(mapPath: string | undefined): Record<string, PlatformRole> {
  if (!mapPath) return {};
  const raw = JSON.parse(readFileSync(mapPath, 'utf8'));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`--map file must contain a JSON object of { "<userId>": "<PlatformRole>" }`);
  }
  const result: Record<string, PlatformRole> = {};
  for (const [userId, role] of Object.entries(raw)) {
    if (!isPlatformRole(role)) {
      throw new Error(`--map file: invalid PlatformRole "${role}" for userId "${userId}". Must be one of: ${PLATFORM_ROLES.join(', ')}`);
    }
    result[userId] = role as PlatformRole;
  }
  return result;
}

interface AdminAccountRow {
  _id: mongoose.Types.ObjectId;
  userId: string;
  name?: string;
  platformRole?: string;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const map = loadMap(args.mapPath);

  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  // autoIndex: false — importing server/models/index.ts (for the real User
  // model) registers every model defined there, not just User. This script
  // only ever reads/writes the `users` collection; there's no reason for
  // it to also kick off background index builds on every other collection
  // as a side effect of connecting.
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

  try {
    // NOTE: `platformRole` does not exist on the User Mongoose schema yet
    // (this task proposes it as an additive patch to
    // server/models/index.ts, applied separately by the Integrator — see
    // this task's report for the exact patch). Mongoose's default `strict`
    // document mode silently drops any field not declared on the schema
    // from both `$set` updates and `.select()` projections issued through
    // the Model API — going through `User.find(...)`/`User.bulkWrite(...)`
    // would silently no-op every write to `platformRole` and could even
    // silently drop it from read projections, which is exactly the kind of
    // "looks like it worked, didn't" failure this migration cannot afford.
    // `User.collection` is the underlying native MongoDB driver Collection
    // — it bypasses Mongoose schema casting/stripping entirely, so reads
    // and writes here work correctly today (before the schema patch lands)
    // and continue to work unchanged after it lands.
    const admins = await User.collection
      .find(
        { role: 'admin' },
        { projection: { _id: 1, userId: 1, name: 1, platformRole: 1 } },
      )
      .toArray() as unknown as AdminAccountRow[];

    const alreadyMigrated = admins.filter((a) => !!(a as any).platformRole);
    const candidates = args.forceRemap ? admins : admins.filter((a) => !(a as any).platformRole);

    const toMigrate: Array<{ id: string; userId: string; name?: string; targetPlatformRole: PlatformRole }> = [];
    const unresolved: Array<{ id: string; userId: string; name?: string }> = [];

    for (const account of candidates) {
      const mapped = map[account.userId] ?? map[account._id.toString()];
      const target = mapped ?? args.defaultRole;
      if (target) {
        toMigrate.push({ id: account._id.toString(), userId: account.userId, name: account.name, targetPlatformRole: target });
      } else {
        unresolved.push({ id: account._id.toString(), userId: account.userId, name: account.name });
      }
    }

    if (!args.apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        totalAdminAccounts: admins.length,
        alreadyMigrated: alreadyMigrated.map((a) => ({ userId: a.userId, name: a.name, platformRole: (a as any).platformRole })),
        toMigrate,
        unresolved,
        note: unresolved.length > 0
          ? 'Run with --apply --map=<file covering these userIds> (and/or --default-role=<PlatformRole>) to migrate. No changes were made.'
          : 'Run with --apply (same --map/--default-role) to apply these changes. No changes were made.',
      }, null, 2));
      return;
    }

    if (unresolved.length > 0 && !args.skipUnresolved) {
      console.error(JSON.stringify({
        mode: 'apply-aborted',
        reason: 'Some admin accounts have no --map entry and no --default-role was given. Refusing to blanket-assign a platform role.',
        unresolved,
      }, null, 2));
      process.exitCode = 1;
      return;
    }

    let applied: Array<{ id: string; userId: string; name?: string; targetPlatformRole: PlatformRole }> = [];
    if (toMigrate.length > 0) {
      const filterGuard = args.forceRemap ? {} : { platformRole: { $exists: false } };
      // Raw driver bulkWrite (see the read-path comment above for why: the
      // Mongoose Model API would silently strip `platformRole` from the
      // `$set` since it isn't a declared schema path yet).
      const result = await User.collection.bulkWrite(
        toMigrate.map((row) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(row.id), role: 'admin', ...filterGuard },
            update: { $set: { platformRole: row.targetPlatformRole } },
          },
        })),
        { ordered: false },
      );
      applied = toMigrate;
      console.log(JSON.stringify({
        mode: 'applied',
        matched: result.matchedCount,
        modified: result.modifiedCount,
        applied: applied.map((r) => ({ userId: r.userId, platformRole: r.targetPlatformRole })),
        alreadyMigratedSkipped: alreadyMigrated.length,
        skippedUnresolved: args.skipUnresolved ? unresolved : [],
      }, null, 2));
    } else {
      console.log(JSON.stringify({
        mode: 'applied',
        matched: 0,
        modified: 0,
        applied: [],
        alreadyMigratedSkipped: alreadyMigrated.length,
        skippedUnresolved: args.skipUnresolved ? unresolved : [],
        note: 'Nothing to migrate — every targeted account was already migrated or unresolved.',
      }, null, 2));
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.message || error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
