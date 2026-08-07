// Vehicle Document & Compliance Registry model. Follows the proven
// architecture of server/driver/documents/models/driverDocument.ts (read-only
// reference — not imported, that module lives in an unmerged worktree; see
// this task's report for why and how the Integrator reconciles the two).
// MongoDB is the source of truth for every field; Google Drive (once wired,
// see driveConnection.ts) holds file bytes only — concrete code proof
// against VEHICLE-COMPLIANCE-MATRIX.md's rejected claim "Google Drive can
// replace the FleetPro database": every field below lives here, Drive
// pointers are just references.
//
// Unlike DriverDocument, document numbers here (RC number, policy number,
// permit number) are not encrypted-at-rest — vehicle registration/insurance/
// permit numbers are not equivalent-sensitivity personal data the way a
// driver's Aadhaar/license number is (no masking/encryption requirement
// found anywhere in VEHICLE-COMPLIANCE-MATRIX.md or VEHICLE-REAL-WORLD-
// RESEARCH.md, unlike the driver matrix's explicit Aadhaar-masking rule).
import mongoose, { Document, Schema } from 'mongoose';
import { ALL_DOCUMENT_TYPES } from '../applicability';
import type { VehicleDocumentType } from '../types';

export type VehicleDocumentVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface IVehicleDocumentVersion {
  versionNumber: number;
  // Both optional: a version can exist with no file yet attached (a document
  // recorded by number/dates only, common for "we have the physical paper,
  // haven't scanned it yet" per real fleet-ops workflows) — see
  // VEHICLE-REAL-WORLD-RESEARCH.md's operational-practice notes. Once the
  // Drive wiring lands (driveConnection.ts), uploads populate these.
  driveFileId?: string;
  driveFolderId?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256Checksum?: string;
  uploadedBy: string;
  uploadedAt: Date;
  verificationStatusAtSupersession?: VehicleDocumentVerificationStatus;
  supersededAt: Date;
  supersededBy: string;
}

export interface IVehicleDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  documentType: VehicleDocumentType;
  /** Required only for documentType === 'other' — mirrors the driver
   * module's same rule for its open-ended type. */
  label?: string;

  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: Date;
  expiryDate?: Date;

  verificationStatus: VehicleDocumentVerificationStatus;
  verificationReason?: string;
  verifiedBy?: string;
  verificationTime?: Date;

  /** Tenant-configurable per-document reminder lead time, in days before
   * expiry — overrides the compliance-status computation's default 30-day
   * `expiringSoonThresholdDays` for this specific document if set. */
  reminderDaysBeforeExpiry?: number;

  // Current version's file pointer — all optional, see IVehicleDocumentVersion.
  driveFileId?: string;
  driveFolderId?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256Checksum?: string;
  uploadedBy?: string;
  uploadTime?: Date;
  currentVersionNumber: number;
  versions: IVehicleDocumentVersion[];

  isDeleted: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleDocumentVersionSchema = new Schema<IVehicleDocumentVersion>({
  versionNumber: { type: Number, required: true },
  driveFileId: { type: String },
  driveFolderId: { type: String },
  mimeType: { type: String },
  sizeBytes: { type: Number },
  sha256Checksum: { type: String },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, required: true },
  verificationStatusAtSupersession: { type: String, enum: ['pending', 'verified', 'rejected'] },
  supersededAt: { type: Date, required: true },
  supersededBy: { type: String, required: true },
}, { _id: false });

const VehicleDocumentSchema = new Schema<IVehicleDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  documentType: { type: String, required: true, enum: ALL_DOCUMENT_TYPES },
  label: { type: String, trim: true, maxlength: 200 },

  documentNumber: { type: String, trim: true, maxlength: 100 },
  issuingAuthority: { type: String, trim: true, maxlength: 200 },
  issueDate: { type: Date },
  expiryDate: { type: Date },

  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  verificationReason: { type: String, maxlength: 1000 },
  verifiedBy: { type: String },
  verificationTime: { type: Date },

  reminderDaysBeforeExpiry: { type: Number, min: 1, max: 365 },

  driveFileId: { type: String },
  driveFolderId: { type: String },
  mimeType: { type: String },
  sizeBytes: { type: Number },
  sha256Checksum: { type: String },
  uploadedBy: { type: String },
  uploadTime: { type: Date },
  currentVersionNumber: { type: Number, required: true, default: 1 },
  versions: { type: [VehicleDocumentVersionSchema], default: [] },

  isDeleted: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

// One active document record per (vehicle, documentType); 'other' documents
// distinguished by label, same convention as DriverDocument.
VehicleDocumentSchema.index(
  { tenantId: 1, vehicleId: 1, documentType: 1, label: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
VehicleDocumentSchema.index({ tenantId: 1, vehicleId: 1 });
VehicleDocumentSchema.index({ tenantId: 1, expiryDate: 1 });

export const VehicleDocument = mongoose.model<IVehicleDocument>('VehicleDocument', VehicleDocumentSchema);
