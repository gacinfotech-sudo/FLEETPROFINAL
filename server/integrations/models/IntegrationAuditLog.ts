/**
 * IntegrationAuditLog Model
 * Comprehensive security audit trail for all integration activities
 * Required for compliance, security investigation, and forensics
 */

import mongoose, { Schema, Document } from 'mongoose';
import { AuditActionType, AuditResultStatus } from '../types';

/**
 * IntegrationAuditLog Interface
 * Immutable audit trail
 */
export interface IIntegrationAuditLog extends Document {
  // Action type performed
  action: AuditActionType;

  // Result of the action
  result: AuditResultStatus;

  // Multi-tenant context
  tenantId: mongoose.Types.ObjectId;

  // User who performed the action
  userId: string;

  // Provider involved
  providerId: string;

  // Connection involved (optional, for connection-specific actions)
  connectionId?: string;

  // HTTP request details
  request: {
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
  };

  // Response details
  response?: {
    statusCode?: number;
    duration?: number; // milliseconds
  };

  // Error information (if action failed)
  error?: {
    code: string;
    message: string;
    stack?: string;
  };

  // Detailed metadata about the action
  metadata: {
    // For RETRIEVE_CREDENTIALS: which fields were accessed
    fieldsAccessed?: string[];

    // For UPDATE_CREDENTIALS: which fields were changed
    fieldsChanged?: string[];

    // For RATE_LIMIT_EXCEEDED: current/limit values
    currentCount?: number;
    limitValue?: number;

    // For WEBHOOK_*: webhook event details
    eventType?: string;
    eventId?: string;

    // For custom actions: any custom data
    [key: string]: any;
  };

  // Credentials handling
  credentialsSensitivity: 'none' | 'low' | 'medium' | 'high';

  // Whether PII/sensitive data was involved
  involvesSensitiveData: boolean;

  // For compliance: tags related to regulation
  complianceTags?: {
    gdpr?: boolean;
    hipaa?: boolean;
    pci?: boolean;
    sox?: boolean;
    [key: string]: any;
  };

  // Changes made (for audit trail reconstruction)
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];

  // Correlation ID (for tracing related events)
  correlationId?: string;

  // Severity level
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Whether action requires investigation
  flaggedForReview: boolean;

  // Investigation details
  investigation?: {
    reviewer?: string;
    reviewedAt?: Date;
    findings?: string;
    status: 'pending' | 'reviewed' | 'escalated';
  };

  // Timestamp
  createdAt: Date;

  // TTL: audit logs expire after 90 days (configurable)
  expiresAt: Date;
}

/**
 * IntegrationAuditLog Schema
 */
const IntegrationAuditLogSchema = new Schema<IIntegrationAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE_PROVIDER',
        'UPDATE_PROVIDER',
        'DELETE_PROVIDER',
        'CONNECT_PROVIDER',
        'DISCONNECT_PROVIDER',
        'TEST_CONNECTION',
        'RETRIEVE_CREDENTIALS',
        'UPDATE_CREDENTIALS',
        'HEALTH_CHECK',
        'WEBHOOK_RECEIVED',
        'WEBHOOK_FAILED',
        'RATE_LIMIT_EXCEEDED',
        'AUTHORIZATION_FAILED',
        'SYNC_OPERATION',
        'CUSTOM_ACTION',
      ],
      index: true,
    },
    result: {
      type: String,
      enum: ['success', 'failure', 'partial'],
      required: true,
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Tenant',
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      required: true,
      index: true,
    },
    connectionId: {
      type: String,
      index: true,
    },
    request: {
      method: String,
      path: String,
      ip: String,
      userAgent: String,
    },
    response: {
      statusCode: Number,
      duration: Number,
    },
    error: {
      code: String,
      message: String,
      stack: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    credentialsSensitivity: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'medium',
    },
    involvesSensitiveData: {
      type: Boolean,
      default: false,
      index: true,
    },
    complianceTags: {
      type: Schema.Types.Mixed,
      default: {},
    },
    changes: [
      {
        field: String,
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
        _id: false,
      },
    ],
    correlationId: {
      type: String,
      index: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    flaggedForReview: {
      type: Boolean,
      default: false,
      index: true,
    },
    investigation: {
      reviewer: String,
      reviewedAt: Date,
      findings: String,
      status: {
        type: String,
        enum: ['pending', 'reviewed', 'escalated'],
        default: 'pending',
      },
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Indexes for compliance queries
IntegrationAuditLogSchema.index({ action: 1, result: 1 });
IntegrationAuditLogSchema.index({ action: 1, tenantId: 1 });
IntegrationAuditLogSchema.index({ createdAt: -1, tenantId: 1 });
IntegrationAuditLogSchema.index({ severity: 1, flaggedForReview: 1 });
IntegrationAuditLogSchema.index({ involvesSensitiveData: 1, createdAt: -1 });

// TTL index for automatic expiration
IntegrationAuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Create or get IntegrationAuditLog model
 */
export const IntegrationAuditLog =
  mongoose.models.IntegrationAuditLog ||
  mongoose.model<IIntegrationAuditLog>('IntegrationAuditLog', IntegrationAuditLogSchema);

export default IntegrationAuditLog;
