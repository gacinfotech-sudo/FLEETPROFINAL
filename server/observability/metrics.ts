import { register, Counter, Gauge, Histogram, Summary } from 'prom-client';

/**
 * Prometheus Metrics Module
 * Provides 20+ metrics across delivery, performance, and operational dimensions
 */

// ============================================================================
// DELIVERY METRICS
// ============================================================================

// Delivery Success Rate per Channel
export const deliverySuccessCounter = new Counter({
  name: 'delivery_success_total',
  help: 'Total successful deliveries by channel',
  labelNames: ['channel', 'provider'],
});

export const deliveryFailureCounter = new Counter({
  name: 'delivery_failure_total',
  help: 'Total failed deliveries by channel',
  labelNames: ['channel', 'provider', 'error_type'],
});

export const deliverySuccessRateGauge = new Gauge({
  name: 'delivery_success_rate',
  help: 'Delivery success rate percentage by channel',
  labelNames: ['channel'],
});

// ============================================================================
// LATENCY METRICS
// ============================================================================

// Request Latency Percentiles (p50, p95, p99)
export const requestLatencyHistogram = new Histogram({
  name: 'request_latency_ms',
  help: 'Request latency in milliseconds with percentile buckets',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const deliveryLatencyHistogram = new Histogram({
  name: 'delivery_latency_ms',
  help: 'Delivery processing latency in milliseconds',
  labelNames: ['channel', 'provider'],
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

// Database Query Latency
export const dbQueryLatencyHistogram = new Histogram({
  name: 'db_query_latency_ms',
  help: 'Database query latency in milliseconds',
  labelNames: ['collection', 'operation', 'query_type'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
});

// External API Call Latency
export const externalApiLatencyHistogram = new Histogram({
  name: 'external_api_latency_ms',
  help: 'External API call latency in milliseconds',
  labelNames: ['provider', 'endpoint'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000],
});

// ============================================================================
// QUEUE METRICS
// ============================================================================

// Queue Depth Monitoring
export const queueDepthGauge = new Gauge({
  name: 'queue_depth',
  help: 'Number of items currently in queue',
  labelNames: ['queue_name', 'queue_type'],
});

export const queueProcessingTimeHistogram = new Histogram({
  name: 'queue_processing_time_ms',
  help: 'Time to process queue items in milliseconds',
  labelNames: ['queue_name'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000],
});

export const queueFailureCounter = new Counter({
  name: 'queue_failure_total',
  help: 'Total queue processing failures',
  labelNames: ['queue_name', 'error_type'],
});

export const queueRetryCounter = new Counter({
  name: 'queue_retry_total',
  help: 'Total queue item retries',
  labelNames: ['queue_name'],
});

// ============================================================================
// PROVIDER ERROR METRICS
// ============================================================================

// Provider Error Rates
export const providerErrorCounter = new Counter({
  name: 'provider_error_total',
  help: 'Total errors from external providers',
  labelNames: ['provider', 'error_code', 'error_type'],
});

export const providerErrorRateGauge = new Gauge({
  name: 'provider_error_rate',
  help: 'Error rate percentage by provider',
  labelNames: ['provider'],
});

export const providerAvailabilityGauge = new Gauge({
  name: 'provider_availability',
  help: 'Provider availability percentage (0-100)',
  labelNames: ['provider'],
});

// Provider Response Time
export const providerResponseTimeHistogram = new Histogram({
  name: 'provider_response_time_ms',
  help: 'Provider API response time in milliseconds',
  labelNames: ['provider'],
  buckets: [100, 250, 500, 1000, 2500, 5000],
});

// ============================================================================
// BUSINESS METRICS
// ============================================================================

// Active Bookings
export const activeBookingsGauge = new Gauge({
  name: 'active_bookings',
  help: 'Number of currently active bookings',
  labelNames: ['booking_type', 'status'],
});

// Booking Creation Rate
export const bookingCreationCounter = new Counter({
  name: 'booking_creation_total',
  help: 'Total bookings created',
  labelNames: ['booking_type', 'service_type'],
});

// Revenue Tracking
export const revenueCounter = new Counter({
  name: 'revenue_total',
  help: 'Total revenue in smallest currency unit (e.g., cents)',
  labelNames: ['booking_type', 'payment_method', 'currency'],
});

export const revenueSummary = new Summary({
  name: 'revenue_per_booking',
  help: 'Revenue per booking in smallest currency unit',
  labelNames: ['booking_type'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

// ============================================================================
// SYSTEM METRICS
// ============================================================================

// Database Connection Pool
export const dbConnectionPoolGauge = new Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool current size',
  labelNames: ['pool_name'],
});

export const dbConnectionPoolActiveGauge = new Gauge({
  name: 'db_connection_pool_active',
  help: 'Number of active database connections',
  labelNames: ['pool_name'],
});

// Active HTTP Connections
export const activeHttpConnectionsGauge = new Gauge({
  name: 'active_http_connections',
  help: 'Number of active HTTP connections',
});

// WebSocket Connections
export const activeWebSocketConnectionsGauge = new Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
});

// ============================================================================
// ERROR METRICS
// ============================================================================

// Application Errors
export const applicationErrorCounter = new Counter({
  name: 'application_error_total',
  help: 'Total application errors',
  labelNames: ['error_type', 'severity', 'module'],
});

// HTTP Status Code Distribution
export const httpStatusCodeCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests by status code',
  labelNames: ['method', 'route', 'status_code'],
});

// ============================================================================
// CACHE METRICS
// ============================================================================

// Cache Hit/Miss Rate
export const cacheHitCounter = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_name', 'cache_type'],
});

