import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  tenantId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  startDate: Date;
  periodStart: Date;
  periodEnd: Date;
  nextBillingDate: Date;
  status: 'trial' | 'active' | 'renewal_due' | 'payment_due' | 'locked' | 'suspended' | 'cancelled';
  priceSnapshot: number;
  taxSnapshot: number;
  features: any;
  lockedReason?: string;
  createdBy: string;
  modifiedBy?: string;
  createdAt: Date;
  modifiedAt?: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly'
    },
    startDate: { type: Date, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    nextBillingDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['trial', 'active', 'renewal_due', 'payment_due', 'locked', 'suspended', 'cancelled'],
      default: 'active',
      index: true
    },
    priceSnapshot: { type: Number, required: true },
    taxSnapshot: { type: Number, default: 0 },
    features: { type: Schema.Types.Mixed },
    lockedReason: String,
    createdBy: { type: String, required: true },
    modifiedBy: String,
    createdAt: { type: Date, default: Date.now, index: true },
    modifiedAt: Date
  },
  { collection: 'subscriptions' }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ createdAt: -1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
