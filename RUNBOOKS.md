# FleetPro 360° - Runbooks

## Runbook 1: Emergency Server Restart

### Scenario
Server crashed or unresponsive

### Steps
1. Verify server is down: `ps aux | grep node`
2. Kill any zombie processes: `lsof -ti :5050 | xargs kill -9`
3. Wait 5 seconds: `sleep 5`
4. Check database: `mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"`
5. Start server: `npm run start`
6. Wait 10 seconds for startup
7. Verify: `curl http://localhost:5050/api/csrf-token`
8. Check logs: `tail -20 /tmp/fleetpro-deployment.log`

**Expected**: API returns csrfToken, no errors in logs

---

## Runbook 2: Database Recovery

### Scenario
Database corrupted or unavailable

### Steps
1. Stop server: `lsof -ti :5050 | xargs kill -9`
2. Check MongoDB: `mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"`
3. If not responsive, restart MongoDB service
4. Verify database exists: `mongo 127.0.0.1:27017 --eval "db.getName()"`
5. If missing, restore from backup: `mongorestore --db fleetpro /backup/fleetpro/db-YYYYMMDD-HHMMSS`
6. Start server: `npm run start`
7. Verify: `curl http://localhost:5050/api/csrf-token`

**Expected**: Database accessible, server running

---

## Runbook 3: Memory Leak Investigation

### Scenario
Server consuming excessive memory

### Steps
1. Check current memory: `ps aux | grep "node.*index" | awk '{print $6 " KB"}'`
2. If > 1GB, restart server:
   - `lsof -ti :5050 | xargs kill -9`
   - `sleep 5`
   - `npm run start`
3. Monitor memory over time: `watch -n 5 'ps aux | grep "node.*index" | awk "{print $6}"'`
4. If memory keeps growing, check logs for errors
5. Look for specific endpoints causing issues
6. If unresolved, escalate to development team

**Expected**: Memory stabilizes after restart

---

## Runbook 4: API Performance Issues

### Scenario
API responding slowly (> 1 second)

### Steps
1. Check server load: `top -b -n 1 | grep node`
2. Check database queries: 
   ```bash
   mongo 127.0.0.1:27017/fleetpro --eval "db.system.profile.find().limit(5).sort({millis: -1}).pretty()"
   ```
3. Check network connectivity: `ping 127.0.0.1`
4. If CPU is high, restart server
5. If database is slow, optimize indexes
6. Monitor response times: `curl -w "Time: %{time_total}s\n" http://localhost:5050/api/csrf-token`

**Expected**: Response time < 100ms, CPU < 50%

---

## Runbook 5: Backup & Restore

### Scenario
Need to backup or restore data

### Backup Steps
1. Create backup directory: `mkdir -p /backup/fleetpro-$(date +%Y%m%d)`
2. Backup database: `mongodump --db fleetpro --out /backup/fleetpro-$(date +%Y%m%d)/db`
3. Backup code: `tar -czf /backup/fleetpro-$(date +%Y%m%d)/code.tar.gz /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main`
4. Verify backups: `ls -lah /backup/fleetpro-$(date +%Y%m%d)/`

### Restore Steps
1. Stop server: `lsof -ti :5050 | xargs kill -9`
2. Restore database: `mongorestore --db fleetpro /backup/fleetpro-YYYYMMDD/db`
3. Restore code (optional): `tar -xzf /backup/fleetpro-YYYYMMDD/code.tar.gz -C /`
4. Start server: `npm run start`
5. Verify: `curl http://localhost:5050/api/csrf-token`

**Expected**: Data restored, server operational

