// TASK-DRIVER-QA-SECURITY-07 — Wave 1 foundations.
//
// Reusable test-pattern helpers for driver-lifecycle privacy/tenant-isolation/
// OAuth-security testing. Owned exclusively by this task (per
// DRIVER-LIFECYCLE-MANIFEST.md's file ownership matrix: "tests/** (task-specific) |
// matching task; cross-cutting | TASK-DRIVER-QA-SECURITY-07"). Does not modify
// tests/e2e/helpers.ts (shared with other concurrent driver QA work) — this is a
// new, separate file that other driver-*.spec.ts files may import from once Wave 2
// tasks land.
//
// ---------------------------------------------------------------------------
// Isolated test database
// ---------------------------------------------------------------------------
// This worktree's own .env points MONGODB_URI at a database name that is NOT
// the shared dev `fleetpro` database every other concurrent worktree this
// session has been contending over (see DRIVER-LIFECYCLE-MANIFEST.md "Current
// risks" #1 and the parallel booking-initiative port/DB collisions already
// logged this session). Both this worktree's dev server (server/index.ts,
// started with this same .env) and these fixtures — which open their own
// direct mongoose connection, since the Playwright test runner is a separate
// Node process from the server — talk to that same isolated database. See
// driver-qa-foundations.spec.ts's "isolated database is genuinely separate"
// test for the actual proof (creates a marker document, confirms it is
// absent from the real shared dev DB).
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import type { APIRequestContext, Page } from '@playwright/test';

dotenv.config();

// Read-only imports of the real, existing schema/model definitions — mirrors
// the exact same pattern already used by tests/e2e/gps-connection-security.spec.ts
// (`import { GpsConnection } from '../../server/gps/models/gpsConnection'`).
// No production code under server/** is modified by this task.
import { Tenant, User, Driver } from '../../../server/models/index';
import { PERMISSIONS } from '../../../server/middleware/permissions';

export const ISOLATED_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_test_driver_qa_security_07';

// The real shared dev database every other concurrent worktree this session
// writes against — used ONLY by the isolation-proof test, to assert data
// created through this task's fixtures/isolated server is genuinely absent
// from it. Never written to.
export const SHARED_DEV_MONGODB_URI =
  process.env.SHARED_DEV_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro';

if (/\/fleetpro$/.test(ISOLATED_MONGODB_URI.split('?')[0])) {
  throw new Error(
    `driver-fixtures.ts: MONGODB_URI (${ISOLATED_MONGODB_URI}) resolves to the shared dev ` +
    `'fleetpro' database. This task requires a genuinely separate database name — see ` +
    `TASK-DRIVER-QA-SECURITY-07's Wave 1 objective. Fix this worktree's .env.`
  );
}

/** Ensures the default mongoose connection (used by imported models above) is
 * pointed at the isolated DB. Safe to call multiple times. */
export async function ensureIsolatedDbConnection(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(ISOLATED_MONGODB_URI);
  }
}

/** Opens a SEPARATE connection to the shared dev database, independent of
 * the default mongoose connection used for fixtures/isolated data above. Only
 * ever used for the negative-assertion isolation-proof test. */
export async function connectToSharedDevDb(): Promise<mongoose.Connection> {
  const conn = mongoose.createConnection(SHARED_DEV_MONGODB_URI);
  await conn.asPromise();
  return conn;
}

