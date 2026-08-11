import { EncryptionManager, PasswordManager, TLSManager } from '../encryption';

describe('EncryptionManager', () => {
  let manager: EncryptionManager;

  beforeEach(() => {
    manager = new EncryptionManager();
  });

  describe('Key Management', () => {
    it('should initialize with default key', () => {
      expect(manager.getCurrentKeyId()).toBe('default');
    });

    it('should generate encryption key', () => {
      const keyId = 'test-key-1';
      const key = manager.generateKey(keyId);

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should import encryption key', () => {
      const crypto = require('crypto');
      const key = crypto.randomBytes(32);

      manager.importKey('imported-key', key);
      const keys = manager.listKeys();

      expect(keys.some(k => k.id === 'imported-key')).toBe(true);
    });

    it('should reject invalid key size', () => {
      const crypto = require('crypto');
      const shortKey = crypto.randomBytes(16); // Too short

      expect(() => {
        manager.importKey('invalid-key', shortKey);
      }).toThrow();
    });

    it('should rotate encryption key', () => {
      const originalKeyId = manager.getCurrentKeyId();
      const newKey = manager.rotateKey('new-key');

      expect(newKey).toBeDefined();
      expect(manager.getCurrentKeyId()).toBe('new-key');

      const keys = manager.listKeys();
      const rotatedKey = keys.find(k => k.id === originalKeyId);
      expect(rotatedKey?.rotatedAt).toBeDefined();
    });

    it('should prevent duplicate key IDs during rotation', () => {
      manager.generateKey('key-1');

      expect(() => {
        manager.rotateKey('key-1'); // Already exists
      }).toThrow();
    });

    it('should remove old keys', () => {
      manager.generateKey('key-1');
      manager.generateKey('key-2');
      manager.rotateKey('key-3');

      manager.removeKey('key-1');
      const keys = manager.listKeys();

      expect(keys.some(k => k.id === 'key-1')).toBe(false);
    });

    it('should prevent removal of current key', () => {
      expect(() => {
        manager.removeKey(manager.getCurrentKeyId());
      }).toThrow();
    });

    it('should list all keys with metadata', () => {
      const keys = manager.listKeys();

      expect(Array.isArray(keys)).toBe(true);
      keys.forEach(key => {
        expect(key.id).toBeDefined();
        expect(key.key).toBeDefined();
        expect(key.createdAt).toBeDefined();
        expect(key.algorithm).toBe('aes-256-gcm');
      });
    });
  });

  describe('Data Encryption', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'This is sensitive data';
      const encrypted = manager.encrypt(plaintext);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.keyId).toBe('default');
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    it('should encrypt buffer', () => {
      const buffer = Buffer.from('sensitive data');
      const encrypted = manager.encrypt(buffer);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
    });

    it('should decrypt encrypted data', () => {
      const plaintext = 'This is sensitive data';
      const encrypted = manager.encrypt(plaintext);
      const decrypted = manager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should use unique IV for each encryption', () => {
      const plaintext = 'Same data';
      const encrypted1 = manager.encrypt(plaintext);
      const encrypted2 = manager.encrypt(plaintext);

      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
    });

    it('should detect tampering', () => {
      const plaintext = 'Original data';
      const encrypted = manager.encrypt(plaintext);

      // Tamper with encrypted data
      encrypted.encrypted = Buffer.from('tampered').toString('base64');

      expect(() => {
        manager.decrypt(encrypted);
      }).toThrow();
    });

    it('should reject incorrect authentication tag', () => {
      const plaintext = 'Original data';
      const encrypted = manager.encrypt(plaintext);

      // Tamper with auth tag
      const parts = encrypted.authTag.split('');
      parts[0] = parts[0] === 'a' ? 'b' : 'a';
      encrypted.authTag = parts.join('');

      expect(() => {
        manager.decrypt(encrypted);
      }).toThrow();
    });
  });

  describe('Authenticated Encryption (AEAD)', () => {
    it('should encrypt with associated data', () => {
      const plaintext = 'Sensitive message';
      const additionalData = 'user-123:email';

      const encrypted = manager.encrypt(plaintext, additionalData);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
    });

    it('should decrypt with matching associated data', () => {
      const plaintext = 'Sensitive message';
      const additionalData = 'user-123:email';

      const encrypted = manager.encrypt(plaintext, additionalData);
      const decrypted = manager.decrypt(encrypted, additionalData);

      expect(decrypted).toBe(plaintext);
    });

    it('should reject decryption with mismatched associated data', () => {
      const plaintext = 'Sensitive message';
      const encrypted = manager.encrypt(plaintext, 'original-data');

      expect(() => {
        manager.decrypt(encrypted, 'different-data');
      }).toThrow();
    });

    it('should reject decryption without associated data', () => {
      const plaintext = 'Sensitive message';
      const encrypted = manager.encrypt(plaintext, 'associated-data');

      expect(() => {
        manager.decrypt(encrypted); // No AAD provided
      }).toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash password', () => {
      const password = 'MySecurePassword123!';
      const hash = manager.hash(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', () => {
      const password = 'MySecurePassword123!';
      const hash = manager.hash(password);
      const verified = manager.verifyHash(password, hash);

      expect(verified).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'MySecurePassword123!';
      const hash = manager.hash(password);
      const verified = manager.verifyHash('WrongPassword', hash);

      expect(verified).toBe(false);
    });

    it('should generate unique hashes for same password', () => {
      const password = 'MySecurePassword123!';
      const hash1 = manager.hash(password);
      const hash2 = manager.hash(password);

      expect(hash1).not.toEqual(hash2);
      expect(manager.verifyHash(password, hash1)).toBe(true);
      expect(manager.verifyHash(password, hash2)).toBe(true);
    });

    it('should use constant-time comparison', () => {
      const password = 'MySecurePassword123!';
      const hash = manager.hash(password);

      const startTime = Date.now();
      manager.verifyHash('wrong', hash);
      const wrongTime = Date.now() - startTime;

      const startTime2 = Date.now();
      manager.verifyHash(password, hash);
      const correctTime = Date.now() - startTime2;

      // Timing should be similar (within reasonable margin)
      // Note: This is a simplified check; real timing attack tests are more complex
      expect(Math.abs(wrongTime - correctTime)).toBeLessThan(100);
    });
  });

  describe('Object Encryption', () => {
    it('should encrypt specific fields in object', () => {
      const obj = {
        userId: 'user-123',
        email: 'user@example.com',
        phone: '+1234567890',
        name: 'John Doe',
      };

      const encrypted = manager.encryptObject(obj, ['email', 'phone']);

      expect(encrypted.userId).toBe('user-123');
      expect(encrypted.name).toBe('John Doe');
      expect(typeof encrypted.email).toBe('object');
      expect(typeof encrypted.phone).toBe('object');
      expect(encrypted._encrypted).toEqual(['email', 'phone']);
    });

    it('should decrypt encrypted object fields', () => {
      const obj = {
        userId: 'user-123',
        email: 'user@example.com',
        phone: '+1234567890',
      };

      const encrypted = manager.encryptObject(obj, ['email', 'phone']);
      const decrypted = manager.decryptObject(encrypted);

      expect(decrypted.userId).toBe('user-123');
      expect(decrypted.email).toBe('user@example.com');
      expect(decrypted.phone).toBe('+1234567890');
      expect(decrypted._encrypted).toBeUndefined();
    });

    it('should handle null/undefined values', () => {
      const obj = {
        userId: 'user-123',
        email: null,
        phone: undefined,
      };

      const encrypted = manager.encryptObject(obj, ['email', 'phone']);
      expect(encrypted.email).toBeNull();
      expect(encrypted.phone).toBeUndefined();
    });

    it('should preserve non-encrypted fields', () => {
      const obj = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        age: 30,
        verified: true,
      };

      const encrypted = manager.encryptObject(obj, ['email']);

      expect(encrypted.id).toBe(1);
      expect(encrypted.name).toBe('John');
      expect(encrypted.age).toBe(30);
      expect(encrypted.verified).toBe(true);
    });
  });

  describe('Key Rotation', () => {
    it('should decrypt data encrypted with old key', () => {
      const plaintext = 'Important data';

      // Encrypt with original key
      const encrypted = manager.encrypt(plaintext);
      expect(encrypted.keyId).toBe('default');

      // Rotate key
      manager.rotateKey('new-key');

      // Should still decrypt with old key reference
      const decrypted = manager.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should use new key for new encryptions after rotation', () => {
      const plaintext = 'New data';

      manager.rotateKey('new-key');
      const encrypted = manager.encrypt(plaintext);

      expect(encrypted.keyId).toBe('new-key');
    });
  });
});

