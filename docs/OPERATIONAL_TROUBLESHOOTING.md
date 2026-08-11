# FleetPro Comprehensive Troubleshooting Guide

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Server Issues](#server-issues)
2. [Database Issues](#database-issues)
3. [Notification Delivery Issues](#notification-delivery-issues)
4. [Integration Issues](#integration-issues)
5. [Security Issues](#security-issues)
6. [Debugging Tools & Techniques](#debugging-tools--techniques)

---

## Server Issues

### High CPU Usage

**Symptoms:**
- CPU > 80% sustained
- Slow response times
- Timeout errors
- Load average high

**Diagnosis:**

```bash
# 1. Check overall CPU
top -b -n 1 | head -3

# 2. Identify top processes
ps aux --sort=-%cpu | head -10

# 3. Check Node.js process details
ps aux | grep "node server/index.js"

# 4. Real-time CPU monitoring (10 seconds)
pidstat -p $(pgrep -f "node server/index.js") 1 10

# 5. Check system load
uptime
cat /proc/loadavg

# 6. Check for CPU spikes in logs
grep "CPU usage" logs/server.log | tail -20
```

**Root Causes:**

1. **Busy-loop or infinite loop**
   ```bash
   # Check for long-running async operations
   node --inspect=0.0.0.0:9229 server/index.js
   
   # In Chrome DevTools (chrome://inspect)
   # Look for:
   # - Functions with high call count
   # - Functions with high total time
   # - Blocking synchronous operations
   ```

2. **High query volume**
   ```bash
   # Check MongoDB operation count
   mongosh --eval "
     const status = db.serverStatus();
     console.log('Insert/sec:', status.opcounters.insert);
     console.log('Query/sec:', status.opcounters.query);
     console.log('Update/sec:', status.opcounters.update);
     console.log('Delete/sec:', status.opcounters.delete);
   "
   
   # Identify slow queries
   mongosh --eval "
     db.system.profile.find(
       {millis: {\$gt: 1000}}
     ).sort({ts: -1}).limit(10).pretty()
   "
   ```

3. **Regular expression in queries**
   ```bash
   # Find regex queries in logs
   grep -E "\\$regex|match" logs/server.log
   
   # Example problematic query
   db.bookings.find({notes: {$regex: "pattern"}})
   
   # Better: Use text index
   db.bookings.createIndex({notes: "text"})
   db.bookings.find({$text: {$search: "pattern"}})
   ```

4. **Unindexed queries**
   ```bash
   # Find full collection scans
   mongosh --eval "
     db.system.profile.find({
       execStats: {
         \$exists: true,
         totalDocsExamined: {
           \$gt: 10000
         }
       }
     }).count()
   "
   
   # Create indexes for common queries
   db.bookings.createIndex({status: 1, createdAt: -1})
   db.customers.createIndex({email: 1})
   db.drivers.createIndex({phone: 1})
   ```

**Solutions:**

**Short-term (Immediate):**
```bash
# 1. Identify which endpoint causes high CPU
curl -X POST http://localhost:5050/admin/diagnostics/cpu-profile \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Disable problematic endpoint temporarily
# Edit server/routes.ts
# Comment out or add rate limit

# 3. Increase Node.js worker threads (if available)
export UV_THREADPOOL_SIZE=256
npm run dev

# 4. Restart application
kill $(cat .pid)
PORT=5050 npm run dev > logs/server.log 2>&1 &
echo $! > .pid
```

**Medium-term (1-2 hours):**
```bash
# 1. Optimize slow queries
# Identify slow queries from diagnosis above

# Example: Booking search is slow
# Before
db.bookings.find({status: "confirmed"})

# After (with index)
db.bookings.createIndex({status: 1, createdAt: -1})

# 2. Implement caching
# Add Redis caching for frequently accessed data
redis-cli SET "bookings:status:confirmed" '...' EX 3600

# 3. Review code for inefficient patterns
# Check for:
# - N+1 queries
# - Unnecessary data transfers
# - Blocking operations in async context
```

**Long-term (24+ hours):**
```bash
# 1. Implement query result pagination
# Prevent large result sets

# 2. Set up query monitoring
db.setProfilingLevel(1, {slowms: 100})

# 3. Upgrade hardware
# If consistently high CPU on modern hardware
# Consider vertical or horizontal scaling
```

---

### High Memory Usage

**Symptoms:**
- Memory > 85% sustained
- Growing memory usage over time
- Garbage collection pauses
- OOM killer events

**Diagnosis:**

```bash
# 1. Check memory usage
free -h
ps aux | grep "node" | grep -v grep | awk '{print $6 " MB"}'

# 2. Check memory growth trend
watch -n 60 'ps aux | grep "node server/index.js" | grep -v grep'

# 3. Get heap dump
kill -USR2 $(cat .pid)
ls -lah heapdump*.heapsnapshot

# 4. Check for memory leaks
# Send heap dump to Chrome DevTools for analysis

# 5. Monitor garbage collection
node --expose-gc server/index.js
# Then send SIGUSR1 to trigger GC

# 6. Check for unclosed resources
grep -i "\.close()\|destroy()" logs/server.log | wc -l
grep -i "connection.*not.*closed\|leaked" logs/server.log
```

**Root Causes:**

1. **Memory Leaks**
   ```bash
   # Common patterns causing leaks:
   
   # Pattern 1: Unbounded array
   const cache = []
   app.get('/data', (req, res) => {
     cache.push(largeObject)  // LEAK: array grows forever
   })
   
   # Pattern 2: Event listeners not removed
   emitter.on('event', listener)  // Memory leak if not removed
   
   # Pattern 3: Circular references
   const obj1 = {}
   const obj2 = {ref: obj1}
   obj1.ref = obj2  // LEAK: can prevent GC
   
   # Solution: Use WeakMap for cache
   const cache = new WeakMap()
   app.get('/data', (req, res) => {
     cache.set(key, largeObject)
   })
   ```

2. **Connection Pool Leaks**
   ```bash
   # Check connection count
   mongosh --eval "
     db.serverStatus().connections
   "
   
   # Check for idle connections
   mongosh --eval "
     db.currentOp(true).inprog.filter(op => 
       op.secs_running > 300 && !op.op.startsWith('getMore')
     ).length
   "
   
   # Solution: Close connections properly
   client.close()
   connection.end()
   ```

3. **Large Object Retention**
   ```bash
   # Check for large objects in memory
   node --max-old-space-size=4096 server/index.js
   
   # Monitor object sizes
   const heapdump = require('heapdump')
   setInterval(() => {
     heapdump.writeSnapshot()
   }, 60000)
   ```

**Solutions:**

**Short-term (Immediate):**
```bash
# 1. Force garbage collection
kill -USR1 $(cat .pid)

# 2. Clear cache if implemented
redis-cli FLUSHDB

# 3. Restart application (if memory doesn't recover)
kill $(cat .pid)
sleep 10
PORT=5050 npm run dev > logs/server.log 2>&1 &
echo $! > .pid
```

**Medium-term (1-2 hours):**
```bash
# 1. Enable memory profiling
npm install --save-dev clinic

# Run clinic profiler
clinic doctor -- node server/index.js

# 2. Review heap dumps
# Open .heapsnapshot in Chrome DevTools

# 3. Identify and fix memory leaks
# Common fixes:
# - Remove event listeners: emitter.removeListener('event', fn)
# - Close connections: conn.close()
# - Limit array sizes: cache.slice(0, 1000)
```

**Long-term (24+ hours):**
```bash
# 1. Implement memory monitoring
const heapdump = require('heapdump')
setInterval(() => {
  const used = process.memoryUsage()
  logger.info('Memory usage', {
    rss: Math.round(used.rss / 1024 / 1024) + ' MB',
    heap: Math.round(used.heapUsed / 1024 / 1024) + ' MB'
  })
  
  if (used.heapUsed > 2000 * 1024 * 1024) {  // 2GB
    heapdump.writeSnapshot()
  }
}, 60000)

# 2. Set up alerts
# Alert when memory usage > 75%
# Alert when heap grows by >10% in 5 minutes
```

---

### Slow Response Times

**Symptoms:**
- Response time > 1 second
- p99 latency degradation
- Timeout errors increasing
- User complaints about slowness

**Diagnosis:**

```bash
# 1. Check response time metrics
curl -s http://localhost:5050/metrics | grep "http_request_duration_seconds"

# 2. Identify slow endpoints
curl -s http://localhost:5050/metrics | grep "http_request_duration_seconds_bucket" | sort -t= -k2

# 3. Check application logs for slow requests
grep "duration:" logs/server.log | grep -E ">1000ms" | head -20

# 4. Check database query times
mongosh --eval "
  db.system.profile.find({
    millis: {\$gt: 100}
  }).sort({millis: -1}).limit(10).pretty()
"

# 5. Check for blocking operations
grep -i "synchronous\|blocking" logs/server.log

# 6. Monitor real-time response times
watch -n 1 'curl -s http://localhost:5050/metrics | grep http_request_duration_seconds | head -5'
```

**Root Causes:**

1. **Slow Database Queries**
   ```javascript
   // Problem: No index
   db.bookings.find({status: "confirmed", createdAt: {$gt: date}})
   
   // Solution: Add index
   db.bookings.createIndex({
     status: 1, 
     createdAt: -1
   })
   
   // Verify with explain
   db.bookings.find({status: "confirmed"}).explain("executionStats")
   ```

2. **N+1 Query Problem**
   ```javascript
   // Problem
   const bookings = db.bookings.find({status: "active"})
   bookings.forEach(booking => {
     const customer = db.customers.findOne({_id: booking.customerId})  // N+1 queries!
   })
   
   // Solution: Use aggregation or batch fetch
   const bookings = db.bookings.find({status: "active"}).toArray()
   const customerIds = bookings.map(b => b.customerId)
   const customers = db.customers.find({_id: {$in: customerIds}}).toArray()
   ```

3. **Missing Pagination**
   ```javascript
   // Problem: Retrieving 1M documents
   const allBookings = db.bookings.find({}).toArray()
   
   // Solution: Implement pagination
   const page = 1
   const pageSize = 20
   const bookings = db.bookings
     .find({})
     .skip((page - 1) * pageSize)
     .limit(pageSize)
     .toArray()
   ```

4. **Upstream Service Latency**
   ```bash
   # Check external API response times
   curl -w "@curl-format.txt" -o /dev/null -s https://external-api.example.com/endpoint
   
   # If external API is slow:
   # 1. Implement timeout
   const timeout = 5000  // 5 seconds
   
   # 2. Implement caching
   const cached = redis.get('external-data')
   if (cached) return cached
   
   # 3. Implement fallback
   if (externalAPITimesOut) return cachedValue
   ```

**Solutions:**

**Short-term (Immediate):**
```bash
# 1. Clear cache
redis-cli FLUSHDB

# 2. Enable query result caching
CACHE_ENABLED=true npm run dev

# 3. Increase database connection pool
DB_POOL_SIZE=50 npm run dev

# 4. Add timeout to slow endpoints
# In server/routes.ts
app.get('/slow-endpoint', timeout('5s'), (req, res) => {
  // Will timeout after 5 seconds
})
```

**Medium-term (1-2 hours):**
```bash
# 1. Create missing indexes
db.bookings.createIndex({status: 1, createdAt: -1})
db.customers.createIndex({email: 1})
db.drivers.createIndex({phone: 1})

# 2. Analyze query execution
db.bookings.find({status: "confirmed"}).explain("executionStats")

# 3. Implement result pagination
# Update API endpoints to return page size

# 4. Add response caching headers
res.set('Cache-Control', 'public, max-age=300')
```

**Long-term (24+ hours):**
```bash
# 1. Set up query monitoring
db.setProfilingLevel(1, {slowms: 100})

# 2. Implement read replicas
# For read-heavy queries, use replica set

# 3. Upgrade hardware
# Add more CPU/RAM if consistently slow

# 4. Implement CDN
# For static content, use CloudFront/Cloudflare
```

---

### Connection Timeouts

**Symptoms:**
- "Connection timeout" errors
- Intermittent connection failures
- Specific endpoints timing out
- Happens during high load

**Diagnosis:**

```bash
# 1. Check network connectivity
ping -c 5 database.example.com
nc -zv database.example.com 27017

# 2. Check firewall rules
sudo ufw status
sudo ufw show added | grep -E ":5050|:27017"

# 3. Check connection counts
netstat -an | grep ESTABLISHED | wc -l
netstat -an | grep TIME_WAIT | wc -l

# 4. Check for stuck connections
netstat -an | grep CLOSE_WAIT

# 5. Monitor connection pool
mongosh --eval "
  db.serverStatus().connections
"

# 6. Check timeout settings in logs
grep -i "timeout\|econnrefused" logs/server.log
```

**Root Causes:**

1. **Connection Pool Exhaustion**
   ```bash
   # Check pool settings
   echo $DB_POOL_SIZE
   echo $DB_POOL_MAX_WAITERS
   
   # Increase pool size
   DB_POOL_SIZE=50  # was 20
   DB_POOL_MAX_WAITERS=500
   ```

2. **Firewall Blocking**
   ```bash
   # Verify port is open
   sudo ufw status numbered
   
   # Add rule if missing
   sudo ufw allow 27017/tcp comment "MongoDB"
   sudo ufw allow 5050/tcp comment "FleetPro App"
   
   # Test connectivity
   nc -zv localhost 27017
   ```

3. **DNS Resolution Issues**
   ```bash
   # Test DNS resolution
   nslookup database.example.com
   host database.example.com
   
   # If DNS is slow, use IP directly
   DATABASE_URL="mongodb://192.168.1.100:27017/fleetpro"
   ```

4. **Network Saturation**
   ```bash
   # Check bandwidth usage
   iftop -n
   nethogs
   
   # Monitor packet loss
   ping -c 100 database.example.com | grep "% packet loss"
   ```

**Solutions:**

**Short-term (Immediate):**
```bash
# 1. Increase timeout
CONNECTION_TIMEOUT=30000  # 30 seconds
QUERY_TIMEOUT=60000
npm run dev

# 2. Verify connectivity
nc -zv localhost 27017

# 3. Restart network service
sudo systemctl restart networking

# 4. Clear DNS cache
sudo systemd-resolve --flush-caches
```

**Medium-term (1-2 hours):**
```bash
# 1. Optimize connection pool
# In .env.production
DB_POOL_SIZE=50
DB_POOL_IDLE_TIMEOUT=30000
DB_MAX_WAITERS=500

# 2. Implement connection pooling
// Use native connection pooling instead of creating new connections

# 3. Add retry logic
function connectWithRetry(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return connect()
    } catch (e) {
      if (i === maxRetries - 1) throw e
      sleep(Math.pow(2, i) * 1000)  // exponential backoff
    }
  }
}
```

**Long-term (24+ hours):**
```bash
# 1. Set up connection monitoring
setInterval(() => {
  db.serverStatus((err, status) => {
    console.log('Active connections:', status.connections.current)
  })
}, 60000)

# 2. Implement circuit breaker
// If connection fails N times, fail fast instead of waiting

# 3. Scale database
// Add read replicas for connection distribution
```

---

### Process Crashes

**Symptoms:**
- Application unexpectedly stops
- No response to health checks
- Process ID changes
- Zombie processes

**Diagnosis:**

```bash
# 1. Check if process is running
ps aux | grep "node server/index.js"
ps -elf | grep $(cat .pid)

# 2. Check exit code
echo $?

# 3. Check system logs
dmesg | tail -50
journalctl -u fleetpro -n 50

# 4. Check application logs
tail -100 logs/server.log | grep -E "ERROR|FATAL|exit|crash"

# 5. Check for core dumps
ls -lah core.*
file core.*

# 6. Check system resources at crash time
grep "Out of memory" /var/log/messages
grep "OOM-killer" dmesg
```

**Root Causes:**

1. **Out of Memory (OOM)**
   ```bash
   # Check if OOM killer was triggered
   grep -i "kill\|oom" dmesg
   
   # Check memory at time of crash
   free -h
   
   # Solution: Reduce memory usage or increase heap
   node --max-old-space-size=4096 server/index.js
   ```

2. **Unhandled Exception**
   ```javascript
   // Problem: Unhandled rejection
   Promise.reject(new Error("Something bad"))
     // No .catch() handler
   
   // Solution: Add error handlers
   process.on('unhandledRejection', (reason, promise) => {
     logger.error('Unhandled rejection:', reason)
     process.exit(1)
   })
   
   process.on('uncaughtException', (error) => {
     logger.error('Uncaught exception:', error)
     process.exit(1)
   })
   ```

3. **Signal Received**
   ```bash
   # Check what signal killed process
   grep "Received signal" logs/server.log
   
   # Common signals:
   # SIGTERM (15): Graceful shutdown
   # SIGKILL (9): Forced termination
   # SIGSEGV (11): Segmentation fault
   ```

4. **Resource Limits Exceeded**
   ```bash
   # Check file descriptor limits
   ulimit -n
   
   # Increase if needed
   ulimit -n 65536
   
   # Check memory limits
   ulimit -v
   ```

**Solutions:**

**Short-term (Immediate):**
```bash
# 1. Restart process
kill -9 $(cat .pid) 2>/dev/null || true
sleep 5
PORT=5050 npm run dev > logs/server.log 2>&1 &
echo $! > .pid

# 2. Verify restart
sleep 10
curl -s http://localhost:5050/health | jq .status
```

**Medium-term (1-2 hours):**
```bash
# 1. Review crash logs
tail -200 logs/server.log > /tmp/crash-analysis.txt

# 2. Check for memory issues
free -h
df -h

# 3. Analyze error patterns
grep "ERROR\|WARN" logs/server.log | tail -50

# 4. Enable crash dumps
ulimit -c unlimited
echo "core.%p" | sudo tee /proc/sys/kernel/core_pattern
```

**Long-term (24+ hours):**
```bash
# 1. Implement automatic restart
# Using systemd
sudo systemctl edit fleetpro-app
# Add:
# [Service]
# Restart=always
# RestartSec=5

# 2. Implement health monitoring
setInterval(() => {
  const health = getHealth()
  if (!health.ok) {
    logger.error('Health check failed, exiting')
    process.exit(1)  // Will trigger restart
  }
}, 30000)

# 3. Upgrade Node.js version
node --version
npm install -g n
n latest
```

---

## Database Issues

### Connection Failures

**Symptoms:**
- "Connection refused" errors
- Database not responding
- Timeout errors
- Health check failing

**Diagnosis:**

```bash
# 1. Check MongoDB service
sudo systemctl status mongod
sudo systemctl is-active mongod

# 2. Check port
netstat -tulpn | grep 27017

# 3. Test connectivity
mongosh --eval "db.adminCommand('ping')"

# 4. Check firewall
sudo ufw status | grep 27017

# 5. Check logs
sudo tail -f /var/log/mongodb/mongod.log

# 6. Check resource usage
free -h
df -h /var/lib/mongodb
```

**Solutions:**

```bash
# 1. Start MongoDB if not running
sudo systemctl start mongod

# 2. Enable auto-start
sudo systemctl enable mongod

# 3. Check MongoDB config
sudo cat /etc/mongod.conf | grep -E "port|bind_ip"

# 4. Verify replication (if applicable)
mongosh --eval "rs.status()"

# 5. Restart if corrupted
sudo systemctl stop mongod
sudo mongod --repair
sudo systemctl start mongod
```

---

### Slow Queries

**Symptoms:**
- Response time > 100ms for simple queries
- High CPU usage from MongoDB
- Application timeout
- Lock contention errors

**Diagnosis:**

```bash
# 1. Enable profiling
mongosh --eval "
  db.setProfilingLevel(1, {slowms: 100})
"

# 2. View slow queries
mongosh --eval "
  db.system.profile.find({millis: {\$gt: 100}})
    .sort({ts: -1})
    .limit(20)
    .pretty()
"

# 3. Analyze query plan
mongosh --eval "
  db.bookings.find({status: 'confirmed'})
    .explain('executionStats')
"

# 4. Check index usage
mongosh --eval "
  db.bookings.aggregate([
    {
      \$indexStats: {}
    }
  ]).pretty()
"
```

**Solutions:**

```bash
# 1. Create indexes
mongosh --eval "
  db.bookings.createIndex({status: 1, createdAt: -1})
  db.customers.createIndex({email: 1})
  db.drivers.createIndex({phone: 1})
"

# 2. Remove unused indexes
mongosh --eval "
  db.bookings.dropIndex('oldIndex_1')
"

# 3. Optimize query
// Bad
db.bookings.find({notes: {$regex: /pattern/}})

// Good
db.bookings.find({
  $text: {$search: "pattern"}
})

# 4. Add aggregation pipeline for complex queries
mongosh --eval "
  db.bookings.aggregate([
    {\$match: {status: 'confirmed'}},
    {\$group: {_id: '\$customerId', count: {\$sum: 1}}},
    {\$sort: {count: -1}},
    {\$limit: 10}
  ]).pretty()
"
```

---

### Disk Space Issues

**Symptoms:**
- Database won't accept writes
- "No space left on device" errors
- Replication lag
- Performance degradation

**Diagnosis:**

```bash
# 1. Check disk space
df -h /var/lib/mongodb

# 2. Check database size
mongosh --eval "
  const stats = db.stats();
  console.log('Data size:', (stats.dataSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('Storage size:', (stats.storageSize / 1024 / 1024).toFixed(2), 'MB');
"

# 3. Find large collections
mongosh --eval "
  db.getCollectionNames().forEach(name => {
    const size = db[name].stats().size;
    console.log(name, ':', (size / 1024 / 1024).toFixed(2), 'MB');
  });
" | sort -t: -k2 -rn

# 4. Check backup sizes
du -sh /backups/*
```

**Solutions:**

**Short-term:**
```bash
# 1. Archive old data
mongosh --eval "
  db.notifications.deleteMany({
    created_at: {\$lt: new Date(Date.now() - 90*24*60*60*1000)}
  })
"

# 2. Compact collections
mongosh --eval "
  db.runCommand({compact: 'notifications'})
"

# 3. Defragment
mongosh --eval "
  db.repairDatabase()
"
```

**Long-term:**
```bash
# 1. Expand storage
# Add new disk or increase partition

# 2. Implement TTL indexes
mongosh --eval "
  db.notifications.createIndex({createdAt: 1}, {expireAfterSeconds: 2592000})
"

# 3. Archive to cold storage
# Move old data to S3, GCS, etc
```

---

## Notification Delivery Issues

### Email Delivery Failures

**Symptoms:**
- Emails not received
- SendGrid API errors
- Bounced emails
- Complaint notifications

**Diagnosis:**

```bash
# 1. Check SendGrid API
curl -s "https://api.sendgrid.com/v3/stats" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" | jq .

# 2. Check SendGrid logs
# Log in to https://app.sendgrid.com/email_activity

# 3. Check application logs
grep -i "sendgrid\|email" logs/server.log | tail -50

# 4. Check mail queue
curl -s http://localhost:5050/api/admin/notifications/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.mail_queue'

# 5. Test email sending
curl -X POST http://localhost:5050/api/admin/notifications/test/email \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

**Root Causes:**

1. **Invalid API Key**
   ```bash
   # Verify API key
   curl -s "https://api.sendgrid.com/v3/user/profile" \
     -H "Authorization: Bearer $SENDGRID_API_KEY"
   
   # If 401, regenerate key
   # https://app.sendgrid.com/settings/api_keys
   ```

2. **Bounce/Complaint**
   ```bash
   # Check bounce list
   curl -s "https://api.sendgrid.com/v3/suppression/bounces" \
     -H "Authorization: Bearer $SENDGRID_API_KEY" | jq .
   
   # Remove from bounce list
   curl -X DELETE \
     "https://api.sendgrid.com/v3/suppression/bounces/email@example.com" \
     -H "Authorization: Bearer $SENDGRID_API_KEY"
   ```

3. **Rate Limit**
   ```bash
   # Check rate limit
   curl -s https://api.sendgrid.com/v3/mail/send \
     -w "Rate Limit: %{http_code}\n" \
     -X POST
   
   # Implement backoff
   if (status === 429) {
     await sleep(Math.pow(2, retryCount) * 1000)
   }
   ```

4. **Invalid Email Address**
   ```bash
   # Validate email
   const validator = require('email-validator')
   if (!validator.validate(email)) {
     return {error: "Invalid email"}
   }
   ```

**Solutions:**

```bash
# 1. Check credentials
echo "SENDGRID_API_KEY=$SENDGRID_API_KEY"

# 2. Retry failed emails
curl -X POST http://localhost:5050/api/admin/notifications/retry \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "email", "status": "failed", "limit": 100}'

# 3. Check bounce/complaint list
# Remove legitimate emails from suppression list

# 4. Verify sender email
# Must be verified with SendGrid
# https://app.sendgrid.com/settings/sender_auth/senders

# 5. Test email template
curl -X POST http://localhost:5050/api/admin/email/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "booking-confirmation", "email": "test@example.com"}'
```

---

### SMS Delivery Failures

**Symptoms:**
- SMS not received
- Twilio API errors
- Failed delivery status
- High failure rate

**Diagnosis:**

```bash
# 1. Check Twilio account
curl -s https://api.twilio.com/2010-04-01/Accounts.json \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

# 2. Check Twilio logs
# Log in to https://console.twilio.com/us/monitor/logs

# 3. Check application logs
grep -i "twilio\|sms" logs/server.log | tail -50

# 4. Test SMS sending
curl -X POST http://localhost:5050/api/admin/notifications/test/sms \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890"}'

# 5. Check account balance
curl -s https://api.twilio.com/2010-04-01/Accounts/AC.../Balance.json \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

**Root Causes:**

1. **Low Account Balance**
   ```bash
   # Check balance
   BALANCE=$(curl -s \
     "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq '.balance')
   
   # If < $0.01, add credit
   # https://www.twilio.com/account/billing
   ```

2. **Invalid Phone Number**
   ```javascript
   // Validate phone number
   const parsePhoneNumberFromString = require('libphonenumber-js').parsePhoneNumberFromString
   const number = parsePhoneNumberFromString("+1234567890")
   if (!number || !number.isValid()) {
     return {error: "Invalid phone number"}
   }
   ```

3. **Carrier Filtering**
   ```bash
   # Some carriers filter SMS
   # Solution: Use toll-free number or shortcode
   # Or implement WhatsApp integration as fallback
   ```

**Solutions:**

```bash
# 1. Verify credentials
echo "TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID"
echo "TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN"

# 2. Check account status
curl -s https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID.json \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq '.status'

# 3. Whitelist sender (if applicable)
# Some SMS have compliance restrictions

# 4. Retry failed SMS
curl -X POST http://localhost:5050/api/admin/notifications/retry \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "sms", "status": "failed", "limit": 100}'
```

---

### Push Notification Failures

**Symptoms:**
- Push notifications not delivered
- Devices not receiving alerts
- High failure rate for FCM/APNs
- Tokens expiring

**Diagnosis:**

```bash
# 1. Check push notification queue
curl -s http://localhost:5050/api/admin/notifications/queue \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.push_queue'

# 2. Check device token status
mongosh --eval "
  db.devices.find({push_token: {\$exists: true}}).count()
  db.devices.find({push_token_valid: false}).count()
"

# 3. Check application logs
grep -i "fcm\|apns\|push" logs/server.log | tail -50

# 4. Test push notification
curl -X POST http://localhost:5050/api/admin/notifications/test/push \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device-123"}'
```

**Solutions:**

```bash
# 1. Refresh expired device tokens
mongosh --eval "
  db.devices.updateMany(
    {push_token_expires: {\$lt: new Date()}},
    {\$set: {push_token_valid: false}}
  )
"

# 2. Remove invalid devices
mongosh --eval "
  db.devices.deleteMany({push_token_valid: false})
"

# 3. Check FCM/APNs credentials
# FCM: https://console.firebase.google.com
# APNs: https://developer.apple.com/account

# 4. Implement token refresh
// Refresh tokens periodically
setInterval(async () => {
  const devices = await db.devices.find({token_refresh_required: true})
  for (const device of devices) {
    const newToken = await refreshToken(device.push_token)
    await db.devices.updateOne({_id: device._id}, {push_token: newToken})
  }
}, 86400000)  // Daily
```

---

## Integration Issues

### SendGrid Integration Failures

**Diagnosis & Resolution:**

```bash
# 1. Test API connection
curl -s https://api.sendgrid.com/v3/user/profile \
  -H "Authorization: Bearer $SENDGRID_API_KEY" | jq .

# 2. Check API rate limits
# SendGrid rate limits: 600 requests/minute

# 3. Verify sender
curl -s "https://api.sendgrid.com/v3/verified_senders" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"

# 4. Implementation
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

await sgMail.send({
  to: email,
  from: 'noreply@fleetpro.example.com',
  subject: 'Subject',
  html: '<p>Body</p>',
  trackingSettings: {
    clickTracking: {enable: true},
    openTracking: {enable: true}
  }
})
```

---

### Twilio Integration Failures

**Diagnosis & Resolution:**

```bash
# 1. Test API connection
curl -s https://api.twilio.com/2010-04-01/Accounts.json \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" | jq .

# 2. Check balance
curl -s "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"

# 3. Implementation
const twilio = require('twilio')
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

await client.messages.create({
  body: 'Your message',
  from: '+1234567890',  // Twilio number
  to: '+9876543210'     // Customer number
})
```

---

## Security Issues

### SSL Certificate Expiration

**Diagnosis:**

```bash
# 1. Check certificate expiration
openssl s_client -connect api.fleetpro.example.com:443 \
  -servername api.fleetpro.example.com 2>/dev/null | \
  openssl x509 -noout -dates

# 2. Check days until expiration
EXPIRY=$(openssl s_client -connect api.fleetpro.example.com:443 \
  2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
DAYS=$((($( date -d "$EXPIRY" +%s) - $(date +%s)) / 86400))
echo "Days until expiration: $DAYS"
```

**Solutions:**

```bash
# 1. Renew with Let's Encrypt
sudo certbot renew --quiet

# 2. Update certificate in application
# Copy new cert from /etc/letsencrypt/live/domain/

# 3. Restart application
kill $(cat .pid)
PORT=5050 npm run dev > logs/server.log 2>&1 &
echo $! > .pid

# 4. Verify certificate
curl -kv https://localhost:5050/health 2>&1 | grep "expire"
```

---

### Unauthorized Access Attempts

**Diagnosis:**

```bash
# 1. Check for failed login attempts
grep -i "unauthorized\|401\|403" logs/server.log | tail -20

# 2. Check for brute force attempts
grep "POST.*login" logs/server.log | cut -d' ' -f1 | sort | uniq -c | sort -rn

# 3. Check for SQL injection attempts
grep -E "union.*select|'; drop|or '1'='1" logs/server.log

# 4. Check security logs
mongosh --eval "
  db.security_events.find({
    event: 'unauthorized_access',
    timestamp: {\$gt: new Date(Date.now() - 24*60*60*1000)}
  }).pretty()
"
```

**Solutions:**

```bash
# 1. Implement rate limiting
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100  // limit each IP to 100 requests per windowMs
})
app.post('/login', limiter, (req, res) => {})

# 2. Lock account after failed attempts
// After 5 failed login attempts
// Lock account for 30 minutes

# 3. Implement 2FA
// Require second factor for sensitive operations

# 4. Block malicious IPs
// Add to firewall rules
sudo ufw insert 1 deny from 192.168.1.100
```

---

## Debugging Tools & Techniques

### Node.js Inspector

```bash
# 1. Start with inspector enabled
node --inspect=0.0.0.0:9229 server/index.js

# 2. Open DevTools
chrome://inspect

# 3. Tools available:
# - CPU profiler: Identify hot functions
# - Memory profiler: Find memory leaks
# - Console: Run JavaScript in app context
# - Debugger: Set breakpoints, step through code
```

### MongoDB Profiling

```bash
# 1. Enable profiling
mongosh --eval "db.setProfilingLevel(2)"  # 2 = profile all

# 2. View profile data
mongosh --eval "
  db.system.profile.find().pretty()
"

# 3. Analyze by query
mongosh --eval "
  db.system.profile.aggregate([
    {
      \$group: {
        _id: '\$command.find',
        count: {\$sum: 1},
        avgMillis: {\$avg: '\$millis'},
        maxMillis: {\$max: '\$millis'}
      }
    },
    {\$sort: {avgMillis: -1}}
  ]).pretty()
"

# 4. Disable profiling
mongosh --eval "db.setProfilingLevel(0)"
```

### Performance Profiling

```bash
# 1. CPU profiling with clinic.js
npm install -D clinic
clinic doctor -- node server/index.js

# 2. Memory profiling
npm install -D heapdump
const heapdump = require('heapdump')
heapdump.writeSnapshot(`./heap-${Date.now()}.heapsnapshot`)

# 3. Analyze heap dump in Chrome DevTools
# chrome://devtools → Memory tab → Load heap snapshot
```

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
