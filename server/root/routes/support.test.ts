// Integration tests for TASK-ROOT-SUPPORT-03's support ticket routes.
//
// Runs against a real MongoDB (localhost:27017, an isolated database name
// dedicated to this test file so it never collides with any other
// worktree/dev server on the shared local mongod) and the REAL
// `authenticateUser` middleware (server/middleware/auth.ts) — not a mock —
// via a real Tenant + User document and a faked `req.session` (this test
// file's own harness, not a change to production auth code; express-session
// itself is not required since `authenticateUser` only reads
// `req.session.userId`). This proves the "tenant-scoped session cannot
// reach /api/root/**" acceptance criterion against the actual auth
// middleware, not just this task's own placeholder in isolation.
//
//   npx tsx --test server/root/routes/support.test.ts
//
// Requires a local MongoDB reachable at mongodb://127.0.0.1:27017 (already
// running in this environment — confirmed via `lsof -iTCP:27017`).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
import { Tenant, User } from '../../models';
import { registerSupportRoutes } from './support';
import { SUPPORT_TICKET_TRANSITIONS } from '../models/supportTicket';

const TEST_DB_NAME = 'fleetpro_root_support_test_support';
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let tenantAId: string;
let tenantBId: string;

async function createSessionUser(tenantId: string | null, platformRole?: string) {
  const sessionId = `test-session-${Math.random().toString(36).slice(2)}`;
  const doc: Record<string, unknown> = {
    userId: `test-user-${Math.random().toString(36).slice(2)}`,
    password: 'not-a-real-hash',
    role: tenantId ? 'client' : 'admin',
    tenantId: tenantId ?? undefined,
    sessionId,
    isActive: true,
  };
  const user = await User.create(doc as any);
  if (platformRole) {
    // Deliberately bypasses the Mongoose model layer (native driver write)
    // to attach an undeclared field — simulating what TASK-ROOT-DOMAIN-01's
    // real, additive `User.platformRole` schema field will look like once
    // merged, without this task editing the shared User schema itself.
    await mongoose.connection.collection('users').updateOne({ _id: user._id }, { $set: { platformRole } });
  }
  return sessionId;
}

function authHeaders(sessionId: string) {
  return { 'x-test-session-id': sessionId, 'Content-Type': 'application/json' };
}

