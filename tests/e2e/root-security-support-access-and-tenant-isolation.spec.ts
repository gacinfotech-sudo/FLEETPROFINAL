// TASK-ROOT-SECURITY-05 — Support Access mode + the tenant-isolation proof
// for this task's own /api/root/** surface.
//
// Exercises the REAL `securityRouter`/`auditRouter` objects (see
// tests/e2e/helpers/root-security-route-harness.ts) so this proves the
// actual production route wiring, not a reimplementation of it.

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { securityRouter } from '../../server/root/routes/security';
import { auditRouter } from '../../server/root/routes/audit';
import { PlatformAuditEventModel } from '../../server/root/models/auditLog';
import { invokeRoute, createFakeSession } from './helpers/root-security-route-harness';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for this verification.');
  return process.env.MONGODB_URI;
}

// A tenant-scoped user: authenticated (req.user exists), but with no
// `platformRole` — exactly what every real non-platform-staff account looks
// like today, and after the proposed Option A migration (see this task's
// report).
function tenantScopedReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'tenant-user-1', role: 'client' },
    userId: 'tenant-user-1',
    session: createFakeSession(),
    ...overrides,
  };
}

function platformStaffReq(platformRole: string, overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: 'root-staff-1', role: 'admin', platformRole },
    userId: 'root-staff-1',
    session: createFakeSession(),
    ...overrides,
  };
}

test.describe('Tenant isolation on /api/root/** (TASK-ROOT-SECURITY-05)', () => {
  test.setTimeout(30_000);

  test('a tenant-scoped session (no platformRole) gets 403 from every route this task owns', async () => {
    const req = tenantScopedReq();

    const attempts: Array<[string, string]> = [
      ['post', '/tenants/tenant-abc/support-access'],
      ['post', '/tenants/tenant-abc/support-access/exit'],
      ['get', '/support-access/status'],
      ['post', '/break-glass'],
      ['post', '/break-glass/some-id/revoke'],
      ['get', '/security/events'],
    ];

    for (const [method, path] of attempts) {
      const res = await invokeRoute(securityRouter, method, path, { ...req, body: {} });
      expect(res.statusCode, `${method.toUpperCase()} ${path} should 403 for a tenant-scoped session`).toBe(403);
    }

    const auditAttempts: Array<[string, string]> = [
      ['get', '/audit'],
      ['post', '/customers/some-customer-id/unmask'],
    ];
    for (const [method, path] of auditAttempts) {
      const res = await invokeRoute(auditRouter, method, path, { ...req, body: {} });
      expect(res.statusCode, `${method.toUpperCase()} ${path} should 403 for a tenant-scoped session`).toBe(403);
    }
  });

  test('a platform-staff session with an allowed platformRole is NOT blocked by the role gate', async () => {
    const req = platformStaffReq('PLATFORM_SUPPORT_ADMIN');
    const res = await invokeRoute(securityRouter, 'get', '/support-access/status', req);
    // Must get past the 403 gate — 200 with {active:false} is the expected
    // "no active session yet" shape, proving the gate distinguishes roles
    // correctly rather than blocking everyone.
    expect(res.statusCode).toBe(200);
    expect((res.body as any).active).toBe(false);
  });
});

test.describe('Support Access mode (TASK-ROOT-SECURITY-05)', () => {
  test.setTimeout(30_000);

  test('entering produces exactly one audit event, the banner state is derivable from GET status, and exiting audits + clears state', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const req = platformStaffReq('PLATFORM_SUPPORT_ADMIN', { user: { userId: `support-tester-${Date.now()}`, role: 'admin', platformRole: 'PLATFORM_SUPPORT_ADMIN' } });
      const actorUserId = (req.user as any).userId;

      // Not active before entering.
      const statusBefore = await invokeRoute(securityRouter, 'get', '/support-access/status', req);
      expect((statusBefore.body as any).active).toBe(false);

      const enterRes = await invokeRoute(securityRouter, 'post', `/tenants/${tenantId}/support-access`, {
        ...req,
        body: { reason: 'Customer requested help via ticket', ticketReference: 'TICKET-1' },
      });
      expect(enterRes.statusCode).toBe(200);
      expect((enterRes.body as any).active).toBe(true);
      expect((enterRes.body as any).tenantId).toBe(tenantId);
      expect((enterRes.body as any).actorUserId).toBe(actorUserId);
      expect((enterRes.body as any).readOnly).toBe(true);

      // Banner state derivable purely from the API, using the same session.
      const statusAfterEnter = await invokeRoute(securityRouter, 'get', '/support-access/status', req);
      expect((statusAfterEnter.body as any).active).toBe(true);
      expect((statusAfterEnter.body as any).tenantId).toBe(tenantId);

      const enterEvents = await PlatformAuditEventModel.find({ userId: actorUserId, action: 'support_access.enter' }).lean();
      expect(enterEvents.length).toBe(1);
      expect(enterEvents[0].targetTenantId?.toString()).toBe(tenantId);
      expect(enterEvents[0].reason).toBe('Customer requested help via ticket');

      const exitRes = await invokeRoute(securityRouter, 'post', `/tenants/${tenantId}/support-access/exit`, req);
      expect(exitRes.statusCode).toBe(200);
      expect((exitRes.body as any).active).toBe(false);

      const statusAfterExit = await invokeRoute(securityRouter, 'get', '/support-access/status', req);
      expect((statusAfterExit.body as any).active).toBe(false);

      const exitEvents = await PlatformAuditEventModel.find({ userId: actorUserId, action: 'support_access.exit' }).lean();
      expect(exitEvents.length).toBe(1);
      expect(exitEvents[0].targetTenantId?.toString()).toBe(tenantId);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('entering without a reason is rejected with 400 and produces no audit event', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    try {
      const req = platformStaffReq('PLATFORM_SUPPORT_ADMIN', { user: { userId: `support-reason-tester-${Date.now()}`, role: 'admin', platformRole: 'PLATFORM_SUPPORT_ADMIN' } });
      const actorUserId = (req.user as any).userId;

      const res = await invokeRoute(securityRouter, 'post', `/tenants/${new mongoose.Types.ObjectId()}/support-access`, {
        ...req,
        body: { reason: '' },
      });
      expect(res.statusCode).toBe(400);

      const events = await PlatformAuditEventModel.find({ userId: actorUserId }).lean();
      expect(events.length).toBe(0);
    } finally {
      await mongoose.disconnect();
    }
  });
});