// ---------------------------------------------------------------------------
// Role/persona fixtures
// ---------------------------------------------------------------------------
// Mirrors the REAL role/permission shape in server/middleware/permissions.ts
// and server/models/index.ts's IUser — does not invent new User.role values.
// The actual schema only has role: 'admin' | 'client' | 'manager'; 'admin' is
// FleetPro's own cross-tenant superadmin (not a tenant-side persona and not
// one of the five this initiative's privacy model depends on). The five
// business personas the manifest's data/privacy risks are written against
// are built as:
//   - Owner/HR   -> role 'client' (the tenant owner; bypasses all
//                   requirePermission checks per storage-mongodb.ts's
//                   checkUserPermission, same as every other tenant-owner
//                   fixture already in this suite, e.g. 'qaclient').
//   - Manager    -> role 'manager' with a broad permission set including
//                   MANAGE_DRIVERS and the forward-looking, not-yet-defined
//                   'driver_contacts.view_full' string (DRIVER-LIFECYCLE-SPEC.md
//                   §2 names this as a new manager-tier permission constant,
//                   'DRIVER_CONTACTS_VIEW_FULL', proposed but not yet added
//                   to PERMISSIONS by any Wave-2 task at the time this file
//                   was written — the raw string is used here so Wave 3 can
//                   assert against it once it exists, without this fixture
//                   file needing to change).
//   - Accounts   -> role 'manager' with finance-only permissions, explicitly
//                   WITHOUT MANAGE_DRIVERS or driver-contact access.
//   - Executive  -> role 'manager' with a minimal permission set, explicitly
//                   WITHOUT MANAGE_DRIVERS or driver-contact access — mirrors
//                   DRIVER-DATA-MINIMIZATION-MATRIX.md's "Executive-role
//                   access to full contact list: PROHIBITED_OR_EXCESSIVE".
//   - driver-portal session -> NOT a User at all. A Driver document with a
//                   bcrypt-hashed loginPin, authenticated via the separate
//                   phone+PIN authenticateDriver mechanism
//                   (server/middleware/driverAuth.ts) — per that file's own
//                   comment, a driver is deliberately never a User.role value.
//
// The manager-tier permission string anticipated for DRIVER_CONTACTS_VIEW_FULL.
// Kept here (not in PERMISSIONS, which this task does not own/modify) so
// every fixture and future test references the same literal.
export const DRIVER_CONTACTS_VIEW_FULL_PERMISSION = 'driver_contacts.view_full';

export type StaffPersona = 'owner_hr' | 'manager' | 'accounts' | 'executive';

const PERSONA_ROLE: Record<StaffPersona, 'client' | 'manager'> = {
  owner_hr: 'client',
  manager: 'manager',
  accounts: 'manager',
  executive: 'manager',
};

const PERSONA_PERMISSIONS: Record<StaffPersona, string[]> = {
  owner_hr: [], // role 'client' bypasses requirePermission entirely — irrelevant.
  manager: [
    PERMISSIONS.MANAGE_DRIVERS,
    PERMISSIONS.VIEW_BOOKINGS,
    PERMISSIONS.CREATE_BOOKING,
    PERMISSIONS.EDIT_BOOKING,
    DRIVER_CONTACTS_VIEW_FULL_PERMISSION,
  ],
  accounts: [
    PERMISSIONS.VIEW_REVENUE,
    PERMISSIONS.GENERATE_INVOICE,
    PERMISSIONS.MANAGE_INVOICE_SETTINGS,
  ],
  executive: [
    PERMISSIONS.VIEW_BOOKINGS,
  ],
};

export interface SeededTenant {
  tenantId: string;
  name: string;
}

export interface SeededStaffUser {
  tenantId: string;
  userId: string;
  password: string;
  role: 'client' | 'manager';
  persona: StaffPersona;
}

export interface SeededDriverPortalSession {
  tenantId: string;
  driverId: string;
  name: string;
  phone: string;
  pin: string;
}

const RUN_MARKER = process.env.QA_SECURITY_07_RUN_MARKER || String(Date.now());

/** Creates a new isolated tenant directly in the isolated DB (no public
 * tenant-signup HTTP endpoint exists in this codebase — accounts are
 * provisioned out-of-band, same as every other seeded test tenant/user in
 * this suite, e.g. 'qaclient'). */
export async function seedTenant(label: string): Promise<SeededTenant> {
  await ensureIsolatedDbConnection();
  const name = `QA-Security-07 ${label} ${RUN_MARKER}`;
  const tenant = await Tenant.create({
    name,
    businessName: name,
    isActive: true,
    subscriptionPlan: 'pro',
    limits: { vehicles: 50, drivers: 50, managers: 20 },
  });
  return { tenantId: (tenant._id as mongoose.Types.ObjectId).toString(), name };
}

/** Seeds one of the four staff personas for a given tenant. Password hashing
 * (bcrypt, cost 12) matches storage-mongodb.ts's createUser exactly — there
 * is no pre-save hook on UserSchema, so this must be done explicitly here to
 * produce a hash the real /api/auth/login route (storage.getUserByCredentials)
 * can verify. */
