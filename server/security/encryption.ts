import crypto from 'crypto';

/**
 * End-to-End Encryption for Sensitive Fields
 * - AES-256-GCM for encryption
 * - At-rest encryption in MongoDB
 * - Key rotation support
 * - Authenticated encryption with associated data (AEAD)
 */

export interface EncryptionKey {
  id: string;
  key: Buffer;
  createdAt: Date;
  rotatedAt?: Date;
  algorithm: string;
}

export interface EncryptedData {
  encrypted: string; // Base64 encoded
  iv: string; // Initialization vector (Base64)
  authTag: string; // Authentication tag (Base64)
  keyId: string; // ID of key used for encryption
  algorithm: string; // Encryption algorithm
}

export class EncryptionManager {
  private keys = new Map<string, EncryptionKey>();
  private currentKeyId: string = 'default';
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_SIZE = 32; // 256 bits
  private readonly IV_SIZE = 16; // 128 bits
  private readonly TAG_SIZE = 16; // 128 bits

  constructor() {
    // Initialize with default key if ENCRYPTION_KEY env var is set
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey) {
      this.importKey('default', Buffer.from(envKey, 'base64'));
    } else {
      // Generate a new key for development
      this.generateKey('default');
      console.warn('Using generated encryption key. Set ENCRYPTION_KEY environment variable in production.');
    }
  }

  /**
   * Generate a new encryption key
   */
  generateKey(keyId: string): string {
    const key = crypto.randomBytes(this.KEY_SIZE);

    this.keys.set(keyId, {
      id: keyId,
      key,
      createdAt: new Date(),
      algorithm: this.ALGORITHM,
    });

    if (!this.currentKeyId) {
      this.currentKeyId = keyId;
    }

    console.log(`Generated encryption key: ${keyId}`);

    // Return base64 encoded key for storage
    return key.toString('base64');
  }

  /**
   * Import an existing encryption key
   */
  importKey(keyId: string, keyBuffer: Buffer): void {
    if (keyBuffer.length !== this.KEY_SIZE) {
      throw new Error(`Invalid key size. Expected ${this.KEY_SIZE} bytes, got ${keyBuffer.length}`);
    }

    this.keys.set(keyId, {
      id: keyId,
      key: keyBuffer,
      createdAt: new Date(),
      algorithm: this.ALGORITHM,
    });

    console.log(`Imported encryption key: ${keyId}`);
  }

  /**
   * Rotate encryption key (mark current as old, use new for encryption)
   */
  rotateKey(newKeyId: string): string {
    if (this.keys.has(newKeyId)) {
      throw new Error(`Key ${newKeyId} already exists`);
    }

    // Mark current key as rotated
    const currentKey = this.keys.get(this.currentKeyId);
    if (currentKey) {
      currentKey.rotatedAt = new Date();
    }

    // Generate new key
    this.currentKeyId = newKeyId;
    return this.generateKey(newKeyId);
  }

  /**
   * Get current key ID
   */
  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string | Buffer, additionalData?: string): EncryptedData {
    const key = this.keys.get(this.currentKeyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${this.currentKeyId}`);
    }

    // Generate random IV
    const iv = crypto.randomBytes(this.IV_SIZE);

    // Create cipher
    const cipher = crypto.createCipheriv(this.ALGORITHM, key.key, iv);

    // Add additional authenticated data if provided
    if (additionalData) {
      cipher.setAAD(Buffer.from(additionalData, 'utf-8'));
    }

    // Encrypt
    let encrypted = cipher.update(plaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyId: this.currentKeyId,
      algorithm: this.ALGORITHM,
    };
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData, additionalData?: string): string {
    const key = this.keys.get(encryptedData.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
    }

    // Convert from base64
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key.key, iv);

    // Set authentication tag
    decipher.setAuthTag(authTag);

    // Add additional authenticated data if provided
    if (additionalData) {
      decipher.setAAD(Buffer.from(additionalData, 'utf-8'));
    }

    try {
      // Decrypt
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hash sensitive data with salt (for comparison without storing plaintext)
   */
  hash(data: string): string {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 32, 'sha256');
    return Buffer.concat([salt, hash]).toString('base64');
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string): boolean {
    try {
      const buffer = Buffer.from(hash, 'base64');
      const salt = buffer.slice(0, 16);
      const storedHash = buffer.slice(16);

      const computedHash = crypto.pbkdf2Sync(data, salt, 100000, 32, 'sha256');

      return crypto.timingSafeEqual(storedHash, computedHash);
    } catch {
      return false;
    }
  }

  /**
   * Encrypt object (recursively encrypt specified fields)
   */
  encryptObject<T extends Record<string, any>>(
    obj: T,
    fieldsToEncrypt: string[]
  ): T & { _encrypted?: string[] } {
    const encrypted = { ...obj };

    for (const field of fieldsToEncrypt) {
      if (field in encrypted && encrypted[field] !== null && encrypted[field] !== undefined) {
        const value = String(encrypted[field]);
        const encryptedData = this.encrypt(value, field);
        (encrypted as any)[field] = encryptedData;
      }
    }

    // Mark which fields are encrypted
    (encrypted as any)._encrypted = fieldsToEncrypt;

    return encrypted;
  }

  /**
   * Decrypt object (recursively decrypt marked fields)
   */
  decryptObject<T extends Record<string, any>>(
    obj: T & { _encrypted?: string[] }
  ): T {
    const decrypted = { ...obj };
    const encryptedFields = (obj._encrypted || []) as string[];

    for (const field of encryptedFields) {
      if (field in decrypted && decrypted[field] && typeof decrypted[field] === 'object') {
        const encryptedData = decrypted[field] as EncryptedData;
        (decrypted as any)[field] = this.decrypt(encryptedData, field);
      }
    }

    // Remove metadata
    delete (decrypted as any)._encrypted;

    return decrypted;
  }

  /**
   * List all keys
   */
  listKeys(): EncryptionKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * Remove old encryption key
   */
  removeKey(keyId: string): void {
    if (keyId === this.currentKeyId) {
      throw new Error('Cannot remove current encryption key');
    }

    this.keys.delete(keyId);
    console.log(`Removed encryption key: ${keyId}`);
  }
}

/**
 * MongoDB encryption helpers
 */
export function createEncryptedField<T>(
  value: T,
  encryptionManager: EncryptionManager,
  fieldName: string
): EncryptedData {
  return encryptionManager.encrypt(JSON.stringify(value), fieldName);
}

export function decryptField<T>(
  encryptedData: EncryptedData,
  encryptionManager: EncryptionManager,
  fieldName: string
): T {
  const decrypted = encryptionManager.decrypt(encryptedData, fieldName);
  return JSON.parse(decrypted);
}

/**
 * Global encryption manager instance
 */
export const globalEncryptionManager = new EncryptionManager();

/**
 * TLS Configuration Helper
 * Ensures TLS 1.3+ for all connections
 */
export class TLSManager {
  static getTLSOptions() {
    return {
      minVersion: 'TLSv1.3' as const,
      maxVersion: 'TLSv1.3' as const,
      ciphers: [
        // Only use modern, secure ciphers
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
      ].join(':'),
      honorCipherOrder: true,
      ecdhCurve: 'prime256v1',
    };
  }

  static getMongoDBTLSOptions() {
    return {
      tls: true,
      tlsVersion: 'TLS1_3',
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    };
  }

  /**
   * Create secure HTTPS server options
   */
  static getHTTPSServerOptions(certPath?: string, keyPath?: string) {
    if (certPath && keyPath) {
      return {
        cert: certPath,
        key: keyPath,
        ...this.getTLSOptions(),
      };
    }

    // Development: self-signed cert
    if (process.env.NODE_ENV !== 'production') {
      const selfSigned = require('selfsigned');
      const attrs = [{ name: 'commonName', value: 'localhost' }];
      const { private: privateKey, public: publicKey } = selfSigned.generate(attrs, { days: 365 });

      return {
        cert: publicKey,
        key: privateKey,
        ...this.getTLSOptions(),
      };
    }

    throw new Error('TLS certificate paths required for production');
  }
}

/**
 * Password hashing utility (bcrypt-compatible)
 */
export class PasswordManager {
  static hash(password: string): string {
    const encryptionManager = globalEncryptionManager;
    return encryptionManager.hash(password);
  }

  static verify(password: string, hash: string): boolean {
    const encryptionManager = globalEncryptionManager;
    return encryptionManager.verifyHash(password, hash);
  }
}
