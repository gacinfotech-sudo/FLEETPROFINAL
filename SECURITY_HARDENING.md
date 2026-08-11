# Security Hardening Implementation Guide

## Overview

This document describes the comprehensive security hardening for FleetPro with three core components:

1. **Redis-backed Rate Limiting** - Per-user, per-channel, per-trigger rate limiting with DDoS protection
2. **Webhook Security** - HMAC-SHA256 signatures, IP whitelisting, exponential backoff retry
3. **Notification Encryption** - AES-256-GCM end-to-end encryption, at-rest encryption, TLS 1.3+

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Express Server                         │
├─────────────────────────────────────────────────────────┤
│  Rate Limiting Middleware                               │
│  ├─ Redis-backed per-user limiter                      │
│  ├─ Per-channel rate limits (email, SMS, push)         │
│  ├─ Per-trigger limits (booking, payment events)       │
│  └─ DDoS protection with IP blocking                   │
├─────────────────────────────────────────────────────────┤
│  Encryption Layer                                       │
│  ├─ AES-256-GCM symmetric encryption                   │
│  ├─ HMAC-SHA256 authentication                         │
│  ├─ Key rotation support                               │
│  └─ At-rest MongoDB encryption                         │
├─────────────────────────────────────────────────────────┤
│  Webhook Management                                     │
│  ├─ HMAC-SHA256 signature verification                 │
│  ├─ Timestamp validation (replay attack prevention)    │
│  ├─ IP whitelist enforcement                           │
│  ├─ Exponential backoff retry (1s → 2s → 4s → 8s)    │
│  └─ Secret rotation with grace period                  │
├─────────────────────────────────────────────────────────┤
│  MongoDB                    │  Redis                    │
│  ├─ Encrypted fields        │  ├─ Rate limit counters  │
│  ├─ TLS 1.3+ connection     │  ├─ Webhook delivery     │
│  └─ At-rest encryption      │  └─ Session store        │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Redis-Backed Rate Limiting

#### File: `server/security/rateLimiting.ts`

**Key Classes:**
- `RateLimiter` - Core rate limiting with Redis or in-memory fallback
- `InMemoryStore` - Fallback when Redis unavailable
- `RedisStore` - Redis-backed persistent rate limiting
- `AdaptiveRateLimiter` - Adjust limits based on system load

**Pre-configured Limiters:**

```typescript
// Login attempts: 5 per 5 minutes
createLoginRateLimiter(redisClient)

// Per-user API calls: 30 per minute
createPerUserRateLimiter(redisClient)

// Per-channel (email/SMS/push): 10 per minute
createPerChannelRateLimiter('email', redisClient)

// Per-trigger event: 5 per minute
createPerTriggerRateLimiter('booking.created', redisClient)

// IP-based protection: 100 per minute
createIPBasedRateLimiter(100, redisClient)

// Webhook traffic: 100 per minute
createWebhookRateLimiter('webhook-id', redisClient)
```

**Usage Example:**

```typescript
import { createLoginRateLimiter } from './security/rateLimiting';
import { createRedisClient } from './security/rateLimiting';

// Initialize
const redisClient = await createRedisClient();
const loginLimiter = createLoginRateLimiter(redisClient);

// Apply middleware
app.post('/api/auth/login', loginLimiter.middleware(), loginHandler);
```

**Graceful Degradation:**
- If Redis is unavailable, falls back to in-memory store
- Continues operation without rate limiting (degraded state logged)
- Reconnection attempts automatic

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2026-08-12T12:30:00Z
```

### 2. Webhook Security

#### File: `server/security/webhookSecurity.ts`

**Key Classes:**
- `WebhookSigner` - HMAC-SHA256 signature generation and verification
- `WebhookManager` - Webhook registration, delivery, and retry management
- `webhookVerificationMiddleware` - Express middleware for signature verification

**Signature Format:**

```
X-Webhook-ID: webhook-id
X-Webhook-Signature: sha256=abc123def456...
X-Webhook-Timestamp: 1691847600
X-Webhook-Delivery: delivery-uuid
X-Webhook-Event: booking.created
```

**Signature Calculation:**

```
signatureData = "{timestamp}.{json_payload}"
signature = HMAC-SHA256(signatureData, webhook_secret)
```

**Registration:**

```typescript
import { globalWebhookManager } from './security/webhookSecurity';

