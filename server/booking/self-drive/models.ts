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

// Late-return charging (per booking; defaults applied at read time so every
// pre-existing trip keeps working with the standard policy).
export const LATE_CHARGE_UNITS = ['per_hour', 'per_30min', 'per_day', 'fixed'] as const;
export type LateChargeUnit = (typeof LATE_CHARGE_UNITS)[number];
export const DEFAULT_LATE_POLICY = { graceMinutes: 30, rate: 200, unit: 'per_hour' as LateChargeUnit };

// Refund settlement — deduction kinds are a fixed, auditable vocabulary
// (spec: toll/parking/challan/delivery/fuel/late/damage/cleaning/other).
export const DEDUCTION_KINDS = ['toll', 'parking', 'challan', 'delivery', 'fuel', 'late', 'damage', 'cleaning', 'other'] as const;
export type DeductionKind = (typeof DEDUCTION_KINDS)[number];

export const REFUND_MODES = ['cash', 'upi', 'bank_transfer', 'card_reversal', 'wallet', 'other'] as const;
export type RefundMode = (typeof REFUND_MODES)[number];

export type RefundStatus = 'pending' | 'partially_refunded' | 'refunded' | 'forfeited' | 'closed';

export interface RefundDeduction {
  kind: DeductionKind;
  amount: number;
  remarks?: string;
  reference?: string; // challan number, receipt id, …
  waived?: boolean;   // kept in the list (auditable) but excluded from totals
}

export interface RefundTransaction {
  amount: number;
  mode: RefundMode;
  reference?: string;
  remarks?: string;
  at: Date;
  by: string; // User.userId
}

export interface RefundOverride {
  at: Date;
  by: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
}

