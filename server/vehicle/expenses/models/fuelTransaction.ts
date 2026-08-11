// FuelTransaction — line-item detail an Expense row alone can't hold
// (odometer, quantity, unit implied by fuelType, station, full-tank flag).
// Per VEHICLE-EXPENSE-MATRIX.md: "the Expense row stays the ledger entry,
// FuelTransaction adds the detail" — this model never replaces Expense,
// `expenseId` links the two once the Integrator wires the creation flow
// (proposed in this task's report, not applied here — server/routes.ts and
// server/storage-mongodb.ts's Expense-creation call site are forbidden files).
import mongoose, { Document, Schema } from 'mongoose';
import type { FuelType } from '../types';

export interface IFuelTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  /** Set once the Integrator wires this module's creation flow to also
   * create the corresponding `Expense` ledger row — optional here since
   * this task cannot create that row itself (server/storage-mongodb.ts is
   * forbidden). */
  expenseId?: mongoose.Types.ObjectId;
  driverId?: mongoose.Types.ObjectId;
  fuelType: FuelType;
  odometer: number;
  quantity: number;
  amount: number;
  isFullTank: boolean;
  station?: string;
  date: Date;
  /** Cached at write time from `computeEfficiency` so list views don't
   * recompute per row — the source of truth for "why" is always the
   * analytics.ts function, this is a denormalized read optimization only. */
  computedKmPerLitre?: number;
  computedKmPerKg?: number;
  computedKmPerKwh?: number;
  computedCostPerKm?: number;
  flaggedAbnormal: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const FuelTransactionSchema = new Schema<IFuelTransaction>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  expenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
  fuelType: { type: String, required: true, enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid'] },
  odometer: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  isFullTank: { type: Boolean, required: true, default: true },
  station: { type: String, trim: true, maxlength: 200 },
  date: { type: Date, required: true },
  computedKmPerLitre: { type: Number },
  computedKmPerKg: { type: Number },
  computedKmPerKwh: { type: Number },
  computedCostPerKm: { type: Number },
  flaggedAbnormal: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
}, { timestamps: true });

FuelTransactionSchema.index({ tenantId: 1, vehicleId: 1, date: -1 });
FuelTransactionSchema.index({ tenantId: 1, vehicleId: 1, odometer: -1 });

export const FuelTransaction = mongoose.model<IFuelTransaction>('FuelTransaction', FuelTransactionSchema);
