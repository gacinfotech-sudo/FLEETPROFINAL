// Traccar adapter — implements the existing GpsProviderAdapter interface
// (server/gps/providers/adapter.ts) against Traccar's documented REST API.
// See docs/gps-research/GPS-PROVIDER-RESEARCH.md §1 for every endpoint path
// and field cited below, and this task's report
// (.claude/tasks/reports/TASK-GPS-CONNECTION-02-report.md) for which
// endpoints were implemented vs. deferred and why.

import type { GpsProviderAdapter } from '../../adapter';
import { GpsProviderConfigurationError } from '../../registry';
import type {
  GpsConnectionTestResult,
  GpsProviderConnectionConfig,
  GpsProviderDevice,
  GpsProviderTrip,
  NormalizedTelemetryPoint,
} from '../../../types';
import type { TraccarDevice, TraccarDeviceAccumulators, TraccarPosition, TraccarTripReportRow } from './traccarApiTypes';
import {
  TraccarAuthenticationFailedError,
  TraccarClient,
  TraccarNotFoundError,
  TraccarProviderUnavailableError,
  TraccarRateLimitedError,
} from './traccarClient';
import { toGpsProviderDevice, toGpsProviderTrip, toNormalizedTelemetryPoint } from './traccarNormalize';

export const TRACCAR_PROVIDER_KEY = 'traccar';

/**
 * Capability facts about this Traccar connection. Not part of the shared
 * GpsProviderAdapter interface (which has no capabilities()-shaped method
 * today — see this task's report for the proposed patch); exposed as a
 * regular method on the concrete class so callers written against this
 * specific adapter (or a future capabilities() addition) can read it without
 * widening the shared interface unilaterally.
 *
 * Static facts are sourced from GPS-DATA-SOURCE-MATRIX.md §8's capability
 * table for Traccar. `reportsAccessible` is the one live-detected value:
 * some Traccar user roles restrict access to /reports/* even though the
 * endpoint exists for admin accounts, so it is checked per-connection
 * rather than assumed.
 */
export interface TraccarCapabilities {
  hasNativeTrips: boolean;
  hasMovingStatus: 'derive';
  hasOnlineStatus: true;
  hasIgnition: boolean;
  hasOdometer: boolean;
  hasEngineHours: boolean;
  hasGeofenceEvents: boolean;
  hasWebhooks: false;
  webhookSigned: false;
  paginationStyle: 'offset_limit';
  supportsIncrementalSync: false;
  reportsAccessible: boolean;
}

function credentialsPresent(connection: Readonly<GpsProviderConnectionConfig>): boolean {
  const { apiToken, apiUsername, apiPassword } = connection.secrets;
  return Boolean(apiToken) || Boolean(apiUsername && apiPassword);
}

export class TraccarAdapter implements GpsProviderAdapter {
  readonly providerKey = TRACCAR_PROVIDER_KEY;

  constructor(
    private readonly client: TraccarClient,
    private readonly connection: Readonly<GpsProviderConnectionConfig>,
  ) {}

  /**
   * GET /devices, GET /positions, and — best-effort — one accumulators call
   * per device, all cited in GPS-PROVIDER-RESEARCH.md §1. Positions and
   * devices are joined client-side by deviceId so a device preview can show
   * a last-known location without a second round trip per caller.
   */
  async listDevices(): Promise<GpsProviderDevice[]> {
    const [devices, positions] = await Promise.all([
      this.client.get<TraccarDevice[]>('/devices'),
      this.client.get<TraccarPosition[]>('/positions'),
    ]);
    const positionByDeviceId = new Map<number, TraccarPosition>();
    for (const position of positions) positionByDeviceId.set(position.deviceId, position);

    const accumulatorsByDeviceId = await this.fetchAccumulatorsBestEffort(devices.map((device) => device.id));

    return devices.map((device) =>
      toGpsProviderDevice(device, positionByDeviceId.get(device.id), accumulatorsByDeviceId.get(device.id)),
    );
  }