export interface ISelfDriveTrip extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;

  deposit?: {
    amount: number;
    method: DepositMethod;
    collectedAt: Date;
    collectedBy: string; // User.userId
    reference?: string;  // UTR / txn id
    notes?: string;
  };

  // Per-booking late-return policy; absent = DEFAULT_LATE_POLICY.
  latePolicy?: {
    graceMinutes: number;
    rate: number;
    unit: LateChargeUnit;
  };

  handover?: {
    odometerReading: number;
    fuelLevel: number; // 0-100 (%)
    conductedAt: Date;
    conductedBy: string;
    damageNoted?: string;
    condition?: string;
    documentsHandedOver?: string;
    accessoriesHandedOver?: string;
    depositConfirmed?: boolean;
    notes?: string;
  };

  returnRecord?: {
    odometerReading: number;
    fuelLevel: number;
    conductedAt: Date;
    conductedBy: string;
    damageNoted?: string;
    condition?: string;
    challanFound?: boolean;
    notes?: string;
  };

  // Inspection photos (handover/return) — stored on disk under
  // uploads/self-drive/<bookingId>/, served only through the authenticated,
  // tenant-checked photo route (never express.static — see routes.ts's
  // uploads P0 note).
  photos?: {
    phase: 'handover' | 'return';
    fileName: string;
    originalName?: string;
    uploadedAt: Date;
    uploadedBy: string;
  }[];

  // Refund settlement — created automatically at vehicle return whenever a
  // deposit was held (Rule C). Deposit money only; NEVER mixes with the
  // rental ledger. Closes only at refund balance ₹0 (or an authorized
  // forfeit/override, always with reason — Rule H/J).
  refund?: {
    depositAmount: number;
    deductions: RefundDeduction[];
    transactions: RefundTransaction[];
    status: RefundStatus;
    pendingSince: Date;
    closedAt?: Date;
    closedBy?: string;
    closeReason?: string;
    overrides: RefundOverride[];
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
          reference: { type: String, trim: true, maxlength: 200 },
          notes: { type: String, trim: true, maxlength: 1000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    latePolicy: {
      type: new Schema(
        {
          graceMinutes: { type: Number, required: true, min: 0, max: 1440 },
          rate: { type: Number, required: true, min: 0 },
          unit: { type: String, enum: LATE_CHARGE_UNITS, required: true },
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
          condition: { type: String, trim: true, maxlength: 2000 },
          documentsHandedOver: { type: String, trim: true, maxlength: 2000 },
          accessoriesHandedOver: { type: String, trim: true, maxlength: 2000 },
          depositConfirmed: { type: Boolean },
          notes: { type: String, trim: true, maxlength: 2000 },
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
          condition: { type: String, trim: true, maxlength: 2000 },
          challanFound: { type: Boolean },
          notes: { type: String, trim: true, maxlength: 2000 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    photos: {
      type: [new Schema(
        {
          phase: { type: String, enum: ['handover', 'return'], required: true },
          fileName: { type: String, required: true },
          originalName: { type: String },
          uploadedAt: { type: Date, required: true },
          uploadedBy: { type: String, required: true },
        },
        { _id: false },
      )],
      default: undefined,
    },
    refund: {
      type: new Schema(
        {
          depositAmount: { type: Number, required: true, min: 0 },
          deductions: {
            type: [new Schema(
              {
                kind: { type: String, enum: DEDUCTION_KINDS, required: true },
                amount: { type: Number, required: true, min: 0 },
                remarks: { type: String, trim: true, maxlength: 1000 },
                reference: { type: String, trim: true, maxlength: 200 },
                waived: { type: Boolean, default: false },
              },
              { _id: false },
            )],
            default: [],
          },
          transactions: {
            type: [new Schema(
              {
                amount: { type: Number, required: true, min: 0.01 },
                mode: { type: String, enum: REFUND_MODES, required: true },
                reference: { type: String, trim: true, maxlength: 200 },
                remarks: { type: String, trim: true, maxlength: 1000 },
                at: { type: Date, required: true },
                by: { type: String, required: true },
              },
              { _id: false },
            )],
            default: [],
          },
          status: { type: String, enum: ['pending', 'partially_refunded', 'refunded', 'forfeited', 'closed'], required: true },
          pendingSince: { type: Date, required: true },
          closedAt: { type: Date },
          closedBy: { type: String },
          closeReason: { type: String, trim: true, maxlength: 1000 },
          overrides: {
            type: [new Schema(
              {
                at: { type: Date, required: true },
                by: { type: String, required: true },
                field: { type: String, required: true },
                oldValue: { type: String },
                newValue: { type: String },
                reason: { type: String, required: true, trim: true, maxlength: 1000 },
              },
              { _id: false },
            )],
            default: [],
          },
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
// Backs the tenant-wide refund queue and SLA sweep — bounded query on
// (tenant, refund state, age), never a collection scan.
SelfDriveTripSchema.index({ tenantId: 1, 'refund.status': 1, 'refund.pendingSince': 1 });

// 'refund_pending' slots between the legacy 'returned' and 'settled' stages;
// every pre-refund-era trip (no refund subdoc) derives exactly as before.
export type SelfDriveStage = 'deposit_pending' | 'awaiting_handover' | 'on_trip' | 'returned' | 'refund_pending' | 'settled';

export function deriveStage(trip: Pick<ISelfDriveTrip, 'deposit' | 'handover' | 'returnRecord' | 'settlement' | 'refund'> | null): SelfDriveStage {
  if (!trip) return 'deposit_pending';
  if (trip.refund && ['closed', 'refunded', 'forfeited'].includes(trip.refund.status)) return 'settled';
  if (trip.refund && ['pending', 'partially_refunded'].includes(trip.refund.status)) return 'refund_pending';
  if (trip.settlement) return 'settled';
  if (trip.returnRecord) return 'returned';
  if (trip.handover) return 'on_trip';
  if (trip.deposit) return 'awaiting_handover';
  return 'deposit_pending';
}

// ---------- refund math (single source of truth, pure) ----------

export function activeDeductionTotal(refund: { deductions: RefundDeduction[] } | null | undefined): number {
  if (!refund) return 0;
  return refund.deductions.filter((d) => !d.waived).reduce((sum, d) => sum + d.amount, 0);
}

export function refundedTotal(refund: { transactions: RefundTransaction[] } | null | undefined): number {
  if (!refund) return 0;
  return refund.transactions.reduce((sum, t) => sum + t.amount, 0);
}

export interface RefundComputation {
  depositAmount: number;
  totalDeduction: number;
  refundable: number;     // deposit - deductions, floored at 0
  extraOwed: number;      // deductions beyond the deposit, if any
  refunded: number;
  balance: number;        // refundable - refunded, floored at 0
}

export function computeRefund(refund: { depositAmount: number; deductions: RefundDeduction[]; transactions: RefundTransaction[] } | null | undefined): RefundComputation {
  const depositAmount = refund?.depositAmount ?? 0;
  const totalDeduction = activeDeductionTotal(refund);
  const refundable = Math.max(0, depositAmount - totalDeduction);
  const extraOwed = Math.max(0, totalDeduction - depositAmount);
  // Cap refunded to never exceed refundable amount (prevents overpayment)
  const refunded = Math.min(refundable, refundedTotal(refund));
  const balance = Math.max(0, refundable - refunded);
  return { depositAmount, totalDeduction, refundable, extraOwed, refunded, balance };
}

// ---------- late-charge math (pure; transparent breakdown) ----------

export interface LateChargeResult {
  applicable: boolean;
  lateMinutes: number;        // raw minutes past scheduled end
  chargeableMinutes: number;  // past grace
  units: number;              // billed units after rounding up
  amount: number;
  policy: { graceMinutes: number; rate: number; unit: LateChargeUnit };
}

export function computeLateCharge(
  scheduledEndAt: Date | null | undefined,
  actualAt: Date,
  policy?: { graceMinutes?: number; rate?: number; unit?: LateChargeUnit } | null,
): LateChargeResult {
  const p = {
    graceMinutes: policy?.graceMinutes ?? DEFAULT_LATE_POLICY.graceMinutes,
    rate: policy?.rate ?? DEFAULT_LATE_POLICY.rate,
    unit: policy?.unit ?? DEFAULT_LATE_POLICY.unit,
  };
  if (!scheduledEndAt || isNaN(scheduledEndAt.getTime())) {
    return { applicable: false, lateMinutes: 0, chargeableMinutes: 0, units: 0, amount: 0, policy: p };
  }
  const lateMinutes = Math.max(0, Math.floor((actualAt.getTime() - scheduledEndAt.getTime()) / 60000));
  const chargeableMinutes = Math.max(0, lateMinutes - p.graceMinutes);
  if (chargeableMinutes <= 0) {
    return { applicable: false, lateMinutes, chargeableMinutes: 0, units: 0, amount: 0, policy: p };
  }
  let units = 0;
  let amount = 0;
  switch (p.unit) {
    case 'per_hour':
      units = Math.ceil(chargeableMinutes / 60);
      amount = units * p.rate;
      break;
    case 'per_30min':
      units = Math.ceil(chargeableMinutes / 30);
      amount = units * p.rate;
      break;
    case 'per_day':
      units = Math.ceil(chargeableMinutes / (24 * 60));
      amount = units * p.rate;
      break;
    case 'fixed':
      units = 1;
      amount = p.rate;
      break;
  }
  return { applicable: true, lateMinutes, chargeableMinutes, units, amount, policy: p };
}

export const SelfDriveTrip = mongoose.model<ISelfDriveTrip>('SelfDriveTrip', SelfDriveTripSchema);
