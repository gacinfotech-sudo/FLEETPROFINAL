import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

interface EncryptedGpsSecretEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class GpsCredentialEncryptionConfigurationError extends Error {
  readonly code = 'GPS_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED';

  constructor() {
    super('GPS credential encryption is not configured.');
    this.name = 'GpsCredentialEncryptionConfigurationError';
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.GPS_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!configured) throw new GpsCredentialEncryptionConfigurationError();

  const key = /^[a-fA-F0-9]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new GpsCredentialEncryptionConfigurationError();
  return key;
}

export function encryptGpsCredentials(
  credentials: Readonly<Record<string, unknown>>,
  tenantId: string,
  connectionId: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${tenantId}:${connectionId}`, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  const envelope: EncryptedGpsSecretEnvelope = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}

export function decryptGpsCredentials<T extends Record<string, unknown>>(
  encrypted: string,
  tenantId: string,
  connectionId: string,
): T {
  const envelope = JSON.parse(encrypted) as EncryptedGpsSecretEnvelope;
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported GPS credential encryption envelope.');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(`${tenantId}:${connectionId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
