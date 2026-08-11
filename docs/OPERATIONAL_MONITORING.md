# FleetPro Monitoring & Observability Guide

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Metrics to Monitor](#metrics-to-monitor)
2. [Dashboard Setup](#dashboard-setup)
3. [Alert Configuration](#alert-configuration)
4. [Log Analysis](#log-analysis)
5. [Health Checks](#health-checks)
6. [Performance Thresholds](#performance-thresholds)

---

## Metrics to Monitor

### Server Metrics

#### CPU Usage
```bash
# Metric: cpu_usage_percent
# Query: system_cpu_usage / 100 * 100
# Alert Levels:
# - Warning: > 70% for 5 minutes
# - Critical: > 85% for 5 minutes
# - Emergency: > 95% for 2 minutes

# View in Prometheus
curl -s http://localhost:9090/api/v1/query?query=cpu_usage_percent
```

#### Memory Usage
```bash
# Metric: memory_usage_percent
# Formula: (used_memory / total_memory) * 100
# Alert Levels:
# - Warning: > 75% for 10 minutes
# - Critical: > 85% for 10 minutes
# - Emergency: > 95% for 2 minutes

# View memory trends
curl -s http://localhost:9090/api/v1/query_range?query=memory_usage_percent&start=2026-08-12T00:00:00Z&end=2026-08-12T23:59:59Z
```

#### Disk Usage
```bash
# Metric: disk_usage_percent
# Alert Levels:
# - Warning: > 70%
# - Critical: > 85%
# - Emergency: > 95%

# Available disk space
df -h /

# Projected disk full date
# If growing 500MB/day and 30GB available
# Full in: 30GB / 500MB = 60 days
```

#### Network I/O
```bash
# Metrics:
# - network_bytes_in (ingress)
# - network_bytes_out (egress)

# Monitor for:
# - Unusual spikes (DDoS attack)
# - Sustained high traffic (capacity planning)

# View network usage
ifstat -i eth0 1
```

### Application Metrics

#### Request Rate
```bash
# Metric: http_requests_total
# Query format: rate(http_requests_total[5m])

# Expected:
# - Normal: 1000-5000 req/sec
# - Peak: 10000-50000 req/sec

# Alert if rate drops (possible outage)
# alert_on_rate_drop = (rate < 500 AND is_business_hours)
```

#### Error Rate
```bash
# Metric: http_requests_error_total
# Formula: (error_requests / total_requests) * 100

# Alert Levels:
# - Warning: > 0.5% for 5 minutes
# - Critical: > 1% for 5 minutes
# - Emergency: > 5% for 2 minutes

# Track errors by type
# - 4xx (client errors)
# - 5xx (server errors)
```

#### Response Time
```bash
# Metrics:
# - http_request_duration_seconds (histogram)

# Percentiles to track:
# - p50 (median): < 200ms
# - p95: < 500ms
# - p99: < 1000ms
# - p99.9: < 2000ms

# Grafana query:
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

#### Request Latency by Endpoint
```bash
# Track slowest endpoints
# Top 5 slowest endpoints:
curl -s http://localhost:5050/metrics | grep "http_request_duration_seconds_bucket" | sort -t= -k4 -rn | head -5

# Optimize endpoints with:
# - p99 > 2000ms
# - Error rate > 1%
```

### Database Metrics

#### Connection Pool Status
```bash
# Metrics:
# - db_connection_pool_size (total)
# - db_connection_pool_available (available)
# - db_connection_pool_in_use (in use)

# Alerts:
# - Warning: < 10% available connections
# - Critical: < 5% available connections
# - Emergency: 0% available (connection pool exhausted)

# View connections
mongosh --eval "
  db.serverStatus().connections
"
```

#### Queries Per Second
```bash
# Metrics:
# - db_operations_insert_rate
# - db_operations_query_rate
# - db_operations_update_rate
# - db_operations_delete_rate

# Expected ratios:
# - Query: 60-70%
# - Update: 20-30%
# - Delete: 1-5%
# - Insert: 1-10%
```

#### Slow Queries
```bash
# Metric: db_slow_query_count (> 100ms)
# Alert: > 10 slow queries in 5 minutes

# Find slow queries
mongosh --eval "
  db.system.profile.find({
    millis: {\$gt: 100}
  }).sort({ts: -1}).limit(20).pretty()
"
```

#### Database Size
```bash
# Metrics:
# - db_data_size_bytes
# - db_storage_size_bytes
# - db_index_size_bytes

# Track growth:
# - Daily growth: < 1GB
# - Alert if: > 50GB total

mongosh --eval "
  db.stats()
"
```

### Notification Metrics

#### Delivery Rate
```bash
# Metric: notification_delivery_rate (%)
# Formula: (successful_deliveries / total_attempts) * 100

# Targets by channel:
# - Email: > 95%
# - SMS: > 98%
# - Push: > 90%
# - In-App: 99%

# Alert if delivery rate drops below 90%
```

#### Queue Depth
```bash
# Metric: notification_queue_depth
# Alert Levels:
# - Warning: > 1000 pending
# - Critical: > 10000 pending
# - Emergency: > 100000 pending

# Check queue status
curl -s http://localhost:5050/api/admin/notifications/queue | jq '.pending_count'
```

#### Notification Latency
```bash
# Metric: notification_send_duration_seconds
# Percentiles:
# - p50: < 100ms
# - p95: < 500ms
# - p99: < 1000ms

# Alert if p99 > 5000ms
```

---

## Dashboard Setup

### Grafana Installation

```bash
# 1. Install Grafana
docker run -d -p 3000:3000 \
  --name=grafana \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana

# 2. Access at http://localhost:3000
# Username: admin
# Password: admin

# 3. Add Prometheus data source
# URL: http://prometheus:9090

# 4. Create dashboards
```

### Key Dashboards

#### System Health Dashboard
```json
{
  "dashboard": {
    "title": "System Health",
    "panels": [
      {
        "title": "CPU Usage",
        "targets": [{"expr": "cpu_usage_percent"}]
      },
      {
        "title": "Memory Usage",
        "targets": [{"expr": "memory_usage_percent"}]
      },
      {
        "title": "Disk Usage",
        "targets": [{"expr": "disk_usage_percent"}]
      },
      {
        "title": "Network I/O",
        "targets": [
          {"expr": "rate(network_bytes_in[5m])"},
          {"expr": "rate(network_bytes_out[5m])"}
        ]
      }
    ]
  }
}
```

#### Application Performance Dashboard
```json
{
  "dashboard": {
    "title": "Application Performance",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{"expr": "rate(http_requests_total[5m])"}]
      },
      {
        "title": "Error Rate",
        "targets": [{"expr": "rate(http_requests_error_total[5m]) / rate(http_requests_total[5m]) * 100"}]
      },
      {
        "title": "Response Time (p99)",
        "targets": [{"expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))"}]
      },
      {
        "title": "Requests by Endpoint",
        "targets": [{"expr": "topk(10, rate(http_requests_total[5m]))"}]
      }
    ]
  }
}
```

#### Database Performance Dashboard
```json
{
  "dashboard": {
    "title": "Database Performance",
    "panels": [
      {
        "title": "Connection Pool Status",
        "targets": [
          {"expr": "db_connection_pool_in_use"},
          {"expr": "db_connection_pool_available"}
        ]
      },
      {
        "title": "Operations Per Second",
        "targets": [
          {"expr": "rate(db_operations_query_total[5m])"},
          {"expr": "rate(db_operations_update_total[5m])"},
          {"expr": "rate(db_operations_insert_total[5m])"},
          {"expr": "rate(db_operations_delete_total[5m])"}
        ]
      },
      {
        "title": "Slow Query Count",
        "targets": [{"expr": "db_slow_query_count"}]
      },
      {
        "title": "Database Size",
        "targets": [
          {"expr": "db_data_size_bytes"},
          {"expr": "db_index_size_bytes"}
        ]
      }
    ]
  }
}
```

#### Business Metrics Dashboard
```json
{
  "dashboard": {
    "title": "Business Metrics",
    "panels": [
      {
        "title": "Active Bookings",
        "targets": [{"expr": "booking_active_count"}]
      },
      {
        "title": "Booking Revenue (24h)",
        "targets": [{"expr": "booking_revenue_24h"}]
      },
      {
        "title": "Customer Growth (7d)",
        "targets": [{"expr": "customer_new_7d"}]
      },
      {
        "title": "System Uptime",
        "targets": [{"expr": "up_time_seconds / 86400"}]
      }
    ]
  }
}
```

---

## Alert Configuration

### Prometheus Alert Rules

```yaml
# prometheus-rules.yml

groups:
  - name: system_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage_percent > 80
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}%"

      - alert: HighMemoryUsage
        expr: memory_usage_percent > 85
        for: 10m
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}%"

      - alert: DiskSpaceRunningOut
        expr: disk_usage_percent > 90
        annotations:
          summary: "Disk space running out"
          description: "Disk usage is {{ $value }}%"

  - name: application_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: (rate(http_requests_error_total[5m]) / rate(http_requests_total[5m])) > 0.01
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        annotations:
          summary: "Slow response times"
          description: "p99 response time is {{ $value }}s"

  - name: database_alerts
    interval: 30s
    rules:
      - alert: ConnectionPoolExhausted
        expr: db_connection_pool_available / db_connection_pool_size < 0.1
        for: 2m
        annotations:
          summary: "Connection pool running low"
          description: "Only {{ $value | humanizePercentage }} connections available"

      - alert: SlowQueries
        expr: db_slow_query_count > 10
        for: 5m
        annotations:
          summary: "Slow queries detected"
          description: "{{ $value }} slow queries in last 5 minutes"

  - name: notification_alerts
    interval: 30s
    rules:
      - alert: LowDeliveryRate
        expr: notification_delivery_rate < 0.9
        for: 15m
        annotations:
          summary: "Low notification delivery rate"
          description: "Delivery rate is {{ $value | humanizePercentage }}"

      - alert: QueueBackup
        expr: notification_queue_depth > 10000
        for: 5m
        annotations:
          summary: "Notification queue backup"
          description: "{{ $value }} notifications waiting to send"
```

### Alert Routing

```yaml
# alertmanager-config.yml

global:
  resolve_timeout: 5m

route:
  receiver: default
  routes:
    - match:
        severity: critical
      receiver: critical_team
      repeat_interval: 15m

    - match:
        severity: warning
      receiver: team
      repeat_interval: 1h

    - match_re:
        alertname: "HighCPUUsage|HighMemoryUsage"
      receiver: infrastructure_team

    - match_re:
        alertname: "HighErrorRate|SlowResponseTime"
      receiver: application_team

receivers:
  - name: default
    webhook_configs:
      - url: 'http://localhost:5001/webhook'

  - name: critical_team
    pagerduty_configs:
      - service_key: 'PagerDuty_Service_Key'
    slack_configs:
      - api_url: 'Slack_Webhook_URL'
        channel: '#alerts-critical'

  - name: team
    slack_configs:
      - api_url: 'Slack_Webhook_URL'
        channel: '#alerts'

  - name: infrastructure_team
    slack_configs:
      - api_url: 'Slack_Webhook_URL'
        channel: '#infrastructure'

  - name: application_team
    slack_configs:
      - api_url: 'Slack_Webhook_URL'
        channel: '#application'
```

---

## Log Analysis

### Elasticsearch & Kibana Setup

```bash
# 1. Install Elasticsearch
docker run -d -p 9200:9200 \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:7.15.0

# 2. Install Kibana
docker run -d -p 5601:5601 \
  -e "ELASTICSEARCH_HOSTS=http://elasticsearch:9200" \
  docker.elastic.co/kibana/kibana:7.15.0

# 3. Configure logging
# Update server/logger.ts to send logs to Elasticsearch
```

### Key Log Patterns to Search

```javascript
// Error analysis
{
  "query": {
    "match": {
      "level": "error"
    }
  }
}

// Slow requests (> 1000ms)
{
  "query": {
    "range": {
      "duration_ms": {
        "gte": 1000
      }
    }
  }
}

// Failed API calls
{
  "query": {
    "match": {
      "http_status": {
        "query": "5xx"
      }
    }
  }
}

// Authentication failures
{
  "query": {
    "match": {
      "event": "authentication_failed"
    }
  }
}
```

### Alert Triggers Based on Logs

```javascript
// High error rate alert
{
  "trigger": {
    "schedule": {
      "interval": "5m"
    }
  },
  "input": {
    "search": {
      "indices": ["logs"],
      "body": {
        "query": {
          "bool": {
            "must": [
              {"match": {"level": "error"}},
              {"range": {"timestamp": {"gte": "now-5m"}}}
            ]
          }
        }
      }
    }
  },
  "condition": {
    "compare": {
      "ctx.payload.aggregations.error_count.value": {
        "gt": 50
      }
    }
  }
}
```

---

## Health Checks

### Automated Health Endpoints

```javascript
// GET /health - Basic health check
{
  "status": "healthy",
  "timestamp": "2026-08-12T12:34:56Z",
  "uptime_seconds": 86400
}

// GET /health/detailed - Comprehensive health check
{
  "status": "healthy",
  "timestamp": "2026-08-12T12:34:56Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 25,
      "connections": {
        "active": 45,
        "available": 55,
        "total": 100
      }
    },
    "cache": {
      "status": "healthy",
      "response_time_ms": 2,
      "memory_mb": 256
    },
    "notifications": {
      "status": "healthy",
      "queue_depth": 342,
      "delivery_rate": 0.95
    },
    "storage": {
      "status": "healthy",
      "disk_usage_percent": 45,
      "available_gb": 150
    }
  }
}

