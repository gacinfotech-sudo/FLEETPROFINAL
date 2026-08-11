// Mirrors server/gps/security/credentialEncryption.ts's exact pattern
// (AES-256-GCM, tenant+connectionId bound as AAD) — a fresh implementation
// rather than an import, since importing a function literally named
// `encryptGpsCredentials` for FASTag secrets would be a misleading name at
// the call site even though the underlying algorithm is identical and
// proven. Read (not imported) directly from server/gps/security/
// credentialEncryption.ts as the reference for this file.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

interface EncryptedFastagSecretEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class FastagCredentialEncryptionConfigurationError extends Error {
  readonly code = 'FASTAG_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED';
  constructor() {
    super('FASTag credential encryption is not configured.');
    this.name = 'FastagCredentialEncryptionConfigurationError';
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.FASTAG_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!configured) throw new FastagCredentialEncryptionConfigurationError();
  const key = /^[a-fA-F0-9]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new FastagCredentialEncryptionConfigurationError();
  return key;
}

export function encryptFastagCredentials(
  credentials: Readonly<Record<string, unknown>>,
  tenantId: string,
  connectionId: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${tenantId}:${connectionId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  const envelope: EncryptedFastagSecretEnvelope = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}

export function decryptFastagCredentials<T extends Record<string, unknown>>(
  encrypted: string,
  tenantId: string,
  connectionId: string,
): T {
  const envelope = JSON.parse(encrypted) as EncryptedFastagSecretEnvelope;
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported FASTag credential encryption envelope.');
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(`${tenantId}:${connectionId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