globalWebhookManager.registerWebhook({
  id: 'webhook-booking-events',
  url: 'https://customer.com/webhooks/bookings',
  secret: crypto.randomBytes(32).toString('hex'),
  ipWhitelist: ['203.0.113.42', '198.51.100.89'], // Optional
  events: ['booking.created', 'booking.updated', 'booking.cancelled'],
  maxRetries: 3,
  retryBackoffMs: 1000,
  headers: {
    'Authorization': 'Bearer customer-token',
    'Custom-Header': 'value'
  }
});
```

**Verification Middleware:**

```typescript
import { webhookVerificationMiddleware } from './security/webhookSecurity';

app.post(
  '/api/webhooks/receive',
  webhookVerificationMiddleware(globalWebhookManager),
  async (req, res) => {
    const webhook = (req as any).webhook;
    // Process webhook
  }
);
```

**Delivery with Retry:**

```typescript
// Queue webhook delivery
const delivery = await globalWebhookManager.queueWebhookDelivery(
  'webhook-id',
  'booking.created',
  {
    bookingId: 123,
    customerId: 456,
    amount: 1000,
    timestamp: new Date().toISOString()
  }
);

// Automatic retry with exponential backoff:
// Attempt 1: Immediate
// Attempt 2: +1s delay
// Attempt 3: +2s delay
// Attempt 4: +4s delay (then marked failed)
```

**Secret Rotation:**

```typescript
// Rotate secret (old secret continues to work for 24 hours)
const newSecret = globalWebhookManager.rotateWebhookSecret('webhook-id');

// Store newSecret securely and communicate to customer
// Customer updates their signature verification within 24 hours
// After 24 hours, old secret is rejected
```

**Security Features:**

- **Replay Attack Prevention**: Timestamp validation (5-minute window)
- **Timing Attack Protection**: Constant-time signature comparison
- **Key Rotation Grace Period**: Old secrets work for 24 hours
- **IP Whitelisting**: Optional IP validation for webhook endpoints
- **Exponential Backoff**: Prevents overwhelming customer endpoints
- **Delivery Audit Trail**: All delivery attempts logged

### 3. Notification Encryption

#### File: `server/security/encryption.ts`

**Encryption Algorithm:** AES-256-GCM (AEAD)

**Key Classes:**
- `EncryptionManager` - Symmetric encryption with key rotation
- `TLSManager` - TLS 1.3+ configuration helpers
- `PasswordManager` - Secure password hashing

**Initialization:**

```typescript
import { globalEncryptionManager } from './security/encryption';

// Manager auto-initializes with default key
// For production, set ENCRYPTION_KEY env var:
process.env.ENCRYPTION_KEY = Buffer.from(crypto.randomBytes(32)).toString('base64');
```

**Basic Encryption:**

```typescript
// Encrypt plaintext
const plaintext = 'sensitive-customer-phone-number';
const encrypted = globalEncryptionManager.encrypt(plaintext);

// Result:
// {
//   encrypted: "base64-encoded-ciphertext",
//   iv: "base64-encoded-iv",
//   authTag: "base64-encoded-auth-tag",
//   keyId: "default",
//   algorithm: "aes-256-gcm"
// }

// Store encrypted data in database
await Notification.updateOne({ _id }, {
  phoneNumber: encrypted,
  _encrypted: ['phoneNumber']
});

