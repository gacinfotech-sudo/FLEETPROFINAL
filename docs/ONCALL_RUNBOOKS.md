# FleetPro On-Call Runbooks

**Purpose:** Quick reference guides for on-call engineers responding to production issues  
**Severity:** Critical Issues (P0/P1)  
**Response Time Target:** < 15 minutes  

---

## Incident Response Procedures

### P0 - Critical Outage (System Down)

**Definition:** API is completely unavailable or all requests failing

**Immediate Actions (0-2 minutes):**
1. [ ] Acknowledge the alert
2. [ ] Check status dashboard: https://status.fleetpro.com
3. [ ] Join war room: Slack channel #fleetpro-incidents
4. [ ] Pull up Grafana: https://grafana.internal/d/fleetpro

**Diagnosis (2-5 minutes):**
```bash
# Check application health
curl -s http://localhost:3000/health | jq .

# Check database connectivity
curl -s http://localhost:3000/ready | jq .

# Check error logs
pm2 logs fleetpro | grep -i error

# Check system resources
ps aux | grep node
top -p $(pidof node)
```

**Resolution Steps:**

**If Application Down:**
```bash
# Check if process is running
pm2 status

# If not running, restart
pm2 restart fleetpro

# Verify health
curl http://localhost:3000/health
```

**If Database Down:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql

# Verify connection
psql -d fleetpro_production -c "SELECT 1;"

# Then restart application
pm2 restart fleetpro
```

**If Both Are Running but API Failing:**
```bash
# Check logs for errors
pm2 logs fleetpro --lines 100

# Check database connections
psql -d fleetpro_production -c "SELECT COUNT(*) FROM pg_stat_activity;"

# If too many connections, kill idle ones
psql -d fleetpro_production -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state='idle' AND query_start < now() - interval '5 minutes';
"

# Restart application
pm2 restart fleetpro
```

**Escalation (>5 minutes unresolved):**
- [ ] Page primary on-call manager
- [ ] Create incident in PagerDuty
- [ ] Notify #fleetpro-incidents
- [ ] Begin rollback procedures

---

### P1 - Major Issue (High Error Rate)

**Definition:** API responding but > 10% of requests failing

**Immediate Actions (0-2 minutes):**
1. [ ] Identify error pattern in Grafana
2. [ ] Check recent deployments in git log
3. [ ] Review error logs

**Diagnosis (2-5 minutes):**
```bash
# Check error rate
curl http://localhost:3000/metrics | grep http_requests_total

# Check database query times
psql -d fleetpro_production -c "
  SELECT query, mean_exec_time 
  FROM pg_stat_statements 
  WHERE mean_exec_time > 1000 
  ORDER BY mean_exec_time DESC 
  LIMIT 5;
"

# Check for long-running transactions
psql -d fleetpro_production -c "
  SELECT pid, usename, query_start, query 
  FROM pg_stat_activity 
  WHERE query_start < now() - interval '1 minute';
"
```

**Resolution Steps:**

**If Recent Deployment:**
```bash
# Check git log
git log --oneline -5

# If bad deployment, rollback
git checkout <previous-stable-tag>
npm run build
pm2 restart fleetpro

# Verify error rate decreased
# Wait 2 minutes and check Grafana
```

**If Slow Queries:**
```bash
# Vacuum and analyze database
psql -d fleetpro_production -c "VACUUM ANALYZE;"

# Restart application with more memory if needed
NODE_OPTIONS=--max-old-space-size=1024 pm2 restart fleetpro
```

**If Database Connection Issue:**
```bash
# Increase pool size temporarily
# Edit .env file
DB_POOL_SIZE=50

# Restart application
pm2 restart fleetpro
```

**Escalation (>10 minutes unresolved):**
- [ ] Page secondary on-call
- [ ] Update Slack #fleetpro-incidents
- [ ] Prepare rollback if needed

---

### P2 - Minor Issue (Some Functionality Affected)

**Definition:** Specific feature failing but core API working

**Diagnosis:**
```bash
# Identify which endpoint is failing
curl -v http://localhost:3000/vehicles/test/compliance

