// TASK-GPS-QA-SECURITY-07 — shared mock `GpsProviderAdapter` for GPS test
// files (contract tests, tenant-isolation tests, webhook-security tests,
// concurrent-sync tests, performance tests). Every response shape below is
// transcribed from a specific, cited section of
// docs/gps-research/GPS-PROVIDER-RESEARCH.md or GPS-DATA-SOURCE-MATRIX.md —
// nothing here is invented. Where the real Traccar adapter (TASK-GPS-
// CONNECTION-02) had to leave a documented interface gap or placeholder,
// this mock reproduces the *same* gap rather than quietly "fixing" it, so
// tests written against this mock exercise the real, shipped behavior.
//
// Field-shape citations:
// - latitude/longitude/speedKph/headingDegrees/altitudeMeters/accuracyMeters:
//   GPS-DATA-SOURCE-MATRIX.md §1 "Current position" (canonical, already-SI
//   fields — this mock returns already-normalized values, matching what
//   TraccarAdapter's toNormalizedTelemetryPoint() produces after converting
//   Traccar's knots-based `speed`).
// - ignition/motion/engineOn tri-state semantics: GPS-DATA-SOURCE-MATRIX.md
//   §3 (Traccar: boolean `attributes.ignition`; canonical model is
//   tri-state, but `NormalizedTelemetryPoint.ignition` is `boolean|undefined`
//   today — this mock never fabricates an `idle` value the type can't carry).
// - device.status tri-state ('online'/'offline'/'unknown'): GPS-PROVIDER-
//   RESEARCH.md §1 "Listing devices/vehicles" documents Traccar's tri-state
//   `status`, but `GpsProviderDevice.status` (server/gps/types.ts) only
//   accepts 'online'|'offline'|'inactive'|'faulty' — TASK-GPS-CONNECTION-02's
//   report ("Shared integration changes", item 1) flagged this exact gap and
//   proposed (not applied) adding 'unknown'. This mock reproduces the gap
//   honestly: a device whose real-world status would be Traccar's
//   'unknown' is given `status: undefined` here, never a fabricated
//   'offline'/'inactive' substitute — see GPS-DATA-SOURCE-MATRIX.md's own
//   rule ("a blank/'—' cell means the field isn't documented ... treat as
//   absent, never substitute a fabricated value").
// - odometer/engine-hours unit traps (Traccar `attributes.hours` is
//   milliseconds): GPS-DATA-SOURCE-MATRIX.md §4. This mock's
//   `deviceOdometerKm`/engine-hours-adjacent fields are pre-converted to the
//   canonical SI unit, matching what the adapter boundary is required to do.
// - webhook signature scheme (HMAC-SHA256, `v1:<timestamp>:<rawBody>`,
//   `X-Samsara-Signature: v1=<hex>`, `X-Samsara-Timestamp: <unix seconds>`):
//   GPS-PROVIDER-RESEARCH.md §2 "Samsara ... Webhooks" and cross-referenced
//   in GPS-PROVIDER-RESEARCH.md §4 (Standard Webhooks spec: HMAC-SHA256,
//   `webhook-timestamp` used for replay protection, tolerance window
//   required but not prescribed by the spec). Traccar itself documents *no*
//   signature scheme (GPS-PROVIDER-RESEARCH.md §1 "Webhooks — a critical
//   limitation"), so a Traccar-shaped mock cannot be used to test signature
//   verification — this mock instead models the one documented, real
//   HMAC+timestamp scheme in the provider research (Samsara's), which is
//   exactly the shape TASK-GPS-INGESTION-04's `WebhookCapableAdapter` local
//   interface (server/gps/ingestion/webhookRoute.ts) is designed to accept
//   from any future adapter that implements it.

import crypto from 'crypto';
import type { GpsProviderAdapter } from '../providers/adapter';
import type {
  GpsConnectionTestResult,
  GpsProviderDevice,
  GpsProviderTrip,
  NormalizedTelemetryPoint,
} from '../types';
import type { ProviderTelemetryPoint } from '../telemetry/types';

export const MOCK_GPS_PROVIDER_KEY = 'mock_documented_provider';

