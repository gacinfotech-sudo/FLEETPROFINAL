// Request/Response logging middleware for production monitoring
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('RequestLogger');

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;
  const ip = req.ip || 'unknown';

  // Log request
  if (process.env.NODE_ENV === 'development') {
    log.debug(`[${method}] ${path}`, { ip, userAgent: req.get('user-agent') });
  }

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log response
    if (statusCode >= 400) {
      log.warn(`[${method}] ${path} - ${statusCode}`, {
        duration: `${duration}ms`,
        ip,
        size: typeof data === 'string' ? data.length : 0,
      });
    } else if (process.env.NODE_ENV === 'development') {
      log.debug(`[${method}] ${path} - ${statusCode}`, { duration: `${duration}ms` });
    }

    return originalSend.call(this, data);
  };

  next();
}

export default requestLoggingMiddleware;
