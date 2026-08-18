import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  actor: string;
  action: string;
  resource: string;
  resourceId: string;
  tenantId: mongoose.Types.ObjectId;
  changes?: any;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true },
    resourceId: { type: String, required: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    changes: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      index: true
    },
    errorMessage: String,
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { collection: 'platform_audit_logs' }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, status: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
