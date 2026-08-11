import mongoose, { Document, Schema } from 'mongoose';
import type { MovingStatus } from '../types';
import { TELEMETRY_POINT_RETENTION_SECONDS } from '../retention';

export interface IGpsTelemetryPoint extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  gpsDeviceId: mongoose.Types.ObjectId;
  providerDeviceId: string;
  recordedAt: Date;
  receivedAt: Date;
  latitude: number;
  longitude: number;
  speedKph?: number;
  headingDegrees?: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  ignition?: boolean;
  motion?: boolean;
  engineOn?: boolean;
  deviceOdometerKm?: number;
  providerTripDistanceKm?: number;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  gsmSignalStrength?: number;
  address?: string;
  movingStatus: MovingStatus;
  source: 'webhook' | 'websocket' | 'polling' | 'history_sync';
  providerEventId?: string;
  rawPayloadHash?: string;
  createdAt: Date;
}

const GpsTelemetryPointSchema = new Schema<IGpsTelemetryPoint>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice', required: true },
  providerDeviceId: { type: String, required: true, trim: true, maxlength: 300 },
  recordedAt: { type: Date, required: true },
  receivedAt: { type: Date, required: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  speedKph: { type: Number },
  headingDegrees: { type: Number },
  altitudeMeters: { type: Number },
  accuracyMeters: { type: Number },
  ignition: { type: Boolean },
  motion: { type: Boolean },
  engineOn: { type: Boolean },
  deviceOdometerKm: { type: Number },
  providerTripDistanceKm: { type: Number },
  batteryLevel: { type: Number, min: 0, max: 100 },
  externalPowerConnected: { type: Boolean },
  gpsSignalAvailable: { type: Boolean },
  gsmSignalStrength: { type: Number },
  address: { type: String, maxlength: 500 },
  movingStatus: { type: String, enum: ['moving', 'stopped', 'offline'], required: true },
  source: { type: String, enum: ['webhook', 'websocket', 'polling', 'history_sync'], required: true },
  providerEventId: { type: String, maxlength: 300 },
  rawPayloadHash: { type: String, maxlength: 128 },
}, { timestamps: { createdAt: true, updatedAt: false } });

// Dedup: the same physical fix (tenant + internal device + exact recorded
// timestamp) can only ever be stored once, whether it arrived via polling or
// a webhook. This unique index *is* the dedup mechanism — storeTelemetryPoint
// relies on its E11000 duplicate-key error, exactly like deviceService.ts's
// existing synchronizeProviderDevices() pattern for provider-device sync.
// See this task's report, "Dedup key used", for the full reasoning.
GpsTelemetryPointSchema.index({ tenantId: 1, gpsDeviceId: 1, recordedAt: 1 }, { unique: true });

// Primary read pattern for downstream tasks: position history for one
// device across a time range (TASK-GPS-FLEET-UI-05 map playback,
// TASK-GPS-TRIP-BILLING-06 reconciliation window).
GpsTelemetryPointSchema.index({ tenantId: 1, gpsDeviceId: 1, recordedAt: -1 });

// Retention (see telemetry/retention.ts and this task's report): raw
// normalized telemetry points age out automatically via TTL index.
GpsTelemetryPointSchema.index({ createdAt: 1 }, { expireAfterSeconds: TELEMETRY_POINT_RETENTION_SECONDS });

export const GpsTelemetryPoint = mongoose.model<IGpsTelemetryPoint>('GpsTelemetryPoint', GpsTelemetryPointSchema);
