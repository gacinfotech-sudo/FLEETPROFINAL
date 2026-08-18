import { Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { securityHeadersMiddleware, enforceHttpsMiddleware, removeServerHeadersMiddleware, securityEventLogger } from '../middleware/securityHeaders';
import { csrfProtectionMiddleware } from '../middleware/csrfProtection';
import { validateSecureCookiesMiddleware } from '../middleware/secureCookies';
import { apiRateLimiter, loginRateLimiter, veryStrictRateLimiter } from '../middleware/rateLimiter';
import { auditLogger, csrfFailureLogger, xssAttemptLogger, sqlInjectionLogger } from '../middleware/auditLogger';
import { corsConfig } from '../config/corsConfig';

/**
 * Initialize all security middleware for Express app
 */
export const initializeSecurityMiddleware = (app: Express) => {
  console.log('[SECURITY] Initializing comprehensive security middleware...');

  // 1. Remove server information headers (before other middleware)
  app.use(removeServerHeadersMiddleware);

  // 2. Helmet - additional security headers
  app.use(helmet({
    contentSecurityPolicy: false, // We handle CSP separately
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // 3. Compression
  app.use(compression());

  // 4. CORS - should be early
  app.use(cors(corsConfig));

  // 5. Enforce HTTPS in production
  app.use(enforceHttpsMiddleware);

  // 6. Security headers middleware
  app.use(securityHeadersMiddleware);

  // 7. Security event logger (detect suspicious patterns)
  app.use(securityEventLogger);

  // 8. XSS attempt logger
  app.use(xssAttemptLogger);

  // 9. SQL injection attempt logger
  app.use(sqlInjectionLogger);

  // 10. CSRF failure logger
  app.use(csrfFailureLogger);

  // 11. General audit logger (for all requests)
  app.use(auditLogger);

  // 12. Secure cookies middleware
  app.use(validateSecureCookiesMiddleware);

  // 13. API rate limiting (applied to all /api routes)
  app.use('/api', apiRateLimiter);

  console.log('[SECURITY] ✅ Security middleware initialized');
};

/**
 * Apply CSRF protection to specific routes
 */
export const applyCsrfProtection = (app: Express) => {
  // Apply CSRF protection to all state-changing requests
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      csrfProtectionMiddleware(req, res, next);
    } else {
      next();
    }
  });
};

/**
 * Apply login rate limiting
 */
export const applyLoginRateLimiting = (app: Express, path: string = '/api/auth/login') => {
  app.post(path, loginRateLimiter, (req, res, next) => next());
};

/**
 * Apply strict rate limiting to sensitive endpoints
 */
export const applyStrictRateLimiting = (app: Express, paths: string[]) => {
  paths.forEach(path => {
    app.post(path, veryStrictRateLimiter, (req, res, next) => next());
  });
};

/**
 * Security configuration summary
 */
export const printSecurityConfig = () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         🔒 FLEETPRO SECURITY CONFIGURATION ACTIVE          ║
╠════════════════════════════════════════════════════════════╣
║ ✅ Security Headers: CSP, HSTS, X-Frame-Options, etc.      ║
║ ✅ HTTPS Enforcement: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'DEV MODE'}              ║
║ ✅ CORS: Whitelist-only (${process.env.ALLOWED_ORIGINS?.split(',').length || 2} origins)              ║
║ ✅ CSRF Protection: Double-submit cookies                  ║
║ ✅ Secure Cookies: HttpOnly, Secure, SameSite=Strict      ║
║ ✅ Rate Limiting: API (100/min), Login (5/15min)           ║
║ ✅ Audit Logging: All security events tracked              ║
║ ✅ XSS Prevention: Detected & logged                        ║
║ ✅ SQL Injection: Detected & logged                         ║
║ ✅ Server Headers: Removed (no fingerprinting)             ║
╚════════════════════════════════════════════════════════════╝
  `);
};
