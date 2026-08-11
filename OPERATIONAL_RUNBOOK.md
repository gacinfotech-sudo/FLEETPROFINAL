# FleetPro Notification System - Operational Runbook

## Quick Reference

**Service URL**: `https://192.168.29.142:5050`  
**Health Check**: `curl https://192.168.29.142:5050/api/notification-health/status`  
**On-Call**: [Team Channel]  
**Status Page**: [status.fleetpro.com]

---

## 1. Daily Operations

### Morning Standup Checklist

```bash
# 1. Health Status
curl -s https://192.168.29.142:5050/api/notification-health/status | jq '.status'
# Expected: "healthy" or "degraded" (never "unhealthy")

# 2. Queue Depth
curl -s https://192.168.29.142:5050/api/notification-health/components | jq '.components'
# Email queue < 1000, SMS queue < 500

# 3. Success Rate (Last 24h)
curl -s https://192.168.29.142:5050/api/notification-health/sla | jq '.sla'
# Success rate > 99%, availability > 99.9%

# 4. Database Connection
mongosh --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }

# 5. Provider Status
curl -s https://192.168.29.142:5050/api/notification-providers/email/status | jq
curl -s https://192.168.29.142:5050/api/notification-providers/sms/status | jq
```

### Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Success Rate | > 99% | 95-99% | < 95% |
| Avg Delivery Time | < 2s | 2-5s | > 5s |
| Email Queue Depth | < 100 | 100-1000 | > 1000 |
| SMS Queue Depth | < 50 | 50-500 | > 500 |
| Database Latency | < 50ms | 50-100ms | > 100ms |
| Memory Usage | < 50% | 50-80% | > 80% |
| CPU Usage | < 30% | 30-70% | > 70% |

---

## 2. Incident Response

### Scenario: Email Delivery Failures

**Symptom**: Success rate drops below 95%

```bash
# 1. Check email queue
mongosh --eval "db.email_queue.find({status: 'failed'}).limit(5).pretty()"

# 2. Check SendGrid API
curl -s https://api.sendgrid.com/v3/mail/validate \
  -H "Authorization: Bearer $SENDGRID_API_KEY" | jq

# 3. Check provider config
curl -s https://192.168.29.142:5050/api/notification-providers/email/status | jq

# 4. Restart email queue processor
mongosh --eval "db.email_queue.deleteMany({status: 'queued', createdAt: {$lt: new Date(Date.now() - 3600000)}})"

# 5. Monitor recovery
for i in {1..10}; do
  curl -s https://192.168.29.142:5050/api/notification-health/sla | jq '.sla.successRate'
  sleep 30
done
```

### Scenario: SMS Delivery Failures

**Symptom**: SMS queue growing, failed delivery count increasing

```bash
# 1. Check SMS queue
mongosh --eval "db.sms_queue.countDocuments({status: 'failed'})"

# 2. Verify Twilio credentials
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  https://api.twilio.com/2010-04-01/Accounts

# 3. Check rate limiting
mongosh --eval "db.notification_rate_limit.find({type: 'sms'}).limit(5).pretty()"

# 4. Clear old failed messages (24h+)
mongosh --eval "db.sms_queue.deleteMany({status: 'failed', createdAt: {$lt: new Date(Date.now() - 86400000)}})"

# 5. Restart SMS processor
kill -HUP $(lsof -ti:5050)
```

### Scenario: High Memory Usage

**Symptom**: Memory > 80%, service slowing

```bash
# 1. Check cache stats
curl -s https://192.168.29.142:5050/api/notification-health/components | jq

# 2. Clear cache (non-destructive)
mongosh --eval "db.cache.deleteMany({expiry: {$lt: new Date()}})"

# 3. Check for memory leaks
node --inspect=9229 server/index.ts &
# Connect DevTools inspector: chrome://inspect

# 4. Restart service if needed
sudo systemctl restart fleetpro-notifications
```

### Scenario: Database Connection Issues

