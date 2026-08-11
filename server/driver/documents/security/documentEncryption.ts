// Encrypted-secret envelope for this module, structurally identical to
// server/gps/security/credentialEncryption.ts (that file is read-only reference
// per this task's file-ownership rules — this is a deliberate parallel
// implementation under our own key, not an import from server/gps/**, so the
// Drive-connection and driver-document initiatives never share a rotation
// boundary). Used for two things:
//  1. Google Drive connection credentials (service-account key JSON, or OAuth
//     client secret + refresh token) — TenantGoogleDriveConnection.encryptedCredentials.
//  2. Raw (unmasked) document numbers (e.g. full Aadhaar/PAN) — DriverDocument's
//     encryptedDocumentNumber. Only ever decrypted for a High-access-tier caller;
//     see services/masking.ts and routes/documentRoutes.ts.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

interface EncryptedEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class DriverDocumentEncryptionConfigurationError extends Error {
  readonly code = 'DRIVER_DOCUMENT_ENCRYPTION_NOT_CONFIGURED';

  constructor() {
    super('Driver document encryption is not configured.');
    this.name = 'DriverDocumentEncryptionConfigurationError';
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.DRIVER_DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!configured) throw new DriverDocumentEncryptionConfigurationError();

  const key = /^[a-fA-F0-9]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new DriverDocumentEncryptionConfigurationError();
  return key;
}

// aad binds the ciphertext to a specific (tenant, record) pair so a ciphertext
// copied between records/tenants fails to decrypt instead of silently decrypting
// as if it belonged there.
export function encryptDriverDocumentSecret(
  plaintext: Readonly<Record<string, unknown>> | string,
  tenantId: string,
  recordId: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${tenantId}:${recordId}`, 'utf8'));
  const serialized = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const ciphertext = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}

export function decryptDriverDocumentSecret<T = string>(
  encrypted: string,
  tenantId: string,
  recordId: string,
  parseJson = false,
): T {
  const envelope = JSON.parse(encrypted) as EncryptedEnvelope;
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported driver-document encryption envelope.');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(`${tenantId}:${recordId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return (parseJson ? JSON.parse(plaintext) : plaintext) as T;
}