  /**
   * GET /devices?id={id} — GPS-PROVIDER-RESEARCH.md §1 documents `id` as a
   * repeatable filter param on the list endpoint, not a distinct
   * `/devices/{id}` path, so a single-device fetch is the same endpoint with
   * one `id` value.
   */
  async getDevice(deviceId: string): Promise<GpsProviderDevice> {
    const numericId = toTraccarDeviceId(deviceId);
    const devices = await this.client.get<TraccarDevice[]>('/devices', { id: [numericId] });
    const device = devices[0];
    if (!device) throw new TraccarNotFoundError(`device ${deviceId}`);

    const [position, accumulators] = await Promise.all([
      this.fetchLatestPositionRaw(numericId),
      this.fetchAccumulatorsBestEffort([numericId]).then((map) => map.get(numericId)),
    ]);
    return toGpsProviderDevice(device, position, accumulators);
  }

  /**
   * GET /positions?deviceId={id} (no from/to) — GPS-PROVIDER-RESEARCH.md §1
   * "Current position" documents `GET /positions` (no params) as "last known
   * position per device"; combined with the `deviceId` filter param
   * documented in the same section's historical-query example, this scopes
   * that same latest-position snapshot to a single device rather than
   * querying a separate endpoint.
   */
  async getLatestPosition(deviceId: string): Promise<NormalizedTelemetryPoint | null> {
    const numericId = toTraccarDeviceId(deviceId);
    const position = await this.fetchLatestPositionRaw(numericId);
    if (!position) return null;
    return toNormalizedTelemetryPoint(position, {
      tenantId: this.connection.tenantId,
      connectionId: this.connection.id,
      source: 'polling',
    });
  }

  /**
   * GET /positions?deviceId=&from=&to= for one device — GPS-PROVIDER-
   * RESEARCH.md §1 "Historical positions & reports".
   */
  async getPositionHistory(deviceId: string, startDateTime: Date, endDateTime: Date): Promise<NormalizedTelemetryPoint[]> {
    const numericId = toTraccarDeviceId(deviceId);
    const positions = await this.client.get<TraccarPosition[]>('/positions', {
      deviceId: numericId,
      from: startDateTime.toISOString(),
      to: endDateTime.toISOString(),
    });
    return positions.map((position) =>
      toNormalizedTelemetryPoint(position, {
        tenantId: this.connection.tenantId,
        connectionId: this.connection.id,
        source: 'history_sync',
      }),
    );
  }

  /**
   * GET /reports/trips?deviceId=&from=&to= — GPS-PROVIDER-RESEARCH.md §1
   * "Historical positions & reports" (Reports API). Long ranges may hit
   * Traccar's "slow" reprocessing path (§1: "Reports auto-select a 'slow'
   * ... or 'fast' ... path based on report.fastThreshold, default 1 day");
   * this method does not add its own timeout tuning for that case beyond the
   * client's shared request timeout.
   */
  async getTripHistory(deviceId: string, startDateTime: Date, endDateTime: Date): Promise<GpsProviderTrip[]> {
    const numericId = toTraccarDeviceId(deviceId);
    const rows = await this.client.get<TraccarTripReportRow[]>('/reports/trips', {
      deviceId: [numericId],
      from: startDateTime.toISOString(),
      to: endDateTime.toISOString(),
    });
    return rows.map((row) => toGpsProviderTrip(row, deviceId));
  }

  // subscribeToLivePositions is intentionally NOT implemented. Traccar's
  // only live-update channel is /api/socket, and GPS-PROVIDER-RESEARCH.md
  // §1 states plainly: "Session cookie is the only authorization option for
  // the WebSocket connection" — Bearer/Basic will not work there. Building a
  // cookie-session client is a materially different auth flow than the
  // token/basic flow this adapter otherwise uses, and
  // docs/gps-research/TELEMATICS-ARCHITECTURE.md §5 explicitly defers this:
  // "the /api/socket WebSocket path as a possible later optimization gated
  // behind a real WebSocket/SSE decision ... not a day-one requirement."
  // This task's scope also excludes wiring adapter methods into any live
  // poller/broadcast path.

