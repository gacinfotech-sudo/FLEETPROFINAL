// TASK-VEHICLE-HANDOVER-05 — dedicated test fixtures for this task's own
// spec files (tests/e2e/vehicle-handover-*.spec.ts). New file, exclusively
// owned by this task (same convention TASK-DRIVER-QA-SECURITY-07 established
// with tests/e2e/helpers/driver-fixtures.ts — a new file alongside the
// shared tests/e2e/helpers.ts, which is NOT edited here).
//
// Why this exists (root-caused during development of this task's
// concurrency suite, not a guess): this sandbox runs many concurrent,
// unrelated Playwright/dev-server processes from OTHER parallel worktrees,
// all pointed at the SAME shared local MongoDB (`mongodb://127.0.0.1:27017/
// fleetpro`) and nearly all of them authenticate as the same shared
// 'qaclient' fixture account. server/routes.ts's login handler is
// deliberately single-session-per-user ("PWA-friendly session management...
// prevent concurrent logins" — it overwrites `User.sessionId` on every
// login). That means ANY concurrent login as 'qaclient' from ANY OTHER
// worktree's test suite invalidates every other qaclient session at any
// moment — observed directly while developing this suite (a session that
// had just made several successful authenticated calls returned "Invalid
// session" a few hundred milliseconds later, with no request of this suite's
// own in between). This is real, correct, pre-existing product behavior
// (single-session-per-account), not a bug — but it makes 'qaclient' the
// wrong fixture for a test that specifically needs several genuinely
// independent, stable concurrent sessions.
//
// The fix: seed a Tenant + several 'client'-role Users EXCLUSIVELY for this
// task (uniquely namespaced, never touched by any other suite), directly via
// mongoose — same direct-DB-seeding precedent TASK-DRIVER-DOMAIN-02's
// ddtest_executive and TASK-DRIVER-QA-SECURITY-07's driver-fixtures.ts both
// already established for this exact "the HTTP API can't provision what I
// need, and the shared fixture is contended" situation. 'client' role
// bypasses every permission check (storage.checkUserPermission's
// admin/client-bypass rule), which is what this suite needs to call
// MANAGE_VEHICLES-gated routes without also fighting over the shared
// tenant's maxManagers cap (already near/at its limit from other tasks'
// fixtures, confirmed live: 11 sub-users existed under qaclient's tenant
// while developing this file).
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Tenant, User, Vehicle, Driver } from '../../../server/models/index';

export const FIXTURE_PASSWORD = 'HandoverQaFixed456!';

export interface HandoverFixtureSession {
  userId: string;
  password: string;
}

export interface HandoverFixtures {
  tenantId: string;
  vehicleId: string;
  driverId: string;
  sessions: HandoverFixtureSession[]; // independent 'client'-role logins, safe to use concurrently
}

/** Idempotent find-or-create — safe to call at the start of every test file
 * in this suite; reruns reuse the same tenant/users/vehicle/driver rather
 * than accumulating garbage (same convention every other driver-lifecycle
 * task's fixtures use). `sessionCount` independent client-role users are
 * created (or reused) so concurrent-request tests never need concurrent
 * logins on the SAME account. */
export async function ensureHandoverFixtures(sessionCount: number): Promise<HandoverFixtures> {
  if (mongoose.connection.readyState === 0) {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
  }

  let tenant = await Tenant.findOne({ name: 'Handover QA Fixture Tenant' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Handover QA Fixture Tenant',
      businessName: 'Handover QA Fixture Tenant Pvt Ltd',
      isActive: true,
      maxManagers: 20,
      subscriptionPlan: 'pro',
      limits: { vehicles: 50, drivers: 50, managers: 20 },
    });
  }
  const tenantId = String(tenant._id);

  const sessions: HandoverFixtureSession[] = [];
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  for (let i = 0; i < sessionCount; i++) {
    const userId = `handoverqa_c${i}`;
    const existing = await User.findOne({ userId });
    if (!existing) {
      await User.create({
        userId,
        name: `Handover QA Fixture Client ${i}`,
        password: passwordHash,
        role: 'client',
        tenantId: tenant._id,
        isActive: true,
        mustResetPassword: false,
        hasCompletedOnboarding: true,
        permissions: [],
        loginAttempts: 0,
        failedLoginAttempts: 0,
        accountLocked: false,
      });
    }
    sessions.push({ userId, password: FIXTURE_PASSWORD });
  }

  let vehicle = await Vehicle.findOne({ tenantId: tenant._id, make: 'Handover QA Fixture Vehicle' });
  if (!vehicle) {
    vehicle = await Vehicle.create({
      tenantId: tenant._id,
      make: 'Handover QA Fixture Vehicle',
      vehicleModel: 'Test Model',
      type: 'sedan',
      status: 'available',
      features: [],
      pricePerDay: 1000,
      pricePerHour: 100,
      pricePerKm: 10,
    });
  }

  let driver = await Driver.findOne({ tenantId: tenant._id, name: 'Handover QA Fixture Driver' });
  if (!driver) {
    driver = await Driver.create({
      tenantId: tenant._id,
      name: 'Handover QA Fixture Driver',
      phone: '9400000099',
      status: 'available',
    });
  }

  return { tenantId, vehicleId: String(vehicle._id), driverId: String(driver._id), sessions };
}
