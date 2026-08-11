import mongoose from 'mongoose';
import type { NormalizedTelemetryPoint } from '../types';
import { GpsTelemetryPoint } from './models/telemetryPoint';
import { GpsVehicleLatestState } from './models/vehicleLatestState';
import type { MovingStatus, StoredTelemetryPoint } from './types';

const DEFAULT_HISTORY_LIMIT = 5000;
const MAX_HISTORY_LIMIT = 20000;

export interface VehicleLatestState {
  tenantId: string;
  gpsDeviceId: string;
  connectionId: string;
  providerDeviceId: string;
  recordedAt: Date;
  receivedAt: Date;
  latitude: number;
  longitude: number;
  speedKph?: number;
  headingDegrees?: number;
  altitudeMeters?: number;
  ignition?: boolean;
  motion?: boolean;
  engineOn?: boolean;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  address?: string;
  movingStatus: MovingStatus;
  movingStatusSince: Date;
  source: NormalizedTelemetryPoint['source'];
  updatedAt: Date;
}

function toPublicLatestState(doc: any): VehicleLatestState {
  return {
    tenantId: String(doc.tenantId),
    gpsDeviceId: String(doc.gpsDeviceId),
    connectionId: String(doc.connectionId),
    providerDeviceId: doc.providerDeviceId,
    recordedAt: doc.recordedAt,
    receivedAt: doc.receivedAt,
    latitude: doc.latitude,
    longitude: doc.longitude,
    speedKph: doc.speedKph,
    headingDegrees: doc.headingDegrees,
    altitudeMeters: doc.altitudeMeters,
    ignition: doc.ignition,
    motion: doc.motion,
    engineOn: doc.engineOn,
    batteryLevel: doc.batteryLevel,
    externalPowerConnected: doc.externalPowerConnected,
    gpsSignalAvailable: doc.gpsSignalAvailable,
    address: doc.address,
    movingStatus: doc.movingStatus,
    movingStatusSince: doc.movingStatusSince,
    source: doc.source,
    updatedAt: doc.updatedAt,
  };
}

function toStoredTelemetryPoint(doc: any): StoredTelemetryPoint {
  return {
    tenantId: String(doc.tenantId),
    connectionId: String(doc.connectionId),
    gpsDeviceId: String(doc.gpsDeviceId),
    providerDeviceId: doc.providerDeviceId,
    recordedAt: doc.recordedAt,
    receivedAt: doc.receivedAt,
    latitude: doc.latitude,
    longitude: doc.longitude,
    speedKph: doc.speedKph,
    headingDegrees: doc.headingDegrees,
    altitudeMeters: doc.altitudeMeters,
    accuracyMeters: doc.accuracyMeters,
    ignition: doc.ignition,
    motion: doc.motion,
    engineOn: doc.engineOn,
    deviceOdometerKm: doc.deviceOdometerKm,
    providerTripDistanceKm: doc.providerTripDistanceKm,
    batteryLevel: doc.batteryLevel,
    externalPowerConnected: doc.externalPowerConnected,
    gpsSignalAvailable: doc.gpsSignalAvailable,
    gsmSignalStrength: doc.gsmSignalStrength,
    address: doc.address,
    source: doc.source,
    providerEventId: doc.providerEventId,
    rawPayloadHash: doc.rawPayloadHash,
    movingStatus: doc.movingStatus,
  };
}

/**
 * Finalized signature — TASK-GPS-FLEET-UI-05 (live map/status cards) and
 * TASK-GPS-TRIP-BILLING-06 (reconciliation) both depend on this exact
 * shape. See this task's report.
 */
export async function getLatestVehicleState(params: {
  tenantId: string;
  gpsDeviceId: string;
}): Promise<VehicleLatestState | null> {
  if (!mongoose.isValidObjectId(params.gpsDeviceId)) return null;
  const doc = await GpsVehicleLatestState.findOne({
    tenantId: params.tenantId,
    gpsDeviceId: params.gpsDeviceId,
  }).lean();
  return doc ? toPublicLatestState(doc) : null;
}

/**
 * Bulk form of getLatestVehicleState — for a fleet map/status board.
 * Omitting `gpsDeviceIds` returns every device's latest state for the tenant.
 */
export async function getLatestVehicleStates(params: {
  tenantId: string;
  gpsDeviceIds?: string[];
}): Promise<VehicleLatestState[]> {
  const query: Record<string, unknown> = { tenantId: params.tenantId };
  if (params.gpsDeviceIds?.length) {
    query.gpsDeviceId = { $in: params.gpsDeviceIds.filter((id) => mongoose.isValidObjectId(id)) };
  }
  const docs = await GpsVehicleLatestState.find(query).lean();
  return docs.map(toPublicLatestState);
}

/**
 * Finalized signature — position-history-by-time-range. TASK-GPS-TRIP-
 * BILLING-06's distance reconciliation and TASK-GPS-FLEET-UI-05's map
 * playback both depend on this exact shape. See this task's report.
 * Returns points sorted ascending by `recordedAt`, capped at `limit`
 * (default 5000, hard max 20000, to bound a single response's size — a
 * caller needing more than that should page by narrowing the time range).
 */
export async function getPositionHistoryByRange(params: {
  tenantId: string;
  gpsDeviceId: string;
  startDateTime: Date;
  endDateTime: Date;
  limit?: number;
}): Promise<StoredTelemetryPoint[]> {
  if (!mongoose.isValidObjectId(params.gpsDeviceId)) return [];
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_HISTORY_LIMIT, 1), MAX_HISTORY_LIMIT);
  const docs = await GpsTelemetryPoint.find({
    tenantId: params.tenantId,
    gpsDeviceId: params.gpsDeviceId,
    recordedAt: { $gte: params.startDateTime, $lte: params.endDateTime },
  })
    .sort({ recordedAt: 1 })
    .limit(limit)
    .lean();
  return docs.map(toStoredTelemetryPoint);
}
