import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  description: string;
  monthlyPrice: number;
  tax: number;
  features: any;
  isActive: boolean;
  createdAt: Date;
  modifiedAt?: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    monthlyPrice: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    features: {
      type: {
        userLimit: Number,
        driverLimit: Number,
        vehicleLimit: Number,
        customBranding: Boolean,
        apiAccess: Boolean,
        mobileApp: Boolean
      },
      default: {}
    },
    isActive: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: Date
  },
  { collection: 'plans' }
);

planSchema.index({ isActive: 1 });

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