// Decrypt on retrieval
const decrypted = globalEncryptionManager.decrypt(encrypted);
// → 'sensitive-customer-phone-number'
```

**Authenticated Encryption (AEAD):**

```typescript
// Encrypt with additional authenticated data
const plaintext = 'sensitive-message';
const additionalData = `user-${userId}:notification`;

const encrypted = globalEncryptionManager.encrypt(plaintext, additionalData);

// During decryption, AEAD validates the context
const decrypted = globalEncryptionManager.decrypt(encrypted, additionalData);
// If additionalData doesn't match, decryption fails (AEAD protection)
```

**Object Encryption:**

```typescript
const notification = {
  id: 'notif-123',
  userId: 'user-456',
  email: 'customer@example.com',
  phone: '+1-234-567-8900',
  message: 'Your booking is confirmed',
  timestamp: Date.now()
};

// Encrypt sensitive fields
const encrypted = globalEncryptionManager.encryptObject(
  notification,
  ['email', 'phone'] // Which fields to encrypt
);

// Stored in DB with _encrypted metadata
// {
//   id: 'notif-123',
//   userId: 'user-456',
//   email: { encrypted, iv, authTag, keyId, algorithm },
//   phone: { encrypted, iv, authTag, keyId, algorithm },
//   message: 'Your booking is confirmed',
//   timestamp: Date.now(),
//   _encrypted: ['email', 'phone']
// }

// Retrieve and decrypt
const decrypted = globalEncryptionManager.decryptObject(stored);
// → Original notification with plaintext email and phone
```

**Key Rotation:**

```typescript
// Generate new key
const newKeyId = 'keys-rotation-' + Date.now();
const newKey = globalEncryptionManager.rotateKey(newKeyId);

// Store newKey securely (HSM recommended)
// Old key automatically kept for decryption of existing data
// New data encrypted with new key

// Re-encrypt old data (during maintenance window):
const oldData = await Notification.findOne({ /* old records */ });
const decrypted = globalEncryptionManager.decrypt(oldData.email);
const reEncrypted = globalEncryptionManager.encrypt(decrypted, 'email');
await Notification.updateOne({ _id: oldData._id }, { email: reEncrypted });
```

**Password Hashing:**

```typescript
import { PasswordManager } from './security/encryption';

// Hash password on registration
const hashedPassword = PasswordManager.hash(userPassword);
await User.create({ email, password: hashedPassword });

// Verify on login
const user = await User.findOne({ email });
const passwordValid = PasswordManager.verify(loginPassword, user.password);

if (passwordValid) {
  // Login successful
}
```

**TLS Configuration:**

```typescript
import https from 'https';
import { TLSManager } from './security/encryption';

// For development (self-signed):
const httpsOptions = TLSManager.getHTTPSServerOptions();
https.createServer(httpsOptions, app).listen(443);

// For MongoDB:
const mongoDBOptions = TLSManager.getMongoDBTLSOptions();
const mongoURI = `mongodb+srv://user:pass@cluster.mongodb.net/?${
  Object.entries(mongoDBOptions)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}`;

// Enforces TLS 1.3+ for all connections
```

## Environment Configuration

Create `.env.security`:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Encryption
ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Webhook Configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_BACKOFF_MS=1000
WEBHOOK_IP_WHITELIST=203.0.113.42,198.51.100.89

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=300000

# TLS
TLS_CERT_PATH=/etc/ssl/certs/server.crt
TLS_KEY_PATH=/etc/ssl/private/server.key
FORCE_HTTPS_REDIRECT=true

# Security
NODE_ENV=production
ALLOW_NETWORK_TESTING=false
```

## Integration Points

### Rate Limiting Middleware Integration

```typescript
// In server/index.ts
import { 
  createLoginRateLimiter,
  createPerUserRateLimiter,
  createRedisClient
} from './security/rateLimiting';

// Initialize
const redisClient = await createRedisClient();
const loginLimiter = createLoginRateLimiter(redisClient);
const userLimiter = createPerUserRateLimiter(redisClient);

// Apply globally
app.use('/api/', userLimiter.middleware());

// Apply to specific routes
app.post('/api/auth/login', loginLimiter.middleware(), loginHandler);
```