  // verifyWebhookSignature is intentionally NOT implemented. Traccar has no
  // per-tenant, API-configurable webhook subscription or signature scheme —
  // GPS-PROVIDER-RESEARCH.md §1 "Webhooks — a critical limitation":
  // forwarding is a server-side config-file feature set by whoever
  // administers the Traccar instance, with "no HMAC, no signature, no replay
  // protection documented anywhere". Implementing this method would require
  // fabricating a signature scheme Traccar does not have.

  /**
   * GET /devices as a reachability + auth probe, cross-checked against a
   * live capability read. Reports "connected" (not just binary success) with
   * an honest degraded signal folded into the existing
   * GpsConnectionTestResult.providerMessage/errorCode fields rather than a
   * new status value — GpsConnectionStatus (server/gps/types.ts) has no
   * `degraded` member and connection.status is a fixed Mongoose enum
   * (server/gps/models/gpsConnection.ts), so a genuinely new status value
   * cannot be returned without changing a shared schema this task does not
   * own.
   */
  async testConnection(): Promise<GpsConnectionTestResult> {
    const startedAt = Date.now();
    try {
      const devices = await this.client.get<TraccarDevice[]>('/devices', { limit: 1 });
      const latencyMs = Date.now() - startedAt;
      const capabilities = await this.detectCapabilities(devices[0]?.id);

      if (devices.length === 0) {
        return {
          success: true,
          status: 'connected',
          checkedAt: new Date(),
          latencyMs,
          providerMessage: 'Connected to Traccar, but this account currently has zero visible devices (degraded: verify device visibility/permissions on the Traccar side).',
          errorCode: 'DEGRADED_NO_DEVICES',
        };
      }
      if (!capabilities.reportsAccessible) {
        return {
          success: true,
          status: 'connected',
          checkedAt: new Date(),
          latencyMs,
          providerMessage: 'Connected to Traccar and devices are visible, but this account cannot access /reports/* (degraded: trip history will be unavailable until report permissions are granted).',
          errorCode: 'DEGRADED_REPORTS_INACCESSIBLE',
        };
      }
      return { success: true, status: 'connected', checkedAt: new Date(), latencyMs };
    } catch (error) {
      return this.toTestResult(error, Date.now() - startedAt);
    }
  }

  /**
   * See TraccarCapabilities' doc comment for what is static vs.
   * live-detected. `probeDeviceId` should be a real device on this
   * connection — GPS-PROVIDER-RESEARCH.md §1 documents `/reports/trips` as
   * requiring `deviceId[]`/`groupId[]` alongside `from`/`to`, so probing
   * without a device id risks a plain "bad request" being misread as a
   * permissions failure. When no device is available to probe with (e.g. a
   * zero-device account), report accessibility is left as the optimistic
   * default (true) rather than guessed at.
   */
  async detectCapabilities(probeDeviceId?: number): Promise<TraccarCapabilities> {
    let reportsAccessible = true;
    if (probeDeviceId !== undefined) {
      try {
        // A zero-width window is the cheapest possible probe of report
        // accessibility without incurring Traccar's "slow"
        // (reprocess-all-positions) report path (GPS-PROVIDER-RESEARCH.md
        // §1) for an arbitrary device.
        const now = new Date();
        await this.client.get<TraccarTripReportRow[]>('/reports/trips', {
          deviceId: [probeDeviceId],
          from: now.toISOString(),
          to: now.toISOString(),
        });
      } catch (error) {
        // Only a clear auth rejection is treated as diagnostic of "this
        // account/role cannot access reports" — anything else (rate limit,
        // transient unavailability, an unexpected 4xx) is left inconclusive
        // (true) rather than reported as a false capability gap.
        if (error instanceof TraccarAuthenticationFailedError) reportsAccessible = false;
      }
    }
    return {
      hasNativeTrips: true,
      hasMovingStatus: 'derive',
      hasOnlineStatus: true,
      hasIgnition: true,
      hasOdometer: true,
      hasEngineHours: true,
      hasGeofenceEvents: true,
      hasWebhooks: false,
      webhookSigned: false,
      paginationStyle: 'offset_limit',
      supportsIncrementalSync: false,
      reportsAccessible,
    };
  }

