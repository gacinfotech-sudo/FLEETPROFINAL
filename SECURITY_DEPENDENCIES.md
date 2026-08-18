# Security Hardening Dependencies

## Required Packages

The following packages are needed for the security hardening implementation:

### 1. Redis Client (for rate limiting)

```json
{
  "redis": "^4.6.0",
  "hiredis": "^0.5.0"
}
```

**Installation:**
```bash
npm install redis hiredis
```

**Why:**
- `redis`: Official Node.js Redis client with async/await support
- `hiredis`: C parser for Redis protocol (improves performance)

**Current Status:** Check if already installed:
```bash
npm list redis
```

---

### 2. Crypto (built-in Node.js)

No installation needed - `crypto` is built into Node.js 14+

Used for:
- HMAC-SHA256 signatures
- AES-256-GCM encryption
- Random key generation
- Password hashing (PBKDF2)
- Timing-safe comparison

---

### 3. Axios (for webhook delivery)

```json
{
  "axios": "^1.6.0"
}
```

**Installation:**
```bash
npm install axios
```

**Why:**
- HTTP client for delivering webhooks
- Configurable timeouts (10s for webhooks)
- Proper error handling for retries

**Current Status:** Usually already installed for API calls

---

## Optional Dependencies

### 1. dotenv (for environment variables)

```json
{
  "dotenv": "^16.0.0"
}
```

**Why:** Load `.env.security` file

**Current Status:** Usually already installed

---

### 2. pino or winston (for logging)

Already likely installed. Continue using existing logger.

---

## Peer Dependencies

Make sure these are installed (usually included):

```json
{
  "express": "^4.18.0",
  "typescript": "^5.0.0",
  "@types/node": "^20.0.0",
  "@types/express": "^4.17.0"
}
```

---

## Installation Steps

### Step 1: Check Current Installation

```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Check for Redis
npm list redis 2>/dev/null | head -5

# Check for Axios
npm list axios 2>/dev/null | head -5
```

### Step 2: Install Missing Packages

```bash
# Install Redis client
npm install redis@^4.6.0 hiredis@^0.5.0

# Install/update Axios if needed
npm install axios@^1.6.0

# Install crypto type definitions (if missing)
npm install --save-dev @types/node
```

### Step 3: Verify Installation

```bash
npm list redis axios
```

Expected output:
```
├── redis@4.6.x
├── axios@1.6.x
└── hiredis@0.5.x
```

---

## Production Dependencies Summary

Add to `package.json`:

```json
{
  "dependencies": {
    "redis": "^4.6.0",
    "hiredis": "^0.5.0",
    "axios": "^1.6.0",
    "express": "^4.18.0",
    "express-rate-limit": "^7.5.1",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Environment Variables Configuration

Create `.env.security`:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Encryption
ENCRYPTION_KEY=<base64-encoded-32-byte-key>
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Rate Limiting Thresholds
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_RATE_LIMIT_MAX=5
LOGIN_RATE_LIMIT_WINDOW_MS=300000

# Webhook Configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_BACKOFF_MS=1000
WEBHOOK_IP_WHITELIST=203.0.113.42,198.51.100.89

# TLS/HTTPS
NODE_ENV=production
FORCE_HTTPS_REDIRECT=true
TLS_CERT_PATH=/etc/ssl/certs/server.crt
TLS_KEY_PATH=/etc/ssl/private/server.key

# Security
ALLOW_NETWORK_TESTING=false
```

---

## Docker Configuration

If using Docker, add to `Dockerfile`:

```dockerfile
# Install Redis client and dependencies
RUN npm install redis@^4.6.0 hiredis@^0.5.0 axios@^1.6.0

# Copy security configuration
COPY .env.security /app/.env.security

# Run security tests before deployment
RUN npm run test:security
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "443:443"
    depends_on:
      - redis
    environment:
      REDIS_URL: redis://redis:6379
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      NODE_ENV: production
    volumes:
      - /etc/ssl/certs:/etc/ssl/certs:ro

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Development vs. Production

### Development Mode

```bash
# Use in-memory rate limiting (no Redis)
# Use generated encryption key (auto-initialized)
npm run dev

# Run security tests
npm test -- server/security/

# Run with mock Redis
docker-compose -f docker-compose.dev.yml up
```

### Production Mode

```bash
# Must have Redis configured
# Must have ENCRYPTION_KEY set
# Must have TLS certificates
npm run build
NODE_ENV=production npm start
```

---

## Security Best Practices for Dependencies

### 1. Audit Dependencies

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Run regular audits
npm audit --production
```

