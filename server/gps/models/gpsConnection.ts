import mongoose, { Document, Schema } from 'mongoose';
import type { GpsAuthenticationType, GpsConnectionStatus } from '../types';

export interface IGpsConnection extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionName: string;
  providerKey: string;
  apiBaseUrl?: string;
  authenticationType: GpsAuthenticationType;
  accountId?: string;
  providerTimezone?: string;
  websocketUrl?: string;
  pollingIntervalSeconds: number;
  enabled: boolean;
  status: GpsConnectionStatus;
  encryptedSecrets?: string;
  credentialFields: string[];
  lastTestedAt?: Date;
  lastSuccessfulSync?: Date;
  lastFailedSync?: Date;
  lastError?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const GpsConnectionSchema = new Schema<IGpsConnection>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionName: { type: String, required: true, trim: true, maxlength: 120 },
  providerKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
  apiBaseUrl: { type: String, trim: true, maxlength: 500 },
  authenticationType: {
    type: String,
    required: true,
    enum: ['api_key', 'bearer_token', 'basic_authentication', 'oauth_client_credentials', 'session_login', 'custom_provider_authentication'],
  },
  accountId: { type: String, trim: true, maxlength: 200 },
  providerTimezone: { type: String, trim: true, maxlength: 100 },
  websocketUrl: { type: String, trim: true, maxlength: 500 },
  pollingIntervalSeconds: { type: Number, min: 30, max: 86400, default: 120 },
  enabled: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['configuration_required', 'testing', 'connected', 'authentication_failed', 'provider_unavailable', 'rate_limited', 'webhook_failed', 'sync_failed', 'disabled'],
    default: 'configuration_required',
  },
  encryptedSecrets: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  lastTestedAt: { type: Date },
  lastSuccessfulSync: { type: Date },
  lastFailedSync: { type: Date },
  lastError: { type: String, maxlength: 1000 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

GpsConnectionSchema.index({ tenantId: 1, connectionName: 1 }, { unique: true });
GpsConnectionSchema.index({ tenantId: 1, providerKey: 1, enabled: 1 });
GpsConnectionSchema.index({ tenantId: 1, status: 1 });

export const GpsConnection = mongoose.model<IGpsConnection>('GpsConnection', GpsConnectionSchema);

export interface IGpsAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  action: string;
  connectionId?: mongoose.Types.ObjectId;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

const GpsAuditLogSchema = new Schema<IGpsAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true },
  action: { type: String, required: true, maxlength: 100 },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection' },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

GpsAuditLogSchema.index({ tenantId: 1, createdAt: -1 });
GpsAuditLogSchema.index({ tenantId: 1, connectionId: 1, createdAt: -1 });

export const GpsAuditLog = mongoose.model<IGpsAuditLog>('GpsAuditLog', GpsAuditLogSchema);
