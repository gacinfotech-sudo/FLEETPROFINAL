import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { DriverDocument } from '../../server/driver/documents/models/driverDocument';
import { TenantGoogleDriveConnection } from '../../server/driver/documents/models/tenantGoogleDriveConnection';
import { encryptDriverDocumentSecret } from '../../server/driver/documents/security/documentEncryption';
import { setDriveClientFactoryForTesting } from '../../server/driver/documents/drive/clientFactory';
import type { DriveClient, DriveFileMetadata, DrivePermission } from '../../server/driver/documents/drive/driveApiClient';
import { uploadHandoverConditionPhoto } from '../../server/driver/handover/documentIntegration';

// TASK-VEHICLE-HANDOVER-05 — proves condition photos genuinely route through
// TASK-DRIVER-DOCUMENTS-03's document registry (not a second storage
// mechanism), and land with a real, non-public, non-unclassified
// accessClassification. Service-level + stubbed Drive client, same testing
// approach TASK-DRIVER-DOCUMENTS-03's own suite uses (no real Google Drive
// credentials exist in this sandbox — see that task's report's "verified
// live vs mock-only" section). Does NOT go through HTTP/multer; exercises
// the real uploadDriverDocument()/DriverDocument model/encryption path.

function buildStubDriveClient(): DriveClient {
  let counter = 0;
  const files: DriveFileMetadata[] = [];
  return {
    async ensureFolder(name, parentId) {
      return `folder:${parentId}/${name}`;
    },
    async uploadFile(params) {
      counter += 1;
      const meta: DriveFileMetadata = {
        id: `handover-stub-file-${counter}`,
        name: params.name,
        mimeType: params.mimeType,
        md5Checksum: `fake-md5-${counter}`,
        size: String(params.content.length),
        parents: [params.parentId],
      };
      files.push(meta);
      return meta;
    },
    async getFileMetadata(fileId) {
      const found = files.find((f) => f.id === fileId);
      if (!found) throw new Error(`unknown fileId ${fileId}`);
      return found;
    },
    async downloadFile(fileId) {
      return Buffer.from(`stub-bytes-${fileId}`);
    },
    async listPermissions(): Promise<DrivePermission[]> {
      return [];
    },
    async deletePermission() {},
    async assertNoPublicPermission() {},
    async getSharedDriveMetadata(sharedDriveId) {
      return { id: sharedDriveId, name: 'Stub Shared Drive' };
    },
  };
}

test.describe('Vehicle handover — condition photos route through the document registry', () => {
  test('a condition photo becomes a real DriverDocument, tagged to the handover (not the driver persistent set), with a safe accessClassification', async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
    await mongoose.connect(process.env.MONGODB_URI);
    try {
      const tenantId = new mongoose.Types.ObjectId().toString();
      const driverId = new mongoose.Types.ObjectId().toString();
      const connectionId = new mongoose.Types.ObjectId();

      const encryptedCredentials = encryptDriverDocumentSecret(
        { authType: 'service_account', serviceAccountKey: { type: 'service_account', project_id: 'x', private_key_id: 'x', private_key: 'x', client_email: 'x@x.iam.gserviceaccount.com', client_id: 'x' } },
        tenantId,
        connectionId.toString(),
      );
      await TenantGoogleDriveConnection.create({
        _id: connectionId,
        tenantId,
        connectionName: 'Test Connection',
        authType: 'service_account',
        sharedDriveId: 'stub-shared-drive',
        rootFolderName: 'FleetPro Driver Documents',
        enabled: true,
        status: 'connected',
        encryptedCredentials,
        credentialFields: ['serviceAccountKeyJson'],
        createdBy: 'test',
        updatedBy: 'test',
      });

      setDriveClientFactoryForTesting(() => buildStubDriveClient());
      try {
        const handoverIdA = new mongoose.Types.ObjectId().toString();
        const handoverIdB = new mongoose.Types.ObjectId().toString();

        const photoA = await uploadHandoverConditionPhoto({
          tenantId, driverId, handoverId: handoverIdA, angle: 'front', index: 0,
          fileBuffer: Buffer.from('fake-jpeg-bytes-a'), mimeType: 'image/jpeg', uploadedBy: 'test-staff',
        });
        const photoB = await uploadHandoverConditionPhoto({
          tenantId, driverId, handoverId: handoverIdB, angle: 'front', index: 0,
          fileBuffer: Buffer.from('fake-jpeg-bytes-b'), mimeType: 'image/jpeg', uploadedBy: 'test-staff',
        });

        // Two DIFFERENT handovers for the SAME driver, same angle/index —
        // must produce two DISTINCT DriverDocument records, not one document
        // versioned twice. This is the exact "tagged to the handover, not
        // the driver's persistent document set" requirement.
        expect(photoA.documentId).not.toBe(photoB.documentId);

        const docA = await DriverDocument.findById(photoA.documentId);
        const docB = await DriverDocument.findById(photoB.documentId);
        expect(docA).toBeTruthy();
        expect(docB).toBeTruthy();
        expect(docA!.currentVersionNumber).toBe(1);
        expect(docB!.currentVersionNumber).toBe(1);
        expect(docA!.documentType).toBe('other');

        // Never silently public, never silently unclassified.
        expect(docA!.accessClassification).toBeTruthy();
        expect(docA!.accessClassification).not.toBe('public' as any);
        expect(['standard', 'medium', 'high']).toContain(docA!.accessClassification);

        // A second photo for the SAME handover + same angle DOES version the
        // same record (intra-handover replace/correction is legitimate
        // versioning, unlike cross-handover collision).
        const photoA2 = await uploadHandoverConditionPhoto({
          tenantId, driverId, handoverId: handoverIdA, angle: 'front', index: 0,
          fileBuffer: Buffer.from('fake-jpeg-bytes-a-corrected'), mimeType: 'image/jpeg', uploadedBy: 'test-staff',
        });
        expect(photoA2.documentId).toBe(photoA.documentId);
        const docA2 = await DriverDocument.findById(photoA2.documentId);
        expect(docA2!.currentVersionNumber).toBe(2);
        expect(docA2!.versions.length).toBe(1);
      } finally {
        setDriveClientFactoryForTesting(null);
        await TenantGoogleDriveConnection.deleteOne({ _id: connectionId });
        await DriverDocument.deleteMany({ tenantId });
      }
    } finally {
      await mongoose.disconnect();
    }
  });
});
