import mongoose from 'mongoose';
import type { NormalizedTelemetryPoint } from '../types';
import { GpsTelemetryPoint } from './models/telemetryPoint';
import { GpsVehicleLatestState } from './models/vehicleLatestState';
import { deriveMovingStatus } from './movingStatus';
import type { MovingStatus } from './types';

export interface StoreTelemetryPointResult {
  /** True if a new `GpsTelemetryPoint` row was inserted. */
  stored: boolean;
  /** True if this exact (tenant, internal device, recordedAt) fix was already stored — poll/webhook double-delivery, handled as a no-op, not an error. */
  duplicate: boolean;
  movingStatus: MovingStatus;
}

/**
 * Persists one already-normalized, already-internal-id-resolved telemetry
 * point: inserts it into the append-only `GpsTelemetryPoint` history
 * (deduped via the model's unique index) and upserts the derived
 * `GpsVehicleLatestState` read model if this point is not older than what's
 * already there. Never throws on a duplicate — that is the expected,
 * routine outcome when a poll and a (future) webhook report the same fix.
 */
export async function storeTelemetryPoint(point: NormalizedTelemetryPoint): Promise<StoreTelemetryPointResult> {
  if (!mongoose.isValidObjectId(point.gpsDeviceId)) {
    throw new Error(
      'storeTelemetryPoint requires an internal gpsDeviceId (resolved via the device list or resolveInternalGpsDevice()), not a raw provider device id.',
    );
  }

  const previousState = await GpsVehicleLatestState.findOne({
    tenantId: point.tenantId,
    gpsDeviceId: point.gpsDeviceId,
  }).lean();

  const derived = deriveMovingStatus({
    motion: point.motion,
    ignition: point.ignition,
    speedKph: point.speedKph,
    recordedAt: point.recordedAt,
    previous: previousState
      ? {
          status: previousState.movingStatus,
          since: previousState.movingStatusSince,
          sustainedAboveThresholdSince: previousState.movingStatusSustainedAboveThresholdSince,
        }
      : undefined,
  });

  let stored = true;
  try {
    await GpsTelemetryPoint.create({
      tenantId: point.tenantId,
      connectionId: point.connectionId,
      gpsDeviceId: point.gpsDeviceId,
      providerDeviceId: point.providerDeviceId,
      recordedAt: point.recordedAt,
      receivedAt: point.receivedAt,
      latitude: point.latitude,
      longitude: point.longitude,
      speedKph: point.speedKph,
      headingDegrees: point.headingDegrees,
      altitudeMeters: point.altitudeMeters,
      accuracyMeters: point.accuracyMeters,
      ignition: point.ignition,
      motion: point.motion,
      engineOn: point.engineOn,
      deviceOdometerKm: point.deviceOdometerKm,
      providerTripDistanceKm: point.providerTripDistanceKm,
      batteryLevel: point.batteryLevel,
      externalPowerConnected: point.externalPowerConnected,
      gpsSignalAvailable: point.gpsSignalAvailable,
      gsmSignalStrength: point.gsmSignalStrength,
      address: point.address,
      movingStatus: derived.status,
      source: point.source,
      providerEventId: point.providerEventId,
      rawPayloadHash: point.rawPayloadHash,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      // Same fix already stored by a prior poll or webhook — routine, not an error.
      return {
        stored: false,
        duplicate: true,
        movingStatus: previousState?.movingStatus ?? derived.status,
      };
    }
    throw error;
  }

  // Only advance "latest state" if this point is not older than what's
  // already there — a position-history gap-fill can deliver points out of
  // chronological order relative to the currently-known latest fix.
  if (!previousState || point.recordedAt.getTime() >= previousState.recordedAt.getTime()) {
    await GpsVehicleLatestState.findOneAndUpdate(
      { tenantId: point.tenantId, gpsDeviceId: point.gpsDeviceId },
      {
        $set: {
          connectionId: point.connectionId,
          providerDeviceId: point.providerDeviceId,
          recordedAt: point.recordedAt,
          receivedAt: point.receivedAt,
          latitude: point.latitude,
          longitude: point.longitude,
          speedKph: point.speedKph,
          headingDegrees: point.headingDegrees,
          altitudeMeters: point.altitudeMeters,
          ignition: point.ignition,
          motion: point.motion,
          engineOn: point.engineOn,
          batteryLevel: point.batteryLevel,
          externalPowerConnected: point.externalPowerConnected,
          gpsSignalAvailable: point.gpsSignalAvailable,
          address: point.address,
          movingStatus: derived.status,
          movingStatusSince: derived.since,
          movingStatusSustainedAboveThresholdSince: derived.sustainedAboveThresholdSince,
          source: point.source,
        },
      },
      { upsert: true },
    );
  }

  return { stored, duplicate: false, movingStatus: derived.status };
}
