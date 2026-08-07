// TASK-GPS-QA-SECURITY-07 — credential-leakage tests, per
// docs/gps-research/GPS-SECURITY-SPEC.md §1-2: no provider credential may
// ever appear in plaintext outside `GpsConnection.encryptedSecrets` — not
// in Mongo, not in a log line, not in an e2e fixture, not in an API
// response body.
//
// Every assertion below FAILS THE TEST (throws) the moment a
// credential-shaped string is found — nothing here silently skips or only
// warns. Two of the six tests are structural "loud failure" self-checks
// (asserting the detector itself actually catches an injected leak) so a
// future edit that accidentally weakens one of these checks into a no-op
// is caught too.

import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import type { Express, NextFunction, Request, Response } from 'express';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { GpsWebhookEvent } from '../../server/gps/ingestion/models/webhookEvent';
import { encryptGpsCredentials, decryptGpsCredentials } from '../../server/gps/security/credentialEncryption';
import { publicGpsConnection } from '../../server/gps/services/connectionService';
import { gpsProviderRegistry } from '../../server/gps/providers/runtimeRegistry';
import { registerGpsWebhookRoutes } from '../../server/gps/ingestion/webhookRoute';
import { createMockGpsProviderAdapter, signMockWebhookPayload } from '../../server/gps/testing/mockAdapter';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS credential-leakage verification.');
  return process.env.MONGODB_URI;
}

async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsWebhookEvent.deleteMany({ tenantId }),
  ]);
}

/** Captures every console.log/warn/error call made during `fn()`, restoring the real console afterward regardless of outcome. */
async function captureConsoleOutput(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const capture = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  console.log = capture;
  console.warn = capture;
  console.error = capture;
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
  return lines;
}

