import { Request, Response, NextFunction } from 'express';
import {
  recordDeliverySuccess,
  recordDeliveryFailure,
  recordQueueOperation,
  recordProviderError,
  recordCacheOperation,
  deliverySuccessRateGauge,
  providerErrorRateGauge,
  providerAvailabilityGauge,
  cacheHitRateGauge,
  activeBookingsGauge,
  dbConnectionPoolGauge,
  dbConnectionPoolActiveGauge,
  activeHttpConnectionsGauge,
  activeWebSocketConnectionsGauge,
  requestLatencyHistogram,
  dbQueryLatencyHistogram,
  externalApiLatencyHistogram,
  httpStatusCodeCounter,
  applicationErrorCounter,
} from './metrics';
import {
  getLogger,
  generateCorrelationId,
  setupStructuredLoggingMiddleware,
} from './structured-logging';
import {
  trackHttpRequest,
  trackDatabaseOperation,
  trackExternalApiCall,
  initializeTracing,
} from './tracing';

const logger = getLogger('observability-middleware');

/**
 * Observability Middleware
 * Integrates metrics, structured logging, and tracing
 */

/**
 * Initialize all observability features
 */
export function initializeObservability(app: any, serviceName: string = 'fleetpro'): void {
  // Initialize tracing
  const jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
  initializeTracing(serviceName, jaegerEndpoint);

  // Apply structured logging middleware
  app.use(setupStructuredLoggingMiddleware());

  // Apply HTTP request tracking middleware
  app.use(createRequestTrackingMiddleware());

  // Apply connection tracking middleware
  app.use(createConnectionTrackingMiddleware());

  logger.info('Observability initialized', {
    service_name: serviceName,
    jaeger_endpoint: jaegerEndpoint,
  });
}

/**
 * Middleware: Track HTTP requests with metrics and tracing
 */
function createRequestTrackingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = req.get('X-Correlation-ID') || generateCorrelationId();
    res.setHeader('X-Correlation-ID', correlationId);

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Track HTTP request span
    trackHttpRequest(req, res, () => {
      // Track metrics
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const memoryUsed = process.memoryUsage().heapUsed - startMemory;

        const route = req.route?.path || req.path;
        const method = req.method;
        const statusCode = res.statusCode;

        // Record latency histogram
        requestLatencyHistogram.observe(
          {
            method,
            route,
            status_code: statusCode.toString(),
          },
          duration
        );

        // Record HTTP status code
        httpStatusCodeCounter.inc({
          method,
          route,
          status_code: statusCode.toString(),
        });

        // Log request
        logger.logRequest(method, route, statusCode, duration);

        // Log detailed metrics for slow requests
        if (duration > 1000) {
          logger.warn(`Slow request detected: ${method} ${route}`, {
            duration_ms: duration,
            status_code: statusCode,
            memory_used_mb: (memoryUsed / 1024 / 1024).toFixed(2),
          });
        }
      });
    });

    next();
  };
}

/**
 * Middleware: Track active connections
 */
function createConnectionTrackingMiddleware() {
  let httpConnections = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    httpConnections++;
    activeHttpConnectionsGauge.set(httpConnections);

    res.on('finish', () => {
      httpConnections--;
      activeHttpConnectionsGauge.set(Math.max(0, httpConnections));
    });

    next();
  };
}

/**
 * Delivery Service: Record delivery attempt
 */
export async function recordDeliveryAttempt(
  channel: string,
  provider: string,
  success: boolean,
  latencyMs: number,
  errorType?: string
): Promise<void> {
  if (success) {
    recordDeliverySuccess(channel, provider, latencyMs);
    logger.logDeliveryAttempt(channel, provider, 'success', {
      latency_ms: latencyMs,
    });
  } else {
    recordDeliveryFailure(channel, provider, errorType || 'unknown', latencyMs);
    logger.logDeliveryAttempt(channel, provider, 'failure', {
      latency_ms: latencyMs,
      error_type: errorType,
    });
  }
}

/**
 * Database Operations: Record database query metrics and tracing
 */
export async function recordDatabaseQuery<T>(
  collection: string,
  operation: string,
  fn: () => Promise<T>,
  queryType: string = 'other'
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await trackDatabaseOperation(operation, collection, fn);
    const duration = Date.now() - startTime;

    dbQueryLatencyHistogram.observe(
      {
        collection,
        operation,
        query_type: queryType,
      },
      duration
    );

    logger.logDatabaseOperation(operation, collection, duration, true);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    dbQueryLatencyHistogram.observe(
      {
        collection,
        operation,
        query_type: queryType,
      },
      duration
    );

    logger.logDatabaseOperation(operation, collection, duration, false);
    applicationErrorCounter.inc({
      error_type: 'database_error',
      severity: 'high',
      module: 'database',
    });

    throw error;
  }
}

