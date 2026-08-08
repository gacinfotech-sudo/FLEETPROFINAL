// Unit tests for the Traccar adapter (TASK-GPS-CONNECTION-02). No live
// Traccar instance is available, so every test runs against an in-memory
// mock `fetch` implementation (injected via TraccarClient's `fetchImpl`
// option) that returns fixture payloads shaped exactly like the documented
// Traccar API responses. Each fixture's doc citation is noted inline. No
// network I/O happens in this file — the fetch implementation never leaves
// the process, so there is no live-server/DB dependency (matching the style
// of tests/e2e/gps-provider-registry.spec.ts, the existing pure-unit GPS
// spec in this suite).
//
// Credential-safety note (see this task's report): every secret used below
// (`svc-token-abc123`, `svc`, `S3cretPass!`) is a synthetic test fixture,
// never a real credential, and is asserted NOT to leak into any returned
// result or thrown error message.

import { expect, test } from '@playwright/test';
import type { GpsProviderConnectionConfig } from '../../server/gps/types';
import {
  TraccarAdapter,
  TraccarCapabilities,
  createTraccarAdapter,
} from '../../server/gps/providers/adapters/traccar/traccarAdapter';
import { TraccarClient, TraccarNotFoundError } from '../../server/gps/providers/adapters/traccar/traccarClient';
import { assertPublicTraccarUrl, TraccarSsrfBlockedError } from '../../server/gps/providers/adapters/traccar/traccarSsrfGuard';
import { GpsProviderConfigurationError } from '../../server/gps/providers/registry';
import { gpsProviderRegistry } from '../../server/gps/providers/runtimeRegistry';
import type { TraccarDevice, TraccarDeviceAccumulators, TraccarPosition, TraccarTripReportRow } from '../../server/gps/providers/adapters/traccar/traccarApiTypes';

// ---------------------------------------------------------------------------
// Fixtures — every field is transcribed from
// docs/gps-research/GPS-PROVIDER-RESEARCH.md §1, not invented.
// ---------------------------------------------------------------------------

// §1 "Listing devices/vehicles": id, name, uniqueId, status (tri-state),
// disabled, lastUpdate, positionId, groupId, attributes.
const deviceOnline: TraccarDevice = {
  id: 1,
  name: 'Truck 12',
  uniqueId: '862112039085728',
  status: 'online',
  disabled: false,
  lastUpdate: '2026-08-07T10:00:00.000+00:00',
  positionId: 9001,
  groupId: 3,
  attributes: {},
};
// Exercises the tri-state 'unknown' status (§1: "status ... tri-state, not
// binary") and a device with no joined position.
const deviceUnknown: TraccarDevice = {
  id: 2,
  name: 'Van 7',
  uniqueId: '862112039085999',
  status: 'unknown',
  disabled: false,
  lastUpdate: '2026-08-06T09:00:00.000+00:00',
  groupId: 3,
};

// §1 "Listing devices/vehicles": GET /devices/{id}/accumulators ->
// {deviceId, totalDistance (meters), hours (total engine hours)}.
const accumulatorsDevice1: TraccarDeviceAccumulators = {
  deviceId: 1,
  totalDistance: 45_000_000, // meters -> 45,000 km
  hours: 545_400_000, // documented as milliseconds per Position.java source comment
};

// §1 "Current position" + "Ignition / odometer" attribute table.
const positionDevice1: TraccarPosition = {
  id: 9001,
  deviceId: 1,
  protocol: 'osmand',
  deviceTime: '2026-08-07T09:59:56.000+00:00',
  fixTime: '2026-08-07T09:59:55.000+00:00',
  serverTime: '2026-08-07T10:00:01.000+00:00',
  valid: true,
  latitude: 12.9716,
  longitude: 77.5946,
  altitude: 920,
  speed: 32.4, // knots
  course: 187.5,
  address: 'MG Road, Bengaluru',
  accuracy: 5,
  attributes: {
    ignition: true,
    motion: true,
    odometer: 45_000_500, // meters
    tripOdometer: 15_320, // meters
    hours: 545_400_000, // milliseconds
    batteryLevel: 87,
    fuelLevel: 62,
  },
};

