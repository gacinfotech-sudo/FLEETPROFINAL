import mongoose, { Document, Schema } from 'mongoose';
import type { TelephonyIdentityStatus } from '../types';

// Per-executive telephony assignment (spec: "each executive must support a
// separate user-specific telephony assignment"). Deliberately its own
// collection outside server/models/index.ts — see server/gps/models/* for
// the precedent of a module owning its own Mongoose models rather than
// editing the shared model file, which this task is forbidden from doing
// (see TASK-02-report.md's "Proposed server/models/index.ts patch" for the
// consolidated version the Integrator can fold in later).
//
// `userId` matches User.userId (the string identifier already used
// tenant-wide, e.g. in createdBy.userId elsewhere) rather than a Mongo
// ObjectId ref, for consistency with how the rest of this codebase
// attributes records to users.
export interface ITelephonyIdentity extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: string;
  providerKey: string;
  providerAgentId?: string;
  registeredNumber?: string;
  virtualNumber?: string;
  extension?: string;
  incomingEnabled: boolean;
  outgoingEnabled: boolean;
  status: TelephonyIdentityStatus;
  /** AES-256-GCM envelope from credentialEncryption.ts — never selected by
   * default, never serialized to the frontend. */
  encryptedCredentials?: string;
  credentialFields: string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TelephonyIdentitySchema = new Schema<ITelephonyIdentity>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  userId: { type: String, required: true, lowercase: true, trim: true },
  providerKey: { type: String, required: true, trim: true, lowercase: true, default: 'mock' },
  providerAgentId: { type: String, trim: true, maxlength: 200 },
  registeredNumber: { type: String, trim: true, maxlength: 32 },
  virtualNumber: { type: String, trim: true, maxlength: 32 },
  extension: { type: String, trim: true, maxlength: 16 },
  incomingEnabled: { type: Boolean, default: true },
  outgoingEnabled: { type: Boolean, default: true },
  status: {
    type: String,
    enum: ['available', 'busy', 'wrap_up', 'offline', 'disabled'],
    default: 'offline',
  },
  encryptedCredentials: { type: String, select: false },
  credentialFields: { type: [String], default: [] },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

TelephonyIdentitySchema.index({ tenantId: 1, userId: 1 }, { unique: true });

export const TelephonyIdentity = mongoose.model<ITelephonyIdentity>(
  'TelephonyIdentity',
  TelephonyIdentitySchema,
);
