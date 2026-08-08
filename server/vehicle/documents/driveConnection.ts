// Documented integration contract for the tenant's Google Drive connection —
// deliberately NOT importing server/driver/documents/models/
// tenantGoogleDriveConnection.ts, drive/driveApiClient.ts, etc. Those live in
// the unmerged `driver-google-documents` worktree; per this batch's manifest
// ("must design against the documented contract in the research docs, not a
// live import, since branching off those specific worktrees would create its
// own coordination problem"), this module defines the shape the real
// implementation must satisfy and the Integrator wires the concrete
// implementation once both branches share one trunk.
//
// Confirmed via direct read of tenantGoogleDriveConnection.ts (read-only
// reference) that its connection model is already tenant-scoped, not
// driver-scoped (`{ tenantId, connectionName, sharedDriveId, rootFolderId,
// encryptedCredentials, ... }`, one connection per tenant via a
// `{tenantId:1}` unique index) — so the correct integration is REUSE, not a
// second OAuth/connection flow, satisfying this task's scope instruction to
// prefer reuse when the existing connection is generic enough.

export interface VehicleDocumentUpload {
  vehicleId: string;
  tenantId: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface UploadedFileReference {
  driveFileId: string;
  driveFolderId: string;
  sizeBytes: number;
  sha256Checksum: string;
}

/**
 * The interface a real Drive-backed implementation must satisfy. Once
 * `driver-google-documents` merges, the Integrator implements this by
 * calling `TenantGoogleDriveConnection` + the existing `driveApiClient`
 * (resolving/creating a "FleetPro Vehicle Documents" subfolder under the
 * tenant's existing `rootFolderId`, exactly mirroring how the driver module
 * resolves its own subfolder) rather than a second OAuth flow.
 */
export interface VehicleDocumentFileStore {
  upload(input: VehicleDocumentUpload): Promise<UploadedFileReference>;
  delete(driveFileId: string): Promise<void>;
}

export class VehicleDocumentFileStoreNotConfiguredError extends Error {
  constructor() {
    super(
      'Vehicle document file storage is not wired yet — this is expected until ' +
      'the driver-google-documents branch merges and the Integrator applies the ' +
      'proposed VehicleDocumentFileStore implementation (see this task\'s report). ' +
      'Document metadata (number/dates/verification) can still be recorded without ' +
      'an attached file.',
    );
    this.name = 'VehicleDocumentFileStoreNotConfiguredError';
  }
}

/** Until the real implementation is wired in, throws a clear, typed error
 * rather than silently no-op'ing or fabricating a fake file reference —
 * callers (documentService.ts) only need this for the optional
 * file-attachment step, never for the core compliance-record CRUD. */
export const unconfiguredFileStore: VehicleDocumentFileStore = {
  async upload() {
    throw new VehicleDocumentFileStoreNotConfiguredError();
  },
  async delete() {
    throw new VehicleDocumentFileStoreNotConfiguredError();
  },
};