// §1 "Historical positions & reports" -> GET /reports/trips row shape.
const tripRow1: TraccarTripReportRow = {
  deviceId: 1,
  distance: 15_320, // meters
  duration: 1800, // seconds
  maxSpeed: 40.1, // knots
  averageSpeed: 28.7, // knots
  startTime: '2026-08-07T08:00:00.000+00:00',
  endTime: '2026-08-07T08:30:00.000+00:00',
  startAddress: 'Depot',
  endAddress: 'MG Road, Bengaluru',
  startLat: 12.95,
  startLon: 77.58,
  endLat: 12.9716,
  endLon: 77.5946,
  driverUniqueId: 'D-100',
  driverName: 'Ravi Kumar',
  spentFuel: 2.1,
};

const KNOTS_TO_KMH = 1.852;

// ---------------------------------------------------------------------------
// Mock fetch harness
// ---------------------------------------------------------------------------

type RouteResult = { status: number; body?: unknown; text?: string; headers?: Record<string, string> };
type RouteHandler = (url: URL, init: RequestInit) => RouteResult;

interface MockCall { pathname: string; url: URL; authorization: string | null }

function buildMockFetch(routes: Record<string, RouteHandler>, calls: MockCall[] = []): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    calls.push({ pathname: url.pathname, url, authorization: headers.get('Authorization') });
    const handler = routes[url.pathname];
    if (!handler) return new Response('not found', { status: 404 });
    const result = handler(url, init || {});
    const responseHeaders = new Headers(result.headers);
    if (result.text !== undefined) return new Response(result.text, { status: result.status, headers: responseHeaders });
    if (result.body !== undefined) {
      responseHeaders.set('Content-Type', 'application/json');
      return new Response(JSON.stringify(result.body), { status: result.status, headers: responseHeaders });
    }
    return new Response('', { status: result.status, headers: responseHeaders });
  }) as typeof fetch;
}

function baseConnection(overrides: Partial<GpsProviderConnectionConfig> = {}): GpsProviderConnectionConfig {
  return {
    id: 'connection-1',
    tenantId: 'tenant-1',
    connectionName: 'Traccar test fleet',
    providerKey: 'traccar',
    apiBaseUrl: 'https://mock-traccar.invalid/api',
    authenticationType: 'bearer_token',
    enabled: true,
    status: 'configuration_required',
    secrets: { apiToken: 'svc-token-abc123' },
    ...overrides,
  };
}

function bearerAdapter(routes: Record<string, RouteHandler>, calls: MockCall[] = []): TraccarAdapter {
  const connection = baseConnection();
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch(routes, calls),
  });
  return new TraccarAdapter(client, connection);
}

// ---------------------------------------------------------------------------
// SSRF guard (server/gps/providers/adapters/traccar/traccarSsrfGuard.ts) —
// docs/gps-research/GPS-PROVIDER-RESEARCH.md §4 flags SSRF as "directly
// relevant" to a tenant-supplied provider base URL.
// ---------------------------------------------------------------------------

test('Traccar SSRF guard blocks loopback, private, link-local/metadata, and localhost hosts', async () => {
  await expect(assertPublicTraccarUrl(new URL('http://127.0.0.1/api'))).rejects.toBeInstanceOf(TraccarSsrfBlockedError);
  await expect(assertPublicTraccarUrl(new URL('http://10.0.0.5/api'))).rejects.toBeInstanceOf(TraccarSsrfBlockedError);
  await expect(assertPublicTraccarUrl(new URL('http://192.168.1.20/api'))).rejects.toBeInstanceOf(TraccarSsrfBlockedError);
  await expect(assertPublicTraccarUrl(new URL('http://169.254.169.254/api'))).rejects.toBeInstanceOf(TraccarSsrfBlockedError);
  await expect(assertPublicTraccarUrl(new URL('http://localhost/api'))).rejects.toBeInstanceOf(TraccarSsrfBlockedError);
});