/**
 * Replay-protection tolerance for the mock's webhook signature scheme.
 * GPS-PROVIDER-RESEARCH.md §4 (Standard Webhooks spec) requires a bounded
 * timestamp tolerance but explicitly does not prescribe a value ("pick and
 * justify one"). 5 minutes is chosen to comfortably absorb clock skew and
 * ordinary network/queueing delay while still closing most of a replay
 * window — the same order of magnitude Samsara's own webhook retry policy
 * (5 attempts, exponential backoff) operates within per GPS-PROVIDER-
 * RESEARCH.md §2.
 */
export const MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

export interface MockGpsDeviceFixture extends GpsProviderDevice {
  /** Synthetic position history, ascending by recordedAt, used by getPositionHistory(). */
  positionHistory: NormalizedTelemetryPoint[];
  /** Synthetic trips, used by getTripHistory(). */
  trips: GpsProviderTrip[];
}

export interface MockAdapterOptions {
  connectionId?: string;
  tenantId?: string;
  /**
   * The registry's `getAdapter()` (server/gps/providers/registry.ts)
   * requires the resolved adapter's own `providerKey` to match the
   * connection record's `providerKey` exactly — override this to whatever
   * test-only provider key the connection fixture was created with (see
   * gpsProviderRegistry.register(providerKey, ...) call sites in tests).
   * Defaults to MOCK_GPS_PROVIDER_KEY for uses that don't go through the
   * registry at all (e.g. direct contract-test instantiation).
   */
  providerKey?: string;
  /** HMAC secret for the mock's Samsara-modeled webhook signature scheme. */
  webhookSecret?: string;
  /** Override/extend the default fixture device set. */
  devices?: MockGpsDeviceFixture[];
  /** If true, testConnection()/listDevices() etc. reject — simulates a provider outage for retry/dead-letter tests. */
  simulateOutage?: boolean;
}

function defaultDevices(connectionId: string, tenantId: string): MockGpsDeviceFixture[] {
  const now = new Date('2026-08-07T10:00:00.000Z');
  return [
    {
      // GPS-DATA-SOURCE-MATRIX.md §1/§3: online, ignition on, moving.
      providerDeviceId: 'mock-device-1',
      imei: '862112039085728', // shape per GPS-PROVIDER-RESEARCH.md §1 uniqueId example
      deviceName: 'Truck 12',
      status: 'online',
      lastSeenAt: now,
      lastLocationAt: now,
      latitude: 12.9716,
      longitude: 77.5946,
      batteryLevel: 87,
      externalPowerConnected: true,
      gpsSignalAvailable: true,
      gsmSignalStrength: 4,
      positionHistory: [
        {
          tenantId,
          connectionId,
          gpsDeviceId: 'mock-device-1', // adapter-boundary placeholder — see CONNECTION-02 report gap #2; re-keyed by the ingestion layer, never trusted as-is.
          providerDeviceId: 'mock-device-1',
          recordedAt: new Date(now.getTime() - 120_000),
          receivedAt: new Date(now.getTime() - 118_000),
          latitude: 12.965,
          longitude: 77.59,
          speedKph: 30.4, // pre-converted from a knots source per GPS-DATA-SOURCE-MATRIX.md §1
          headingDegrees: 187.5,
          altitudeMeters: 920,
          accuracyMeters: 5,
          ignition: true,
          motion: true,
          engineOn: true,
          deviceOdometerKm: 45000.5, // pre-converted from meters, GPS-DATA-SOURCE-MATRIX.md §4
          batteryLevel: 87,
          externalPowerConnected: true,
          gpsSignalAvailable: true,
          gsmSignalStrength: 4,
          address: 'MG Road, Bengaluru',
          source: 'polling',
        },
        {
          tenantId,
          connectionId,
          gpsDeviceId: 'mock-device-1',
          providerDeviceId: 'mock-device-1',
          recordedAt: now,
          receivedAt: new Date(now.getTime() + 2_000),
          latitude: 12.9716,
          longitude: 77.5946,
          speedKph: 32.4,
          headingDegrees: 190,
          altitudeMeters: 918,
          accuracyMeters: 5,
          ignition: true,
          motion: true,
          engineOn: true,
          deviceOdometerKm: 45000.9,
          batteryLevel: 87,
          externalPowerConnected: true,
          gpsSignalAvailable: true,
          gsmSignalStrength: 4,
          address: 'MG Road, Bengaluru',
          source: 'polling',
        },
      ],
      trips: [
        {
          // GPS-DATA-SOURCE-MATRIX.md §5 / GPS-PROVIDER-RESEARCH.md §1 ReportTrips shape.
          providerTripId: 'mock-trip-1',
          providerDeviceId: 'mock-device-1',
          startedAt: new Date(now.getTime() - 1_800_000),
          endedAt: new Date(now.getTime() - 120_000),
          distanceKm: 12.4,
          startOdometerKm: 44988.1,
          endOdometerKm: 45000.5,
        },
      ],
    },
    {
      // Reproduces Traccar's tri-state 'unknown' device status honestly —
      // status left undefined rather than fabricated (see file header).
      providerDeviceId: 'mock-device-2',
      imei: '862112039085999',
      deviceName: 'Van 7',
      status: undefined,
      lastSeenAt: new Date(now.getTime() - 86_400_000),
      gpsSignalAvailable: false,
      positionHistory: [],
      trips: [],
    },
  ];
}