  private async fetchLatestPositionRaw(numericDeviceId: number): Promise<TraccarPosition | undefined> {
    const positions = await this.client.get<TraccarPosition[]>('/positions', { deviceId: numericDeviceId });
    if (positions.length === 0) return undefined;
    // Defensive: documented as "last known position", but if more than one
    // is ever returned, prefer the most recent fixTime rather than assuming
    // array order.
    return positions.reduce((latest, candidate) =>
      new Date(candidate.fixTime).getTime() > new Date(latest.fixTime).getTime() ? candidate : latest,
    );
  }

  private async fetchAccumulatorsBestEffort(numericDeviceIds: number[]): Promise<Map<number, TraccarDeviceAccumulators>> {
    const result = new Map<number, TraccarDeviceAccumulators>();
    await Promise.all(
      numericDeviceIds.map(async (id) => {
        try {
          const accumulators = await this.client.get<TraccarDeviceAccumulators>(`/devices/${id}/accumulators`);
          result.set(id, accumulators);
        } catch {
          // Accumulators are a supplementary enrichment (odometer/engine
          // hours), not required for a device/position result — a single
          // device's accumulators call failing must not fail the whole
          // listDevices()/getDevice() call.
        }
      }),
    );
    return result;
  }

  private toTestResult(error: unknown, latencyMs: number): GpsConnectionTestResult {
    const checkedAt = new Date();
    if (error instanceof TraccarAuthenticationFailedError) {
      return { success: false, status: 'authentication_failed', checkedAt, latencyMs, providerMessage: 'Traccar rejected the configured credentials.' };
    }
    if (error instanceof TraccarRateLimitedError) {
      return { success: false, status: 'rate_limited', checkedAt, latencyMs, providerMessage: 'Traccar rate limit exceeded.' };
    }
    if (error instanceof TraccarProviderUnavailableError) {
      return { success: false, status: 'provider_unavailable', checkedAt, latencyMs, providerMessage: 'Traccar did not respond successfully.' };
    }
    return { success: false, status: 'provider_unavailable', checkedAt, latencyMs, providerMessage: 'Traccar connection test failed.' };
  }
}

function toTraccarDeviceId(deviceId: string): number {
  const numericId = Number(deviceId);
  if (!Number.isFinite(numericId) || !Number.isInteger(numericId)) {
    throw new TraccarProviderUnavailableError(`invalid Traccar device id "${deviceId}".`);
  }
  return numericId;
}

/**
 * Provider factory registered into runtimeRegistry.ts. Validates the
 * minimum configuration Traccar needs and throws the existing
 * GpsProviderConfigurationError (server/gps/providers/registry.ts) on
 * missing config — this is the same error class the empty registry already
 * throws for an unregistered provider, so connections stay
 * `configuration_required` rather than surfacing a raw exception.
 */
export function createTraccarAdapter(connection: Readonly<GpsProviderConnectionConfig>): GpsProviderAdapter {
  if (!connection.apiBaseUrl) {
    throw new GpsProviderConfigurationError('Traccar connections require apiBaseUrl (e.g. https://your-traccar-host:8082).');
  }
  if (!credentialsPresent(connection)) {
    throw new GpsProviderConfigurationError('Traccar connections require either apiToken, or apiUsername and apiPassword.');
  }
  if (
    connection.authenticationType !== 'bearer_token'
    && connection.authenticationType !== 'basic_authentication'
    && connection.authenticationType !== 'session_login'
  ) {
    // Only Basic, Bearer-token and cookie/session auth are documented for
    // Traccar (GPS-PROVIDER-RESEARCH.md §1) — no OAuth2 client-credentials
    // flow or generic API-key header scheme exists, so those
    // authenticationType values are refused rather than guessed at.
    throw new GpsProviderConfigurationError(
      `Traccar does not document an "${connection.authenticationType}" authentication flow. Use bearer_token, basic_authentication, or session_login.`,
    );
  }

  const client = new TraccarClient({
    apiBaseUrl: connection.apiBaseUrl,
    authenticationType: connection.authenticationType,
    secrets: {
      apiToken: connection.secrets.apiToken,
      apiUsername: connection.secrets.apiUsername,
      apiPassword: connection.secrets.apiPassword,
    },
  });
  return new TraccarAdapter(client, connection);
}
