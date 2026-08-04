import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicleGpsAssignment extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  gpsDeviceId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  assignedFrom: Date;
  assignedUntil?: Date;
  status: 'active' | 'ended';
  assignedBy: string;
  endedBy?: string;
  endReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleGpsAssignmentSchema = new Schema<IVehicleGpsAssignment>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  gpsDeviceId: { type: Schema.Types.ObjectId, ref: 'GpsDevice', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'GpsConnection', required: true },
  assignedFrom: { type: Date, required: true },
  assignedUntil: { type: Date },
  status: { type: String, enum: ['active', 'ended'], default: 'active', required: true },
  assignedBy: { type: String, required: true },
  endedBy: { type: String },
  endReason: { type: String, maxlength: 500 },
}, { timestamps: true });

VehicleGpsAssignmentSchema.index(
  { tenantId: 1, vehicleId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
VehicleGpsAssignmentSchema.index(
  { tenantId: 1, gpsDeviceId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
VehicleGpsAssignmentSchema.index({ tenantId: 1, vehicleId: 1, assignedFrom: -1 });
VehicleGpsAssignmentSchema.index({ tenantId: 1, gpsDeviceId: 1, assignedFrom: -1 });
VehicleGpsAssignmentSchema.index({ tenantId: 1, connectionId: 1, status: 1 });

export const VehicleGpsAssignment = mongoose.model<IVehicleGpsAssignment>(
  'VehicleGpsAssignment',
  VehicleGpsAssignmentSchema,
);
