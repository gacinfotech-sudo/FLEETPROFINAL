import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { DriverDocument } from '../../server/driver/documents/models/driverDocument';
import { DriverDocumentAuditLog } from '../../server/driver/documents/models/driverDocumentAuditLog';
import {
  uploadDriverDocument,
  verifyDriverDocument,
  toDocumentListView,
  setRetentionHoldForDriver,
} from '../../server/driver/documents/services/documentService';
import { DOCUMENT_TYPES } from '../../server/driver/documents/types';
import { DrivePublicSharingDetectedError, type DriveClient, type DriveFileMetadata, type DrivePermission } from '../../server/driver/documents/drive/driveApiClient';

// This spec runs entirely against the real (test) MongoDB and this module's
// real service functions — it does NOT go through HTTP or a running dev
// server, and it does NOT talk to real Google Drive (no live credentials exist
// in this sandboxed environment; see the task report's "verified live vs
// mock-only" section). The DriveClient dependency is passed as an explicit
// function parameter to uploadDriverDocument (see services/documentService.ts),
// so a stub satisfying the exact same interface as the real
// GoogleDriveRestClient exercises 100% of the real business logic — version
// history, verification independence, masking, audit logging, retention — with
// only the actual Drive HTTP calls replaced.
function buildStubDriveClient(options: { forcePublicPermissionOnce?: boolean } = {}) {
  const ensureFolderCalls: { name: string; parentId: string; sharedDriveId: string }[] = [];
  const uploadedFiles: DriveFileMetadata[] = [];
  let uploadCounter = 0;
  let publicPermissionAlreadyForced = false;

  const client: DriveClient = {
    async ensureFolder(name, parentId, sharedDriveId) {
      ensureFolderCalls.push({ name, parentId, sharedDriveId });
      return `folder:${parentId}/${name}`;
    },
    async uploadFile(params) {
      uploadCounter += 1;
      const meta: DriveFileMetadata = {
        id: `drive-file-${uploadCounter}`,
        name: params.name,
        mimeType: params.mimeType,
        md5Checksum: `fake-md5-${uploadCounter}`,
        size: String(params.content.length),
        parents: [params.parentId],
      };
      uploadedFiles.push(meta);
      return meta;
    },
    async getFileMetadata(fileId) {
      const found = uploadedFiles.find((f) => f.id === fileId);
      if (!found) throw new Error(`stub: unknown fileId ${fileId}`);
      return found;
    },
    async downloadFile(fileId) {
      return Buffer.from(`stub-bytes-for-${fileId}`);
    },
    async listPermissions(_fileId): Promise<DrivePermission[]> {
      if (options.forcePublicPermissionOnce && !publicPermissionAlreadyForced) {
        return [{ id: 'perm-anyone-1', type: 'anyone', role: 'reader' }];
      }
      return [];
    },
    async deletePermission() {
      publicPermissionAlreadyForced = true;
    },
    async assertNoPublicPermission(fileId) {
      const permissions = await client.listPermissions(fileId);
      const publicPermissions = permissions.filter((p) => p.type === 'anyone');
      if (publicPermissions.length === 0) return;
      await Promise.all(publicPermissions.map((p) => client.deletePermission(fileId, p.id)));
      throw new DrivePublicSharingDetectedError(fileId, publicPermissions.map((p) => p.id));
    },
    async getSharedDriveMetadata(sharedDriveId) {
      return { id: sharedDriveId, name: 'Stub Shared Drive' };
    },
  };
  return { client, ensureFolderCalls, uploadedFiles };
}

const fakeConnection = {
  sharedDriveId: 'stub-shared-drive-id',
  rootFolderName: 'FleetPro Driver Documents',
  rootFolderId: undefined,
} as any;

