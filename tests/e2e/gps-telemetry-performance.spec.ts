// TASK-GPS-QA-SECURITY-07 — telemetry performance tests: ingestion
// throughput under a realistic multi-device polling load.
//
// Deliberately does NOT call the real `runPollingTick()`
// (server/gps/ingestion/pollingScheduler.ts) directly for this timing
// measurement: that function scans `GpsConnection.find({ enabled: true,
// status: { $ne: 'disabled' } })` tenant-agnostically across the ENTIRE
// shared MongoDB instance this sandbox's worktrees all point at (confirmed
// via a direct count against this environment: 39 enabled/non-disabled GPS
// connections already exist from sibling worktrees' fixtures at the time
// this file was written). A performance measurement built on top of that
// call would be timing however many of those 39 unrelated connections
// happen to resolve an adapter (some potentially attempting real DNS/HTTP
// calls against `.invalid` fixture hostnames) — noisy, non-reproducible,
// and not actually measuring this task's own code. Instead, this file
// reproduces the exact concurrency-bounded worker-pool pattern
// `runPollingTick()` itself uses per connection (queue + a fixed pool of
// concurrent workers, matching `MAX_CONCURRENT_DEVICE_POLLS_PER_CONNECTION
// = 5` in that file) against ONLY this test's own fixture devices, so the
// measurement is isolated and reproducible while still exercising the real,
// shared `storeTelemetryPoint()` persistence path end-to-end.

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import { GpsVehicleLatestState } from '../../server/gps/telemetry/models/vehicleLatestState';
import { storeTelemetryPoint } from '../../server/gps/telemetry/store';
import type { NormalizedTelemetryPoint } from '../../server/gps/types';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS telemetry performance verification.');
  return process.env.MONGODB_URI;
}

async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsTelemetryPoint.deleteMany({ tenantId }),
    GpsVehicleLatestState.deleteMany({ tenantId }),
  ]);
}

/** The same bounded worker-pool shape pollingScheduler.ts uses per connection (queue + fixed concurrency). */
async function runBoundedPool<T>(items: T[], concurrency: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) || 1 }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      await work(item);
    }
  });
  await Promise.all(workers);
}

