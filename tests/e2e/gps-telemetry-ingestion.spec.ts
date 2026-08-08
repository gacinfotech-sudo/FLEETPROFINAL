// Tests for TASK-GPS-INGESTION-04. Two groups:
//
// 1. Pure unit tests (movingStatus derivation, dedup key, retry/backoff) —
//    no DB, no live server, matching the style of
//    tests/e2e/gps-provider-registry.spec.ts.
// 2. DB-backed tests (storage/dedup, position-history/latest-state queries,
//    the polling scheduler including a simulated provider outage, and the
//    webhook receiver's capability gate + signature verification) —
//    connect directly to `process.env.MONGODB_URI`, matching the style of
//    tests/e2e/gps-device-master.spec.ts's first ("no live server") test.
//    No real provider adapter exists in this worktree (TASK-GPS-CONNECTION-02
//    owns that, on a separate branch), so these tests register their own
//    fake in-memory adapters on the shared runtime registry under
//    test-only provider keys, exactly the pattern
//    tests/e2e/gps-provider-registry.spec.ts uses for a fresh registry
//    instance — here the shared singleton is used because webhookRoute.ts
//    hard-imports it (see its file header for why), so a test-only
//    provider key (never colliding with a real one) is registered on it
//    instead of constructing a second instance.

import { expect, test } from '@playwright/test';
import type { Express, NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { gpsProviderRegistry } from '../../server/gps/providers/runtimeRegistry';
import type { GpsProviderAdapter } from '../../server/gps/providers/adapter';
import type { NormalizedTelemetryPoint } from '../../server/gps/types';
import type { ProviderTelemetryPoint } from '../../server/gps/telemetry/types';
import {
  deriveMovingStatus,
  DEFAULT_MOVING_STATUS_DEBOUNCE_MS,
} from '../../server/gps/telemetry/movingStatus';
import { buildTelemetryDedupKey, dedupeTelemetryBatch } from '../../server/gps/telemetry/dedupKey';
import { storeTelemetryPoint } from '../../server/gps/telemetry/store';
import { getLatestVehicleState, getPositionHistoryByRange } from '../../server/gps/telemetry/queries';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import { GpsVehicleLatestState } from '../../server/gps/telemetry/models/vehicleLatestState';
import { withRetryBackoff } from '../../server/gps/ingestion/retry';
import { runPollingTick } from '../../server/gps/ingestion/pollingScheduler';
import { GpsPollCursor } from '../../server/gps/ingestion/models/pollCursor';
import { GpsIngestionDeadLetter } from '../../server/gps/ingestion/models/deadLetter';
import { GpsWebhookEvent } from '../../server/gps/ingestion/models/webhookEvent';
import { registerGpsWebhookRoutes } from '../../server/gps/ingestion/webhookRoute';

// ---------------------------------------------------------------------------
// Group 1: pure unit tests — no DB.
// ---------------------------------------------------------------------------

test.describe('deriveMovingStatus (pure, provider-field-name-independent)', () => {
  test('motion=true is moving regardless of speed/ignition', () => {
    const result = deriveMovingStatus({ motion: true, ignition: false, speedKph: 0, recordedAt: new Date() });
    expect(result.status).toBe('moving');
  });

  test('motion=false is stopped regardless of speed', () => {
    const result = deriveMovingStatus({ motion: false, speedKph: 40, recordedAt: new Date() });
    expect(result.status).toBe('stopped');
  });

  test('ignition=false is stopped when motion is unknown', () => {
    const result = deriveMovingStatus({ ignition: false, speedKph: 30, recordedAt: new Date() });
    expect(result.status).toBe('stopped');
  });

  test('a fix older than the staleness timeout is offline', () => {
    const now = new Date('2026-08-07T12:00:00Z');
    const recordedAt = new Date(now.getTime() - 601_000); // > 600s default
    const result = deriveMovingStatus({ motion: true, recordedAt, now });
    expect(result.status).toBe('offline');
  });

  test('a fix within the staleness timeout is not offline', () => {
    const now = new Date('2026-08-07T12:00:00Z');
    const recordedAt = new Date(now.getTime() - 599_000);
    const result = deriveMovingStatus({ motion: false, recordedAt, now });
    expect(result.status).not.toBe('offline');
  });

  test('speed above threshold but under the debounce window holds the previous status (no flapping on GPS noise)', () => {
    const t0 = new Date('2026-08-07T12:00:00Z');
    const first = deriveMovingStatus({ speedKph: 15, recordedAt: t0, now: t0 });
    expect(first.status).toBe('stopped'); // held at previous default; not yet debounced

    const t1 = new Date(t0.getTime() + 60_000); // 1 minute later — under the 5-minute debounce
    const second = deriveMovingStatus({
      speedKph: 15,
      recordedAt: t1,
      now: t1,
      previous: { status: first.status, since: first.since, sustainedAboveThresholdSince: first.sustainedAboveThresholdSince },
    });
    expect(second.status).toBe('stopped');
  });

  test('speed above threshold sustained past the debounce window transitions to moving', () => {
    const t0 = new Date('2026-08-07T12:00:00Z');
    let state = deriveMovingStatus({ speedKph: 15, recordedAt: t0, now: t0 });

    const t1 = new Date(t0.getTime() + DEFAULT_MOVING_STATUS_DEBOUNCE_MS + 1000);
    state = deriveMovingStatus({
      speedKph: 15,
      recordedAt: t1,
      now: t1,
      previous: { status: state.status, since: state.since, sustainedAboveThresholdSince: state.sustainedAboveThresholdSince },
    });
    expect(state.status).toBe('moving');
  });

  test('speed at or below the threshold is stopped, not debounced toward moving', () => {
    const now = new Date('2026-08-07T12:00:00Z');
    const result = deriveMovingStatus({ speedKph: 3, recordedAt: now, now });
    expect(result.status).toBe('stopped');
  });
});

test.describe('telemetry dedup key (pure)', () => {
  test('same (tenant, gpsDeviceId, recordedAt) produces the same key regardless of source', () => {
    const recordedAt = new Date('2026-08-07T09:59:55.000Z');
    const pollKey = buildTelemetryDedupKey({ tenantId: 't1', gpsDeviceId: 'd1', recordedAt });
    const webhookKey = buildTelemetryDedupKey({ tenantId: 't1', gpsDeviceId: 'd1', recordedAt: new Date(recordedAt) });
    expect(pollKey).toBe(webhookKey);
  });

  test('a different device or a different millisecond produces a different key', () => {
    const recordedAt = new Date('2026-08-07T09:59:55.000Z');
    const base = buildTelemetryDedupKey({ tenantId: 't1', gpsDeviceId: 'd1', recordedAt });
    expect(buildTelemetryDedupKey({ tenantId: 't1', gpsDeviceId: 'd2', recordedAt })).not.toBe(base);
    expect(buildTelemetryDedupKey({ tenantId: 't1', gpsDeviceId: 'd1', recordedAt: new Date(recordedAt.getTime() + 1) })).not.toBe(base);
  });

  test('dedupeTelemetryBatch keeps only the first occurrence per key', () => {
    const recordedAt = new Date('2026-08-07T09:59:55.000Z');
    const points = [
      { tenantId: 't1', gpsDeviceId: 'd1', recordedAt, tag: 'first' },
      { tenantId: 't1', gpsDeviceId: 'd1', recordedAt: new Date(recordedAt), tag: 'duplicate' },
      { tenantId: 't1', gpsDeviceId: 'd1', recordedAt: new Date(recordedAt.getTime() + 1000), tag: 'distinct' },
    ];
    const result = dedupeTelemetryBatch(points);
    expect(result.map((p) => p.tag)).toEqual(['first', 'distinct']);
  });
});

test.describe('withRetryBackoff (pure)', () => {
  test('succeeds after transient failures without exhausting attempts', async () => {
    let calls = 0;
    const result = await withRetryBackoff(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`transient failure ${calls}`);
        return 'ok';
      },
      { maxAttempts: 4, baseDelayMs: 1, factor: 1, maxDelayMs: 1, sleep: async () => {} },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  test('throws the last error once attempts are exhausted, having tried exactly maxAttempts times', async () => {
    let calls = 0;
    await expect(
      withRetryBackoff(
        async () => {
          calls += 1;
          throw new Error(`failure ${calls}`);
        },
        { maxAttempts: 4, baseDelayMs: 1, factor: 1, maxDelayMs: 1, sleep: async () => {} },
      ),
    ).rejects.toThrow('failure 4');
    expect(calls).toBe(4);
  });

  test('delays grow exponentially and are capped at maxDelayMs', async () => {
    const delays: number[] = [];
    await expect(
      withRetryBackoff(
        async () => {
          throw new Error('always fails');
        },
        {
          maxAttempts: 4,
          baseDelayMs: 100,
          factor: 2,
          maxDelayMs: 300,
          sleep: async (ms: number) => {
            delays.push(ms);
          },
        },
      ),
    ).rejects.toThrow();
    // 100, 200, 400->capped 300 (only 3 sleeps between 4 attempts)
    expect(delays).toEqual([100, 200, 300]);
  });
});

// ---------------------------------------------------------------------------
// Group 2: DB-backed tests.
// ---------------------------------------------------------------------------

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS telemetry ingestion verification.');
  return process.env.MONGODB_URI;
}

async function makeConnectionAndDevices(providerKey: string, pollingIntervalSeconds = 30) {
  const tenantId = new mongoose.Types.ObjectId().toString();
  const connection = await GpsConnection.create({
    tenantId,
    connectionName: `Ingestion test ${providerKey}`,
    providerKey,
    authenticationType: 'api_key',
    pollingIntervalSeconds,
    enabled: true,
    status: 'connected',
    createdBy: 'ingestion-test',
    updatedBy: 'ingestion-test',
  });
  const connectionId = connection.id;

  const marker = `${providerKey}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const deviceA = await GpsDevice.create({
    tenantId,
    connectionId,
    internalDeviceCode: `GPS-${marker}-A`,
    providerDeviceId: `provider-${marker}-A`,
    status: 'unassigned',
    createdBy: 'ingestion-test',
    updatedBy: 'ingestion-test',
  });
  const deviceB = await GpsDevice.create({
    tenantId,
    connectionId,
    internalDeviceCode: `GPS-${marker}-B`,
    providerDeviceId: `provider-${marker}-B`,
    status: 'unassigned',
    createdBy: 'ingestion-test',
    updatedBy: 'ingestion-test',
  });

  return { tenantId, connectionId, deviceA, deviceB };
}

/**
 * This worktree shares one MongoDB instance/database across every worktree
 * in the sandbox (`mongodb://127.0.0.1:27017/fleetpro`, per `.env`), and
 * `runPollingTick()` deliberately scans *all* enabled connections (that's
 * correct production behavior — it's a tenant-agnostic background poller).
 * Left-over fixtures from a previous run of this same spec file would
 * otherwise accumulate indefinitely and get re-scanned (harmlessly, but
 * slowly and noisily) by every later run's polling-tick tests. Every
 * DB-backed test below cleans up its own tenantId's data in a `finally`
 * block.
 */
async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsTelemetryPoint.deleteMany({ tenantId }),
    GpsVehicleLatestState.deleteMany({ tenantId }),
    GpsPollCursor.deleteMany({ tenantId }),
    GpsIngestionDeadLetter.deleteMany({ tenantId }),
    GpsWebhookEvent.deleteMany({ tenantId }),
  ]);
}

