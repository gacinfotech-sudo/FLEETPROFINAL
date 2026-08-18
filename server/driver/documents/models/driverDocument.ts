// Document registry — MongoDB is the source of truth for every field the
// Google Drive Rule lists (driver ID, document type, number, masked number,
// issue/expiry dates, verification status, Drive file id, folder id, MIME type,
// checksum, uploader, timestamps, verifier, version history, retention status,
// access classification). Google Drive holds file bytes only — see
// GOOGLE-DRIVE-SECURITY-SPEC.md's "Core principle".
import mongoose, { Document, Schema } from 'mongoose';
import {
  ACCESS_CLASSIFICATIONS,
  DOCUMENT_TYPES,
  RETENTION_STATUSES,
  VERIFICATION_STATUSES,
  type AccessClassification,
  type DocumentType,
  type RetentionStatus,
  type VerificationStatus,
} from '../types';

export interface IDriverDocumentVersion {
  versionNumber: number;
  driveFileId: string;
  driveFolderId: string;
  mimeType: string;
  sizeBytes: number;
  // md5Checksum comes from Drive's own response (integrity as Drive sees it);
  // sha256Checksum is computed locally from the uploaded bytes before the Drive
  // call (integrity as FleetPro received it) — two independent checks.
  md5Checksum?: string;
  sha256Checksum: string;
  uploadedBy: string;
  uploadedAt: Date;
  // The verification state THIS version had at the moment it was superseded —
  // preserved for history even though the top-level verificationStatus resets
  // to 'pending' for the new current version. Never rewritten after the fact.
  verificationStatusAtSupersession?: VerificationStatus;
  supersededAt: Date;
  supersededBy: string;
}

export interface IDriverDocument extends Document {
  tenantId: mongoose.Types.ObjectId;
  driverId: mongoose.Types.ObjectId;
  documentType: DocumentType;
  // Required only for documentType === 'other' — a human-readable label, never
  // just the raw uploaded filename (DRIVER-DOCUMENT-MATRIX.md: "every 'other'
  // upload must still get a human-readable label").
  label?: string;

  // Raw document number, encrypted at rest, decrypted only for a
  // DRIVER_DOCUMENT_VIEW_HIGH-tier caller — never logged (grep-verified, see
  // task report) and never returned in any API response below the High tier.
  encryptedDocumentNumber?: string;
  // Always-safe-to-display masked form (e.g. Aadhaar "XXXX XXXX 1234"), shown
  // at Standard/Medium tiers per DRIVER-DOCUMENT-MATRIX.md ("Aadhaar number
  // masked in DB per UIDAI guidance").
  maskedDocumentNumber?: string;

  issueDate?: Date;
  expiryDate?: Date;

  verificationStatus: VerificationStatus;
  verificationReason?: string;
  verifiedBy?: string;
  verificationTime?: Date;

  // Current version's file pointer (Drive holds bytes only).
  driveFileId: string;
  driveFolderId: string;
  mimeType: string;
  sizeBytes: number;
  md5Checksum?: string;
  sha256Checksum: string;
  uploadedBy: string;
  uploadTime: Date;
  currentVersionNumber: number;
  versions: IDriverDocumentVersion[];

  retentionStatus: RetentionStatus;
  retentionHoldReason?: string;
  retentionHoldSetAt?: Date;

  accessClassification: AccessClassification;

  createdAt: Date;
  updatedAt: Date;
}

const DriverDocumentVersionSchema = new Schema<IDriverDocumentVersion>({
  versionNumber: { type: Number, required: true },
  driveFileId: { type: String, required: true },
  driveFolderId: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  md5Checksum: { type: String },
  sha256Checksum: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, required: true },
  verificationStatusAtSupersession: { type: String, enum: VERIFICATION_STATUSES },
  supersededAt: { type: Date, required: true },
  supersededBy: { type: String, required: true },
}, { _id: false });

const DriverDocumentSchema = new Schema<IDriverDocument>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
  documentType: { type: String, required: true, enum: DOCUMENT_TYPES },
  label: { type: String, trim: true, maxlength: 200 },

  encryptedDocumentNumber: { type: String, select: false },
  maskedDocumentNumber: { type: String, maxlength: 100 },

  issueDate: { type: Date },
  expiryDate: { type: Date },

  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending' },
  verificationReason: { type: String, maxlength: 1000 },
  verifiedBy: { type: String },
  verificationTime: { type: Date },

  driveFileId: { type: String, required: true },
  driveFolderId: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  md5Checksum: { type: String },
  sha256Checksum: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadTime: { type: Date, required: true },
  currentVersionNumber: { type: Number, required: true, default: 1 },
  versions: { type: [DriverDocumentVersionSchema], default: [] },

  retentionStatus: { type: String, enum: RETENTION_STATUSES, default: 'active' },
  retentionHoldReason: { type: String, maxlength: 500 },
  retentionHoldSetAt: { type: Date },

  accessClassification: { type: String, enum: ACCESS_CLASSIFICATIONS, required: true },
}, { timestamps: true });

// One active document record per (driver, documentType); 'other' documents are
// distinguished by label, so uniqueness there is scoped to the label too.
DriverDocumentSchema.index(
  { tenantId: 1, driverId: 1, documentType: 1, label: 1 },
  { unique: true },
);
DriverDocumentSchema.index({ tenantId: 1, driverId: 1 });
DriverDocumentSchema.index({ tenantId: 1, expiryDate: 1 });
DriverDocumentSchema.index({ tenantId: 1, retentionStatus: 1 });

export const DriverDocument = mongoose.model<IDriverDocument>('DriverDocument', DriverDocumentSchema);