export async function seedStaffUser(
  tenantId: string,
  persona: StaffPersona,
  label = persona
): Promise<SeededStaffUser> {
  await ensureIsolatedDbConnection();
  const userId = `qa07_${persona}_${RUN_MARKER}_${label}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const password = 'QaSecurity07!Fx';
  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({
    userId,
    name: `QA Security 07 ${persona}`,
    password: passwordHash,
    role: PERSONA_ROLE[persona],
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    mustResetPassword: false,
    hasCompletedOnboarding: true,
    permissions: PERSONA_PERMISSIONS[persona],
  });
  return { tenantId, userId, password, role: PERSONA_ROLE[persona], persona };
}

/** Seeds a Driver with a bcrypt-hashed loginPin so it can authenticate
 * through the real POST /api/driver-auth/login phone+PIN flow — never a
 * User, per driverAuth.ts's design. */
export async function seedDriverWithPortalAccess(
  tenantId: string,
  label = 'primary'
): Promise<SeededDriverPortalSession> {
  await ensureIsolatedDbConnection();
  const pin = '7391';
  const pinHash = await bcrypt.hash(pin, 10);
  // 10-digit Indian mobile pattern, unique per run/label so parallel runs of
  // this spec never collide on phone (findOne-by-phone-suffix in the login
  // route matches on last 10 digits).
  const suffix = (Date.now() % 100000000).toString().padStart(8, '0');
  const phone = `9${suffix}${label.length}${RUN_MARKER.slice(-1)}`.slice(0, 10);
  const driver = await Driver.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: `QA Security 07 Driver ${label} ${RUN_MARKER}`,
    phone,
    status: 'available',
    loginPin: pinHash,
    loginPinSetAt: new Date(),
  });
  return {
    tenantId,
    driverId: (driver._id as mongoose.Types.ObjectId).toString(),
    name: driver.name,
    phone,
    pin,
  };
}

// ---------------------------------------------------------------------------
// HTTP login helpers (API-only — no UI dashboard interaction needed for
// privacy/security assertions, only a valid session cookie)
// ---------------------------------------------------------------------------
export async function getCsrfToken(request: APIRequestContext | Page['request']): Promise<string> {
  const res = await request.get('/api/csrf-token');
  const { csrfToken } = await res.json();
  return csrfToken;
}

/** Logs in a seeded staff user via the real POST /api/auth/login route.
 * Returns the CSRF token to use for subsequent mutating requests in the same
 * context. Throws if login fails (surfaces a fixture bug immediately). */
export async function loginAsStaff(
  request: APIRequestContext | Page['request'],
  userId: string,
  password: string
): Promise<string> {
  const csrf = await getCsrfToken(request);
  const res = await request.post('/api/auth/login', {
    headers: { 'X-CSRF-Token': csrf },
    data: { userId, password },
  });
  if (!res.ok()) {
    throw new Error(`loginAsStaff(${userId}) failed: ${res.status()} ${await res.text()}`);
  }
  return getCsrfToken(request);
}

/** Logs in a seeded driver via the real POST /api/driver-auth/login
 * phone+PIN route. */
export async function loginAsDriver(
  request: APIRequestContext | Page['request'],
  phone: string,
  pin: string
): Promise<string> {
  const csrf = await getCsrfToken(request);
  const res = await request.post('/api/driver-auth/login', {
    headers: { 'X-CSRF-Token': csrf },
    data: { phone, pin },
  });
  if (!res.ok()) {
    throw new Error(`loginAsDriver(${phone}) failed: ${res.status()} ${await res.text()}`);
  }
  return getCsrfToken(request);
}

/** Full cross-tenant fixture set: a second, wholly independent tenant + Owner
 * user ("Tenant B"), for tenant-isolation assertions (a Tenant-A session must
 * never read/write Tenant-B's drivers/contacts/documents). */
export async function seedTenantB(): Promise<{ tenant: SeededTenant; owner: SeededStaffUser }> {
  const tenant = await seedTenant('TenantB');
  const owner = await seedStaffUser(tenant.tenantId, 'owner_hr', 'tenantB');
  return { tenant, owner };
}
