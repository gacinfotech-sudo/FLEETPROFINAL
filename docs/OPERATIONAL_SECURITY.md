# FleetPro Security & Compliance Guide

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Access Control](#access-control)
2. [Secrets Management](#secrets-management)
3. [Network Security](#network-security)
4. [Data Security](#data-security)
5. [Audit & Compliance](#audit--compliance)
6. [Incident Response](#incident-response)

---

## Access Control

### User Authentication

#### Initial Setup

```bash
# 1. Create admin user
mongosh --eval "
  db.users.create({
    username: 'admin',
    email: 'admin@fleetpro.example.com',
    password_hash: bcrypt('initial_password'),
    role: 'admin',
    created_at: new Date(),
    last_login: null,
    status: 'active'
  })
"

# 2. Change default password on first login
# User must change password within 24 hours

# 3. Enable 2FA for admin
# Multi-factor authentication: SMS, TOTP, or authenticator app
```

#### Login Procedure

```javascript
// server/auth/login.ts

import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

export async function login(email: string, password: string) {
  // 1. Find user
  const user = await db.users.findOne({email})
  if (!user) {
    recordFailedAttempt(email)
    return {error: "Invalid credentials"}
  }

  // 2. Check password
  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    recordFailedAttempt(email)
    return {error: "Invalid credentials"}
  }

  // 3. Check if account is locked (5+ failed attempts)
  if (user.login_attempts > 5) {
    return {error: "Account locked. Contact support"}
  }

  // 4. Verify 2FA if enabled
  if (user.two_factor_enabled) {
    // Return challenge
    return {
      success: false,
      requires_2fa: true,
      challenge_id: generateChallenge()
    }
  }

  // 5. Generate JWT token
  const token = jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {expiresIn: '24h'}
  )

  // 6. Clear failed attempts
  await db.users.updateOne(
    {_id: user._id},
    {
      login_attempts: 0,
      last_login: new Date()
    }
  )

  return {
    success: true,
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role
    }
  }
}

function recordFailedAttempt(email: string) {
  db.users.updateOne(
    {email},
    {
      $inc: {login_attempts: 1},
      $set: {last_failed_attempt: new Date()}
    }
  )
}
```

### Two-Factor Authentication (2FA)

```javascript
// server/auth/2fa.ts

export async function setup2FA(userId: string) {
  // 1. Generate secret
  const secret = speakeasy.generateSecret({
    name: `FleetPro (${user.email})`,
    length: 32
  })

  // 2. Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url)

  // 3. Return to user
  return {
    qr_code: qrCode,
    secret: secret.base32  // Save securely
  }
}

export async function verify2FA(
  userId: string,
  code: string,
  secret: string
) {
  // 1. Verify token
  const isValid = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: code,
    window: 2  // Allow 30-second window
  })

  if (!isValid) {
    return {error: "Invalid code"}
  }

  // 2. Save 2FA enabled
  await db.users.updateOne(
    {_id: userId},
    {two_factor_enabled: true}
  )

  return {success: true}
}
```

### Role-Based Access Control (RBAC)

```javascript
// server/auth/rbac.ts

const roles = {
  admin: {
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'users:delete',
      'bookings:read',
      'bookings:update',
      'bookings:delete',
      'reports:read',
      'settings:update'
    ]
  },
  manager: {
    permissions: [
      'bookings:read',
      'bookings:update',
      'drivers:read',
      'drivers:update',
      'vehicles:read',
      'reports:read'
    ]
  },
  user: {
    permissions: [
      'bookings:read',
      'bookings:create'
    ]
  },
  driver: {
    permissions: [
      'bookings:read',
      'location:update'
    ]
  }
}

// Middleware
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    const userRole = roles[user.role]

    if (!userRole || !userRole.permissions.includes(permission)) {
      return res.status(403).json({error: "Forbidden"})
    }

    next()
  }
}

// Usage
app.delete('/api/bookings/:id', 
  requirePermission('bookings:delete'),
  async (req, res) => {
    // ... delete booking
  }
)
```

### API Key Management

```bash
# Generate API key
mongosh --eval "
  const crypto = require('crypto')
  const key = crypto.randomBytes(32).toString('hex')
  
  db.api_keys.create({
    key,
    hash: crypto.createHash('sha256').update(key).digest('hex'),
    name: 'Mobile App Integration',
    created_by: 'admin@example.com',
    created_at: new Date(),
    last_used: null,
    expires_at: new Date(Date.now() + 365*24*60*60*1000),  // 1 year
    scopes: ['bookings:read', 'bookings:create'],
    rate_limit: 1000  // requests/hour
  })
  
  console.log('API Key:', key)
"

# Verify API key
mongosh --eval "
  const crypto = require('crypto')
  const key = 'provided_key'
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  
  const apiKey = db.api_keys.findOne({hash})
  if (!apiKey) {
    console.log('Invalid key')
  } else if (apiKey.expires_at < new Date()) {
    console.log('Expired key')
  } else {
    console.log('Valid key')
  }
"

# Rotate API key
# 1. Create new key (same scopes)
# 2. Notify clients
# 3. Revoke old key after grace period

# Revoke API key
mongosh --eval "
  db.api_keys.updateOne(
    {key: 'old_key'},
    {revoked_at: new Date()}
  )
"
```

### SSH Key Rotation

```bash
#!/bin/bash
# /usr/local/bin/rotate-ssh-keys.sh

echo "=== SSH Key Rotation ==="

# 1. Generate new key pair
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_new -N ""

# 2. Add new public key to authorized_keys
cat ~/.ssh/id_ed25519_new.pub >> ~/.ssh/authorized_keys

# 3. Test new key works
ssh -i ~/.ssh/id_ed25519_new user@server "echo OK"

# 4. Remove old key (after verification)
# rm ~/.ssh/id_ed25519
# sed -i '/old-key-comment/d' ~/.ssh/authorized_keys

# 5. Update deployment scripts
# Update all CI/CD, monitoring, and deployment tools

# 6. Log rotation
mongosh --eval "
  db.security_events.create({
    event: 'ssh_key_rotated',
    timestamp: new Date(),
    user: 'ops-team',
    old_key_fingerprint: '...',
    new_key_fingerprint: '...'
  })
"
```

---

## Secrets Management

### Environment Variable Security

```bash
# .env.production - DO NOT COMMIT
NODE_ENV=production
PORT=5050

# Database
DATABASE_URL=mongodb://user:pass@mongo-host:27017/fleetpro_production

# Secrets (use 32+ random characters)
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# API Keys
SENDGRID_API_KEY=SG.xxx...
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...

# Firebase
FIREBASE_PROJECT_ID=fleetpro-prod
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase@fleetpro.iam.gserviceaccount.com

# File permissions: read-only for owner
chmod 600 .env.production
chmod 400 .env.production
```

### Secrets Rotation Procedures

```bash
#!/bin/bash
# Rotate JWT secret

# 1. Generate new secret
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT Secret: $NEW_JWT_SECRET"

# 2. Update .env
# Keep old secret temporarily for token verification
OLD_JWT_SECRET=$JWT_SECRET
export JWT_SECRET=$NEW_JWT_SECRET

# 3. Restart application (with both secrets)
systemctl restart fleetpro-app

# 4. After 24 hours, remove old secret
# All old tokens will be expired by then
sed -i '/OLD_JWT_SECRET/d' .env.production

# 5. Restart application again
systemctl restart fleetpro-app

# 6. Log rotation
mongosh --eval "
  db.security_events.create({
    event: 'jwt_secret_rotated',
    timestamp: new Date(),
    rotation_date: new Date(),
    old_secret_hash: 'hash...',
    new_secret_hash: 'hash...'
  })
"

# Rotate API Keys (monthly)
# See "API Key Management" section above

# Rotate Database Passwords
mongosh --eval "
  // Change MongoDB user password
  db.changeUserPassword('fleetpro_user', 'new_strong_password_here')
"

# Update .env and restart
# Update all connection strings

# Rotate Certificates
# Monitor expiration
openssl x509 -in /etc/ssl/certs/cert.pem -noout -dates

# Renew before expiration (Let's Encrypt)
sudo certbot renew --dry-run
sudo certbot renew  # Auto-renewal typically daily
```

---

## Network Security

### Firewall Rules

```bash
#!/bin/bash
# /usr/local/bin/configure-firewall.sh

# Enable UFW
sudo ufw enable

# Allow SSH (restrict to VPN)
sudo ufw allow from 10.0.0.0/8 to any port 22

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MongoDB (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 27017

# Allow Redis (internal only)
sudo ufw allow from 10.0.0.0/8 to any port 6379

# Block all else
sudo ufw default deny incoming
sudo ufw default allow outgoing

# View rules
sudo ufw status verbose

# Log denied connections
sudo ufw logging on
```

### VPN Access

```bash
# Configure OpenVPN for secure admin access

# 1. Generate certificates
openssl genrsa -out ca-key.pem 2048
openssl req -new -x509 -days 365 -key ca-key.pem -out ca.pem

# 2. Create VPN user
openssl genrsa -out user-key.pem 2048
openssl req -new -key user-key.pem -out user.csr
openssl x509 -req -in user.csr -CA ca.pem -CAkey ca-key.pem \
  -CAcreateserial -out user-cert.pem -days 365

# 3. Connect via VPN before accessing admin features
# All admin operations require VPN connection

# 4. Log VPN connections
# Monitor for unauthorized access attempts
```

### Network Segmentation

```
Network topology:
┌─────────────────────────────────────────┐
│ Internet                                 │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │  Load Balancer    │
         │  (HTTPS, Rate     │
         │   Limiting)       │
         └────────┬──────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼──┐  ┌──────▼───┐  ┌─────▼──┐
│App   │  │  App     │  │  App   │
│1:5050│  │ 2:5051   │  │3:5052  │
└───┬──┘  └──────┬───┘  └─────┬──┘
    │           │            │
    └───────────┼────────────┘
                │
         ┌──────▼──────┐
         │  Database   │
         │  Network    │
         │  (Internal) │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │ Backup/DR   │
         │ (Separate   │
         │  VPC)       │
         └─────────────┘
```

---

## Data Security

### Encryption at Rest

```javascript
// server/encryption.ts
import crypto from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
const ALGORITHM = 'aes-256-cbc'

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Usage: Encrypt sensitive fields
app.post('/api/bookings', async (req, res) => {
  const booking = {
    ...req.body,
    passenger_phone: encrypt(req.body.passenger_phone),
    passenger_email: encrypt(req.body.passenger_email)
  }
  
  await db.bookings.create(booking)
})
```

### Encryption in Transit

```javascript
// server/index.ts
import https from 'https'
import fs from 'fs'

const options = {
  key: fs.readFileSync('/etc/ssl/private/key.pem'),
  cert: fs.readFileSync('/etc/ssl/certs/cert.pem'),
  minVersion: 'TLSv1.2'
}

https.createServer(options, app).listen(443)

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') === 'http') {
    return res.redirect(`https://${req.header('host')}${req.url}`)
  }
  next()
})

// Set HSTS headers
app.use((req, res, next) => {
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
```

### Data Retention & Deletion

```javascript
// server/data-retention.ts

// Data retention policy
const RETENTION_POLICY = {
  bookings: 730,           // 2 years
  audit_logs: 2555,        // 7 years
  user_sessions: 30,       // 30 days
  notifications: 90,       // 90 days
  error_logs: 30,          // 30 days
}

// Automated cleanup
export async function cleanupExpiredData() {
  const now = new Date()

  // Delete old notifications
  const notificationDate = new Date(now.getTime() - RETENTION_POLICY.notifications * 24 * 60 * 60 * 1000)
  await db.notifications.deleteMany({
    created_at: {$lt: notificationDate}
  })

  // Delete old sessions
  const sessionDate = new Date(now.getTime() - RETENTION_POLICY.user_sessions * 24 * 60 * 60 * 1000)
  await db.sessions.deleteMany({
    expires_at: {$lt: sessionDate}
  })

  logger.info('Expired data cleaned up')
}

// Schedule cleanup daily at 2 AM
schedule.scheduleJob('0 2 * * *', cleanupExpiredData)
```

### PII Handling

```javascript
// server/pii.ts

// Redact sensitive data in logs
function redactPII(data: any): any {
  return {
    ...data,
    email: data.email?.replace(/(.{1})(.*)(@.*)/, '$1***$3'),
    phone: data.phone?.replace(/(\d{3})(\d{3})(\d{4})/, '$1-***-$3'),
    ssn: data.ssn?.replace(/(\d{3})(\d{2})(\d{4})/, '$1-**-$4'),
    credit_card: data.credit_card?.replace(/\d(?=\d{4})/g, '*')
  }
}

// Exclude PII from audit logs
app.use((req, res, next) => {
  const originalSend = res.send
  res.send = function(data) {
    const cleanData = redactPII(JSON.parse(data))
    logger.info('API Response', {
      path: req.path,
      status: res.statusCode,
      data: cleanData
    })
    return originalSend.call(this, data)
  }
  next()
})

// Secure deletion (GDPR right to be forgotten)
export async function deleteUserData(userId: string) {
  const user = await db.users.findOne({_id: userId})
  
  // Delete all user data
  await Promise.all([
    db.bookings.deleteMany({customer_id: userId}),
    db.payment_methods.deleteMany({user_id: userId}),
    db.preferences.deleteMany({user_id: userId}),
    db.audit_logs.deleteMany({user_id: userId})
  ])

  // Replace user record with anonymized data
  await db.users.updateOne({_id: userId}, {
    email: `deleted_${Date.now()}@deleted.com`,
    name: 'Deleted User',
    status: 'deleted',
    deleted_at: new Date()
  })

  logger.info('User data deleted', {userId, timestamp: new Date()})
}
```

---

## Audit & Compliance

### Audit Logging

```javascript
// server/audit.ts

export async function auditLog(
  action: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  details?: any
) {
  await db.audit_logs.create({
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    user_id: userId,
    user_ip: getClientIP(),
    user_agent: getUserAgent(),
    details,
    timestamp: new Date(),
    status: 'success'
  })
}

// Track sensitive actions
// - User creation/deletion
// - Permission changes
// - Data exports
// - System configuration changes

app.post('/api/users', async (req, res) => {
  // ...create user...
  
  await auditLog(
    'CREATE',
    'USER',
    newUser._id,
    req.user.id,
    {email: newUser.email, role: newUser.role}
  )
})

// Audit log retention: 7 years (compliance requirement)
```

### Compliance Checklists

```markdown
# SOC 2 Compliance Checklist

## Security
- [ ] Encryption at rest (AES-256)
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Access controls (RBAC)
- [ ] VPN required for admin access
- [ ] 2FA enabled for all admin accounts
- [ ] Monthly security audits
- [ ] Vulnerability scanning enabled
- [ ] Patch management process

## Availability
- [ ] 99.9% uptime SLA
- [ ] Automated backups (daily)
- [ ] Disaster recovery plan (RTO < 4 hours)
- [ ] Load balancing
- [ ] Health monitoring
- [ ] Incident response team

## Processing Integrity
- [ ] Input validation
- [ ] Output encoding
- [ ] Error handling
- [ ] Logging and monitoring
- [ ] Transaction integrity
- [ ] State management

## Confidentiality
- [ ] PII encryption
- [ ] Secure data disposal
- [ ] Access restrictions
- [ ] Data classification
- [ ] Confidentiality agreements
- [ ] Need-to-know principle

## Privacy
- [ ] Privacy policy
- [ ] Data processing agreement
- [ ] Consent management
- [ ] GDPR compliance
- [ ] Right to deletion
- [ ] Data breach notification

# GDPR Compliance Checklist

- [ ] Privacy policy (Art 13, 14)
- [ ] Consent collection
- [ ] Data processing agreement
- [ ] Right to access (Art 15)
- [ ] Right to rectification (Art 16)
- [ ] Right to erasure (Art 17)
- [ ] Right to restrict processing (Art 18)
- [ ] Right to data portability (Art 20)
- [ ] Right to object (Art 21)
- [ ] Data breach notification (Art 33, 34)
- [ ] DPA appointment (if required) (Art 37)
- [ ] DPIA (if high risk) (Art 35)
```

---

## Incident Response

### Security Incident Procedures

**Breach Detection**
1. Anomalous login attempts
2. Unexpected data access
3. Unauthorized modifications
4. Malware detection

**Immediate Actions (0-15 minutes)**
1. Isolate affected system
2. Preserve evidence
3. Notify incident commander
4. Activate incident response team
5. Initiate investigation

**Containment (15-60 minutes)**
1. Disconnect compromised systems
2. Revoke compromised credentials
3. Enable additional monitoring
4. Notify affected users
5. Coordinate with legal/PR

**Eradication (1-24 hours)**
1. Identify root cause
2. Remove malware/backdoors
3. Patch vulnerabilities
4. Verify clean systems
5. Restore from backups

**Recovery (24+ hours)**
1. Restore services
2. Monitor for re-infection
3. Re-enable full functionality
4. Update security controls
5. Training for users

**Post-Incident (Follow-up)**
1. Conduct post-mortem
2. Document lessons learned
3. Update policies
4. Implement preventive measures
5. Track compliance

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
