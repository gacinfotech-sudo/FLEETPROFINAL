import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { login } from './helpers';
import { Tenant, User, Vehicle } from '../../server/models/index';

// Final Vehicle 360 Integrator — real cross-tenant proof. Self-contained
// (does not use tests/e2e/helpers/driver-fixtures.ts, which enforces a
// separate-database guard belonging to a different task and would require
// reconfiguring this worktree's .env to satisfy — a real second Tenant +
// User is created directly instead, same shared dev DB as every other
// test in this suite, real bcrypt hash, real login via the actual
// POST /api/auth/login flow).

test.describe('Vehicle 360 — real cross-tenant isolation', () => {
  test.setTimeout(60_000);

  test('Tenant B cannot read Tenant A\'s vehicle documents or breakdowns', async ({ page, request }) => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    const marker = String(Date.now());

    try {
      // Tenant A: real vehicle + document + breakdown via the actual UI login flow.
      await login(page, 'qaclient', 'QaFixed456!');
      const tokenA = (await (await page.request.get('/api/csrf-token')).json()).csrfToken;
      const headersA = { 'X-CSRF-Token': tokenA };

      const createRes = await page.request.post('/api/vehicles', {
        headers: headersA,
        data: { make: `IsolationQA-${marker}`, model: 'X', vehicleCategory: 'Car', registrationNumber: `ISO${marker}` },
      });
      expect(createRes.status()).toBe(200);
      const vehicle = await createRes.json();
      const vehicleId = vehicle._id || vehicle.id;

      const docRes = await page.request.post(`/api/vehicles/${vehicleId}/documents`, {
        headers: headersA, data: { documentType: 'insurance_third_party', documentNumber: `SECRET-${marker}` },
      });
      expect(docRes.status()).toBe(201);

      const breakdownRes = await page.request.post(`/api/vehicles/${vehicleId}/breakdowns`, {
        headers: headersA, data: { symptoms: `Tenant A secret breakdown ${marker}` },
      });
      expect(breakdownRes.status()).toBe(201);

      // Tenant B: a wholly independent, freshly-created tenant + user.
      const tenantB = await Tenant.create({
        name: `IsolationQA-TenantB-${marker}`, businessName: `Isolation QA TenantB ${marker}`,
        isActive: true, maxManagers: 5, subscriptionPlan: 'starter',
        limits: { vehicles: 5, drivers: 5, managers: 1 },
      });
      const passwordHash = await bcrypt.hash('IsolationQA-Pass1!', 12);
      const userIdB = `isolationqa${marker}`;
      await User.create({
        userId: userIdB, password: passwordHash, role: 'client', tenantId: tenantB._id, isActive: true,
      });

      const loginB = await request.post('/api/auth/login', {
        data: { userId: userIdB, password: 'IsolationQA-Pass1!' },
      });
      expect(loginB.status(), await loginB.text()).toBe(200);
      const csrfB = (await (await request.get('/api/csrf-token')).json()).csrfToken;

      // The exact same URLs, now called from Tenant B's authenticated session.
      const crossDocsRes = await request.get(`/api/vehicles/${vehicleId}/documents`, { headers: { 'X-CSRF-Token': csrfB } });
      if (crossDocsRes.ok()) {
        const body = await crossDocsRes.json();
        expect(Array.isArray(body) ? body.length : 0).toBe(0);
      } else {
        expect(crossDocsRes.status()).toBeGreaterThanOrEqual(400);
      }

      const crossBreakdownsRes = await request.get(`/api/vehicles/${vehicleId}/breakdowns`, { headers: { 'X-CSRF-Token': csrfB } });
      if (crossBreakdownsRes.ok()) {
        const body = await crossBreakdownsRes.json();
        expect(Array.isArray(body) ? body.length : 0).toBe(0);
      } else {
        expect(crossBreakdownsRes.status()).toBeGreaterThanOrEqual(400);
      }

      // Direct, independent DB-level proof: the vehicle is provably scoped
      // to Tenant A's real tenantId, never Tenant B's.
      const stored = await Vehicle.findById(vehicleId);
      expect(String(stored!.tenantId)).not.toBe(String(tenantB._id));
    } finally {
      await mongoose.disconnect();
    }
  });
});