// GET /metrics - Prometheus metrics
# TYPE http_requests_total counter
http_requests_total{endpoint="/api/bookings",method="GET"} 50000
http_requests_total{endpoint="/api/bookings",method="POST"} 15000

# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="0.1"} 40000
http_request_duration_seconds_bucket{endpoint="/api/bookings",le="0.5"} 49500
```

### Health Check Implementation

```javascript
// server/health.ts

app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    environment: process.env.NODE_ENV
  }

  res.json(health)
})

app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  }

  // Check database
  try {
    const startTime = Date.now()
    await db.adminCommand('ping')
    health.services.database = {
      status: 'healthy',
      response_time_ms: Date.now() - startTime
    }
  } catch (e) {
    health.status = 'degraded'
    health.services.database = {
      status: 'unhealthy',
      error: e.message
    }
  }

  // Check cache
  try {
    const startTime = Date.now()
    await redis.ping()
    health.services.cache = {
      status: 'healthy',
      response_time_ms: Date.now() - startTime
    }
  } catch (e) {
    health.services.cache = {
      status: 'unhealthy',
      error: e.message
    }
  }

  res.json(health)
})

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(metrics.export())  // Prometheus format
})
```

---

## Performance Thresholds

### SLA Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Availability | 99.9% | 99.5% | 99% |
| Response Time (p99) | < 1s | 1-2s | > 2s |
| Error Rate | < 0.1% | 0.1-0.5% | > 0.5% |
| CPU Usage | < 60% | 70% | 85% |
| Memory Usage | < 70% | 75% | 85% |
| Disk Usage | < 70% | 80% | 90% |
| DB Connections | < 80% | 85% | 95% |
| Notification Delivery | > 95% | 90% | 85% |

### Performance Budgets

```javascript
// client/performance-budget.json
{
  "bundles": [
    {
      "name": "main",
      "maxSize": "250kb"  // gzipped
    },
    {
      "name": "booking",
      "maxSize": "150kb"
    }
  ],
  "metrics": [
    {
      "name": "First Contentful Paint",
      "maxSize": "1s"
    },
    {
      "name": "Largest Contentful Paint",
      "maxSize": "2.5s"
    },
    {
      "name": "Cumulative Layout Shift",
      "maxSize": "0.1"
    }
  ]
}
```

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