### Webhook Integration

```typescript
// In server/integrations/webhooks.ts
import { globalWebhookManager } from '../security/webhookSecurity';

// On user creates webhook via dashboard
export async function createWebhook(userId: string, config: WebhookConfig) {
  const secret = crypto.randomBytes(32).toString('hex');
  
  globalWebhookManager.registerWebhook({
    ...config,
    secret,
    enabled: true
  });

  // Store config in database for persistence
  await WebhookRegistry.create({
    userId,
    webhookId: config.id,
    config: { ...config, secret },
    status: 'active'
  });

  // Return secret to user (one-time display)
  return secret;
}

// On event emission
export async function emitWebhookEvent(event: string, payload: any) {
  // Find all active webhooks listening to this event
  const webhooks = await WebhookRegistry.find({ events: event });

  for (const webhook of webhooks) {
    await globalWebhookManager.queueWebhookDelivery(
      webhook.webhookId,
      event,
      payload
    );
  }
}
```

### Encryption Integration with MongoDB

```typescript
// In server/models/Notification.ts
import { globalEncryptionManager } from '../security/encryption';

const notificationSchema = new Schema({
  userId: String,
  type: String,
  email: {
    type: Mixed,
    get: (encrypted) => {
      if (!encrypted || !encrypted.encrypted) return encrypted;
      try {
        return globalEncryptionManager.decrypt(encrypted, 'email');
      } catch (error) {
        console.error('Decryption error for email:', error);
        return null;
      }
    },
    set: (plaintext) => {
      if (!plaintext) return plaintext;
      return globalEncryptionManager.encrypt(String(plaintext), 'email');
    }
  },
  phone: {
    type: Mixed,
    get: (encrypted) => {
      if (!encrypted || !encrypted.encrypted) return encrypted;
      try {
        return globalEncryptionManager.decrypt(encrypted, 'phone');
      } catch (error) {
        console.error('Decryption error for phone:', error);
        return null;
      }
    },
    set: (plaintext) => {
      if (!plaintext) return plaintext;
      return globalEncryptionManager.encrypt(String(plaintext), 'phone');
    }
  },
  message: String,
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

// Usage
const notification = new Notification({
  userId: 'user-123',
  type: 'booking-confirmation',
  email: 'customer@example.com', // Automatically encrypted on save
  phone: '+1-234-567-8900',      // Automatically encrypted on save
  message: 'Booking confirmed!'
});

await notification.save();
// Database stores encrypted values

const retrieved = await Notification.findById(notification._id);
console.log(retrieved.email); // Automatically decrypted
// → 'customer@example.com'
```

## Security Audit Checklist

### Pre-Deployment

- [ ] Redis configured and accessible
- [ ] ENCRYPTION_KEY set and stored securely (HSM recommended)
- [ ] TLS certificates installed (/etc/ssl/certs/)
- [ ] HTTPS enforced in production
- [ ] Rate limit thresholds appropriate for your workload
- [ ] Webhook secrets generated and communicated securely
- [ ] MongoDB connection uses TLS 1.3+
- [ ] All tests passing: `npm test server/security/`

### Rate Limiting

- [ ] Login endpoint rate limited to 5 attempts/5 minutes
- [ ] Per-user request limit enforced (30 req/min)
- [ ] Per-channel limits active (email, SMS, push)
- [ ] Per-trigger limits active (booking, payment)
- [ ] DDoS protection monitored (blocked IPs logged)
- [ ] Redis connection monitored for failures
- [ ] Rate limit bypass possible for admin operations
- [ ] Response headers include rate limit info

### Webhook Security

