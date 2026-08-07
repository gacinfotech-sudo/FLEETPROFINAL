// TASK-GPS-QA-SECURITY-07 — webhook security tests, per
// docs/gps-research/GPS-SECURITY-SPEC.md §3's required behavior for any
// provider webhook adapter: valid signature accepted; invalid signature
// rejected; replayed (stale-timestamp) request rejected; malformed body
// rejected before any downstream processing runs.
//
// The real Traccar adapter (TASK-GPS-CONNECTION-02) documents no webhook
// signature scheme to test against — GPS-PROVIDER-RESEARCH.md §1 "Webhooks
// — a critical limitation": "no HMAC, no signature, no replay protection
// documented anywhere in Traccar's forwarding feature." TASK-GPS-INGESTION-
// 04's webhook receiver (server/gps/ingestion/webhookRoute.ts) is real,
// complete plumbing that is *capability-gated off* (501) for exactly this
// reason today. These tests exercise that real plumbing end-to-end using
// the shared mock adapter's Samsara-modeled HMAC-SHA256 scheme (see
// server/gps/testing/mockAdapter.ts's header comment for the citation) —
// the one documented, real signature scheme in this repo's provider
// research — registered under a test-only provider key on the same runtime
// registry webhookRoute.ts hard-imports, exactly matching the pattern
// TASK-GPS-INGESTION-04's own gps-telemetry-ingestion.spec.ts already uses
// for its capability-gate tests.

import { expect, test } from '@playwright/test';
import type { Express, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { gpsProviderRegistry } from '../../server/gps/providers/runtimeRegistry';
import { registerGpsWebhookRoutes } from '../../server/gps/ingestion/webhookRoute';
import { GpsWebhookEvent } from '../../server/gps/ingestion/models/webhookEvent';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import {
  createMockGpsProviderAdapter,
  signMockWebhookPayload,
  MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from '../../server/gps/testing/mockAdapter';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS webhook security verification.');
  return process.env.MONGODB_URI;
}

// Same "grab every handler, run the actual Express route dispatch" fake app
// TASK-GPS-INGESTION-04's own test file uses (tests/e2e/gps-telemetry-
// ingestion.spec.ts) — reproduced locally rather than imported, since that
// file does not export it and per this task's rule ("extend/import from
// them, don't rewrite them") that file's own contents are not to be edited.
function fakeExpressApp() {
  const handlers = new Map<string, (req: Request, res: Response, next: NextFunction) => unknown>();
  const app = {
    post(path: string, ...mws: Array<(req: Request, res: Response, next: NextFunction) => unknown>) {
      handlers.set(path, mws[mws.length - 1]);
    },
  } as unknown as Express;
  return { app, handlers };
}

function fakeResponseCycle() {
  let resolveDone: (() => void) | undefined;
  let rejectDone: ((error: unknown) => void) | undefined;
  const done = new Promise<void>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response['status'];
  res.json = ((body: unknown) => {
    res.body = body;
    resolveDone?.();
    return res as Response;
  }) as Response['json'];
  const next = ((error?: unknown) => {
    if (error) rejectDone?.(error);
    else resolveDone?.();
  }) as NextFunction;
  return { res: res as Response & { statusCode?: number; body?: unknown }, next, done };
}

async function makeSignedConnectionAndDevice(providerKey: string, webhookSecret: string) {
  const tenantId = new mongoose.Types.ObjectId().toString();
  const connection = await GpsConnection.create({
    tenantId,
    connectionName: `Webhook security test ${providerKey}`,
    providerKey,
    authenticationType: 'api_key',
    pollingIntervalSeconds: 120,
    enabled: true,
    status: 'connected',
    createdBy: 'webhook-security-test',
    updatedBy: 'webhook-security-test',
  });
  const connectionId = connection.id;
  const marker = `${providerKey}-${Date.now()}`;
  const device = await GpsDevice.create({
    tenantId,
    connectionId,
    internalDeviceCode: `GPS-${marker}`,
    providerDeviceId: `provider-${marker}`,
    status: 'unassigned',
    createdBy: 'webhook-security-test',
    updatedBy: 'webhook-security-test',
  });

  let verifyCalls = 0;
  let normalizeCalls = 0;
  const baseAdapter = createMockGpsProviderAdapter({ connectionId, tenantId, webhookSecret, providerKey });
  gpsProviderRegistry.register(providerKey, () => ({
    ...baseAdapter,
    async verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer) {
      verifyCalls += 1;
      return baseAdapter.verifyWebhookSignature(headers, rawBody);
    },
    async normalizeWebhookPayload(rawBody: Buffer, headers: Readonly<Record<string, string>>) {
      normalizeCalls += 1;
      return baseAdapter.normalizeWebhookPayload(rawBody, headers);
    },
  } as typeof baseAdapter));

  return {
    tenantId,
    connectionId,
    device,
    callCounts: () => ({ verifyCalls, normalizeCalls }),
  };
}