function fakePoint(overrides: Partial<ProviderTelemetryPoint> & { providerDeviceId: string; recordedAt: Date }): NormalizedTelemetryPoint {
  return {
    tenantId: 'placeholder', // overwritten by caller as needed
    connectionId: 'placeholder',
    gpsDeviceId: overrides.providerDeviceId, // adapter placeholder, per CONNECTION-02 report gap #2
    providerDeviceId: overrides.providerDeviceId,
    recordedAt: overrides.recordedAt,
    receivedAt: overrides.receivedAt ?? overrides.recordedAt,
    latitude: overrides.latitude ?? 12.9716,
    longitude: overrides.longitude ?? 77.5946,
    speedKph: overrides.speedKph,
    motion: overrides.motion,
    ignition: overrides.ignition,
    source: overrides.source ?? 'polling',
  };
}

test('storeTelemetryPoint dedups the same fix arriving twice (poll + webhook cannot double-store)', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const { tenantId, connectionId, deviceA } = await makeConnectionAndDevices('test-store-provider');
    cleanupTenantId = tenantId;
    const recordedAt = new Date('2026-08-07T10:00:00.000Z');
    const point: NormalizedTelemetryPoint = {
      tenantId,
      connectionId,
      gpsDeviceId: deviceA.id,
      providerDeviceId: deviceA.providerDeviceId,
      recordedAt,
      receivedAt: recordedAt,
      latitude: 12.9716,
      longitude: 77.5946,
      speedKph: 40,
      motion: true,
      source: 'polling',
    };

    const first = await storeTelemetryPoint(point);
    expect(first).toEqual({ stored: true, duplicate: false, movingStatus: 'moving' });

    // Simulate the identical fix arriving again via a different source (e.g. webhook).
    const second = await storeTelemetryPoint({ ...point, source: 'webhook' });
    expect(second.duplicate).toBe(true);
    expect(second.stored).toBe(false);

    const count = await GpsTelemetryPoint.countDocuments({ tenantId, gpsDeviceId: deviceA.id });
    expect(count).toBe(1);

    const latest = await getLatestVehicleState({ tenantId, gpsDeviceId: deviceA.id });
    expect(latest?.movingStatus).toBe('moving');
    expect(latest?.recordedAt.toISOString()).toBe(recordedAt.toISOString());
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('getPositionHistoryByRange returns points sorted ascending within the requested window', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const { tenantId, deviceA } = await makeConnectionAndDevices('test-history-provider');
    cleanupTenantId = tenantId;
    const base = new Date('2026-08-07T08:00:00.000Z');
    const times = [30, 10, 20, 90].map((min) => new Date(base.getTime() + min * 60_000));
    for (const recordedAt of times) {
      await storeTelemetryPoint({
        tenantId,
        connectionId: deviceA.connectionId.toString(),
        gpsDeviceId: deviceA.id,
        providerDeviceId: deviceA.providerDeviceId,
        recordedAt,
        receivedAt: recordedAt,
        latitude: 12.97,
        longitude: 77.59,
        source: 'history_sync',
      });
    }

    const history = await getPositionHistoryByRange({
      tenantId,
      gpsDeviceId: deviceA.id,
      startDateTime: new Date(base.getTime() + 5 * 60_000),
      endDateTime: new Date(base.getTime() + 40 * 60_000),
    });
    expect(history.map((p) => p.recordedAt.getTime())).toEqual(
      [10, 20, 30].map((min) => base.getTime() + min * 60_000),
    );
    for (const point of history) {
      expect(point.movingStatus).toBeDefined();
    }
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('polling scheduler stores points from a healthy connection and respects the due-check (no re-fetch before pollingIntervalSeconds elapses)', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const providerKey = `test-poll-ok-${Date.now()}`;
    const { tenantId, connectionId, deviceA } = await makeConnectionAndDevices(providerKey, 30);
    cleanupTenantId = tenantId;

    let calls = 0;
    let now = new Date('2026-08-07T10:00:00.000Z');
    gpsProviderRegistry.register(providerKey, () => ({
      providerKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async (providerDeviceId: string) => {
        calls += 1;
        return fakePoint({ providerDeviceId, recordedAt: new Date(now), motion: true, speedKph: 50 });
      },
      getPositionHistory: async () => [],
    } satisfies GpsProviderAdapter));

    const tick1 = await runPollingTick({ now: () => now });
    expect(tick1.devicesFailed).toBe(0);
    expect(calls).toBeGreaterThanOrEqual(1);

    const storedCount = await GpsTelemetryPoint.countDocuments({ tenantId, gpsDeviceId: deviceA.id });
    expect(storedCount).toBe(1);

    const cursor = await GpsPollCursor.findOne({ tenantId, connectionId, gpsDeviceId: deviceA.id }).lean();
    expect(cursor?.lastPollStatus).toBe('success');

    // Immediately re-run the tick with the same `now` — nothing is due yet
    // (pollingIntervalSeconds=30s), so the adapter must not be called again.
    const callsBeforeSecondTick = calls;
    const tick2 = await runPollingTick({ now: () => now });
    expect(tick2.devicesSkipped).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(callsBeforeSecondTick);

    // Advance past the polling interval — now it should poll again. Each
    // connection has 2 devices (see makeConnectionAndDevices), so both are
    // due and getLatestPosition is called once per device.
    now = new Date(now.getTime() + 31_000);
    await runPollingTick({ now: () => now });
    expect(calls).toBe(callsBeforeSecondTick + 2);
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('a simulated provider outage retries with backoff, never crashes the tick, and eventually dead-letters — then resolves on recovery', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantIds: string[] = [];
  try {
    const okProviderKey = `test-poll-ok2-${Date.now()}`;
    const failProviderKey = `test-poll-fail-${Date.now()}`;
    const ok = await makeConnectionAndDevices(okProviderKey, 30);
    const fail = await makeConnectionAndDevices(failProviderKey, 30);
    cleanupTenantIds = [ok.tenantId, fail.tenantId];

    gpsProviderRegistry.register(okProviderKey, () => ({
      providerKey: okProviderKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async (providerDeviceId: string) => fakePoint({ providerDeviceId, recordedAt: new Date(), motion: false }),
      getPositionHistory: async () => [],
    } satisfies GpsProviderAdapter));

    let attempts = 0;
    let shouldFail = true; // flipped to simulate provider recovery, later in this test
    gpsProviderRegistry.register(failProviderKey, () => ({
      providerKey: failProviderKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async (providerDeviceId: string) => {
        attempts += 1;
        if (shouldFail) throw new Error('simulated provider outage');
        return fakePoint({ providerDeviceId, recordedAt: new Date(), motion: false });
      },
      getPositionHistory: async () => {
        if (shouldFail) throw new Error('simulated provider outage');
        return [];
      },
    } satisfies GpsProviderAdapter));

    const summary = await runPollingTick({
      retryOptions: { maxAttempts: 3, baseDelayMs: 1, factor: 1, maxDelayMs: 1, sleep: async () => {} },
    });

    // The failing connection's devices count as failed, but the healthy
    // connection in the same tick must still have been polled successfully
    // — one connection's outage must never crash/block the whole poller.
    expect(summary.devicesFailed).toBeGreaterThanOrEqual(2); // fail's deviceA + deviceB
    expect(summary.devicesPolled).toBeGreaterThanOrEqual(2); // ok's deviceA + deviceB
    expect(attempts).toBe(3 * 2); // maxAttempts retried for each of fail's 2 devices, no silent short-circuit

    const okStored = await GpsTelemetryPoint.countDocuments({ tenantId: ok.tenantId });
    expect(okStored).toBe(2);
    const failStored = await GpsTelemetryPoint.countDocuments({ tenantId: fail.tenantId });
    expect(failStored).toBe(0); // no data was silently fabricated/lost-but-pretended-stored

    const deadLetter = await GpsIngestionDeadLetter.findOne({
      tenantId: fail.tenantId,
      connectionId: fail.connectionId,
      gpsDeviceId: fail.deviceA.id,
    }).lean();
    expect(deadLetter?.status).toBe('open');
    expect(deadLetter?.source).toBe('polling');
    expect(deadLetter?.failureCycles).toBe(1);
    expect(deadLetter?.lastErrorMessage).toContain('simulated provider outage');

    const cursor = await GpsPollCursor.findOne({ tenantId: fail.tenantId, gpsDeviceId: fail.deviceA.id }).lean();
    expect(cursor?.lastPollStatus).toBe('failed');
    expect(cursor?.consecutiveFailures).toBe(1);

    // Now make the "failing" provider recover — the dead-letter should
    // resolve on the next successful poll rather than accumulate a second
    // open row. The registry only ever returns one adapter instance per
    // `getAdapter()` call (registry.ts calls the factory fresh each time),
    // so flipping this closure flag before the next tick is a faithful
    // simulation of "the provider started responding again."
    shouldFail = false;

    const later = new Date(Date.now() + 60_000);
    await runPollingTick({ now: () => later });

    const resolved = await GpsIngestionDeadLetter.findOne({
      tenantId: fail.tenantId,
      connectionId: fail.connectionId,
      gpsDeviceId: fail.deviceA.id,
    }).lean();
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolvedAt).toBeTruthy();
    expect(resolved?.expiresAt).toBeTruthy();
  } finally {
    await Promise.all(cleanupTenantIds.map((tenantId) => cleanupTenantFixtures(tenantId)));
    await mongoose.disconnect();
  }
});

// --- Webhook receiver -------------------------------------------------

function fakeExpressApp() {
  const handlers = new Map<string, (req: Request, res: Response, next: NextFunction) => unknown>();
  const app = {
    post(path: string, ...mws: Array<(req: Request, res: Response, next: NextFunction) => unknown>) {
      handlers.set(path, mws[mws.length - 1]);
    },
  } as unknown as Express;
  return { app, handlers };
}

// registerGpsWebhookRoutes's route handler is wrapped in a fire-and-forget
// `safeAsync` (Promise.resolve(handler(req,res)).catch(next) — same pattern
// as the rest of this codebase's route files, e.g. routes/connections.ts),
// so calling `handler(req, res, next)` returns before the async work below
// it has actually finished; `await handler(...)` alone is not enough to
// observe the final response. `done` resolves exactly when `res.json()` is
// called (every code path in the handler ends that way) or rejects if an
// unexpected error reaches `next(error)`, giving a real completion signal
// (and a real error message on the rare bug, instead of a hang until the
// test's own timeout).
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

test('webhook receiver rejects an unknown connection id without touching the DB', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  try {
    const { app, handlers } = fakeExpressApp();
    registerGpsWebhookRoutes(app);
    const handler = handlers.get('/api/gps/webhooks/:connectionId')!;

    const req = { params: { connectionId: new mongoose.Types.ObjectId().toString() }, headers: {} } as unknown as Request;
    const { res, next, done } = fakeResponseCycle();
    handler(req, res, next);
    await done;
    expect(res.statusCode).toBe(404);
  } finally {
    await mongoose.disconnect();
  }
});

