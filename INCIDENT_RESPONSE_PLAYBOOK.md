# FleetPro Notification System - Incident Response Playbook

**Last Updated**: August 11, 2026  
**Version**: 1.0  
**On-Call**: [Slack channel] | [PagerDuty link]

---

## Quick Reference

| Severity | Symptom | Action | SLA |
|----------|---------|--------|-----|
| **CRITICAL** | Service completely down | Page team immediately | 2 min response |
| **HIGH** | Success rate < 90% | Investigate + notify | 5 min response |
| **MEDIUM** | Success rate 90-99% | Monitor + plan fix | 15 min response |
| **LOW** | Single feature broken | Log + schedule fix | 4 hour response |

---

## Incident Detection

### Automated Alerts (Will page on-call)
- ❌ Service unavailable (HTTP 5xx)
- ❌ Success rate drops below 95% (5-min window)
- ❌ Average delivery time > 10 seconds
- ❌ Queue depth exceeds 10,000 messages
- ❌ Database response time > 500ms
- ❌ Memory usage exceeds 85%
- ❌ CPU usage exceeds 90%

### Manual Detection
- User reports notifications not received
- Error rate spike in logs
- Slow response times reported
- Monitoring dashboard unavailable
- Any production data loss

---

## CRITICAL: Service Down

**Detection**: Service not responding (TCP connection refused, HTTP 503+)

### Immediate Response (0-2 minutes)

1. **Acknowledge the incident**
   ```bash
   # Log into PagerDuty/Slack
   echo "INCIDENT ACKNOWLEDGED - $(date)" >> /var/log/fleetpro-incident.log
   ```

2. **Page the team**
   ```bash
   # Notify all team members
   # - CTO
   # - Engineering Lead
   # - On-call backup
   # - Database admin
   ```

3. **Assess the situation**
   ```bash
   # Check if service is actually down
   curl -s https://192.168.29.142:5050/api/notification-health/status
   
   # Check service status
   systemctl status fleetpro-notifications
   
   # Check recent logs
   journalctl -u fleetpro-notifications -n 50 --no-pager
   ```

4. **Determine severity**
   - Is it affecting users? → CRITICAL
   - Is it affecting a single component? → HIGH
   - Is it a transient blip? → MEDIUM

### Investigation (2-10 minutes)

**Is the process running?**
```bash
ps aux | grep "node.*5050"
lsof -i :5050
```

**Is the database accessible?**
```bash
mongosh --eval "db.adminCommand('ping')"
mongosh --eval "db.notification_events.countDocuments()"
```

**Check logs for errors**
```bash
# Last 100 lines
journalctl -u fleetpro-notifications -n 100 -p err

# Parse error patterns
grep -i "error\|fail\|exception" /var/log/fleetpro.log | tail -20
```

**Check system resources**
```bash
# CPU and memory
ps aux | grep "node.*5050"

# Disk space
df -h / /tmp

# Network connectivity
netstat -an | grep ESTABLISHED | wc -l
```

### Recovery (10-30 minutes)

**Option 1: Restart service (try this first)**
```bash
# Graceful restart
sudo systemctl restart fleetpro-notifications

# Verify it started
sleep 5
curl -s https://192.168.29.142:5050/api/notification-health/status | jq '.status'

# Monitor logs
journalctl -u fleetpro-notifications -f
```

**Option 2: Check and fix common issues**

- **Port already in use**
  ```bash
  lsof -ti:5050 | xargs kill -9
  sleep 2
  systemctl start fleetpro-notifications
  ```

- **Database connection timeout**
  ```bash
  # Restart MongoDB
  sudo systemctl restart mongod
  
  # Or reconnect from app
  npm restart
  ```

- **Out of memory**
  ```bash
  # Free memory
  sync; echo 3 > /proc/sys/vm/drop_caches
  
  # Restart service
  systemctl restart fleetpro-notifications
  ```

- **Disk full**
  ```bash
  # Find large files
  du -sh /var/fleetpro/* | sort -rh
  
  # Clear old logs
  journalctl --vacuum=7d
  
  # Clear old backups
  rm -f /backups/fleetpro-*-7days-old.tar.gz
  ```

**Option 3: Rollback if restart fails**
```bash
# Determine last known-good version
git log --oneline -10

# Rollback to previous version
git checkout <previous-commit-hash>

# Rebuild and restart
npm run build
systemctl restart fleetpro-notifications

# Verify
sleep 5
curl https://192.168.29.142:5050/api/notification-health/status
```

### Communication

**Immediately notify** (< 5 min):
- Post to #incidents channel
- Page executive summary (Service down, investigating)

**Every 15 minutes**:
- Update status on page/dashboard
- Post progress to #incidents

