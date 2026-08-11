// TenantGoogleDriveConnection helpers — mirrors server/gps/services/connectionService.ts's
// shape (publicConnection redaction, encrypt/decrypt wrappers, audit writer).
import mongoose from 'mongoose';
import { TenantGoogleDriveConnection, type ITenantGoogleDriveConnection } from '../models/tenantGoogleDriveConnection';
import { DriverDocumentAuditLog, type DriverDocumentAuditAction } from '../models/driverDocumentAuditLog';
import { decryptDriverDocumentSecret, encryptDriverDocumentSecret } from '../security/documentEncryption';
import type { ServiceAccountKey } from '../drive/serviceAccountAuth';

const MASK = '••••••••';

export type DecryptedDriveCredentials =
  | { authType: 'service_account'; serviceAccountKey: ServiceAccountKey }
  | { authType: 'oauth_consent'; clientId: string; clientSecret: string; refreshToken: string };

export interface DriveCredentialInput {
  serviceAccountKeyJson?: string; // raw JSON text of the downloaded key file
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
}

export function publicDriveConnection(connection: ITenantGoogleDriveConnection | Record<string, any>) {
  const row: any = typeof (connection as any).toObject === 'function' ? (connection as any).toObject() : connection;
  return {
    id: String(row._id || row.id),
    connectionName: row.connectionName,
    authType: row.authType,
    sharedDriveId: row.sharedDriveId,
    rootFolderId: row.rootFolderId,
    rootFolderName: row.rootFolderName,
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

export function configuredCredentialFields(authType: string, input: DriveCredentialInput): string[] {
  if (authType === 'service_account') {
    return input.serviceAccountKeyJson ? ['serviceAccountKeyJson'] : [];
  }
  const fields: string[] = [];
  if (input.clientId) fields.push('clientId');
  if (input.clientSecret) fields.push('clientSecret');
  if (input.refreshToken) fields.push('refreshToken');
  return fields;
}

export function encryptDriveCredentials(authType: string, input: DriveCredentialInput, tenantId: string, connectionId: string): string {
  if (authType === 'service_account') {
    const parsed = JSON.parse(input.serviceAccountKeyJson || '{}');
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Service account key JSON must include client_email and private_key.');
    }
    return encryptDriverDocumentSecret({ authType, serviceAccountKey: parsed }, tenantId, connectionId);
  }
  return encryptDriverDocumentSecret({
    authType,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    refreshToken: input.refreshToken,
  }, tenantId, connectionId);
}

export function decryptDriveCredentials(encrypted: string | undefined, tenantId: string, connectionId: string): DecryptedDriveCredentials | null {
  if (!encrypted) return null;
  return decryptDriverDocumentSecret<DecryptedDriveCredentials>(encrypted, tenantId, connectionId, true);
}

export async function resolveTenantDriveConnection(tenantId: string): Promise<ITenantGoogleDriveConnection | null> {
  if (!mongoose.isValidObjectId(tenantId)) return null;
  return TenantGoogleDriveConnection.findOne({ tenantId }).select('+encryptedCredentials');
}

export async function writeDriverDocumentAudit(input: {
  tenantId: string;
  userId: string;
  action: DriverDocumentAuditAction;
  driverId?: string;
  documentId?: string;
  connectionId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
}) {
  await DriverDocumentAuditLog.create(input);
}
