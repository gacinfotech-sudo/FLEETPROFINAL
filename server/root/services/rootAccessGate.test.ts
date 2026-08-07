// Tests for TASK-ROOT-DASHBOARD-02's `requirePlatformRole` gate
// (server/root/services/localRootAccessService.ts) — proves the
// acceptance criterion "A tenant-scoped (non-platform-role) session
// attempting any /api/root/** route in this task gets 403" at the
// middleware level, without needing a running Express app or a database.
//
//   npx tsx --test server/root/services/rootAccessGate.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { localRootAccessService } from './localRootAccessService';
import type { PlatformRole } from '../types';

const ALL_ROLES: PlatformRole[] = [
  'PLATFORM_ROOT', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_SUPPORT_ADMIN',
  'PLATFORM_FINANCE_ADMIN', 'PLATFORM_SECURITY_ADMIN', 'PLATFORM_READ_ONLY_AUDITOR',
];

function mockReqRes(user: any) {
  const req: any = { user };
  let statusCode: number | undefined;
  let body: any;
  const res: any = {
    status(code: number) { statusCode = code; return this; },
    json(payload: any) { body = payload; return this; },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return {
    req, res, next,
    result: () => ({ statusCode, body, nextCalled }),
  };
}

describe('requirePlatformRole (tenant-isolation / 403 proof)', () => {
  test('a tenant-scoped "client" session is rejected with 403', () => {
    const { req, res, next, result } = mockReqRes({ userId: 'u1', role: 'client', tenantId: 't1' });
    localRootAccessService.requirePlatformRole(ALL_ROLES)(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, false, 'next() must not be called for a tenant-scoped session');
    assert.equal(r.statusCode, 403);
  });

  test('a tenant-scoped "manager" session is rejected with 403', () => {
    const { req, res, next, result } = mockReqRes({ userId: 'u2', role: 'manager', tenantId: 't1' });
    localRootAccessService.requirePlatformRole(ALL_ROLES)(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, false);
    assert.equal(r.statusCode, 403);
  });

  test('an unauthenticated request (no user) is rejected with 403', () => {
    const { req, res, next, result } = mockReqRes(undefined);
    localRootAccessService.requirePlatformRole(ALL_ROLES)(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, false);
    assert.equal(r.statusCode, 403);
  });

  test('a real platformRole in the allowed list is admitted (next() called, no status set)', () => {
    const { req, res, next, result } = mockReqRes({ userId: 'u3', role: 'client', platformRole: 'PLATFORM_SUPPORT_ADMIN' });
    localRootAccessService.requirePlatformRole(ALL_ROLES)(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, true);
    assert.equal(r.statusCode, undefined);
  });

  test('a platformRole outside the allowed list is rejected with 403', () => {
    const { req, res, next, result } = mockReqRes({ userId: 'u4', platformRole: 'PLATFORM_FINANCE_ADMIN' });
    localRootAccessService.requirePlatformRole(['PLATFORM_ROOT'])(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, false);
    assert.equal(r.statusCode, 403);
  });

  test('interim bridge: today\'s existing role==="admin" session (no platformRole yet) is admitted', () => {
    // Flagged, temporary — see localRootAccessService.ts's doc comment.
    // An `admin`-role session is NOT tenant-scoped (it already bypasses
    // requireTenant today), so admitting it here does not violate "never
    // reachable by a tenant-scoped session token."
    const { req, res, next, result } = mockReqRes({ userId: 'u5', role: 'admin' });
    localRootAccessService.requirePlatformRole(ALL_ROLES)(req, res, next);
    const r = result();
    assert.equal(r.nextCalled, true);
  });
});