test.describe('Driver document lifecycle (service-level, stubbed Drive client)', () => {
  test('upload creates version history (never overwrites), verify is independent of upload, masking/tier logic is correct, folder names match the documentType enum, retention hold never deletes', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const { client, ensureFolderCalls } = buildStubDriveClient();

      const v1 = await uploadDriverDocument({
        tenantId,
        driverId,
        documentType: 'identity_proof',
        documentNumber: '123456789012',
        fileBuffer: Buffer.from('pdf-bytes-v1'),
        mimeType: 'application/pdf',
        uploadedBy: 'svc-test-uploader',
        driveClient: client,
        connection: fakeConnection,
      });
      expect(v1.currentVersionNumber).toBe(1);
      expect(v1.versions).toHaveLength(0);
      expect(v1.accessClassification).toBe('high');
      expect(v1.maskedDocumentNumber).toBe('XXXX XXXX 9012');
      expect(v1.verificationStatus).toBe('pending');

      // Folder-structure document-type names must match the documentType enum
      // exactly (acceptance criterion) — the document-type-level ensureFolder
      // call must have used the literal enum value.
      const documentTypeFolderCall = ensureFolderCalls.find((c) => c.name === 'identity_proof');
      expect(documentTypeFolderCall, JSON.stringify(ensureFolderCalls)).toBeTruthy();
      expect(DOCUMENT_TYPES).toContain('identity_proof');
      // Driver-scoped folder is named with the immutable driver id, never a
      // mutable field like name/phone.
      expect(ensureFolderCalls.some((c) => c.name === driverId)).toBe(true);

      // Verification is a distinct action — never touches upload fields.
      const verified = await verifyDriverDocument({ tenantId, documentId: v1.id, status: 'verified', verifiedBy: 'reviewer-1' });
      expect(verified!.verificationStatus).toBe('verified');
      expect(verified!.verifiedBy).toBe('reviewer-1');
      expect(verified!.uploadedBy).toBe('svc-test-uploader');
      expect(verified!.driveFileId).toBe(v1.driveFileId);

      // Replacing the document must preserve the old version, not overwrite it.
      const v2 = await uploadDriverDocument({
        tenantId,
        driverId,
        documentType: 'identity_proof',
        documentNumber: '123456789012',
        fileBuffer: Buffer.from('pdf-bytes-v2-longer-content'),
        mimeType: 'application/pdf',
        uploadedBy: 'svc-test-uploader-2',
        driveClient: client,
        connection: fakeConnection,
      });
      expect(v2.currentVersionNumber).toBe(2);
      expect(v2.versions).toHaveLength(1);
      expect(v2.versions[0].driveFileId).toBe(v1.driveFileId);
      expect(v2.versions[0].verificationStatusAtSupersession).toBe('verified');
      expect(v2.driveFileId).not.toBe(v1.driveFileId);
      // A new version is not self-verifying.
      expect(v2.verificationStatus).toBe('pending');
      expect(v2.verifiedBy).toBeUndefined();

      // Tier-gated view: a caller without the High-tier permission never sees
      // the raw (decrypted) document number, only the masked form; a caller
      // with it does.
      const lowTierView = toDocumentListView(v2, false);
      expect(lowTierView.hasFileAccess).toBe(false);
      expect(lowTierView.documentNumber).toBeUndefined();
      expect(lowTierView.maskedDocumentNumber).toBe('XXXX XXXX 9012');
      const highTierView = toDocumentListView(v2, true);
      expect(highTierView.hasFileAccess).toBe(true);
      expect(highTierView.documentNumber).toBe('123456789012');

      // Every upload/verify writes an audit entry, in order.
      const auditActions = (await DriverDocumentAuditLog.find({ tenantId, documentId: v1.id }).sort({ createdAt: 1 }).lean())
        .map((a) => a.action);
      expect(auditActions).toEqual(['document.uploaded', 'document.verified', 'document.replaced']);

      // Offboarding-style retention hold must never delete the document.
      const heldCount = await setRetentionHoldForDriver({ tenantId, driverId, reason: 'driver offboarded', actorUserId: 'ops-1' });
      expect(heldCount).toBe(1);
      const stillThere = await DriverDocument.findById(v2.id);
      expect(stillThere).toBeTruthy();
      expect(stillThere!.retentionStatus).toBe('retention_hold');
      expect(stillThere!.driveFileId).toBe(v2.driveFileId);
    } finally {
      await mongoose.disconnect();
    }
  });

  test('a public ("anyone") Drive permission found right after upload is removed automatically and audited — it must never happen, but the code does not just assume it won\'t', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const { client } = buildStubDriveClient({ forcePublicPermissionOnce: true });

      const doc = await uploadDriverDocument({
        tenantId,
        driverId,
        documentType: 'photograph',
        fileBuffer: Buffer.from('jpeg-bytes'),
        mimeType: 'image/jpeg',
        uploadedBy: 'svc-test-uploader',
        driveClient: client,
        connection: fakeConnection,
      });
      const actions = (await DriverDocumentAuditLog.find({ tenantId, documentId: doc.id }).sort({ createdAt: 1 }).lean())
        .map((a) => a.action);
      expect(actions).toContain('document.public_sharing_removed');
    } finally {
      await mongoose.disconnect();
    }
  });

  test('an "other" document requires a human-readable label, never just the raw filename', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const { client } = buildStubDriveClient();
      await expect(uploadDriverDocument({
        tenantId,
        driverId,
        documentType: 'other',
        fileBuffer: Buffer.from('bytes'),
        mimeType: 'application/pdf',
        uploadedBy: 'svc-test-uploader',
        driveClient: client,
        connection: fakeConnection,
      })).rejects.toThrow(/label is required/);
    } finally {
      await mongoose.disconnect();
    }
  });
});
