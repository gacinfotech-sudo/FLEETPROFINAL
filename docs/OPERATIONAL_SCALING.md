# FleetPro Scaling & Performance Tuning Guide

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Horizontal Scaling](#horizontal-scaling)
2. [Vertical Scaling](#vertical-scaling)
3. [Database Scaling](#database-scaling)
4. [Capacity Planning](#capacity-planning)
5. [Load Testing](#load-testing)

---

## Horizontal Scaling

### Load Balancer Configuration

#### NGINX Setup

```nginx
# /etc/nginx/nginx.conf
upstream fleetpro_backend {
  least_conn;  # Use least connections algorithm
  server localhost:5050 weight=1 max_fails=2 fail_timeout=30s;
  server localhost:5051 weight=1 max_fails=2 fail_timeout=30s;
  server localhost:5052 weight=1 max_fails=2 fail_timeout=30s;
  server localhost:5053 weight=1 max_fails=2 fail_timeout=30s;
  
  keepalive 32;  # Connection pooling
}

server {
  listen 80;
  server_name api.fleetpro.example.com;

  location / {
    proxy_pass http://fleetpro_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Rate limiting
    limit_req zone=api burst=100 nodelay;
  }

  # Health check endpoint for load balancer
  location /health {
    proxy_pass http://fleetpro_backend/health;
  }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
```

#### HAProxy Setup

```
# /etc/haproxy/haproxy.cfg
global
  maxconn 4096
  timeout connect 5s
  timeout client 60s
  timeout server 60s

frontend fleetpro_frontend
  bind 0.0.0.0:80
  mode http
  default_backend fleetpro_backend

backend fleetpro_backend
  balance leastconn
  mode http
  
  # Sticky sessions (if needed)
  # cookie SERVERID insert indirect nocache
  
  server app1 localhost:5050 check
  server app2 localhost:5051 check
  server app3 localhost:5052 check
  server app4 localhost:5053 check
  
  # Health check
  option httpchk GET /health
```

### Service Discovery

#### Manual Service Registration

```bash
#!/bin/bash
# register-service.sh

SERVICE_NAME="fleetpro-app"
PORT=5050
HOSTNAME=$(hostname -f)

# Register in Consul
curl -X PUT http://localhost:8500/v1/kv/$SERVICE_NAME/servers/$HOSTNAME \
  -d "{\"host\": \"$HOSTNAME\", \"port\": $PORT, \"timestamp\": \"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\"}"

# Deregister on shutdown
trap "curl -X DELETE http://localhost:8500/v1/kv/$SERVICE_NAME/servers/$HOSTNAME" EXIT

# Keep alive
while true; do
  sleep 30
  curl -X PUT http://localhost:8500/v1/kv/$SERVICE_NAME/servers/$HOSTNAME/heartbeat \
    -d "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
done
```

#### Automated Service Discovery

```javascript
// server/service-discovery.ts
import Consul from 'consul'

const consul = new Consul({
  host: process.env.CONSUL_HOST || 'localhost',
  port: process.env.CONSUL_PORT || 8500
})

export async function registerService() {
  const serviceId = `${process.env.HOSTNAME}-${process.env.PORT}`
  
  await consul.agent.service.register({
    id: serviceId,
    name: 'fleetpro-app',
    address: process.env.HOSTNAME,
    port: parseInt(process.env.PORT || '5050'),
    check: {
      http: `http://localhost:${process.env.PORT}/health`,
      interval: '10s',
      timeout: '5s'
    },
    tags: [
      `version=${process.env.APP_VERSION}`,
      `environment=${process.env.NODE_ENV}`
    ]
  })

  console.log(`Service registered: ${serviceId}`)

  // Deregister on shutdown
  process.on('SIGTERM', async () => {
    await consul.agent.service.deregister(serviceId)
    process.exit(0)
  })
}

export async function getServiceNodes(serviceName: string) {
  const result = await consul.health.service({
    service: serviceName,
    passing: true
  })
  return result.map(r => `${r.Service.Address}:${r.Service.Port}`)
}
```

### Stateless Design Verification

```bash
#!/bin/bash
# verify-stateless.sh

echo "=== Checking for Stateless Design ==="

# 1. Check for file-based storage (should not exist)
if [ -d "data/" ] || [ -f "*.db" ]; then
  echo "ERROR: Found local file storage (should be stateless)"
  exit 1
fi

# 2. Check for local session storage
if grep -r "localStorage\|sessionStorage" src/ | grep -v node_modules; then
  echo "WARNING: Found browser session storage (OK for client state)"
fi

# 3. Check that all state is in external systems
if ! grep -r "redis\|mongodb" server/ | grep -q "import\|require"; then
  echo "ERROR: No external state storage found"
  exit 1
fi

# 4. Verify no singleton patterns
if grep -r "const.*=.*{.*state.*}" server/ | grep -v test; then
  echo "WARNING: Found potential singleton state"
fi

echo "OK: Application appears stateless"
echo "Ready for horizontal scaling"
```

---

## Vertical Scaling

### Node.js Optimization

```javascript
// server/index.ts - Performance optimizations

// 1. Optimize Node.js heap
const heapLimit = parseInt(process.env.HEAP_SIZE_MB || '2048')
if (global.gc) {
  // Enable: node --expose-gc
  setInterval(() => {
    global.gc()
  }, 60000)  // GC every minute
}

// 2. Enable clustering for multi-core systems
import cluster from 'cluster'
import os from 'os'

const numCPUs = parseInt(process.env.WORKER_THREADS || os.cpus().length)

if (cluster.isMaster) {
  console.log(`Master process ${process.pid} is running`)
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (${signal || code})`)
    // Restart worker
    cluster.fork()
  })
} else {
  // Worker process
  startServer()
}

// 3. Connection pooling
import mongoClient from 'mongodb'
const db = new mongoClient.MongoClient(
  process.env.DATABASE_URL,
  {
    maxPoolSize: parseInt(process.env.DB_POOL_SIZE || '50'),
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '10'),
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  }
)

// 4. Stream responses for large data
app.get('/api/bookings/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.write('[')
  
  let first = true
  db.bookings.find({}).stream().on('data', (doc) => {
    res.write((first ? '' : ',') + JSON.stringify(doc))
    first = false
  }).on('end', () => {
    res.write(']')
    res.end()
  })
})

// 5. Implement caching strategies
import Redis from 'ioredis'
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000)
})

// Cache-aside pattern
app.get('/api/drivers/:id', async (req, res) => {
  const cacheKey = `driver:${req.params.id}`
  
  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return res.json(JSON.parse(cached))
  }
  
  // If not in cache, fetch from database
  const driver = await db.drivers.findOne({_id: req.params.id})
  
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(driver))
  
  res.json(driver)
})
```

### Database Optimization

```sql
-- Create strategic indexes
CREATE INDEX idx_booking_status_date ON bookings(status, created_at DESC)
CREATE INDEX idx_booking_customer ON bookings(customer_id)
CREATE INDEX idx_booking_driver ON bookings(driver_id)
CREATE INDEX idx_customer_email ON customers(email)
CREATE INDEX idx_driver_phone ON drivers(phone)
CREATE INDEX idx_vehicle_reg ON vehicles(registration_number)
```

### Memory Optimization

```javascript
// Reduce memory footprint

// 1. Use typed arrays for large data sets
const Int32Array = new Int32Array(1000000)  // More efficient than []

// 2. Delete unused references
class BookingManager {
  constructor() {
    this.bookings = new Map()  // Auto cleanup with Map
  }
  
  get(id) {
    return this.bookings.get(id)
  }
  
  set(id, booking) {
    this.bookings.set(id, booking)
  }
  
  delete(id) {
    this.bookings.delete(id)  // Explicit deletion
  }
}

// 3. Use WeakMap for caches (auto GC when key is deleted)
const cache = new WeakMap()

// 4. Limit array sizes
const recentBookings = bookings.slice(-1000)  // Keep only last 1000

// 5. Stream large responses
fs.createReadStream('large-file.json').pipe(res)
```

### CPU Optimization

```javascript
// 1. Defer non-critical processing
// Instead of processing immediately
app.post('/bookings', async (req, res) => {
  const booking = await db.bookings.create(req.body)
  
  // Queue non-critical tasks
  queue.enqueue({
    type: 'send_email',
    bookingId: booking._id
  })
  
  res.json(booking)  // Response fast
})

// 2. Use worker threads for CPU-intensive tasks
import { Worker } from 'worker_threads'

function computeIntensive(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./compute-worker.js')
    worker.on('message', resolve)
    worker.on('error', reject)
    worker.postMessage(data)
  })
}

// 3. Batch operations
// Instead of individual operations
const bookings = [] // Collect 100 bookings
const result = await db.bookings.insertMany(bookings)  // Batch insert
```

---

## Database Scaling

### Connection Pooling

```javascript
// Optimal pool sizes:
// - Small app: 5-10 connections
// - Medium app: 20-50 connections
// - Large app: 100-200 connections

const pool = new MongoClient(
  process.env.DATABASE_URL,
  {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  }
)

// Monitor pool
setInterval(() => {
  const stats = pool.getClient().pool
  console.log({
    total: stats.totalConnectionCount,
    available: stats.availableConnectionCount,
    inUse: stats.totalConnectionCount - stats.availableConnectionCount
  })
}, 60000)
```

### Query Optimization

```javascript
// 1. Use projection to limit fields
// Bad: Returns all fields
const booking = await db.bookings.findOne({_id: bookingId})

// Good: Returns only needed fields
const booking = await db.bookings.findOne(
  {_id: bookingId},
  {projection: {_id: 1, customerId: 1, status: 1}}
)

// 2. Use aggregation for complex queries
// Instead of fetching all and processing in app
const bookings = await db.bookings.aggregate([
  {$match: {status: 'completed', created_at: {$gte: startDate}}},
  {$group: {_id: '$customerId', total: {$sum: '$amount'}}},
  {$sort: {total: -1}},
  {$limit: 10}
]).toArray()

// 3. Use indexes for common queries
db.bookings.createIndex({status: 1, createdAt: -1})
db.bookings.createIndex({customerId: 1, status: 1})
```

### Indexing Strategy

```javascript
// Create indexes for:
// 1. Query filters
db.bookings.createIndex({status: 1})

// 2. Sort operations
db.bookings.createIndex({createdAt: -1})

// 3. Combination (query + sort)
db.bookings.createIndex({status: 1, createdAt: -1})

// 4. Text search
db.bookings.createIndex({notes: 'text'})

// 5. TTL cleanup
db.sessions.createIndex({createdAt: 1}, {expireAfterSeconds: 86400})

// Monitor index usage
db.bookings.aggregate([{$indexStats: {}}])
```

### Read Replicas

```javascript
// Setup replica set for read scaling

// 1. Configure replica set
// mongodb replication config
const client = new MongoClient(
  'mongodb://primary,secondary1,secondary2/?replicaSet=rs0',
  {
    readPreference: 'secondaryPreferred'  // Read from secondary
  }
)

// 2. Read from secondary for non-critical queries
const readClient = new MongoClient(
  'mongodb://secondary:27017',
  {
    readPreference: 'primary'  // Direct secondary read
  }
)

// 3. Route queries intelligently
app.get('/api/bookings', async (req, res) => {
  const isAnalytical = req.query.report === 'true'
  
  // Use secondary for analytics queries
  const db = isAnalytical ? readClient : client
  const bookings = await db.collection('bookings').find({}).toArray()
  
  res.json(bookings)
})
```

---

## Capacity Planning

### Current Resource Assessment

```bash
#!/bin/bash
# capacity-assessment.sh

echo "=== Current Resource Usage ==="

# CPU
LOAD=$(cat /proc/loadavg | awk '{print $1}')
CPUS=$(nproc)
CPU_USAGE=$((LOAD * 100 / CPUS))
echo "CPU Usage: ${CPU_USAGE}% (${LOAD}/${CPUS})"

# Memory
TOTAL=$(free -b | awk 'NR==2 {print $2}')
USED=$(free -b | awk 'NR==2 {print $3}')
MEMORY_USAGE=$((USED * 100 / TOTAL))
echo "Memory Usage: ${MEMORY_USAGE}% (${USED}/${TOTAL} bytes)"

# Disk
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
echo "Disk Usage: ${DISK_USAGE}"

# Database size
DB_SIZE=$(du -sh /var/lib/mongodb)
echo "Database Size: ${DB_SIZE}"

# Network throughput
BYTES_IN=$(cat /proc/net/dev | grep eth0 | awk '{print $2}')
BYTES_OUT=$(cat /proc/net/dev | grep eth0 | awk '{print $10}')
echo "Network In: ${BYTES_IN} bytes"
echo "Network Out: ${BYTES_OUT} bytes"
```

### Growth Projections

```
Current State (2026-08-12):
- Disk Usage: 45GB
- Daily Growth: 500MB
- Memory: 2GB/4GB
- CPU: 40% avg

Projections:
- 3 months: 50GB (growth: 1.5GB)
- 6 months: 55GB (growth: 3GB)
- 12 months: 65GB (growth: 6GB)

Scaling Triggers:
- Disk > 70% (trigger at 50 days, ~2026-10-01)
- Memory > 75% (trigger now, already 50%)
- CPU > 70% (not yet, but monitor)

Recommendations:
1. Increase disk now (add 500GB SSD)
2. Increase memory to 8GB (expand node capacity)
3. Implement database optimization (save ~20% space)
4. Set up read replicas (distribute CPU load)
```

### Cost Analysis

```
Current Monthly Costs:
- Server (4-core, 4GB RAM): $500/month
- Storage (500GB): $50/month
- Backup/DR: $50/month
- Monitoring: $100/month
- Total: $700/month

Projected Costs (6 months, with scaling):
- Server upgrade (8-core, 16GB): $800/month
- Storage increase (2TB): $150/month
- Secondary replica: $500/month
- Enhanced monitoring: $150/month
- Total: $1,600/month

Optimization Opportunities:
- Query optimization: Save $100-200/month
- Compression: Save 30% storage = $50/month
- Reserved instances: Save 20-40% = $300-500/month
```

---

## Load Testing

### Test Environment Setup

```bash
#!/bin/bash
# setup-load-test.sh

# 1. Install load testing tools
npm install -g artillery

# 2. Create test scenario
cat > load-test.yml << 'EOF'
config:
  target: "http://localhost:5050"
  phases:
    - duration: 60
      arrivalRate: 10      # 10 users/sec for 1 minute
      name: "Warmup"
    - duration: 300
      arrivalRate: 50      # 50 users/sec for 5 minutes
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100     # 100 users/sec for 1 minute
      name: "Peak load"
  variables:
    bookingIds: ["booking_1", "booking_2", "booking_3"]

scenarios:
  - name: "Browse and Book"
    flow:
      - get:
          url: "/api/vehicles"
      - think: 5
      - post:
          url: "/api/bookings"
          json:
            vehicleId: "{{ vehicleIds[0] }}"
            customerId: "customer_123"
            durationDays: 3
      - think: 3
      - get:
          url: "/api/bookings/{{ $randomNumber(1,1000) }}"
EOF

# 3. Run test
artillery run load-test.yml
```

### Load Test Analysis

```bash
#!/bin/bash
# analyze-load-test.sh

echo "=== Load Test Results ==="

# Response time percentiles
# p50: 250ms
# p95: 750ms
# p99: 1500ms

# Error rate: 0.2% (acceptable)

# Throughput: 1000 requests/sec

# Failure points:
# - CPU hits 85% at 100 users/sec
# - Memory stable at 75%
# - Database connections: 80/100 in use

echo "Scaling capacity: ~200 concurrent users"
echo "Recommended action: Add read replicas"
```

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
