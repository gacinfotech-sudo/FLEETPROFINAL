import type { Express, NextFunction, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { fileTypeFromBuffer } from 'file-type';
import { authenticateUser, requireTenant, type AuthRequest } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permissions';
import { storage } from '../../../storage-mongodb';
import { Driver } from '../../../models/index';
import { DRIVER_DOCUMENT_PERMISSIONS } from '../permissions';
import { DriverDocument } from '../models/driverDocument';
import { isDocumentType } from '../types';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  DriveConnectionNotConfiguredError,
  getTenantScopedDocument,
  toDocumentListView,
  uploadDriverDocument,
  verifyDriverDocument,
} from '../services/documentService';
import { decryptDriveCredentials, resolveTenantDriveConnection } from '../services/connectionService';
import { buildDriveClient } from '../drive/clientFactory';
import { serveDriverDocumentFile } from '../services/fileServing';
import { uploadDocumentFieldsSchema, verifyDocumentSchema } from '../validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — generous for a scanned document/photo
});

const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many document uploads. Please try again later.' },
});

function tenantContext(req: AuthRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required.' });
    return null;
  }
  return req.tenantId;
}

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

async function assertDriverInTenant(tenantId: string, driverId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(driverId)) return false;
  return Boolean(await Driver.exists({ _id: driverId, tenantId }));
}

// P0 SECURITY (same pattern as server/routes.ts's verifyUploadedImage — a
// client-supplied Content-Type/filename can lie; the real file bytes are
// sniffed after upload and rejected if they don't match an allow-listed type).
async function sniffAllowedMimeType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_DOCUMENT_MIME_TYPES.includes(detected.mime)) return null;
  return detected.mime;
}

export function registerDriverDocumentRoutes(app: Express): void {
  app.post(
    '/api/drivers/:driverId/documents',
    uploadRateLimit,
    authenticateUser,
    requireTenant,
    requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_MANAGE),
    upload.single('file'),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      const driverId = req.params.driverId;
      if (!(await assertDriverInTenant(tenantId, driverId))) {
        return res.status(404).json({ message: 'Driver not found.' });
      }
      if (!req.file) return res.status(400).json({ message: 'A file is required.' });

      let fields;
      try {
        fields = uploadDocumentFieldsSchema.parse(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues.map((i) => i.message).join('; ') });
        throw error;
      }

      const sniffedMime = await sniffAllowedMimeType(req.file.buffer);
      if (!sniffedMime) {
        return res.status(400).json({ message: 'Unsupported or unrecognized file type. Allowed: PDF, JPEG, PNG, WEBP.' });
      }

      const connection = await resolveTenantDriveConnection(tenantId);
      if (!connection || !connection.enabled) {
        return res.status(503).json({ message: 'This tenant has no enabled Google Drive connection configured. Set one up before uploading documents.' });
      }
      const credentials = decryptDriveCredentials(connection.encryptedCredentials, tenantId, connection.id);
      if (!credentials) {
        return res.status(503).json({ message: 'Google Drive credentials are not configured.' });
      }

      try {
        const driveClient = buildDriveClient(credentials);
        const document = await uploadDriverDocument({
          tenantId,
          driverId,
          documentType: fields.documentType,
          label: fields.label,
          documentNumber: fields.documentNumber,
          issueDate: fields.issueDate ? new Date(fields.issueDate) : undefined,
          expiryDate: fields.expiryDate ? new Date(fields.expiryDate) : undefined,
          fileBuffer: req.file.buffer,
          mimeType: sniffedMime,
          uploadedBy: req.userId!,
          driveClient,
          connection,
        });
        res.status(201).json(toDocumentListView(document, true));
      } catch (error: any) {
        if (error instanceof DriveConnectionNotConfiguredError) {
          return res.status(503).json({ message: error.message });
        }
        if (error?.code === 11000) {
          return res.status(409).json({ message: 'A document of this type already exists for this driver — upload again to replace it, this endpoint should have found and versioned it.' });
        }
        res.status(502).json({ message: 'Failed to upload the document to Google Drive.' });
      }
    }),
  );

  app.get(
    '/api/drivers/:driverId/documents',
    authenticateUser,
    requireTenant,
    requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      const driverId = req.params.driverId;
      if (!(await assertDriverInTenant(tenantId, driverId))) {
        return res.status(404).json({ message: 'Driver not found.' });
      }
      const canViewHigh = await storageCheckPermission(req, DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW_HIGH);
      const documents = await DriverDocument.find({ tenantId, driverId }).sort({ documentType: 1 });
      res.json(documents.map((d) => toDocumentListView(d, canViewHigh)));
    }),
  );

  app.get(
    '/api/driver-documents/:documentId',
    authenticateUser,
    requireTenant,
    requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      const document = await getTenantScopedDocument(tenantId, req.params.documentId);
      if (!document) return res.status(404).json({ message: 'Document not found.' });
      const canViewHigh = await storageCheckPermission(req, DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW_HIGH);
      res.json(toDocumentListView(document, canViewHigh));
    }),
  );

  app.post(
    '/api/driver-documents/:documentId/verify',
    authenticateUser,
    requireTenant,
    requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VERIFY),
    safeAsync(async (req, res) => {
      const tenantId = tenantContext(req, res);
      if (!tenantId) return;
      let input;
      try {
        input = verifyDocumentSchema.parse(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues.map((i) => i.message).join('; ') });
        throw error;
      }
      const document = await verifyDriverDocument({
        tenantId,
        documentId: req.params.documentId,
        status: input.status,
        reason: input.reason,
        verifiedBy: req.userId!,
      });
      if (!document) return res.status(404).json({ message: 'Document not found.' });
      const canViewHigh = await storageCheckPermission(req, DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW_HIGH);
      res.json(toDocumentListView(document, canViewHigh));
    }),
  );

  // GET .../file streams the actual bytes; ?download=1 sets a Content-Disposition
  // of "attachment" instead of "inline" — both paths are authenticated,
  // permission-checked, tenant-scoped, tier-checked and audit-logged. No route
  // anywhere in this module ever returns a bare Drive link.
  app.get(
    '/api/driver-documents/:documentId/file',
    authenticateUser,
    requireTenant,
    requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW),
    safeAsync(async (req, res) => {
      const canViewHigh = await storageCheckPermission(req, DRIVER_DOCUMENT_PERMISSIONS.DRIVER_DOCUMENT_VIEW_HIGH);
      await serveDriverDocumentFile(req, res, {
        documentId: req.params.documentId,
        canViewHigh,
        download: req.query.download === '1' || req.query.download === 'true',
      });
    }),
  );
}

// requirePermission already gates the *base* view permission via middleware;
// this extra check for the *high*-tier permission is intentionally done inline
// (not as a second requirePermission middleware) because it's optional —
// Standard/Medium-tier documents must remain visible to a base viewer even
// though that same viewer lacks DRIVER_DOCUMENT_VIEW_HIGH.
async function storageCheckPermission(req: AuthRequest, permission: string): Promise<boolean> {
  if (!req.userId) return false;
  return storage.checkUserPermission(req.userId, permission);
}
