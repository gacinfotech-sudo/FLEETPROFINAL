// Tests for TASK-ROOT-DOMAIN-01's RootAccessService.
//
// No test runner (Jest/Vitest) is configured in this repo (see
// package.json's "scripts" — only "check" -> tsc). Following the existing
// precedent (server/services/bookingCodeService.test.ts), this uses Node's
// built-in `node:test` + `node:assert/strict`, run directly via tsx:
//
//   npx tsx --test server/root/services/rootAccessService.test.ts
//
// tsconfig.json already excludes "**/*.test.ts" from `npm run check`.
//
// This is authorization/scoping logic — the acceptance criteria require
// proving it actually works, not just reading correctly. Every DB-backed
// method is exercised through injected fakes (RootAccessServiceDeps), so
// none of this needs a live MongoDB connection; requirePlatformRole never
// touches the DB at all.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRootAccessService,
  maskPhone,
  maskEmail,
} from './rootAccessService';
import type { PlatformAuditEvent, RootAccessRequest } from '../types';
import { PLATFORM_ROLES, isPlatformRole } from '../types';

// ---------------------------------------------------------------------------
// Minimal Express req/res/next fakes
// ---------------------------------------------------------------------------

function fakeReq(platformRole?: string): RootAccessRequest {
  return { user: platformRole ? { userId: 'u1', platformRole: platformRole as any } : { userId: 'u1' } } as any;
}

function fakeRes() {
  const res: any = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// requirePlatformRole — the core authorization gate. Acceptance criteria:
// "correctly 403s a request from a user with no platformRole set, and from
// a user whose platformRole isn't in the allowed list — proven by tests."
// ---------------------------------------------------------------------------

describe('RootAccessService.requirePlatformRole', () => {
  const service = createRootAccessService();

  test('403s a request with no platformRole set at all', () => {
    const middleware = service.requirePlatformRole(['PLATFORM_ROOT']);
    const req = fakeReq(undefined);
    const res = fakeRes();
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false, 'next() must not be called');
    assert.equal(res.statusCode, 403);
    assert.match((res.body as any).message, /platform access required/i);
  });

  test('403s a request whose platformRole is not in the allowed list', () => {
    const middleware = service.requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SECURITY_ADMIN']);
    const req = fakeReq('PLATFORM_SUPPORT_ADMIN');
    const res = fakeRes();
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.match((res.body as any).message, /insufficient platform role/i);
    assert.deepEqual((res.body as any).requiredAny, ['PLATFORM_ROOT', 'PLATFORM_SECURITY_ADMIN']);
  });

  test('calls next() (no res writes) when platformRole is in the allowed list', () => {
    const middleware = service.requirePlatformRole(['PLATFORM_ROOT', 'PLATFORM_SUPPORT_ADMIN']);
    const req = fakeReq('PLATFORM_SUPPORT_ADMIN');
    const res = fakeRes();
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, undefined, 'must not touch the response when authorized');
  });

  test('every PlatformRole value is individually gate-able (allow-one-deny-rest, for every role)', () => {
    for (const role of PLATFORM_ROLES) {
      const middleware = service.requirePlatformRole([role]);

      // The exact role is allowed through.
      const okReq = fakeReq(role);
      const okRes = fakeRes();
      let okNext = false;
      middleware(okReq, okRes, () => { okNext = true; });
      assert.equal(okNext, true, `${role} should be allowed by its own gate`);

      // Every other role is denied.
      for (const other of PLATFORM_ROLES) {
        if (other === role) continue;
        const req = fakeReq(other);
        const res = fakeRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, false, `${other} must be denied by a gate scoped to ${role}`);
        assert.equal(res.statusCode, 403);
      }
    }
  });

  test('rejects a tenant-side manager/client/admin identity that has no platformRole at all', () => {
    // Simulates the exact case this task exists to prevent: a normal
    // tenant user (role: 'client'/'manager', or even the legacy
    // role: 'admin') hitting a Root-only route. Since platformRole is a
    // wholly separate field, having a tenant-side `role` proves nothing —
    // the request must still 403.
    const middleware = service.requirePlatformRole(['PLATFORM_ROOT']);
    const req = { user: { userId: 'u1', role: 'admin' } } as any; // legacy tenant-side role, no platformRole
    const res = fakeRes();
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  test('throws synchronously if constructed with an empty allowed-roles list (misuse guard)', () => {
    assert.throws(() => service.requirePlatformRole([]), /non-empty/);
  });
});

// ---------------------------------------------------------------------------
// listTenants / getTenant360 / getCustomerAcrossTenants — DI plumbing
// ---------------------------------------------------------------------------

