# FleetPro Observability Setup Guide

Quick start guide for setting up and running the complete observability stack.

## Quick Start (5 minutes)

### 1. Start Observability Stack

```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Start all observability services
docker-compose -f docker-compose.observability.yml up -d

# Wait for services to be healthy (30 seconds)
docker-compose -f docker-compose.observability.yml ps
```

### 2. Verify Services

```bash
# Check Prometheus
curl http://localhost:9090/-/healthy

# Check Jaeger
curl http://localhost:14269/

# Check Elasticsearch
curl http://localhost:9200/_health

# Check Grafana
curl http://localhost:3000/api/health
```

### 3. Initialize Application Observability

Update `server/index.ts`:

```typescript
import { initializeObservability, registerPrometheusEndpoint } from './observability';

const app = express();

// Add this after app creation, before routes
initializeObservability(app, 'fleetpro');
registerPrometheusEndpoint(app, '/observability');

// ... rest of your setup
```

### 4. Start Application

```bash
npm run dev
```

### 5. Access Dashboards

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3000 (admin/admin) |
| Prometheus | http://localhost:9090 |
| Jaeger | http://localhost:16686 |
| Kibana | http://localhost:5601 |
| Metrics | http://localhost:5050/observability/metrics |

## Installation Details

### Dependencies Required

Add to `package.json`:

```json
{
  "dependencies": {
    "prom-client": "^15.0.0",
    "winston": "^3.11.0",
    "@opentelemetry/api": "^1.8.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/auto-instrumentations-node": "^0.41.0",
    "@opentelemetry/sdk-trace-node": "^0.45.0",
    "@opentelemetry/exporter-jaeger-http": "^1.18.0",
    "@opentelemetry/resources": "^0.45.0",
    "@opentelemetry/semantic-conventions": "^1.20.0",
    "uuid": "^9.0.0"
  }
}
```

Install dependencies:

```bash
npm install prom-client winston @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/sdk-trace-node @opentelemetry/exporter-jaeger-http @opentelemetry/resources @opentelemetry/semantic-conventions uuid
```

### File Structure

```
fleetpro-main/
├── server/
│   ├── observability/
│   │   ├── index.ts                    (Main exports)
│   │   ├── metrics.ts                  (Prometheus metrics)
│   │   ├── structured-logging.ts       (Winston logging)
│   │   ├── tracing.ts                  (OpenTelemetry)
│   │   ├── observability-middleware.ts (Integration)
│   │   └── prometheus-endpoint.ts      (Scrape endpoint)
│   └── index.ts                        (Update: add observability init)
├── monitoring/
│   ├── prometheus.yml                  (Prometheus config)
│   ├── alerts.yml                      (Alert rules)
│   ├── alertmanager.yml                (Alert routing)
│   ├── logstash.conf                   (Log processing)
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/
│       │   │   └── prometheus.yml
│       │   └── dashboards/
│       │       └── dashboard.yml
│       └── dashboards/
│           └── fleetpro-observability.json
├── docker-compose.observability.yml    (Stack definition)
└── docs/
    ├── OBSERVABILITY.md                (Full documentation)
    └── OBSERVABILITY-SETUP.md          (This file)
```

## Service Configuration

### Prometheus Configuration

File: `monitoring/prometheus.yml`

Key settings:
- Scrape interval: 15 seconds
- Evaluation interval: 15 seconds
- Retention: 30 days
- Targets: localhost:5050 (app), localhost:9100 (node), localhost:9216 (mongodb)

To modify:
```yaml
global:
  scrape_interval: 30s  # Change interval
  evaluation_interval: 30s
  
# Add/remove scrape targets
scrape_configs:
  - job_name: 'fleetpro-app'
    static_configs:
      - targets: ['localhost:5050']
```

### Grafana Configuration

Default login: `admin` / `admin`

Change password after first login:
1. Click profile icon → Change Password
2. Enter current password: `admin`
3. Enter new password

### Elasticsearch Configuration

Default: 1 node cluster (development only)

For production, update `docker-compose.observability.yml`:
```yaml
elasticsearch:
  environment:
    - discovery.type=multinode
    - cluster.name=fleetpro
```

### Jaeger Configuration

Storage: In-memory (development only)

For production, configure persistent storage:
```yaml
jaeger:
  environment:
    - COLLECTOR_ZIPKIN_HTTP_PORT=9411
    - MEMORY_MAX_TRACES=10000
```

## Metrics Collection

### Using Metrics Middleware

Automatically tracks:
- HTTP request latency
- Database queries
- External API calls
- Queue operations
- Cache hits/misses

No additional code needed if middleware is registered.

### Recording Custom Metrics

```typescript
import { 
  recordDeliveryAttempt,
  recordQueueProcessing,
  recordCacheAccess,
  recordDatabaseQuery,
  recordExternalApiCall 
} from './observability';

// In your service code
async function sendMessage() {
  const success = await recordDeliveryAttempt(...);
  const result = await recordQueueProcessing('queue-name', 'process', async () => {
    // Your queue processing logic
  });
}
```

### Prometheus Queries

Common queries for monitoring:

**Request throughput**
```promql
rate(http_requests_total[5m])
```

**Request latency P95**
```promql
histogram_quantile(0.95, rate(request_latency_ms_bucket[5m]))
```

**Delivery success rate**
```promql
delivery_success_rate{channel="sms"}
```

**Error rate**
```promql
rate(http_requests_total{status_code=~"5.."}[5m])
```

**Queue backlog**
```promql
queue_depth{queue_name="email-queue"}
```

