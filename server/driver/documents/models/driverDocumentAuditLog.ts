// Mirrors server/gps/models/gpsConnection.ts's GpsAuditLog shape (the closest
// existing precedent per CURRENT-DRIVER-MODULE-AUDIT.md's "Audit history
// precedent" section). Every document view/download/upload/verify and every
// connection change writes one of these — see acceptance criteria: "every
// document access (view/download) writes an audit log entry".
import mongoose, { Document, Schema } from 'mongoose';

export type DriverDocumentAuditAction =
  | 'drive_connection.created'
  | 'drive_connection.updated'
  | 'drive_connection.credentials_rotated'
  | 'drive_connection.tested'
  | 'drive_connection.test_failed'
  | 'document.uploaded'
  | 'document.replaced'
  | 'document.verified'
  | 'document.rejected'
  | 'document.viewed'
  | 'document.downloaded'
  | 'document.retention_hold_set'
  | 'document.retention_status_changed'
  | 'document.public_sharing_removed';

export interface IDriverDocumentAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  action: DriverDocumentAuditAction;
  driverId?: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  connectionId?: mongoose.Types.ObjectId;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

const DriverDocumentAuditLogSchema = new Schema<IDriverDocumentAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true },
  action: { type: String, required: true, maxlength: 100 },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  documentId: { type: Schema.Types.ObjectId, ref: 'DriverDocument' },
  connectionId: { type: Schema.Types.ObjectId, ref: 'TenantGoogleDriveConnection' },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

DriverDocumentAuditLogSchema.index({ tenantId: 1, createdAt: -1 });
DriverDocumentAuditLogSchema.index({ tenantId: 1, documentId: 1, createdAt: -1 });
DriverDocumentAuditLogSchema.index({ tenantId: 1, driverId: 1, createdAt: -1 });

export const DriverDocumentAuditLog = mongoose.model<IDriverDocumentAuditLog>(
  'DriverDocumentAuditLog',
  DriverDocumentAuditLogSchema,
);
