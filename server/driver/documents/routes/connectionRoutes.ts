// Tenant Google Drive connection CRUD — mirrors server/gps/routes/connections.ts's
// shape (rate limits, tenant scoping, credential redaction, audit-on-every-change).
import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../../middleware/auth';
import { requirePermission } from '../../../middleware/permissions';
import { DRIVER_DOCUMENT_PERMISSIONS } from '../permissions';
import { TenantGoogleDriveConnection } from '../models/tenantGoogleDriveConnection';
import {
  configuredCredentialFields,
  decryptDriveCredentials,
  encryptDriveCredentials,
  publicDriveConnection,
  writeDriverDocumentAudit,
} from '../services/connectionService';
import { DriverDocumentEncryptionConfigurationError } from '../security/documentEncryption';
import { buildDriveClient } from '../drive/clientFactory';
import { createDriveConnectionSchema, updateDriveConnectionSchema, rotateDriveCredentialsSchema } from '../validation';

const manageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many Google Drive connection changes. Please try again later.' },
});
const testRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many Google Drive connection tests. Please try again later.' },
});

function tenantContext(req: AuthRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required for a Google Drive connection.' });
    return null;
  }
  return req.tenantId;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join('; ');
  return 'Google Drive connection request failed.';
}

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function registerGoogleDriveConnectionRoutes(app: Express): void {
  app.get('/api/driver-documents/drive-connection', authenticateUser, requireTenant, requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVE_CONNECTION_VIEW), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    const connection = await TenantGoogleDriveConnection.findOne({ tenantId });
    res.json(connection ? publicDriveConnection(connection) : null);
  }));

  app.post('/api/driver-documents/drive-connection', manageRateLimit, authenticateUser, requireTenant, requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVE_CONNECTION_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    try {
      const input = createDriveConnectionSchema.parse(req.body);
      const id = new mongoose.Types.ObjectId();
      const fields = configuredCredentialFields(input.authType, input);
      const connection = await TenantGoogleDriveConnection.create({
        _id: id,
        tenantId,
        connectionName: input.connectionName || 'Primary Drive Connection',
        authType: input.authType,
        sharedDriveId: input.sharedDriveId,
        rootFolderName: input.rootFolderName || 'FleetPro Driver Documents',
        enabled: input.enabled,
        status: input.enabled ? 'configuration_required' : 'disabled',
        encryptedCredentials: fields.length ? encryptDriveCredentials(input.authType, input, tenantId, id.toString()) : undefined,
        credentialFields: fields,
        createdBy: req.userId!,
        updatedBy: req.userId!,
      });
      const publicConnection = publicDriveConnection(connection);
      await writeDriverDocumentAudit({ tenantId, userId: req.userId!, action: 'drive_connection.created', connectionId: id.toString(), newValue: publicConnection });
      res.status(201).json(publicConnection);
    } catch (error: any) {
      if (error instanceof DriverDocumentEncryptionConfigurationError) {
        return res.status(503).json({ message: 'Driver document encryption must be configured before saving Drive credentials.' });
      }
      if (error?.code === 11000) return res.status(409).json({ message: 'This tenant already has a Google Drive connection. Update it instead of creating a second one.' });
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to create Google Drive connection.' });
    }
  }));

  app.patch('/api/driver-documents/drive-connection/:connectionId', manageRateLimit, authenticateUser, requireTenant, requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVE_CONNECTION_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'Google Drive connection not found.' });
    try {
      const input = updateDriveConnectionSchema.parse(req.body);
      const connection = await TenantGoogleDriveConnection.findOne({ _id: req.params.connectionId, tenantId });
      if (!connection) return res.status(404).json({ message: 'Google Drive connection not found.' });
      const oldValue = publicDriveConnection(connection);
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) (connection as any)[key] = value;
      }
      connection.updatedBy = req.userId!;
      connection.status = connection.enabled ? 'configuration_required' : 'disabled';
      connection.lastError = undefined;
      await connection.save();
      const newValue = publicDriveConnection(connection);
      await writeDriverDocumentAudit({ tenantId, userId: req.userId!, action: 'drive_connection.updated', connectionId: connection.id, oldValue, newValue });
      res.json(newValue);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to update Google Drive connection.' });
    }
  }));

  app.post('/api/driver-documents/drive-connection/:connectionId/rotate-credentials', manageRateLimit, authenticateUser, requireTenant, requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVE_CONNECTION_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'Google Drive connection not found.' });
    try {
      const input = rotateDriveCredentialsSchema.parse(req.body);
      const connection = await TenantGoogleDriveConnection.findOne({ _id: req.params.connectionId, tenantId }).select('+encryptedCredentials');
      if (!connection) return res.status(404).json({ message: 'Google Drive connection not found.' });
      const fields = configuredCredentialFields(connection.authType, input);
      connection.encryptedCredentials = encryptDriveCredentials(connection.authType, input, tenantId, connection.id);
      connection.credentialFields = fields;
      connection.status = connection.enabled ? 'configuration_required' : 'disabled';
      connection.lastError = undefined;
      connection.updatedBy = req.userId!;
      await connection.save();
      const publicConnection = publicDriveConnection(connection);
      await writeDriverDocumentAudit({ tenantId, userId: req.userId!, action: 'drive_connection.credentials_rotated', connectionId: connection.id, newValue: { credentialFields: connection.credentialFields }, reason: input.reason });
      res.json(publicConnection);
    } catch (error) {
      if (error instanceof DriverDocumentEncryptionConfigurationError) {
        return res.status(503).json({ message: 'Driver document encryption must be configured before rotating Drive credentials.' });
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to rotate Google Drive credentials.' });
    }
  }));

  app.post('/api/driver-documents/drive-connection/:connectionId/test', testRateLimit, authenticateUser, requireTenant, requirePermission(DRIVER_DOCUMENT_PERMISSIONS.DRIVE_CONNECTION_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'Google Drive connection not found.' });
    const connection = await TenantGoogleDriveConnection.findOne({ _id: req.params.connectionId, tenantId }).select('+encryptedCredentials');
    if (!connection) return res.status(404).json({ message: 'Google Drive connection not found.' });
    if (!connection.enabled) return res.status(409).json({ message: 'Enable the Google Drive connection before testing it.', status: 'disabled' });
    connection.status = 'testing';
    connection.lastTestedAt = new Date();
    connection.updatedBy = req.userId!;
    await connection.save();
    try {
      const credentials = decryptDriveCredentials(connection.encryptedCredentials, tenantId, connection.id);
      if (!credentials) throw new Error('No credentials configured.');
      const client = buildDriveClient(credentials);
      const driveInfo = await client.getSharedDriveMetadata(connection.sharedDriveId);
      const rootFolderId = await client.ensureFolder(connection.rootFolderName, connection.sharedDriveId, connection.sharedDriveId);
      connection.rootFolderId = rootFolderId;
      connection.status = 'connected';
      connection.lastError = undefined;
      connection.lastSuccessfulSync = new Date();
      await connection.save();
      await writeDriverDocumentAudit({ tenantId, userId: req.userId!, action: 'drive_connection.tested', connectionId: connection.id, newValue: { success: true, sharedDriveName: driveInfo.name, rootFolderId } });
      res.json({ success: true, status: connection.status, sharedDriveName: driveInfo.name, rootFolderId });
    } catch (error: any) {
      connection.status = 'authentication_failed';
      connection.lastFailedSync = new Date();
      connection.lastError = 'Google Drive connection test failed.';
      await connection.save();
      await writeDriverDocumentAudit({ tenantId, userId: req.userId!, action: 'drive_connection.test_failed', connectionId: connection.id, newValue: { status: connection.status } });
      res.status(502).json({ success: false, status: connection.status, message: connection.lastError });
    }
  }));
}
