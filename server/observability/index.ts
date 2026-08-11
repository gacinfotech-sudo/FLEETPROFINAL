/**
 * Observability Module Index
 * Central export point for all observability features
 */

// Metrics exports
export * from './metrics';

// Structured logging exports
export {
  createStructuredLogger,
  globalLogger,
  getLogger,
  generateCorrelationId,
  setupStructuredLoggingMiddleware,
  exportLogsToELK,
  type StructuredLogger,
} from './structured-logging';

// Tracing exports
export {
  initializeTracing,
  getTracer,
  trackHttpRequest,
  trackDatabaseOperation,
  trackExternalApiCall,
  trackQueueOperation,
  trackOperation,
  shutdownTracing,
  getCurrentSpan,
  addSpanEvent,
  SpanAttributes,
} from './tracing';

// Observability middleware exports
export {
  initializeObservability,
  recordDeliveryAttempt,
  recordDatabaseQuery,
  recordExternalApiCall,
  recordQueueProcessing,
  recordCacheAccess,
  updateActiveBookingsMetric,
  updateDatabaseConnectionMetrics,
  updateWebSocketConnections,
  updateSuccessRateMetrics,
  startPeriodicHealthChecks,
} from './observability-middleware';

// Prometheus endpoint exports
export {
  createPrometheusRouter,
  registerPrometheusEndpoint,
} from './prometheus-endpoint';