test('webhook receiver returns 501 (capability-gated) for a provider with no verifyWebhookSignature — e.g. Traccar today', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const providerKey = `test-webhook-unsigned-${Date.now()}`;
    const { tenantId, connectionId } = await makeConnectionAndDevices(providerKey);
    cleanupTenantId = tenantId;
    gpsProviderRegistry.register(providerKey, () => ({
      providerKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async () => null,
      getPositionHistory: async () => [],
      // deliberately no verifyWebhookSignature — matches Traccar today
    } satisfies GpsProviderAdapter));

    const { app, handlers } = fakeExpressApp();
    registerGpsWebhookRoutes(app);
    const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
    const req = {
      params: { connectionId },
      headers: {},
      rawBody: Buffer.from('{}'),
    } as unknown as Request;
    const { res, next, done } = fakeResponseCycle();
    handler(req, res, next);
    await done;

    expect(res.statusCode).toBe(501);
    const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
    expect(event?.processingStatus).toBe('unsupported_provider');
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('webhook receiver fails closed (500) when raw body capture is unavailable, and 401s on a bad signature', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const providerKey = `test-webhook-signed-${Date.now()}`;
    const { tenantId, connectionId } = await makeConnectionAndDevices(providerKey);
    cleanupTenantId = tenantId;
    gpsProviderRegistry.register(providerKey, () => ({
      providerKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async () => null,
      getPositionHistory: async () => [],
      verifyWebhookSignature: async () => false, // simulates a bad/forged signature
    } satisfies GpsProviderAdapter));

    const { app, handlers } = fakeExpressApp();
    registerGpsWebhookRoutes(app);
    const handler = handlers.get('/api/gps/webhooks/:connectionId')!;

    // No rawBody on the request at all — simulates a deployment missing the
    // server/index.ts express.json({verify}) patch this route depends on.
    const reqNoRawBody = { params: { connectionId }, headers: {} } as unknown as Request;
    const cycle1 = fakeResponseCycle();
    handler(reqNoRawBody, cycle1.res, cycle1.next);
    await cycle1.done;
    expect(cycle1.res.statusCode).toBe(500);

    const reqBadSig = { params: { connectionId }, headers: {}, rawBody: Buffer.from('{"lat":1}') } as unknown as Request;
    const cycle2 = fakeResponseCycle();
    handler(reqBadSig, cycle2.res, cycle2.next);
    await cycle2.done;
    expect(cycle2.res.statusCode).toBe(401);

    const event = await GpsWebhookEvent.findOne({ tenantId, connectionId, processingStatus: 'signature_rejected' }).lean();
    expect(event).toBeTruthy();
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('webhook receiver stores a verified point end-to-end and resolves the internal gpsDeviceId', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const providerKey = `test-webhook-full-${Date.now()}`;
    const { tenantId, connectionId, deviceA } = await makeConnectionAndDevices(providerKey);
    cleanupTenantId = tenantId;
    const recordedAt = new Date('2026-08-07T11:00:00.000Z');

    gpsProviderRegistry.register(providerKey, () => ({
      providerKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async () => null,
      getPositionHistory: async () => [],
      verifyWebhookSignature: async () => true,
      normalizeWebhookPayload: async () => [
        {
          providerDeviceId: deviceA.providerDeviceId,
          recordedAt,
          receivedAt: recordedAt,
          latitude: 1.23,
          longitude: 4.56,
          motion: true,
          source: 'webhook' as const,
        },
      ],
    } satisfies GpsProviderAdapter));

    const { app, handlers } = fakeExpressApp();
    registerGpsWebhookRoutes(app);
    const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
    const req = { params: { connectionId }, headers: {}, rawBody: Buffer.from('{"ok":true}') } as unknown as Request;
    const { res, next, done } = fakeResponseCycle();
    handler(req, res, next);
    await done;

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: 1, stored: 1, unmapped: 0, failed: 0 });

    const stored = await GpsTelemetryPoint.findOne({ tenantId, gpsDeviceId: deviceA.id }).lean();
    expect(stored?.latitude).toBe(1.23);
    expect(stored?.source).toBe('webhook');

    const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
    expect(event?.processingStatus).toBe('verified_stored');
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});