test('Traccar SSRF guard does not block a non-resolving public-looking hostname', async () => {
  // .invalid is reserved by RFC 2606 to never resolve; DNS failure here must
  // be treated as "let the request layer report connectivity failure", not
  // as an SSRF block.
  await expect(assertPublicTraccarUrl(new URL('https://mock-traccar.invalid/api'))).resolves.toBeUndefined();
});

// ---------------------------------------------------------------------------
// createTraccarAdapter factory — configuration validation
// ---------------------------------------------------------------------------

test('createTraccarAdapter rejects a connection with no apiBaseUrl', () => {
  expect(() => createTraccarAdapter(baseConnection({ apiBaseUrl: undefined }))).toThrow(GpsProviderConfigurationError);
});

test('createTraccarAdapter rejects a connection with no usable credentials', () => {
  expect(() => createTraccarAdapter(baseConnection({ secrets: {} }))).toThrow(GpsProviderConfigurationError);
});

test('createTraccarAdapter rejects an authenticationType Traccar does not document', () => {
  expect(() =>
    createTraccarAdapter(baseConnection({ authenticationType: 'oauth_client_credentials', secrets: { apiToken: 'x' } })),
  ).toThrow(GpsProviderConfigurationError);
});

test('createTraccarAdapter accepts a valid bearer_token connection', () => {
  const adapter = createTraccarAdapter(baseConnection());
  expect(adapter.providerKey).toBe('traccar');
});

test('Traccar adapter is registered in the shared runtime registry (server/gps/providers/runtimeRegistry.ts)', () => {
  // DefaultGpsProviderRegistry.register() throws if the key is already
  // registered (server/gps/providers/registry.ts) — attempting to register
  // 'traccar' a second time proves the module-level registration this task
  // added to runtimeRegistry.ts already ran, without needing a live Mongo
  // connection or a real Traccar server.
  expect(() => gpsProviderRegistry.register('traccar', () => { throw new Error('unused'); })).toThrow(/already registered/);
});

// ---------------------------------------------------------------------------
// listDevices() / getDevice() — GET /devices, GET /positions,
// GET /devices/{id}/accumulators
// ---------------------------------------------------------------------------

test('listDevices maps Traccar devices, joins latest positions, and applies unit conversions', async () => {
  const calls: MockCall[] = [];
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 200, body: [deviceOnline, deviceUnknown] }),
    '/api/positions': () => ({ status: 200, body: [positionDevice1] }),
    '/api/devices/1/accumulators': () => ({ status: 200, body: accumulatorsDevice1 }),
    '/api/devices/2/accumulators': () => ({ status: 500, text: 'boom' }), // must not fail the whole call
  }, calls);

  const devices = await adapter.listDevices();
  expect(devices).toHaveLength(2);

  const online = devices.find((d) => d.providerDeviceId === '1')!;
  expect(online.status).toBe('online');
  expect(online.imei).toBe('862112039085728');
  expect(online.latitude).toBe(12.9716);
  expect(online.longitude).toBe(77.5946);
  expect(online.batteryLevel).toBe(87);
  expect(online.lastLocationAt?.toISOString()).toBe(new Date('2026-08-07T09:59:55.000+00:00').toISOString());
  expect(online.metadata?.odometerMeters).toBe(45_000_000);
  expect(online.metadata?.engineHoursSeconds).toBeCloseTo(545_400, 5); // 545,400,000ms / 1000
  expect(online.metadata?.traccarStatus).toBe('online');

  const unknown = devices.find((d) => d.providerDeviceId === '2')!;
  // Tri-state 'unknown' has no matching value on GpsProviderDevice.status —
  // mapped to 'inactive' (see traccarNormalize.ts's mapDeviceStatus doc
  // comment), with the raw value preserved in metadata.
  expect(unknown.status).toBe('inactive');
  expect(unknown.metadata?.traccarStatus).toBe('unknown');
  expect(unknown.latitude).toBeUndefined();
  expect(unknown.metadata?.odometerMeters).toBeUndefined(); // accumulators call failed -> best-effort omission, not a thrown error

  expect(calls.some((c) => c.pathname === '/api/devices')).toBe(true);
});

