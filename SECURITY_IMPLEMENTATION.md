# FleetPro Security Implementation — HTTPS & Security Hardening

**Status**: 🔄 IN PROGRESS  
**Date**: August 12, 2026  
**Objective**: Production-grade security with HTTPS, secure cookies, and defense-in-depth  

---

## 🔒 SECURITY COMPONENTS IMPLEMENTED

### 1. LOCAL HTTPS SETUP ✅

**File**: `scripts/setup-local-https.sh`

```bash
# Generate local HTTPS certificates
./scripts/setup-local-https.sh
```

**What it does**:
- Creates self-signed certificate for local development
- Certificate valid for 365 days
- Supports localhost and 127.0.0.1
- Certificates stored in `ssl/cert.pem` and `ssl/key.pem`

**Access**:
- https://localhost:5050
- https://127.0.0.1:5050

**Browser Warning**: Expected (self-signed certificate)
- Click "Advanced" → "Proceed" in your browser
- This is normal for local development

**For macOS**: Trust the certificate locally
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/cert.pem
```

---

### 2. SECURITY HEADERS MIDDLEWARE ✅

**File**: `server/middleware/securityHeaders.ts`

**Headers implemented**:

| Header | Purpose | Production | Development |
|--------|---------|-----------|-------------|
| **Strict-Transport-Security (HSTS)** | Force HTTPS | Enabled (1 year) | Disabled |
| **Content-Security-Policy** | Prevent XSS | Strict | Relaxed (dev) |
| **X-Content-Type-Options** | Prevent MIME sniffing | nosniff | nosniff |
| **X-Frame-Options** | Prevent clickjacking | DENY | DENY |
| **X-XSS-Protection** | Legacy XSS protection | 1; mode=block | 1; mode=block |
| **Referrer-Policy** | Control referrer info | strict-origin-when-cross-origin | same |
| **Permissions-Policy** | Disable dangerous APIs | Restricted | Restricted |
| **Cache-Control** | Prevent caching | no-store | no-store (for /api) |
| **Cross-Origin-Policies** | Cross-origin protection | COOP/COEP | COOP/COEP |

---

### 3. CSRF PROTECTION ✅

**File**: `server/middleware/csrfProtection.ts`

**Implementation**: Double-submit cookie pattern

**How it works**:
1. Server generates CSRF token on each request
2. Token stored in session
3. Client sends token in header (`x-csrf-token`) or body for state-changing requests
4. Server validates token matches session
5. Token rotated after successful validation

**Protected methods**: POST, PUT, PATCH, DELETE

**Endpoint**: 
```
GET /api/csrf-token → { csrfToken: "..." }
```

---

### 4. SECURE COOKIES ✅

**File**: `server/middleware/secureCookies.ts`

**Cookie Flags**:

```typescript
// Session cookie
{
  name: 'fleetpro_session',
  secure: true,           // HTTPS only
  httpOnly: true,         // No JavaScript access (XSS protection)
  sameSite: 'strict',     // CSRF protection
  maxAge: 30 * 60 * 1000, // 30 minutes idle
}

// Auth cookie
{
  name: 'fleetpro_auth',
  secure: true,
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
}

// CSRF token cookie
{
  name: 'csrf-token',
  secure: true,
  httpOnly: false,        // Must be readable by JavaScript
  sameSite: 'strict',
  maxAge: 60 * 60 * 1000, // 1 hour
}
```

**Session Management**:
- Sessions expire after 30 minutes of inactivity
- Sessions rotated on login
- Sessions invalidated on logout
- Token rotation prevents token prediction

---

### 5. CORS CONFIGURATION ✅

**File**: `server/config/corsConfig.ts`

**Policy**: Whitelist only approved origins

**Approved Origins**:

**Development**:
- http://localhost:5050
- https://localhost:5050
- http://127.0.0.1:5050
- https://127.0.0.1:5050
- http://localhost:5051 (Vite dev server)

**Production**:
- Configured via `ALLOWED_ORIGINS` environment variable
- Examples:
  ```env
  ALLOWED_ORIGINS=https://app.fleetpro.com,https://dashboard.fleetpro.com
  ```

**Rejected Origins**:
- No Access-Control-Allow-Origin: *
- Only whitelisted origins allowed
- Credentials: true (allows cookies)

---

### 6. SECRETS AUDIT ✅

**File**: `scripts/audit-secrets.sh`

```bash
# Scan for hardcoded secrets
./scripts/audit-secrets.sh
```

**Checks**:
- Hardcoded passwords/keys/tokens
- Database credentials in code
- AWS access keys
- MongoDB URIs with credentials
- .env files tracked in git
- Sensitive fields in package.json

**Recommendations**:
1. ✅ Never commit .env files
2. ✅ Use environment variables for all secrets
3. ✅ Rotate any exposed credentials immediately
4. ✅ Use secrets manager for production

---

### 7. PRODUCTION HTTPS SETUP

**Certificate Options**:

**Option A: Let's Encrypt (Recommended)**
```bash
# Install certbot
npm install -g certbot