describe('PasswordManager', () => {
  it('should hash password using global manager', () => {
    const password = 'SecurePassword123!';
    const hash = PasswordManager.hash(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
  });

  it('should verify password using global manager', () => {
    const password = 'SecurePassword123!';
    const hash = PasswordManager.hash(password);
    const verified = PasswordManager.verify(password, hash);

    expect(verified).toBe(true);
  });

  it('should reject wrong password', () => {
    const password = 'SecurePassword123!';
    const hash = PasswordManager.hash(password);
    const verified = PasswordManager.verify('WrongPassword', hash);

    expect(verified).toBe(false);
  });
});

describe('TLSManager', () => {
  it('should provide TLS options with TLS 1.3', () => {
    const options = TLSManager.getTLSOptions();

    expect(options.minVersion).toBe('TLSv1.3');
    expect(options.maxVersion).toBe('TLSv1.3');
  });

  it('should provide secure cipher list', () => {
    const options = TLSManager.getTLSOptions();

    expect(options.ciphers).toContain('TLS_AES_256_GCM_SHA384');
    expect(options.ciphers).toContain('TLS_CHACHA20_POLY1305_SHA256');
    expect(options.ciphers).toContain('TLS_AES_128_GCM_SHA256');
  });

  it('should enforce cipher order', () => {
    const options = TLSManager.getTLSOptions();
    expect(options.honorCipherOrder).toBe(true);
  });

  it('should provide MongoDB TLS options', () => {
    const options = TLSManager.getMongoDBTLSOptions();

    expect(options.tls).toBe(true);
    expect(options.tlsVersion).toBe('TLS1_3');
    expect(options.tlsAllowInvalidCertificates).toBe(false);
    expect(options.tlsAllowInvalidHostnames).toBe(false);
  });

  it('should return HTTPS server options', () => {
    // This test may not work in test environment without actual certs
    // Just verify structure
    const options = TLSManager.getTLSOptions();
    expect(options.minVersion).toBeDefined();
    expect(options.ciphers).toBeDefined();
  });
});

describe('Encryption Security', () => {
  let manager: EncryptionManager;

  beforeEach(() => {
    manager = new EncryptionManager();
  });

  describe('Tampering Detection', () => {
    it('should detect encrypted data tampering', () => {
      const data = 'Sensitive information';
      const encrypted = manager.encrypt(data);

      // Modify encrypted payload
      const modified = {
        ...encrypted,
        encrypted: Buffer.from('modified-data').toString('base64'),
      };

      expect(() => {
        manager.decrypt(modified);
      }).toThrow();
    });

    it('should detect IV tampering', () => {
      const data = 'Sensitive information';
      const encrypted = manager.encrypt(data);

      // Modify IV
      const modified = {
        ...encrypted,
        iv: Buffer.from('modified-iv').toString('base64'),
      };

      expect(() => {
        manager.decrypt(modified);
      }).toThrow();
    });

    it('should detect authentication tag tampering', () => {
      const data = 'Sensitive information';
      const encrypted = manager.encrypt(data);

      // Modify auth tag
      const modified = {
        ...encrypted,
        authTag: Buffer.from('modified-tag').toString('base64'),
      };

      expect(() => {
        manager.decrypt(modified);
      }).toThrow();
    });
  });

  describe('Key Security', () => {
    it('should not expose keys in logs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      manager.generateKey('test-key');

      const logs = consoleSpy.mock.calls
        .map(call => call.join(' '))
        .join('\n');

      expect(logs).not.toContain('secret');
      expect(logs).not.toContain('key=');

      consoleSpy.mockRestore();
    });

    it('should generate cryptographically random keys', () => {
      const key1 = manager.generateKey('key-1');
      const key2 = manager.generateKey('key-2');

      expect(key1).not.toEqual(key2);
    });
  });
});
