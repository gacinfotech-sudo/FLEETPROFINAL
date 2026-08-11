import winston, { Logger, format } from 'winston';
import { v4 as uuidv4 } from 'uuid';

/**
 * Structured Logging Module
 * JSON logging with correlation IDs and severity-based filtering
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * Create structured logger with correlation ID tracking
 */
export function createStructuredLogger(moduleName: string): StructuredLogger {
  let correlationId: string = '';

  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS Z' }),
      format.errors({ stack: true }),
      // Custom format for correlation ID
      format.printf((info) => {
        const baseObject: LogEntry = {
          timestamp: info.timestamp,
          level: info.level,
          module: moduleName,
          message: info.message,
          correlationId: correlationId || info.correlationId || 'unknown',
        };

        if (info.error) {
          baseObject.error = {
            type: info.error.name || 'Error',
            message: info.error.message,
            stack: info.error.stack,
          };
        }

        if (info.metadata && Object.keys(info.metadata).length > 0) {
          baseObject.metadata = info.metadata;
        }

        if (info.duration !== undefined) {
          baseObject.duration_ms = info.duration;
        }

        return JSON.stringify(baseObject);
      })
    ),
    defaultMeta: {},
  });

  // Add transports based on environment
  if (process.env.NODE_ENV === 'production') {
    // Production: log to file and stdout
    logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
    logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
    logger.add(new winston.transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss Z' }),
        format.json()
      ),
    }));
  } else {
    // Development: log to console only
    logger.add(new winston.transports.Console({
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss Z' }),
        format.json()
      ),
    }));
  }

  return {
    setCorrelationId(id: string) {
      correlationId = id;
    },

    getCorrelationId() {
      return correlationId;
    },

    error(message: string, metadata?: Record<string, any>, error?: Error) {
      const logData: any = { message };
      if (metadata) logData.metadata = metadata;
      if (error) logData.error = error;
      logger.log('error', message, logData);
    },

    warn(message: string, metadata?: Record<string, any>) {
      const logData: any = { message };
      if (metadata) logData.metadata = metadata;
      logger.log('warn', message, logData);
    },

    info(message: string, metadata?: Record<string, any>) {
      const logData: any = { message };
      if (metadata) logData.metadata = metadata;
      logger.log('info', message, logData);
    },

    debug(message: string, metadata?: Record<string, any>) {
      const logData: any = { message };
      if (metadata) logData.metadata = metadata;
      logger.log('debug', message, logData);
    },

    trace(message: string, metadata?: Record<string, any>) {
      const logData: any = { message };
      if (metadata) logData.metadata = metadata;
      logger.log('trace', message, logData);
    },

    logRequest(method: string, path: string, statusCode: number, durationMs: number) {
      logger.info('HTTP Request', {
        metadata: {
          method,
          path,
          status_code: statusCode,
          duration_ms: durationMs,
        },
      });
    },

    logDatabaseOperation(operation: string, collection: string, durationMs: number, success: boolean) {
      logger.info('Database Operation', {
        metadata: {
          operation,
          collection,
          duration_ms: durationMs,
          success,
        },
      });
    },

    logExternalApiCall(provider: string, endpoint: string, statusCode: number, durationMs: number) {
      logger.info('External API Call', {
        metadata: {
          provider,
          endpoint,
          status_code: statusCode,
          duration_ms: durationMs,
        },
      });
    },

    logDeliveryAttempt(
      channel: string,
      provider: string,
      status: 'success' | 'failure',
      metadata?: Record<string, any>
    ) {
      logger.info('Delivery Attempt', {
        metadata: {
          channel,
          provider,
          status,
          ...metadata,
        },
      });
    },

    logQueueOperation(
      queueName: string,
      operation: 'enqueue' | 'dequeue' | 'process' | 'retry' | 'fail',
      metadata?: Record<string, any>
    ) {
      logger.info('Queue Operation', {
        metadata: {
          queue_name: queueName,
          operation,
          ...metadata,
        },
      });
    },
  };
}

/**
 * Global logger instance
 */
export const globalLogger = createStructuredLogger('Global');

/**
 * Logger instances per module
 */
const loggerCache: Map<string, StructuredLogger> = new Map();

export function getLogger(moduleName: string): StructuredLogger {
  if (!loggerCache.has(moduleName)) {
    loggerCache.set(moduleName, createStructuredLogger(moduleName));
  }
  return loggerCache.get(moduleName)!;
}

/**
 * Generate correlation ID
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Structured Logger Interface
 */
export interface StructuredLogger {
  setCorrelationId(id: string): void;
  getCorrelationId(): string;
  error(message: string, metadata?: Record<string, any>, error?: Error): void;
  warn(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  debug(message: string, metadata?: Record<string, any>): void;
  trace(message: string, metadata?: Record<string, any>): void;
  logRequest(method: string, path: string, statusCode: number, durationMs: number): void;
  logDatabaseOperation(operation: string, collection: string, durationMs: number, success: boolean): void;
  logExternalApiCall(provider: string, endpoint: string, statusCode: number, durationMs: number): void;
  logDeliveryAttempt(channel: string, provider: string, status: 'success' | 'failure', metadata?: Record<string, any>): void;
  logQueueOperation(queueName: string, operation: 'enqueue' | 'dequeue' | 'process' | 'retry' | 'fail', metadata?: Record<string, any>): void;
}

/**
 * Log Entry Structure
 */
interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  correlationId: string;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  duration_ms?: number;
}

/**
 * Export logs for ELK stack integration
 */
export async function exportLogsToELK(
  elasticsearchEndpoint: string,
  logs: LogEntry[]
): Promise<void> {
  try {
    const response = await fetch(`${elasticsearchEndpoint}/_bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
      body: logs.map(log =>
        JSON.stringify({ index: { _index: 'fleetpro-logs', _type: '_doc' } }) + '\n' +
        JSON.stringify(log)
      ).join('\n'),
    });

    if (!response.ok) {
      throw new Error(`ELK export failed: ${response.statusText}`);
    }

    globalLogger.debug('Logs exported to ELK successfully', { count: logs.length });
  } catch (error) {
    globalLogger.error('Failed to export logs to ELK', {}, error as Error);
  }
}

/**
 * Setup structured logging middleware
 */
export function setupStructuredLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const correlationId = req.get('X-Correlation-ID') || generateCorrelationId();
    globalLogger.setCorrelationId(correlationId);
    res.setHeader('X-Correlation-ID', correlationId);

    const startTime = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      globalLogger.logRequest(req.method, req.path, res.statusCode, durationMs);
    });

    next();
  };
}
