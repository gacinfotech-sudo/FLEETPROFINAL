# FleetPro Health Check Endpoints Documentation

Complete reference for all health check and monitoring endpoints available in FleetPro.

---

## Overview

The application provides multiple health check endpoints at different levels of detail for monitoring and diagnostics:

1. **Basic Health Check** - Simple UP/DOWN status
2. **Detailed Health Check** - System component status
3. **Dependencies Check** - External service connectivity
4. **Metrics Endpoint** - Prometheus metrics for monitoring

---

## Basic Health Check

### Endpoint: `GET /health`

Simple health check for load balancers and uptime monitoring.

#### Response: 200 OK

```json
{
    "status": "UP",
    "timestamp": "2026-08-12T10:30:45.123Z",
    "uptime": 3600.123
}
```

#### Response: 503 Service Unavailable

```json
{
    "status": "DOWN",
    "timestamp": "2026-08-12T10:30:45.123Z",
    "error": "Database connection failed"
}
```

#### Usage Examples

```bash
# cURL
curl -s http://localhost:5050/health | jq .

# Wget
wget -qO- http://localhost:5050/health

# Docker Compose Health Check
healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:5050/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

#### Use Cases

- Load balancer health checks
- Kubernetes liveness probes
- Simple uptime monitoring
- Nginx upstream health check

---

## Detailed Health Check

### Endpoint: `GET /health/detailed`

Comprehensive system health information including all components.

#### Response: 200 OK

```json
{
    "status": "UP",
    "timestamp": "2026-08-12T10:30:45.123Z",
    "uptime": 3600.123,
    "application": {
        "name": "FleetPro",
        "version": "1.0.0",
        "environment": "production",
        "nodeVersion": "v20.5.0"
    },
    "components": {
        "database": {
            "status": "UP",
            "latency": 2,
            "poolSize": 50,
            "activeConnections": 15
        },
        "cache": {
            "status": "UP",
            "latency": 1,
            "memoryUsage": "512MB",
            "operationalMemory": "256MB"
        },
        "messaging": {
            "status": "UP",
            "queueLength": 12
        },
        "notifications": {
            "status": "UP",
            "pendingNotifications": 5,
            "lastSentAt": "2026-08-12T10:29:30.000Z"
        },
        "fileStorage": {
            "status": "UP",
            "storageUsed": "2.5GB",
            "storageAvailable": "47.5GB"
        }
    },
    "performance": {
        "memoryUsage": {
            "rss": "512MB",
            "heapUsed": "256MB",
            "heapTotal": "512MB"
        },
        "cpuUsage": {
            "user": 0.5,
            "system": 0.2
        },
        "requestMetrics": {
            "totalRequests": 12500,
            "requestsPerSecond": 3.5,
            "averageResponseTime": 45,
            "p99ResponseTime": 250
        }
    }
}
```

#### Usage Examples

```bash
# Get detailed health with jq filtering
curl -s http://localhost:5050/health/detailed | jq '.components'

# Monitor specific component
curl -s http://localhost:5050/health/detailed | jq '.components.database'

# Check performance metrics
curl -s http://localhost:5050/health/detailed | jq '.performance'
```

#### Use Cases

- Detailed monitoring dashboards
- Debugging deployment issues
- Performance analytics
- Capacity planning
- Alert threshold configuration

---

## Dependencies Health Check

### Endpoint: `GET /health/dependencies`

Check connectivity and health of all external dependencies and services.

#### Response: 200 OK (All Healthy)

```json
{
    "status": "UP",
    "timestamp": "2026-08-12T10:30:45.123Z",
    "dependencies": {
        "mongodb": {
            "status": "UP",
            "latency": 2,
            "type": "database",
            "version": "7.0.0",
            "databaseSize": "5.2GB",
            "collectionCount": 15,
            "indexes": 45
        },
        "redis": {
            "status": "UP",
            "latency": 1,
            "type": "cache",
            "version": "7.0.1",
            "memoryUsed": "256MB",
            "keysCount": 1245,
            "evictionPolicy": "allkeys-lru"
        },
        "sendgrid": {
            "status": "UP",
            "latency": 150,
            "type": "email_service",
            "version": "v3",
            "lastTestAt": "2026-08-12T10:29:15.000Z"
        },
        "twilio": {
            "status": "UP",
            "latency": 200,
            "type": "sms_service",
            "version": "2010-04-01",
            "lastTestAt": "2026-08-12T10:28:45.000Z"
        },
        "whatsapp": {
            "status": "UP",
            "latency": 300,
            "type": "messaging_service",
            "provider": "meta",
            "version": "v18.0",
            "lastTestAt": "2026-08-12T10:27:30.000Z"
        },
        "stripe": {
            "status": "UP",
            "latency": 250,
            "type": "payment_gateway",
            "version": "2020-08-27",
            "lastTestAt": "2026-08-12T10:26:45.000Z"
        },
        "googleMaps": {
            "status": "UP",
            "latency": 180,
            "type": "geolocation_service",
            "lastTestAt": "2026-08-12T10:25:30.000Z"
        }
    }
}
```

#### Response: 503 Service Unavailable (Dependency Down)

```json
{
    "status": "DEGRADED",
    "timestamp": "2026-08-12T10:30:45.123Z",
    "dependencies": {
        "mongodb": {
            "status": "DOWN",
            "error": "Connection timeout after 5000ms",
            "lastHealthyAt": "2026-08-12T10:20:15.000Z",
            "downtime": 600000
        },
        "redis": {
            "status": "UP",
            "latency": 1
        }
    }
}
```

#### Usage Examples

```bash
# Check all external services
curl -s http://localhost:5050/health/dependencies | jq '.dependencies'

