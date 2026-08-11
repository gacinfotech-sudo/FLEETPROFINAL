import mongoose from 'mongoose';
import { GpsAuditLog, GpsConnection, type IGpsConnection } from '../models/gpsConnection';
import { decryptGpsCredentials, encryptGpsCredentials } from '../security/credentialEncryption';
import type { GpsProviderConnectionConfig } from '../types';

export type GpsCredentialPayload = GpsProviderConnectionConfig['secrets'];

const MASK = '••••••••';

export function publicGpsConnection(connection: IGpsConnection | Record<string, any>) {
  const row: any = typeof (connection as any).toObject === 'function'
    ? (connection as any).toObject()
    : connection;
  return {
    id: String(row._id || row.id),
    connectionName: row.connectionName,
    providerKey: row.providerKey,
    apiBaseUrl: row.apiBaseUrl,
    authenticationType: row.authenticationType,
    accountId: row.accountId,
    providerTimezone: row.providerTimezone,
    websocketUrl: row.websocketUrl,
    pollingIntervalSeconds: row.pollingIntervalSeconds,
    enabled: row.enabled,
    status: row.status,
    credentials: Object.fromEntries((row.credentialFields || []).map((field: string) => [field, MASK])),
    lastTestedAt: row.lastTestedAt,
    lastSuccessfulSync: row.lastSuccessfulSync,
    lastFailedSync: row.lastFailedSync,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function configuredCredentialFields(credentials: GpsCredentialPayload): string[] {
  const standard = Object.entries(credentials)
    .filter(([key, value]) => key !== 'custom' && typeof value === 'string' && value.length > 0)
    .map(([key]) => key);
  const custom = Object.keys(credentials.custom || {}).map((key) => `custom.${key}`);
  return [...standard, ...custom].sort();
}

export function encryptConnectionCredentials(
  credentials: GpsCredentialPayload,
  tenantId: string,
  connectionId: string,
) {
  return encryptGpsCredentials(credentials as Record<string, unknown>, tenantId, connectionId);
}

export function decryptConnectionCredentials(
  encrypted: string | undefined,
  tenantId: string,
  connectionId: string,
): GpsCredentialPayload {
  if (!encrypted) return {};
  return decryptGpsCredentials<GpsCredentialPayload>(encrypted, tenantId, connectionId);
}

export async function resolveGpsProviderConnection(
  tenantId: string,
  connectionId: string,
): Promise<GpsProviderConnectionConfig | null> {
  if (!mongoose.isValidObjectId(connectionId)) return null;
  const connection = await GpsConnection.findOne({ _id: connectionId, tenantId })
    .select('+encryptedSecrets')
    .lean();
  if (!connection) return null;
  return {
    id: String(connection._id),
    tenantId: String(connection.tenantId),
    connectionName: connection.connectionName,
    providerKey: connection.providerKey,
    apiBaseUrl: connection.apiBaseUrl,
    authenticationType: connection.authenticationType,
    providerTimezone: connection.providerTimezone,
    websocketUrl: connection.websocketUrl,
    accountId: connection.accountId,
    enabled: connection.enabled,
    status: connection.status,
    secrets: decryptConnectionCredentials(connection.encryptedSecrets, tenantId, connectionId),
  };
}

export async function writeGpsConnectionAudit(input: {
  tenantId: string;
  userId: string;
  action: string;
  connectionId: string;
  deviceId?: string;
  vehicleId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}) {
  await GpsAuditLog.create(input);
}
