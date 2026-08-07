// TASK-ROOT-SALES-CONFIG-04 — HTTP-level tenant-isolation proof.
//
// Run with: MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro_test_sales_config_http \
//   npx tsx server/root/__tests__/rootAccess.http.test.ts
//
// Proves the acceptance criterion: "A tenant-scoped session cannot reach
// any /api/root/** route in this task — 403, proven by test." Exercises the
// REAL `authenticateUser` (server/middleware/auth.ts) and the REAL
// `requirePlatformRole` (server/root/routes/_localPlatformAccess.ts) via a
// real HTTP server and real MongoDB-backed User documents — nothing about
// the auth/authorization logic itself is mocked.
//
// The only test-only stand-in is the session layer: this repo's real
// session middleware is express-session + connect-mongo, configured deep
// inside server/routes.ts / server/index.ts (both out of this task's
// scope). `authenticateUser` only actually depends on `req.session.userId`
// (a lookup key) and `req.session.destroy()` existing — so this harness
// provides a minimal stand-in for just that shape, driven by a test-only
// request header, and lets the real `authenticateUser` do the real
// database-backed user lookup + isActive check against it.

import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fleetpro_test_sales_config_http';

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
  await mongoose.connection.dropDatabase();

  const { authenticateUser } = await import('../../middleware/auth');
  const { requirePlatformRole } = await import('../routes/_localPlatformAccess');
  const { registerSalesRoutes } = await import('../routes/sales');
  const { registerConfigRoutes } = await import('../routes/config');
  const { registerFeatureFlagRoutes } = await import('../routes/features');
  const { User, Tenant } = await import('../../models');

  // --- Unit-level proof that requirePlatformRole grants access to an
  // allowed platform role (isolated from the DB/schema — see this file's
  // header for why: User.platformRole doesn't exist in this worktree's
  // schema yet, TASK-ROOT-DOMAIN-01 owns adding it). ---
  console.log('--- requirePlatformRole unit behavior ---');
  await test('an allowed platformRole calls next()', async () => {
    let nextCalled = false;
    const middleware = requirePlatformRole(['PLATFORM_ROOT']);
    const req: any = { user: { platformRole: 'PLATFORM_ROOT' } };
    const res: any = { status: () => { throw new Error('should not respond'); } };
    middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
  await test('a disallowed platformRole is rejected with 403', async () => {
    let statusCode: number | undefined;
    let body: any;
    const middleware = requirePlatformRole(['PLATFORM_ROOT']);
    const req: any = { user: { platformRole: 'PLATFORM_SUPPORT_ADMIN' } };
    const res: any = { status: (code: number) => { statusCode = code; return { json: (b: any) => { body = b; } }; } };
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
  });
  await test('no platformRole at all (e.g. today\'s plain admin/client/manager user) is rejected with 403', async () => {
    let statusCode: number | undefined;
    const middleware = requirePlatformRole(['PLATFORM_ROOT']);
    const req: any = { user: { role: 'admin' } }; // legacy role, no platformRole
    const res: any = { status: (code: number) => { statusCode = code; return { json: () => {} }; } };
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
  });

  // --- Real HTTP server, real authenticateUser, real DB-backed users ---
  console.log('--- HTTP: a tenant-scoped session cannot reach any /api/root/** route ---');

  const tenant = await Tenant.create({ name: 'Iso Tenant', businessName: 'Iso Tenant' });

  const clientUser = await User.create({
    userId: 'test-tenant-client-1',
    password: 'hashed-not-real',
    role: 'client',
    tenantId: tenant._id,
    sessionId: 'session-token-client-1',
    isActive: true,
  });
  const managerUser = await User.create({
    userId: 'test-tenant-manager-1',
    password: 'hashed-not-real',
    role: 'manager',
    tenantId: tenant._id,
    sessionId: 'session-token-manager-1',
    isActive: true,
  });
  // Today's existing 'admin' role — proves the OLD unaudited bypass does
  // NOT, by itself, satisfy the NEW requirePlatformRole gate. This is the
  // desired behavior per ROOT-GAP-MATRIX.md's "Option A" design: the two
  // mechanisms are meant to be reconciled by DOMAIN-01/SECURITY-05's
  // migration, not left silently equivalent.
  const legacyAdminUser = await User.create({
    userId: 'test-legacy-admin-1',
    password: 'hashed-not-real',
    role: 'admin',
    sessionId: 'session-token-admin-1',
    isActive: true,
  });

  const app = express();
  app.use(express.json());
  // Test-only session stand-in — see file header. NOT a mock of
  // authenticateUser; authenticateUser below is the real production
  // function and does the real DB lookup + isActive check.
  app.use((req: any, _res, next) => {
    const token = req.headers['x-test-session-token'];
    req.session = {
      userId: token,
      destroy: (cb?: (err?: unknown) => void) => { if (cb) cb(); },
    };
    next();
  });
  registerSalesRoutes(app);
  registerConfigRoutes(app);
  registerFeatureFlagRoutes(app);

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  async function get(path: string, token?: string): Promise<Response> {
    return fetch(`${base}${path}`, {
      headers: token ? { 'x-test-session-token': token } : {},
    });
  }

  const rootRoutesToCheck = [
    '/api/root/sales/prospects',
    '/api/root/config',
    '/api/root/plans',
    `/api/root/tenants/${tenant._id}/features`,
  ];

  for (const path of rootRoutesToCheck) {
    await test(`${path} — no session at all -> 401`, async () => {
      const res = await get(path);
      assert.equal(res.status, 401);
    });
    await test(`${path} — tenant 'client' session -> 403`, async () => {
      const res = await get(path, 'session-token-client-1');
      assert.equal(res.status, 403);
    });
    await test(`${path} — tenant 'manager' session -> 403`, async () => {
      const res = await get(path, 'session-token-manager-1');
      assert.equal(res.status, 403);
    });
    await test(`${path} — legacy 'admin' role session (no platformRole) -> 403`, async () => {
      const res = await get(path, 'session-token-admin-1');
      assert.equal(res.status, 403);
    });
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  void clientUser; void managerUser; void legacyAdminUser;

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