# Check specific service
curl -s http://localhost:5050/health/dependencies | jq '.dependencies.mongodb'

# Monitor latency
curl -s http://localhost:5050/health/dependencies | \
    jq '.dependencies | to_entries[] | {service: .key, latency: .value.latency}'

# Alert if any service is down
curl -s http://localhost:5050/health/dependencies | \
    jq 'select(.dependencies[].status == "DOWN")'
```

#### Use Cases

- External service dependency monitoring
- Alerting on third-party service outages
- Latency tracking for API calls
- Incident correlation analysis
- Cascade failure prevention

---

## Metrics Endpoint (Prometheus)

### Endpoint: `GET /metrics`

Prometheus-format metrics for time-series monitoring and alerting.

#### Response: 200 OK (Plain Text)

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 12543
http_requests_total{method="POST",status="201"} 3452
http_requests_total{method="GET",status="404"} 125
http_requests_total{method="GET",status="500"} 12

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.05"} 5000
http_request_duration_seconds_bucket{le="0.1"} 8500
http_request_duration_seconds_bucket{le="0.5"} 10000
http_request_duration_seconds_bucket{le="1"} 11500
http_request_duration_seconds_bucket{le="+Inf"} 12543
http_request_duration_seconds_sum 4521.5
http_request_duration_seconds_count 12543

# HELP process_memory_rss_bytes Memory in bytes
# TYPE process_memory_rss_bytes gauge
process_memory_rss_bytes 536870912

# HELP nodejs_heap_size_used_bytes Heap size used
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes 268435456

# HELP database_connection_pool_size Database connection pool size
# TYPE database_connection_pool_size gauge
database_connection_pool_size{db="mongodb"} 50

# HELP database_connection_pool_active Active connections
# TYPE database_connection_pool_active gauge
database_connection_pool_active{db="mongodb"} 15

# HELP cache_hits_total Total cache hits
# TYPE cache_hits_total counter
cache_hits_total 98765

# HELP cache_misses_total Total cache misses
# TYPE cache_misses_total counter
cache_misses_total 1234

# HELP bookings_total Total bookings
# TYPE bookings_total counter
bookings_total{status="completed"} 1500
bookings_total{status="pending"} 50
bookings_total{status="cancelled"} 30

# HELP payment_transactions_total Total payment transactions
# TYPE payment_transactions_total counter
payment_transactions_total{status="success"} 1480
payment_transactions_total{status="failed"} 20

# HELP notifications_sent_total Total notifications sent
# TYPE notifications_sent_total counter
notifications_sent_total{type="email"} 5000
notifications_sent_total{type="sms"} 2300
notifications_sent_total{type="push"} 8900
```

#### Access Control

The metrics endpoint should be restricted to internal networks:

```nginx
location /metrics {
    allow 127.0.0.1;
    allow 172.28.0.0/16;  # Docker network
    allow 10.0.0.0/8;     # Internal network
    deny all;
    proxy_pass http://fleetpro_backend;
}
```

#### Usage Examples

```bash
# Fetch metrics
curl -s http://localhost:5050/metrics | head -20

# Filter specific metric
curl -s http://localhost:5050/metrics | grep http_requests_total

# Prometheus scrape config
cat >> /etc/prometheus/prometheus.yml << 'EOF'
scrape_configs:
  - job_name: 'fleetpro'
    static_configs:
      - targets: ['localhost:5050']
    metrics_path: '/metrics'
    scrape_interval: 15s
EOF
```

#### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | counter | Total HTTP requests by method/status |
| `http_request_duration_seconds` | histogram | Request latency distribution |
| `process_memory_rss_bytes` | gauge | Process memory usage |
| `nodejs_heap_size_used_bytes` | gauge | V8 heap memory usage |
| `database_connection_pool_size` | gauge | Database pool configuration |
| `database_connection_pool_active` | gauge | Active database connections |
| `database_query_duration_seconds` | histogram | Database query latency |
| `cache_hits_total` | counter | Cache hit count |
| `cache_misses_total` | counter | Cache miss count |
| `bookings_total` | counter | Total bookings by status |
| `payment_transactions_total` | counter | Payment transactions by status |
| `notifications_sent_total` | counter | Notifications sent by type |

#### Use Cases

- Time-series monitoring and dashboards
- Alert threshold definition
- Performance trend analysis
- Capacity planning
- SLA monitoring

---

## Health Check Response Codes

| Code | Status | Meaning |
|------|--------|---------|
| 200 | OK | Service is healthy and running |
| 503 | Service Unavailable | Service is unhealthy or dependencies unavailable |
| 429 | Too Many Requests | Rate limit exceeded on health check |
| 401 | Unauthorized | Authentication required for endpoint |

---

## Health Check Integration Examples

### Docker Compose

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5050/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Kubernetes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fleetpro
spec:
  containers:
  - name: app
    livenessProbe:
      httpGet:
        path: /health
        port: 5050
      initialDelaySeconds: 30
      periodSeconds: 10

    readinessProbe:
      httpGet:
        path: /health/detailed
        port: 5050
      initialDelaySeconds: 10
      periodSeconds: 5
```

### Prometheus Alerting Rules

```yaml
groups:
  - name: fleetpro_health
    rules:
      - alert: AppDown
        expr: up{job="fleetpro"} == 0
        for: 1m
        annotations:
          summary: "FleetPro application is down"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseDown
        expr: |
          (up{job="mongodb"} == 0) or
          (rate(mongodb_errors_total[5m]) > 0.1)
        for: 1m
        annotations:
          summary: "Database error detected"

      - alert: HighMemoryUsage
        expr: nodejs_heap_size_used_bytes > 1073741824  # 1GB
        for: 5m
        annotations:
          summary: "High memory usage detected"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "FleetPro Health",
    "panels": [
      {
        "title": "Application Status",
        "targets": [
          {
            "expr": "up{job=\"fleetpro\"}"
          }
        ]
      },
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "nodejs_heap_size_used_bytes"
          }
        ]
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "database_connection_pool_active"
          }
        ]
      }
    ]
  }
}
```

---

## Monitoring Best Practices

### 1. Health Check Frequency

- **Production:** Every 10-30 seconds
- **Staging:** Every 30-60 seconds
- **Development:** Every 60 seconds or manual

### 2. Alert Thresholds

- **Response Time:** Alert if > 1 second
- **Error Rate:** Alert if > 1% of requests
- **Memory Usage:** Alert if > 80% of heap
- **Database Latency:** Alert if > 100ms
- **Cache Hit Ratio:** Alert if < 70%

### 3. Monitoring Stack

```bash
# Recommended tools
- Prometheus (metrics collection)
- Grafana (visualization)
- Jaeger (distributed tracing)
- ELK Stack (logs aggregation)
- Alert Manager (alerting)
```

### 4. On-Call Procedures

- Page on-call engineer if ANY service is DOWN
- Investigate and resolve within 15 minutes
- Escalate to team lead if unresolved after 30 minutes
- Post-mortem within 24 hours

---

## Troubleshooting

### Health Check Returns 503

1. **Check application logs:** `docker logs fleetpro-app`
2. **Check database:** `docker exec fleetpro-mongodb mongosh --eval "db.adminCommand('ping')"`
3. **Check Redis:** `redis-cli ping`
4. **Check network:** `docker network ls`
5. **Restart service:** `docker restart fleetpro-app`

### Slow Health Check Responses

1. **Check database performance:** `docker exec fleetpro-mongodb mongosh --eval "db.currentOp()"`
2. **Check network latency:** `ping -c 5 mongodb`
3. **Check Redis memory:** `redis-cli info memory`
4. **Increase timeout:** Adjust health check timeout in orchestration

### Missing Metrics

1. **Verify metrics endpoint:** `curl http://localhost:5050/metrics`
2. **Check Prometheus configuration:** Verify scrape_config
3. **Verify firewall:** Check network policies allow metrics access
4. **Check application logs:** Look for metric collection errors

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-08-12  
**Maintained By:** DevOps & SRE Team
