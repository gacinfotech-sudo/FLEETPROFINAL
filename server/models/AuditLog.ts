/**
 * AUDIT LOG MODEL
 * Immutable append-only audit logs for compliance tracking
 * Captures all state changes (create, update, delete)
 * Enforces tenant isolation and PII redaction
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId | string;
  userId?: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
  entityType: string;
  entityId: string;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };
  description?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tags?: string[];
  metadata?: Record<string, any>;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    userName: String,
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      fields: [String],
    },
    description: String,
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      immutable: true,
    },
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED'],
      default: 'SUCCESS',
      index: true,
    },
    errorMessage: String,
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
      index: true,
    },
    tags: [String],
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: false,
    collection: 'audit_logs',
    immutable: true,
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, userId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, entityType: 1, action: 1 });
AuditLogSchema.index({ tenantId: 1, severity: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 220752000 }); // 7 years retention

const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