# Generate certificate
certbot certonly --standalone -d your-domain.com

# Configure environment
CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

**Option B: Reverse Proxy (nginx)**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # TLS configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HTTP redirect
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }

    location / {
        proxy_pass http://localhost:5050;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🔐 ENVIRONMENT VARIABLES

**Required for production**:

```env
# HTTPS & Security
NODE_ENV=production
FORCE_HTTPS=true
TRUST_PROXY_HOPS=1

# Certificates (if not using reverse proxy)
CERT_PATH=/path/to/cert.pem
KEY_PATH=/path/to/key.pem

# CORS
ALLOWED_ORIGINS=https://your-domain.com,https://api.your-domain.com

# Session & Cookies
SESSION_SECRET=your-secure-random-secret-here
SECURE_COOKIES=true

# Database (never in code!)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname

# Secrets manager
USE_SECRETS_MANAGER=true
SECRETS_MANAGER=aws-secrets-manager
```

---

## 🔍 SECURITY TESTING CHECKLIST

- [ ] **HTTPS**
  - [ ] https://localhost:5050 loads
  - [ ] https://production-url loads
  - [ ] Valid certificate (production)
  - [ ] HTTP redirects to HTTPS

- [ ] **Security Headers**
  - [ ] CSP present and correct
  - [ ] HSTS header present (production)
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] No Server header exposed

- [ ] **Cookies**
  - [ ] Session cookie: Secure, HttpOnly, SameSite=Strict
  - [ ] Auth cookie: Secure, HttpOnly, SameSite=Strict
  - [ ] CSRF cookie present
  - [ ] Cookies expire correctly

- [ ] **CSRF Protection**
  - [ ] CSRF token required for POST/PUT/PATCH/DELETE
  - [ ] Token mismatch → 403
  - [ ] Token rotates after validation

- [ ] **CORS**
  - [ ] Only approved origins allowed
  - [ ] * origin rejected
  - [ ] Unauthorized origins get 403

- [ ] **Authentication**
  - [ ] Login requires HTTPS (production)
  - [ ] Password hashing (Argon2id)
  - [ ] Brute force protection
  - [ ] Session invalidation on logout

- [ ] **Database**
  - [ ] DB not internet-accessible
  - [ ] Credentials not in code
  - [ ] Connection encrypted
  - [ ] Backups tested

- [ ] **Secrets**
  - [ ] No hardcoded secrets in code
  - [ ] .env not tracked in git
  - [ ] Environment variables used
  - [ ] Credentials rotated if exposed

---

## 📋 DEPLOYMENT CHECKLIST

**Before going to production**:

- [ ] Run `./scripts/setup-local-https.sh` (test locally first)
- [ ] Run `npm run build`
- [ ] Run `./scripts/audit-secrets.sh`
- [ ] Run `npm audit` - fix critical vulnerabilities
- [ ] Test HTTPS locally
- [ ] Configure reverse proxy (nginx/load balancer)
- [ ] Get valid certificate (Let's Encrypt)
- [ ] Set environment variables
- [ ] Configure firewall (only allow 80, 443)
- [ ] Test production HTTPS
- [ ] Verify security headers (`curl -I https://...`)
- [ ] Test CSRF protection
- [ ] Test CORS
- [ ] Enable HSTS
- [ ] Monitor logs for security events

---

## 🚀 QUICK START

**Local Development**:
```bash
# Generate certificates
./scripts/setup-local-https.sh

# Start server
npm start

# Access
https://localhost:5050

# Skip certificate warning in browser (click Advanced → Proceed)
```

**Audit Secrets**:
```bash
# Check for hardcoded secrets
./scripts/audit-secrets.sh
```

**Production Deployment**:
```bash
# Set environment variables
export NODE_ENV=production
export FORCE_HTTPS=true
export CERT_PATH=/etc/letsencrypt/live/domain.com/fullchain.pem
export KEY_PATH=/etc/letsencrypt/live/domain.com/privkey.pem
export SESSION_SECRET=$(openssl rand -hex 32)
export ALLOWED_ORIGINS=https://your-domain.com

# Build
npm run build

# Start
npm start
```

---

## 📊 SECURITY REPORT

**Implemented**:
- ✅ Local HTTPS (self-signed certificates)
- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ CSRF protection (double-submit cookie pattern)
- ✅ Secure cookies (Secure, HttpOnly, SameSite)
- ✅ CORS configuration (whitelist only approach)
- ✅ Secrets audit script
- ✅ Production HTTPS setup guide
- ✅ Reverse proxy configuration

**Still to implement**:
- [ ] Integrate security middleware into routes
- [ ] Add rate limiting
- [ ] Add audit logging
- [ ] Add file upload security
- [ ] Add input validation/sanitization
- [ ] Add dependency vulnerability check

---

## 🔗 REFERENCES

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Let's Encrypt](https://letsencrypt.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Status**: Middleware implemented, testing phase begins.