- [ ] All outbound webhooks signed with HMAC-SHA256
- [ ] Timestamp validation prevents replay attacks (5-min window)
- [ ] IP whitelist enforced (if configured)
- [ ] Exponential backoff prevents customer endpoint overload
- [ ] Delivery attempts logged for audit trail
- [ ] Secret rotation tested (grace period working)
- [ ] Failed webhooks monitored and alerted
- [ ] Webhook payloads validated before delivery

### Encryption

- [ ] Sensitive fields encrypted in database
- [ ] AEAD protects against tampering
- [ ] Key rotation tested and working
- [ ] Old keys retained for decryption
- [ ] Passwords hashed with PBKDF2 + salt
- [ ] TLS 1.3+ for all database connections
- [ ] Encryption keys never logged
- [ ] Backup keys stored securely

### Monitoring & Alerts

- [ ] Rate limit violations logged
- [ ] Failed webhook deliveries alerted
- [ ] Encryption errors monitored
- [ ] TLS certificate expiration monitored
- [ ] Redis connection failures logged
- [ ] Suspicious activity detected (repeated failures)
- [ ] Key rotation completion verified
- [ ] Audit logs stored separately

## Performance Considerations

### Rate Limiting

- **Redis latency**: ~1-2ms per check (negligible)
- **In-memory fallback**: <1ms (no network)
- **Recommendation**: Monitor Redis latency, fallback graceful

### Encryption

- **Encryption overhead**: ~2-5ms per field (negligible)
- **Decryption overhead**: ~2-5ms per field (negligible)
- **Recommendation**: Encrypt on application layer, not at database level

### Webhooks

- **Signature generation**: ~1ms per webhook
- **Retry queue**: Runs asynchronously (non-blocking)
- **Recommendation**: Monitor delivery queue size

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis connectivity
redis-cli ping
# → PONG

# Monitor Redis commands
redis-cli monitor

# Check memory usage
redis-cli info memory
```

### Encryption Decryption Failures

```typescript
// Check key availability
const keys = globalEncryptionManager.listKeys();
console.log('Available keys:', keys.map(k => k.id));

// Verify encrypted data structure
if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
  console.error('Invalid encrypted data structure');
}

// Check key ID matches
if (!globalEncryptionManager.getWebhook(encryptedData.keyId)) {
  console.error(`Key not found: ${encryptedData.keyId}`);
}
```

### Webhook Delivery Failures

```typescript
// Check delivery status
const delivery = globalWebhookManager.getDeliveryStatus(deliveryId);
console.log('Delivery attempts:', delivery.attempts);
console.log('Last error:', delivery.response?.body);

// Manually retry
if (delivery.status === 'failed') {
  await globalWebhookManager.queueWebhookDelivery(
    delivery.webhookId,
    delivery.event,
    delivery.payload
  );
}
```

## Production Deployment Checklist

1. **Before Deployment**
   - [ ] All security tests passing
   - [ ] Redis configured and tested
   - [ ] Encryption keys generated and backed up
   - [ ] TLS certificates installed
   - [ ] Rate limits tuned for production traffic
   - [ ] Webhook endpoints tested
   - [ ] Monitoring and alerting configured

2. **Deployment**
   - [ ] Deploy with `NODE_ENV=production`
   - [ ] Enable HTTPS redirect
   - [ ] Configure Redis with authentication
   - [ ] Set environment variables securely
   - [ ] Monitor logs for errors
   - [ ] Run health checks

3. **Post-Deployment**
   - [ ] Verify rate limits working
   - [ ] Test webhook delivery
   - [ ] Monitor encryption performance
   - [ ] Verify backup strategy
   - [ ] Schedule key rotation (quarterly recommended)
   - [ ] Audit webhook endpoints

## References

- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [NIST Encryption Guidelines](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Webhook Security Best Practices](https://webhooks.fyi/security/)
- [Redis Security](https://redis.io/docs/management/security/)
