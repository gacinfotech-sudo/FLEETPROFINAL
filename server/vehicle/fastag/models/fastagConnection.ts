// Tenant-level FASTag provider connection — mirrors
// server/gps/models/gpsConnection.ts's shape (credentials encrypted,
// select: false, masked on read).
import mongoose, { Document, Schema } from 'mongoose';

export interface IFastagConnection extends Document {
  tenantId: mongoose.Types.ObjectId;
  connectionName: string;
  providerKey: string;
  enabled: boolean;
  status: 'configuration_required' | 'connected' | 'authentication_failed' | 'provider_unavailable' | 'disabled';
  encryptedSecrets?: string;
  credentialFields: string[];
  lastTestedAt?: Date;
  lastError?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const FastagConnectionSchema = new Schema<IFastagConnection>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  connectionName: { type: String, required: true, trim: true, maxlength: 120 },
  providerKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 64 },
  enabled: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['configuration_required', 'connected', 'authentication_failed', 'provider_unavailable', 'disabled'],
    default: 'configuration_required',
  },
  encryptedSecrets: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  lastTestedAt: { type: Date },
  lastError: { type: String, maxlength: 1000 },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

FastagConnectionSchema.index({ tenantId: 1, connectionName: 1 }, { unique: true });

export const FastagConnection = mongoose.model<IFastagConnection>('FastagConnection', FastagConnectionSchema);
