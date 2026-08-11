import type { Express, NextFunction, Response } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticateUser, requireTenant, type AuthRequest } from '../../middleware/auth';
import { PERMISSIONS, requirePermission } from '../../middleware/permissions';
import { GpsAuditLog, GpsConnection } from '../models/gpsConnection';
import {
  configuredCredentialFields,
  decryptConnectionCredentials,
  encryptConnectionCredentials,
  publicGpsConnection,
  writeGpsConnectionAudit,
} from '../services/connectionService';
import { GpsCredentialEncryptionConfigurationError } from '../security/credentialEncryption';
import {
  GpsConnectionDisabledError,
  GpsConnectionNotFoundError,
  GpsProviderConfigurationError,
} from '../providers/registry';
import { gpsProviderRegistry } from '../providers/runtimeRegistry';

const providerKey = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/);
const httpUrl = z.string().trim().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol));
const websocketUrl = z.string().trim().url().refine((value) => ['ws:', 'wss:'].includes(new URL(value).protocol));
const credentialSchema = z.object({
  apiUsername: z.string().max(500).optional(),
  apiPassword: z.string().max(2000).optional(),
  apiToken: z.string().max(4000).optional(),
  clientId: z.string().max(1000).optional(),
  clientSecret: z.string().max(4000).optional(),
  webhookSecret: z.string().max(4000).optional(),
  custom: z.record(
    z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/).refine((key) => !['__proto__', 'constructor', 'prototype'].includes(key)),
    z.string().max(4000),
  ).optional(),
}).strict();

const baseConnectionSchema = z.object({
  connectionName: z.string().trim().min(2).max(120),
  providerKey,
  apiBaseUrl: httpUrl.optional(),
  authenticationType: z.enum(['api_key', 'bearer_token', 'basic_authentication', 'oauth_client_credentials', 'session_login', 'custom_provider_authentication']),
  accountId: z.string().trim().max(200).optional(),
  providerTimezone: z.string().trim().max(100).optional(),
  websocketUrl: websocketUrl.optional(),
  pollingIntervalSeconds: z.number().int().min(30).max(86400).default(120),
  enabled: z.boolean().default(false),
}).strict();

const createConnectionSchema = baseConnectionSchema.extend({ credentials: credentialSchema.optional() }).strict();
const updateConnectionSchema = baseConnectionSchema.partial().strict();
const rotateCredentialsSchema = z.object({
  credentials: credentialSchema,
  reason: z.string().trim().min(3).max(500),
}).strict();

const gpsManageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many GPS connection changes. Please try again later.' },
});
const gpsTestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many GPS connection tests. Please try again later.' },
});

function tenantContext(req: AuthRequest, res: Response): string | null {
  // Existing global admins intentionally have no tenant. GPS credentials
  // require an explicit tenant-bound user context; never infer one from a
  // request parameter or allow a cross-tenant connection lookup.
  if (!req.tenantId) {
    res.status(403).json({ message: 'Tenant context is required for GPS connections.' });
    return null;
  }
  return req.tenantId;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join('; ');
  return 'GPS connection request failed.';
}

