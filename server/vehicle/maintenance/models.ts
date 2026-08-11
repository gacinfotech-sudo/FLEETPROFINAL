// New collections: MaintenanceRecord, TyreRecord, BatteryRecord,
// VehicleInventoryItem. Additive-only — no change to the shared Vehicle
// schema (server/models/index.ts, Integrator-only). Self-contained here,
// same pattern as server/driver/handover/models.ts and server/gps/models/**.
import mongoose, { Document, Schema } from 'mongoose';
import type {
  MaintenanceCategory, MaintenanceRecordStatus, MaintenanceTriggerType,
  TyrePosition, InventoryItemCategory,
} from './types';

const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'OIL_CHANGE', 'FILTER_REPLACEMENT', 'BRAKE_SERVICE', 'GENERAL_SERVICE', 'MAJOR_OVERHAUL', 'OTHER',
];
const MAINTENANCE_STATUSES: MaintenanceRecordStatus[] = [
  'DUE', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED',
];
const MAINTENANCE_TRIGGER_TYPES: MaintenanceTriggerType[] = ['DATE', 'ODOMETER', 'ENGINE_HOURS', 'DIAGNOSTIC_ALERT'];
const TYRE_POSITIONS: TyrePosition[] = [
  'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', 'REAR_LEFT_INNER', 'REAR_RIGHT_INNER', 'SPARE',
];
const INVENTORY_CATEGORIES: InventoryItemCategory[] = [
  'SPARE_TYRE', 'JACK', 'TOOLKIT', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT', 'WARNING_TRIANGLE', 'TOW_ROPE', 'OTHER',
];

export interface IMaintenanceRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  category: MaintenanceCategory;
  description?: string;
  status: MaintenanceRecordStatus;
  odometerAtService?: number;
  engineHoursAtService?: number;
  serviceDate?: Date;
  schedule: {
    nextDueDate?: Date;
    nextDueKm?: number;
    nextDueEngineHours?: number;
  };
  triggeredBy?: MaintenanceTriggerType;
  cost?: number;
  vendorName?: string;
  odometerReadingSource?: 'MANUAL' | 'GPS_TELEMETRY';
  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceRecordSchema = new Schema<IMaintenanceRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  category: { type: String, enum: MAINTENANCE_CATEGORIES, required: true },
  description: { type: String, maxlength: 2000 },
  status: { type: String, enum: MAINTENANCE_STATUSES, required: true, default: 'SCHEDULED' },
  odometerAtService: { type: Number, min: 0 },
  engineHoursAtService: { type: Number, min: 0 },
  serviceDate: { type: Date },
  schedule: {
    nextDueDate: { type: Date },
    nextDueKm: { type: Number, min: 0 },
    nextDueEngineHours: { type: Number, min: 0 },
  },
  triggeredBy: { type: String, enum: MAINTENANCE_TRIGGER_TYPES },
  cost: { type: Number, min: 0 },
  vendorName: { type: String, maxlength: 200 },
  odometerReadingSource: { type: String, enum: ['MANUAL', 'GPS_TELEMETRY'] },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

MaintenanceRecordSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });
MaintenanceRecordSchema.index({ tenantId: 1, status: 1 });

export const MaintenanceRecord = mongoose.model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema);

export interface ITyreRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  position: TyrePosition;
  brand?: string;
  serialNumber?: string;
  purchaseCost: number;
  purchaseDate: Date;
  installationOdometerKm: number;
  removalOdometerKm?: number;
  removalDate?: Date;
  removalReason?: 'WORN_OUT' | 'PUNCTURE_UNREPAIRABLE' | 'DAMAGE' | 'ROTATED_OUT' | 'OTHER';
  status: 'IN_SERVICE' | 'REMOVED' | 'RETREADED' | 'SCRAPPED';
  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const TyreRecordSchema = new Schema<ITyreRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  position: { type: String, enum: TYRE_POSITIONS, required: true },
  brand: { type: String, maxlength: 100 },
  serialNumber: { type: String, maxlength: 100 },
  purchaseCost: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, required: true },
  installationOdometerKm: { type: Number, required: true, min: 0 },
  removalOdometerKm: { type: Number, min: 0 },
  removalDate: { type: Date },
  removalReason: { type: String, enum: ['WORN_OUT', 'PUNCTURE_UNREPAIRABLE', 'DAMAGE', 'ROTATED_OUT', 'OTHER'] },
  status: { type: String, enum: ['IN_SERVICE', 'REMOVED', 'RETREADED', 'SCRAPPED'], required: true, default: 'IN_SERVICE' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

// A vehicle position (e.g. FRONT_LEFT) can have only one currently
// IN_SERVICE tyre at a time — same partial-unique-index pattern as
// VehicleHandover's "at most one open handover per vehicle".
TyreRecordSchema.index(
  { tenantId: 1, vehicleId: 1, position: 1 },
  { unique: true, partialFilterExpression: { status: 'IN_SERVICE' } },
);
TyreRecordSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });

export const TyreRecord = mongoose.model<ITyreRecord>('TyreRecord', TyreRecordSchema);

export interface IBatteryRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  brand?: string;
  serialNumber?: string;
  capacityAh?: number;
  purchaseCost: number;
  purchaseDate: Date;
  installationDate: Date;
  warrantyMonths?: number;
  removalDate?: Date;
  removalReason?: 'DEAD' | 'DAMAGE' | 'WARRANTY_REPLACEMENT' | 'OTHER';
  status: 'IN_SERVICE' | 'REMOVED';
  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const BatteryRecordSchema = new Schema<IBatteryRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  brand: { type: String, maxlength: 100 },
  serialNumber: { type: String, maxlength: 100 },
  capacityAh: { type: Number, min: 0 },
  purchaseCost: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, required: true },
  installationDate: { type: Date, required: true },
  warrantyMonths: { type: Number, min: 0 },
  removalDate: { type: Date },
  removalReason: { type: String, enum: ['DEAD', 'DAMAGE', 'WARRANTY_REPLACEMENT', 'OTHER'] },
  status: { type: String, enum: ['IN_SERVICE', 'REMOVED'], required: true, default: 'IN_SERVICE' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

// Only one IN_SERVICE battery per vehicle at a time.
BatteryRecordSchema.index(
  { tenantId: 1, vehicleId: 1 },
  { unique: true, partialFilterExpression: { status: 'IN_SERVICE' } },
);
BatteryRecordSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });

export const BatteryRecord = mongoose.model<IBatteryRecord>('BatteryRecord', BatteryRecordSchema);

export interface IVehicleInventoryItem extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  category: InventoryItemCategory;
  name: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  warrantyExpiryDate?: Date;
  status: 'PRESENT' | 'MISSING' | 'DAMAGED' | 'REPLACED';
  createdBy: { userId: string; role: string };
  createdAt: Date;
  updatedAt: Date;
}

const VehicleInventoryItemSchema = new Schema<IVehicleInventoryItem>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  category: { type: String, enum: INVENTORY_CATEGORIES, required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  purchaseDate: { type: Date },
  purchaseCost: { type: Number, min: 0 },
  warrantyExpiryDate: { type: Date },
  status: { type: String, enum: ['PRESENT', 'MISSING', 'DAMAGED', 'REPLACED'], required: true, default: 'PRESENT' },
  createdBy: { userId: { type: String, required: true }, role: { type: String, required: true } },
}, { timestamps: true });

VehicleInventoryItemSchema.index({ tenantId: 1, vehicleId: 1, createdAt: -1 });

export const VehicleInventoryItem = mongoose.model<IVehicleInventoryItem>('VehicleInventoryItem', VehicleInventoryItemSchema);