test('getDevice returns a single device joined with its latest position, and rejects an unknown id', async () => {
  const adapter = bearerAdapter({
    '/api/devices': (url) => {
      const ids = url.searchParams.getAll('id');
      const match = ids.includes('1') ? [deviceOnline] : [];
      return { status: 200, body: match };
    },
    '/api/positions': () => ({ status: 200, body: [positionDevice1] }),
    '/api/devices/1/accumulators': () => ({ status: 200, body: accumulatorsDevice1 }),
  });

  const device = await adapter.getDevice('1');
  expect(device.providerDeviceId).toBe('1');
  expect(device.latitude).toBe(12.9716);

  await expect(adapter.getDevice('999')).rejects.toBeInstanceOf(TraccarNotFoundError);
});

// ---------------------------------------------------------------------------
// getLatestPosition() / getPositionHistory() — GET /positions
// ---------------------------------------------------------------------------

test('getLatestPosition normalizes units (knots->km/h, meters->km) and stamps polling as the source', async () => {
  const adapter = bearerAdapter({
    '/api/positions': (url) => {
      const deviceId = url.searchParams.get('deviceId');
      return { status: 200, body: deviceId === '1' ? [positionDevice1] : [] };
    },
  });

  const point = await adapter.getLatestPosition('1');
  expect(point).not.toBeNull();
  expect(point!.speedKph).toBeCloseTo(32.4 * KNOTS_TO_KMH, 6);
  expect(point!.headingDegrees).toBe(187.5);
  expect(point!.deviceOdometerKm).toBeCloseTo(45_000_500 / 1000, 6);
  expect(point!.providerTripDistanceKm).toBeCloseTo(15_320 / 1000, 6);
  expect(point!.ignition).toBe(true);
  expect(point!.motion).toBe(true);
  expect(point!.engineOn).toBeUndefined(); // not fabricated from ignition — see traccarNormalize.ts comment
  expect(point!.batteryLevel).toBe(87);
  expect(point!.address).toBe('MG Road, Bengaluru');
  expect(point!.source).toBe('polling');
  expect(point!.providerEventId).toBe('9001');
  expect(point!.rawPayloadHash).toMatch(/^[0-9a-f]{64}$/);
  expect(point!.tenantId).toBe('tenant-1');
  expect(point!.connectionId).toBe('connection-1');

  const noPosition = await adapter.getLatestPosition('2');
  expect(noPosition).toBeNull();
});

test('getPositionHistory queries the documented deviceId/from/to params and stamps history_sync as the source', async () => {
  const calls: MockCall[] = [];
  const adapter = bearerAdapter({
    '/api/positions': () => ({ status: 200, body: [positionDevice1] }),
  }, calls);

  const start = new Date('2026-08-07T00:00:00.000Z');
  const end = new Date('2026-08-07T23:59:59.000Z');
  const history = await adapter.getPositionHistory('1', start, end);

  expect(history).toHaveLength(1);
  expect(history[0].source).toBe('history_sync');

  const positionsCall = calls.find((c) => c.pathname === '/api/positions')!;
  expect(positionsCall.url.searchParams.get('deviceId')).toBe('1');
  expect(positionsCall.url.searchParams.get('from')).toBe(start.toISOString());
  expect(positionsCall.url.searchParams.get('to')).toBe(end.toISOString());
});

// ---------------------------------------------------------------------------
// getTripHistory() — GET /reports/trips (optional capability method)
// ---------------------------------------------------------------------------

test('getTripHistory maps distance to km and leaves providerTripId undefined (Traccar documents no trip id field)', async () => {
  const adapter = bearerAdapter({
    '/api/reports/trips': () => ({ status: 200, body: [tripRow1] }),
  });

  const trips = await adapter.getTripHistory!('1', new Date('2026-08-07T00:00:00Z'), new Date('2026-08-07T23:59:59Z'));
  expect(trips).toHaveLength(1);
  expect(trips[0].providerDeviceId).toBe('1');
  expect(trips[0].distanceKm).toBeCloseTo(15.32, 6);
  expect(trips[0].providerTripId).toBeUndefined();
  expect(trips[0].startOdometerKm).toBeUndefined();
  expect(trips[0].startedAt.toISOString()).toBe(new Date('2026-08-07T08:00:00.000+00:00').toISOString());
});