**When recovered**:
- Declare incident resolved
- Begin root cause analysis
- Post timeline and resolution details

---

## HIGH: Success Rate Drops Below 90%

**Detection**: Metrics show `success_rate < 90%` for 5+ consecutive minutes

### Investigation (< 10 minutes)

1. **Confirm the issue**
   ```bash
   # Get real-time success rate
   curl -s https://192.168.29.142:5050/api/notification-health/sla | jq '.sla.successRate'
   
   # Get failed deliveries
   mongosh --eval "db.notification_events.countDocuments({status: 'failed'})"
   ```

2. **Identify which channel is failing**
   ```bash
   # Email failures
   mongosh --eval "db.email_queue.countDocuments({status: 'failed'})"
   
   # SMS failures
   mongosh --eval "db.sms_queue.countDocuments({status: 'failed'})"
   
   # Push failures (check recent logs)
   journalctl -u fleetpro-notifications | grep "push.*error" | tail -20
   ```

3. **Check provider status**
   ```bash
   # Email provider
   curl -s https://192.168.29.142:5050/api/notification-providers/email/status | jq
   
   # SMS provider
   curl -s https://192.168.29.142:5050/api/notification-providers/sms/status | jq
   ```

### Common Causes & Fixes

**Email Provider Issues**

```bash
# Check SendGrid API key
curl -H "Authorization: Bearer $SENDGRID_API_KEY" \
  https://api.sendgrid.com/v3/mail/validate

# Clear email queue if stuck
mongosh --eval "db.email_queue.deleteMany({status: 'failed', createdAt: {$lt: new Date(Date.now() - 3600000)}})"

# Restart email processor
systemctl restart fleetpro-notifications
```

**SMS Provider Issues**

```bash
# Check Twilio credentials
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  https://api.twilio.com/2010-04-01/Accounts

# Clear SMS queue
mongosh --eval "db.sms_queue.deleteMany({status: 'failed', createdAt: {$lt: new Date(Date.now() - 3600000)}})"
```

**Database Issues**

```bash
# Check database latency
time mongosh --eval "db.notification_events.countDocuments()" > /dev/null

# Check connection pool
mongosh --eval "db.serverStatus().connections"

# Recreate indexes if needed
npm run create-indexes
```

---

## MEDIUM: Success Rate 90-99%

**Detection**: Metrics show `90% < success_rate < 99%` for 5+ minutes

### Steps

1. **Monitor trend**
   - Is it improving or worsening?
   - When did it start?
   - What changed?

2. **Check specific failures**
   ```bash
   # Find failed notifications
   mongosh --eval "db.notification_events.find({status: 'failed'}).limit(10).pretty()"
   
   # Analyze error patterns
   mongosh --eval "db.audit_logs.find({level: 'error'}).limit(20).pretty()"
   ```

3. **Implement fix**
   - Increase retry count (if too aggressive)
   - Check and rotate credentials
   - Scale resources if under load
   - Deploy fix if code issue

4. **Monitor recovery**
   - Set up temporary alert for this metric
   - Check every 5 minutes
   - Declare resolved when > 99% for 15 min

---

## LOW: Memory Usage Exceeds 80%

**Detection**: Metrics show `memory_usage > 80%` for 10+ minutes

### Steps

```bash
# 1. Identify memory consumer
ps aux | sort -k6 -rh | head

# 2. Clear cache (non-destructive)
curl -X POST https://192.168.29.142:5050/api/cache/clear

# 3. Force garbage collection
# (if supported)
curl -X POST https://192.168.29.142:5050/api/gc

# 4. Restart if still high
systemctl restart fleetpro-notifications

# 5. Monitor after restart
watch -n 5 'free -h | grep Mem'
```

---

## Queue Backlog Growing

**Detection**: `queue_depth > 1000` for sustained period

### Analysis

```bash
# Check email queue
mongosh --eval "db.email_queue.find({status: 'queued'}).count()"

# Check SMS queue
mongosh --eval "db.sms_queue.find({status: 'queued'}).count()"

# Check creation time vs now
mongosh --eval "db.email_queue.findOne({status: 'queued'}, {createdAt: 1})"
```

### Fix

**If queue is growing and not processing:**

```bash
# 1. Check if processor is running
ps aux | grep "notification.*queue"

# 2. Check for errors in processing
journalctl -u fleetpro-notifications -p err

# 3. Restart queue processor
systemctl restart fleetpro-notifications

# 4. Monitor queue drain
watch -n 5 'mongosh --eval "db.email_queue.countDocuments({status: \"queued\"})"'
```

**If queue is huge (> 50K):**

