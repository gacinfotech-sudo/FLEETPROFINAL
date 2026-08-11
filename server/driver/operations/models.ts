// TASK-DRIVER-OPERATIONS-06 — new, additive collections. None of these
// touch server/models/index.ts; each is registered here as its own
// Mongoose model, the same pattern server/gps/models/gpsConnection.ts and
// server/driver/domain/models.ts already use. No delete routes exist
// anywhere in this module's services — status/verification fields are
// updated in place, nothing is ever hard-deleted (grep-verified in the
// task report: zero deleteOne/findOneAndDelete/.remove()/deleteMany calls
// under server/driver/operations/**).
import mongoose, { Document, Schema } from 'mongoose';
import {
  CHALLAN_STATUSES, CHALLAN_VIOLATION_TYPES, INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_TYPES,
  TRAINING_STATUSES, TRAINING_TYPES,
  type ChallanStatus, type ChallanViolationType, type IncidentSeverity, type IncidentStatus, type IncidentType,
  type TrainingStatus, type TrainingType,
} from './types';

// ---------------------------------------------------------------------------
// DriverIncident — internally reported incidents (accidents, safety/policy
// violations, altercations, etc.). Distinct axis from CustomerComplaint,
// which stays the customer-initiated complaint channel and is left
// completely untouched — see incidentService.ts's combined view for how the
// two are surfaced together without merging storage.
// ---------------------------------------------------------------------------
export interface IDriverIncident extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  incidentDate: Date;
  description: string;
  location?: string;
  bookingId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  reportedBy: { userId: string; role: string };
  status: IncidentStatus;
  reviewedBy?: { userId: string; role: string };
  reviewedAt?: Date;
  reviewNotes?: string;
  actionTaken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverIncidentSchema = new Schema<IDriverIncident>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  incidentType: { type: String, enum: INCIDENT_TYPES, required: true },
  severity: { type: String, enum: INCIDENT_SEVERITIES, required: true, default: 'minor' },
  incidentDate: { type: Date, required: true },
  description: { type: String, required: true, maxlength: 2000 },
  location: { type: String, maxlength: 300 },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  reportedBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  status: { type: String, enum: INCIDENT_STATUSES, default: 'reported' },
  reviewedBy: {
    userId: { type: String },
    role: { type: String },
  },
  reviewedAt: { type: Date },
  reviewNotes: { type: String, maxlength: 2000 },
  actionTaken: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
DriverIncidentSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
DriverIncidentSchema.index({ tenantId: 1, driverId: 1, incidentDate: -1 });
DriverIncidentSchema.index({ tenantId: 1, status: 1 });

export const DriverIncident = mongoose.model<IDriverIncident>('DriverIncident', DriverIncidentSchema);

// ---------------------------------------------------------------------------
// DriverChallan — traffic challans/fines. New; nothing like this existed.
// ---------------------------------------------------------------------------
export interface IDriverChallan extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  challanNumber?: string;
  violationType: ChallanViolationType;
  issuingAuthority?: string;
  challanDate: Date;
  location?: string;
  fineAmount?: number;
  status: ChallanStatus;
  bookingId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  paidAmount?: number;
  paidAt?: Date;
  disputeReason?: string;
  recordedBy: { userId: string; role: string };
  statusUpdatedBy?: { userId: string; role: string };
  statusUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DriverChallanSchema = new Schema<IDriverChallan>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  challanNumber: { type: String, maxlength: 100 },
  violationType: { type: String, enum: CHALLAN_VIOLATION_TYPES, required: true },
  issuingAuthority: { type: String, maxlength: 200 },
  challanDate: { type: Date, required: true },
  location: { type: String, maxlength: 300 },
  fineAmount: { type: Number, min: 0 },
  status: { type: String, enum: CHALLAN_STATUSES, default: 'pending' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  paidAmount: { type: Number, min: 0 },
  paidAt: { type: Date },
  disputeReason: { type: String, maxlength: 1000 },
  recordedBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  statusUpdatedBy: {
    userId: { type: String },
    role: { type: String },
  },
  statusUpdatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
DriverChallanSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
DriverChallanSchema.index({ tenantId: 1, driverId: 1, challanDate: -1 });
DriverChallanSchema.index({ tenantId: 1, status: 1 });

export const DriverChallan = mongoose.model<IDriverChallan>('DriverChallan', DriverChallanSchema);

// ---------------------------------------------------------------------------
// DriverTraining — training-event records. certificateDocumentId is an
// optional pointer into TASK-DRIVER-DOCUMENTS-03's DriverDocument registry
// (documentType 'training_completion_certificate') — this module does NOT
// store the certificate file itself (Documents-03 owns that registry and
// its Google-Drive-backed storage); it only references it by id, verified
// server-side at write time (see trainingService.ts).
// ---------------------------------------------------------------------------
export interface IDriverTraining extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  trainingType: TrainingType;
  title?: string;
  trainingDate: Date;
  provider?: string;
  durationHours?: number;
  status: TrainingStatus;
  certificateDocumentId?: mongoose.Types.ObjectId;
  expiryDate?: Date;
  conductedBy: { userId: string; role: string };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverTrainingSchema = new Schema<IDriverTraining>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  trainingType: { type: String, enum: TRAINING_TYPES, required: true },
  title: { type: String, maxlength: 200 },
  trainingDate: { type: Date, required: true },
  provider: { type: String, maxlength: 200 },
  durationHours: { type: Number, min: 0 },
  status: { type: String, enum: TRAINING_STATUSES, default: 'completed' },
  certificateDocumentId: { type: Schema.Types.ObjectId, ref: 'DriverDocument' },
  expiryDate: { type: Date },
  conductedBy: {
    userId: { type: String, required: true },
    role: { type: String, required: true },
  },
  notes: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
DriverTrainingSchema.pre('save', function (next) { (this as any).updatedAt = new Date(); next(); });
DriverTrainingSchema.index({ tenantId: 1, driverId: 1, trainingDate: -1 });
DriverTrainingSchema.index({ tenantId: 1, expiryDate: 1 });

export const DriverTraining = mongoose.model<IDriverTraining>('DriverTraining', DriverTrainingSchema);
