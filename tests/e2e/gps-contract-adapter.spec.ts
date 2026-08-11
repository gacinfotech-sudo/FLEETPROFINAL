// TASK-GPS-QA-SECURITY-07 — contract tests.
//
// Asserts that every adapter claiming to implement `GpsProviderAdapter`
// (server/gps/providers/adapter.ts) actually honors the interface's
// documented behavior — not just its TypeScript shape (the compiler already
// guarantees that), but runtime contract properties: `providerKey` is a
// stable non-empty string, `testConnection()` returns a well-formed
// `GpsConnectionTestResult`, `listDevices()`/`getDevice()` return
// `GpsProviderDevice` objects whose optional fields are honestly optional
// (never fabricated), and `getLatestPosition()`/`getPositionHistory()`
// return coordinates within valid ranges and a `source` in the documented
// enum.
//
// Run against two adapters:
//  1. The shared mock adapter (server/gps/testing/mockAdapter.ts) — proves
//     the mock other GPS tests import is itself contract-compliant.
//  2. The real Traccar adapter (TASK-GPS-CONNECTION-02,
//     server/gps/providers/adapters/traccar/traccarAdapter.ts) driven
//     against an in-memory mock `fetch` returning fixtures shaped exactly
//     like docs/gps-research/GPS-PROVIDER-RESEARCH.md §1 — no live Traccar
//     instance is available in this environment, matching the same
//     no-live-server approach TASK-GPS-CONNECTION-02's own
//     gps-traccar-adapter.spec.ts uses (a fresh, independent fixture set is
//     built here rather than importing that file's unexported helpers, per
//     this task's "extend/import from them, don't rewrite them" rule for
//     other tasks' owned test files).

import { expect, test } from '@playwright/test';
import type { GpsProviderAdapter } from '../../server/gps/providers/adapter';
import type { GpsProviderConnectionConfig } from '../../server/gps/types';
import { TraccarAdapter } from '../../server/gps/providers/adapters/traccar/traccarAdapter';
import { TraccarClient } from '../../server/gps/providers/adapters/traccar/traccarClient';
import type { TraccarDevice, TraccarPosition } from '../../server/gps/providers/adapters/traccar/traccarApiTypes';
import { createMockGpsProviderAdapter } from '../../server/gps/testing/mockAdapter';

// ---------------------------------------------------------------------------
// Traccar fixture + mock-fetch harness (independent of, but structurally
// consistent with, TASK-GPS-CONNECTION-02's own test file's approach).
// ---------------------------------------------------------------------------

// GPS-PROVIDER-RESEARCH.md §1 "Listing devices/vehicles".
const traccarDevice: TraccarDevice = {
  id: 42,
  name: 'Contract Test Van',
  uniqueId: '862112039001234',
  status: 'online',
  disabled: false,
  lastUpdate: '2026-08-07T10:00:00.000+00:00',
  positionId: 5001,
  groupId: 1,
  attributes: {},
};

// GPS-PROVIDER-RESEARCH.md §1 "Current position" + "Ignition / odometer".
const traccarPosition: TraccarPosition = {
  id: 5001,
  deviceId: 42,
  protocol: 'osmand',
  deviceTime: '2026-08-07T09:59:56.000+00:00',
  fixTime: '2026-08-07T09:59:55.000+00:00',
  serverTime: '2026-08-07T10:00:01.000+00:00',
  valid: true,
  latitude: 13.05,
  longitude: 77.6,
  altitude: 900,
  speed: 20, // knots, per §1
  course: 90,
  address: 'Contract Test Road',
  accuracy: 8,
  attributes: { ignition: true, motion: true, odometer: 12_000_000, hours: 100_000_000, batteryLevel: 75 },
};

type RouteHandler = (url: URL) => { status: number; body?: unknown; text?: string };

function buildMockFetch(routes: Record<string, RouteHandler>): typeof fetch {
  return (async (input: string | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const handler = routes[url.pathname];
    if (!handler) return new Response('not found', { status: 404 });
    const result = handler(url);
    if (result.text !== undefined) return new Response(result.text, { status: result.status });
    if (result.body !== undefined) {
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('', { status: result.status });
  }) as typeof fetch;
}

function buildTraccarAdapter(): GpsProviderAdapter {
  const connection: GpsProviderConnectionConfig = {
    id: 'contract-connection-1',
    tenantId: 'contract-tenant-1',
    connectionName: 'Contract test fleet',
    providerKey: 'traccar',
    apiBaseUrl: 'https://mock-traccar.invalid/api',
    authenticationType: 'bearer_token',
    enabled: true,
    status: 'configuration_required',
    secrets: { apiToken: 'contract-test-token' },
  };
  const routes: Record<string, RouteHandler> = {
    '/api/devices': (url) => {
      const idFilter = url.searchParams.getAll('id');
      if (idFilter.length > 0 && !idFilter.includes(String(traccarDevice.id))) return { status: 200, body: [] };
      return { status: 200, body: [traccarDevice] };
    },
    '/api/positions': (url) => {
      const deviceIdParam = url.searchParams.get('deviceId');
      if (deviceIdParam && Number(deviceIdParam) !== traccarPosition.deviceId) return { status: 200, body: [] };
      // Real Traccar filters `GET /positions?from=&to=` server-side
      // (GPS-PROVIDER-RESEARCH.md §1 "Historical positions & reports") —
      // this mock fetch replicates that filtering so the contract suite's
      // out-of-window assertion exercises the same behavior a live server
      // would produce, rather than trivially passing because the fixture
      // ignores the query.
      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      if (fromParam && toParam) {
        const fixTime = new Date(traccarPosition.fixTime).getTime();
        if (fixTime < new Date(fromParam).getTime() || fixTime > new Date(toParam).getTime()) {
          return { status: 200, body: [] };
        }
      }
      return { status: 200, body: [traccarPosition] };
    },
    '/api/devices/42/accumulators': () => ({ status: 200, body: { deviceId: 42, totalDistance: 12_000_000, hours: 100_000_000 } }),
  };
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch(routes),
  });
  return new TraccarAdapter(client, connection);
}