/**
 * Builds a fully in-memory `GpsProviderAdapter` (+ webhook-capable
 * extensions used by server/gps/ingestion/webhookRoute.ts's duck-typed
 * `WebhookCapableAdapter`) whose response shapes are traceable to the
 * citations above. Intended as the shared fake other GPS test files import
 * instead of hand-rolling their own — register it on
 * `gpsProviderRegistry.register(MOCK_GPS_PROVIDER_KEY, () => createMockGpsProviderAdapter(...))`
 * or use it directly without the registry for pure contract/unit tests.
 */
export function createMockGpsProviderAdapter(
  options: MockAdapterOptions = {},
): GpsProviderAdapter & {
  verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean>;
  normalizeWebhookPayload(rawBody: Buffer, headers: Readonly<Record<string, string>>): Promise<ProviderTelemetryPoint[]>;
  __devices: MockGpsDeviceFixture[];
} {
  const connectionId = options.connectionId ?? 'mock-connection-1';
  const tenantId = options.tenantId ?? 'mock-tenant-1';
  const devices = options.devices ?? defaultDevices(connectionId, tenantId);
  const webhookSecret = options.webhookSecret ?? 'mock-webhook-secret-do-not-log';
  const byId = new Map(devices.map((d) => [d.providerDeviceId, d]));

  function outageGuard() {
    if (options.simulateOutage) {
      throw new Error('mock provider outage (simulateOutage=true)');
    }
  }

  return {
    providerKey: options.providerKey ?? MOCK_GPS_PROVIDER_KEY,
    __devices: devices,

    async testConnection(): Promise<GpsConnectionTestResult> {
      const checkedAt = new Date();
      if (options.simulateOutage) {
        return { success: false, status: 'provider_unavailable', checkedAt, providerMessage: 'mock provider outage' };
      }
      return { success: true, status: 'connected', checkedAt, latencyMs: 12 };
    },

    async listDevices(): Promise<GpsProviderDevice[]> {
      outageGuard();
      return devices.map(({ positionHistory: _p, trips: _t, ...device }) => device);
    },

    async getDevice(deviceId: string): Promise<GpsProviderDevice> {
      outageGuard();
      const device = byId.get(deviceId);
      if (!device) throw new Error(`mock adapter: unknown device "${deviceId}"`);
      const { positionHistory: _p, trips: _t, ...rest } = device;
      return rest;
    },

    async getLatestPosition(deviceId: string): Promise<NormalizedTelemetryPoint | null> {
      outageGuard();
      const device = byId.get(deviceId);
      if (!device || device.positionHistory.length === 0) return null;
      return device.positionHistory[device.positionHistory.length - 1];
    },

    async getPositionHistory(
      deviceId: string,
      startDateTime: Date,
      endDateTime: Date,
    ): Promise<NormalizedTelemetryPoint[]> {
      outageGuard();
      const device = byId.get(deviceId);
      if (!device) return [];
      return device.positionHistory.filter(
        (point) => point.recordedAt >= startDateTime && point.recordedAt <= endDateTime,
      );
    },

    async getTripHistory(
      deviceId: string,
      startDateTime: Date,
      endDateTime: Date,
    ): Promise<GpsProviderTrip[]> {
      outageGuard();
      const device = byId.get(deviceId);
      if (!device) return [];
      return device.trips.filter(
        (trip) => trip.startedAt >= startDateTime && trip.startedAt <= endDateTime,
      );
    },

    /**
     * Samsara-modeled scheme (GPS-PROVIDER-RESEARCH.md §2): signed message
     * `v1:<unix-seconds-timestamp>:<raw-body-bytes>`, HMAC-SHA256 over the
     * base64-decoded... (simplified here to a raw-utf8 secret, since this
     * mock's secret is a test fixture, not a real rotated key) secret,
     * compared in constant time. Timestamp outside
     * MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS of "now" is rejected —
     * replay protection per GPS-SECURITY-SPEC.md §3 / GPS-PROVIDER-
     * RESEARCH.md §4 rule 3.
     */
    async verifyWebhookSignature(headers: Readonly<Record<string, string>>, rawBody: Buffer): Promise<boolean> {
      const signatureHeader = headers['x-samsara-signature'];
      const timestampHeader = headers['x-samsara-timestamp'];
      if (!signatureHeader || !timestampHeader) return false;

      const timestampSeconds = Number(timestampHeader);
      if (!Number.isFinite(timestampSeconds)) return false;
      const nowSeconds = Date.now() / 1000;
      if (Math.abs(nowSeconds - timestampSeconds) > MOCK_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
        return false; // stale/replayed (or absurdly future) timestamp
      }

      const expectedHex = crypto
        .createHmac('sha256', webhookSecret)
        .update(`v1:${timestampHeader}:${rawBody.toString('utf8')}`)
        .digest('hex');
      const expected = `v1=${expectedHex}`;

      const expectedBuf = Buffer.from(expected, 'utf8');
      const actualBuf = Buffer.from(signatureHeader, 'utf8');
      if (expectedBuf.length !== actualBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, actualBuf);
    },

    async normalizeWebhookPayload(rawBody: Buffer): Promise<ProviderTelemetryPoint[]> {
      // Malformed-body handling: JSON.parse throwing here is exactly what
      // webhookRoute.ts's catch block turns into a 400 "could not be
      // parsed" response *before* any point is resolved/stored — see
      // GPS-SECURITY-SPEC.md §3's "reject ... before touching the payload"
      // requirement, exercised for the *signature* stage separately.
      const parsed = JSON.parse(rawBody.toString('utf8')) as {
        points?: Array<{ providerDeviceId: string; latitude: number; longitude: number; recordedAt: string; speedKph?: number }>;
      };
      if (!Array.isArray(parsed.points)) return [];
      return parsed.points.map((p) => ({
        providerDeviceId: p.providerDeviceId,
        recordedAt: new Date(p.recordedAt),
        receivedAt: new Date(),
        latitude: p.latitude,
        longitude: p.longitude,
        speedKph: p.speedKph,
        source: 'webhook' as const,
      }));
    },
  };
}

/**
 * Signs a body with the mock's Samsara-modeled scheme — the counterpart to
 * `verifyWebhookSignature` above, for tests that need to construct a
 * genuinely-valid signed request. `timestampSeconds` defaults to "now";
 * pass an explicit stale value to exercise replay-window rejection.
 */
export function signMockWebhookPayload(
  rawBody: Buffer,
  webhookSecret: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): { 'x-samsara-signature': string; 'x-samsara-timestamp': string } {
  const signatureHex = crypto
    .createHmac('sha256', webhookSecret)
    .update(`v1:${timestampSeconds}:${rawBody.toString('utf8')}`)
    .digest('hex');
  return {
    'x-samsara-signature': `v1=${signatureHex}`,
    'x-samsara-timestamp': String(timestampSeconds),
  };
}
