# FleetPro 360° - Operations Manual

## Server Management

### Start Server
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
npm run start
# Server starts on port 5050
```

### Stop Server
```bash
lsof -ti :5050 | xargs kill -9
```

### Check Server Status
```bash
ps aux | grep "node.*index" | grep -v grep
# Should show: node dist/index.js
```

### View Live Logs
```bash
tail -f /tmp/fleetpro-deployment.log
```

---

## Database Operations

### Connect to MongoDB
```bash
mongo 127.0.0.1:27017/fleetpro
```

### Check Database Size
```bash
mongo 127.0.0.1:27017/fleetpro --eval "db.stats()"
```

### Backup Database
```bash
mongodump --db fleetpro --out /backup/fleetpro-$(date +%Y%m%d)
```

### Restore Database
```bash
mongorestore --db fleetpro /backup/fleetpro-YYYYMMDD
```

---

## Common Operations

### Restart Server
```bash
lsof -ti :5050 | xargs kill -9
sleep 2
npm run start
```

### Verify API is Working
```bash
curl http://localhost:5050/api/csrf-token
# Should return: {"csrfToken": "..."}
```

### Check Recent Logs
```bash
tail -100 /tmp/fleetpro-deployment.log | grep ERROR
```

### Monitor Performance
```bash
# Check memory usage
ps aux | grep "node.*index" | grep -v grep | awk '{print $6" KB"}'

# Check CPU usage
ps aux | grep "node.*index" | grep -v grep | awk '{print $3"%"}'
```

---

## Troubleshooting

### Server won't start
1. Check if port :5050 is in use: `lsof -i :5050`
2. Kill any existing process: `lsof -ti :5050 | xargs kill -9`
3. Verify MongoDB is running: `mongo --version`
4. Check logs: `cat /tmp/fleetpro-deployment.log | tail -20`

### API returning 401
- Normal for authenticated endpoints
- Ensure you're sending CSRF token
- Check if session is valid

### Database connection failing
- Verify MongoDB is running: `ps aux | grep mongod`
- Check connection string in .env
- Ensure database 'fleetpro' exists

### High memory usage
- Restart server: `npm run start`
- Check for memory leaks in logs
- Monitor with: `watch -n 1 'ps aux | grep node'`

---

## Performance Monitoring

### API Response Times
```bash
# Test endpoint speed
time curl http://localhost:5050/api/csrf-token
```

### Database Query Performance
```bash
# Enable profiling in MongoDB
db.setProfilingLevel(1)
db.system.profile.find().pretty()
```

### Memory Metrics
```bash
# Monitor node process
watch -n 1 'ps aux | grep "node.*index"'
```

---

## Security Operations

### Verify Golden UI Lock
```bash
git log --oneline | grep "94844c5"
# Should show the golden commit
```

### Check Git Hooks
```bash
# Verify hooks are executable
ls -la .git/hooks/pre-commit
ls -la .git/hooks/post-merge
```

### Test Pre-commit Hook
```bash
# Attempt to commit UI change (should fail)
echo "test" > client/src/test.txt
git add client/src/test.txt
git commit -m "test"
# Should fail with UI protection message
```

---

## Backup & Recovery

### Full System Backup
```bash
# Backup code
tar -czf /backup/fleetpro-code-$(date +%Y%m%d).tar.gz .

# Backup database
mongodump --db fleetpro --out /backup/fleetpro-db-$(date +%Y%m%d)
```

### Quick Restore
```bash
# Restore code (if needed)
tar -xzf /backup/fleetpro-code-YYYYMMDD.tar.gz -C .

# Restore database
mongorestore --db fleetpro /backup/fleetpro-db-YYYYMMDD
```

---

## Maintenance Schedule

### Daily
- Check server is running: `ps aux | grep node`
- Check logs for errors: `tail -20 /tmp/fleetpro-deployment.log`
- Monitor memory usage

### Weekly
- Full backup (code + database)
- Review error logs
- Check disk space

### Monthly
- Database optimization: `db.collection.reIndex()`
- Performance analysis
- Security audit

---

## Support Contacts

For issues:
1. Check logs: `/tmp/fleetpro-deployment.log`
2. Read documentation: `DEPLOYMENT-MANIFEST.md`
3. Check API docs: `API-DOCUMENTATION.md`
4. Review protection: `GOLDEN-UI-PROTECTION.md`