# Check specific error in logs
pm2 logs fleetpro | grep -i "vehicles"

# Check database tables exist
psql -d fleetpro_production -c "\dt vehicles"
```

**Common P2 Issues & Fixes:**

**Missing Endpoint:**
```bash
# Check if endpoint is implemented
git grep "POST /documents"

# If not found, check git log for deletion
git log -p -- "*controller*" | head -100
```

**Database Migration Not Applied:**
```bash
# Check migration status
psql -d fleetpro_production -c "\dt migrations"

# Run missing migrations
psql -d fleetpro_production -f server/migrations/001_vehicle_compliance_schema.sql
```

**Permission/Auth Issue:**
```bash
# Verify JWT_SECRET is set
echo $JWT_SECRET

# Test endpoint with valid token
curl -H "Authorization: Bearer $VALID_TOKEN" \
  http://localhost:3000/vehicles/test/compliance
```

---

## Common Issues & Quick Fixes

### Issue: "Connection refused" Error

```bash
# Step 1: Check database is running
sudo systemctl status postgresql

# Step 2: Check port 5432 is listening
netstat -tulpn | grep 5432

# Step 3: Verify connection parameters
psql -h $DB_HOST -U $DB_USER -d fleetpro_production -c "SELECT 1;"

# Step 4: If failed, restart PostgreSQL
sudo systemctl restart postgresql

# Step 5: Restart application
pm2 restart fleetpro
```

### Issue: "Too Many Connections"

```bash
# Check active connections
psql -d fleetpro_production -c "
  SELECT count(*) as connections,
         state
  FROM pg_stat_activity 
  GROUP BY state;
"

# Kill idle connections
psql -d fleetpro_production -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state='idle' 
  AND state_change < now() - interval '10 minutes';
"

# Increase pool size in .env
# DB_POOL_SIZE=50

# Restart application
pm2 restart fleetpro
```

### Issue: "Out of Memory"

```bash
# Check current memory usage
curl http://localhost:3000/metrics | jq '.memory'

# Increase Node heap size
export NODE_OPTIONS="--max-old-space-size=1024"

# Restart application
pm2 restart fleetpro

# Monitor memory
watch 'curl -s http://localhost:3000/metrics | jq .memory'
```

### Issue: "High Response Times"

```bash
# Step 1: Check what queries are slow
psql -d fleetpro_production -c "
  SELECT query, calls, mean_exec_time 
  FROM pg_stat_statements 
  WHERE mean_exec_time > 100 
  ORDER BY mean_exec_time DESC 
  LIMIT 10;
"

# Step 2: Analyze slow query
psql -d fleetpro_production -c "
  EXPLAIN ANALYZE 
  SELECT * FROM vehicle_documents 
  WHERE tenant_id = 'test' AND status = 'EXPIRED';
"

# Step 3: Create index if needed
psql -d fleetpro_production -c "
  CREATE INDEX IF NOT EXISTS idx_docs_status 
  ON vehicle_documents(tenant_id, status);
"

# Step 4: Vacuum database
psql -d fleetpro_production -c "VACUUM ANALYZE;"
```

### Issue: "401 Unauthorized"

```bash
# Check JWT_SECRET is set
echo $JWT_SECRET

# Generate new token if needed
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'

# Test with new token
curl -H "Authorization: Bearer $NEW_TOKEN" \
  http://localhost:3000/vehicles/test/compliance
