# FleetPro Observability Suite

Comprehensive observability implementation with Prometheus metrics, structured logging, and OpenTelemetry distributed tracing.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Prometheus Metrics](#prometheus-metrics)
5. [Structured Logging](#structured-logging)
6. [Distributed Tracing](#distributed-tracing)
7. [Grafana Dashboards](#grafana-dashboards)
8. [Alert Configuration](#alert-configuration)
9. [Log Aggregation (ELK)](#log-aggregation-elk)
10. [Usage Examples](#usage-examples)
11. [Troubleshooting](#troubleshooting)

## Overview

The observability suite provides three pillars of observability:

### 1. **Prometheus Metrics**
- 20+ application metrics tracking delivery, latency, queue depth, and errors
- Real-time monitoring of business and technical KPIs
- Scrape endpoint at `/observability/metrics`

### 2. **Structured Logging**
- JSON-formatted logs with correlation IDs for request tracing
- Severity-based filtering and log aggregation
- Ready for ELK stack integration

### 3. **OpenTelemetry Tracing**
- Distributed tracing across service boundaries
- Request flow visualization
- Performance bottleneck identification
- Exports to Jaeger for analysis

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           FleetPro Application                       │
├─────────────────────────────────────────────────────┤
│  • Metrics Collection (Prometheus)                   │
│  • Structured Logging (Winston + JSON)               │
│  • Distributed Tracing (OpenTelemetry)               │
└─────────────────────────────────────────────────────┘
         │                    │                  │
         ↓                    ↓                  ↓
    ┌─────────┐        ┌──────────┐      ┌───────────┐
    │Prometheus│        │Structured│      │OpenTelemetry│
    │  Scrape  │        │ Logging  │      │   Tracing   │
    └─────────┘        └──────────┘      └───────────┘
         │                    │                  │
         ↓                    ↓                  ↓
    ┌─────────┐        ┌──────────┐      ┌───────────┐
    │Prometheus│        │  Logstash │      │   Jaeger  │
    │  Server  │        │           │      │  Collector│
    └─────────┘        └──────────┘      └───────────┘
         │                    │                  │
         ↓                    ↓                  ↓
    ┌─────────┐        ┌──────────┐      ┌───────────┐
    │  Grafana │        │Elasticsearch│    │ Jaeger UI │
    │ Dashboards│        │   (Logs)     │    │(Traces)   │
    └─────────┘        └──────────┘      └───────────┘
         │                    │
         ↓                    ↓
    ┌─────────┐        ┌──────────┐
    │ Alerts  │        │ Kibana   │
    │ AlertMgr│        │(Analysis)│
    └─────────┘        └──────────┘
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Port availability: 5050 (app), 9090 (Prometheus), 3000 (Grafana), 16686 (Jaeger), 5601 (Kibana), 9200 (Elasticsearch)

### 1. Start the Observability Stack

```bash
# Start Prometheus, Grafana, Jaeger, and ELK stack
docker-compose -f docker-compose.observability.yml up -d

# Verify services are running
docker-compose -f docker-compose.observability.yml ps
```

### 2. Initialize Application Observability

Add to your Express app startup:

```typescript
import { initializeObservability, registerPrometheusEndpoint, startPeriodicHealthChecks } from './observability';

const app = express();

// Initialize all observability features
initializeObservability(app, 'fleetpro');

// Register Prometheus endpoint
registerPrometheusEndpoint(app, '/observability');

// Start periodic health checks
startPeriodicHealthChecks(60000); // Every 60 seconds

// ... rest of your app setup
```

### 3. Access the Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin/admin |
| Prometheus | http://localhost:9090 | - |
| Jaeger UI | http://localhost:16686 | - |
| Kibana | http://localhost:5601 | - |
| Prometheus Metrics | http://localhost:5050/observability/metrics | - |

## Prometheus Metrics

### Available Metrics

#### Delivery Metrics
- `delivery_success_total` - Counter of successful deliveries
- `delivery_failure_total` - Counter of failed deliveries
- `delivery_success_rate` - Gauge of success rate percentage
- `delivery_latency_ms` - Histogram of delivery latency

#### Performance Metrics
- `request_latency_ms` - Request latency with p50, p95, p99
- `db_query_latency_ms` - Database query latency
- `external_api_latency_ms` - External provider API latency

#### Queue Metrics
- `queue_depth` - Current items in queue
- `queue_processing_time_ms` - Time to process queue items
- `queue_failure_total` - Queue processing failures
- `queue_retry_total` - Queue item retries

#### Provider Metrics
- `provider_error_total` - Total provider errors
- `provider_error_rate` - Error rate percentage
- `provider_availability` - Availability percentage
- `provider_response_time_ms` - Provider response time

#### Business Metrics
- `active_bookings` - Current active bookings
- `booking_creation_total` - Total bookings created
- `revenue_total` - Total revenue
- `revenue_per_booking` - Revenue summary

#### System Metrics
- `db_connection_pool_size` - Connection pool size
- `db_connection_pool_active` - Active connections
- `active_http_connections` - Current HTTP connections
- `active_websocket_connections` - Current WebSocket connections

#### Cache Metrics
- `cache_hits_total` - Total cache hits
- `cache_misses_total` - Total cache misses
- `cache_hit_rate` - Hit rate percentage

#### Notification Metrics
- `notifications_sent_total` - Total notifications sent
- `notification_latency_ms` - Notification delivery latency

### Recording Metrics in Code

```typescript
import { 
  recordDeliverySuccess, 
  recordQueueOperation,
  recordCacheAccess 
} from './observability';

// Record successful delivery
recordDeliverySuccess('sms', 'twilio', 145); // channel, provider, latency_ms

// Record queue operation
recordQueueOperation('email-queue', 'process', 234); // queue_name, operation, processing_time_ms

// Record cache access
recordCacheAccess('user-cache', 'redis', true); // cache_name, cache_type, hit
```

### Querying Metrics

#### HTTP Request Rate
```promql
rate(http_requests_total[5m])
```

#### P95 Request Latency
```promql
histogram_quantile(0.95, request_latency_ms)
```

#### Delivery Success Rate
```promql
delivery_success_rate
```

#### Queue Processing Rate
```promql
rate(queue_processing_time_ms[5m])
```

#### Error Rate (5xx)
```promql
rate(http_requests_total{status_code=~"5.."}[5m])
```

## Structured Logging

### Logger Setup

```typescript
import { getLogger, generateCorrelationId } from './observability';

const logger = getLogger('my-module');

// Set correlation ID (automatically done by middleware)
logger.setCorrelationId(generateCorrelationId());

// Log at different levels
logger.error('An error occurred', { userId: 123 }, errorObject);
logger.warn('Warning message', { threshold: 'exceeded' });
logger.info('Info message');
logger.debug('Debug info', { verbose: true });
logger.trace('Trace level', { detailed: 'data' });
```

### Log Formatting

All logs are structured JSON format:

```json
{
  "timestamp": "2026-08-11 10:30:45.123 +0000",
  "level": "error",
  "module": "delivery-service",
  "message": "Delivery failed",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "channel": "sms",
    "provider": "twilio",
    "error_code": "21608"
  },
  "error": {
    "type": "DeliveryError",
    "message": "Invalid phone number",
    "stack": "..."
  },
  "duration_ms": 145
}
```

### Correlation ID Tracking

Every request gets a correlation ID automatically:

```typescript
// HTTP Request Header
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000

// Propagated through all logs and traces
// Enables end-to-end request tracing
```

### Log Levels

| Level | Usage | Alert |
|-------|-------|-------|
| ERROR | Critical failures | Yes |
| WARN | Warnings, degraded performance | Yes |
| INFO | Normal operations, summaries | No |
| DEBUG | Detailed debugging info | No |
| TRACE | Very detailed info | No |

## Distributed Tracing

### Tracing Operations

```typescript
import { 
  trackDatabaseOperation, 
  trackExternalApiCall, 
  trackQueueOperation 
} from './observability';

// Track database operation
const users = await trackDatabaseOperation('find', 'users', () => {
  return User.find({ active: true }).exec();
});

// Track external API call
const sms = await trackExternalApiCall('twilio', '/messages', () => {
  return twilioClient.messages.create({...});
});

// Track queue operation
await trackQueueOperation('email-queue', 'process', () => {
  return processEmailQueue();
});
```

### Viewing Traces in Jaeger

1. Navigate to http://localhost:16686
2. Select service: "fleetpro"
3. Filter by operation or tags
4. Click on a trace to see detailed flow
5. Identify latency bottlenecks in the timeline

### Trace Attributes

Spans include semantic attributes:

- `http.method` - HTTP method
- `http.url` - Request URL
- `http.status_code` - Response status
- `db.system` - Database system (e.g., mongodb)
- `db.operation` - Operation type (insert, find, update)
- `db.collection` - Collection name
- `rpc.service` - External service
- `rpc.method` - API endpoint
- `exception.type` - Error type
- `exception.message` - Error message

## Grafana Dashboards

### Available Dashboards

**FleetPro Observability Dashboard**
- Request rate and latency
- Delivery success rates
- Queue depth
- Error rates
- Active bookings
- Cache performance

### Creating Custom Dashboards

1. Access Grafana at http://localhost:3000
2. Click "+" → "Dashboard"
3. Click "Add panel"
4. Select Prometheus datasource
5. Write PromQL query
6. Configure visualization
7. Save dashboard

### Useful Dashboard Panels

#### Request Latency Distribution
```promql
histogram_quantile(0.99, rate(request_latency_ms_bucket[5m]))
```

#### Delivery Success by Channel
```promql
sum(rate(delivery_success_total[5m])) by (channel)
```

#### Database Connection Pool Usage
```promql
(db_connection_pool_active / db_connection_pool_size) * 100
```

#### Queue Processing Performance
```promql
histogram_quantile(0.95, rate(queue_processing_time_ms_bucket[5m]))
```

## Alert Configuration

### Alert Rules

Alerts are defined in `monitoring/alerts.yml`:

- **High Request Latency** (P95 > 1000ms)
- **Low Delivery Success Rate** (< 95%)
- **High Error Rate** (> 5% 5xx)
- **Provider Errors** (> 10%)
- **Queue Backlog** (> 10,000 items)
- **Database Connection Pool Exhaustion** (> 90% used)
- **High Memory Usage** (> 2GB)
- **Slow Database Queries** (P95 > 500ms)
- **Service Down** (no response for 1+ min)

### Alert Severity Levels

| Severity | Action | Response Time |
|----------|--------|----------------|
| Critical | PagerDuty + Slack | Immediate |
| Warning | Slack | 5-15 minutes |
| Info | Slack info channel | As needed |

### Configuring Notifications

Update `monitoring/alertmanager.yml`:

```yaml
global:
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#fleetpro-critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
```

## Log Aggregation (ELK)

### Elasticsearch Queries

Search for errors in Kibana:

```
level: "error" AND module: "delivery-service"
```

Search by correlation ID:

```
correlationId: "550e8400-e29b-41d4-a716-446655440000"
```

Search by provider:

```
metadata.provider: "twilio" AND status: "failed"
```

### Index Management

- Logs are indexed daily: `fleetpro-logs-YYYY.MM.dd`
- Retention policy: 30 days (configurable)
- Rollover daily to optimize query performance

### Kibana Visualizations

1. Navigate to http://localhost:5601
2. Click "Discover" to explore logs
3. Create index pattern: `fleetpro-logs-*`
4. Use filters to narrow search
5. Create visualizations and dashboards

## Usage Examples

### Example 1: Track Delivery Attempt

```typescript
import { recordDeliveryAttempt, getLogger } from './observability';

const logger = getLogger('delivery-service');

async function sendSMS(message: string, phoneNumber: string) {
  const startTime = Date.now();
  
  try {
    const result = await twilioClient.messages.create({
      from: process.env.TWILIO_FROM,
      to: phoneNumber,
      body: message
    });
    
    const latency = Date.now() - startTime;
    await recordDeliveryAttempt('sms', 'twilio', true, latency);
    
    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    await recordDeliveryAttempt('sms', 'twilio', false, latency, 'provider_error');
    throw error;
  }
}
```

### Example 2: Track Database Operations

```typescript
import { recordDatabaseQuery, getLogger } from './observability';

const logger = getLogger('user-service');

async function getActiveUsers() {
  return recordDatabaseQuery(
    'users',
    'find',
    () => User.find({ status: 'active' }).exec(),
    'read'
  );
}

async function updateUserStatus(userId: string, status: string) {
  return recordDatabaseQuery(
    'users',
    'updateOne',
    () => User.updateOne({ _id: userId }, { status }).exec(),
    'write'
  );
}
```

### Example 3: Track External API Calls

```typescript
import { recordExternalApiCall, getLogger } from './observability';

const logger = getLogger('payment-service');

async function processPayment(amount: number, cardToken: string) {
  return recordExternalApiCall('stripe', '/charges', async () => {
    const response = await stripeClient.charges.create({
      amount,
      currency: 'usd',
      source: cardToken
    });
    
    return {
      status: 200,
      data: response
    };
  });
}
```

### Example 4: Track Queue Operations

```typescript
import { recordQueueProcessing, getLogger } from './observability';

const logger = getLogger('queue-processor');

async function processEmailQueue() {
  return recordQueueProcessing('email-queue', 'process', async () => {
    const emails = await EmailQueue.find({ status: 'pending' }).limit(10);
    
    for (const email of emails) {
      await sendEmail(email);
      email.status = 'sent';
      await email.save();
    }
    
    return emails.length;
  });
}
```

### Example 5: Track Cache Operations

```typescript
import { recordCacheAccess, getLogger } from './observability';

const logger = getLogger('cache-service');

async function getUserWithCache(userId: string) {
  const cacheKey = `user:${userId}`;
  
  // Check cache
  let user = await cache.get(cacheKey);
  recordCacheAccess('user-cache', 'redis', !!user);
  
  if (!user) {
    // Cache miss - fetch from database
    user = await User.findById(userId);
    await cache.set(cacheKey, user, 3600); // 1 hour TTL
  }
  
  return user;
}
```

## Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check if application is running: `curl http://localhost:5050/observability/metrics`
2. Verify Prometheus is scraping: http://localhost:9090/targets
3. Check Prometheus logs: `docker-compose -f docker-compose.observability.yml logs prometheus`
4. Ensure metrics endpoint is registered in app initialization

### Grafana Dashboard Shows No Data

1. Verify Prometheus datasource is configured
2. Check time range is set to show recent data
3. Verify metrics are being collected: `curl http://localhost:5050/observability/metrics | grep request_latency`
4. Check Grafana logs: `docker logs fleetpro-grafana`

### Jaeger Shows No Traces

1. Verify Jaeger is running: `curl http://localhost:14269/`
2. Check OpenTelemetry initialization in app
3. Verify JAEGER_ENDPOINT environment variable
4. Check app logs for tracing initialization
5. Ensure spans are being generated: add debug logs to tracing functions

### Elasticsearch/Kibana Not Receiving Logs

1. Verify Elasticsearch is running: `curl http://localhost:9200/_health`
2. Check Logstash is running and processing logs
3. Verify index pattern is created in Kibana
4. Check Logstash logs: `docker logs fleetpro-logstash`
5. Verify structured logging middleware is enabled in app

### High Memory Usage in Observability Stack

1. Reduce Prometheus retention: `--storage.tsdb.retention.time=7d`
2. Reduce Elasticsearch shard size: modify `docker-compose.observability.yml`
3. Disable unused features (Logstash, AlertManager if not needed)
4. Implement log sampling for high-volume applications

## Production Deployment

### Environment Variables

```bash
# Observability Configuration
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
PROMETHEUS_SCRAPE_INTERVAL=15s
LOG_LEVEL=info
NODE_ENV=production

# Slack/PagerDuty Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=YOUR_PAGERDUTY_KEY

# Elasticsearch
ELASTICSEARCH_HOST=elasticsearch:9200
ELASTICSEARCH_INDEX_PREFIX=fleetpro-logs

# Retention Policies
PROMETHEUS_RETENTION_DAYS=30
ELASTICSEARCH_RETENTION_DAYS=30
```

### Capacity Planning

- **Prometheus**: ~1 MB per 1M metrics/min
- **Elasticsearch**: ~500 MB per 1M logs/day
- **Grafana**: ~200 MB RAM
- **Jaeger**: ~300 MB RAM

### Backup Strategy

```bash
# Backup Prometheus data
docker-compose -f docker-compose.observability.yml exec prometheus tar czf /prometheus/backup.tar.gz /prometheus/wal

# Backup Elasticsearch data
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d '{"type": "fs", "settings": {"location": "/backup"}}'
```

---

**Last Updated**: 2026-08-11
**Version**: 1.0.0
**Maintainer**: FleetPro DevOps Team
