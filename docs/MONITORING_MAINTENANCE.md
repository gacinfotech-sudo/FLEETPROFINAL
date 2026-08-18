# FleetPro WAVE 50: Monitoring & Maintenance Guide

## Daily Operations

### Morning Checklist (Start of Day)

```bash
# 1. Check server health
curl -k https://localhost:5050/api/health 2>/dev/null

# 2. Check error rate (last 24h)
grep "ERROR\|FATAL" /var/log/fleetpro/server.log | tail -100 | wc -l

# 3. Check database status
mongosh --eval "db.serverStatus().connections"

# 4. Check active sessions
mongosh --eval "db.refreshTokens.countDocuments({ isRevoked: false })"

# 5. Check draft count
mongosh --eval "db.bookingDrafts.countDocuments({ status: 'in_progress' })"

# 6. Review audit logs
tail -50 /var/log/fleetpro/audit.log
```

### Critical Metrics

**Real-time Monitoring (Update every 5 minutes)**

| Metric | Target | Command |
|--------|--------|---------|
| Server Uptime | 99.9% | `systemctl status fleetpro` |
| Error Rate | < 0.1% | `grep ERROR /var/log/fleetpro/server.log \| wc -l` |
| Response Time | < 100ms | `ab -n 100 https://localhost:5050/api/test` |
| DB Connections | < 100 | `mongosh --eval "db.serverStatus().connections"` |
| Active Sessions | N/A | `mongosh --eval "db.refreshTokens.countDocuments()"` |

---

## Weekly Maintenance

### Database Health Check (Monday)

```bash
#!/bin/bash
# Database Health Check Script

echo "=== Database Health Check ==="
echo "1. Database size:"
mongosh --eval "db.stats()" | grep "dataSize\|indexSize"

echo "2. Collection document counts:"
mongosh --eval "
  print('bookingDrafts: ' + db.bookingDrafts.countDocuments());
  print('refreshTokens: ' + db.refreshTokens.countDocuments());
  print('whatsappSessions: ' + db.whatsappSessions.countDocuments());
  print('users: ' + db.users.countDocuments());
  print('customers: ' + db.customers.countDocuments());
"

echo "3. Index verification:"
mongosh --eval "
  print('bookingDrafts indexes:');
  db.bookingDrafts.getIndexes().forEach(idx => print('  - ' + idx.name));
  print('refreshTokens indexes:');
  db.refreshTokens.getIndexes().forEach(idx => print('  - ' + idx.name));
"

echo "4. Replication status:"
mongosh --eval "rs.status()" | grep -E "name|health|state"

echo "5. Disk usage:"
du -sh /var/lib/mongodb

echo "6. Backup status:"
ls -lh /backup/fleetpro-* | tail -5
```

### Performance Analysis (Wednesday)

```bash
# 1. Slow query log
mongosh --eval "db.getProfilingLevel()"
mongosh --eval "db.setProfilingLevel(1, { slowms: 100 })"
sleep 60
mongosh --eval "db.system.profile.find({ millis: { \$gt: 100 } }).limit(10)"

# 2. Index effectiveness
mongosh <<'MONGO'
db.bookingDrafts.aggregate([
  { $match: { status: "in_progress" } }
]).explain("executionStats")
MONGO

# 3. Query performance
time curl -s -k https://localhost:5050/api/tenant/customers/lookup?mobile=919876543210 > /dev/null
```

### Security Audit (Friday)

```bash
# 1. Review failed login attempts
grep "failed login\|Invalid credentials" /var/log/fleetpro/audit.log | tail -20

# 2. Check for brute force attempts
grep "failed login" /var/log/fleetpro/audit.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -10

# 3. Review revoked tokens
mongosh --eval "
  db.refreshTokens.find({ isRevoked: true }).sort({ revokedAt: -1 }).limit(10)
"

# 4. Check unauthorized access
grep "401\|403" /var/log/fleetpro/server.log | tail -20

# 5. Verify HTTPS certificate
openssl s_client -connect localhost:5050 -showcerts 2>/dev/null | grep "Verify return code"
```

---

## Monthly Maintenance

### Database Optimization (1st of month)

```bash
# 1. Run repair (if corrupted)
mongosh --eval "db.repairDatabase()"

# 2. Rebuild indexes
mongosh <<'MONGO'
db.bookingDrafts.reIndex()
db.refreshTokens.reIndex()
db.whatsappSessions.reIndex()
MONGO

# 3. Analyze database statistics
mongosh <<'MONGO'
print("Collection Statistics:");
const collections = db.getCollectionNames();
collections.forEach(collection => {
  const stats = db[collection].stats();
  print(`${collection}: ${stats.count} docs, ${stats.size} bytes`);
});
MONGO

# 4. Check index efficiency
mongosh --eval "
  db.system.indexes_build.find({}).forEach(idx => print(idx))
"
```

### Data Cleanup (1st of month)

