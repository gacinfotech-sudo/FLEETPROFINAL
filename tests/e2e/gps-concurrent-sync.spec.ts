// TASK-GPS-QA-SECURITY-07 — concurrent-sync tests.
//
// Proves TASK-GPS-INGESTION-04's dedup key — (tenantId, internal
// gpsDeviceId, recordedAt), enforced by the unique compound Mongo index on
// `GpsTelemetryPoint` (server/gps/telemetry/models/telemetryPoint.ts) — is
// actually race-safe: a poll cycle and a webhook delivery reporting the
// *same physical fix* concurrently must never produce two stored rows for
// it, no matter which one's `storeTelemetryPoint()` call reaches Mongo
// first. `storeTelemetryPoint()` (server/gps/telemetry/store.ts) is
// exercised directly (rather than via the full polling scheduler/webhook
// HTTP path) so the race is deterministic and isolated to exactly the
// mechanism this task's acceptance criterion names — both ingestion paths
// funnel through this one function before touching the DB, so this is not
// a narrower guarantee than testing the two entry points end-to-end.

import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { GpsConnection } from '../../server/gps/models/gpsConnection';
import { GpsDevice } from '../../server/gps/models/gpsDevice';
import { GpsTelemetryPoint } from '../../server/gps/telemetry/models/telemetryPoint';
import { GpsVehicleLatestState } from '../../server/gps/telemetry/models/vehicleLatestState';
import { storeTelemetryPoint } from '../../server/gps/telemetry/store';
import type { NormalizedTelemetryPoint } from '../../server/gps/types';

function requireMongoUri(): string {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for GPS concurrent-sync verification.');
  return process.env.MONGODB_URI;
}

async function makeConnectionAndDevice() {
  const tenantId = new mongoose.Types.ObjectId().toString();
  const connection = await GpsConnection.create({
    tenantId,
    connectionName: 'Concurrent sync test',
    providerKey: `concurrent-sync-${Date.now()}`,
    authenticationType: 'api_key',
    pollingIntervalSeconds: 60,
    enabled: true,
    status: 'connected',
    createdBy: 'concurrent-sync-test',
    updatedBy: 'concurrent-sync-test',
  });
  const connectionId = connection.id;
  const device = await GpsDevice.create({
    tenantId,
    connectionId,
    internalDeviceCode: `GPS-concurrent-${Date.now()}`,
    providerDeviceId: `provider-concurrent-${Date.now()}`,
    status: 'unassigned',
    createdBy: 'concurrent-sync-test',
    updatedBy: 'concurrent-sync-test',
  });
  return { tenantId, connectionId, gpsDeviceId: device.id, providerDeviceId: device.providerDeviceId };
}

async function cleanupTenantFixtures(tenantId: string): Promise<void> {
  await Promise.all([
    GpsConnection.deleteMany({ tenantId }),
    GpsDevice.deleteMany({ tenantId }),
    GpsTelemetryPoint.deleteMany({ tenantId }),
    GpsVehicleLatestState.deleteMany({ tenantId }),
  ]);
}

test.describe('GPS concurrent-sync (poll vs. webhook race — TASK-GPS-INGESTION-04 dedup key)', () => {
  test.setTimeout(30_000);

  test('a poll and a webhook reporting the identical fix concurrently produce exactly one stored row', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const { tenantId, connectionId, gpsDeviceId, providerDeviceId } = await makeConnectionAndDevice();
      cleanupTenantId = tenantId;

      const recordedAt = new Date('2026-08-07T09:00:00.000Z');
      const pollPoint: NormalizedTelemetryPoint = {
        tenantId, connectionId, gpsDeviceId, providerDeviceId,
        recordedAt, receivedAt: new Date(recordedAt.getTime() + 500),
        latitude: 12.9716, longitude: 77.5946, speedKph: 30, motion: true,
        source: 'polling',
      };
      // Same physical fix, delivered a moment later via the webhook path —
      // different `receivedAt`/`source` (exactly what a real race looks
      // like: the two ingestion paths never see byte-identical requests,
      // only the same underlying GPS fix), but identical
      // (tenantId, gpsDeviceId, recordedAt) dedup key.
      const webhookPoint: NormalizedTelemetryPoint = {
        ...pollPoint,
        receivedAt: new Date(recordedAt.getTime() + 1200),
        source: 'webhook',
      };

      const [resultA, resultB] = await Promise.all([
        storeTelemetryPoint(pollPoint),
        storeTelemetryPoint(webhookPoint),
      ]);

      // Exactly one of the two concurrent calls actually inserted a row;
      // the other observed the unique-index conflict and reported it as a
      // routine duplicate (store.ts never throws on this — see its own
      // doc comment).
      const storedFlags = [resultA.stored, resultB.stored];
      const duplicateFlags = [resultA.duplicate, resultB.duplicate];
      expect(storedFlags.filter(Boolean).length).toBe(1);
      expect(duplicateFlags.filter(Boolean).length).toBe(1);

      const rows = await GpsTelemetryPoint.find({ tenantId, gpsDeviceId }).lean();
      expect(rows.length).toBe(1);
      expect(rows[0].recordedAt.getTime()).toBe(recordedAt.getTime());

      // The derived "latest state" read model must also reflect exactly
      // one logical fix, not be corrupted by the race.
      const latest = await GpsVehicleLatestState.findOne({ tenantId, gpsDeviceId }).lean();
      expect(latest).toBeTruthy();
      expect(latest!.recordedAt.getTime()).toBe(recordedAt.getTime());
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });

  test('two overlapping poll cycles delivering an overlapping history window store each fix exactly once', async () => {
    const MONGODB_URI = requireMongoUri();
    await mongoose.connect(MONGODB_URI);
    let cleanupTenantId: string | undefined;
    try {
      const { tenantId, connectionId, gpsDeviceId, providerDeviceId } = await makeConnectionAndDevice();
      cleanupTenantId = tenantId;

      const base = new Date('2026-08-07T10:00:00.000Z');
      const makeFix = (i: number): NormalizedTelemetryPoint => ({
        tenantId, connectionId, gpsDeviceId, providerDeviceId,
        recordedAt: new Date(base.getTime() + i * 60_000),
        receivedAt: new Date(base.getTime() + i * 60_000 + 500),
        latitude: 12.97 + i * 0.001, longitude: 77.59, speedKph: 20, motion: true,
        source: 'polling',
      });

      // Cycle A: fixes 0-4. Cycle B (overlapping window): fixes 2-6.
      const cycleA = [0, 1, 2, 3, 4].map(makeFix);
      const cycleB = [2, 3, 4, 5, 6].map(makeFix);

      const results = await Promise.all([
        ...cycleA.map((p) => storeTelemetryPoint(p)),
        ...cycleB.map((p) => storeTelemetryPoint(p)),
      ]);

      const stored = results.filter((r) => r.stored).length;
      const duplicates = results.filter((r) => r.duplicate).length;
      // 7 distinct fixes (0-6); fixes 2,3,4 are attempted twice each.
      expect(stored).toBe(7);
      expect(duplicates).toBe(3);

      const rows = await GpsTelemetryPoint.find({ tenantId, gpsDeviceId }).sort({ recordedAt: 1 }).lean();
      expect(rows.length).toBe(7);
      const recordedTimes = rows.map((r) => r.recordedAt.getTime());
      const uniqueTimes = new Set(recordedTimes);
      expect(uniqueTimes.size).toBe(7); // no duplicate (tenantId, gpsDeviceId, recordedAt) row
    } finally {
      if (cleanupTenantId) await cleanupTenantFixtures(cleanupTenantId);
      await mongoose.disconnect();
    }
  });
});