// ---------------------------------------------------------------------------
// Shared contract suite
// ---------------------------------------------------------------------------

const ALLOWED_DEVICE_STATUSES = new Set(['online', 'offline', 'inactive', 'faulty', undefined]);
const ALLOWED_TELEMETRY_SOURCES = new Set(['webhook', 'websocket', 'polling', 'history_sync']);

function runContractSuite(label: string, buildAdapter: () => GpsProviderAdapter, sampleDeviceId: string) {
  test.describe(`GpsProviderAdapter contract — ${label}`, () => {
    test('providerKey is a stable non-empty string', () => {
      const adapter = buildAdapter();
      expect(typeof adapter.providerKey).toBe('string');
      expect(adapter.providerKey.length).toBeGreaterThan(0);
    });

    test('testConnection() returns a well-formed GpsConnectionTestResult', async () => {
      const adapter = buildAdapter();
      const result = await adapter.testConnection();
      expect(typeof result.success).toBe('boolean');
      expect(result.status).not.toBe('testing'); // excluded by the type; guard the runtime value too
      expect(result.checkedAt).toBeInstanceOf(Date);
      if (result.latencyMs !== undefined) expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    test('listDevices() returns GpsProviderDevice objects with valid, honestly-optional fields', async () => {
      const adapter = buildAdapter();
      const devices = await adapter.listDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      for (const device of devices) {
        expect(typeof device.providerDeviceId).toBe('string');
        expect(device.providerDeviceId.length).toBeGreaterThan(0);
        // The interface gap TASK-GPS-CONNECTION-02's report documents
        // (GpsProviderDevice.status has no 'unknown' member even though
        // Traccar's tri-state status is documented) means a compliant
        // adapter must never widen this value past the four allowed
        // strings — asserting it here catches a regression if a future
        // adapter (or this mock) is edited to "helpfully" pass through an
        // unsupported provider status string.
        expect(ALLOWED_DEVICE_STATUSES.has(device.status)).toBe(true);
        if (device.batteryLevel !== undefined) {
          expect(device.batteryLevel).toBeGreaterThanOrEqual(0);
          expect(device.batteryLevel).toBeLessThanOrEqual(100);
        }
        if (device.latitude !== undefined) expect(Math.abs(device.latitude)).toBeLessThanOrEqual(90);
        if (device.longitude !== undefined) expect(Math.abs(device.longitude)).toBeLessThanOrEqual(180);
      }
    });

    test('getDevice(id) returns the same device the list contained', async () => {
      const adapter = buildAdapter();
      const device = await adapter.getDevice(sampleDeviceId);
      expect(device.providerDeviceId).toBe(sampleDeviceId);
    });

    test('getDevice() rejects for an unknown device id (documented failure behavior, not a silent null)', async () => {
      const adapter = buildAdapter();
      await expect(adapter.getDevice('definitely-not-a-real-device-id-9999')).rejects.toBeTruthy();
    });

    test('getLatestPosition() returns null or a NormalizedTelemetryPoint with valid coordinates and a documented source', async () => {
      const adapter = buildAdapter();
      const point = await adapter.getLatestPosition(sampleDeviceId);
      if (point === null) return;
      expect(Math.abs(point.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(point.longitude)).toBeLessThanOrEqual(180);
      expect(point.recordedAt).toBeInstanceOf(Date);
      expect(point.receivedAt).toBeInstanceOf(Date);
      expect(ALLOWED_TELEMETRY_SOURCES.has(point.source)).toBe(true);
    });

    test('getPositionHistory() returns only points within the requested window', async () => {
      const adapter = buildAdapter();
      const start = new Date('2000-01-01T00:00:00Z');
      const end = new Date('2100-01-01T00:00:00Z');
      const points = await adapter.getPositionHistory(sampleDeviceId, start, end);
      expect(Array.isArray(points)).toBe(true);
      for (const point of points) {
        expect(point.recordedAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
        expect(point.recordedAt.getTime()).toBeLessThanOrEqual(end.getTime());
      }
    });

    test('getPositionHistory() returns nothing for a window strictly before any known fix', async () => {
      const adapter = buildAdapter();
      const longAgoStart = new Date('1990-01-01T00:00:00Z');
      const longAgoEnd = new Date('1990-01-02T00:00:00Z');
      const points = await adapter.getPositionHistory(sampleDeviceId, longAgoStart, longAgoEnd);
      expect(points.length).toBe(0);
    });
  });
}

runContractSuite('mock adapter (server/gps/testing/mockAdapter.ts)', () => createMockGpsProviderAdapter(), 'mock-device-1');
runContractSuite('real Traccar adapter (TASK-GPS-CONNECTION-02)', buildTraccarAdapter, '42');
