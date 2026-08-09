// Integration tests for TASK-ROOT-SUPPORT-03's Error Center + Support
// Diagnostics routes. Same harness pattern as ./support.test.ts — real
// MongoDB (isolated DB name), real `authenticateUser`, a faked
// `req.session` (test-only, not production code).
//
//   npx tsx --test server/root/routes/errors.test.ts
//
// Requires a local MongoDB reachable at mongodb://127.0.0.1:27017.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import type { AddressInfo } from 'node:net';
import { Tenant, User } from '../../models';
import { registerErrorRoutes } from './errors';
import { captureError } from '../services/errorCaptureService';

const TEST_DB_NAME = 'fleetpro_root_support_test_errors';
let server: ReturnType<express.Express['listen']>;
let baseUrl: string;
let tenantAId: string;

async function createSessionUser(tenantId: string | null, platformRole?: string) {
  const sessionId = `test-session-${Math.random().toString(36).slice(2)}`;
  const user = await User.create({
    userId: `test-user-${Math.random().toString(36).slice(2)}`,
    password: 'not-a-real-hash',
    role: tenantId ? 'client' : 'admin',
    tenantId: tenantId ?? undefined,
    sessionId,
    isActive: true,
  } as any);
  if (platformRole) {
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
  tenantAId = tenantA._id.toString();

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const sid = req.headers['x-test-session-id'];
    (req as any).session = sid
      ? { userId: sid, destroy: (cb: (err?: unknown) => void) => cb() }
      : undefined;
    next();
  });
  registerErrorRoutes(app);

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

describe('Tenant isolation on /api/root/errors and /api/root/diagnostics', () => {
  test('a tenant-scoped session gets 403 on the error list', async () => {
    const sessionId = await createSessionUser(tenantAId);
    const res = await fetch(`${baseUrl}/api/root/errors`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 403);
  });

  test('a tenant-scoped session gets 403 on diagnostics', async () => {
    const sessionId = await createSessionUser(tenantAId);
    const res = await fetch(`${baseUrl}/api/root/diagnostics/some-correlation-id`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 403);
  });
});

describe('Error capture -> Error Center storage privacy (via the real HTTP read path)', () => {
  test('an ErrorRecord built from a payload containing a password/token/cookie is stored with those fields redacted', async () => {
    const record = await captureError({
      source: 'api_5xx',
      message: 'Failed to save booking: password=hunter2secret, token=abcTOKENsecret',
      tenantId: tenantAId,
      module: 'booking',
      route: '/api/bookings',
      httpMethod: 'POST',
      httpStatus: 500,
      apiResponseSnapshot: {
        error: 'Internal error',
        debugContext: {
          cookie: 'connect.sid=s%3AsuperSecretSessionValue.sig',
          user: { password: 'hunter2secret', otp: '999111' },
        },
      },
    });

    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const res = await fetch(`${baseUrl}/api/root/errors/${record._id}`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 200);
    const body = await res.json();
    const serialized = JSON.stringify(body);

    for (const secretValue of ['hunter2secret', 'abcTOKENsecret', 'superSecretSessionValue', '999111']) {
      assert.equal(serialized.includes(secretValue), false, `secret leaked over the API: ${secretValue}`);
    }
    assert.ok(body.error.redactedFieldKeys.length > 0);
    assert.match(body.error.errorId, /^ERR-/);
  });
});

describe('Support Diagnostics — trace reconstruction from a correlation ID', () => {
  test('reconstructs tenant/user/module/step/failure/API-response trace from multiple ErrorRecords sharing one correlation ID', async () => {
    const correlationId = `diag-${Math.random().toString(36).slice(2)}`;

    await captureError({
      source: 'frontend_runtime',
      message: 'Step 1: form opened',
      correlationId,
      tenantId: tenantAId,
      userId: 'user-42',
      role: 'manager',
      module: 'booking',
      actionAttempted: 'Create booking',
      stepReached: 'form_opened',
      lastSuccessfulStep: 'form_opened',
      retryCount: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await captureError({
      source: 'api_4xx',
      message: 'Step 2: validation failed on vehicle availability',
      correlationId,
      tenantId: tenantAId,
      userId: 'user-42',
      role: 'manager',
      module: 'booking',
      route: '/api/bookings',
      httpMethod: 'POST',
      httpStatus: 422,
      actionAttempted: 'Create booking',
      stepReached: 'availability_check',
      validationFailure: 'Selected vehicle is already booked for this window.',
      apiResponseSnapshot: { message: 'Vehicle unavailable' },
      retryCount: 1,
      lastSuccessfulStep: 'form_opened',
    });

    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const res = await fetch(`${baseUrl}/api/root/diagnostics/${correlationId}`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.trace.correlationId, correlationId);
    assert.equal(body.trace.tenantId, tenantAId);
    assert.equal(body.trace.userId, 'user-42');
    assert.equal(body.trace.module, 'booking');
    assert.equal(body.trace.stepReached, 'availability_check');
    assert.equal(body.trace.validationFailure, 'Selected vehicle is already booked for this window.');
    assert.equal(body.trace.retryCount, 1);
    assert.equal(body.trace.lastSuccessfulStep, 'form_opened');
    assert.equal(body.trace.events.length, 2);
    assert.equal(body.trace.events[0].stepReached, 'form_opened');
    assert.equal(body.trace.events[1].stepReached, 'availability_check');
  });

  test('an unknown correlation ID returns 404, not an empty 200', async () => {
    const sessionId = await createSessionUser(null, 'PLATFORM_SUPPORT_ADMIN');
    const res = await fetch(`${baseUrl}/api/root/diagnostics/does-not-exist-anywhere`, { headers: authHeaders(sessionId) });
    assert.equal(res.status, 404);
  });
});
