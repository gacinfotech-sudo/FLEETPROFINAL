# FleetPro 360° - Maintenance Guide

## Regular Maintenance Tasks

### Daily Checks (Morning)
- [ ] Server running: `ps aux | grep node`
- [ ] API responding: `curl http://localhost:5050/api/csrf-token`
- [ ] Database connected: Check logs
- [ ] Memory usage normal: `ps aux | grep node | awk '{print $6}'`

### Weekly Maintenance
- [ ] Full backup created
- [ ] Error logs reviewed
- [ ] Database indexes optimized
- [ ] Disk space sufficient (> 10GB free)

### Monthly Maintenance
- [ ] Database cleanup/archival
- [ ] Performance baseline recorded
- [ ] Security patches applied
- [ ] Documentation updated

---

## Database Maintenance

### Optimize Collections
```bash
mongo 127.0.0.1:27017/fleetpro --eval "
  db.Booking.createIndex({ tenantId: 1, status: 1 });
  db.Customer.createIndex({ tenantId: 1, email: 1 });
  db.Driver.createIndex({ tenantId: 1, status: 1 });
  db.Vehicle.createIndex({ tenantId: 1, status: 1 });
"
```

### Remove Old Data (Monthly)
```bash
mongo 127.0.0.1:27017/fleetpro --eval "
  db.Booking.deleteMany({ status: 'cancelled', createdAt: { \$lt: new Date(Date.now() - 90*24*60*60*1000) } })
"
```

---

## Performance Tuning

### Enable Query Profiling
```bash
mongo 127.0.0.1:27017/fleetpro --eval "db.setProfilingLevel(1)"
```

### Check Slow Queries
```bash
mongo 127.0.0.1:27017/fleetpro --eval "db.system.profile.find().limit(5).sort({millis: -1}).pretty()"
```

---

## Backup Strategy

### Automated Backup Script
```bash
#!/bin/bash
BACKUP_DIR="/backup/fleetpro"
DATE=$(date +%Y%m%d-%H%M%S)

# Backup database
mongodump --db fleetpro --out $BACKUP_DIR/db-$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

### Restore from Backup
```bash
mongorestore --db fleetpro /backup/fleetpro/db-YYYYMMDD-HHMMSS
```

---

## Monitoring Checklist

- [ ] Server CPU < 50%
- [ ] Server Memory < 500MB
- [ ] API response time < 100ms
- [ ] Error rate < 0.1%
- [ ] Database size growing normally
- [ ] Backups completing successfully
- [ ] No security alerts
- [ ] Git hooks working

---

## Troubleshooting Flowchart

```
Problem: Server not responding
├─ Check if running: ps aux | grep node
├─ Check port: lsof -i :5050
├─ Check logs: tail /tmp/fleetpro-deployment.log
└─ Restart: npm run start

Problem: High memory usage
├─ Monitor: watch ps aux | grep node
├─ Restart server
└─ Check for memory leaks in logs

Problem: Database errors
├─ Check connection: mongo --version
├─ Verify database exists
├─ Check indexes: db.getIndexes()
└─ Restore from backup if needed

Problem: API errors
├─ Check authentication
├─ Verify CSRF token
├─ Review error logs
└─ Check database connectivity
```

---

## Version Control

### Current Version
- FleetPro: 1.0.0
- API: 1.0
- Build: 1.2 MB
- Node: v24.18.0
- MongoDB: 4.x+

### Update Checklist
- [ ] Backup current state
- [ ] Stop server
- [ ] Pull latest changes
- [ ] Run npm install
- [ ] Run npm run build
- [ ] Verify tests
- [ ] Start server
- [ ] Verify API working
- [ ] Check logs

