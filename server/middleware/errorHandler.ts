// Error handling middleware with structured logging
import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const log = createLogger('ErrorHandler');

interface ApiError extends Error {
  statusCode?: number;
  details?: Record<string, any>;
}

export function errorHandlingMiddleware(
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const path = req.path;
  const method = req.method;

  // Log error with context
  log.error(`${method} ${path} failed`, error, {
    statusCode,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    details: error.details,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      path,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
}

export default errorHandlingMiddleware;