async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsTelemetryPoint.deleteMany({ tenantId }),
    GpsWebhookEvent.deleteMany({ tenantId }),
  ]);
}

function goodPayload(providerDeviceId: string): Buffer {
  return Buffer.from(JSON.stringify({
    points: [{ providerDeviceId, latitude: 12.9, longitude: 77.6, recordedAt: new Date().toISOString(), speedKph: 10 }],
  }));
}

test.describe('GPS webhook signature security (GPS-SECURITY-SPEC.md §3)', () => {
  test.setTimeout(30_000);

  test('valid signature is accepted and the point is stored', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'valid-sig-secret';
      const providerKey = `webhook-sec-valid-${Date.now()}`;
      const { tenantId, connectionId, device } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      const body = goodPayload(device.providerDeviceId);
      const signedHeaders = signMockWebhookPayload(body, secret);

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers: signedHeaders, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ stored: 1, failed: 0 });
      const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
      expect(event?.processingStatus).toBe('verified_stored');
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('invalid signature (wrong secret) is rejected with 401 and normalizeWebhookPayload is never called', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'correct-secret';
      const providerKey = `webhook-sec-invalid-${Date.now()}`;
      const { tenantId, connectionId, device, callCounts } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      const body = goodPayload(device.providerDeviceId);
      // Signed with the WRONG secret — a forged/corrupted signature.
      const badHeaders = signMockWebhookPayload(body, 'attacker-guessed-secret');

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers: badHeaders, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(401);
      const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
      expect(event?.processingStatus).toBe('signature_rejected');
      const stored = await GpsTelemetryPoint.findOne({ tenantId }).lean();
      expect(stored).toBeNull();
      // Downstream JSON parsing/normalization must never run once the
      // signature check has failed.
      expect(callCounts().normalizeCalls).toBe(0);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('a well-formed signature computed over a replayed (stale-timestamp) request is rejected — replay-window protection', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'replay-test-secret';
      const providerKey = `webhook-sec-replay-${Date.now()}`;
      const { tenantId, connectionId, device, callCounts } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      const body = goodPayload(device.providerDeviceId);
      // A genuinely correct HMAC for this exact body+secret, but computed
      // against a timestamp well outside MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
      // — simulates an attacker (or a broken retry) replaying a captured,
      // otherwise-valid signed request long after it was issued.
      const staleTimestamp = Math.floor(Date.now() / 1000) - (MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS + 120);
      const staleHeaders = signMockWebhookPayload(body, secret, staleTimestamp);

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers: staleHeaders, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(401);
      const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
      expect(event?.processingStatus).toBe('signature_rejected');
      const stored = await GpsTelemetryPoint.findOne({ tenantId }).lean();
      expect(stored).toBeNull();
      expect(callCounts().normalizeCalls).toBe(0);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('a request signed exactly at the edge of the tolerance window is still accepted (not an off-by-one on the boundary)', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'boundary-secret';
      const providerKey = `webhook-sec-boundary-${Date.now()}`;
      const { tenantId, connectionId, device } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      const body = goodPayload(device.providerDeviceId);
      const justInsideTimestamp = Math.floor(Date.now() / 1000) - (MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS - 5);
      const headers = signMockWebhookPayload(body, secret, justInsideTimestamp);

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(200);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('malformed (non-JSON) body with a VALID signature is rejected with 400 before any point is stored', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'malformed-body-secret';
      const providerKey = `webhook-sec-malformed-${Date.now()}`;
      const { tenantId, connectionId } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      // Not valid JSON at all — the signature is computed correctly over
      // these exact (garbage) bytes, proving the rejection here is
      // specifically the body-parsing stage, not signature verification.
      const body = Buffer.from('{not-json-at-all::');
      const headers = signMockWebhookPayload(body, secret);

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers, rawBody: body } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(400);
      const stored = await GpsTelemetryPoint.findOne({ tenantId }).lean();
      expect(stored).toBeNull();
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('signature check runs before JSON parsing: a bad signature over a malformed body still yields signature_rejected, never a parse error', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const secret = 'order-of-operations-secret';
      const providerKey = `webhook-sec-order-${Date.now()}`;
      const { tenantId, connectionId, callCounts } = await makeSignedConnectionAndDevice(providerKey, secret);
      cleanupTenantId = tenantId;

      const malformedBody = Buffer.from('{not-json-at-all::');
      const badHeaders = signMockWebhookPayload(malformedBody, 'wrong-secret');

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = { params: { connectionId }, headers: badHeaders, rawBody: malformedBody } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      expect(res.statusCode).toBe(401);
      const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
      expect(event?.processingStatus).toBe('signature_rejected');
      expect(callCounts().normalizeCalls).toBe(0); // JSON.parse (inside normalizeWebhookPayload) never reached
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });
});