## Logging Configuration

### Log Levels

```typescript
import { getLogger } from './observability';

const logger = getLogger('my-module');

logger.error('Critical error', { details }, error);   // RED
logger.warn('Warning', { details });                   // YELLOW
logger.info('Info', { details });                      // BLUE
logger.debug('Debug', { details });                    // GRAY
logger.trace('Trace', { details });                    // GRAY
```

### Structured Log Format

Every log includes:
```json
{
  "timestamp": "ISO 8601",
  "level": "error|warn|info|debug|trace",
  "module": "module name",
  "message": "log message",
  "correlationId": "request-id",
  "metadata": { "custom": "fields" },
  "duration_ms": 123,
  "error": {
    "type": "ErrorClass",
    "message": "error message",
    "stack": "stack trace"
  }
}
```

### Correlation ID

Automatically set from request header:
```
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

Used to trace request flow across all services.

## Tracing Configuration

### Initialize Tracing

```typescript
import { initializeTracing } from './observability';

// In server startup
initializeTracing('fleetpro', 'http://localhost:14268/api/traces');
```

### View Traces

1. Open http://localhost:16686
2. Select service "fleetpro"
3. Filter by operation or time range
4. Click trace to see detailed timeline

### Trace Sampling

For high-traffic applications, use sampling:

```typescript
// Sample 1% of requests
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBased(0.01),
});
```

## Log Aggregation (ELK)

### Elasticsearch

Access: http://localhost:9200

Check health:
```bash
curl http://localhost:9200/_health
```

View indices:
```bash
curl http://localhost:9200/_cat/indices?v
```

### Kibana

Access: http://localhost:5601

Create index pattern:
1. Settings → Index Patterns
2. Create Index Pattern
3. Name: `fleetpro-logs-*`
4. Time field: `@timestamp`
5. Save

Discover logs:
1. Click "Discover"
2. Select index pattern
3. Use filters to search
4. Create visualizations

## Alerting Setup

### Prometheus Alerts

Defined in `monitoring/alerts.yml`

Alert rules included:
- High latency (P95 > 1000ms)
- Low delivery success (< 95%)
- High error rate (> 5%)
- Service down (no response)
- High memory usage (> 2GB)

### AlertManager Configuration

Edit `monitoring/alertmanager.yml`:

```yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/URL'
  
receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#alerts'
```

Environment variables:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/URL
PAGERDUTY_SERVICE_KEY=YOUR_KEY
```

Reload AlertManager:
```bash
curl -X POST http://localhost:9093/-/reload
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.observability.yml logs [service-name]

# Verify ports are available
lsof -i :9090  # Prometheus
lsof -i :3000  # Grafana
lsof -i :16686 # Jaeger
lsof -i :9200  # Elasticsearch

# Clean restart
docker-compose -f docker-compose.observability.yml down -v
docker-compose -f docker-compose.observability.yml up -d
```

### Metrics Not Showing

```bash
# Check metrics endpoint
curl http://localhost:5050/observability/metrics

# Verify Prometheus scraping
curl http://localhost:9090/api/v1/targets

# Check Prometheus logs
docker logs fleetpro-prometheus
```

### Logs Not in Kibana

```bash
# Check Logstash
docker logs fleetpro-logstash

# Verify Elasticsearch has data
curl http://localhost:9200/_cat/indices?v

# Recreate index pattern in Kibana
```

### High Memory Usage

```bash
# Reduce retention periods
docker-compose -f docker-compose.observability.yml down

# Edit docker-compose.observability.yml
prometheus:
  command:
    - '--storage.tsdb.retention.time=7d'

docker-compose -f docker-compose.observability.yml up -d
```

## Performance Tuning

### Prometheus

Optimize disk usage:
```yaml
command:
  - '--storage.tsdb.retention.time=7d'
  - '--storage.tsdb.path=/prometheus'
```

Increase scrape timeout for slow endpoints:
```yaml
scrape_configs:
  - job_name: 'slow-api'
    scrape_timeout: 30s
```

### Elasticsearch

Increase heap for large datasets:
```yaml
environment:
  - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
```

### Grafana

Optimize dashboard refresh rates:
- Set minimum refresh to 30s for production
- Use datasource caching where available
- Limit dashboard panels to < 20

## Production Checklist

- [ ] All services running and healthy
- [ ] Prometheus scraping all targets
- [ ] Grafana password changed from default
- [ ] AlertManager configured with notification channels
- [ ] Elasticsearch retention policy set
- [ ] Jaeger configured for persistent storage
- [ ] Monitoring dashboards created
- [ ] Alert rules tested
- [ ] Log aggregation pipeline verified
- [ ] Trace sampling configured for load
- [ ] Backups configured for all data stores
- [ ] Documentation updated with runbooks

## Next Steps

1. **Create Custom Dashboards**: Add panels for your business metrics
2. **Configure Alerts**: Set up alert thresholds and notification channels
3. **Implement SLOs**: Define Service Level Objectives and track them
4. **Set up On-Call**: Configure PagerDuty for critical alerts
5. **Train Team**: Ensure team knows how to use observability tools

## Support

For issues:
1. Check logs: `docker-compose -f docker-compose.observability.yml logs`
2. Review OBSERVABILITY.md documentation
3. Check Prometheus targets: http://localhost:9090/targets
4. Verify service health endpoints:
   - `/observability/health`
   - `/observability/readiness`
   - `/observability/liveness`

---

**Last Updated**: 2026-08-11
**For Questions**: See docs/OBSERVABILITY.md
