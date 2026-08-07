import mongoose, { Document, Schema } from 'mongoose';
import type { MovingStatus } from '../types';

/**
 * One document per `gpsDeviceId` — the derived "latest vehicle state" read
 * model. Bounded by device count (not event count), so unlike
 * `GpsTelemetryPoint` this is kept indefinitely (no TTL): it is always
 * exactly as large as the fleet's device roster, upserted in place on every
 * newer point, never appended to.
 */
export interface IGpsVehicleLatestState extends Document {
  tenantId: mongoose.Types.ObjectId;
  gpsDeviceId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
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
  movingStatusSustainedAboveThresholdSince?: Date;
  source: 'webhook' | 'websocket' | 'polling' | 'history_sync';
  createdAt: Date;
  updatedAt: Date;
}

const GpsVehicleLatestStateSchema = new Schema<IGpsVehicleLatestState>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  providerDeviceId: { type: String, required: true, trim: true, maxlength: 300 },
  recordedAt: { type: Date, required: true },
  receivedAt: { type: Date, required: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  speedKph: { type: Number },
  headingDegrees: { type: Number },
  altitudeMeters: { type: Number },
  ignition: { type: Boolean },
  motion: { type: Boolean },
  engineOn: { type: Boolean },
  batteryLevel: { type: Number, min: 0, max: 100 },
  externalPowerConnected: { type: Boolean },
  gpsSignalAvailable: { type: Boolean },
  address: { type: String, maxlength: 500 },
  movingStatus: { type: String, enum: ['moving', 'stopped', 'offline'], required: true },
  movingStatusSince: { type: Date, required: true },
  movingStatusSustainedAboveThresholdSince: { type: Date },
  source: { type: String, enum: ['webhook', 'websocket', 'polling', 'history_sync'], required: true },
}, { timestamps: true });

GpsVehicleLatestStateSchema.index({ tenantId: 1, gpsDeviceId: 1 }, { unique: true });
GpsVehicleLatestStateSchema.index({ tenantId: 1, movingStatus: 1 });
GpsVehicleLatestStateSchema.index({ tenantId: 1, connectionId: 1 });

export const GpsVehicleLatestState = mongoose.model<IGpsVehicleLatestState>(
  'GpsVehicleLatestState',
  GpsVehicleLatestStateSchema,
);
