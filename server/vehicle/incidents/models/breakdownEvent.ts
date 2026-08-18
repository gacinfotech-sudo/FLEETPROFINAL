import mongoose, { Document, Schema } from 'mongoose';
import { BREAKDOWN_WORKFLOW_SEQUENCE, type BreakdownWorkflowState } from '../types';

export interface IBreakdownStateHistoryEntry {
  state: BreakdownWorkflowState;
  enteredAt: Date;
  enteredBy: string;
  notes?: string;
}

export interface IBreakdownEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  currentState: BreakdownWorkflowState;
  stateHistory: IBreakdownStateHistoryEntry[];

  reportedAt: Date;
  location?: string;
  gpsSnapshotLatitude?: number;
  gpsSnapshotLongitude?: number;
  symptoms: string;

  towProvider?: string;
  towCost?: number;
  workshopName?: string;
  partsUsed: string[];
  repairCost?: number;

  downtimeStartAt: Date;
  downtimeEndAt?: Date;
  /** Recorded, never auto-selected — a plain reference the manager sets
   * when a replacement vehicle is actually assigned. */
  replacementVehicleId?: mongoose.Types.ObjectId;

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const BreakdownStateHistorySchema = new Schema<IBreakdownStateHistoryEntry>({
  state: { type: String, required: true, enum: BREAKDOWN_WORKFLOW_SEQUENCE },
  enteredAt: { type: Date, required: true },
  enteredBy: { type: String, required: true },
  notes: { type: String, maxlength: 1000 },
}, { _id: false });

const BreakdownEventSchema = new Schema<IBreakdownEvent>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  currentState: { type: String, required: true, enum: BREAKDOWN_WORKFLOW_SEQUENCE, default: 'reported' },
  stateHistory: { type: [BreakdownStateHistorySchema], default: [] },

  reportedAt: { type: Date, required: true, default: Date.now },
  location: { type: String, trim: true, maxlength: 300 },
  gpsSnapshotLatitude: { type: Number, min: -90, max: 90 },
  gpsSnapshotLongitude: { type: Number, min: -180, max: 180 },
  symptoms: { type: String, required: true, maxlength: 2000 },

  towProvider: { type: String, trim: true, maxlength: 200 },
  towCost: { type: Number, min: 0 },
  workshopName: { type: String, trim: true, maxlength: 200 },
  partsUsed: { type: [String], default: [] },
  repairCost: { type: Number, min: 0 },

  downtimeStartAt: { type: Date, required: true },
  downtimeEndAt: { type: Date },
  replacementVehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },

  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

BreakdownEventSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });
BreakdownEventSchema.index({ tenantId: 1, currentState: 1 });

export const BreakdownEvent = mongoose.model<IBreakdownEvent>('BreakdownEvent', BreakdownEventSchema);
