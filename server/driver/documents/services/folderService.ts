// Folder structure per GOOGLE-DRIVE-SECURITY-SPEC.md:
//   <Tenant Shared Drive>/FleetPro Driver Documents/<Driver ID>/<document-type>/
// Driver-scoped subfolders are named with the immutable Driver ID (Mongo
// ObjectId), never a mutable field like name/phone — per this task's acceptance
// criteria. Document-type subfolder names are exactly the DriverDocument.documentType
// enum values (DOCUMENT_TYPES in ../types.ts) — validated 1:1 against
// DRIVER-DOCUMENT-MATRIX.md.
import type { DriveClient } from '../drive/driveApiClient';
import type { ITenantGoogleDriveConnection } from '../models/tenantGoogleDriveConnection';
import type { DocumentType } from '../types';

/** Resolves (creating if needed) the tenant's root "FleetPro Driver Documents"
 * folder directly under the Shared Drive root. Idempotent. */
export async function ensureTenantRootFolder(client: DriveClient, connection: ITenantGoogleDriveConnection): Promise<string> {
  if (connection.rootFolderId) return connection.rootFolderId;
  const folderId = await client.ensureFolder(connection.rootFolderName, connection.sharedDriveId, connection.sharedDriveId);
  return folderId;
}

/** Resolves (creating if needed) <root>/<driverId>/ — named with the immutable
 * Mongo ObjectId, not the driver's (mutable) name or phone. */
export async function ensureDriverFolder(
  client: DriveClient,
  sharedDriveId: string,
  rootFolderId: string,
  driverId: string,
): Promise<string> {
  return client.ensureFolder(driverId, rootFolderId, sharedDriveId);
}

/** Resolves (creating if needed) <root>/<driverId>/<documentType>/. */
export async function ensureDocumentTypeFolder(
  client: DriveClient,
  sharedDriveId: string,
  driverFolderId: string,
  documentType: DocumentType,
): Promise<string> {
  return client.ensureFolder(documentType, driverFolderId, sharedDriveId);
}

/** Full resolve in one call — used by the upload route. */
export async function resolveDocumentFolder(
  client: DriveClient,
  connection: ITenantGoogleDriveConnection,
  driverId: string,
  documentType: DocumentType,
): Promise<{ rootFolderId: string; driverFolderId: string; documentTypeFolderId: string }> {
  const rootFolderId = await ensureTenantRootFolder(client, connection);
  const driverFolderId = await ensureDriverFolder(client, connection.sharedDriveId, rootFolderId, driverId);
  const documentTypeFolderId = await ensureDocumentTypeFolder(client, connection.sharedDriveId, driverFolderId, documentType);
  return { rootFolderId, driverFolderId, documentTypeFolderId };
}