```bash
# Restart with increased concurrency
QUEUE_BATCH_SIZE=500 systemctl restart fleetpro-notifications

# Or process in parallel
mongosh << 'EOF'
db.email_queue.updateMany(
  {status: 'queued', processedAt: {$exists: false}},
  {$set: {status: 'processing'}},
  {limit: 10000}
)
EOF
```

---

## Database Latency Spike

**Detection**: Query response time > 500ms consistently

### Investigation

```bash
# 1. Check active connections
mongosh --eval "db.serverStatus().connections"

# 2. Check slow queries
mongosh --eval "db.setProfilingLevel(1, {slowms: 100})"
sleep 60
mongosh --eval "db.system.profile.find().sort({ts:-1}).limit(10).pretty()"

# 3. Check index usage
mongosh --eval "db.notification_events.aggregate([{$indexStats: {}}])"
```

### Fix

```bash
# 1. Kill slow queries (if any)
mongosh --eval "db.currentOp()" | grep "op.*COMMAND"

# 2. Restart MongoDB if locked
sudo systemctl restart mongod

# 3. Rebuild indexes
npm run create-indexes

# 4. Scale connection pool
# Update MONGODB_MAX_POOL_SIZE in .env
# Restart service
```

---

## Data Integrity Issue

**Detection**: Unexpected behavior, data mismatches, or inconsistencies

### IMMEDIATE ACTIONS

1. **STOP** - Do not make changes until root cause understood
2. **ISOLATE** - Prevent further writes if possible
3. **ASSESS** - Determine scope of impact
4. **NOTIFY** - Alert CTO and DBA immediately

### Investigation

```bash
# 1. Verify data consistency
mongosh --eval "db.notification_events.countDocuments()"
mongosh --eval "db.notification_preferences.countDocuments()"

# 2. Check for orphaned records
mongosh --eval "
  db.notification_events.aggregate([
    {$lookup: {from: 'users', localField: 'userId', foreignField: '_id', as: 'user'}},
    {$match: {user: {$eq: []}}}
  ])
"

# 3. Verify recent changes
git log --oneline -20
mongosh --eval "db.audit_logs.find({}, {action: 1, timestamp: 1}).sort({timestamp: -1}).limit(50)"
```

### Recovery

1. **If recent deployment caused issue**
   - Rollback immediately (see rollback procedure)
   - Restore database from pre-deployment backup

2. **If data corruption**
   - Isolate affected records
   - Contact DBA for recovery strategy
   - May require manual data correction

3. **If partial loss**
   - Restore from last known-good backup
   - Accept data loss window as SLA impact
   - Implement safeguards to prevent recurrence

---

## Post-Incident Procedures

### Immediate (within 1 hour)

- [ ] Incident declared resolved in #incidents
- [ ] Brief status update to stakeholders
- [ ] Temporary fix verified and monitoring enabled
- [ ] On-call handoff (if shift change)

### Short-term (within 24 hours)

- [ ] Root cause identified
- [ ] Permanent fix implemented
- [ ] Fix tested in dev/staging
- [ ] Fix deployed to production
- [ ] Monitoring confirms resolution

### Medium-term (within 1 week)

- [ ] Post-incident review meeting scheduled
- [ ] Timeline documented
- [ ] Root cause analysis completed
- [ ] Action items assigned
- [ ] Prevention measures implemented
- [ ] Documentation updated

### Long-term

- [ ] Incident review completed
- [ ] All action items closed
- [ ] Monitoring rules updated
- [ ] Runbooks updated based on learnings
- [ ] Team training on prevention
- [ ] Post-mortem shared with team

---

## Escalation Levels

### Level 1: On-Call Engineer (0-15 min)
- Investigate issue
- Implement immediate fix
- Monitor recovery
- Update #incidents channel

### Level 2: Team Lead (5-30 min)
- If on-call engineer can't resolve
- Approve rollback decision
- Coordinate team response

### Level 3: CTO (15+ min)
- If service down > 15 minutes
- If data loss suspected
- Approve major remediation steps
- Stakeholder communication

### Level 4: Incident Commander (ongoing)
- If incident > 1 hour
- If widespread impact
- Executive communication
- Customer notification

---

## Prevention Checklist

After each incident:

- [ ] Alert threshold review (too sensitive? too loose?)
- [ ] Runbook update (was it helpful?)
- [ ] Monitoring improvement (did we catch it faster?)
- [ ] Documentation update (will next on-call know what to do?)
- [ ] Code quality review (could this have been prevented?)
- [ ] Load test (are we ready for scale?)
- [ ] Chaos engineering test (did chaos monkey find this?)

---

**Questions?** Contact [on-call team] or post in #incidents

**Last incident**: [Date]  
**Avg resolution time**: [X minutes]  
**MTTR trend**: [Improving / Stable / Degrading]
