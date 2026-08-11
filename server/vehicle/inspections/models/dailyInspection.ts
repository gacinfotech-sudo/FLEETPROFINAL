// Daily Inspection model — Final Vehicle 360 Integrator, "Open follow-ups"
// #5: no task in the original 7-task batch owned building this, even though
// server/vehicle/core/types.ts's SafetyHoldFlag comment says a vehicle with
// an unresolved CRITICAL defect from a Daily Inspection is SAFETY_HOLD.
// Follows the same architecture as server/vehicle/documents/models/
// vehicleDocument.ts (tenant-scoped, timestamps, plain Mongoose subdocs).
import mongoose, { Document, Schema } from 'mongoose';

export type InspectionDefectSeverity = 'CRITICAL' | 'MINOR';

export interface IInspectionDefect {
  _id: mongoose.Types.ObjectId;
  description: string;
  severity: InspectionDefectSeverity;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface IDailyInspection extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  inspectedAt: Date;
  inspectedBy: string;
  odometerReading?: number;
  notes?: string;
  defects: mongoose.Types.DocumentArray<IInspectionDefect>;
  createdAt: Date;
  updatedAt: Date;
}

const InspectionDefectSchema = new Schema<IInspectionDefect>({
  description: { type: String, required: true, trim: true, maxlength: 500 },
  severity: { type: String, enum: ['CRITICAL', 'MINOR'], required: true },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
  resolutionNotes: { type: String, trim: true, maxlength: 500 },
});

const DailyInspectionSchema = new Schema<IDailyInspection>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  inspectedAt: { type: Date, required: true },
  inspectedBy: { type: String, required: true },
  odometerReading: { type: Number, min: 0 },
  notes: { type: String, trim: true, maxlength: 2000 },
  defects: { type: [InspectionDefectSchema], default: [] },
}, { timestamps: true });

DailyInspectionSchema.index({ tenantId: 1, vehicleId: 1, inspectedAt: -1 });
// Powers computeSafetyHold's query (unresolved CRITICAL defects for a vehicle).
DailyInspectionSchema.index({ tenantId: 1, vehicleId: 1, 'defects.severity': 1, 'defects.resolvedAt': 1 });

export const DailyInspection = mongoose.model<IDailyInspection>('DailyInspection', DailyInspectionSchema);