**Symptom**: 5xx errors, database timeout

```bash
# 1. Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# 2. Check connection pool
mongosh --eval "db.serverStatus().connections"

# 3. Monitor active operations
mongosh --eval "db.currentOp(true)"

# 4. Kill slow queries if needed
mongosh --eval "db.killOp(OPID)"

# 5. Restart database connection
npm restart
```

---

## 3. Scaling Operations

### Horizontal Scaling (Multiple Instances)

```bash
# Start multiple instances behind load balancer
PORT=5050 npm start &
PORT=5051 npm start &
PORT=5052 npm start &

# Configure nginx load balancer
cat > /etc/nginx/sites-available/fleetpro-notifications << 'EOF'
upstream notification_backend {
  server localhost:5050;
  server localhost:5051;
  server localhost:5052;
}

server {
  listen 443 ssl http2;
  server_name notifications.fleetpro.com;
  
  ssl_certificate /etc/ssl/certs/notification-cert.pem;
  ssl_certificate_key /etc/ssl/private/notification-key.pem;
  
  location / {
    proxy_pass https://notification_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
EOF

# Reload nginx
sudo systemctl reload nginx
```

### Redis Caching Setup

```bash
# Install Redis
docker run -d -p 6379:6379 redis:7

# Enable in .env
echo "REDIS_ENABLED=true" >> .env
echo "REDIS_URL=redis://localhost:6379" >> .env

# Restart service
npm restart
```

### Database Indexing

```bash
# Create recommended indexes
mongosh << 'EOF'
db.notification_events.createIndex({tenantId: 1, createdAt: -1})
db.notification_preferences.createIndex({userId: 1, tenantId: 1})
db.notification_analytics.createIndex({timestamp: -1, channel: 1})
db.email_queue.createIndex({status: 1, createdAt: 1})
db.sms_queue.createIndex({status: 1, createdAt: 1})
db.notification_rules.createIndex({enabled: 1, priority: -1})
EOF
```

---

## 4. Backup & Recovery

### Daily Backups

```bash
# Backup MongoDB
mongodump --uri "mongodb://127.0.0.1:27017/fleetpro" --out /backups/fleetpro-$(date +%Y%m%d)

# Backup code repository
cd /var/fleetpro && git bundle create /backups/fleetpro-$(date +%Y%m%d).bundle --all

# Verify backup
tar -tzf /backups/fleetpro-$(date +%Y%m%d).tar.gz | head -20
```

### Disaster Recovery

```bash
# Restore from backup
mongorestore --uri "mongodb://127.0.0.1:27017/" /backups/fleetpro-YYYYMMDD/

# Verify data
mongosh --eval "db.notification_events.countDocuments()"

# Restart service
npm start
```

---

## 5. Security Procedures

### Credential Rotation

```bash
# Rotate SendGrid API key
1. Generate new key in SendGrid dashboard
2. Update .env: SENDGRID_API_KEY=new-key
3. Test: curl -s https://api.sendgrid.com/v3/mail/validate -H "Authorization: Bearer $SENDGRID_API_KEY"
4. Restart service
5. Revoke old key in SendGrid

# Rotate Twilio credentials (same pattern)
# Rotate VAPID keys
npm run generate-vapid-keys
# Update .env and .well-known/vapid-keys.json
# Notify clients to re-subscribe
```

### Security Audit

```bash
# Run OWASP check
npm audit

# Scan dependencies
npm audit --json | jq '.metadata.vulnerabilities'

# Check for exposed secrets
git-secrets --scan

# Review audit logs
mongosh --eval "db.audit_logs.find({timestamp: {$gte: new Date(Date.now() - 604800000)}}).limit(100)"
```

---

## 6. Performance Tuning

### Query Optimization

```bash
# Enable profiling (development only)
mongosh --eval "db.setProfilingLevel(1, {slowms: 100})"

# View slow queries
mongosh --eval "db.system.profile.find().sort({ts:-1}).limit(10).pretty()"

# Add indexes for slow queries
mongosh --eval "db.notification_analytics.createIndex({tenantId: 1, channel: 1, timestamp: -1})"
```