```

---

## Escalation Procedures

### Level 1: On-Call Engineer (You)
- [ ] Acknowledge alert within 5 minutes
- [ ] Attempt diagnosis and resolution
- [ ] Update Slack #fleetpro-incidents with status every 5 minutes
- [ ] Escalate to Level 2 if not resolved in 15 minutes

### Level 2: Senior Engineer
- **Contact:** [Name] [Phone]
- [ ] Page senior engineer
- [ ] Share all diagnostic information
- [ ] Prepare for code review/rollback

### Level 3: Platform Lead
- **Contact:** [Manager] [Phone]
- [ ] Page platform lead if Level 2 is involved
- [ ] Prepare for executive notification if production data lost

---

## Post-Incident Actions

After any incident, complete these within 24 hours:

### Immediate (Within 1 Hour)
- [ ] Confirm system is stable
- [ ] Document incident timeline in Slack thread
- [ ] Notify stakeholders
- [ ] Create incident ticket in Jira

### Follow-up (Within 24 Hours)
- [ ] Write incident summary:
  - What failed?
  - When was it detected?
  - What was the root cause?
  - How was it resolved?
  - What will prevent recurrence?
- [ ] Create action items for prevention
- [ ] Schedule post-mortem meeting
- [ ] Update runbooks if needed

### Post-Mortem (Within 1 Week)
- [ ] Team review of incident
- [ ] Assign ownership for prevention items
- [ ] Update documentation
- [ ] Plan implementation of fixes

---

## Useful Commands Reference

### System Health
```bash
# Check application status
pm2 status

# Check application logs
pm2 logs fleetpro

# Check system resources
top
htop
free -h
df -h

# Check port usage
netstat -tulpn | grep 3000
```

### Database Commands
```bash
# Connect to database
psql -d fleetpro_production -U fleetpro_user

# View connections
SELECT * FROM pg_stat_activity;

# View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;

# Kill connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'user';

# Backup database
pg_dump fleetpro_production | gzip > backup.sql.gz

# Restore database
gunzip -c backup.sql.gz | psql fleetpro_production
```

### Application Restart
```bash
# Restart service
pm2 restart fleetpro

# Restart with logs
pm2 restart fleetpro --update-env

# Full restart (stop + start)
pm2 stop fleetpro && pm2 start fleetpro

# Force restart
pm2 kill && pm2 start ecosystem.config.js
```

### Monitoring URLs
- Grafana: https://grafana.internal/d/fleetpro
- Prometheus: https://prometheus.internal
- Status Page: https://status.fleetpro.com
- Application Logs: `pm2 logs fleetpro`
- Database Logs: `/var/log/postgresql/postgresql.log`

---

## Contact Information

### On-Call Rotation
- **Monday-Friday 9-5:**
  - Primary: [Name] [Phone] [Slack]
  - Secondary: [Name] [Phone] [Slack]
- **After Hours & Weekends:**
  - Primary: [Name] [Phone] [Slack]
  - Secondary: [Name] [Phone] [Slack]

### Escalation Contacts
- **Senior Engineer:** [Name] [Phone]
- **Platform Lead:** [Manager] [Phone]
- **VP Engineering:** [Name] [Phone]

### External Contacts
- **AWS Support:** https://console.aws.amazon.com/support
- **Database Host Provider:** [Contact info]
- **Networking Team:** [Contact info]

---

## Quick Reference Card (Print & Post)

```
FLEETPRO ON-CALL QUICK REFERENCE

P0 OUTAGE (API Down):
1. curl http://localhost:3000/health
2. curl http://localhost:3000/ready
3. pm2 logs fleetpro | grep error
4. pm2 restart fleetpro

P1 HIGH ERROR RATE (>10%):
1. curl http://localhost:3000/metrics
2. Check database: psql -d fleetpro_production -c "SELECT 1;"
3. Review git log for recent changes
4. Rollback if needed: git checkout <tag>

ESCALATION:
- 5 min: Update Slack
- 15 min: Page Level 2
- 30 min: Page Level 3

DATABASES:
- Host: [DB_HOST]
- Port: [DB_PORT]
- User: [DB_USER]
- Database: fleetpro_production

MONITORING:
- Grafana: https://grafana.internal/d/fleetpro
- Status: https://status.fleetpro.com
- Logs: pm2 logs fleetpro
```

---

**Last Updated:** 2026-08-11  
**Maintained By:** Platform Team  
**Review Frequency:** Quarterly or after incidents