test.describe('GPS telemetry ingestion performance (realistic multi-device polling load)', () => {
  test.setTimeout(60_000);

  test('a 40-device polling batch (concurrency-bounded, matching pollingScheduler.ts\'s worker-pool size of 5) completes and stores every fix within a generous bound', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Performance test fleet', providerKey: `perf-test-${Date.now()}`,
        authenticationType: 'api_key', pollingIntervalSeconds: 60, enabled: true, status: 'connected',
        createdBy: 'perf-test', updatedBy: 'perf-test',
      });
      const connectionId = connection.id;

      const DEVICE_COUNT = 40;
      const devices = await GpsDevice.insertMany(
        Array.from({ length: DEVICE_COUNT }, (_, i) => ({
          tenantId, connectionId, internalDeviceCode: `GPS-perf-${i}-${Date.now()}`,
          providerDeviceId: `provider-perf-${i}-${Date.now()}`, status: 'unassigned',
          createdBy: 'perf-test', updatedBy: 'perf-test',
        })),
      );

      // Simulated per-device provider latency, matching a realistic
      // "fetch one device's latest position over HTTP" cost — 20ms, well
      // below a real network round trip but enough for the concurrency
      // bound to matter for the total wall-clock time.
      const SIMULATED_PROVIDER_LATENCY_MS = 20;
      let maxConcurrentInFlight = 0;
      let currentInFlight = 0;

      const recordedAt = new Date();
      const startedAt = Date.now();

      await runBoundedPool(devices, 5, async (device) => {
        currentInFlight += 1;
        maxConcurrentInFlight = Math.max(maxConcurrentInFlight, currentInFlight);
        await new Promise((resolve) => setTimeout(resolve, SIMULATED_PROVIDER_LATENCY_MS));
        currentInFlight -= 1;

        const point: NormalizedTelemetryPoint = {
          tenantId, connectionId, gpsDeviceId: device.id, providerDeviceId: device.providerDeviceId,
          recordedAt, receivedAt: new Date(), latitude: 12.9 + Math.random() * 0.01, longitude: 77.6 + Math.random() * 0.01,
          speedKph: 20, motion: true, source: 'polling',
        };
        await storeTelemetryPoint(point);
      });

      const elapsedMs = Date.now() - startedAt;

      // Real concurrency happened (never fully serialized), and never
      // exceeded the production worker-pool's cap of 5.
      expect(maxConcurrentInFlight).toBeGreaterThan(1);
      expect(maxConcurrentInFlight).toBeLessThanOrEqual(5);

      // Wall clock should track ceil(40/5) * latency (= 8 * 20ms = 160ms)
      // plus real Mongo write overhead, not 40 * 20ms (= 800ms) serialized
      // — a generous 5s ceiling comfortably separates "genuinely
      // concurrent" from "accidentally serialized" even under a loaded CI
      // sandbox, without asserting a tight timing SLA that would be flaky.
      expect(elapsedMs).toBeLessThan(5000);

      const storedCount = await GpsTelemetryPoint.countDocuments({ tenantId, connectionId });
      expect(storedCount).toBe(DEVICE_COUNT);

      const latestStateCount = await GpsVehicleLatestState.countDocuments({ tenantId, connectionId });
      expect(latestStateCount).toBe(DEVICE_COUNT);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('sustained ingestion write throughput: 500 telemetry points across 25 devices persist correctly under concurrent load', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      cleanupTenantId = tenantId;
      const connection = await GpsConnection.create({
        tenantId, connectionName: 'Throughput test fleet', providerKey: `perf-throughput-${Date.now()}`,
        authenticationType: 'api_key', pollingIntervalSeconds: 60, enabled: true, status: 'connected',
        createdBy: 'perf-test', updatedBy: 'perf-test',
      });
      const connectionId = connection.id;

      const DEVICE_COUNT = 25;
      const POINTS_PER_DEVICE = 20; // 500 total — a realistic multi-poll-cycle history backlog
      const devices = await GpsDevice.insertMany(
        Array.from({ length: DEVICE_COUNT }, (_, i) => ({
          tenantId, connectionId, internalDeviceCode: `GPS-tp-${i}-${Date.now()}`,
          providerDeviceId: `provider-tp-${i}-${Date.now()}`, status: 'unassigned',
          createdBy: 'perf-test', updatedBy: 'perf-test',
        })),
      );

      const base = new Date('2026-08-07T06:00:00.000Z');
      const points: NormalizedTelemetryPoint[] = [];
      for (const device of devices) {
        for (let i = 0; i < POINTS_PER_DEVICE; i += 1) {
          points.push({
            tenantId, connectionId, gpsDeviceId: device.id, providerDeviceId: device.providerDeviceId,
            recordedAt: new Date(base.getTime() + i * 60_000), receivedAt: new Date(base.getTime() + i * 60_000 + 500),
            latitude: 12.9 + i * 0.001, longitude: 77.6, speedKph: 25, motion: true, source: 'polling',
          });
        }
      }
      expect(points.length).toBe(DEVICE_COUNT * POINTS_PER_DEVICE);

      const startedAt = Date.now();
      // Bounded concurrency of 10 in-flight writes at once — a realistic
      // batch-persist shape (not fully serial, not unbounded-parallel
      // enough to overwhelm a single Mongo connection pool).
      await runBoundedPool(points, 10, (point) => storeTelemetryPoint(point).then(() => undefined));
      const elapsedMs = Date.now() - startedAt;

      const storedCount = await GpsTelemetryPoint.countDocuments({ tenantId, connectionId });
      expect(storedCount).toBe(points.length);

      const pointsPerSecond = points.length / (elapsedMs / 1000);
      // A floor, not a target: catches a gross regression (e.g. an
      // accidental fully-serial write path) without asserting a specific
      // hardware-dependent throughput number.
      expect(pointsPerSecond).toBeGreaterThan(20);
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });
});
