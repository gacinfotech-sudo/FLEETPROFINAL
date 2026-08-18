// Tests for TASK-ROOT-DASHBOARD-02's cross-tenant Root data-access layer
// (server/root/services/localRootAccessService.ts) — proves this task's
// acceptance criterion:
//
//   "Global Customer Database: a tenant-isolation proof test — searching
//   without a tenant filter returns customers from multiple tenants
//   (that's the point, it's a Root view), but every returned row is
//   clearly labeled with its tenant, and phone/email are masked by
//   default in the response the frontend receives (not just masked in
//   the UI layer — prove the API itself doesn't leak unmasked PII to an
//   unauthorized caller)."
//
// Connects to a REAL, dedicated MongoDB database (never the app's real
// "fleetpro" dev database) so the proof runs against real Mongoose
// queries, not a mock. Requires a local/reachable MongoDB — override with
// TEST_MONGODB_URI if 127.0.0.1:27017 isn't available. Seeds its own two
// tenants + customers + a booking, asserts, then drops every collection
// it touched.
//
//   npx tsx --test server/root/services/tenantIsolation.test.ts

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Tenant, Customer, Booking } from '../../models/index';
import { localRootAccessService } from './localRootAccessService';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_root_dashboard_test';

let tenantAId: string;
let tenantBId: string;

