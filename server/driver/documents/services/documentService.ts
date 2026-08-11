// Core document-registry business logic. Every function here is tenant-scoped
// by construction (every query includes tenantId) — this is the single place
// that decides what a version-history replace looks like, what "verified" means,
// and what a caller without the High-tier permission is allowed to see.
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { DriverDocument, type IDriverDocument, type IDriverDocumentVersion } from '../models/driverDocument';
import { DOCUMENT_TYPE_ACCESS_CLASSIFICATION, type DocumentType } from '../types';
import type { DriveClient, DriveFileMetadata } from '../drive/driveApiClient';
import { DrivePublicSharingDetectedError } from '../drive/driveApiClient';
import type { ITenantGoogleDriveConnection } from '../models/tenantGoogleDriveConnection';
import { resolveDocumentFolder } from './folderService';
import { maskDocumentNumber } from './masking';
import { encryptDriverDocumentSecret, decryptDriverDocumentSecret } from '../security/documentEncryption';
import { writeDriverDocumentAudit } from './connectionService';

const MIME_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const ALLOWED_DOCUMENT_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildDriveFileName(documentType: DocumentType, versionNumber: number, mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType] || 'bin';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${documentType}_v${versionNumber}_${timestamp}.${ext}`;
}

export class DriveConnectionNotConfiguredError extends Error {
  constructor() {
    super('This tenant has no enabled Google Drive connection configured.');
    this.name = 'DriveConnectionNotConfiguredError';
  }
}

export interface UploadDocumentInput {
  tenantId: string;
  driverId: string;
  documentType: DocumentType;
  label?: string;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  fileBuffer: Buffer;
  mimeType: string;
  uploadedBy: string;
  driveClient: DriveClient;
  connection: ITenantGoogleDriveConnection;
}

/** Uploads to Drive, then creates or replaces the DriverDocument record. Every
 * upload after the first creates a new version record instead of overwriting
 * — see GOOGLE-DRIVE-SECURITY-SPEC.md's "Verification & version history". */
export async function uploadDriverDocument(input: UploadDocumentInput): Promise<IDriverDocument> {
  const label = input.documentType === 'other' ? (input.label || '').trim() : '';
  if (input.documentType === 'other' && !label) {
    throw new Error('label is required for documentType "other".');
  }

  const existing = await DriverDocument.findOne({
    tenantId: input.tenantId,
    driverId: input.driverId,
    documentType: input.documentType,
    label,
  });

  const nextVersionNumber = existing ? existing.currentVersionNumber + 1 : 1;
  const sha256Checksum = sha256Hex(input.fileBuffer);

  const { driverFolderId, documentTypeFolderId } = await resolveDocumentFolder(
    input.driveClient,
    input.connection,
    input.driverId,
    input.documentType,
  );
  void driverFolderId;

  const fileName = buildDriveFileName(input.documentType, nextVersionNumber, input.mimeType);
  const uploaded: DriveFileMetadata = await input.driveClient.uploadFile({
    name: fileName,
    parentId: documentTypeFolderId,
    sharedDriveId: input.connection.sharedDriveId,
    mimeType: input.mimeType,
    content: input.fileBuffer,
  });

  // Defensive runtime check — GOOGLE-DRIVE-SECURITY-SPEC.md: "No public/anyone-
  // with-the-link sharing on any driver document file." This should never fire;
  // if it does, the permission is removed immediately and the event is audited.
  let publicSharingRemoved = false;
  try {
    await input.driveClient.assertNoPublicPermission(uploaded.id);
  } catch (error) {
    if (error instanceof DrivePublicSharingDetectedError) {
      publicSharingRemoved = true;
    } else {
      throw error;
    }
  }

  const now = new Date();
  const recordId = existing ? existing.id : new mongoose.Types.ObjectId().toString();

  let maskedDocumentNumber: string | undefined;
  let encryptedDocumentNumber: string | undefined;
  if (input.documentNumber) {
    maskedDocumentNumber = maskDocumentNumber(input.documentNumber, input.documentType);
    encryptedDocumentNumber = encryptDriverDocumentSecret(input.documentNumber, input.tenantId, recordId);
  }

  const accessClassification = DOCUMENT_TYPE_ACCESS_CLASSIFICATION[input.documentType];

  let document: IDriverDocument;
  if (existing) {
    const supersededVersion: IDriverDocumentVersion = {
      versionNumber: existing.currentVersionNumber,
      driveFileId: existing.driveFileId,
      driveFolderId: existing.driveFolderId,
      mimeType: existing.mimeType,
      sizeBytes: existing.sizeBytes,
      md5Checksum: existing.md5Checksum,
      sha256Checksum: existing.sha256Checksum,
      uploadedBy: existing.uploadedBy,
      uploadedAt: existing.uploadTime,
      verificationStatusAtSupersession: existing.verificationStatus,
      supersededAt: now,
      supersededBy: input.uploadedBy,
    };
    existing.versions.push(supersededVersion);
    existing.currentVersionNumber = nextVersionNumber;
    existing.driveFileId = uploaded.id;
    existing.driveFolderId = documentTypeFolderId;
    existing.mimeType = input.mimeType;
    existing.sizeBytes = input.fileBuffer.length;
    existing.md5Checksum = uploaded.md5Checksum;
    existing.sha256Checksum = sha256Checksum;
    existing.uploadedBy = input.uploadedBy;
    existing.uploadTime = now;
    // A new version is not self-verifying — reset to pending regardless of the
    // previous version's status (see spec: "an upload is not self-verifying").
    existing.verificationStatus = 'pending';
    existing.verifiedBy = undefined;
    existing.verificationTime = undefined;
    existing.verificationReason = undefined;
    if (input.issueDate) existing.issueDate = input.issueDate;
    if (input.expiryDate) existing.expiryDate = input.expiryDate;
    if (maskedDocumentNumber) existing.maskedDocumentNumber = maskedDocumentNumber;
    if (encryptedDocumentNumber) existing.encryptedDocumentNumber = encryptedDocumentNumber;
    existing.accessClassification = accessClassification;
    await existing.save();
    document = existing;
  } else {
    document = await DriverDocument.create({
      _id: recordId,
      tenantId: input.tenantId,
      driverId: input.driverId,
      documentType: input.documentType,
      // Always store the same normalized ('' when not applicable) value that
      // the findOne lookup above uses — MongoDB's compound unique index
      // otherwise sees a stored "field absent" as null, which a `{ label: '' }`
      // query never matches, breaking the find-existing-to-version-it path.
      label,
      encryptedDocumentNumber,
      maskedDocumentNumber,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      verificationStatus: 'pending',
      driveFileId: uploaded.id,
      driveFolderId: documentTypeFolderId,
      mimeType: input.mimeType,
      sizeBytes: input.fileBuffer.length,
      md5Checksum: uploaded.md5Checksum,
      sha256Checksum,
      uploadedBy: input.uploadedBy,
      uploadTime: now,
      currentVersionNumber: 1,
      versions: [],
      retentionStatus: 'active',
      accessClassification,
    });
  }

  await writeDriverDocumentAudit({
    tenantId: input.tenantId,
    userId: input.uploadedBy,
    action: existing ? 'document.replaced' : 'document.uploaded',
    driverId: input.driverId,
    documentId: document.id,
    newValue: { documentType: input.documentType, versionNumber: nextVersionNumber, sha256Checksum },
  });
  if (publicSharingRemoved) {
    await writeDriverDocumentAudit({
      tenantId: input.tenantId,
      userId: input.uploadedBy,
      action: 'document.public_sharing_removed',
      driverId: input.driverId,
      documentId: document.id,
      reason: 'A public ("anyone") permission was found on the uploaded Drive file immediately after upload and removed automatically.',
    });
  }

  return document;
}

export async function getTenantScopedDocument(tenantId: string, documentId: string): Promise<IDriverDocument | null> {
  if (!mongoose.isValidObjectId(documentId)) return null;
  return DriverDocument.findOne({ _id: documentId, tenantId });
}

export interface DocumentListView {
  id: string;
  driverId: string;
  documentType: DocumentType;
  label?: string;
  maskedDocumentNumber?: string;
  documentNumber?: string; // only present when caller has high-tier access AND doc is high-tier
  issueDate?: Date;
  expiryDate?: Date;
  verificationStatus: string;
  verificationReason?: string;
  verifiedBy?: string;
  verificationTime?: Date;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadTime: Date;
  currentVersionNumber: number;
  versionCount: number;
  retentionStatus: string;
  accessClassification: string;
  hasFileAccess: boolean; // whether THIS caller can hit the /file route for this doc
}

/** Maps a stored document to what a given caller may see. High-tier documents
 * (accessClassification === 'high') never expose the raw document number or
 * flag hasFileAccess=true unless the caller holds DRIVER_DOCUMENT_VIEW_HIGH —
 * metadata (existence/status/expiry) is always visible to any base viewer,
 * matching GOOGLE-DRIVE-SECURITY-SPEC.md's "Access classification" section. */
export function toDocumentListView(document: IDriverDocument, canViewHigh: boolean): DocumentListView {
  const isHighTier = document.accessClassification === 'high';
  const hasFileAccess = !isHighTier || canViewHigh;
  let documentNumber: string | undefined;
  if (hasFileAccess && document.encryptedDocumentNumber) {
    try {
      documentNumber = decryptDriverDocumentSecret<string>(document.encryptedDocumentNumber, String(document.tenantId), document.id);
    } catch {
      documentNumber = undefined;
    }
  }
  return {
    id: document.id,
    driverId: String(document.driverId),
    documentType: document.documentType,
    label: document.label,
    maskedDocumentNumber: document.maskedDocumentNumber,
    documentNumber,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    verificationStatus: document.verificationStatus,
    verificationReason: document.verificationReason,
    verifiedBy: document.verifiedBy,
    verificationTime: document.verificationTime,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedBy: document.uploadedBy,
    uploadTime: document.uploadTime,
    currentVersionNumber: document.currentVersionNumber,
    versionCount: document.versions.length + 1,
    retentionStatus: document.retentionStatus,
    accessClassification: document.accessClassification,
    hasFileAccess,
  };
}

export interface VerifyDocumentInput {
  tenantId: string;
  documentId: string;
  status: 'verified' | 'rejected';
  reason?: string;
  verifiedBy: string;
}

/** Verification is a distinct, permission-gated action from upload — see spec:
 * "an upload is not self-verifying." This function never touches uploadedBy/
 * uploadTime/driveFileId, only the verification-* fields. */
export async function verifyDriverDocument(input: VerifyDocumentInput): Promise<IDriverDocument | null> {
  const document = await getTenantScopedDocument(input.tenantId, input.documentId);
  if (!document) return null;
  document.verificationStatus = input.status;
  document.verifiedBy = input.verifiedBy;
  document.verificationTime = new Date();
  document.verificationReason = input.reason;
  await document.save();
  await writeDriverDocumentAudit({
    tenantId: input.tenantId,
    userId: input.verifiedBy,
    action: input.status === 'verified' ? 'document.verified' : 'document.rejected',
    driverId: String(document.driverId),
    documentId: document.id,
    reason: input.reason,
  });
  return document;
}

/** Moves every active document for a driver into retention_hold. Intended to be
 * called by the offboarding flow (owned by TASK-DRIVER-OPERATIONS-06, not this
 * task) — exposed here as the integration point rather than wired to an event,
 * since offboarding logic itself is out of this task's scope. Never deletes
 * anything — matches "offboarding does not trigger immediate document deletion." */
export async function setRetentionHoldForDriver(input: {
  tenantId: string;
  driverId: string;
  reason: string;
  actorUserId: string;
}): Promise<number> {
  const documents = await DriverDocument.find({ tenantId: input.tenantId, driverId: input.driverId, retentionStatus: 'active' });
  for (const document of documents) {
    document.retentionStatus = 'retention_hold';
    document.retentionHoldReason = input.reason;
    document.retentionHoldSetAt = new Date();
    await document.save();
  }
  if (documents.length > 0) {
    await writeDriverDocumentAudit({
      tenantId: input.tenantId,
      userId: input.actorUserId,
      action: 'document.retention_hold_set',
      driverId: input.driverId,
      reason: input.reason,
      newValue: { documentCount: documents.length },
    });
  }
  return documents.length;
}
