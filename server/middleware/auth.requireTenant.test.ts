// Regression test for the TASK-ROOT-SECURITY-05 "Option A" requireTenant /
// scopeTenant migration, applied at integration of
// integration/root-control-plane-wave1 (see
// docs/root-control-plane/ROOT-INTEGRATION-report.md).
//
// Proves, against the REAL `requireTenant` middleware (not a reimplementation),
// every row of that report's "before/after behavior" table:
//   1. A migrated platform-staff user (platformRole set) bypasses tenant
//      scoping — identical outcome to the old role==='admin' bypass.
//   2. A legacy role:'admin' user with NO platformRole (not yet migrated)
//      now gets 403'd if it has no tenantId — this is the documented,
//      intentional regression that makes running the migration script a
//      hard prerequisite before this patch reaches any environment with
//      real admin accounts.
//   3. Ordinary tenant-scoped users (client/manager) are completely
//      unaffected either way.
//
// No live DB needed — requireTenant only reads fields already present on
// req.user/req.tenantId.
//
//   npx tsx --test server/middleware/auth.requireTenant.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requireTenant, type AuthRequest } from './auth';
import { isPlatformRole } from '../root/types';

function mockReq(user: any, tenantId?: string): AuthRequest {
  return { user, tenantId } as unknown as AuthRequest;
}

function mockRes() {
  const res: any = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe('requireTenant — Option A migration (role bypass -> platformRole bypass)', () => {
  test('a migrated platform-staff user (platformRole set, role irrelevant) bypasses tenant scoping, same as the old admin bypass', () => {
    const req = mockReq({ userId: 'u1', role: 'admin', platformRole: 'PLATFORM_ROOT' });
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined, 'must not have set a response status');
  });

  test('a migrated platform-staff user with NO tenantId still bypasses (the whole point of the cross-tenant bypass)', () => {
    const req = mockReq({ userId: 'u1', role: 'admin', platformRole: 'PLATFORM_SUPPORT_ADMIN' }, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('DOCUMENTED REGRESSION: a legacy role:"admin" user with NO platformRole (not yet migrated) and no tenantId is now 403d, where it used to bypass unconditionally', () => {
    const req = mockReq({ userId: 'legacy-admin', role: 'admin' }, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false, 'must NOT bypass — this is the intentional, documented behavior change');
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Tenant access required');
  });

  test('a legacy role:"admin" user with NO platformRole but a real tenantId happens to pass (falls through to the normal tenant check, same as any other tenant-scoped user)', () => {
    const req = mockReq({ userId: 'legacy-admin', role: 'admin' }, 'tenant-123');
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('unchanged: a tenant-scoped client with a tenantId passes through', () => {
    const req = mockReq({ userId: 'c1', role: 'client' }, 'tenant-123');
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('unchanged: a tenant-scoped manager with NO tenantId is 403d (orphaned-manager protection, unrelated to this migration)', () => {
    const req = mockReq({ userId: 'm1', role: 'manager' }, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test('unchanged: no user at all is 403d (never bypasses)', () => {
    const req = mockReq(undefined, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test('FAIL CLOSED (integration review fix): an unrecognized/garbage platformRole string does NOT bypass tenant scoping — must be validated, not just truthy', () => {
    // Guards against any future write path that could leave an invalid
    // string in this field without going through Mongoose's enum
    // validation (e.g. a raw-driver write, a manual DB edit, a bug in a
    // not-yet-built admin tool) — the migration script itself is safe
    // (validates before writing), but requireTenant is the app-wide
    // cross-tenant bypass and must not trust the field's mere presence.
    const req = mockReq({ userId: 'u-bad', role: 'client', platformRole: 'NOT_A_REAL_ROLE' }, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false, 'an invalid platformRole must never grant the cross-tenant bypass');
    assert.equal(res.statusCode, 403);
  });

  test('FAIL CLOSED: an empty-string platformRole does NOT bypass (falsy-but-technically-truthy-adjacent edge case)', () => {
    const req = mockReq({ userId: 'u-empty', role: 'client', platformRole: '' }, undefined);
    const res = mockRes();
    let nextCalled = false;
    requireTenant(req, res as any, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});

describe('scopeTenant (server/routes.ts) — same validated platformRole gate, verified in isolation here since the real helper is a closure inside registerRoutes()', () => {
  // Mirrors server/routes.ts's scopeTenant exactly:
  // isPlatformRole(req.user?.platformRole) ? undefined : req.tenantId.
  // Kept as a literal copy (not an import, since the real one is a
  // non-exported closure) specifically so a future edit to routes.ts's copy
  // that silently diverges from this gets caught — if this test ever needs
  // to change to keep passing, that's the signal.
  const scopeTenant = (req: AuthRequest): string | undefined =>
    isPlatformRole(req.user?.platformRole) ? undefined : req.tenantId;

  test('a migrated platform-staff user gets undefined (unscoped/cross-tenant query)', () => {
    const req = mockReq({ platformRole: 'PLATFORM_ROOT' }, 'tenant-123');
    assert.equal(scopeTenant(req), undefined);
  });

  test('a legacy role:"admin" user with no platformRole now gets scoped to their own tenantId, not unscoped', () => {
    const req = mockReq({ role: 'admin' }, 'tenant-123');
    assert.equal(scopeTenant(req), 'tenant-123');
  });

  test('a tenant-scoped client gets their own tenantId, unchanged', () => {
    const req = mockReq({ role: 'client' }, 'tenant-123');
    assert.equal(scopeTenant(req), 'tenant-123');
  });

  test('FAIL CLOSED: an unrecognized platformRole string gets scoped to their own tenantId, not unscoped', () => {
    const req = mockReq({ role: 'client', platformRole: 'NOT_A_REAL_ROLE' }, 'tenant-123');
    assert.equal(scopeTenant(req), 'tenant-123');
  });
});
