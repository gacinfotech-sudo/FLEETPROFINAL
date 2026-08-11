import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('AuditLog');

interface AuditEvent {
  timestamp: string;
  eventType: string;
  userId?: string;
  tenantId?: string;
  ip: string;
  userAgent?: string;
  method: string;
  path: string;
  statusCode?: number;
  details?: Record<string, any>;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Audit logging for security events
 * Tracks user actions, permission failures, admin operations
 */
export const auditLogger = (req: Request, res: Response, next: NextFunction) => {
  // Capture original response.json to log response data
  const originalJson = res.json.bind(res);

  res.json = function (data: any, ...args: any[]) {
    // Log security-relevant events
    const path = req.path;
    const method = req.method;
    const userId = (req as any).session?.userId;
    const tenantId = (req as any).session?.tenantId;
    const statusCode = res.statusCode;

    // Determine event type and severity
    let eventType: string = 'API_CALL';
    let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
    let shouldLog = false;

    // Track login attempts
    if (path.includes('/login') && method === 'POST') {
      eventType = statusCode === 200 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE';
      severity = statusCode === 200 ? 'INFO' : 'WARNING';
      shouldLog = true;
    }

    // Track logout
    if (path.includes('/logout') && method === 'POST') {
      eventType = 'LOGOUT';
      severity = 'INFO';
      shouldLog = true;
    }

    // Track permission failures
    if (statusCode === 403) {
      eventType = 'PERMISSION_DENIED';
      severity = 'WARNING';
      shouldLog = true;
    }

    // Track authentication failures
    if (statusCode === 401) {
      eventType = 'UNAUTHORIZED';
      severity = 'WARNING';
      shouldLog = true;
    }

    // Track password changes
    if (path.includes('/password') && (method === 'PUT' || method === 'PATCH')) {
      eventType = 'PASSWORD_CHANGED';
      severity = 'INFO';
      shouldLog = true;
    }

    // Track password reset requests
    if (path.includes('/reset') && method === 'POST') {
      eventType = statusCode === 200 ? 'PASSWORD_RESET_INITIATED' : 'PASSWORD_RESET_FAILED';
      severity = 'WARNING';
      shouldLog = true;
    }

    // Track booking changes
    if (path.includes('/booking') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      eventType = method === 'POST' ? 'BOOKING_CREATED' : 'BOOKING_MODIFIED';
      severity = 'INFO';
      shouldLog = true;
    }

    // Track payment operations
    if (path.includes('/payment') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      eventType = 'PAYMENT_OPERATION';
      severity = 'WARNING'; // High severity for financial operations
      shouldLog = true;
    }

    // Track admin operations
    if (path.includes('/admin') && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
      eventType = `ADMIN_${method}`;
      severity = 'WARNING';
      shouldLog = true;
    }

    // Track errors
    if (statusCode >= 500) {
      eventType = 'SERVER_ERROR';
      severity = 'CRITICAL';
      shouldLog = true;
    }

    // Log audit event
    if (shouldLog) {
      const auditEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        eventType,
        userId,
        tenantId,
        ip: req.ip || 'unknown',
        userAgent: req.get('user-agent'),
        method,
        path,
        statusCode,
        severity,
        details: {
          // Don't log passwords or tokens
          body: sanitizeBody(req.body),
          query: req.query,
        },
      };

      // Log based on severity
      if (severity === 'CRITICAL') {
        log.error(eventType, auditEvent);
      } else if (severity === 'WARNING') {
        log.warn(eventType, auditEvent);
      } else {
        log.info(eventType, auditEvent);
      }
    }

    return originalJson.apply(res, [data, ...args]);
  };

  next();
};

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body: any): Record<string, any> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn', 'pin'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Log specific security event
 */
export const logSecurityEvent = (
  eventType: string,
  userId: string | undefined,
  tenantId: string | undefined,
  ip: string,
  details: Record<string, any>,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
) => {
  const auditEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    tenantId,
    ip,
    severity,
    method: 'INTERNAL',
    path: 'INTERNAL_EVENT',
    details,
  };

  if (severity === 'CRITICAL') {
    log.error(eventType, auditEvent);
  } else if (severity === 'WARNING') {
    log.warn(eventType, auditEvent);
  } else {
    log.info(eventType, auditEvent);
  }
};

/**
 * Middleware to log failed CSRF attempts
 */
export const csrfFailureLogger = (req: Request, res: Response, next: NextFunction) => {
  // Wrap res.status to capture 403 responses (CSRF failures)
  const originalStatus = res.status.bind(res);

  res.status = function (code: number) {
    if (code === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      logSecurityEvent(
        'CSRF_FAILURE',
        (req as any).session?.userId,
        (req as any).session?.tenantId,
        req.ip || 'unknown',
        {
          path: req.path,
          method: req.method,
          tokenHeader: req.get('x-csrf-token') ? '***' : 'missing',
          userAgent: req.get('user-agent'),
        },
        'WARNING'
      );
    }
    return originalStatus.call(res, code);
  };

  next();
};

/**
 * Middleware to log XSS attempts
 */
export const xssAttemptLogger = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onload\s*=/i,
    /<iframe/i,
    /eval\(/i,
  ];

  const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const queryString = JSON.stringify(req.query || {});

  const isSuspicious = suspiciousPatterns.some(
    pattern => pattern.test(bodyString) || pattern.test(queryString)
  );

  if (isSuspicious) {
    logSecurityEvent(
      'XSS_ATTEMPT',
      (req as any).session?.userId,
      (req as any).session?.tenantId,
      req.ip || 'unknown',
      {
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        bodyLength: bodyString.length,
      },
      'WARNING'
    );
  }

  next();
};

/**
 * Middleware to log SQL injection attempts
 */
export const sqlInjectionLogger = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /sql\s*(insert|update|delete|select|drop|union)/i,
    /or\s+1\s*=\s*1/i,
    /;\s*(drop|delete|update|insert)/i,
  ];

  const bodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const queryString = JSON.stringify(req.query || {});

  const isSuspicious = sqlPatterns.some(
    pattern => pattern.test(bodyString) || pattern.test(queryString)
  );

  if (isSuspicious) {
    logSecurityEvent(
      'SQL_INJECTION_ATTEMPT',
      (req as any).session?.userId,
      (req as any).session?.tenantId,
      req.ip || 'unknown',
      {
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
      },
      'CRITICAL'
    );
  }

  next();
};