/**
 * External API Calls: Record API metrics and tracing
 */
export async function recordExternalApiCall<T>(
  provider: string,
  endpoint: string,
  fn: () => Promise<{ status: number; data: T }>
): Promise<T> {
  const startTime = Date.now();

  try {
    const response = await trackExternalApiCall(provider, endpoint, fn);
    const duration = Date.now() - startTime;

    externalApiLatencyHistogram.observe(
      {
        provider,
        endpoint,
      },
      duration
    );

    logger.logExternalApiCall(provider, endpoint, response.status, duration);

    if (response.status >= 400) {
      recordProviderError(provider, response.status.toString(), 'http_error');
      applicationErrorCounter.inc({
        error_type: 'external_api_error',
        severity: response.status >= 500 ? 'high' : 'medium',
        module: 'external_api',
      });
    }

    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;

    externalApiLatencyHistogram.observe(
      {
        provider,
        endpoint,
      },
      duration
    );

    recordProviderError(provider, 'unknown', 'request_error');
    logger.error(`External API call failed: ${provider} ${endpoint}`, {
      duration_ms: duration,
      provider,
      endpoint,
    }, error as Error);

    applicationErrorCounter.inc({
      error_type: 'external_api_error',
      severity: 'high',
      module: 'external_api',
    });

    throw error;
  }
}

/**
 * Queue Operations: Record queue metrics
 */
export async function recordQueueProcessing<T>(
  queueName: string,
  operation: 'enqueue' | 'process' | 'retry' | 'fail',
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (operation === 'process') {
      recordQueueOperation(queueName, operation, duration);
      logger.logQueueOperation(queueName, operation, {
        duration_ms: duration,
        success: true,
      });
    } else {
      recordQueueOperation(queueName, operation);
      logger.logQueueOperation(queueName, operation);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (operation === 'process') {
      recordQueueOperation(queueName, 'fail');
      logger.logQueueOperation(queueName, 'fail', {
        duration_ms: duration,
        error: (error as Error).message,
      });
    }

    applicationErrorCounter.inc({
      error_type: 'queue_error',
      severity: 'medium',
      module: 'queue',
    });

    throw error;
  }
}

/**
 * Cache Operations: Record cache hit/miss metrics
 */
export function recordCacheAccess(
  cacheName: string,
  cacheType: string,
  hit: boolean
): void {
  recordCacheOperation(cacheName, cacheType, hit);

  logger.debug(`Cache ${hit ? 'hit' : 'miss'}: ${cacheName}`, {
    cache_name: cacheName,
    cache_type: cacheType,
    hit,
  });
}

/**
 * Update Business Metrics: Active Bookings
 */
export function updateActiveBookingsMetric(
  bookingType: string,
  status: string,
  count: number
): void {
  activeBookingsGauge.set(
    {
      booking_type: bookingType,
      status,
    },
    count
  );
}

/**
 * Update System Metrics: Database Connection Pool
 */
export function updateDatabaseConnectionMetrics(
  poolName: string,
  poolSize: number,
  activeConnections: number
): void {
  dbConnectionPoolGauge.set({ pool_name: poolName }, poolSize);
  dbConnectionPoolActiveGauge.set({ pool_name: poolName }, activeConnections);
}

/**
 * Update System Metrics: WebSocket Connections
 */
export function updateWebSocketConnections(count: number): void {
  activeWebSocketConnectionsGauge.set(count);
}

/**
 * Calculate and update success rates
 */
export async function updateSuccessRateMetrics(): Promise<void> {
  // This would be called periodically (e.g., every 1-5 minutes)
  // to calculate and update success rate gauges based on counters

  try {
    // Example: Calculate delivery success rate
    // deliverySuccessRateGauge.set({ channel: 'sms' }, calculateSuccessRate('sms'));
    // deliverySuccessRateGauge.set({ channel: 'email' }, calculateSuccessRate('email'));
    // deliverySuccessRateGauge.set({ channel: 'whatsapp' }, calculateSuccessRate('whatsapp'));

    logger.debug('Success rate metrics updated');
  } catch (error) {
    logger.error('Failed to update success rate metrics', {}, error as Error);
  }
}

/**
 * Periodic Health Check
 */
export function startPeriodicHealthChecks(intervalMs: number = 60000): NodeJS.Timer {
  return setInterval(() => {
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      logger.debug('Health check', {
        uptime_seconds: Math.floor(uptime),
        memory_heap_used_mb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
        memory_heap_total_mb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
        memory_external_mb: (memoryUsage.external / 1024 / 1024).toFixed(2),
      });

      updateSuccessRateMetrics().catch((error) => {
        logger.error('Health check failed', {}, error as Error);
      });
    } catch (error) {
      logger.error('Periodic health check error', {}, error as Error);
    }
  }, intervalMs);
}
