// FastagRecord — per-vehicle tag mapping + last-known balance/status.
// Transaction sync populates Expense.category = 'toll' rows (proposed,
// Integrator-applied — see this task's report), this model is the
// tag-to-vehicle mapping and balance cache, not a transaction ledger itself
// (FastagTransaction, in types.ts, is the provider-returned shape;
// persisting a transaction history collection is left to the Integrator's
// sync-job wiring, out of this task's "adapter interface + mock only" scope).
import mongoose, { Document, Schema } from 'mongoose';

export interface IFastagRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  connectionId: mongoose.Types.ObjectId;
  tagId: string;
  lastKnownBalance?: number;
  lastSyncedAt?: Date;
  status: 'active' | 'inactive' | 'blacklisted' | 'unknown';
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const FastagRecordSchema = new Schema<IFastagRecord>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  connectionId: { type: Schema.Types.ObjectId, ref: 'FastagConnection', required: true },
  tagId: { type: String, required: true, trim: true, maxlength: 100 },
  lastKnownBalance: { type: Number },
  lastSyncedAt: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'blacklisted', 'unknown'], default: 'unknown' },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

// One active tag per vehicle per tenant — matches the GPS device↔vehicle
// one-to-one assignment convention already established in this repo.
FastagRecordSchema.index({ tenantId: 1, vehicleId: 1 }, { unique: true });
FastagRecordSchema.index({ tenantId: 1, tagId: 1 }, { unique: true });

export const FastagRecord = mongoose.model<IFastagRecord>('FastagRecord', FastagRecordSchema);
