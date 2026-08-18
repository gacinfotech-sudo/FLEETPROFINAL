# FleetPro Operational Runbook

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready  
**Environment:** All (Development, Staging, Production)

---

## Table of Contents

1. [Day-1 Operations](#day-1-operations)
2. [Incident Response](#incident-response)
3. [Daily Operations](#daily-operations)
4. [Weekly Tasks](#weekly-tasks)
5. [Monthly Tasks](#monthly-tasks)
6. [Emergency Procedures](#emergency-procedures)
7. [Quick Reference](#quick-reference)

---

## Day-1 Operations

### First-Time Server Startup

#### Pre-Startup Verification (30 minutes)

1. **System Resources Check**
   ```bash
   # Verify available disk space (minimum 50GB required)
   df -h | grep -E "^/dev/(sda|mapper|disk)"
   
   # Verify available memory (minimum 8GB required)
   free -h
   
   # Verify CPU cores (minimum 4 cores recommended)
   nproc
   ```

2. **Dependency Verification**
   ```bash
   # Node.js version (must be v18.0.0 or higher)
   node --version
   
   # npm version (must be v9.0.0 or higher)
   npm --version
   
   # MongoDB version (must be v4.4 or higher)
   mongod --version
   ```

3. **Network Configuration**
   ```bash
   # Verify port availability (5050 is default)
   netstat -tulpn | grep -E ":5050|:27017|:6379"
   
   # Verify internet connectivity
   ping -c 3 8.8.8.8
   
   # Verify DNS resolution
   nslookup fleetpro.example.com
   ```

#### Environment Setup (15 minutes)

1. **Create Environment Configuration**
   ```bash
   # Copy template and configure
   cp .env.example .env.production
   
   # Required environment variables
   cat > .env.production << 'EOF'
   NODE_ENV=production
   PORT=5050
   DATABASE_URL=mongodb://127.0.0.1:27017/fleetpro_production
   REDIS_URL=redis://127.0.0.1:6379/0
   JWT_SECRET=$(openssl rand -base64 32)
   SESSION_SECRET=$(openssl rand -base64 32)
   SENDGRID_API_KEY=your_sendgrid_key_here
   TWILIO_ACCOUNT_SID=your_twilio_sid_here
   TWILIO_AUTH_TOKEN=your_twilio_token_here
   ADMIN_EMAIL=admin@fleetpro.example.com
   SUPPORT_EMAIL=support@fleetpro.example.com
   ENVIRONMENT=production
   LOG_LEVEL=info
   ENABLE_MONITORING=true
   ENABLE_AUDIT_LOGGING=true
   EOF
   ```

2. **Verify Secrets Management**
   ```bash
   # Ensure secrets are secure
   chmod 600 .env.production
   
   # Test secret access
   source .env.production
   echo "JWT_SECRET length: ${#JWT_SECRET}"
   echo "Database accessible: $(mongosh --eval 'db.adminCommand("ping")')"
   ```

#### Database Initialization (20 minutes)

1. **Start MongoDB Service**
   ```bash
   # Verify MongoDB is running
   sudo systemctl status mongod
   
   # If not running, start it
   sudo systemctl start mongod
   
   # Enable auto-start
   sudo systemctl enable mongod
   ```

2. **Initialize Database Collections**
   ```bash
   # Run initialization script
   npm run db:init
   
   # Verify collections created
   mongosh --eval "show collections"
   
   # Check document counts
   mongosh --eval "
     console.log('Customers:', db.customers.countDocuments());
     console.log('Bookings:', db.bookings.countDocuments());
     console.log('Drivers:', db.drivers.countDocuments());
     console.log('Vehicles:', db.vehicles.countDocuments());
   "
   ```

3. **Create Database Indexes**
   ```bash
   # Run index creation
   npm run db:indexes
   
   # Verify indexes created
   mongosh --eval "
     db.bookings.getIndexes().forEach(idx => {
       console.log('Booking index:', idx.name, '- Keys:', idx.key);
     });
   "
   ```

#### Application Startup (15 minutes)

1. **Build Application**
   ```bash
   # Clean build
   npm run clean
   npm run build
   
   # Verify build completed
   ls -la dist/
   ```

2. **Start Server**
   ```bash
   # Start in background with logging
   PORT=5050 npm run dev > logs/server.log 2>&1 &
   
   # Note the process ID
   echo $! > .pid
   
   # Verify server started
   sleep 5
   curl -s http://localhost:5050/health | jq .
   ```

3. **Verify Service Health**
   ```bash
   # Check all health endpoints
   curl -s http://localhost:5050/health | jq .
   curl -s http://localhost:5050/health/detailed | jq .
   curl -s http://localhost:5050/metrics | head -20
   ```

### Monitoring Setup Verification (10 minutes)

1. **Prometheus Configuration**
   ```bash
   # Verify Prometheus config
   promtool check config prometheus.yml
   
   # Verify metrics endpoint
   curl -s http://localhost:5050/metrics | grep -E "^# TYPE"
   ```

2. **Grafana Dashboard Setup**
   ```bash
   # Access Grafana
   open http://localhost:3000
   
   # Verify data source connected
   curl -s http://localhost:3000/api/datasources | jq .
   ```

3. **Alert Rules**
   ```bash
   # Verify alert rules loaded
   curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | .alert'
   ```

### Team Notification and Handoff (5 minutes)

1. **Create Server Startup Report**
   ```bash
   cat > /tmp/startup-report.txt << 'EOF'
   FleetPro Server Startup Report
   ==============================
   Date: $(date)
   Server: $(hostname)
   Port: 5050
   Environment: production
   
   Verification Checklist:
   [ ] System resources verified (disk, memory, CPU)
   [ ] Dependencies verified (Node.js, npm, MongoDB)
   [ ] Network configured (ports open, connectivity)
   [ ] Environment setup (secrets, configuration)
   [ ] Database initialized (collections, indexes)
   [ ] Application built (0 errors)
   [ ] Server started (health checks pass)
   [ ] Monitoring configured (Prometheus, Grafana, Alerts)
   [ ] On-call team notified
   [ ] Runbook reviewed
   [ ] SLA confirmed
   
   Server Status: OPERATIONAL
   All Systems: GREEN
   Ready for Production: YES
   EOF
   ```

2. **Notify On-Call Team**
   ```bash
   # Send notification
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
     -d '{
       "text": "FleetPro Server Startup Complete",
       "blocks": [
         {"type": "section", "text": {"type": "mrkdwn", "text": "Server: production\nPort: 5050\nStatus: OPERATIONAL"}},
         {"type": "actions", "elements": [{"type": "button", "text": {"type": "plain_text", "text": "View Dashboard"}, "url": "https://grafana.fleetpro.example.com"}]}
       ]
     }'
   ```

### SLA Confirmation

1. **Service Level Agreement Verification**
   ```
   - Uptime Target: 99.9% (monthly)
   - Response Time SLA: p99 < 2 seconds
   - Error Rate SLA: < 0.1%
   - Incident Response Time: < 15 minutes (P1)
   - Data Backup: Daily, with 30-day retention
   - Disaster Recovery: RTO < 4 hours, RPO < 1 hour
   ```

2. **Customer Communication**
   - Notify customers of service launch
   - Share uptime SLA details
   - Provide support contact information
   - Confirm monitoring is active

---

## Incident Response

### On-Call Rotation

#### Escalation Procedure

**Level 1 - Team Lead (On-Call)**
- Response time: < 15 minutes
- Handles: Performance issues, minor bugs, log analysis
- Contact: On-call person's phone/Slack

**Level 2 - Senior Engineer**
- Response time: < 30 minutes
- Handles: Database issues, deployment issues, system outages
- Contact: Via Level 1 escalation

**Level 3 - Engineering Manager**
- Response time: < 1 hour
- Handles: Major outages, data loss, security incidents
- Contact: Via Level 2 escalation

**Level 4 - CTO/VP Engineering**
- Response time: < 2 hours
- Handles: Critical production incidents, business impact
- Contact: Via Level 3 escalation

### Common Incidents and Resolution

#### Incident 1: High CPU Usage (>80%)

**Detection:**
```bash
# Alert triggers when CPU > 80% for 5 minutes
curl -s http://localhost:5050/metrics | grep "cpu_usage_percent"

# Check current CPU
top -b -n 1 | head -15
```

**Diagnosis Steps:**

1. Identify CPU-intensive processes
   ```bash
   # Find top processes
   ps aux --sort=-%cpu | head -10
   
   # Check Node.js process
   ps aux | grep "node"
   
   # Get detailed stats
   pidstat -p PID 1 10
   ```

2. Check application logs for errors
   ```bash
   # Recent errors
   tail -f logs/server.log | grep -E "ERROR|WARN"
   
   # Check query performance
   mongosh --eval "db.currentOp(true).inprog"
   ```

3. Identify problematic queries
   ```bash
   # MongoDB slow query log
   mongosh --eval "
     db.system.profile.find(
       {millis: {\$gt: 1000}}
     ).pretty().limit(10)
   "
   ```

**Resolution:**

1. Short-term (Immediate)
   ```bash
   # Restart application
   kill $(cat .pid)
   sleep 5
   PORT=5050 npm run dev > logs/server.log 2>&1 &
   echo $! > .pid
   
   # Verify recovery
   sleep 5
   curl -s http://localhost:5050/health | jq .status
   ```

2. Medium-term (Within 1 hour)
   ```bash
   # Optimize problematic queries
   # Review slow query logs and add indexes
   npm run db:optimize
   
   # Clear cache if applicable
   redis-cli FLUSHDB
   ```

3. Long-term (Follow-up)
   - Review query patterns
   - Implement caching strategy
   - Consider database replication
   - Scale horizontally if needed

**Post-Incident:**
- Create ticket in issue tracker
- Document root cause
- Implement permanent fix
- Update runbook if needed

#### Incident 2: High Memory Usage (>85%)

**Detection:**
```bash
# Alert triggers when memory > 85% for 5 minutes
curl -s http://localhost:5050/metrics | grep "memory_usage_percent"

# Check current memory
free -h
```

**Diagnosis Steps:**

1. Check Node.js heap usage
   ```bash
   # Connect to Node.js process
   node --inspect=0.0.0.0:9229 server/index.js
   
   # Or check heap dump
   kill -USR2 $(cat .pid)
   ls -lah heapdump*.heapsnapshot
   ```

2. Identify memory leaks
   ```bash
   # Check memory growth over time
   watch -n 1 'ps aux | grep node | grep -v grep | awk "{print \$6}"'
   
   # Check for unclosed connections
   mongosh --eval "
     db.current_op(true).inprog.forEach(op => {
       if (op.secs_running > 300) {
         print('Long-running op: ' + op.opid);
       }
     });
   "
   ```

3. Review application logs
   ```bash
   # Check for connection pool warnings
   tail -f logs/server.log | grep -i "pool\|leak\|memory"
   ```

**Resolution:**

1. Short-term (Immediate)
   ```bash
   # Garbage collection trigger
   kill -USR2 $(cat .pid)
   
   # Clear session cache
   redis-cli FLUSHALL
   
   # Restart if memory doesn't decrease
   kill $(cat .pid)
   sleep 5
   PORT=5050 npm run dev > logs/server.log 2>&1 &
   echo $! > .pid
   ```

2. Medium-term (Within 1 hour)
   ```bash
   # Review database connection pool settings
   # Adjust in .env.production
   DB_POOL_SIZE=20
   DB_POOL_IDLE_TIMEOUT=30000
   
   # Implement connection cleanup
   npm run db:cleanup-connections
   ```

3. Long-term (Follow-up)
   - Profile memory usage with profiling tools
   - Identify and fix memory leaks
   - Optimize data structures
   - Implement stricter resource limits

#### Incident 3: Database Connection Failures

**Detection:**
```bash
# Alert triggers when connection failures > 5 in 5 minutes
curl -s http://localhost:5050/health | jq '.database.status'
```

**Diagnosis Steps:**

1. Check database connectivity
   ```bash
   # Test connection
   mongosh --eval "db.adminCommand('ping')"
   
   # Check connection count
   mongosh --eval "db.currentOp(true).inprog.length"
   
   # Check max connections
   mongosh --eval "db.adminCommand('getParameter', 'maxIncomingConnections')"
   ```

2. Check network connectivity
   ```bash
   # Test MongoDB port
   nc -zv localhost 27017
   
   # Check firewall rules
   sudo ufw show added | grep 27017
   ```

3. Review application logs
   ```bash
   # Check for connection errors
   tail -f logs/server.log | grep -i "mongo\|connection"
   ```

**Resolution:**

1. Short-term (Immediate)
   ```bash
   # Restart MongoDB
   sudo systemctl restart mongod
   
   # Restart application
   kill $(cat .pid)
   sleep 10
   PORT=5050 npm run dev > logs/server.log 2>&1 &
   echo $! > .pid
   ```

2. Medium-term (Within 1 hour)
   ```bash
   # Check database logs
   tail -f /var/log/mongodb/mongod.log
   
   # Check replication status (if applicable)
   mongosh --eval "rs.status()"
   ```

3. Long-term (Follow-up)
   - Review connection pool configuration
   - Implement connection retry logic
   - Set up replica set for high availability
   - Configure monitoring alerts

#### Incident 4: Notification Delivery Failures

**Detection:**
```bash
# Alert triggers when delivery rate < 95% for 15 minutes
curl -s http://localhost:5050/metrics | grep "notification_delivery_rate"

# Check notification queue
curl -s http://localhost:5050/api/admin/notifications/queue | jq '.stats'
```

**Diagnosis Steps:**

1. Check notification service status
   ```bash
   # Check delivery status
   curl -s http://localhost:5050/api/admin/notifications/status | jq .
   
   # Check queue depth
   curl -s http://localhost:5050/api/admin/notifications/queue | jq '.pending_count'
   ```

2. Check SendGrid integration
   ```bash
   # Verify API key
   curl -s "https://api.sendgrid.com/v3/user/account" \
     -H "Authorization: Bearer $SENDGRID_API_KEY" | jq .
   
   # Check bounce/complaint logs
   tail -f logs/sendgrid.log
   ```

3. Check Twilio integration
   ```bash
   # Verify API credentials
   curl -s "https://api.twilio.com/2010-04-01/Accounts.json" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
   
   # Check SMS delivery logs
   tail -f logs/twilio.log
   ```

**Resolution:**

1. Short-term (Immediate)
   ```bash
   # Restart notification service
   npm run services:restart:notifications
   
   # Retry failed notifications
   curl -X POST http://localhost:5050/api/admin/notifications/retry \
     -H "Content-Type: application/json" \
     -d '{"status": "failed", "limit": 100}'
   ```

2. Medium-term (Within 1 hour)
   ```bash
   # Check service quotas
   # - SendGrid daily limit
   # - Twilio account balance
   # - Rate limits
   
   # Implement queue throttling
   NOTIFICATION_BATCH_SIZE=50
   NOTIFICATION_DELAY_MS=100
   ```

3. Long-term (Follow-up)
   - Review delivery logs for patterns
   - Implement multi-provider failover
   - Set up redundant notification services
   - Improve retry logic

#### Incident 5: Application Crash or Hang

**Detection:**
```bash
# Application doesn't respond to health checks
curl -m 5 http://localhost:5050/health

# Check process status
ps aux | grep "node" | grep -v grep
```

**Diagnosis Steps:**

1. Check process status
   ```bash
   # Get process info
   ps -elf | grep $(cat .pid)
   
   # Check if zombie process
   ps aux | grep "<defunct>"
   ```

2. Check recent logs
   ```bash
   # Last 100 lines of log
   tail -100 logs/server.log
   
   # Look for crash messages
   grep -E "FATAL|Segmentation|exit|crash" logs/server.log
   ```

3. Check system resources
   ```bash
   # Check disk space
   df -h
   
   # Check available memory
   free -h
   
   # Check system logs
   dmesg | tail -20
   ```

**Resolution:**

1. Short-term (Immediate)
   ```bash
   # Kill process
   kill -9 $(cat .pid)
   
   # Clean up resources
   rm -f .pid
   
   # Restart application
   PORT=5050 npm run dev > logs/server.log 2>&1 &
   echo $! > .pid
   
   # Verify restart
   sleep 5
   curl -s http://localhost:5050/health | jq .
   ```

2. Medium-term (Within 1 hour)
   ```bash
   # Review crash logs
   tail -200 logs/server.log > /tmp/crash-log.txt
   
   # Check for out-of-memory errors
   grep -i "OOM\|out of memory" logs/server.log
   
   # Check node version issues
   node --version
   npm list
   ```

3. Long-term (Follow-up)
   - Enable crash dumps
   - Implement automatic restart (systemd/PM2)
   - Review code for crash causes
   - Set up core dump analysis

### Post-Incident Review Process

**Within 24 hours of incident:**

1. Create Incident Report
   ```markdown
   # Incident Report
   
   ## Summary
   - Incident ID: INC-2026-08-12-001
   - Severity: P1 (Critical) / P2 (High) / P3 (Medium) / P4 (Low)
   - Duration: 2026-08-12 10:30 UTC to 10:45 UTC (15 minutes)
   - Impact: 2,500 customers affected, 500 failed bookings
   
   ## Root Cause
   - Database connection pool exhaustion
   - Long-running queries blocking new connections
   
   ## Timeline
   - 10:30 UTC - Alert triggered (high error rate)
   - 10:32 UTC - On-call engineer acknowledged
   - 10:35 UTC - Root cause identified
   - 10:40 UTC - Database restarted
   - 10:45 UTC - Service restored
   
   ## Resolution
   - Restarted MongoDB
   - Increased connection pool size
   - Killed long-running operations
   
   ## Follow-up Actions
   - [ ] Implement query timeout (2 hours)
   - [ ] Add connection pool monitoring (1 week)
   - [ ] Implement database replication (2 weeks)
   - [ ] Review query performance (ongoing)
   ```

2. Schedule Post-Mortem Meeting
   - Engineering team
   - Product manager
   - Customer support lead
   - Duration: 30-60 minutes

3. Create Action Items
   - Prevent: What will prevent this again?
   - Detect: How will we detect this faster?
   - Respond: How will we respond faster?
   - Learn: What did we learn?

4. Update Runbook
   - Document new detection methods
   - Update resolution steps
   - Add prevention measures
   - Commit changes to version control

---

## Daily Operations

### Health Check Procedures (30 minutes)

**Morning Checklist (8:00 AM):**

1. **Server Health**
   ```bash
   # Check all services
   curl -s http://localhost:5050/health/detailed | jq .
   
   # Expected output:
   # {
   #   "status": "healthy",
   #   "timestamp": "...",
   #   "services": {
   #     "database": "healthy",
   #     "cache": "healthy",
   #     "notifications": "healthy",
   #     "storage": "healthy"
   #   }
   # }
   ```

2. **System Resources**
   ```bash
   # CPU usage
   top -b -n 1 | head -3
   
   # Memory usage
   free -h | grep Mem
   
   # Disk usage
   df -h | grep -E "^/dev/"
   
   # Check for alerts
   curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.state == "firing")'
   ```

3. **Database Health**
   ```bash
   # Connection count
   mongosh --eval "db.serverStatus().connections"
   
   # Storage size
   mongosh --eval "db.stats().totalSize"
   
   # Replication status
   mongosh --eval "rs.status()"
   ```

4. **Application Metrics**
   ```bash
   # Check request rates
   curl -s http://localhost:5050/metrics | grep "http_requests_total"
   
   # Check error rates
   curl -s http://localhost:5050/metrics | grep "http_requests_error"
   
   # Check response times
   curl -s http://localhost:5050/metrics | grep "http_request_duration"
   ```

### Log Monitoring (30 minutes)

**Hourly Log Review:**

```bash
#!/bin/bash
# Check for errors in the past hour
TIMESTAMP=$(date -d "1 hour ago" +"%Y-%m-%d %H:%M:%S")

# Count errors by type
echo "=== Error Summary ==="
grep "ERROR" logs/server.log | grep -aF "$TIMESTAMP" | wc -l

# List top error messages
echo "=== Top Errors ==="
grep "ERROR" logs/server.log | grep -aF "$TIMESTAMP" | cut -d: -f4- | sort | uniq -c | sort -rn | head -10

# Check warning count
echo "=== Warning Summary ==="
grep "WARN" logs/server.log | grep -aF "$TIMESTAMP" | wc -l

# Check for critical issues
echo "=== Critical Issues ==="
grep -E "FATAL|CRITICAL" logs/server.log | tail -10
```

### Performance Monitoring (20 minutes)

**Afternoon Metrics Review (3:00 PM):**

```bash
# Generate performance report
cat > /tmp/perf-report.sh << 'EOF'
#!/bin/bash
echo "=== Performance Report (Last 24 hours) ==="
echo ""

echo "Request Metrics:"
curl -s http://localhost:5050/metrics | grep "http_requests_total" | tail -10

echo ""
echo "Response Time (p99):"
curl -s http://localhost:5050/metrics | grep "http_request_duration_seconds" | grep "p99" | tail -5

echo ""
echo "Error Rate:"
curl -s http://localhost:5050/metrics | grep "http_requests_error_total" | tail -10

echo ""
echo "Database Queries per Second:"
mongosh --eval "
  const stats = db.serverStatus().opcounters;
  console.log('Insert/s:', stats.insert);
  console.log('Query/s:', stats.query);
  console.log('Update/s:', stats.update);
  console.log('Delete/s:', stats.delete);
"
EOF

bash /tmp/perf-report.sh
```

### Alert Response (As needed)

**Alert Response Process:**

1. **Receive Alert**
   - Slack notification
   - Email notification
   - PagerDuty alert

2. **Acknowledge Alert**
   ```bash
   # Acknowledge in Slack
   # React with :eyes: emoji
   # Reply: "Investigating..."
   ```

3. **Initial Diagnosis**
   - Check affected service
   - Check error logs
   - Check metrics
   - Determine severity

4. **Escalate if Needed**
   - P1 (Critical): Escalate immediately
   - P2 (High): Escalate after 10 minutes
   - P3 (Medium): Escalate after 30 minutes

5. **Keep Team Updated**
   - Send updates every 15 minutes
   - Provide status: Investigating/Working/Resolved
   - Share findings with team

---

## Weekly Tasks

### Log Archival (Friday 11:00 PM)

```bash
#!/bin/bash
# Archive logs older than 7 days

ARCHIVE_DIR="/backup/logs/$(date +%Y/%m/%d)"
mkdir -p "$ARCHIVE_DIR"

# Find and compress old logs
find logs/ -name "*.log" -mtime +7 -exec gzip -v {} \;

# Move to archive
find logs/ -name "*.log.gz" -mtime +7 -exec mv {} "$ARCHIVE_DIR"/ \;

# Verify archive
ls -lh "$ARCHIVE_DIR"

# Update log retention
# Keep 30 days locally, archive older
```

### Database Vacuum and Optimization (Saturday 2:00 AM)

```bash
#!/bin/bash
# Run during low traffic window

echo "Starting database optimization..."

# Compact collections
mongosh --eval "
  db.getCollectionNames().forEach(collection => {
    print('Compacting: ' + collection);
    db[collection].reIndex();
  });
"

# Remove old documents
mongosh --eval "
  // Delete notifications older than 90 days
  db.notifications.deleteMany({
    created_at: {\$lt: new Date(Date.now() - 90*24*60*60*1000)}
  });
  
  // Delete audit logs older than 6 months
  db.audit_logs.deleteMany({
    timestamp: {\$lt: new Date(Date.now() - 180*24*60*60*1000)}
  });
"

# Rebuild indexes
mongosh --eval "
  db.bookings.reIndex();
  db.customers.reIndex();
  db.drivers.reIndex();
  db.vehicles.reIndex();
"

# Compact storage
mongosh --eval "
  db.runCommand({compact: 'bookings', force: true});
  db.runCommand({compact: 'customers', force: true});
  db.runCommand({compact: 'drivers', force: true});
  db.runCommand({compact: 'vehicles', force: true});
"

echo "Database optimization complete"
```

### Performance Review (Monday 9:00 AM)

```bash
#!/bin/bash
# Weekly performance summary

echo "=== Weekly Performance Review ==="
echo "Week: $(date -d 'last Monday' +%Y-%m-%d) to $(date +%Y-%m-%d)"
echo ""

# Calculate availability
UPTIME=$(curl -s http://localhost:5050/metrics | grep "up_time_seconds" | awk '{print $2}')
AVAILABILITY=$((UPTIME / 604800 * 100))
echo "Availability: ${AVAILABILITY}%"

# Average response time
RESPONSE_TIME=$(curl -s http://localhost:5050/metrics | grep "http_request_duration_seconds_bucket{le=\"1\"" | awk '{print $2}')
echo "Avg Response Time: ${RESPONSE_TIME}ms"

# Error rate
ERRORS=$(curl -s http://localhost:5050/metrics | grep "http_requests_error_total" | awk '{print $2}')
TOTAL=$(curl -s http://localhost:5050/metrics | grep "http_requests_total" | awk '{print $2}')
ERROR_RATE=$((ERRORS / TOTAL * 100))
echo "Error Rate: ${ERROR_RATE}%"

# Generate trend report
echo ""
echo "=== Trends ==="
grep "performance" logs/weekly-summary.log | tail -4

# Export to dashboard
# Update Grafana annotations with weekly summary
```

### Security Patching (Wednesday 2:00 AM)

```bash
#!/bin/bash
# Apply security updates

echo "Starting security patching..."

# Check for npm security vulnerabilities
npm audit

# Fix if available
npm audit fix

# Check system packages
apt update
apt list --upgradable

# Review critical updates
apt list --upgradable | grep -i "security\|critical"

# For testing environment
apt upgrade -y

# For production, review and test first
# Create test instance
# Deploy, verify
# Then schedule production update

echo "Security patching complete"
```

### Dependency Updates (Every other Thursday 3:00 AM)

```bash
#!/bin/bash
# Update dependencies

echo "Starting dependency update..."

# Check for outdated packages
npm outdated

# Review major updates
npm outdated | grep -E "^(next|react|express)" 

# Update non-major versions
npm update

# Review changes
git diff package.json

# Test
npm run test

# If all tests pass
git add package.json package-lock.json
git commit -m "chore: update dependencies"

echo "Dependency update complete"
```

---

## Monthly Tasks

### Full Security Audit (First Friday of month, 10:00 AM)

**Checklist:**

1. **Access Control Review**
   ```bash
   # List all users with admin access
   mongosh --eval "
     db.users.find({role: 'admin'}, {email: 1, lastLogin: 1}).pretty()
   "
   
   # Check for inactive accounts (90+ days)
   mongosh --eval "
     db.users.find({
       lastLogin: {\$lt: new Date(Date.now() - 90*24*60*60*1000)}
     }, {email: 1, lastLogin: 1}).pretty()
   "
   ```

2. **API Key Rotation**
   ```bash
   # List API keys older than 90 days
   mongosh --eval "
     db.api_keys.find({
       createdAt: {\$lt: new Date(Date.now() - 90*24*60*60*1000)}
     }, {key_id: 1, createdAt: 1}).pretty()
   "
   
   # Rotate old keys
   npm run security:rotate-keys
   ```

3. **SSL/TLS Certificate Verification**
   ```bash
   # Check certificate expiration
   openssl s_client -connect api.fleetpro.example.com:443 -servername api.fleetpro.example.com 2>/dev/null | openssl x509 -noout -dates
   
   # Expected output:
   # notBefore=Jan 12 00:00:00 2026 GMT
   # notAfter=Feb 11 23:59:59 2027 GMT
   ```

4. **Database Security Check**
   ```bash
   # Verify authentication
   mongosh --eval "
     const result = db.runCommand({serverStatus: 1});
     console.log('Authentication:', result.security);
   "
   
   # Check for unauthorized access attempts
   tail -1000 /var/log/mongodb/mongod.log | grep "authentication\|failed"
   ```

5. **Audit Log Review**
   ```bash
   # Check for suspicious activities
   mongosh --eval "
     db.audit_logs.find({
       action: {
         \$in: ['delete', 'bulk_update', 'permission_change']
       },
       timestamp: {\$gt: new Date(Date.now() - 30*24*60*60*1000)}
     }).pretty()
   "
   ```

6. **Backup Verification**
   ```bash
   # Verify recent backups exist
   ls -lh /backups/mongodb/ | tail -5
   
   # Test restore from latest backup
   mongorestore --archive=/backups/mongodb/latest.archive --dryRun
   ```

### Capacity Planning (Third Tuesday of month, 2:00 PM)

**Analysis:**

1. **Current Resource Usage**
   ```bash
   # Disk usage trend
   df -h /data | tail -1
   
   # Growth rate
   du -sh /data /backups | tail -2
   
   # Database size
   mongosh --eval "
     const stats = db.stats();
     console.log('Data Size:', (stats.dataSize / 1024 / 1024 / 1024).toFixed(2), 'GB');
     console.log('Storage Size:', (stats.storageSize / 1024 / 1024 / 1024).toFixed(2), 'GB');
   "
   ```

2. **Growth Projections**
   ```
   Daily Growth Rate: 500 MB
   Monthly: 15 GB
   Yearly: 180 GB
   
   Projected Full Disk: 18 months
   Recommended Action: Expansion at 6 months (50% capacity)
   ```

3. **Scaling Triggers**
   - CPU > 70% for 7 consecutive days → Scale up or optimize
   - Memory > 75% for 7 consecutive days → Add more RAM
   - Disk > 70% → Expand storage
   - Query latency p99 > 1s → Add indexes or replicas

4. **Cost Analysis**
   ```
   Current:
   - Server: $500/month
   - Storage: $100/month
   - Backup: $50/month
   - Total: $650/month
   
   Projected (6 months):
   - Upgrade server (higher CPU/RAM): $800/month
   - Expand storage: $150/month
   - Additional backup: $100/month
   - Total: $1,050/month
   
   Savings with optimization: $200-300/month
   ```

### Disaster Recovery Drill (Fourth Wednesday of month, 4:00 PM)

**DR Drill Procedure:**

1. **Test Database Recovery**
   ```bash
   # Create snapshot
   mongodump --archive=/tmp/dr-test.archive
   
   # Restore to test instance
   mongorestore --archive=/tmp/dr-test.archive \
     --host=localhost:27018 \
     --nsFrom="fleetpro_production.*" \
     --nsTo="fleetpro_dr_test.*"
   
   # Verify data
   mongosh --port 27018 --eval "
     db.customers.countDocuments()
     db.bookings.countDocuments()
   "
   ```

2. **Test Application Failover**
   ```bash
   # Start application on test database
   DB_REPLICA_SET_HOSTS="localhost:27018" npm run dev
   
   # Run tests
   npm run test:e2e
   ```

3. **Verify Data Integrity**
   ```bash
   # Compare record counts
   PROD_COUNT=$(mongosh --eval "db.bookings.countDocuments()")
   DR_COUNT=$(mongosh --port 27018 --eval "db.bookings.countDocuments()")
   
   if [ "$PROD_COUNT" != "$DR_COUNT" ]; then
     echo "ERROR: Data mismatch!"
   else
     echo "OK: Data verified"
   fi
   ```

4. **Document Results**
   ```markdown
   # DR Drill Results - 2026-08-12
   
   ## Execution
   - Start Time: 2026-08-12 16:00 UTC
   - End Time: 2026-08-12 16:45 UTC
   - Duration: 45 minutes
   - Status: PASS
   
   ## Results
   - Database Recovery: OK (5 minutes)
   - Application Start: OK (2 minutes)
   - Data Integrity: VERIFIED
   - E2E Tests: 142/142 PASSED
   
   ## Issues Found
   - None
   
   ## Improvements
   - Reduce DNS failover time (currently 2 minutes)
   
   ## Follow-up Actions
   - [ ] Implement DNS failover automation
   ```

### Stakeholder Reporting (End of month, 5:00 PM)

**Monthly Report Template:**

```markdown
# FleetPro Operations Report - August 2026

## Executive Summary
- Uptime: 99.95%
- Incidents: 1 (P3 - Resolved)
- Performance: Excellent
- Status: HEALTHY

## Key Metrics
- Availability: 99.95% (Target: 99.9%)
- Mean Response Time: 250ms (Target: <500ms)
- Error Rate: 0.05% (Target: <0.1%)
- Database Performance: 95th percentile query time: 450ms

## Incidents
1. High memory usage on 2026-08-08
   - Duration: 30 minutes
   - Impact: 50 users affected
   - Resolution: Cleared cache, optimized queries
   - Status: RESOLVED

## System Updates
- Updated Node.js to v18.17.1
- Applied 3 security patches
- Optimized 5 database queries
- Added monitoring for 2 new metrics

## Upcoming Maintenance
- Database replication setup (scheduled for 2026-08-25)
- Network upgrade (planned for 2026-09-15)

## Recommendations
1. Implement automatic scaling
2. Set up database read replicas
3. Migrate to container orchestration

## Budget Status
- Actual: $650/month
- Budget: $1,000/month
- Variance: -35% (Under budget)

Signed: Engineering Team Lead
Date: 2026-08-31
```

---

## Emergency Procedures

### Critical: Complete Service Outage

**Response (5 minutes)**
```bash
# 1. Acknowledge and notify
echo "CRITICAL OUTAGE" | mail -s "Critical Alert" oncall@fleetpro.example.com

# 2. Check all components
curl -m 5 http://localhost:5050/health

# 3. Check database
mongosh --eval "db.adminCommand('ping')"

# 4. Check logs
tail -50 logs/server.log | grep -E "ERROR|FATAL"
```

**Recovery (15 minutes)**
```bash
# 1. Restart application
kill -9 $(cat .pid)
sleep 5
PORT=5050 npm run dev > logs/server.log 2>&1 &
echo $! > .pid

# 2. Restart database if needed
sudo systemctl restart mongod

# 3. Verify recovery
sleep 10
curl -s http://localhost:5050/health | jq .

# 4. Notify stakeholders
# Outage resolved, running full diagnostics
```

### Critical: Data Loss/Corruption

**Immediate Actions**
1. Stop all writes to database
2. Take emergency backup
3. Notify VP Engineering
4. Prepare restore procedure

**Recovery**
```bash
# Restore from latest clean backup
mongorestore --archive=/backups/pre-incident.archive

# Verify restored data
mongosh --eval "db.stats()"

# Confirm with data team
# Re-enable application writes
```

---

## Quick Reference

### Essential Commands

```bash
# Health checks
curl http://localhost:5050/health/detailed

# View recent errors
tail -f logs/server.log | grep ERROR

# Monitor metrics
watch -n 5 'curl -s http://localhost:5050/metrics | grep http_requests'

# Database operations
mongosh
  > show dbs
  > use fleetpro_production
  > db.stats()

# Process management
ps aux | grep node
kill -9 <PID>
```

### Contact Information

**On-Call Rotation:**
- Monday-Friday: engineering-oncall@fleetpro.example.com
- Weekends/Holidays: senior-oncall@fleetpro.example.com

**Escalation:**
- Level 1: (555) 123-4567
- Level 2: (555) 234-5678
- Level 3: (555) 345-6789
- Level 4: (555) 456-7890

**External Vendors:**
- SendGrid Support: support@sendgrid.com
- Twilio Support: support@twilio.com
- MongoDB Support: support@mongodb.com

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