```bash
# 1. Remove expired drafts (TTL should handle this, but verify)
mongosh --eval "
  const expired = db.bookingDrafts.countDocuments({ expiresAt: { \$lt: new Date() } });
  print('Expired drafts: ' + expired);
  if (expired > 0) {
    db.bookingDrafts.deleteMany({ expiresAt: { \$lt: new Date() } });
    print('Deleted expired drafts');
  }
"

# 2. Remove expired tokens
mongosh --eval "
  const expired = db.refreshTokens.countDocuments({ expiresAt: { \$lt: new Date() } });
  print('Expired tokens: ' + expired);
  if (expired > 0) {
    db.refreshTokens.deleteMany({ expiresAt: { \$lt: new Date() } });
    print('Deleted expired tokens');
  }
"

# 3. Remove revoked sessions
mongosh --eval "
  const revoked = db.whatsappSessions.countDocuments({ expiresAt: { \$lt: new Date() } });
  print('Expired sessions: ' + revoked);
  if (revoked > 0) {
    db.whatsappSessions.deleteMany({ expiresAt: { \$lt: new Date() } });
    print('Deleted expired sessions');
  }
"

# 4. Archive old logs
gzip /var/log/fleetpro/server.log.$(date -d "1 month ago" +%Y%m%d)
gzip /var/log/fleetpro/audit.log.$(date -d "1 month ago" +%Y%m%d)
```

### Backup Verification (1st of month)

```bash
# 1. Verify latest backup exists
ls -lh /backup/fleetpro-* | tail -3

# 2. Test restore procedure (to test DB only, not production)
mongodump --uri="mongodb://127.0.0.1:27017/fleetpro" --out=/tmp/test-restore
mongorestore --uri="mongodb://localhost:27018/fleetpro-test" /tmp/test-restore
rm -rf /tmp/test-restore

# 3. Verify backup integrity
# Count documents in backup vs. production
echo "Backup verification: [requires manual check]"

# 4. Test backup recovery time
# Time how long restore takes
time mongorestore --uri="mongodb://localhost:27018/fleetpro-test" /backup/fleetpro-latest
```

---

## Alert Configuration

### Setup Alerts (Using CloudWatch/Datadog/etc.)

```
Alert: Server Down
  Threshold: No response from :5050 for 2 minutes
  Action: Page on-call engineer

Alert: High Error Rate
  Threshold: Error rate > 1% in 5-minute window
  Action: Alert + auto-scale

Alert: Slow Queries
  Threshold: Query takes > 500ms
  Action: Alert, log slow query details

Alert: Database Connection Pool Low
  Threshold: Available connections < 10
  Action: Alert + investigate connections

Alert: Token Cleanup Failure
  Threshold: Expired tokens not cleaned up for 1 hour
  Action: Alert + manual cleanup

Alert: Disk Space Low
  Threshold: MongoDB disk < 10% free
  Action: Page immediately, start cleanup

Alert: Certificate Expiry
  Threshold: Certificate expires in < 30 days
  Action: Alert, renew certificate

Alert: Unusual Login Activity
  Threshold: Failed logins from same IP > 10
  Action: Alert, consider blocking IP
```

---

## Common Maintenance Tasks

### Restart Server (with zero downtime)

```bash
# Option 1: Rolling restart
# Stop one instance, start another, then switch traffic

# Option 2: In-place restart
PORT=5050 npm run dev > /var/log/fleetpro/server.log 2>&1 &

# Wait for startup
sleep 5

# Verify
curl -k https://localhost:5050/api/health

# Kill old process (if applicable)
```

### Scale Database (Add Capacity)

```bash
# 1. Add new MongoDB node to replica set
mongosh --eval "rs.add({ host: 'new-node:27017' })"

# 2. Monitor sync
mongosh --eval "rs.status()"

# 3. Verify all nodes healthy
mongosh --eval "rs.status().members"
```

### Update Dependencies

```bash
# Test update in staging first
npm update

# Run full test suite
npm run build
npm test

# Deploy to production
npm run build
PORT=5050 npm run dev > /var/log/fleetpro/server.log 2>&1 &
```

### Clear Session Cache (Emergency Only)

```bash
# Clear all refresh tokens (all users logged out!)
mongosh --eval "db.refreshTokens.deleteMany({})"

# Clear all booking drafts (data loss!)
mongosh --eval "db.bookingDrafts.deleteMany({})"

# Note: Only use in emergency (data loss)
```

---

## Performance Tuning

### Optimize Phone Lookup Query

```bash
# Current: ~100ms
# Target: < 50ms

# Strategy 1: Add compound index
db.customers.createIndex({ tenantId: 1, primaryMobile: 1 })

# Strategy 2: Cache frequent lookups (app-level)
# Store normalized phone numbers in Redis cache

# Strategy 3: Batch lookups if needed
# Instead of single queries, batch lookup multiple customers
```

### Optimize Draft Save Query

