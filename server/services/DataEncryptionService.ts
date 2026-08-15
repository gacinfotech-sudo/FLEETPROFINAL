/**
 * DATA ENCRYPTION SERVICE
 * Field-level encryption, key management, key rotation
 * Encryption at rest and in transit support
 */

import crypto from 'crypto';

interface EncryptionKey {
  keyId: string;
  algorithm: string;
  key: Buffer;
  createdAt: Date;
  rotatedAt?: Date;
  isActive: boolean;
}

export class DataEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_SIZE = 32; // 256 bits
  private static readonly IV_SIZE = 16; // 128 bits
  private static readonly AUTH_TAG_SIZE = 16;

  private static encryptionKeys = new Map<string, EncryptionKey>();
  private static sensitiveFields = [
    'password',
    'ssn',
    'aadhar',
    'creditCard',
    'bankAccount',
    'apiKey',
    'secretKey',
    'privateKey',
  ];

  /**
   * Generate a new encryption key
   */
  static async generateKey(keyId: string, tenantId?: string | any): Promise<EncryptionKey> {
    const key = crypto.randomBytes(this.KEY_SIZE);
    const encryptionKey: EncryptionKey = {
      keyId,
      algorithm: this.ALGORITHM,
      key,
      createdAt: new Date(),
      isActive: true,
    };

    const mapKey = tenantId ? `${tenantId}_${keyId}` : keyId;
    this.encryptionKeys.set(mapKey, encryptionKey);

    return encryptionKey;
  }

  /**
   * Encrypt sensitive field
   */
  static encrypt(data: string, keyId: string, tenantId?: string | any): string {
    try {
      const mapKey = tenantId ? `${tenantId}_${keyId}` : keyId;
      const encryptionKey = this.encryptionKeys.get(mapKey);

      if (!encryptionKey) {
        throw new Error(`Encryption key ${mapKey} not found`);
      }

      const iv = crypto.randomBytes(this.IV_SIZE);
      const cipher = crypto.createCipheriv(this.ALGORITHM, encryptionKey.key, iv);

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: keyId:iv:authTag:encrypted
      const encryptedData = [
        keyId,
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted,
      ].join(':');

      return encryptedData;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive field
   */
  static decrypt(encryptedData: string, tenantId?: string | any): string {
    try {
      const [keyId, ivHex, authTagHex, encrypted] = encryptedData.split(':');

      const mapKey = tenantId ? `${tenantId}_${keyId}` : keyId;
      const encryptionKey = this.encryptionKeys.get(mapKey);

      if (!encryptionKey) {
        throw new Error(`Encryption key ${mapKey} not found`);
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, encryptionKey.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt object fields
   */
  static encryptObject(
    obj: Record<string, any>,
    keyId: string,
    tenantId?: string | any,
    fieldsToEncrypt?: string[]
  ): Record<string, any> {
    const encrypted = { ...obj };
    const fields = fieldsToEncrypt || this.sensitiveFields;

    fields.forEach((field) => {
      if (field in encrypted && typeof encrypted[field] === 'string') {
        encrypted[field] = this.encrypt(encrypted[field], keyId, tenantId);
      }
    });

    return encrypted;
  }

  /**
   * Decrypt object fields
   */
  static decryptObject(
    obj: Record<string, any>,
    tenantId?: string | any,
    fieldsToDecrypt?: string[]
  ): Record<string, any> {
    const decrypted = { ...obj };
    const fields = fieldsToDecrypt || this.sensitiveFields;

    fields.forEach((field) => {
      if (
        field in decrypted &&
        typeof decrypted[field] === 'string' &&
        decrypted[field].includes(':')
      ) {
        try {
          decrypted[field] = this.decrypt(decrypted[field], tenantId);
        } catch (error) {
          // If decryption fails, leave field as is
          console.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    });

    return decrypted;
  }

  /**
   * Rotate encryption key
   */
  static async rotateKey(keyId: string, tenantId?: string | any): Promise<EncryptionKey> {
    const mapKey = tenantId ? `${tenantId}_${keyId}` : keyId;
    const oldKey = this.encryptionKeys.get(mapKey);

    if (!oldKey) {
      throw new Error(`Encryption key ${mapKey} not found`);
    }

    // Mark old key as inactive
    oldKey.isActive = false;
    oldKey.rotatedAt = new Date();

    // Generate new key
    const newKey = await this.generateKey(keyId, tenantId);

    return newKey;
  }

  /**
   * Get active key for tenant
   */
  static getActiveKey(keyId: string, tenantId?: string | any): EncryptionKey | null {
    const mapKey = tenantId ? `${tenantId}_${keyId}` : keyId;
    const key = this.encryptionKeys.get(mapKey);

    return key && key.isActive ? key : null;
  }

  /**
   * Hash sensitive data (one-way)
   */
  static hash(data: string, salt?: string): string {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, saltToUse, 100000, 64, 'sha512');
    return `${saltToUse}:${hash.toString('hex')}`;
  }

  /**
   * Verify hashed data
   */
  static verifyHash(data: string, hashedData: string): boolean {
    const [salt, hash] = hashedData.split(':');
    const newHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
    return hash === newHash.toString('hex');
  }

  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Get encryption statistics
   */
  static getEncryptionStats(): Record<string, any> {
    const activeKeys = Array.from(this.encryptionKeys.values()).filter((k) => k.isActive);
    const inactiveKeys = Array.from(this.encryptionKeys.values()).filter((k) => !k.isActive);

    return {
      totalKeys: this.encryptionKeys.size,
      activeKeys: activeKeys.length,
      inactiveKeys: inactiveKeys.length,
      algorithm: this.ALGORITHM,
      keySize: this.KEY_SIZE,
      lastKeyRotation: activeKeys.length > 0 ? activeKeys[0].rotatedAt : null,
    };
  }

  /**
   * Is field sensitive
   */
  static isSensitiveField(fieldName: string): boolean {
    return this.sensitiveFields.includes(fieldName);
  }

  /**
   * Add custom sensitive field
   */
  static addSensitiveField(fieldName: string): void {
    if (!this.sensitiveFields.includes(fieldName)) {
      this.sensitiveFields.push(fieldName);
    }
  }
}

export default DataEncryptionService;