### Cache Configuration

```bash
# Monitor cache hit rate
curl -s https://192.168.29.142:5050/api/notification-health/metrics | grep cache_hit_rate

# Adjust TTL if needed (in productionHardening.ts)
const defaultTTL = 5 * 60 * 1000; // Adjust this value

# Clear cache if needed
curl -X POST https://192.168.29.142:5050/api/cache/clear
```

---

## 7. Monitoring & Alerts

### Grafana Dashboards

1. Import dashboard from `monitoring/grafana/dashboards/fleetpro-observability.json`
2. Set up alerts:
   - Success rate < 95% → PAGE ONCALL
   - Avg delivery time > 5s → WARN
   - Queue depth > 1000 → WARN
   - Database latency > 100ms → PAGE ONCALL

### Prometheus Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: notifications
    rules:
      - alert: LowSuccessRate
        expr: notification_success_rate < 0.95
        for: 5m
        annotations:
          summary: "Notification success rate below 95%"
          
      - alert: HighQueueDepth
        expr: notification_queue_depth > 1000
        for: 10m
        annotations:
          summary: "Notification queue depth exceeds 1000"
```

---

## 8. Emergency Procedures

### Service Restart

```bash
# Graceful restart (recommended)
sudo systemctl restart fleetpro-notifications

# Hard restart if needed
killall -9 node
npm start &
```

### Rollback to Previous Version

```bash
git log --oneline -10
git checkout <previous-commit>
npm run build
npm start
```

### Complete System Restore

```bash
# Stop service
systemctl stop fleetpro-notifications

# Restore from backup
mongorestore --drop /backups/fleetpro-YYYYMMDD/

# Restore code
cd /var/fleetpro && git checkout <backup-commit>

# Rebuild and restart
npm run build
systemctl start fleetpro-notifications
```

---

## 9. Escalation Procedures

### Level 1: Service Degradation
- **Action**: Check dashboards, restart if needed
- **Contacts**: On-call engineer
- **SLA**: 15 min response

### Level 2: Service Down
- **Action**: Investigate root cause, initiate rollback if needed
- **Contacts**: On-call + team lead
- **SLA**: 5 min response

### Level 3: Data Loss
- **Action**: Alert CTO, prepare disaster recovery
- **Contacts**: CTO + DBA + team lead
- **SLA**: 2 min response

---

## 10. Post-Incident Review

After any incident:

```bash
# Gather logs
mongosh --eval "db.audit_logs.find({timestamp: {$gte: new Date('2026-08-11T12:00:00Z')}}).toArray()" > incident.log

# Get metrics snapshot
curl -s https://192.168.29.142:5050/api/notification-health/metrics > metrics.txt

# Review error rate
mongosh --eval "db.notification_events.find({status: 'failed', timestamp: {$gte: new Date('2026-08-11T12:00:00Z')}}).count()"

# Document in incident report
# Timeline, root cause, fixes, prevention measures
```

---

## Useful Commands Cheat Sheet

```bash
# Health checks
curl https://192.168.29.142:5050/api/notification-health/status
curl https://192.168.29.142:5050/api/notification-health/components
curl https://192.168.29.142:5050/api/notification-health/sla

# Provider checks
curl https://192.168.29.142:5050/api/notification-providers/email/status
curl https://192.168.29.142:5050/api/notification-providers/sms/status

# Database operations
mongosh --host localhost:27017 --eval "db.notification_events.countDocuments()"
mongosh --host localhost:27017 --eval "db.email_queue.find({status: 'queued'}).limit(5)"

# Logs
journalctl -u fleetpro-notifications -f
tail -f /var/log/fleetpro/notifications.log

# Performance
ps aux | grep node
lsof -i :5050
```

---

**Last Updated**: 2026-08-11  
**Maintained By**: On-Call Team  
**Review Schedule**: Quarterly
