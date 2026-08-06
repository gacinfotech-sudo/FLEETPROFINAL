// Maps raw Traccar API shapes onto FleetPro's existing provider-neutral
// types (server/gps/types.ts). This is the single place unit conversions
// happen, per docs/gps-research/GPS-PROVIDER-RESEARCH.md's closing line:
// "normalizing to SI-ish units at the adapter boundary [is] non-negotiable"
// and docs/gps-research/GPS-DATA-SOURCE-MATRIX.md §4's two documented traps.

import { createHash } from 'node:crypto';
import type { GpsProviderDevice, GpsProviderTrip, NormalizedTelemetryPoint } from '../../../types';
import type {
  TraccarDevice,
  TraccarDeviceAccumulators,
  TraccarPosition,
  TraccarTripReportRow,
} from './traccarApiTypes';

/** GPS-DATA-SOURCE-MATRIX.md §1: Traccar `speed` is in knots. */
export const KNOTS_TO_KMH = 1.852;
/** GPS-DATA-SOURCE-MATRIX.md §4: Traccar's `attributes.hours` is milliseconds. */
export const MS_TO_S = 1 / 1000;
const METERS_TO_KM = 1 / 1000;

/**
 * Traccar's `device.status` is documented tri-state (online/offline/unknown)
 * but GpsProviderDevice.status only declares
 * `online | offline | inactive | faulty` — no `unknown` value exists on the
 * shared type (GPS-PROVIDER-RESEARCH.md §1 vs. server/gps/types.ts). Rather
 * than inventing a fifth status value on a shared type, `unknown` and a
 * `disabled` device both map to the closest existing value, `inactive`,
 * and the untranslated Traccar status is preserved in `metadata.traccarStatus`
 * so nothing is silently lost. This mapping choice — and the underlying gap —
 * is called out as a proposed interface patch in this task's report.
 */
function mapDeviceStatus(device: TraccarDevice): GpsProviderDevice['status'] {
  if (device.disabled) return 'inactive';
  if (device.status === 'online') return 'online';
  if (device.status === 'offline') return 'offline';
  return 'inactive'; // covers 'unknown' and an absent status field
}

export interface TraccarPositionByDeviceId {
  get(deviceId: number): TraccarPosition | undefined;
}

export function toGpsProviderDevice(
  device: TraccarDevice,
  latestPosition: TraccarPosition | undefined,
  accumulators: TraccarDeviceAccumulators | undefined,
): GpsProviderDevice {
  const metadata: Record<string, unknown> = {
    traccarStatus: device.status,
    disabled: device.disabled ?? false,
    groupId: device.groupId,
    positionId: device.positionId,
    category: device.category,
    attributes: device.attributes,
  };
  if (accumulators?.totalDistance !== undefined) {
    metadata.odometerMeters = accumulators.totalDistance;
  }
  if (accumulators?.hours !== undefined) {
    // GPS-DATA-SOURCE-MATRIX.md §4 flags the Traccar ms-vs-seconds trap;
    // applying the same conversion here as for attributes.hours.
    metadata.engineHoursSeconds = accumulators.hours * MS_TO_S;
  }

  return {
    providerDeviceId: String(device.id),
    imei: device.uniqueId,
    deviceModel: device.model || undefined,
    deviceName: device.name || undefined,
    providerDeviceType: device.category || undefined,
    status: mapDeviceStatus(device),
    lastSeenAt: device.lastUpdate ? new Date(device.lastUpdate) : undefined,
    lastLocationAt: latestPosition?.fixTime ? new Date(latestPosition.fixTime) : undefined,
    latitude: latestPosition?.latitude,
    longitude: latestPosition?.longitude,
    batteryLevel: latestPosition?.attributes?.batteryLevel,
    // externalPowerConnected / gpsSignalAvailable / gsmSignalStrength are
    // intentionally omitted: no Traccar field for any of them is documented
    // in GPS-PROVIDER-RESEARCH.md §1 (see GPS-DATA-SOURCE-MATRIX.md's rule:
    // "a blank/'—' cell means the field genuinely isn't documented ...
    // never substitute a fabricated value").
    metadata,
  };
}

export function toNormalizedTelemetryPoint(
  position: TraccarPosition,
  context: {
    tenantId: string;
    connectionId: string;
    source: NormalizedTelemetryPoint['source'];
  },
): NormalizedTelemetryPoint {
  const attributes = position.attributes || {};
  const odometerMeters = attributes.odometer ?? attributes.totalDistance;
  const rawPayloadHash = createHash('sha256').update(JSON.stringify(position)).digest('hex');

  return {
    tenantId: context.tenantId,
    connectionId: context.connectionId,
    // The adapter only knows Traccar's own device id, not FleetPro's
    // internal GpsDevice._id (that mapping lives in deviceService.ts, which
    // this task does not touch). providerDeviceId is the authoritative
    // value; gpsDeviceId is populated with the same string as a
    // non-breaking placeholder until the ingestion layer (TASK-GPS-
    // INGESTION-04) resolves and overwrites it with the real internal id
    // before persistence. See this task's report for the proposed fix.
    gpsDeviceId: String(position.deviceId),
    providerDeviceId: String(position.deviceId),
    recordedAt: new Date(position.fixTime),
    receivedAt: new Date(),
    latitude: position.latitude,
    longitude: position.longitude,
    speedKph: typeof position.speed === 'number' ? position.speed * KNOTS_TO_KMH : undefined,
    headingDegrees: position.course,
    altitudeMeters: position.altitude,
    accuracyMeters: position.accuracy,
    ignition: attributes.ignition,
    motion: attributes.motion,
    // `engineOn` is intentionally left undefined here rather than aliased to
    // `ignition`: Traccar only exposes raw `ignition`; a distinct derived
    // `engineOn` semantic (e.g. reconciled with motion/speed) is
    // TASK-GPS-INGESTION-04's normalization responsibility per
    // GPS-DATA-SOURCE-MATRIX.md §2-3, not this adapter's.
    deviceOdometerKm: typeof odometerMeters === 'number' ? odometerMeters * METERS_TO_KM : undefined,
    providerTripDistanceKm: typeof attributes.tripOdometer === 'number' ? attributes.tripOdometer * METERS_TO_KM : undefined,
    batteryLevel: attributes.batteryLevel,
    address: position.address,
    source: context.source,
    providerEventId: String(position.id),
    rawPayloadHash,
  };
}

export function toGpsProviderTrip(row: TraccarTripReportRow, requestedDeviceId: string): GpsProviderTrip {
  return {
    // GPS-PROVIDER-RESEARCH.md §1's documented `/reports/trips` row shape
    // has no trip identifier field (unlike Position.id) — providerTripId is
    // left undefined rather than synthesized, per the project rule against
    // inventing fields. Callers needing an idempotency key should compose
    // one from (providerDeviceId, startedAt, endedAt).
    providerDeviceId: row.deviceId !== undefined ? String(row.deviceId) : requestedDeviceId,
    startedAt: new Date(row.startTime),
    endedAt: row.endTime ? new Date(row.endTime) : undefined,
    distanceKm: typeof row.distance === 'number' ? row.distance * METERS_TO_KM : undefined,
    // startOdometerKm/endOdometerKm are not part of the documented
    // ReportTrips row (only cumulative `distance` for the trip is) — left
    // undefined rather than invented.
  };
}
