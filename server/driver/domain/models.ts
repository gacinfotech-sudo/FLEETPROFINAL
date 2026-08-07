// TASK-DRIVER-DOMAIN-02 — new, additive collections. None of these touch
// server/models/index.ts; they are registered here as their own Mongoose
// models, the same pattern used by server/gps/models/gpsConnection.ts for
// the GPS module. No hard deletes anywhere in this file's consumers — see
// contactService.ts / employmentHistoryService.ts / lifecycleService.ts.
import mongoose, { Document, Schema } from 'mongoose';
import {
  CONSENT_STATUSES, CONTACT_CATEGORIES, LIFECYCLE_STAGES,
  NOTIFICATION_STATUSES, VERIFICATION_STATUSES,
  type ConsentStatus, type ContactCategory, type NotificationStatus, type VerificationStatus,
} from './types';

// ---------------------------------------------------------------------------
// DriverContact — normalized emergency-contact/reference model (Contact Data
// Rule). Replaces the "nothing exists today" gap; deliberately NOT a
// migration of anything (no prior normalized model existed to migrate from).
// ---------------------------------------------------------------------------
export interface IDriverContact extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  fullName: string;
  relationship?: string;
  contactCategory: ContactCategory;
  primaryMobile: string;
  alternateMobile?: string;
  address?: string;
  occupation?: string;
  preferredLanguage?: string;
  // Lower number = higher priority (1 = call first). Used to pick the
  // single contact an Executive-tier viewer is allowed to see.
  emergencyPriority: number;
  referenceVerificationStatus: VerificationStatus;
  verificationMethod?: string;
  verifiedBy?: { userId: string; role: string };
  verifiedAt?: Date;
  consentStatus: ConsentStatus;
  notificationStatus: NotificationStatus;
  notes?: string;
  // No hard deletes — "removing" a contact is isActive=false plus a
  // DriverAuditLog entry (see contactService.deactivateContact).
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverContactSchema = new Schema<IDriverContact>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 200 },
  relationship: { type: String, maxlength: 100 },
  contactCategory: { type: String, enum: CONTACT_CATEGORIES, required: true },
  primaryMobile: { type: String, required: true, trim: true, maxlength: 20 },
  alternateMobile: { type: String, trim: true, maxlength: 20 },
  address: { type: String, maxlength: 500 },
  occupation: { type: String, maxlength: 200 },
  preferredLanguage: { type: String, maxlength: 50 },
  emergencyPriority: { type: Number, required: true, min: 1, default: 1 },
  referenceVerificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'unverified' },
  verificationMethod: { type: String, maxlength: 200 },
  verifiedBy: {
    userId: { type: String },
    role: { type: String },
  },
  verifiedAt: { type: Date },
  consentStatus: { type: String, enum: CONSENT_STATUSES, default: 'not_requested' },
  notificationStatus: { type: String, enum: NOTIFICATION_STATUSES, default: 'not_notified' },
  notes: { type: String, maxlength: 1000 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
DriverContactSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
DriverContactSchema.index({ tenantId: 1, driverId: 1, isActive: 1 });
DriverContactSchema.index({ tenantId: 1, driverId: 1, emergencyPriority: 1 });

export const DriverContact = mongoose.model<IDriverContact>('DriverContact', DriverContactSchema);

// ---------------------------------------------------------------------------
// DriverContactPolicy — per-tenant policy record backing the Contact Data
// Rule's ">4 contacts requires a stated businessPurpose" gate. One document
// per tenant. Deliberately NOT stored on Tenant itself (server/models/
// index.ts is a forbidden file for this task) — additive, standalone.
// ---------------------------------------------------------------------------
export interface IDriverContactPolicy extends Document {
  tenantId: mongoose.Types.ObjectId;
  maxContacts: number;
  businessPurpose?: string;
  updatedBy?: { userId: string; role: string };
  updatedAt: Date;
  createdAt: Date;
}

const DriverContactPolicySchema = new Schema<IDriverContactPolicy>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },
  maxContacts: { type: Number, default: 4, min: 1 },
  businessPurpose: { type: String, maxlength: 1000 },
  updatedBy: {
    userId: { type: String },
    role: { type: String },
  },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export const DriverContactPolicy = mongoose.model<IDriverContactPolicy>('DriverContactPolicy', DriverContactPolicySchema);

// ---------------------------------------------------------------------------
// DriverEmploymentHistory — new (spec §3).
// ---------------------------------------------------------------------------
export interface IDriverEmploymentHistory extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  employerName: string;
  role?: string;
  startDate: Date;
  endDate?: Date;
  contactForVerification?: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: { userId: string; role: string };
  verifiedAt?: Date;
  notes?: string;
  // No hard deletes — see employmentHistoryService.deactivateEntry.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverEmploymentHistorySchema = new Schema<IDriverEmploymentHistory>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  employerName: { type: String, required: true, trim: true, maxlength: 200 },
  role: { type: String, maxlength: 150 },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  contactForVerification: { type: String, maxlength: 200 },
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'unverified' },
  verifiedBy: {
    userId: { type: String },
    role: { type: String },
  },
  verifiedAt: { type: Date },
  notes: { type: String, maxlength: 1000 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
DriverEmploymentHistorySchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
DriverEmploymentHistorySchema.index({ tenantId: 1, driverId: 1, isActive: 1 });

export const DriverEmploymentHistory = mongoose.model<IDriverEmploymentHistory>(
  'DriverEmploymentHistory', DriverEmploymentHistorySchema,
);

// ---------------------------------------------------------------------------
// DriverAuditLog — revision history (spec §6). Shape deliberately mirrors
// GpsAuditLog (server/gps/models/gpsConnection.ts:64-95), the repo's only
// existing precedent for this kind of append-only change log, per the
// manifest's explicit "reuse that shape" instruction. Read-only reference
// to the GPS file was used; nothing there was modified.
// ---------------------------------------------------------------------------
export interface IDriverAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  action: string;
  driverId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  employmentHistoryId?: mongoose.Types.ObjectId;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

const DriverAuditLogSchema = new Schema<IDriverAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true },
  action: { type: String, required: true, maxlength: 100 },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  contactId: { type: Schema.Types.ObjectId, ref: 'DriverContact' },
  employmentHistoryId: { type: Schema.Types.ObjectId, ref: 'DriverEmploymentHistory' },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  reason: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});
DriverAuditLogSchema.index({ tenantId: 1, createdAt: -1 });
DriverAuditLogSchema.index({ tenantId: 1, driverId: 1, createdAt: -1 });

export const DriverAuditLog = mongoose.model<IDriverAuditLog>('DriverAuditLog', DriverAuditLogSchema);

// Re-exported for callers that only need the stage list/enum, so they don't
// need a second import from './types'.
export { LIFECYCLE_STAGES };