test('webhook receiver counts an unmapped provider device id without crashing (device sync race)', async () => {
  const MONGODB_URI = requireMongoUri();
  await mongoose.connect(MONGODB_URI);
  let cleanupTenantId: string | undefined;
  try {
    const providerKey = `test-webhook-unmapped-${Date.now()}`;
    const { tenantId, connectionId } = await makeConnectionAndDevices(providerKey);
    cleanupTenantId = tenantId;

    gpsProviderRegistry.register(providerKey, () => ({
      providerKey,
      testConnection: async () => ({ success: true, status: 'connected' as const, checkedAt: new Date() }),
      listDevices: async () => [],
      getDevice: async () => { throw new Error('not used'); },
      getLatestPosition: async () => null,
      getPositionHistory: async () => [],
      verifyWebhookSignature: async () => true,
      normalizeWebhookPayload: async () => [
        {
          providerDeviceId: 'never-synced-device-id',
          recordedAt: new Date(),
          receivedAt: new Date(),
          latitude: 1,
          longitude: 1,
          source: 'webhook' as const,
        },
      ],
    } satisfies GpsProviderAdapter));

    const { app, handlers } = fakeExpressApp();
    registerGpsWebhookRoutes(app);
    const handler = handlers.get('/api/gps/webhooks/:connectionId')!;
    const req = { params: { connectionId }, headers: {}, rawBody: Buffer.from('{}') } as unknown as Request;
    const { res, next, done } = fakeResponseCycle();
    handler(req, res, next);
    await done;

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: 1, stored: 0, unmapped: 1, failed: 0 });
    const event = await GpsWebhookEvent.findOne({ tenantId, connectionId }).lean();
    expect(event?.processingStatus).toBe('unmapped_device');
  } finally {
    if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
    await mongoose.disconnect();
  }
});
