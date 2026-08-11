import type { Express, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { FastagConnection } from './models/fastagConnection';
import { FastagRecord } from './models/fastagRecord';
import { encryptFastagCredentials, FastagCredentialEncryptionConfigurationError } from './security/credentialEncryption';

const MASK = '••••••••';

export function registerVehicleFastagRoutes(app: Express): void {
  app.get('/api/fastag/connections', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    const connections = await FastagConnection.find({ tenantId: req.tenantId }).sort({ connectionName: 1 });
    res.json(connections.map((c) => ({
      id: c.id, connectionName: c.connectionName, providerKey: c.providerKey, enabled: c.enabled, status: c.status,
      credentials: Object.fromEntries(c.credentialFields.map((f) => [f, MASK])),
    })));
  });

  app.post('/api/fastag/connections', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { connectionName, providerKey, enabled, credentials } = req.body;
      const id = new mongoose.Types.ObjectId();
      const fields = Object.keys(credentials || {});
      const connection = await FastagConnection.create({
        _id: id, tenantId: req.tenantId, connectionName, providerKey,
        enabled: Boolean(enabled), status: 'configuration_required',
        encryptedSecrets: fields.length ? encryptFastagCredentials(credentials, req.tenantId!, id.toString()) : undefined,
        credentialFields: fields, createdBy: req.userId!, updatedBy: req.userId!,
      });
      res.status(201).json({ id: connection.id, connectionName: connection.connectionName, status: connection.status });
    } catch (error: any) {
      if (error instanceof FastagCredentialEncryptionConfigurationError) {
        return res.status(503).json({ message: 'FASTag credential encryption is not configured.' });
      }
      res.status(400).json({ message: error?.message || 'Failed to create FASTag connection' });
    }
  });

  app.get('/api/vehicles/:vehicleId/fastag', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const record = await FastagRecord.findOne({ tenantId: req.tenantId, vehicleId: req.params.vehicleId });
      res.json(record ? [record] : []);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch FASTag record' });
    }
  });

  app.post('/api/vehicles/:vehicleId/fastag', authenticateUser, requireTenant, requirePermission(PERMISSIONS.MANAGE_VEHICLES), async (req: AuthRequest, res: Response) => {
    try {
      const { connectionId, tagId } = req.body;
      const record = await FastagRecord.create({
        tenantId: req.tenantId, vehicleId: req.params.vehicleId, connectionId, tagId,
        status: 'unknown', createdBy: req.userId!, updatedBy: req.userId!,
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: 'This vehicle or tag is already linked.' });
      res.status(400).json({ message: error?.message || 'Failed to link FASTag' });
    }
  });
}
