import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const log = createLogger('CSRFProtection');

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Generate a CSRF token
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern with server-side validation
 */
export const csrfProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate token for GET requests or if not present
  if (!req.session || !req.session.csrfToken) {
    if (!req.session) {
      req.session = {} as any;
    }
    const token = generateCsrfToken();
    req.session.csrfToken = token;
  }

  // For GET, HEAD, OPTIONS - just ensure token is in session
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // For POST, PUT, PATCH, DELETE - validate CSRF token
  const tokenFromHeader = req.get(CSRF_HEADER_NAME);
  const tokenFromBody = (req.body as any)?.csrfToken;
  const sessionToken = req.session?.csrfToken;

  // Token must be present in header or body
  if (!tokenFromHeader && !tokenFromBody) {
    log.warn('CSRF token missing', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({ message: 'CSRF token missing' });
  }

  // Token must match session
  const token = tokenFromHeader || tokenFromBody;
  if (token !== sessionToken) {
    log.warn('CSRF token mismatch', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).session?.userId,
    });
    return res.status(403).json({ message: 'CSRF token invalid' });
  }

  // Rotate token after validation (defense against token prediction)
  req.session.csrfToken = generateCsrfToken();

  next();
};

/**
 * Helper to get CSRF token for client
 */
export const getCsrfToken = (req: Request): string => {
  if (!req.session) {
    req.session = {} as any;
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  return req.session.csrfToken;
};

/**
 * Endpoint to get CSRF token for clients
 */
export const csrfTokenEndpoint = (req: Request, res: Response) => {
  const token = getCsrfToken(req);
  res.json({ csrfToken: token });
};
