// Routes condition photos through TASK-DRIVER-DOCUMENTS-03's document
// registry (server/driver/documents/**) instead of building a second
// storage mechanism, per this task's explicit instruction.
//
// Why documentType 'other' + a handover-derived label, not the matrix's
// 'vehicle_handover_acknowledgement' type: uploadDriverDocument() keys its
// "is this a new document or a new version of an existing one" lookup on
// (tenantId, driverId, documentType, label), and for every documentType
// except 'other' the label is forced to '' (server/driver/documents/services/
// documentService.ts: `const label = input.documentType === 'other' ? ... : '';`).
// That means using 'vehicle_handover_acknowledgement' directly would make
// EVERY handover's condition photo for the same driver collide into one
// evolving version chain — the opposite of "tagged to the handover, not the
// driver's persistent document set" this task's file explicitly requires.
// 'other' is the only documentType that accepts a caller-supplied label, so a
// label of `handover:<handoverId>:<angle>:<index>` gives each photo (and each
// handover) its own distinct, never-collapsed DriverDocument record while
// still going through the exact same registry, encryption, versioning,
// audit-log and access-classification machinery as every other driver
// document. accessClassification for 'other' is 'medium' (never 'public',
// never left unclassified) per DOCUMENT_TYPE_ACCESS_CLASSIFICATION — see this
// task's report for why 'medium' (not 'standard') is the correct, deliberate
// choice for a handover condition photo.
import { uploadDriverDocument, DriveConnectionNotConfiguredError } from '../documents/services/documentService';
import { resolveTenantDriveConnection, decryptDriveCredentials } from '../documents/services/connectionService';
import { buildDriveClient } from '../documents/drive/clientFactory';
import type { ConditionPhotoRef } from './types';

export { DriveConnectionNotConfiguredError };

export interface HandoverPhotoUploadInput {
  tenantId: string;
  driverId: string;
  handoverId: string;
  angle: ConditionPhotoRef['angle'];
  index: number;
  fileBuffer: Buffer;
  mimeType: string;
  uploadedBy: string;
}

function handoverPhotoLabel(handoverId: string, angle: string, index: number): string {
  return `handover:${handoverId}:${angle}:${index}`;
}

/** Uploads one condition photo through Documents-03's registry and returns a
 * ConditionPhotoRef pointing at the resulting DriverDocument. Throws
 * DriveConnectionNotConfiguredError if the tenant has no enabled Drive
 * connection — callers decide whether that's fatal to the handover itself
 * (it is not, per this module's design: photos are optional at creation
 * time and can be attached after the fact once Drive is configured). */
export async function uploadHandoverConditionPhoto(input: HandoverPhotoUploadInput): Promise<ConditionPhotoRef> {
  const connection = await resolveTenantDriveConnection(input.tenantId);
  if (!connection || !connection.enabled) {
    throw new DriveConnectionNotConfiguredError();
  }
  const credentials = decryptDriveCredentials((connection as any).encryptedCredentials, input.tenantId, connection.id);
  if (!credentials) {
    throw new DriveConnectionNotConfiguredError();
  }
  const driveClient = buildDriveClient(credentials);
  const document = await uploadDriverDocument({
    tenantId: input.tenantId,
    driverId: input.driverId,
    documentType: 'other',
    label: handoverPhotoLabel(input.handoverId, input.angle, input.index),
    fileBuffer: input.fileBuffer,
    mimeType: input.mimeType,
    uploadedBy: input.uploadedBy,
    driveClient,
    connection,
  });
  return { documentId: document.id, angle: input.angle, takenAt: new Date() };
}
