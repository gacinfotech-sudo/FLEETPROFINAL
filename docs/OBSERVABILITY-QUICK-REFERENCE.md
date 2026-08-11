# FleetPro Observability Quick Reference

**Last Updated**: 2026-08-11  
**Version**: 1.0.0

## Services & URLs

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| App Metrics | 5050 | http://localhost:5050/observability/metrics | Prometheus scrape endpoint |
| Prometheus | 9090 | http://localhost:9090 | Metrics server |
| Grafana | 3000 | http://localhost:3000 | Dashboards (admin/admin) |
| Jaeger | 16686 | http://localhost:16686 | Distributed tracing |
| Elasticsearch | 9200 | http://localhost:9200 | Log storage |
| Kibana | 5601 | http://localhost:5601 | Log analysis |
| AlertManager | 9093 | http://localhost:9093 | Alert routing |

## Quick Commands

### Start Stack
```bash
docker-compose -f docker-compose.observability.yml up -d
```

### Stop Stack
```bash
docker-compose -f docker-compose.observability.yml down
```

### View Logs
```bash
docker-compose -f docker-compose.observability.yml logs -f [service]
```

### Health Check
```bash
curl http://localhost:5050/observability/health
curl http://localhost:5050/observability/readiness
curl http://localhost:5050/observability/liveness
```

### View Metrics
```bash
curl http://localhost:5050/observability/metrics | grep delivery_success
```

## Prometheus Queries

### HTTP Requests
```promql
# Request rate (per second)
rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(request_latency_ms_bucket[5m]))

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])
```

### Delivery Metrics
```promql
# Success rate
delivery_success_rate

# Delivery latency P95
histogram_quantile(0.95, rate(delivery_latency_ms_bucket[5m]))

# Success by channel
sum(rate(delivery_success_total[5m])) by (channel)
```

### Database
```promql
# Query latency P95
histogram_quantile(0.95, rate(db_query_latency_ms_bucket[5m]))

# Slow queries
rate(db_query_latency_ms_bucket{le="500"}[5m])

# Connection pool usage
(db_connection_pool_active / db_connection_pool_size) * 100
```

### Queue
```promql
# Queue depth
queue_depth

# Processing rate
rate(queue_processing_time_ms_count[5m])

# Failure rate
rate(queue_failure_total[5m])
```

### Cache
```promql
# Hit rate
cache_hit_rate

# Hit ratio
sum(rate(cache_hits_total[5m])) / 
  (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

## Grafana Dashboard

**Name**: FleetPro Observability Dashboard

### Panels
1. **Request Rate** - Requests per 5 minutes
2. **Request Latency P95** - Gauge showing milliseconds
3. **Delivery Success Rate** - Line chart by channel
4. **Queue Depth** - Gauge showing item count
5. **Error Rate** - 5xx response rate
6. **Active Bookings** - Business metric line chart
7. **Cache Hit Rate** - Time series
8. **Database Latency** - Performance graph

## Jaeger Tracing

### View Traces
1. Go to http://localhost:16686
2. Select service: "fleetpro"
3. Filter by operation name or tags
4. Click trace to view timeline

### Key Attributes
- `http.method` - HTTP verb
- `http.status_code` - Response status
- `db.operation` - Query type (find, insert, update)
- `db.collection` - MongoDB collection
- `rpc.service` - External service name
- `exception.type` - Error class
- `exception.message` - Error message

## Kibana Logs

### Access
Go to http://localhost:5601 → Discover

### Filter Examples
```
level: "error"
module: "delivery-service"
status: "failed"
correlationId: "550e8400-e29b-41d4-a716-446655440000"
metadata.duration_ms: [100 TO 5000]
error.type: "TimeoutError"
```

### Create Index Pattern
1. Settings → Index Patterns
2. Create Index Pattern
3. Name: `fleetpro-logs-*`
4. Time field: `@timestamp`

## Logging in Code

### Import
```typescript
import { getLogger } from './observability';
const logger = getLogger('module-name');
```

### Levels
```typescript
logger.error('msg', metadata, error);   // Critical
logger.warn('msg', metadata);            // Warning
logger.info('msg', metadata);            // Info
logger.debug('msg', metadata);           // Debug
logger.trace('msg', metadata);           // Trace
```

### Examples
```typescript
// Request logging
logger.logRequest('GET', '/api/users', 200, 145);

// Database operation
logger.logDatabaseOperation('find', 'users', 50, true);

// Delivery attempt
logger.logDeliveryAttempt('sms', 'twilio', 'success', {
  recipient: '+1234567890',
  messageId: 'SM123456'
});

