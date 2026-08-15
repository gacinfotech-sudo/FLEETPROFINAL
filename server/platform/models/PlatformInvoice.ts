import mongoose, { Schema, Document } from 'mongoose';

export interface ILineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IPlatformInvoice extends Document {
  invoiceNumber: string;
  invoiceSequence: number;
  tenantId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: Date;
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void';
  lineItems: ILineItem[];
  issuedAt: Date;
  voidedAt?: Date;
  createdBy: string;
  modifiedBy?: string;
  createdAt: Date;
  modifiedAt?: Date;
}

const invoiceSchema = new Schema<IPlatformInvoice>(
  {
    invoiceNumber: { type: String, unique: true, required: true },
    invoiceSequence: { type: Number, required: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true
    },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    outstanding: { type: Number, required: true },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['draft', 'issued', 'partial', 'paid', 'overdue', 'void'],
      default: 'issued',
      index: true
    },
    lineItems: [{
      description: String,
      quantity: Number,
      unitPrice: Number,
      amount: Number
    }],
    issuedAt: { type: Date, default: Date.now },
    voidedAt: Date,
    createdBy: { type: String, required: true },
    modifiedBy: String,
    createdAt: { type: Date, default: Date.now, index: true },
    modifiedAt: Date
  },
  { collection: 'platform_invoices' }
);

invoiceSchema.index({ tenantId: 1, status: 1 });
invoiceSchema.index({ subscriptionId: 1, billingPeriodStart: 1 });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ createdAt: -1 });

export const PlatformInvoice = mongoose.model<IPlatformInvoice>('PlatformInvoice', invoiceSchema);