function safeAsync(
  handler: (req: AuthRequest, res: Response) => Promise<unknown>,
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function registerGpsConnectionRoutes(app: Express): void {
  app.get('/api/gps/connections', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_VIEW), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    const connections = await GpsConnection.find({ tenantId }).sort({ connectionName: 1 });
    res.json(connections.map(publicGpsConnection));
  }));

  app.get('/api/gps/connections/:connectionId', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_VIEW), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    const connection = await GpsConnection.findOne({ _id: req.params.connectionId, tenantId });
    if (!connection) return res.status(404).json({ message: 'GPS connection not found.' });
    res.json(publicGpsConnection(connection));
  }));

  app.post('/api/gps/connections', gpsManageRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_MANAGE), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    try {
      const input = createConnectionSchema.parse(req.body);
      const id = new mongoose.Types.ObjectId();
      const credentials = input.credentials || {};
      const fields = configuredCredentialFields(credentials);
      const connection = await GpsConnection.create({
        _id: id,
        tenantId,
        connectionName: input.connectionName,
        providerKey: input.providerKey,
        apiBaseUrl: input.apiBaseUrl,
        authenticationType: input.authenticationType,
        accountId: input.accountId,
        providerTimezone: input.providerTimezone,
        websocketUrl: input.websocketUrl,
        pollingIntervalSeconds: input.pollingIntervalSeconds,
        enabled: input.enabled,
        status: input.enabled ? 'configuration_required' : 'disabled',
        encryptedSecrets: fields.length ? encryptConnectionCredentials(credentials, tenantId, id.toString()) : undefined,
        credentialFields: fields,
        createdBy: req.userId!,
        updatedBy: req.userId!,
      });
      const publicConnection = publicGpsConnection(connection);
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.connection.added', connectionId: id.toString(), newValue: publicConnection });
      res.status(201).json(publicConnection);
    } catch (error: any) {
      if (error instanceof GpsCredentialEncryptionConfigurationError) {
        return res.status(503).json({ message: 'GPS credential encryption must be configured before saving secrets.' });
      }
      if (error?.code === 11000) return res.status(409).json({ message: 'A GPS connection with this name already exists.' });
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to create GPS connection.' });
    }
  }));

  app.patch('/api/gps/connections/:connectionId', gpsManageRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_MANAGE), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    try {
      const input = updateConnectionSchema.parse(req.body);
      const connection = await GpsConnection.findOne({ _id: req.params.connectionId, tenantId });
      if (!connection) return res.status(404).json({ message: 'GPS connection not found.' });
      if (input.providerKey && input.providerKey !== connection.providerKey && connection.credentialFields.length) {
        return res.status(409).json({ message: 'Create a new provider connection instead of carrying saved credentials to another provider.' });
      }
      const oldValue = publicGpsConnection(connection);
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) (connection as any)[key] = value;
      }
      connection.updatedBy = req.userId!;
      connection.status = connection.enabled ? 'configuration_required' : 'disabled';
      connection.lastError = undefined;
      await connection.save();
      const newValue = publicGpsConnection(connection);
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.connection.updated', connectionId: connection.id, oldValue, newValue });
      res.json(newValue);
    } catch (error: any) {
      if (error?.code === 11000) return res.status(409).json({ message: 'A GPS connection with this name already exists.' });
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to update GPS connection.' });
    }
  }));

  app.post('/api/gps/connections/:connectionId/rotate-credentials', gpsManageRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_MANAGE), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    try {
      const input = rotateCredentialsSchema.parse(req.body);
      const connection = await GpsConnection.findOne({ _id: req.params.connectionId, tenantId }).select('+encryptedSecrets');
      if (!connection) return res.status(404).json({ message: 'GPS connection not found.' });
      const existing = decryptConnectionCredentials(connection.encryptedSecrets, tenantId, connection.id);
      const credentials = {
        ...existing,
        ...input.credentials,
        custom: { ...(existing.custom || {}), ...(input.credentials.custom || {}) },
      };
      connection.encryptedSecrets = encryptConnectionCredentials(credentials, tenantId, connection.id);
      connection.credentialFields = configuredCredentialFields(credentials);
      connection.status = connection.enabled ? 'configuration_required' : 'disabled';
      connection.lastError = undefined;
      connection.updatedBy = req.userId!;
      await connection.save();
      const publicConnection = publicGpsConnection(connection);
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.credentials.rotated', connectionId: connection.id, newValue: { credentialFields: connection.credentialFields }, reason: input.reason });
      res.json(publicConnection);
    } catch (error) {
      if (error instanceof GpsCredentialEncryptionConfigurationError) {
        return res.status(503).json({ message: 'GPS credential encryption must be configured before rotating secrets.' });
      }
      if (error instanceof z.ZodError) return res.status(400).json({ message: safeErrorMessage(error) });
      res.status(500).json({ message: 'Failed to rotate GPS credentials.' });
    }
  }));

  app.post('/api/gps/connections/:connectionId/test', gpsTestRateLimit, authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_MANAGE), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    const connection = await GpsConnection.findOne({ _id: req.params.connectionId, tenantId });
    if (!connection) return res.status(404).json({ message: 'GPS connection not found.' });
    if (!connection.enabled) return res.status(409).json({ message: 'Enable the GPS connection before testing it.' });
    connection.status = 'testing';
    connection.lastTestedAt = new Date();
    connection.updatedBy = req.userId!;
    await connection.save();
    try {
      const adapter = await gpsProviderRegistry.getAdapter(tenantId, connection.id);
      const result = await adapter.testConnection();
      const connected = result.success && result.status === 'connected';
      connection.status = connected ? 'connected' : result.status;
      connection.lastError = connected ? undefined : `GPS provider test failed: ${result.status}.`;
      if (connected) connection.lastSuccessfulSync = result.checkedAt;
      else connection.lastFailedSync = result.checkedAt;
      await connection.save();
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.connection.tested', connectionId: connection.id, newValue: { success: connected, status: connection.status, checkedAt: result.checkedAt } });
      res.status(connected ? 200 : 502).json({ success: connected, status: connection.status, checkedAt: result.checkedAt, latencyMs: result.latencyMs });
    } catch (error) {
      if (error instanceof GpsCredentialEncryptionConfigurationError) {
        connection.status = 'configuration_required';
        connection.lastFailedSync = new Date();
        connection.lastError = 'GPS credential encryption is not configured.';
        await connection.save();
        await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.connection.test_failed', connectionId: connection.id, newValue: { status: connection.status } });
        return res.status(503).json({ message: connection.lastError, status: connection.status });
      }
      const configurationRequired = error instanceof GpsProviderConfigurationError;
      connection.status = configurationRequired ? 'configuration_required' : 'provider_unavailable';
      connection.lastFailedSync = new Date();
      connection.lastError = configurationRequired ? 'Official provider adapter documentation is required.' : 'Provider connection test failed.';
      await connection.save();
      await writeGpsConnectionAudit({ tenantId, userId: req.userId!, action: 'gps.connection.test_failed', connectionId: connection.id, newValue: { status: connection.status } });
      if (configurationRequired) return res.status(409).json({ success: false, status: connection.status, message: connection.lastError });
      if (error instanceof GpsConnectionDisabledError) return res.status(409).json({ success: false, status: 'disabled' });
      if (error instanceof GpsConnectionNotFoundError) return res.status(404).json({ message: 'GPS connection not found.' });
      res.status(502).json({ success: false, status: connection.status, message: 'GPS provider is unavailable.' });
    }
  }));

  app.get('/api/gps/connections/:connectionId/logs', authenticateUser, requireTenant, requirePermission(PERMISSIONS.GPS_CONNECTION_VIEW), safeAsync(async (req: AuthRequest, res) => {
    const tenantId = tenantContext(req, res);
    if (!tenantId) return;
    if (!mongoose.isValidObjectId(req.params.connectionId)) return res.status(404).json({ message: 'GPS connection not found.' });
    const ownsConnection = await GpsConnection.exists({ _id: req.params.connectionId, tenantId });
    if (!ownsConnection) return res.status(404).json({ message: 'GPS connection not found.' });
    const logs = await GpsAuditLog.find({ tenantId, connectionId: req.params.connectionId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json(logs.map((log) => ({ id: String(log._id), action: log.action, userId: log.userId, oldValue: log.oldValue, newValue: log.newValue, reason: log.reason, createdAt: log.createdAt })));
  }));
}
