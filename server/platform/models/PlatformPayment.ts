import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformPayment extends Document {
  tenantId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  status: 'received' | 'cleared' | 'failed' | 'refunded';
  paymentDate: Date;
  receivedDate?: Date;
  clearedAt?: Date;
  bankClearanceDate?: Date;
  receivedBy: string;
  modifiedBy?: string;
  createdAt: Date;
  modifiedAt?: Date;
}

const paymentSchema = new Schema<IPlatformPayment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'PlatformInvoice',
      required: true,
      index: true
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true
    },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    transactionId: { type: String, unique: true, required: true, index: true },
    status: {
      type: String,
      enum: ['received', 'cleared', 'failed', 'refunded'],
      default: 'received',
      index: true
    },
    paymentDate: { type: Date, required: true },
    receivedDate: Date,
    clearedAt: Date,
    bankClearanceDate: Date,
    receivedBy: { type: String, required: true },
    modifiedBy: String,
    createdAt: { type: Date, default: Date.now, index: true },
    modifiedAt: Date
  },
  { collection: 'platform_payments' }
);

paymentSchema.index({ tenantId: 1, status: 1 });
paymentSchema.index({ invoiceId: 1, status: 1 });
paymentSchema.index({ paymentDate: -1 });

export const PlatformPayment = mongoose.model<IPlatformPayment>('PlatformPayment', paymentSchema);