describe('Global Customer Database — tenant-isolation + PII-masking proof', () => {
  before(async () => {
    await mongoose.connect(TEST_URI);
    // Start from a clean slate for exactly the collections this test touches.
    await Promise.all([
      Tenant.deleteMany({ businessName: /^Root Dashboard Test Tenant/ }),
      Customer.deleteMany({ name: /^Root Dashboard Test Customer/ }),
    ]);

    const [tenantA, tenantB] = await Tenant.create([
      { name: 'tenant-a', businessName: 'Root Dashboard Test Tenant A', isActive: true, subscriptionPlan: 'starter' },
      { name: 'tenant-b', businessName: 'Root Dashboard Test Tenant B', isActive: true, subscriptionPlan: 'pro' },
    ]);
    tenantAId = tenantA._id.toString();
    tenantBId = tenantB._id.toString();

    const createdBy = { userId: 'test-seed-user', role: 'admin' };
    await Customer.create([
      {
        tenantId: tenantA._id, name: 'Root Dashboard Test Customer Alice',
        primaryMobile: '919876543210', phoneAliases: [], email: 'alice@gmail.com', emailAliases: [],
        companyAliases: [], gstAliases: [], customerType: 'individual', city: 'Mumbai',
        totalBookings: 1, completedBookings: 1, cancelledBookings: 0, totalSpending: 5000,
        customerStatus: 'new', rewardPointsBalance: 0, loyaltyTier: 'bronze', createdBy,
      },
      {
        tenantId: tenantB._id, name: 'Root Dashboard Test Customer Bob',
        primaryMobile: '919123456789', phoneAliases: [], email: 'bob@gmail.com', emailAliases: [],
        companyAliases: [], gstAliases: [], customerType: 'individual', city: 'Delhi',
        totalBookings: 2, completedBookings: 2, cancelledBookings: 0, totalSpending: 8000,
        customerStatus: 'repeat', rewardPointsBalance: 0, loyaltyTier: 'bronze', createdBy,
      },
    ]);
  });

  after(async () => {
    await Promise.all([
      Tenant.deleteMany({ businessName: /^Root Dashboard Test Tenant/ }),
      Customer.deleteMany({ name: /^Root Dashboard Test Customer/ }),
    ]);
    await mongoose.disconnect();
  });

  test('an unfiltered (no tenantId) search returns customers from MULTIPLE tenants', async () => {
    const { customers } = await localRootAccessService.getCustomerAcrossTenants({
      name: 'Root Dashboard Test Customer', page: 1, pageSize: 50,
    });
    const tenantIdsSeen = new Set(customers.map((c) => c.tenantId));
    assert.ok(tenantIdsSeen.has(tenantAId), 'must include tenant A\'s customer');
    assert.ok(tenantIdsSeen.has(tenantBId), 'must include tenant B\'s customer');
    assert.ok(tenantIdsSeen.size >= 2, 'a Root, cross-tenant view must span more than one tenant');
  });

  test('every returned row is clearly labeled with its own tenant (never blank/ambiguous)', async () => {
    const { customers } = await localRootAccessService.getCustomerAcrossTenants({
      name: 'Root Dashboard Test Customer', page: 1, pageSize: 50,
    });
    for (const c of customers) {
      assert.ok(c.tenantId, `customer ${c.customerId} missing tenantId label`);
      assert.ok(c.tenantName && c.tenantName !== 'Unknown tenant', `customer ${c.customerId} missing a resolved tenant name`);
    }
    const alice = customers.find((c) => c.name.includes('Alice'));
    const bob = customers.find((c) => c.name.includes('Bob'));
    assert.equal(alice?.tenantName, 'Root Dashboard Test Tenant A');
    assert.equal(bob?.tenantName, 'Root Dashboard Test Tenant B');
  });

  test('a tenantId filter scopes results to exactly that tenant (no cross-tenant leak the other way)', async () => {
    const { customers } = await localRootAccessService.getCustomerAcrossTenants({
      tenantId: tenantAId, page: 1, pageSize: 50,
    });
    assert.ok(customers.length > 0, 'expected at least the seeded tenant-A customer');
    for (const c of customers) {
      assert.equal(c.tenantId, tenantAId);
    }
  });

  test('the API response itself never contains a raw, unmasked phone or email (not just UI-layer masking)', async () => {
    const { customers } = await localRootAccessService.getCustomerAcrossTenants({
      name: 'Root Dashboard Test Customer', page: 1, pageSize: 50,
    });
    const rawJson = JSON.stringify(customers);
    assert.ok(!rawJson.includes('9876543210'), 'raw phone digits must never appear in the response');
    assert.ok(!rawJson.includes('9123456789'), 'raw phone digits must never appear in the response');
    assert.ok(!rawJson.includes('alice@gmail.com'), 'raw email must never appear in the response');
    assert.ok(!rawJson.includes('bob@gmail.com'), 'raw email must never appear in the response');

    for (const c of customers) {
      // INTEGRATION NOTE (merge of integration/root-control-plane-wave1):
      // this used to assert the exact `98765XXXXX` shape produced by this
      // task's own now-replaced masking placeholder. The real, canonical
      // TASK-ROOT-SECURITY-05 `piiMaskingService.ts` masks the trailing 5
      // digit characters in place without stripping any country-code
      // prefix (so a seeded "91"-prefixed number masks to
      // "9198765XXXXX", not "98765XXXXX") — same security property (last 5
      // digits never visible), different cosmetic shape. See
      // tests/e2e/root-security-pii-masking.spec.ts for that algorithm's
      // own authoritative shape coverage.
      assert.match(c.maskedPhone, /X{5}$/, `maskedPhone "${c.maskedPhone}" must end with 5 masked digits`);
      assert.doesNotMatch(c.maskedPhone, /^\d+$/, `maskedPhone "${c.maskedPhone}" must not be all-digits (i.e. must actually be masked)`);
      if (c.maskedEmail) {
        assert.match(c.maskedEmail, /^.{1,2}\*\*\*@/, `maskedEmail "${c.maskedEmail}" must match the documented ra***@... shape`);
      }
    }
  });

  test('listTenants also spans multiple tenants (Tenant Master Database is cross-tenant by design)', async () => {
    const { tenants, total } = await localRootAccessService.listTenants({ search: 'Root Dashboard Test Tenant', page: 1, pageSize: 50 });
    assert.ok(total >= 2);
    const ids = tenants.map((t) => t.tenantId);
    assert.ok(ids.includes(tenantAId));
    assert.ok(ids.includes(tenantBId));
  });
});