// Queue operation
logger.logQueueOperation('email-queue', 'process', {
  itemsProcessed: 25,
  duration_ms: 1234
});
```

## Metrics Recording

### Import
```typescript
import {
  recordDeliveryAttempt,
  recordDatabaseQuery,
  recordExternalApiCall,
  recordQueueProcessing,
  recordCacheAccess
} from './observability';
```

### Examples

**Delivery**
```typescript
await recordDeliveryAttempt('sms', 'twilio', true, 145);
await recordDeliveryAttempt('email', 'sendgrid', false, 89, 'rate_limit');
```

**Database**
```typescript
const users = await recordDatabaseQuery('users', 'find', async () => {
  return User.find({active: true}).exec();
});
```

**External API**
```typescript
const payment = await recordExternalApiCall('stripe', '/charges', async () => {
  const res = await stripeClient.charges.create({...});
  return { status: 200, data: res };
});
```

**Queue**
```typescript
await recordQueueProcessing('email-queue', 'process', async () => {
  const emails = await EmailQueue.find({status: 'pending'});
  // Process...
});
```

**Cache**
```typescript
recordCacheAccess('user-cache', 'redis', hit); // true/false
```

## Alert Rules

### Critical Alerts
- Service Down (no response > 1m)
- Low Delivery Success Rate (< 95%)
- Connection Pool Exhaustion (> 90%)
- High Error Rate (> 5%)

### Warning Alerts
- High Latency (P95 > 1000ms)
- High Provider Error Rate (> 10%)
- Queue Backlog (> 10,000 items)
- High Memory Usage (> 2GB)
- Slow Database Queries (P95 > 500ms)

### Info Alerts
- Low Cache Hit Rate (< 70%)
- Low Active Bookings (< 5)
- High WebSocket Connections (> 1000)

### Alert Routing
- **Critical** → Slack + PagerDuty (immediate)
- **Warning** → Slack (5-15 min)
- **Info** → Slack #info (as needed)

## Structured Log Format

Every log entry includes:
```json
{
  "timestamp": "2026-08-11T10:30:45.123Z",
  "level": "info|error|warn|debug|trace",
  "module": "module-name",
  "message": "log message",
  "correlationId": "uuid",
  "metadata": { ... },
  "duration_ms": 123,
  "error": {
    "type": "ErrorName",
    "message": "error message",
    "stack": "..."
  }
}
```

## Correlation ID Tracking

**Auto-generated** if not in request header

**Propagated** through:
- HTTP Response Header: `X-Correlation-ID`
- All logs for request
- All database queries
- All external API calls
- Tracing spans

**Usage**: Track request end-to-end
```bash
# Search Kibana for specific request
correlationId: "550e8400-e29b-41d4-a716-446655440000"
```

## Performance Metrics

| Operation | Histogram Buckets |
|-----------|-------------------|
| HTTP | 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000 ms |
| DB Query | 5, 10, 25, 50, 100, 250, 500, 1000 ms |
| External API | 100, 250, 500, 1000, 2500, 5000, 10000 ms |
| Queue Process | 100, 250, 500, 1000, 2500, 5000, 10000 ms |
| Notification | 100, 250, 500, 1000, 2500, 5000 ms |
| GPS Update | 10, 50, 100, 250, 500, 1000 ms |

## Business Metrics

| Metric | Labels | Purpose |
|--------|--------|---------|
| `active_bookings` | booking_type, status | Track live bookings |
| `booking_creation_total` | booking_type, service_type | Track new bookings |
| `revenue_total` | booking_type, payment_method | Revenue tracking |
| `revenue_per_booking` | booking_type | Revenue distribution |

## System Metrics

| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| `db_connection_pool_active` | Connection usage | > 90% full |
| `active_http_connections` | HTTP load | Informational |
| `active_websocket_connections` | WebSocket load | > 1000 |
| Health Check | Service alive | Response time |

## Troubleshooting

### No Metrics
```bash
# Check endpoint
curl http://localhost:5050/observability/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# View Prometheus logs
docker logs fleetpro-prometheus
```

### No Traces
```bash
# Check Jaeger is running
curl http://localhost:14269/

# Check app logs for tracing errors
# Verify JAEGER_ENDPOINT is set
```

### No Logs in Kibana
```bash
# Check Elasticsearch
curl http://localhost:9200/_health

# Create index pattern
# Make sure application logging is enabled
```

### Memory Issues
```bash
# Reduce retention periods
docker-compose -f docker-compose.observability.yml down

# Edit docker-compose.observability.yml
# Change retention from 30d to 7d

docker-compose -f docker-compose.observability.yml up -d
```

## Useful Links

- **Full Docs**: `docs/OBSERVABILITY.md`
- **Setup Guide**: `docs/OBSERVABILITY-SETUP.md`
- **Implementation**: `docs/OBSERVABILITY-IMPLEMENTATION.md`
- **Prometheus Docs**: https://prometheus.io/docs/
- **Grafana Docs**: https://grafana.com/docs/grafana/latest/
- **Jaeger Docs**: https://www.jaegertracing.io/docs/
- **ELK Docs**: https://www.elastic.co/guide/

## Keyboard Shortcuts (Grafana)

| Key | Action |
|-----|--------|
| `d` | Duplicate panel |
| `r` | Refresh dashboard |
| `t` | Toggle time picker |
| `e` | Edit dashboard |
| `s` | Save dashboard |

## Common PromQL Patterns

**Rate of change**
```promql
rate(metric_total[5m])  # 5-minute rate
```

**Percentile**
```promql
histogram_quantile(0.95, metric_bucket)  # P95
```

**Range vector**
```promql
metric[5m]  # Last 5 minutes
```

**Aggregation**
```promql
sum(metric) by (label)  # Group by label
```

**Filtering**
```promql
metric{job="fleetpro-app", status_code=~"5.."}
```

## Example Dashboard Queries

**Copy-paste ready for Grafana panels**

```promql
# Panel 1: Request Rate
rate(http_requests_total[5m])

# Panel 2: Latency P95
histogram_quantile(0.95, rate(request_latency_ms_bucket[5m]))

# Panel 3: Delivery Success by Channel
sum(rate(delivery_success_total[5m])) by (channel)

# Panel 4: Queue Depth
queue_depth

# Panel 5: Error Rate
rate(http_requests_total{status_code=~"5.."}[5m])

# Panel 6: Active Bookings
sum(active_bookings) by (booking_type, status)

# Panel 7: Cache Hit Rate
cache_hit_rate

# Panel 8: Database Connection Usage
(db_connection_pool_active / db_connection_pool_size) * 100
```

---

**For detailed information**: See `docs/OBSERVABILITY.md`
