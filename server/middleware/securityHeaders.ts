import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('SecurityHeaders');

/**
 * Comprehensive security headers middleware
 * Implements defense-in-depth security strategy
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === 'production';

  // HSTS (Strict-Transport-Security)
  // Tells browser to always use HTTPS
  // Production: 1 year, include subdomains and preload
  // Dev: 0 (disabled for local testing)
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content-Security-Policy (CSP)
  // Prevent XSS, clickjacking, and injection attacks
  const cspPolicy = isProd
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http://localhost:*; font-src 'self' data:; connect-src 'self' https: http://localhost:* ws://localhost:* wss://localhost:*; frame-ancestors 'none';";

  res.setHeader('Content-Security-Policy', cspPolicy);

  // X-Content-Type-Options
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  // Prevent clickjacking - prevent page from being framed
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  // Legacy XSS protection (modern browsers use CSP)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  // Control what referrer information is sent
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  // Disable potentially dangerous APIs
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Cache-Control
  // Prevent caching of sensitive content
  if (req.path.includes('/api/') || req.path.includes('/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Cross-Origin policies
  // Already handled by CORS middleware, but add additional headers
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
};

/**
 * Verify HTTPS in production
 */
export const enforceHttpsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    // Check if request is HTTPS
    // Consider X-Forwarded-Proto for reverse proxy scenarios
    const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

    if (!isSecure && !req.path.includes('/.well-known')) {
      // Redirect HTTP to HTTPS (301 permanent redirect)
      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    }
  }

  next();
};

/**
 * Log security events
 */
export const securityEventLogger = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /sql\s*(insert|update|delete|select)/i,
    /<script/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onload\s*=/i,
  ];

  const queryString = JSON.stringify(req.query);
  const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  const isSuspicious = suspiciousPatterns.some(pattern =>
    pattern.test(queryString) || pattern.test(bodyString)
  );

  if (isSuspicious) {
    log.warn('Suspicious request pattern detected', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  next();
};

/**
 * Remove sensitive headers that expose server information
 */
export const removeServerHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  // Remove X-Powered-By header (exposes Express)
  res.removeHeader('X-Powered-By');

  // Remove Server header
  res.removeHeader('Server');

  next();
};