// ---------------------------------------------------------------------------
// testConnection() — connected / degraded / failure classification
// ---------------------------------------------------------------------------

test('testConnection reports connected with no degradation when devices and reports are both accessible', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 200, body: [deviceOnline] }),
    '/api/reports/trips': () => ({ status: 200, body: [] }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(true);
  expect(result.status).toBe('connected');
  expect(result.errorCode).toBeUndefined();
});

test('testConnection reports a degraded-but-connected result when the account has zero devices', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 200, body: [] }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(true);
  expect(result.status).toBe('connected'); // GpsConnectionStatus has no 'degraded' member — see report
  expect(result.errorCode).toBe('DEGRADED_NO_DEVICES');
});

test('testConnection reports a degraded-but-connected result when /reports/* is inaccessible to this account', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 200, body: [deviceOnline] }),
    '/api/reports/trips': () => ({ status: 401, text: '' }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(true);
  expect(result.status).toBe('connected');
  expect(result.errorCode).toBe('DEGRADED_REPORTS_INACCESSIBLE');
});

test('testConnection reports authentication_failed on a 401 from /devices', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 401, text: '' }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(false);
  expect(result.status).toBe('authentication_failed');
});

test('testConnection reports rate_limited on a 429 from /devices', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 429, text: '', headers: { 'Retry-After': '30' } }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(false);
  expect(result.status).toBe('rate_limited');
});

test('testConnection reports provider_unavailable on a 500 from /devices', async () => {
  const adapter = bearerAdapter({
    '/api/devices': () => ({ status: 500, text: 'internal error' }),
  });
  const result = await adapter.testConnection();
  expect(result.success).toBe(false);
  expect(result.status).toBe('provider_unavailable');
});

test('testConnection reports provider_unavailable when the request times out', async () => {
  const connection = baseConnection();
  const hangingFetch = (async (_input: string | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }) as typeof fetch;
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    timeoutMs: 50,
    fetchImpl: hangingFetch,
  });
  const adapter = new TraccarAdapter(client, connection);
  const result = await adapter.testConnection();
  expect(result.success).toBe(false);
  expect(result.status).toBe('provider_unavailable');
});

// ---------------------------------------------------------------------------
// detectCapabilities()
// ---------------------------------------------------------------------------

test('detectCapabilities leaves reportsAccessible optimistic when there is no device to probe with', async () => {
  const calls: MockCall[] = [];
  const adapter = bearerAdapter({}, calls);
  const capabilities: TraccarCapabilities = await adapter.detectCapabilities(undefined);
  expect(capabilities.reportsAccessible).toBe(true);
  expect(capabilities.hasWebhooks).toBe(false); // Traccar forwarding is server-config, not a tenant API — GPS-PROVIDER-RESEARCH.md §1
  expect(calls.some((c) => c.pathname === '/api/reports/trips')).toBe(false);
});

test('detectCapabilities reports reportsAccessible=false only on a clear auth rejection from /reports/trips', async () => {
  const deniedAdapter = bearerAdapter({
    '/api/reports/trips': () => ({ status: 403, text: '' }),
  });
  expect((await deniedAdapter.detectCapabilities(1)).reportsAccessible).toBe(false);

  const okAdapter = bearerAdapter({
    '/api/reports/trips': () => ({ status: 200, body: [] }),
  });
  expect((await okAdapter.detectCapabilities(1)).reportsAccessible).toBe(true);
});

// ---------------------------------------------------------------------------
// session_login auth flow — POST /session/token (Basic) -> Bearer thereafter
// ---------------------------------------------------------------------------

