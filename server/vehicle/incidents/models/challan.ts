import mongoose, { Document, Schema } from 'mongoose';

export interface IChallan extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  /** The driver on record AT the violation's event time — captured once,
   * never re-derived later from current assignment (same "never use
   * current driver for a historical event" discipline already established
   * elsewhere in this codebase for GPS driver correlation). */
  driverAtEventTime?: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;

  challanNumber: string;
  eventDate: Date;
  location?: string;
  violation: string;
  amount: number;
  dueDate?: Date;
  paidStatus: 'unpaid' | 'paid' | 'disputed' | 'waived';
  paidAt?: Date;
  evidenceUrls: string[];

  /** Explicit, human-set liability decision — never inferred, never
   * defaulted to a value that authorizes a deduction. `undefined` (not yet
   * decided) is the only safe default, matching AccidentEvent.reviewStatus's
   * same discipline. This field is a *record*, not an action: setting it to
   * 'driver_responsible' does not itself deduct anything — see this task's
   * report for why no deduction code path exists anywhere in this module. */
  responsibilityDecision?: 'driver_responsible' | 'company_responsible' | 'disputed' | 'waived';
  responsibilityDecidedBy?: string;
  responsibilityDecidedAt?: Date;

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChallanSchema = new Schema<IChallan>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  driverAtEventTime: { type: Schema.Types.ObjectId, ref: 'Driver' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },

  challanNumber: { type: String, required: true, trim: true, maxlength: 100 },
  eventDate: { type: Date, required: true },
  location: { type: String, trim: true, maxlength: 300 },
  violation: { type: String, required: true, maxlength: 500 },
  amount: { type: Number, required: true, min: 0 },
  dueDate: { type: Date },
  paidStatus: { type: String, enum: ['unpaid', 'paid', 'disputed', 'waived'], default: 'unpaid' },
  paidAt: { type: Date },
  evidenceUrls: { type: [String], default: [] },

  responsibilityDecision: { type: String, enum: ['driver_responsible', 'company_responsible', 'disputed', 'waived'] },
  responsibilityDecidedBy: { type: String },
  responsibilityDecidedAt: { type: Date },

  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

ChallanSchema.index({ tenantId: 1, vehicleId: 1, eventDate: -1 });
ChallanSchema.index({ tenantId: 1, challanNumber: 1 }, { unique: true });
ChallanSchema.index({ tenantId: 1, paidStatus: 1 });

export const Challan = mongoose.model<IChallan>('Challan', ChallanSchema);
