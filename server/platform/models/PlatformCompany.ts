import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformCompany extends Document {
  name: string;
  logo?: string;
  tagline?: string;
  status: 'ACTIVE' | 'INACTIVE';
  settings: any;
  createdAt: Date;
  updatedAt: Date;
}

const platformCompanySchema = new Schema<IPlatformCompany>(
  {
    name: { type: String, required: true, unique: true },
    logo: String,
    tagline: String,
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE'
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'platform_companies' }
);

export const PlatformCompany = mongoose.model<IPlatformCompany>('PlatformCompany', platformCompanySchema);
