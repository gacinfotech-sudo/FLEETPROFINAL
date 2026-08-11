import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Same authenticated-encryption pattern as
// server/gps/security/credentialEncryption.ts (AES-256-GCM, AAD bound to
// tenant+identity so a ciphertext can't be replayed against a different
// tenant/user), using its own env var so the telephony module owns its own
// key material independently of GPS. Provider credentials encrypted here
// are NEVER returned to the frontend — see server/telephony/services/
// identityService.ts's publicTelephonyIdentity().

const ALGORITHM = 'aes-256-gcm';

interface EncryptedTelephonySecretEnvelope {
  version: 1;
  algorithm: typeof ALGORITHM;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export class TelephonyCredentialEncryptionConfigurationError extends Error {
  readonly code = 'TELEPHONY_CREDENTIAL_ENCRYPTION_NOT_CONFIGURED';

  constructor() {
    super('Telephony credential encryption is not configured.');
    this.name = 'TelephonyCredentialEncryptionConfigurationError';
  }
}

function encryptionKey(): Buffer {
  const configured = process.env.TELEPHONY_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!configured) throw new TelephonyCredentialEncryptionConfigurationError();

  const key = /^[a-fA-F0-9]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new TelephonyCredentialEncryptionConfigurationError();
  return key;
}

export function encryptTelephonyCredentials(
  credentials: Readonly<Record<string, unknown>>,
  tenantId: string,
  identityId: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${tenantId}:${identityId}`, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  const envelope: EncryptedTelephonySecretEnvelope = {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope);
}

export function decryptTelephonyCredentials<T extends Record<string, unknown>>(
  encrypted: string,
  tenantId: string,
  identityId: string,
): T {
  const envelope = JSON.parse(encrypted) as EncryptedTelephonySecretEnvelope;
  if (envelope.version !== 1 || envelope.algorithm !== ALGORITHM) {
    throw new Error('Unsupported telephony credential encryption envelope.');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAAD(Buffer.from(`${tenantId}:${identityId}`, 'utf8'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
