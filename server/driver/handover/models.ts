// New collection: VehicleHandover. Additive-only — no change to Vehicle or
// Booking schemas (VEHICLE-HANDOVER-SPEC.md's explicit rationale: handover
// odometer/fuel are handover-record fields, not a second Vehicle-level
// source of truth). Self-contained under server/driver/handover/models.ts,
// same pattern as server/gps/models/** and server/driver/documents/models/**
// (neither of those live in the shared server/models/index.ts either).
import mongoose, { Document, Schema } from 'mongoose';
import {
  HANDOVER_DIRECTIONS, HANDOVER_STATUSES, REMOVABLE_ITEM_CONDITIONS, DISCREPANCY_FLAG_TYPES,
  type HandoverDirection, type HandoverStatus, type RemovableItemInventoryEntry,
  type ConditionPhotoRef, type DiscrepancyFlag,
} from './types';

export interface IVehicleHandover extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId; // nullable — duty-shift handover may have no single owning booking

  direction: HandoverDirection;
  odometerReading: number;
  fuelLevel: number; // 0-100 (%) — simplest cross-vehicle-type representation

  conditionPhotos: ConditionPhotoRef[];
  removableItemInventory: RemovableItemInventoryEntry[];
  damageNoted?: string;
  flags: DiscrepancyFlag[];

  driverAcceptance: {
    accepted: boolean;
    acceptedAt?: Date;
    signatureRef?: string; // optional DriverDocument id, same registry as conditionPhotos
  };

  staffConductedBy: string; // User.userId of the staff member who conducted this side
  conductedAt: Date;

  // Set on BOTH records of a matched pair once the return is created —
  // points the handover at its return and vice versa.
  linkedReturnHandoverId?: mongoose.Types.ObjectId;

  status: HandoverStatus;

  // True only while this is the vehicle's currently-open, not-yet-returned
  // handover record. The concurrency guard (see handoverService.ts) is a
  // unique partial index on (tenantId, vehicleId) scoped to this field being
  // `true` — MongoDB enforces "at most one open handover per vehicle" as a
  // single atomic insert-time constraint, not an application-level
  // check-then-write race. Cleared (unset) the moment the paired return
  // record is created.
  isOpenForVehicle?: true;

  createdAt: Date;
  updatedAt: Date;
}

const RemovableItemInventorySchema = new Schema<RemovableItemInventoryEntry>({
  item: { type: String, required: true, trim: true, maxlength: 200 },
  present: { type: Boolean, required: true },
  condition: { type: String, enum: REMOVABLE_ITEM_CONDITIONS, required: true },
  notes: { type: String, maxlength: 500 },
}, { _id: false });

const ConditionPhotoSchema = new Schema<ConditionPhotoRef>({
  documentId: { type: String, required: true },
  angle: { type: String, enum: ['front', 'rear', 'left', 'right', 'interior', 'odometer', 'other'], required: true },
  takenAt: { type: Date, required: true },
}, { _id: false });

const DiscrepancyFlagSchema = new Schema<DiscrepancyFlag>({
  type: { type: String, enum: DISCREPANCY_FLAG_TYPES, required: true },
  description: { type: String, required: true, maxlength: 1000 },
  itemName: { type: String, maxlength: 200 },
  createdAt: { type: Date, required: true },
}, { _id: false });

const VehicleHandoverSchema = new Schema<IVehicleHandover>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },

  direction: { type: String, enum: HANDOVER_DIRECTIONS, required: true },
  odometerReading: { type: Number, required: true, min: 0 },
  fuelLevel: { type: Number, required: true, min: 0, max: 100 },

  conditionPhotos: { type: [ConditionPhotoSchema], default: [] },
  removableItemInventory: { type: [RemovableItemInventorySchema], default: [] },
  damageNoted: { type: String, maxlength: 2000 },
  flags: { type: [DiscrepancyFlagSchema], default: [] },

  driverAcceptance: {
    accepted: { type: Boolean, required: true, default: false },
    acceptedAt: { type: Date },
    signatureRef: { type: String },
  },

  staffConductedBy: { type: String, required: true },
  conductedAt: { type: Date, required: true },

  linkedReturnHandoverId: { type: Schema.Types.ObjectId, ref: 'VehicleHandover' },

  status: { type: String, enum: HANDOVER_STATUSES, required: true, default: 'pending_driver_acceptance' },

  isOpenForVehicle: { type: Boolean, enum: [true] },
}, { timestamps: true });

VehicleHandoverSchema.index({ tenantId: 1, vehicleId: 1 }, { unique: true, partialFilterExpression: { isOpenForVehicle: true } });
VehicleHandoverSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });
VehicleHandoverSchema.index({ tenantId: 1, driverId: 1, createdAt: -1 });
VehicleHandoverSchema.index({ tenantId: 1, bookingId: 1 });

export const VehicleHandover = mongoose.model<IVehicleHandover>('VehicleHandover', VehicleHandoverSchema);