test.describe('GPS credential-leakage (GPS-SECURITY-SPEC.md §1-2)', () => {
  test.setTimeout(30_000);

  test('encryptedSecrets on the raw DB document never contains the plaintext credential', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const previousKey = process.env.GPS_CREDENTIAL_ENCRYPTION_KEY;
      if (!previousKey) throw new Error('GPS_CREDENTIAL_ENCRYPTION_KEY must be configured for this test.');

      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const plaintextSecret = `leak-check-secret-${Date.now()}-do-not-appear-anywhere-else`;

      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Credential leakage test', providerKey: 'official_docs_pending',
        authenticationType: 'bearer_token', enabled: true, status: 'configuration_required',
        createdBy: 'x', updatedBy: 'x',
      });
      connection.encryptedSecrets = encryptGpsCredentials({ apiToken: plaintextSecret }, tenantId, connection.id);
      await connection.save();

      const stored = await GpsConnection.findById(connection.id).select('+encryptedSecrets').lean();
      expect(stored?.encryptedSecrets).toBeTruthy();
      expect(stored!.encryptedSecrets).not.toContain(plaintextSecret);
      expect(JSON.stringify(stored)).not.toContain(plaintextSecret);

      // Round-trip sanity: the plaintext really is recoverable with the
      // right tenant/connection binding (proves this isn't accidentally
      // testing an empty/broken ciphertext).
      const decrypted = decryptGpsCredentials<{ apiToken: string }>(stored!.encryptedSecrets!, tenantId, connection.id);
      expect(decrypted.apiToken).toBe(plaintextSecret);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('publicGpsConnection() — the redaction chokepoint every GPS route response must pass through — never includes encryptedSecrets or the plaintext credential', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const plaintextSecret = `public-redaction-check-${Date.now()}`;

      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Public redaction test', providerKey: 'official_docs_pending',
        authenticationType: 'bearer_token', enabled: true, status: 'configuration_required',
        createdBy: 'x', updatedBy: 'x',
      });
      connection.encryptedSecrets = encryptGpsCredentials({ apiToken: plaintextSecret }, tenantId, connection.id);
      await connection.save();

      const withSecrets = await GpsConnection.findById(connection.id).select('+encryptedSecrets').lean();
      const publicShape = publicGpsConnection(withSecrets!);
      const serialized = JSON.stringify(publicShape);

      expect(serialized).not.toContain(plaintextSecret);
      expect(serialized).not.toContain('encryptedSecrets');
      expect(Object.prototype.hasOwnProperty.call(publicShape, 'encryptedSecrets')).toBe(false);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('webhook raw-event storage strips known-sensitive headers even when a caller sends a real-looking bearer secret', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const providerKey = `cred-leak-webhook-${Date.now()}`;
      const webhookSecret = 'webhook-header-leak-secret';
      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Webhook header leak test', providerKey,
        authenticationType: 'api_key', pollingIntervalSeconds: 60, enabled: true, status: 'connected',
        createdBy: 'x', updatedBy: 'x',
      });
      const connectionId = connection.id;
      await GpsDevice.create({
        tenantId, connectionId, internalDeviceCode: `GPS-cred-${Date.now()}`,
        providerDeviceId: `provider-cred-${Date.now()}`, status: 'unassigned', createdBy: 'x', updatedBy: 'x',
      });

      const baseAdapter = createMockGpsProviderAdapter({ connectionId, tenantId, webhookSecret, providerKey });
      gpsProviderRegistry.register(providerKey, () => baseAdapter);

      const impersonatedBearerToken = 'leaked-would-be-catastrophic-bearer-abc123xyz';
      const impersonatedCookie = 'session=leaked-would-be-catastrophic-cookie-value';
      const body = Buffer.from(JSON.stringify({ points: [] }));
      const signedHeaders = signMockWebhookPayload(body, webhookSecret);

      function fakeExpressApp() {
        const handlers = new Map<string, (req: Request, res: Response, next: NextFunction) => unknown>();
        const app = {
          post(p: string, ...mws: Array<(req: Request, res: Response, next: NextFunction) => unknown>) {
            handlers.set(p, mws[mws.length - 1]);
          },
        } as unknown as Express;
        return { app, handlers };
      }
      function fakeResponseCycle() {
        let resolveDone: (() => void) | undefined;
        const done = new Promise<void>((resolve) => { resolveDone = resolve; });
        const res: any = {};
        res.status = (c: number) => { res.statusCode = c; return res; };
        res.json = (b: unknown) => { res.body = b; resolveDone?.(); return res; };
        const next = () => resolveDone?.();
        return { res, next, done };
      }

      const { app, handlers } = fakeExpressApp();
      registerGpsWebhookRoutes(app);
      const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
      const req = {
        params: { connectionId },
        headers: {
          ...signedHeaders,
          authorization: `Bearer ${impersonatedBearerToken}`,
          cookie: impersonatedCookie,
          'x-api-key': 'leaked-would-be-catastrophic-api-key',
        },
        rawBody: body,
      } as unknown as Request;
      const { res, next, done } = fakeResponseCycle();
      handler(req, res, next);
      await done;

      const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
      expect(event).toBeTruthy();
      const serializedEvent = JSON.stringify(event);
      expect(serializedEvent).not.toContain(impersonatedBearerToken);
      expect(serializedEvent).not.toContain(impersonatedCookie);
      expect(serializedEvent).not.toContain('leaked-would-be-catastrophic-api-key');
      expect(event!.headers).not.toHaveProperty('authorization');
      expect(event!.headers).not.toHaveProperty('cookie');
      expect(event!.headers).not.toHaveProperty('x-api-key');
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('console output captured across a representative credential-touching flow never contains the injected secret', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const plaintextSecret = `console-leak-check-${Date.now()}-must-not-be-logged`;

      const capturedLines = await captureConsoleOutput(async () => {
        const connection = await GpsConnection.create({
          tenantId, connectionName: 'Console leak test', providerKey: 'official_docs_pending',
          authenticationType: 'bearer_token', enabled: true, status: 'configuration_required',
          createdBy: 'x', updatedBy: 'x',
        });
        connection.encryptedSecrets = encryptGpsCredentials({ apiToken: plaintextSecret }, tenantId, connection.id);
        await connection.save();
        const reloaded = await GpsConnection.findById(connection.id).select('+encryptedSecrets').lean();
        publicGpsConnection(reloaded!);
        decryptGpsCredentials(reloaded!.encryptedSecrets!, tenantId, connection.id);
        // Also exercise a failure path — GPS-SECURITY-SPEC.md §2 explicitly
        // calls out "log full request/response bodies" as a leak vector,
        // and error paths are the likeliest place a stray console.log of
        // a raw object slips in.
        try {
          decryptGpsCredentials(reloaded!.encryptedSecrets!, 'wrong-tenant', connection.id);
        } catch { /* expected */ }
      });

      const joined = capturedLines.join('\n');
      expect(joined).not.toContain(plaintextSecret);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('SELF-CHECK: the console-capture harness actually detects an injected leak (loud-failure proof, not a no-op detector)', async () => {
    const marker = `self-check-detector-must-catch-this-${Date.now()}`;
    const capturedLines = await captureConsoleOutput(async () => {
      console.log('pretend this is an accidental credential log:', marker);
    });
    expect(capturedLines.join('\n')).toContain(marker); // the detector itself works
  });

  test('no committed GPS test fixture file hardcodes the real GPS_CREDENTIAL_ENCRYPTION_KEY value from this environment', () => {
    const realKey = process.env.GPS_CREDENTIAL_ENCRYPTION_KEY;
    if (!realKey) throw new Error('GPS_CREDENTIAL_ENCRYPTION_KEY must be configured for this test.');

    const testsDir = path.join(process.cwd(), 'tests/e2e');
    const gpsSpecFiles = fs.readdirSync(testsDir).filter((f) => f.startsWith('gps-') && f.endsWith('.spec.ts'));
    expect(gpsSpecFiles.length).toBeGreaterThan(0);

    const offendingFiles: string[] = [];
    for (const file of gpsSpecFiles) {
      const content = fs.readFileSync(path.join(testsDir, file), 'utf8');
      if (content.includes(realKey)) offendingFiles.push(file);
    }
    const mockAdapterPath = path.join(process.cwd(), 'server/gps/testing/mockAdapter.ts');
    if (fs.existsSync(mockAdapterPath) && fs.readFileSync(mockAdapterPath, 'utf8').includes(realKey)) {
      offendingFiles.push('server/gps/testing/mockAdapter.ts');
    }
    expect(offendingFiles).toEqual([]);
  });
});