```bash
# Current: ~50ms
# Target: < 25ms

# Strategy 1: Write concern optimization
# Change from acknowledged to acknowledged with journal

# Strategy 2: Batch draft saves
# Collect multiple saves, write in batch

# Strategy 3: Sharding if needed
# Shard by tenantId for high-volume workloads
```

### Optimize Session Refresh

```bash
# Current: ~20ms
# Target: < 10ms

# Strategy 1: Cache tokens in Redis
# Reduce database lookups for token verification

# Strategy 2: JWT blacklist optimization
# Use smaller blacklist with shorter TTL
```

---

## Disaster Recovery

### Complete Server Loss (RTO: 1 hour)

```bash
# 1. Provision new server (5 min)
# 2. Install dependencies (10 min)
#    npm install
# 3. Restore database from backup (10 min)
#    mongorestore --uri="mongodb://..." /backup/fleetpro-latest
# 4. Deploy application (5 min)
#    PORT=5050 npm run dev
# 5. Run health checks (5 min)
# 6. Switch DNS/load balancer (2 min)
# Total: ~40 minutes
```

### Database Corruption (RTO: 30 min)

```bash
# 1. Identify corruption
mongosh --eval "db.collStats('bookingDrafts')"

# 2. Repair collection
mongosh --eval "db.bookingDrafts.validate()"

# 3. Rebuild indexes
mongosh --eval "db.bookingDrafts.reIndex()"

# 4. If unfixable, restore from backup
mongosh --eval "db.dropDatabase()"
mongorestore --uri="mongodb://..." /backup/fleetpro-latest

# 5. Verify data
mongosh --eval "db.bookingDrafts.countDocuments()"
```

### Partial Data Loss (24-hour RPO)

```bash
# 1. Identify what was lost
mongosh --eval "db.bookingDrafts.find({ createdAt: { \$gte: ISODate('2026-08-14') } }).count()"

# 2. Restore from backup
mongorestore --nsInclude='fleetpro.bookingDrafts' --uri="mongodb://..." /backup/fleetpro-latest

# 3. Merge conflicts (manual)
# Determine which version to keep (newest vs. backed up)

# 4. Verify integrity
db.bookingDrafts.validate()
```

---

## Operational Runbooks

### Incident: High CPU Usage

```
1. Check what's running:
   top -b -n 1 | grep node

2. Check slow queries:
   mongosh --eval "db.system.profile.find({}).sort({ ts: -1 }).limit(10)"

3. Kill slow queries (if needed):
   mongosh --eval "db.killOp(<opid>)"

4. Restart service:
   systemctl restart fleetpro

5. Monitor:
   watch -n 1 'top -b -n 1 | grep node'
```

### Incident: Database Down

```
1. Check MongoDB status:
   systemctl status mongod
   journalctl -u mongod -n 50

2. If not running, restart:
   systemctl start mongod

3. Check replica set status:
   mongosh --eval "rs.status()"

4. If primary down, trigger failover:
   mongosh --eval "rs.stepDown()"

5. Verify all nodes in cluster:
   mongosh --eval "rs.status().members"
```

### Incident: Token Refresh Failing

```
1. Check server logs:
   grep "token\|refresh" /var/log/fleetpro/server.log | tail -50

2. Verify refreshTokens collection:
   mongosh --eval "db.refreshTokens.stats()"

3. Check JWT secrets are set:
   echo $JWT_SECRET $REFRESH_SECRET

4. Test refresh manually:
   curl -X POST https://localhost:5050/api/auth/refresh -d '{"refreshToken":"test"}'

5. If issue persists, clear all tokens:
   mongosh --eval "db.refreshTokens.deleteMany({})"
   (Note: All users will be logged out)
```

---

## Documentation & Training

### Team Training Checklist

- [ ] Deployment procedure
- [ ] Rollback procedure
- [ ] How to read logs
- [ ] How to diagnose issues
- [ ] How to scale database
- [ ] How to handle outage
- [ ] Where to find backup
- [ ] How to restore from backup
- [ ] Monitoring dashboard walkthrough
- [ ] Alert escalation procedures

### Knowledge Base

- Architecture diagram
- Data flow diagram
- API documentation
- Database schema
- Service dependencies
- Known limitations
- Performance characteristics

---

## Summary

**Good Practices:**
✅ Monitor daily  
✅ Maintain weekly  
✅ Optimize monthly  
✅ Backup consistently  
✅ Document everything  
✅ Train team regularly  
✅ Test disaster recovery quarterly  
✅ Review logs proactively  

**Avoid:**
❌ Ignoring alerts  
❌ Manual backups only  
❌ Untested rollback procedures  
❌ Deploying without testing  
❌ Ignoring database warnings  
❌ Running out of disk space  
❌ Expired certificates  
❌ Undocumented changes  

---

**Last Updated:** 2026-08-15  
**Next Review:** 2026-09-15

