import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { GpsConnection } from '../models/gpsConnection';
import { GpsDevice } from '../models/gpsDevice';
import { GpsProviderConfigurationError } from '../providers/registry';
import { gpsProviderRegistry } from '../providers/runtimeRegistry';
import { writeGpsConnectionAudit } from '../services/connectionService';
import { publicGpsDevice, synchronizeProviderDevices } from '../services/deviceService';

const listQuerySchema = z.object({
  connectionId: z.string().optional(),
  status: z.enum(['unassigned', 'assigned', 'online', 'offline', 'inactive', 'faulty', 'removed']).optional(),
  search: z.string().trim().max(100).optional(),
}).strict();
const updateDeviceSchema = z.object({
  internalDeviceCode: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
  simNumber: z.string().trim().max(100).optional(),
  deviceName: z.string().trim().max(200).optional(),
  deviceModel: z.string().trim().max(200).optional(),
  status: z.enum(['unassigned', 'inactive', 'faulty', 'removed']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one editable device field is required.');

const gpsDeviceManageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many GPS device changes. Please try again later.' },
});

function safeAsync(handler: (req: AuthRequest, res: Response) => Promise<unknown>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

function tenantContext(req: AuthRequest, res: Response) {
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required for GPS devices.' });
    return null;
  }
  return req.tenantId;
}

function validationMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join('; ');
}

export function registerGpsDeviceRoutes(app: Express): void {
  app.get('/api/gps/devices', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_VIEW), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    try {
      const queryInput = listQuerySchema.parse(req.query);
      const query: Record<string, unknown> = { tenantId, isDeleted: false };
      if (queryInput.connectionId) {
        if (!mongoose.isValidObjectId(queryInput.connectionId)) return res.status(400).json({ message: 'Invalid connectionId.' });
        query.connectionId = queryInput.connectionId;
      }
      if (queryInput.status) query.status = queryInput.status;
      if (queryInput.search) {
        const escaped = queryInput.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { internalDeviceCode: { $regex: escaped, $options: 'i' } },
          { providerDeviceId: { $regex: escaped, $options: 'i' } },
          { imei: { $regex: escaped, $options: 'i' } },
          { deviceName: { $regex: escaped, $options: 'i' } },
        ];
      }
      const devices = await GpsDevice.find(query).sort({ deviceName: 1, internalDeviceCode: 1 });
      res.json(devices.map(publicGpsDevice));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
      throw error;
    }
  }));

  app.get('/api/gps/devices/:deviceId', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_VIEW), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.deviceId)) return res.status(404).json({ message: 'GPS device not found.' });
    const device = await GpsDevice.findOne({ _id: req.params.deviceId, tenantId, isDeleted: false });
    if (!device) return res.status(404).json({ message: 'GPS device not found.' });
    res.json(publicGpsDevice(device));
  }));

  app.patch('/api/gps/devices/:deviceId', gpsDeviceManageRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.deviceId)) return res.status(404).json({ message: 'GPS device not found.' });
    try {
      const input = updateDeviceSchema.parse(req.body);
      const device = await GpsDevice.findOne({ _id: req.params.deviceId, tenantId, isDeleted: false });
      if (!device) return res.status(404).json({ message: 'GPS device not found.' });
      const oldValue = publicGpsDevice(device);
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) (device as any)[key] = value;
      }
      if (input.status === 'removed') device.isDeleted = true;
      device.updatedBy = req.userId!;
      await device.save();
      const newValue = publicGpsDevice(device);
      await writeGpsConnectionAudit({
        tenantId,
        userId: req.userId!,
        action: input.status === 'removed' ? 'gps.device.removed' : 'gps.device.updated',
        connectionId: device.connectionId.toString(),
        deviceId: device.id,
        oldValue,
        newValue,
      });
      res.json(newValue);
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: 'GPS device code or IMEI already exists.' });
      if (error instanceof z.ZodError) return res.status(400).json({ message: validationMessage(error) });
      throw error;
    }
  }));

  app.post('/api/gps/connections/:connectionId/sync-devices', gpsDeviceManageRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_DEVICE_MANAGE), safeAsync(async (req, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    const connection = await GpsConnection.findOne({ _id: req.params.connectionId, tenantId });
    if (!connection) return res.status(404).json({ message: 'GPS connection not found.' });
    if (!connection.enabled) return res.status(409).json({ message: 'Enable the GPS connection before syncing devices.' });
    if (connection.status !== 'connected') {
      return res.status(409).json({ message: 'A successful provider connection test is required before device sync.', status: connection.status });
    }
    try {
      const adapter = await gpsProviderRegistry.getAdapter(tenantId, connection.id);
      const providerDevices = await adapter.listDevices();
      const result = await synchronizeProviderDevices({ tenantId, connectionId: connection.id, devices: providerDevices, actor: req.userId! });
      connection.lastSuccessfulSync = new Date();
      connection.lastError = undefined;
      await connection.save();
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.devices.synchronized', connectionId: connection.id, newValue: result });
      res.json(result);
    } catch (error) {
      connection.status = error instanceof GpsProviderConfigurationError ? 'configuration_required' : 'sync_failed';
      connection.lastFailedSync = new Date();
      connection.lastError = error instanceof GpsProviderConfigurationError
        ? 'Official provider adapter documentation is required.'
        : 'GPS device synchronization failed.';
      await connection.save();
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.devices.sync_failed', connectionId: connection.id, newValue: { status: connection.status } });
      res.status(error instanceof GpsProviderConfigurationError ? 409 : 502).json({ message: connection.lastError, status: connection.status });
    }
  }));
}
