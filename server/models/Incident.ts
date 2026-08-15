/**
 * INCIDENT MODEL
 * Security incident tracking and investigation workflow
 * Supports severity levels and post-incident reviews
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IIncident extends Document {
  tenantId: mongoose.Types.ObjectId | string;
  incidentId: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'SECURITY' | 'DATA_BREACH' | 'COMPLIANCE' | 'SYSTEM' | 'SUSPICIOUS_ACTIVITY';
  status: 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  reportedBy: string;
  reportedAt: Date;
  discoveredAt?: Date;
  affectedSystems?: string[];
  affectedUsers?: number;
  affectedData?: {
    dataType: string;
    recordCount?: number;
  }[];
  investigationTeam?: string[];
  timeline?: Array<{
    timestamp: Date;
    event: string;
    actor?: string;
  }>;
  rootCause?: string;
  resolution?: {
    actions: string[];
    completedAt: Date;
    verifiedBy?: string;
  };
  impact?: {
    businessImpact: string;
    dataImpact: string;
    systemImpact: string;
    estimatedCost?: number;
  };
  preventiveMeasures?: string[];
  postIncidentReview?: {
    reviewDate?: Date;
    reviewedBy?: string;
    findings?: string;
    improvements?: string[];
    lessonsLearned?: string;
  };
  externalReporting?: {
    regulatorNotified: boolean;
    regulatorName?: string;
    notificationDate?: Date;
    caseNumber?: string;
    publicDisclosure?: boolean;
  };
  tags?: string[];
  relatedAuditLogs?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    tenantId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['SECURITY', 'DATA_BREACH', 'COMPLIANCE', 'SYSTEM', 'SUSPICIOUS_ACTIVITY'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    reportedBy: {
      type: String,
      required: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    discoveredAt: Date,
    affectedSystems: [String],
    affectedUsers: Number,
    affectedData: [
      {
        dataType: String,
        recordCount: Number,
      },
    ],
    investigationTeam: [String],
    timeline: [
      {
        timestamp: Date,
        event: String,
        actor: String,
      },
    ],
    rootCause: String,
    resolution: {
      actions: [String],
      completedAt: Date,
      verifiedBy: String,
    },
    impact: {
      businessImpact: String,
      dataImpact: String,
      systemImpact: String,
      estimatedCost: Number,
    },
    preventiveMeasures: [String],
    postIncidentReview: {
      reviewDate: Date,
      reviewedBy: String,
      findings: String,
      improvements: [String],
      lessonsLearned: String,
    },
    externalReporting: {
      regulatorNotified: { type: Boolean, default: false },
      regulatorName: String,
      notificationDate: Date,
      caseNumber: String,
      publicDisclosure: { type: Boolean, default: false },
    },
    tags: [String],
    relatedAuditLogs: [{ type: Schema.Types.ObjectId, ref: 'AuditLog' }],
  },
  {
    timestamps: true,
    collection: 'incidents',
  }
);

// Indexes for common queries
IncidentSchema.index({ tenantId: 1, reportedAt: -1 });
IncidentSchema.index({ tenantId: 1, severity: 1, status: 1 });
IncidentSchema.index({ tenantId: 1, type: 1 });

const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);

export default Incident;
