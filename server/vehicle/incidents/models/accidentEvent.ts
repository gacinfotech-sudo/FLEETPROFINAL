import mongoose, { Document, Schema } from 'mongoose';

export interface IAccidentEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;

  occurredAt: Date;
  location?: string;
  gpsSnapshotLatitude?: number;
  gpsSnapshotLongitude?: number;
  photoUrls: string[];

  otherPartyName?: string;
  otherPartyContact?: string;
  otherPartyVehicleNumber?: string;

  policeReportReference?: string;
  insuranceClaimNumber?: string;
  surveyorName?: string;
  workshopName?: string;

  estimatedCost?: number;
  actualCost?: number;
  claimReceivedAmount?: number;

  downtimeStartAt: Date;
  downtimeEndAt?: Date;

  /** Explicit, human-set review state — never a boolean "driverAtFault"
   * shortcut. No default that implies fault; every value beyond
   * 'under_review' requires an explicit reviewer action recorded via
   * `reviewedBy`/`reviewedAt`. */
  reviewStatus: 'under_review' | 'fault_determined_driver' | 'fault_determined_other_party' | 'fault_determined_no_fault' | 'closed_no_determination';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccidentEventSchema = new Schema<IAccidentEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },

  occurredAt: { type: Date, required: true },
  location: { type: String, trim: true, maxlength: 300 },
  gpsSnapshotLatitude: { type: Number, min: -90, max: 90 },
  gpsSnapshotLongitude: { type: Number, min: -180, max: 180 },
  photoUrls: { type: [String], default: [] },

  otherPartyName: { type: String, trim: true, maxlength: 200 },
  otherPartyContact: { type: String, trim: true, maxlength: 100 },
  otherPartyVehicleNumber: { type: String, trim: true, maxlength: 50 },

  policeReportReference: { type: String, trim: true, maxlength: 100 },
  insuranceClaimNumber: { type: String, trim: true, maxlength: 100 },
  surveyorName: { type: String, trim: true, maxlength: 200 },
  workshopName: { type: String, trim: true, maxlength: 200 },

  estimatedCost: { type: Number, min: 0 },
  actualCost: { type: Number, min: 0 },
  claimReceivedAmount: { type: Number, min: 0 },

  downtimeStartAt: { type: Date, required: true },
  downtimeEndAt: { type: Date },

  reviewStatus: {
    type: String,
    required: true,
    enum: ['under_review', 'fault_determined_driver', 'fault_determined_other_party', 'fault_determined_no_fault', 'closed_no_determination'],
    default: 'under_review',
  },
  reviewNotes: { type: String, maxlength: 2000 },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },

  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

AccidentEventSchema.index({ tenantId: 1, vehicleId: 1, occurredAt: -1 });
AccidentEventSchema.index({ tenantId: 1, reviewStatus: 1 });

export const AccidentEvent = mongoose.model<IAccidentEvent>('AccidentEvent', AccidentEventSchema);