test('session_login mints a token via POST /session/token and reuses it (Bearer) across calls', async () => {
  const calls: MockCall[] = [];
  const connection = baseConnection({
    authenticationType: 'session_login',
    secrets: { apiUsername: 'svc', apiPassword: 'S3cretPass!' },
  });
  const expectedBasic = `Basic ${Buffer.from('svc:S3cretPass!', 'utf8').toString('base64')}`;
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch({
      '/api/session/token': (_url, init) => {
        const headers = new Headers(init.headers as HeadersInit | undefined);
        if (headers.get('Authorization') !== expectedBasic) return { status: 401, text: '' };
        return { status: 200, text: 'minted-token-xyz' };
      },
      '/api/devices': (_url, init) => {
        const headers = new Headers(init.headers as HeadersInit | undefined);
        if (headers.get('Authorization') !== 'Bearer minted-token-xyz') return { status: 401, text: '' };
        return { status: 200, body: [deviceOnline] };
      },
      '/api/positions': () => ({ status: 200, body: [] }),
    }, calls),
  });
  const adapter = new TraccarAdapter(client, connection);

  await adapter.listDevices();
  await adapter.getLatestPosition('1');

  const tokenMints = calls.filter((c) => c.pathname === '/api/session/token');
  expect(tokenMints).toHaveLength(1); // cached across the second call, not re-minted
  const deviceCalls = calls.filter((c) => c.pathname === '/api/devices');
  expect(deviceCalls.every((c) => c.authorization === 'Bearer minted-token-xyz')).toBe(true);
});

test('session_login re-mints exactly once after the cached token is rejected with 401', async () => {
  const calls: MockCall[] = [];
  const connection = baseConnection({
    authenticationType: 'session_login',
    secrets: { apiUsername: 'svc', apiPassword: 'S3cretPass!' },
  });
  let mintCount = 0;
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch({
      '/api/session/token': () => {
        mintCount += 1;
        return { status: 200, text: `minted-token-${mintCount}` };
      },
      '/api/devices': (_url, init) => {
        const headers = new Headers(init.headers as HeadersInit | undefined);
        // Only the second minted token is accepted, simulating an expired
        // cached token on the very first attempt.
        if (headers.get('Authorization') === 'Bearer minted-token-2') return { status: 200, body: [deviceOnline] };
        return { status: 401, text: '' };
      },
    }, calls),
  });
  const adapter = new TraccarAdapter(client, connection);

  // getDevice() awaits its /devices call (with the full 401-retry-remint
  // sequence) before it ever issues the /positions or /accumulators
  // follow-up calls — unlike listDevices(), which fires /devices and
  // /positions concurrently via Promise.all and would let an unrelated
  // 404 on /positions short-circuit the assertion before the /devices
  // retry finishes. Using getDevice() here keeps this test deterministic.
  const result = await adapter.getDevice('1').catch(() => null);
  void result;

  expect(mintCount).toBe(2);
  const deviceCalls = calls.filter((c) => c.pathname === '/api/devices');
  expect(deviceCalls.map((c) => c.authorization)).toEqual(['Bearer minted-token-1', 'Bearer minted-token-2']);
});

// ---------------------------------------------------------------------------
// Credential safety — GPS-SECURITY-SPEC.md §2: never log/leak a credential.
// ---------------------------------------------------------------------------

test('no configured secret ever appears in a returned result or thrown error message', async () => {
  const secret = 'S3cretPass!-unique-marker';
  const connection = baseConnection({
    authenticationType: 'basic_authentication',
    secrets: { apiUsername: 'svc', apiPassword: secret },
  });
  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch({
      '/api/devices': () => ({ status: 401, text: '' }),
    }),
  });
  const adapter = new TraccarAdapter(client, connection);

  const result = await adapter.testConnection();
  expect(JSON.stringify(result)).not.toContain(secret);

  const badClient = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl!,
    authenticationType: connection.authenticationType,
    secrets: connection.secrets,
    fetchImpl: buildMockFetch({ '/api/devices': () => ({ status: 500, text: 'boom' }) }),
  });
  try {
    await new TraccarAdapter(badClient, connection).listDevices();
    throw new Error('expected listDevices to reject');
  } catch (error) {
    expect(String((error as Error).message)).not.toContain(secret);
  }
});
