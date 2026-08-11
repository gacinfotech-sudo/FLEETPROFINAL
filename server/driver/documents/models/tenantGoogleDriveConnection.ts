// Tenant-owned Google Drive connection. Structurally mirrors
// server/gps/models/gpsConnection.ts (encrypted-credential pattern precedent) —
// see GOOGLE-DRIVE-SECURITY-SPEC.md's "Connection model": one Shared Drive
// connection per tenant, credentials encrypted at rest, never logged.
import mongoose, { Document, Schema } from 'mongoose';
import type { DriveAuthType, DriveConnectionStatus } from '../types';
import { DRIVE_AUTH_TYPES, DRIVE_CONNECTION_STATUSES } from '../types';

export interface ITenantGoogleDriveConnection extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionName: string;
  authType: DriveAuthType;
  // The tenant's own Google Workspace Shared Drive id — provided by the tenant
  // admin at setup time (a service account cannot create a new Shared Drive; the
  // tenant must create one in their Workspace and add the service account as a
  // Content Manager member). Never shared across tenants — see "What must never
  // happen" in the spec.
  sharedDriveId: string;
  // The single root folder ("FleetPro Driver Documents" by default) resolved
  // (found-or-created, idempotently) under sharedDriveId on first successful
  // connect/test. Everything else lives under this one folder.
  rootFolderId?: string;
  rootFolderName: string;
  enabled: boolean;
  status: DriveConnectionStatus;
  encryptedCredentials?: string;
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

const TenantGoogleDriveConnectionSchema = new Schema<ITenantGoogleDriveConnection>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionName: { type: String, required: true, trim: true, maxlength: 120, default: 'Primary Drive Connection' },
  authType: { type: String, required: true, enum: DRIVE_AUTH_TYPES },
  sharedDriveId: { type: String, required: true, trim: true, maxlength: 200 },
  rootFolderId: { type: String, trim: true, maxlength: 200 },
  rootFolderName: { type: String, trim: true, maxlength: 200, default: 'FleetPro Driver Documents' },
  enabled: { type: Boolean, default: false },
  status: { type: String, enum: DRIVE_CONNECTION_STATUSES, default: 'configuration_required' },
  encryptedCredentials: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  lastTestedAt: { type: Date },
  lastSuccessfulSync: { type: Date },
  lastFailedSync: { type: Date },
  lastError: { type: String, maxlength: 1000 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

// One Drive connection per tenant, per GOOGLE-DRIVE-SECURITY-SPEC.md ("One Drive
// connection per tenant").
TenantGoogleDriveConnectionSchema.index({ tenantId: 1 }, { unique: true });

export const TenantGoogleDriveConnection = mongoose.model<ITenantGoogleDriveConnection>(
  'TenantGoogleDriveConnection',
  TenantGoogleDriveConnectionSchema,
);
