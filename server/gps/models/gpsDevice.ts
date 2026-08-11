import mongoose, { Document, Schema } from 'mongoose';

export type GpsDeviceStatus = 'unassigned' | 'assigned' | 'online' | 'offline' | 'inactive' | 'faulty' | 'removed';

export interface IGpsDevice extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  internalDeviceCode: string;
  providerDeviceId: string;
  imei?: string;
  simNumber?: string;
  deviceName?: string;
  deviceModel?: string;
  providerDeviceType?: string;
  status: GpsDeviceStatus;
  lastSeenAt?: Date;
  lastLocationAt?: Date;
  lastLatitude?: number;
  lastLongitude?: number;
  batteryLevel?: number;
  externalPowerConnected?: boolean;
  gpsSignalAvailable?: boolean;
  gsmSignalStrength?: number;
  rawMetadata?: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GpsDeviceSchema = new Schema<IGpsDevice>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  internalDeviceCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  providerDeviceId: { type: String, required: true, trim: true, maxlength: 300 },
  imei: { type: String, trim: true, maxlength: 100 },
  simNumber: { type: String, trim: true, maxlength: 100 },
  deviceName: { type: String, trim: true, maxlength: 200 },
  deviceModel: { type: String, trim: true, maxlength: 200 },
  providerDeviceType: { type: String, trim: true, maxlength: 200 },
  status: {
    type: String,
    enum: ['unassigned', 'assigned', 'online', 'offline', 'inactive', 'faulty', 'removed'],
    default: 'unassigned',
  },
  lastSeenAt: { type: Date },
  lastLocationAt: { type: Date },
  lastLatitude: { type: Number, min: -90, max: 90 },
  lastLongitude: { type: Number, min: -180, max: 180 },
  batteryLevel: { type: Number, min: 0, max: 100 },
  externalPowerConnected: { type: Boolean },
  gpsSignalAvailable: { type: Boolean },
  gsmSignalStrength: { type: Number },
  rawMetadata: { type: Schema.Types.Mixed, select: false },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

GpsDeviceSchema.index(
  { tenantId: 1, connectionId: 1, providerDeviceId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
GpsDeviceSchema.index(
  { tenantId: 1, internalDeviceCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
GpsDeviceSchema.index(
  { tenantId: 1, imei: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, imei: { $type: 'string' } } },
);
GpsDeviceSchema.index({ tenantId: 1, status: 1, lastSeenAt: -1 });
GpsDeviceSchema.index({ tenantId: 1, connectionId: 1, isDeleted: 1 });

export const GpsDevice = mongoose.model<IGpsDevice>('GpsDevice', GpsDeviceSchema);