export const cacheMissCounter = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_name', 'cache_type'],
});

export const cacheHitRateGauge = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_name'],
});

// ============================================================================
// NOTIFICATION METRICS
// ============================================================================

// Notification Sending
export const notificationSentCounter = new Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent',
  labelNames: ['notification_type', 'channel', 'status'],
});

export const notificationLatencyHistogram = new Histogram({
  name: 'notification_latency_ms',
  help: 'Notification delivery latency in milliseconds',
  labelNames: ['notification_type', 'channel'],
  buckets: [100, 250, 500, 1000, 2500, 5000],
});

// ============================================================================
// GPS TRACKING METRICS
// ============================================================================

// GPS Update Frequency
export const gpsUpdateCounter = new Counter({
  name: 'gps_updates_total',
  help: 'Total GPS location updates received',
  labelNames: ['vehicle_id', 'update_source'],
});

export const gpsUpdateLatencyHistogram = new Histogram({
  name: 'gps_update_latency_ms',
  help: 'GPS update processing latency',
  labelNames: ['update_source'],
  buckets: [10, 50, 100, 250, 500, 1000],
});

// ============================================================================
// CUSTOM METRIC RECORDING HELPERS
// ============================================================================

/**
 * Record delivery success rate calculation
 */
export function recordDeliverySuccess(channel: string, provider: string, latencyMs: number) {
  deliverySuccessCounter.inc({ channel, provider });
  deliveryLatencyHistogram.observe({ channel, provider }, latencyMs);
  updateDeliverySuccessRate(channel);
}

/**
 * Record delivery failure with error type
 */
export function recordDeliveryFailure(
  channel: string,
  provider: string,
  errorType: string,
  latencyMs?: number
) {
  deliveryFailureCounter.inc({ channel, provider, error_type: errorType });
  if (latencyMs) {
    deliveryLatencyHistogram.observe({ channel, provider }, latencyMs);
  }
  updateDeliverySuccessRate(channel);
}

/**
 * Calculate and update delivery success rate gauge
 */
function updateDeliverySuccessRate(channel: string) {
  // This would be called periodically to update the gauge
  // Implementation depends on your metrics collection system
}

/**
 * Record queue operation
 */
export function recordQueueOperation(
  queueName: string,
  operation: 'enqueue' | 'process' | 'failure' | 'retry',
  processingTimeMs?: number
) {
  if (operation === 'process' && processingTimeMs) {
    queueProcessingTimeHistogram.observe({ queue_name: queueName }, processingTimeMs);
  } else if (operation === 'failure') {
    queueFailureCounter.inc({ queue_name: queueName, error_type: 'processing_error' });
  } else if (operation === 'retry') {
    queueRetryCounter.inc({ queue_name: queueName });
  }
}

/**
 * Record provider error
 */
export function recordProviderError(
  provider: string,
  errorCode: string,
  errorType: string
) {
  providerErrorCounter.inc({ provider, error_code: errorCode, error_type: errorType });
  updateProviderErrorRate(provider);
}

/**
 * Update provider error rate gauge
 */
function updateProviderErrorRate(provider: string) {
  // This would be called periodically to update the gauge
  // Implementation depends on your metrics collection system
}

/**
 * Record cache operation
 */
export function recordCacheOperation(
  cacheName: string,
  cacheType: string,
  hit: boolean
) {
  if (hit) {
    cacheHitCounter.inc({ cache_name: cacheName, cache_type: cacheType });
  } else {
    cacheMissCounter.inc({ cache_name: cacheName, cache_type: cacheType });
  }
  updateCacheHitRate(cacheName);
}

/**
 * Update cache hit rate gauge
 */
function updateCacheHitRate(cacheName: string) {
  // This would be called periodically to update the gauge
  // Implementation depends on your metrics collection system
}

/**
 * Get Prometheus registry
 */
export function getMetricsRegistry() {
  return register;
}

/**
 * Get metrics in Prometheus text format
 */
export async function getMetricsAsPrometheus(): Promise<string> {
  return register.metrics();
}
