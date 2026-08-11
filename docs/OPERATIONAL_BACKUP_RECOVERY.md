# FleetPro Backup & Disaster Recovery Guide

**Version:** 2.0  
**Last Updated:** 2026-08-12  
**Status:** Production Ready

---

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Backup Procedures](#backup-procedures)
3. [Recovery Procedures](#recovery-procedures)
4. [Disaster Recovery Plan](#disaster-recovery-plan)
5. [Backup Verification](#backup-verification)

---

## Backup Strategy

### Backup Tiers

**Tier 1: Daily Incremental (Retention: 7 days)**
```
- Frequency: Daily at 2:00 AM UTC
- Size: ~500MB average
- Time to backup: ~5 minutes
- Storage location: Primary backup server
- Cost: ~$5/month
```

**Tier 2: Weekly Full (Retention: 4 weeks)**
```
- Frequency: Sundays at 3:00 AM UTC
- Size: ~10GB full backup
- Time to backup: ~20 minutes
- Storage location: Secondary backup server + cloud
- Cost: ~$20/month
```

**Tier 3: Monthly Archived (Retention: 12 months)**
```
- Frequency: First day of month at 4:00 AM UTC
- Size: ~10GB compressed archive
- Time to backup: ~30 minutes
- Storage location: Cold storage (AWS Glacier)
- Cost: ~$50/month
```

### RPO and RTO

```
Recovery Point Objective (RPO):
- Tier 1 (daily incremental): 24 hours
- Tier 2 (weekly full): 7 days
- Tier 3 (monthly archive): 30 days

Recovery Time Objective (RTO):
- Tier 1 (daily incremental): 4 hours
- Tier 2 (weekly full): 2 hours
- Tier 3 (monthly archive): 24 hours

Acceptable data loss: < 1 hour
Target uptime: 99.9%
```

---

## Backup Procedures

### Automated Daily Backup

```bash
#!/bin/bash
# /usr/local/bin/backup-daily.sh

set -e

BACKUP_DIR="/backups/daily"
DB_NAME="fleetpro_production"
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting daily backup: $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# 1. Dump database
echo "Backing up database..."
mongodump \
  --uri "mongodb://127.0.0.1:27017/$DB_NAME" \
  --archive="$BACKUP_DIR/db-$DATE.archive" \
  --gzip \
  --oplog

# 2. Backup application files
echo "Backing up application files..."
tar -czf "$BACKUP_DIR/app-$DATE.tar.gz" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  /opt/fleetpro

# 3. Backup configuration
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config-$DATE.tar.gz" \
  /etc/nginx/nginx.conf \
  /etc/mongodb.conf \
  .env.production

# 4. Verify backups
echo "Verifying backups..."
ls -lh "$BACKUP_DIR"/db-$DATE.archive
ls -lh "$BACKUP_DIR"/app-$DATE.tar.gz
ls -lh "$BACKUP_DIR"/config-$DATE.tar.gz

# 5. Upload to cloud
echo "Uploading to S3..."
aws s3 cp "$BACKUP_DIR"/db-$DATE.archive \
  s3://fleetpro-backups/daily/db-$DATE.archive \
  --storage-class STANDARD_IA

# 6. Cleanup old backups (keep 7 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "db-*.archive" -mtime +7 -delete
find "$BACKUP_DIR" -name "app-*.tar.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "config-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"

# Send notification
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -d '{
    "text": "Daily backup completed",
    "blocks": [
      {"type": "section", "text": {"type": "mrkdwn", "text": "Date: '$DATE'\nStatus: SUCCESS"}}
    ]
  }'
```

### Manual Backup Procedure

```bash
#!/bin/bash
# Manual backup steps

# 1. Preparation
echo "=== Backup Preparation ==="
# Verify disk space
df -h /backups
# Should have at least 50GB available

# 2. Database backup
echo "=== Database Backup ==="
mongodump \
  --uri "mongodb://127.0.0.1:27017/fleetpro_production" \
  --archive="/backups/manual/db-$(date +%Y%m%d_%H%M%S).archive" \
  --gzip

# 3. Verify backup
echo "=== Verifying Backup ==="
ls -lh /backups/manual/
mongorestore --archive=/backups/manual/db-*.archive --dryRun

# 4. Upload to S3
echo "=== Uploading to S3 ==="
aws s3 cp /backups/manual/ s3://fleetpro-backups/manual/ \
  --recursive \
  --exclude "*" \
  --include "db-*.archive"

echo "Manual backup completed"
```

### Backup Rotation Policy

```bash
#!/bin/bash
# /usr/local/bin/backup-rotation.sh

# Keep most recent:
# - 7 daily backups
# - 4 weekly backups
# - 12 monthly backups
# - Unlimited archived (in Glacier)

BACKUP_DIR="/backups"

# Remove daily backups older than 7 days
find $BACKUP_DIR/daily -name "db-*.archive" -mtime +7 -delete

# Keep only last 4 weekly backups
ls -t $BACKUP_DIR/weekly/db-*.archive | tail -n +5 | xargs rm -f

# Monthly archives are permanent (in Glacier)
# No rotation needed

# Verify remaining backups
echo "Current backups:"
du -sh $BACKUP_DIR/*
```

---

## Recovery Procedures

### Point-in-Time Recovery

```bash
#!/bin/bash
# Recover database to specific point in time

# 1. Identify restore point
echo "=== Available Backups ==="
ls -lh /backups/daily/

# 2. Prepare test environment
TEST_PORT=27018
mongod --port $TEST_PORT --dbpath /var/lib/mongodb-test

# 3. Restore from backup
echo "Restoring from backup..."
mongorestore --archive=/backups/daily/db-20260810.archive \
  --host=localhost:$TEST_PORT \
  --gzip

# 4. Verify restored data
mongosh --port $TEST_PORT --eval "
  db.bookings.countDocuments()
  db.customers.countDocuments()
"

# 5. If correct, switch production to restored data
# CAUTION: This requires downtime!
mongosh --eval "
  db.shutdownServer()
"
sudo cp -r /var/lib/mongodb-test/* /var/lib/mongodb/
sudo systemctl start mongod

echo "Recovery completed"
```

### Full Database Recovery

```bash
#!/bin/bash
# Complete database recovery from backup

# 1. Stop application
systemctl stop fleetpro-app

# 2. Stop MongoDB
sudo systemctl stop mongod

# 3. Backup current data (for analysis)
sudo cp -r /var/lib/mongodb /var/lib/mongodb.corrupted

# 4. Remove corrupted data
sudo rm -rf /var/lib/mongodb/*

# 5. Restore from backup
echo "Restoring database..."
mongorestore --archive=/backups/weekly/db-20260809.archive \
  --gzip \
  --oplog

# 6. Verify restore
mongosh --eval "
  const stats = db.stats()
  console.log('Collections:', stats.collections)
  console.log('Data size:', (stats.dataSize / 1024 / 1024).toFixed(2), 'MB')
"

# 7. Restart application
sudo systemctl start mongod
systemctl start fleetpro-app

# 8. Verify application
curl -s http://localhost:5050/health | jq .

echo "Full recovery completed"
```

### Partial Data Recovery

```bash
#!/bin/bash
# Recover specific collection only

# 1. Restore to temporary database
TEMP_PORT=27019
mongod --port $TEMP_PORT --dbpath /var/lib/mongodb-temp

mongorestore --archive=/backups/daily/db-20260810.archive \
  --host=localhost:$TEMP_PORT \
  --gzip \
  --ns="fleetpro_production.bookings"

# 2. Export specific collection
mongoexport --host=localhost:$TEMP_PORT \
  --db=fleetpro_production \
  --collection=bookings \
  --out=/tmp/bookings-recovered.json

# 3. Restore to production (update only)
mongoimport --uri="mongodb://127.0.0.1:27017/fleetpro_production" \
  --collection=bookings \
  /tmp/bookings-recovered.json \
  --upsert

# 4. Cleanup
kill $(lsof -t -i :$TEMP_PORT)
rm -rf /var/lib/mongodb-temp

echo "Partial recovery completed"
```

---

## Disaster Recovery Plan

### DR Activation Checklist

```markdown
# Disaster Recovery Activation Checklist

## Severity Assessment
- [ ] Confirm production is down (not responding to health checks)
- [ ] Rule out temporary network issues (test from multiple locations)
- [ ] Verify data center is offline (check infrastructure status)
- [ ] Notify on-call VP Engineering

## DR Site Preparation (15 minutes)
- [ ] Verify DR hardware is ready
- [ ] Check DNS can be updated (account access verified)
- [ ] Verify backup files are accessible
- [ ] Test MongoDB port (27017) is open
- [ ] Verify application port (5050) is available

## Data Recovery (30 minutes)
- [ ] Download latest backup from S3
- [ ] Restore to DR MongoDB instance
- [ ] Verify record counts match production
- [ ] Spot check 100 random records for integrity
- [ ] Run reconciliation query

## Application Deployment (20 minutes)
- [ ] Deploy application to DR instance
- [ ] Configure environment variables
- [ ] Update external API endpoints (if needed)
- [ ] Run smoke tests
- [ ] Verify health checks pass

## DNS Failover (5 minutes)
- [ ] Update DNS to point to DR IP
- [ ] Verify DNS propagation
- [ ] Test access from multiple locations
- [ ] Monitor for client connection errors

## Communication (Ongoing)
- [ ] Notify customers of incident
- [ ] Provide regular status updates
- [ ] Establish escalation contacts

## Success Criteria
- [ ] All health checks passing
- [ ] DNS resolving to DR site
- [ ] Sample transactions completing successfully
- [ ] No new errors in logs
```

### Failover Procedure

```bash
#!/bin/bash
# /usr/local/bin/dr-failover.sh

set -e

echo "=== STARTING DR FAILOVER ==="
FAILOVER_TIME=$(date)

# 1. Verify production is down
echo "Step 1: Verifying production is down..."
if curl -s -m 5 http://api.fleetpro.example.com/health > /dev/null 2>&1; then
  echo "ERROR: Production still responding!"
  exit 1
fi
echo "OK: Production is down"

# 2. Restore backup to DR site
echo "Step 2: Restoring backup..."
aws s3 cp s3://fleetpro-backups/weekly/latest.archive /tmp/
mongorestore --archive=/tmp/latest.archive \
  --uri="mongodb://dr-mongodb:27017/fleetpro_production" \
  --gzip

# 3. Verify data integrity
echo "Step 3: Verifying data..."
PROD_COUNT=$(mongosh --host dr-mongodb --eval "
  db.bookings.countDocuments()"
)
echo "Restored $PROD_COUNT bookings"

# 4. Start application on DR
echo "Step 4: Starting application..."
ssh dr-app "cd /opt/fleetpro && \
  PORT=5050 NODE_ENV=production npm run dev &"

# 5. Wait for application startup
sleep 30

# 6. Verify application health
echo "Step 5: Verifying application..."
if ! curl -s -m 5 http://dr-app:5050/health | jq -e '.status == "healthy"' > /dev/null; then
  echo "ERROR: Application not healthy"
  exit 1
fi
echo "OK: Application is healthy"

# 7. Update DNS
echo "Step 6: Updating DNS..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.fleetpro.example.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "dr-app-ip"}]
      }
    }]
  }'

# 8. Verify DNS propagation
echo "Step 7: Verifying DNS..."
for i in {1..30}; do
  IP=$(dig +short api.fleetpro.example.com A | head -1)
  if [ "$IP" = "dr-app-ip" ]; then
    echo "OK: DNS updated ($IP)"
    break
  fi
  echo "Waiting for DNS propagation ($i/30)..."
  sleep 2
done

echo "=== DR FAILOVER COMPLETE ==="
echo "Failover time: $FAILOVER_TIME"
echo "Total duration: $(($(date +%s) - $(date -d "$FAILOVER_TIME" +%s))) seconds"

# Send notification
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -d '{
    "text": "DR FAILOVER COMPLETE",
    "blocks": [
      {"type": "section", "text": {"type": "mrkdwn", "text": ":warning: Production is now running on DR site"}},
      {"type": "section", "text": {"type": "mrkdwn", "text": "Failover time: '$FAILOVER_TIME'"}}
    ]
  }'
```

### Failback Procedure

```bash
#!/bin/bash
# /usr/local/bin/dr-failback.sh

# After production is restored

echo "=== PREPARING FAILBACK ==="

# 1. Verify production is ready
echo "Step 1: Verifying production..."
if ! curl -s http://prod-app:5050/health > /dev/null 2>&1; then
  echo "ERROR: Production not ready"
  exit 1
fi

# 2. Sync data from DR back to production
echo "Step 2: Syncing data..."
# Create backup of DR data
mongodump --uri="mongodb://dr-mongodb:27017/fleetpro_production" \
  --archive=/tmp/dr-latest.archive --gzip

# Restore to production
mongorestore --archive=/tmp/dr-latest.archive \
  --uri="mongodb://prod-mongodb:27017/fleetpro_production" \
  --gzip

# 3. Verify consistency
echo "Step 3: Verifying consistency..."
PROD_COUNT=$(mongosh --host prod-mongodb --eval "db.bookings.countDocuments()")
DR_COUNT=$(mongosh --host dr-mongodb --eval "db.bookings.countDocuments()")

if [ "$PROD_COUNT" != "$DR_COUNT" ]; then
  echo "ERROR: Data mismatch!"
  exit 1
fi

# 4. Update DNS
echo "Step 4: Failing back to production..."
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.fleetpro.example.com",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "prod-app-ip"}]
      }
    }]
  }'

# 5. Verify failback
sleep 30
if ! curl -s http://api.fleetpro.example.com/health > /dev/null 2>&1; then
  echo "ERROR: Failback failed"
  exit 1
fi

echo "=== FAILBACK COMPLETE ==="
```

---

## Backup Verification

### Automated Backup Verification

```bash
#!/bin/bash
# /usr/local/bin/verify-backups.sh

echo "=== Backup Verification Report ==="
DATE=$(date +%Y-%m-%d)

# 1. Check backup file sizes
echo ""
echo "1. Backup file sizes:"
ls -lh /backups/daily/db-*.archive | tail -1
ls -lh /backups/weekly/db-*.archive | tail -1
ls -lh /backups/monthly/db-*.archive | tail -1

# 2. Verify archive integrity
echo ""
echo "2. Verifying archive integrity:"
for archive in /backups/daily/db-*.archive; do
  if tar -tzf "$archive" > /dev/null 2>&1; then
    echo "✓ $archive - OK"
  else
    echo "✗ $archive - CORRUPTED"
  fi
done

# 3. Test restore
echo ""
echo "3. Testing restore (dry-run):"
LATEST_BACKUP=$(ls -t /backups/daily/db-*.archive | head -1)
if mongorestore --archive="$LATEST_BACKUP" --dryRun --gzip 2>&1 | grep -q "100 objects"; then
  echo "✓ Restore test passed"
else
  echo "✗ Restore test failed"
fi

# 4. Verify S3 uploads
echo ""
echo "4. Verifying S3 backups:"
aws s3 ls s3://fleetpro-backups/daily/ --recursive | tail -5

# 5. Check backup age
echo ""
echo "5. Latest backup age:"
LATEST=$(stat -f "%m" /backups/daily/db-*.archive | sort -n | tail -1)
AGE=$(($(date +%s) - LATEST))
HOURS=$((AGE / 3600))
echo "Latest backup is $HOURS hours old"

if [ $HOURS -gt 48 ]; then
  echo "WARNING: Backup is older than 48 hours!"
fi

# 6. Email report
echo ""
echo "=== Report Sent ==="
# Email verification report to ops team
```

### Manual Backup Test

```bash
#!/bin/bash
# Test backup restoration manually

echo "Testing backup restoration..."

# 1. Create test database
TESTDB_PORT=27018
mongod --port $TESTDB_PORT --dbpath /var/lib/mongodb-test &
sleep 5

# 2. Restore backup
echo "Restoring from /backups/daily/db-latest.archive..."
mongorestore --archive=/backups/daily/db-latest.archive \
  --host=localhost:$TESTDB_PORT \
  --gzip

# 3. Run queries
echo ""
echo "Testing data integrity..."
mongosh --port $TESTDB_PORT --eval "
  const db_test = db.getSiblingDB('fleetpro_production');
  
  console.log('Bookings:', db_test.bookings.countDocuments());
  console.log('Customers:', db_test.customers.countDocuments());
  console.log('Drivers:', db_test.drivers.countDocuments());
  
  // Sample checks
  const booking = db_test.bookings.findOne();
  console.log('Sample booking status:', booking?.status);
  
  const customer = db_test.customers.findOne();
  console.log('Sample customer email:', customer?.email);
"

# 4. Cleanup
kill %1
rm -rf /var/lib/mongodb-test

echo "Backup test completed successfully"
```

---

*Last Updated: 2026-08-12 by Operations Team*  
*Next Review: 2026-09-12*  
*Status: ACTIVE AND ENFORCED*
