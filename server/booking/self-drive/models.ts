// New collection: SelfDriveTrip. Additive-only — the self-drive customer
// lifecycle (deposit → vehicle handover → return → settlement) lives in its
// own record keyed to the booking, never as new required fields on the
// heavily-relied-on Booking schema (same preserve-first rationale as
// server/driver/handover/models.ts). One record per self-drive booking.
import mongoose, { Document, Schema } from 'mongoose';

export const DEPOSIT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'other'] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export interface SelfDriveCharge {
  label: string;
  amount: number;
}

export interface ISelfDriveTrip extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;

  deposit?: {
    amount: number;
    method: DepositMethod;
    collectedAt: Date;
    collectedBy: string; // User.userId
    notes?: string;
  };

  handover?: {
    odometerReading: number;
    fuelLevel: number; // 0-100 (%)
    conductedAt: Date;
    conductedBy: string;
    damageNoted?: string;
  };

  returnRecord?: {
    odometerReading: number;
    fuelLevel: number;
    conductedAt: Date;
    conductedBy: string;
    damageNoted?: string;
  };

  settlement?: {
    charges: SelfDriveCharge[];
    totalCharges: number;
    depositRefund: number; // deposit minus charges, floored at 0
    balanceDue: number; // charges beyond the deposit, if any
    settledAt: Date;
    settledBy: string;
    notes?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const ChargeSchema = new Schema<SelfDriveCharge>(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const SelfDriveTripSchema = new Schema<ISelfDriveTrip>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    deposit: {
      type: new Schema(
        {
          amount: { type: Number, required: true, min: 0 },
          method: { type: String, enum: DEPOSIT_METHODS, required: true },
          collectedAt: { type: Date, required: true },
          collectedBy: { type: String, required: true },
          notes: { type: String, trim: true, maxlength: 1000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    handover: {
      type: new Schema(
        {
          odometerReading: { type: Number, required: true, min: 0 },
          fuelLevel: { type: Number, required: true, min: 0, max: 100 },
          conductedAt: { type: Date, required: true },
          conductedBy: { type: String, required: true },
          damageNoted: { type: String, trim: true, maxlength: 2000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    returnRecord: {
      type: new Schema(
        {
          odometerReading: { type: Number, required: true, min: 0 },
          fuelLevel: { type: Number, required: true, min: 0, max: 100 },
          conductedAt: { type: Date, required: true },
          conductedBy: { type: String, required: true },
          damageNoted: { type: String, trim: true, maxlength: 2000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    settlement: {
      type: new Schema(
        {
          charges: { type: [ChargeSchema], default: [] },
          totalCharges: { type: Number, required: true, min: 0 },
          depositRefund: { type: Number, required: true, min: 0 },
          balanceDue: { type: Number, required: true, min: 0 },
          settledAt: { type: Date, required: true },
          settledBy: { type: String, required: true },
          notes: { type: String, trim: true, maxlength: 2000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

// One lifecycle record per booking, enforced at insert time.
SelfDriveTripSchema.index({ tenantId: 1, bookingId: 1 }, { unique: true });

export type SelfDriveStage = 'deposit_pending' | 'awaiting_handover' | 'on_trip' | 'returned' | 'settled';

export function deriveStage(trip: Pick<ISelfDriveTrip, 'deposit' | 'handover' | 'returnRecord' | 'settlement'> | null): SelfDriveStage {
  if (!trip) return 'deposit_pending';
  if (trip.settlement) return 'settled';
  if (trip.returnRecord) return 'returned';
  if (trip.handover) return 'on_trip';
  if (trip.deposit) return 'awaiting_handover';
  return 'deposit_pending';
}

export const SelfDriveTrip = mongoose.model<ISelfDriveTrip>('SelfDriveTrip', SelfDriveTripSchema);
