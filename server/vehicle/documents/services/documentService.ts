import mongoose from 'mongoose';
import { computeComplianceStatus, type ComplianceStatusOptions, type ComplianceStatusResult } from '../complianceStatus';
import { VehicleDocument, type IVehicleDocument } from '../models/vehicleDocument';
import type { ApplicabilityContext, VehicleDocumentType } from '../types';
import {
  unconfiguredFileStore,
  type VehicleDocumentFileStore,
  type VehicleDocumentUpload,
} from '../driveConnection';

export interface RecordDocumentInput {
  tenantId: string;
  vehicleId: string;
  documentType: VehicleDocumentType;
  label?: string;
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: Date;
  expiryDate?: Date;
  reminderDaysBeforeExpiry?: number;
  actor: string;
}

/** Creates or replaces the record for (vehicle, documentType[, label]) —
 * "replaces" because this registry tracks the *current* state of each
 * document type per vehicle, with `versions[]` preserving prior file
 * attachments' history (see supersedeVersion below), not prior *metadata*
 * edits — matching the driver module's same "current record + version
 * history for files" shape. */
export async function recordVehicleDocument(input: RecordDocumentInput): Promise<IVehicleDocument> {
  if (!mongoose.isValidObjectId(input.vehicleId)) {
    throw new Error('recordVehicleDocument requires a valid vehicleId.');
  }
  const filter = {
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    documentType: input.documentType,
    label: input.label,
    isDeleted: false,
  };
  const existing = await VehicleDocument.findOne(filter);
  if (existing) {
    existing.documentNumber = input.documentNumber;
    existing.issuingAuthority = input.issuingAuthority;
    existing.issueDate = input.issueDate;
    existing.expiryDate = input.expiryDate;
    existing.reminderDaysBeforeExpiry = input.reminderDaysBeforeExpiry;
    existing.updatedBy = input.actor;
    // Editing metadata resets verification — a changed expiry/number must be
    // re-verified, never silently inherit the prior verification.
    existing.verificationStatus = 'pending';
    existing.verificationReason = undefined;
    existing.verifiedBy = undefined;
    existing.verificationTime = undefined;
    await existing.save();
    return existing;
  }
  return VehicleDocument.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    documentType: input.documentType,
    label: input.label,
    documentNumber: input.documentNumber,
    issuingAuthority: input.issuingAuthority,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    reminderDaysBeforeExpiry: input.reminderDaysBeforeExpiry,
    createdBy: input.actor,
    updatedBy: input.actor,
  });
}

export async function verifyVehicleDocument(
  tenantId: string,
  documentId: string,
  outcome: 'verified' | 'rejected',
  verifiedBy: string,
  reason?: string,
): Promise<IVehicleDocument | null> {
  const doc = await VehicleDocument.findOne({ _id: documentId, tenantId, isDeleted: false });
  if (!doc) return null;
  doc.verificationStatus = outcome;
  doc.verificationReason = reason;
  doc.verifiedBy = verifiedBy;
  doc.verificationTime = new Date();
  doc.updatedBy = verifiedBy;
  await doc.save();
  return doc;
}

/** Attaches/replaces the file for an already-recorded document. Superseded
 * versions move into `versions[]` with their verification state frozen at
 * supersession time, exactly mirroring DriverDocument's same pattern —
 * never overwritten after the fact. Throws
 * VehicleDocumentFileStoreNotConfiguredError via the injected `fileStore`
 * until the Integrator wires a real one in (see driveConnection.ts). */
export async function attachVehicleDocumentFile(
  tenantId: string,
  documentId: string,
  upload: Omit<VehicleDocumentUpload, 'tenantId' | 'vehicleId'>,
  actor: string,
  fileStore: VehicleDocumentFileStore = unconfiguredFileStore,
): Promise<IVehicleDocument | null> {
  const doc = await VehicleDocument.findOne({ _id: documentId, tenantId, isDeleted: false });
  if (!doc) return null;

  const uploaded = await fileStore.upload({ ...upload, tenantId, vehicleId: String(doc.vehicleId) });

  if (doc.driveFileId) {
    doc.versions.push({
      versionNumber: doc.currentVersionNumber,
      driveFileId: doc.driveFileId,
      driveFolderId: doc.driveFolderId,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      sha256Checksum: doc.sha256Checksum,
      uploadedBy: doc.uploadedBy!,
      uploadedAt: doc.uploadTime!,
      verificationStatusAtSupersession: doc.verificationStatus,
      supersededAt: new Date(),
      supersededBy: actor,
    });
    doc.currentVersionNumber += 1;
  }
  doc.driveFileId = uploaded.driveFileId;
  doc.driveFolderId = uploaded.driveFolderId;
  doc.mimeType = upload.mimeType;
  doc.sizeBytes = uploaded.sizeBytes;
  doc.sha256Checksum = uploaded.sha256Checksum;
  doc.uploadedBy = actor;
  doc.uploadTime = new Date();
  // A re-uploaded file must be re-verified, same reasoning as metadata edits.
  doc.verificationStatus = 'pending';
  doc.updatedBy = actor;
  await doc.save();
  return doc;
}

export async function listVehicleDocuments(tenantId: string, vehicleId: string): Promise<IVehicleDocument[]> {
  return VehicleDocument.find({ tenantId, vehicleId, isDeleted: false }).sort({ documentType: 1 });
}

/** Ties the stored documents to the pure `computeComplianceStatus` function
 * — the only place this module touches the database for the compliance
 * computation; the actual derivation logic remains fully pure/testable. */
export async function getVehicleComplianceStatus(
  tenantId: string,
  vehicleId: string,
  ctx: ApplicabilityContext,
  options?: ComplianceStatusOptions,
): Promise<ComplianceStatusResult> {
  const docs = await listVehicleDocuments(tenantId, vehicleId);
  return computeComplianceStatus(
    docs.map((d) => ({ documentType: d.documentType, expiryDate: d.expiryDate, verified: d.verificationStatus === 'verified' })),
    ctx,
    options,
  );
}