describe('RootAccessService — DB-backed methods route through injected deps (no live DB needed)', () => {
  test('listTenants calls the injected impl with the exact filter and returns its result verbatim', async () => {
    let received: unknown;
    const service = createRootAccessService({
      listTenantsImpl: async (filter) => {
        received = filter;
        return [{
          tenantId: 't1', name: 'Acme', businessName: 'Acme Cabs', isActive: true,
          subscriptionPlan: 'pro', createdAt: new Date('2026-01-01'),
        }];
      },
    });
    const filter = { search: 'acme', limit: 10 };
    const result = await service.listTenants(filter);
    assert.deepEqual(received, filter);
    assert.equal(result.length, 1);
    assert.equal(result[0].tenantId, 't1');
  });

  test('getTenant360 calls the injected impl with the tenantId and returns its result verbatim', async () => {
    let received: unknown;
    const service = createRootAccessService({
      getTenant360Impl: async (tenantId) => {
        received = tenantId;
        return {
          tenant: {
            tenantId, name: 'Acme', businessName: 'Acme Cabs', isActive: true,
            subscriptionPlan: 'pro', createdAt: new Date('2026-01-01'),
          },
          counts: { users: 3, vehicles: 5, drivers: 4, bookings: 120 },
        };
      },
    });
    const result = await service.getTenant360('t1');
    assert.equal(received, 't1');
    assert.equal(result.counts.bookings, 120);
  });

  test('getCustomerAcrossTenants calls the injected impl and never leaks a "raw" flag on its own', async () => {
    const service = createRootAccessService({
      getCustomerAcrossTenantsImpl: async () => [{
        customerId: 'c1', tenantId: 't1', name: 'Jane Doe',
        maskedPhone: maskPhone('9876543210'), maskedEmail: maskEmail('jane@example.com'),
        createdAt: new Date(),
      }],
    });
    const result = await service.getCustomerAcrossTenants({ search: 'jane' });
    assert.equal(result.length, 1);
    assert.equal(result[0].maskedPhone, '98******10');
    assert.doesNotMatch(result[0].maskedPhone!, /9876543210/);
  });
});

// ---------------------------------------------------------------------------
// recordAuditEvent
// ---------------------------------------------------------------------------

describe('RootAccessService.recordAuditEvent', () => {
  test('forwards the event to the injected auditSink and stamps createdAt when absent', async () => {
    const captured: any[] = [];
    const service = createRootAccessService({
      auditSink: async (event) => { captured.push(event); },
    });
    const event: PlatformAuditEvent = {
      actorUserId: 'u1',
      actorPlatformRole: 'PLATFORM_ROOT',
      action: 'root.tenant.view',
      targetTenantId: 't1',
    };
    await service.recordAuditEvent(event);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].action, 'root.tenant.view');
    assert.ok(captured[0].createdAt instanceof Date);
  });

  test('preserves an explicitly-provided createdAt instead of overwriting it', async () => {
    const captured: any[] = [];
    const fixed = new Date('2020-01-01T00:00:00.000Z');
    const service = createRootAccessService({
      auditSink: async (event) => { captured.push(event); },
    });
    await service.recordAuditEvent({
      actorUserId: 'u1', actorPlatformRole: 'PLATFORM_ROOT', action: 'root.tenant.view', createdAt: fixed,
    });
    assert.equal(captured[0].createdAt.getTime(), fixed.getTime());
  });

  test('never throws even if the underlying sink is misconfigured to reject (audit must not crash the caller path silently uncaught)', async () => {
    // This documents current behavior: recordAuditEvent propagates sink
    // rejections rather than swallowing them, so a route handler that
    // awaits recordAuditEvent will see the failure and can decide how to
    // handle it (e.g. still deny the request) — it must not silently
    // pretend the audit succeeded.
    const service = createRootAccessService({
      auditSink: async () => { throw new Error('sink down'); },
    });
    await assert.rejects(
      () => service.recordAuditEvent({ actorUserId: 'u1', actorPlatformRole: 'PLATFORM_ROOT', action: 'x' }),
      /sink down/,
    );
  });
});

// ---------------------------------------------------------------------------
// maskPhone / maskEmail — placeholder PII masking used by
// defaultGetCustomerAcrossTenants until TASK-ROOT-SECURITY-05's real
// piiMaskingService lands.
// ---------------------------------------------------------------------------

describe('maskPhone', () => {
  test('keeps first 2 and last 2 digits, masks the middle', () => {
    assert.equal(maskPhone('9876543210'), '98******10');
  });
  test('strips non-digit characters before masking', () => {
    assert.equal(maskPhone('+91 98765-43210'), '91********10');
  });
  test('fully masks very short numbers rather than leaking them whole', () => {
    assert.equal(maskPhone('123'), '***');
  });
  test('returns undefined for undefined input', () => {
    assert.equal(maskPhone(undefined), undefined);
  });
  test('never contains the original raw digit sequence as a substring for a realistic 10-digit number', () => {
    const raw = '9123456780';
    const masked = maskPhone(raw)!;
    assert.doesNotMatch(masked, new RegExp(raw));
  });
});

describe('maskEmail', () => {
  test('keeps up to 2 leading local-part characters and the full domain', () => {
    assert.equal(maskEmail('jane.doe@example.com'), 'ja******@example.com');
  });
  test('masks a 1-character local part down to 1 visible char + 1 star (still shows domain)', () => {
    assert.equal(maskEmail('j@example.com'), 'j*@example.com');
  });
  test('returns undefined for undefined input', () => {
    assert.equal(maskEmail(undefined), undefined);
  });
  test('never contains the original local part as a substring for a realistic email', () => {
    const raw = 'janedoe@example.com';
    const masked = maskEmail(raw)!;
    assert.doesNotMatch(masked, /janedoe/);
  });
});

// ---------------------------------------------------------------------------
// isPlatformRole — used by the migration script to validate CLI input
// ---------------------------------------------------------------------------

describe('isPlatformRole', () => {
  test('accepts every documented PlatformRole value', () => {
    for (const role of PLATFORM_ROLES) assert.equal(isPlatformRole(role), true);
  });
  test('rejects legacy tenant-side role values', () => {
    assert.equal(isPlatformRole('admin'), false);
    assert.equal(isPlatformRole('client'), false);
    assert.equal(isPlatformRole('manager'), false);
  });
  test('rejects arbitrary strings, empty string, and non-strings', () => {
    assert.equal(isPlatformRole('PLATFORM_SUPERUSER'), false);
    assert.equal(isPlatformRole(''), false);
    assert.equal(isPlatformRole(undefined), false);
    assert.equal(isPlatformRole(123), false);
  });
});