### 2. Update Dependencies

```bash
# Check for updates
npm outdated

# Update minor versions
npm update

# Update major versions (carefully)
npm install redis@latest
```

### 3. Pin Versions

In production, use specific versions:

```json
{
  "redis": "4.6.0",
  "axios": "1.6.0",
  "hiredis": "0.5.0"
}
```

Use `npm ci` for reproducible installs:

```bash
npm ci  # Installs exact versions from package-lock.json
```

---

## Testing Dependencies

For running security tests:

```bash
npm install --save-dev \
  @types/jest \
  @types/node \
  jest \
  ts-jest \
  supertest \
  @types/supertest
```

Run tests:

```bash
# Run all security tests
npm test -- server/security/

# Run with coverage
npm test -- server/security/ --coverage

# Watch mode
npm test -- server/security/ --watch
```

---

## Performance Optimization

### Redis Connection Pooling

Redis client auto-creates connection pool. Configuration:

```typescript
const client = redis.createClient({
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
});

// Connection pool settings
client.on('connect', () => console.log('Redis connected'));
client.on('error', (err) => console.error('Redis error:', err));
client.on('reconnecting', () => console.log('Reconnecting...'));
```

### Hiredis Performance

If Redis performance is critical:

```bash
npm install hiredis

# Hiredis provides ~40% performance improvement for parsing
```

Verify hiredis is loaded:

```bash
node -e "const redis = require('redis'); console.log('Using hiredis:', redis.parser)"
```

---

## Monitoring Dependencies

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Checking security dependencies..."

npm list redis > /dev/null 2>&1 && echo "✓ redis" || echo "✗ redis"
npm list axios > /dev/null 2>&1 && echo "✓ axios" || echo "✗ axios"
npm list hiredis > /dev/null 2>&1 && echo "✓ hiredis" || echo "✗ hiredis"

# Test Redis connection
redis-cli ping > /dev/null 2>&1 && echo "✓ Redis connection" || echo "✗ Redis connection"

# Verify encryption key
[ -n "$ENCRYPTION_KEY" ] && echo "✓ Encryption key set" || echo "✗ Encryption key not set"

echo "Dependencies check complete"
```

Run:
```bash
chmod +x health-check.sh
./health-check.sh
```

---

## Troubleshooting

### Redis Installation Issues

```bash
# macOS
brew install redis

# Linux
apt-get install redis-server

# Verify
redis-cli ping
# → PONG
```

### Hiredis Compilation Issues

```bash
# If hiredis fails to compile:
# 1. Install build tools
npm install --global windows-build-tools  # Windows

# 2. Install with npm fallback
npm install redis --no-optional

# 3. Skip hiredis (performance reduced but functional)
npm install redis
# Hiredis is optional; code works without it
```

### Module Import Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify TypeScript definitions
npm list @types/node
```

---

## Upgrade Path

### From Existing Installation

If you have older versions:

```bash
# Current versions
npm list redis axios

# Update to required versions
npm install redis@^4.6.0 --save
npm install axios@^1.6.0 --save

# Run tests
npm test -- server/security/
```

### Migration Checklist

- [ ] Backup current `package.json` and `package-lock.json`
- [ ] Install new dependencies: `npm install redis@^4.6.0 hiredis@^0.5.0`
- [ ] Run `npm audit` to check for vulnerabilities
- [ ] Run security tests: `npm test -- server/security/`
- [ ] Test rate limiting middleware in staging
- [ ] Test webhook delivery in staging
- [ ] Test encryption/decryption in staging
- [ ] Deploy to production

---

## Version Compatibility

### Node.js Version

Requires Node.js 14+ (crypto module with AES-256-GCM support)

```bash
node --version
# Should be v14.0.0 or higher
```

### TypeScript Version

Requires TypeScript 4.5+

```bash
npm list typescript
```

### Express Version

Requires Express 4.17+

```bash
npm list express
```

---

## Summary

### Minimal Installation

```bash
npm install redis@^4.6.0 hiredis@^0.5.0 axios@^1.6.0
```

### With Development Tools

```bash
npm install redis@^4.6.0 hiredis@^0.5.0 axios@^1.6.0
npm install --save-dev @types/node @types/jest jest ts-jest
```

### Full Production Setup

```bash
npm install redis@^4.6.0 hiredis@^0.5.0 axios@^1.6.0
npm install --save-dev @types/node @types/jest jest ts-jest
npm audit
npm test -- server/security/
```

All dependencies are production-ready and widely used in enterprise Node.js applications.
