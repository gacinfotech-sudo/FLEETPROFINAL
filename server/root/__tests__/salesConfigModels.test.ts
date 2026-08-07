// TASK-ROOT-SALES-CONFIG-04 — model/service-level integration tests.
//
// Run with: MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro_test_sales_config \
//   npx tsx server/root/__tests__/salesConfigModels.test.ts
//
// No test runner (vitest/jest) is configured in this repo (package.json's
// only scripts are dev/build/start/check) — this is a plain Node script
// using assert + mongoose against a real local MongoDB, following the same
// "connect, exercise real models, assert, exit non-zero on failure" shape
// as this task's other test files. Requires a MongoDB reachable at
// MONGODB_URI (a local `mongod` on 127.0.0.1:27017 was confirmed running in
// this environment). Uses a dedicated, disposable database name so it never
// touches real dev data, and drops that database at the end.

import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_test_sales_config';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(error);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  // Start from a clean slate every run.
  await mongoose.connection.dropDatabase();

  const { Tenant } = await import('../../models');
  const { storage } = await import('../../storage-mongodb');
  const { mongoTenantSchema } = await import('../../schemas/mongodb-schemas');
  const { Prospect, isValidStageTransition, PROSPECT_STAGES } = await import('../models/prospect');
  const { Plan, ensureDefaultPlansSeeded, resolvePlanLimit, resolvePlanForTenant } = await import('../models/plan');
  const { FeatureFlag, resolveFeatureState, resolveEntitlement } = await import('../models/featureFlag');
  const { recordAuditEvent, PlaceholderAuditEvent } = await import('../routes/_localPlatformAccess');
  const { GpsConnection } = await import('../../gps/models/gpsConnection');

  console.log('--- Prospect pipeline transition rules ---');
  await test('forward transitions in order are valid', async () => {
    assert.equal(isValidStageTransition('PROSPECT', 'DEMO_SCHEDULED'), true);
    assert.equal(isValidStageTransition('DEMO_SCHEDULED', 'TRIAL_CREATED'), true);
    assert.equal(isValidStageTransition('NEGOTIATION', 'WON'), true);
    assert.equal(isValidStageTransition('WON', 'TENANT_CREATED'), true);
    assert.equal(isValidStageTransition('ONBOARDING', 'LIVE'), true);
  });
  await test('skipping stages forward is rejected', async () => {
    assert.equal(isValidStageTransition('PROSPECT', 'NEGOTIATION'), false);
    assert.equal(isValidStageTransition('PROSPECT', 'WON'), false);
  });
  await test('LOST is reachable from any pre-tenant stage, not after', async () => {
    assert.equal(isValidStageTransition('PROSPECT', 'LOST'), true);
    assert.equal(isValidStageTransition('NEGOTIATION', 'LOST'), true);
    assert.equal(isValidStageTransition('WON', 'LOST'), true);
    assert.equal(isValidStageTransition('TENANT_CREATED', 'LOST'), false);
    assert.equal(isValidStageTransition('LIVE', 'LOST'), false);
  });
  await test('LOST is terminal', async () => {
    assert.equal(isValidStageTransition('LOST', 'PROSPECT'), false);
  });
  await test('every declared pipeline stage is reachable via forward transitions from PROSPECT', async () => {
    const order = ['PROSPECT', 'DEMO_SCHEDULED', 'TRIAL_CREATED', 'TRIAL_ACTIVE', 'NEGOTIATION', 'WON', 'TENANT_CREATED', 'ONBOARDING', 'LIVE'] as const;
    for (let i = 1; i < order.length; i++) {
      assert.equal(isValidStageTransition(order[i - 1], order[i]), true, `${order[i - 1]} -> ${order[i]}`);
    }
    assert.deepEqual([...PROSPECT_STAGES].sort(), [...order, 'LOST'].sort());
  });

  console.log('--- End-to-end: prospect -> WON -> Create Tenant (reusing existing tenant-creation logic) ---');
  await test('a prospect walked through every stage to WON, then create-tenant produces a real Tenant via storage.createTenant', async () => {
    const prospect = await Prospect.create({
      companyName: 'Acme Logistics',
      contactName: 'Jordan Rivera',
      contactEmail: 'jordan@acmelogistics.example',
      stage: 'PROSPECT',
      stageHistory: [{ stage: 'PROSPECT', changedAt: new Date(), changedBy: 'sales-rep-1' }],
      createdBy: 'sales-rep-1',
    });

    const order = ['DEMO_SCHEDULED', 'TRIAL_CREATED', 'TRIAL_ACTIVE', 'NEGOTIATION', 'WON'] as const;
    let current = prospect.stage;
    for (const next of order) {
      assert.equal(isValidStageTransition(current, next), true);
      prospect.stage = next;
      prospect.stageHistory.push({ stage: next, changedAt: new Date(), changedBy: 'sales-rep-1' });
      current = next;
    }
    await prospect.save();
    assert.equal(prospect.stage, 'WON');
    assert.equal(prospect.stageHistory.length, order.length + 1);

    // This is the exact call sales.ts's create-tenant route makes — the
    // same storage.createTenant() function POST /api/admin/tenants calls,
    // through the same mongoTenantSchema validation. No second
    // implementation of "how a tenant gets created."
    const tenantData = mongoTenantSchema.parse({
      name: prospect.companyName,
      businessName: prospect.companyName,
      email: prospect.contactEmail,
    });
    const tenant = await storage.createTenant(tenantData);
    assert.ok(tenant._id);
    assert.equal(tenant.businessName, 'Acme Logistics');

    prospect.tenantId = tenant._id as any;
    prospect.tenantCreatedAt = new Date();
    prospect.stage = 'TENANT_CREATED';
    prospect.stageHistory.push({ stage: 'TENANT_CREATED', changedAt: new Date(), changedBy: 'sales-rep-1' });
    await prospect.save();

    const reloaded = await Prospect.findById(prospect._id);
    assert.equal(reloaded!.stage, 'TENANT_CREATED');
    assert.equal(String(reloaded!.tenantId), String(tenant._id));

    const tenantInDb = await Tenant.findById(tenant._id);
    assert.ok(tenantInDb, 'the tenant created via the reused storage.createTenant() logic actually persisted');
  });

  console.log('--- Plan entitlements: resolveEntitlement across 2+ plans with different limits ---');
  await test('a starter-plan tenant and a pro-plan tenant resolve different maxVehicles/maxDrivers', async () => {
    await ensureDefaultPlansSeeded();

    const starterTenant = await storage.createTenant(mongoTenantSchema.parse({
      name: 'Starter Co', businessName: 'Starter Co', subscriptionPlan: 'starter',
    }));
    const proTenant = await storage.createTenant(mongoTenantSchema.parse({
      name: 'Pro Co', businessName: 'Pro Co', subscriptionPlan: 'pro',
    }));

    const starterVehicles = await resolveEntitlement(String(starterTenant._id), 'maxVehicles');
    const proVehicles = await resolveEntitlement(String(proTenant._id), 'maxVehicles');
    const starterDrivers = await resolvePlanLimit(String(starterTenant._id), 'maxDrivers');
    const proDrivers = await resolvePlanLimit(String(proTenant._id), 'maxDrivers');

    assert.equal(starterVehicles, 6, 'STARTER plan default maxVehicles');
    assert.equal(proVehicles, 25, 'PROFESSIONAL plan default maxVehicles');
    assert.notEqual(starterVehicles, proVehicles);
    assert.equal(starterDrivers, 3);
    assert.equal(proDrivers, 15);
    assert.notEqual(starterDrivers, proDrivers);

    const { plan: starterPlan } = await resolvePlanForTenant(String(starterTenant._id));
    const { plan: proPlan } = await resolvePlanForTenant(String(proTenant._id));
    assert.equal(starterPlan?.code, 'STARTER');
    assert.equal(proPlan?.code, 'PROFESSIONAL');
  });

  await test('a tenant whose legacy plan has no matching Plan document falls back to Tenant.limits unchanged', async () => {
    // Remove only the STARTER default (the plan 'starter'-subscription
    // tenants resolve to) while leaving the rest of the catalog in place —
    // deleting *every* Plan would trigger ensureDefaultPlansSeeded's
    // "catalog is empty, reseed" path (by design: real deploys never want
    // entitlement resolution stuck on a truly empty catalog), which would
    // silently defeat this specific test's premise of "no match found."
    const legacyTenant = await storage.createTenant(mongoTenantSchema.parse({
      name: 'Legacy Co', businessName: 'Legacy Co', subscriptionPlan: 'starter',
      limits: { vehicles: 9, drivers: 4, managers: 2 },
    }));
    const removedStarterPlan = await Plan.findOneAndDelete({ code: 'STARTER' });
    assert.ok(removedStarterPlan, 'precondition: a STARTER plan existed to remove');
    assert.ok(await Plan.countDocuments({}) > 0, 'precondition: catalog is not empty (so auto-reseed does not trigger)');

    const vehicles = await resolvePlanLimit(String(legacyTenant._id), 'maxVehicles');
    assert.equal(vehicles, 9, 'falls back to the tenant\'s own existing Tenant.limits.vehicles, untouched');

    // Restore for subsequent tests.
    await Plan.create(removedStarterPlan!.toObject());
  });

  console.log('--- Tenant Feature Flags: audit event + data preservation ---');
  await test('disabling a feature flag records an audit event and does not touch the module\'s own data', async () => {
    // 'pro' -> PROFESSIONAL plan, whose seeded default has gps_tracking:
    // true (ENABLED) — deliberately not 'starter', so this test's
    // before/after states differ regardless of what earlier tests already
    // did to the Plan catalog (STARTER intentionally defaults gps_tracking
    // to false).
    const tenant = await storage.createTenant(mongoTenantSchema.parse({ name: 'GPS Tenant', businessName: 'GPS Tenant', subscriptionPlan: 'pro' }));

    const connection = await GpsConnection.create({
      tenantId: tenant._id,
      connectionName: 'Primary GPS',
      providerKey: 'traccar',
      authenticationType: 'api_key',
      createdBy: 'platform-op-1',
      updatedBy: 'platform-op-1',
    });

    // Sanity: no explicit per-tenant flag yet, so this resolves to the
    // PROFESSIONAL plan's default for gps_tracking (ENABLED).
    const beforeState = await resolveFeatureState(String(tenant._id), 'gps_tracking');
    assert.equal(beforeState, 'ENABLED');

    const auditCountBefore = await PlaceholderAuditEvent.countDocuments({ tenantId: String(tenant._id) });

    // Disable it, exactly as features.ts's PATCH route does.
    await FeatureFlag.findOneAndUpdate(
      { tenantId: tenant._id, feature: 'gps_tracking' },
      { $set: { state: 'DISABLED', updatedBy: 'platform-op-1', reason: 'customer requested pause' } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await recordAuditEvent({
      actorUserId: 'platform-op-1',
      action: 'features.flag.updated',
      tenantId: String(tenant._id),
      targetType: 'FeatureFlag',
      targetId: 'gps_tracking',
      oldValue: { feature: 'gps_tracking', state: beforeState },
      newValue: { feature: 'gps_tracking', state: 'DISABLED' },
      reason: 'customer requested pause',
    });

    const afterState = await resolveFeatureState(String(tenant._id), 'gps_tracking');
    assert.equal(afterState, 'DISABLED');

    const auditCountAfter = await PlaceholderAuditEvent.countDocuments({ tenantId: String(tenant._id) });
    assert.equal(auditCountAfter, auditCountBefore + 1, 'exactly one new audit event was recorded for this change');

    const lastEvent = await PlaceholderAuditEvent.findOne({ tenantId: String(tenant._id) }).sort({ createdAt: -1 });
    assert.equal(lastEvent!.action, 'features.flag.updated');
    assert.deepEqual(lastEvent!.newValue, { feature: 'gps_tracking', state: 'DISABLED' });

    // The critical proof: the GPS module's own data is completely
    // untouched — same document, same fields, still exists.
    const connectionAfter = await GpsConnection.findById(connection._id);
    assert.ok(connectionAfter, 'the GpsConnection document was NOT deleted when its feature flag was disabled');
    assert.equal(connectionAfter!.connectionName, 'Primary GPS');
    assert.equal(connectionAfter!.providerKey, 'traccar');
    assert.equal(String(connectionAfter!.tenantId), String(tenant._id));

    const totalConnectionsForTenant = await GpsConnection.countDocuments({ tenantId: tenant._id });
    assert.equal(totalConnectionsForTenant, 1, 'no GPS documents were removed as a side effect of disabling the flag');
  });

  await test('a per-tenant FeatureFlag override wins over the Plan default', async () => {
    await ensureDefaultPlansSeeded();
    const tenant = await storage.createTenant(mongoTenantSchema.parse({ name: 'Override Co', businessName: 'Override Co', subscriptionPlan: 'starter' }));
    // STARTER plan defaults gps_tracking to false (DISABLED).
    const defaultState = await resolveFeatureState(String(tenant._id), 'gps_tracking');
    assert.equal(defaultState, 'DISABLED');

    await FeatureFlag.findOneAndUpdate(
      { tenantId: tenant._id, feature: 'gps_tracking' },
      { $set: { state: 'BETA', updatedBy: 'platform-op-1' } },
      { upsert: true },
    );
    const overriddenState = await resolveFeatureState(String(tenant._id), 'gps_tracking');
    assert.equal(overriddenState, 'BETA', 'explicit tenant override beats the plan default');
  });

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