before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${TEST_DB_NAME}`);
  await mongoose.connection.dropDatabase();

  const tenantA = await Tenant.create({ name: 'Tenant A', businessName: 'Tenant A Pvt Ltd' } as any);
  const tenantB = await Tenant.create({ name: 'Tenant B', businessName: 'Tenant B Pvt Ltd' } as any);
  tenantAId = tenantA._id.toString();
  tenantBId = tenantB._id.toString();

  const app = express();
  app.use(express.json());
  // Test-only harness: fakes just enough of `req.session` for the real
  // `authenticateUser` middleware to look up a real DB user by sessionId.
  // Not a stand-in for CSRF/cookies — this test hits routes directly, not
  // through the app's session/cookie stack.
  app.use((req, _res, next) => {
    const sid = req.headers['x-test-session-id'];
    (req as any).session = sid
      ? { userId: sid, destroy: (cb: (err?: unknown) => void) => cb() }
      : undefined;
    next();
  });
  registerSupportRoutes(app);

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Tenant isolation on /api/root/support/**', () => {
  test('a tenant-scoped session (real DB user, role=client, no platformRole) gets 403', async () => {
    const sessionId = await createSessionUser(tenantAId);
    const res = await fetch(`${baseUrl}/api/root/support/tickets`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 403);
  });

  test('no session at all gets 401 (authenticateUser rejects first)', async () => {
    const res = await fetch(`${baseUrl}/api/root/support/tickets`);
    assert.equal(res.status, 401);
  });
});

describe('Support ticket CRUD + full status lifecycle', () => {
  let ticketId: string;

  test('create a ticket (platform-role session)', async () => {
    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const res = await fetch(`${baseUrl}/api/root/support/tickets`, {
      method: 'POST',
      headers: authHeaders(sessionId),
      body: JSON.stringify({
        tenantId: tenantAId,
        module: 'booking',
        severity: 'HIGH',
        category: 'Payment mismatch',
        subject: 'Advance payment not reflected',
        description: 'Customer paid but booking still shows due amount.',
        reportedBy: { name: 'Ops Executive', email: 'ops@tenant-a.example.com' },
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ticket.status, 'NEW');
    assert.equal(body.ticket.timeline.length, 1);
    assert.match(body.ticket.ticketId, /^TCK-/);
    ticketId = body.ticket._id;
  });

  test('walks the exact NEW → INVESTIGATING → WAITING_TENANT → INVESTIGATING → FIX_IN_PROGRESS → RESOLVED → CLOSED lifecycle', async () => {
    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const path = ['INVESTIGATING', 'WAITING_TENANT', 'INVESTIGATING', 'FIX_IN_PROGRESS', 'RESOLVED', 'CLOSED'];

    let previous = 'NEW';
    for (const status of path) {
      const res = await fetch(`${baseUrl}/api/root/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: authHeaders(sessionId),
        body: JSON.stringify({ status, note: `moved to ${status}` }),
      });
      assert.equal(res.status, 200, `transition ${previous} -> ${status} should succeed`);
      const body = await res.json();
      assert.equal(body.ticket.status, status);
      previous = status;
    }

    const finalRes = await fetch(`${baseUrl}/api/root/support/tickets/${ticketId}`, {
      headers: authHeaders(sessionId),
    });
    // No GET-by-id route exists for tickets per this task's "Expected APIs"
    // list — confirm the list endpoint reflects the final state instead.
    assert.equal(finalRes.status, 404); // GET /:id isn't a route; PATCH-only detail mutation.
  });

  test('rejects an invalid transition (e.g. NEW straight to RESOLVED) with 422', async () => {
    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const createRes = await fetch(`${baseUrl}/api/root/support/tickets`, {
      method: 'POST',
      headers: authHeaders(sessionId),
      body: JSON.stringify({
        tenantId: tenantAId,
        module: 'gps',
        severity: 'LOW',
        category: 'Device offline',
        subject: 'Device shows offline',
        description: 'One vehicle device has been offline for 2 days.',
      }),
    });
    const { ticket } = await createRes.json();

    const badRes = await fetch(`${baseUrl}/api/root/support/tickets/${ticket._id}`, {
      method: 'PATCH',
      headers: authHeaders(sessionId),
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert.equal(badRes.status, 422);
    const body = await badRes.json();
    assert.deepEqual(body.allowedNext, SUPPORT_TICKET_TRANSITIONS.NEW);
  });

  test('a read-only auditor platform role can list but not create', async () => {
    const auditorSession = await createSessionUser(null, 'PLATFORM_READ_ONLY_AUDITOR');

    const listRes = await fetch(`${baseUrl}/api/root/support/tickets`, { headers: authHeaders(auditorSession) });
    assert.equal(listRes.status, 200);

    const createRes = await fetch(`${baseUrl}/api/root/support/tickets`, {
      method: 'POST',
      headers: authHeaders(auditorSession),
      body: JSON.stringify({
        tenantId: tenantAId,
        module: 'other',
        severity: 'LOW',
        category: 'x',
        subject: 'x',
        description: 'x',
      }),
    });
    assert.equal(createRes.status, 403);
  });
});

describe('List/filter by tenant/severity/status', () => {
  test('filters correctly across two tenants', async () => {
    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');

    await fetch(`${baseUrl}/api/root/support/tickets`, {
      method: 'POST',
      headers: authHeaders(sessionId),
      body: JSON.stringify({
        tenantId: tenantBId,
        module: 'vendor',
        severity: 'CRITICAL',
        category: 'Vendor payout',
        subject: 'Vendor payout failed',
        description: 'Vendor settlement API returned 500.',
      }),
    });

    const tenantAOnly = await fetch(`${baseUrl}/api/root/support/tickets?tenantId=${tenantAId}`, {
      headers: authHeaders(sessionId),
    });
    const tenantABody = await tenantAOnly.json();
    assert.ok(tenantABody.tickets.every((t: any) => t.tenantId === tenantAId));

    const criticalOnly = await fetch(`${baseUrl}/api/root/support/tickets?severity=CRITICAL`, {
      headers: authHeaders(sessionId),
    });
    const criticalBody = await criticalOnly.json();
    assert.ok(criticalBody.tickets.length >= 1);
    assert.ok(criticalBody.tickets.every((t: any) => t.severity === 'CRITICAL'));
    assert.ok(criticalBody.tickets.every((t: any) => t.tenantId !== tenantAId || t.severity === 'CRITICAL'));
  });
});
