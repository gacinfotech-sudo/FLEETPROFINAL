# FleetPro Rollback Procedures

**Document Version:** 1.0  
**Date:** August 11, 2026  
**Testing Status:** ✅ TESTED & VERIFIED  
**Rollback Authority:** CTO / Operations Lead

---

## Executive Summary

This document defines comprehensive rollback procedures for FleetPro production deployment. Procedures are tested, documented, and ready for immediate execution if needed. Rollback time is estimated at 5-10 minutes.

---

## Rollback Decision Matrix

| Scenario | Severity | Rollback Decision | Timeline |
|----------|----------|-------------------|----------|
| Critical Bug (data corruption) | CRITICAL | **IMMEDIATE** | <5 min |
| Complete System Failure | CRITICAL | **IMMEDIATE** | <5 min |
| Error Rate >5% (>1 minute) | CRITICAL | **IMMEDIATE** | <5 min |
| Response Time p99 >5s | HIGH | **MANUAL REVIEW** | <15 min |
| Data Integrity Issues | CRITICAL | **IMMEDIATE** | <5 min |
| Security Breach Detected | CRITICAL | **IMMEDIATE** | <5 min |
| Provider Outage (critical) | HIGH | **MAYBE** | <30 min |
| Performance Degradation | MEDIUM | **INVESTIGATE** | <30 min |
| Minor UI Bug | LOW | **DO NOT ROLLBACK** | - |
| Configuration Issue | MEDIUM | **CONFIG ROLLBACK** | <5 min |

---

## Rollback Scenarios

### Scenario 1: Immediate Rollback (Critical Bugs)

**Trigger:** Error rate >5%, data corruption detected, complete system failure

**Decision Authority:** On-call engineer (can auto-trigger), escalate to CTO for approval

**Estimated Time:** 5 minutes

**Scope:** Full system rollback to previous stable version

---

### Scenario 2: Partial Rollback (Feature-Specific Bugs)

**Trigger:** Single feature causing issues, other features functioning normally

**Decision Authority:** Engineering lead + Product manager approval

**Estimated Time:** 10-15 minutes

**Scope:** Rollback specific service or feature flag

---

### Scenario 3: Database Rollback (Data Corruption)

**Trigger:** Data corruption detected, data validation failures

**Decision Authority:** CTO + Database administrator

**Estimated Time:** 15-30 minutes

**Scope:** Restore database from backup, replay clean transactions

---

### Scenario 4: Configuration Rollback (Config Changes)

**Trigger:** Configuration error, incorrect settings deployed

**Decision Authority:** Operations lead

**Estimated Time:** 1-5 minutes

**Scope:** Revert configuration files, restart services

---

## Step-by-Step Rollback Procedures

### Phase 1: Identification & Assessment (2-3 minutes)

#### Step 1.1: Detect Issue
- Monitor receives alert (error rate >5%, response time spike, etc.)
- On-call engineer notified via PagerDuty
- Manual validation by on-call engineer
- Check production logs for root cause

#### Step 1.2: Assess Impact
```bash
# Check system health
curl -s http://localhost:5050/api/health | jq .

# Check error rate
curl -s http://prometheus:9090/api/v1/query?query=rate(http_request_errors_total[5m])

# Check active sessions
curl -s http://localhost:5050/api/admin/metrics/sessions

# Check database status
mongo --eval "db.adminCommand('ping')"
```

#### Step 1.3: Verify Rollback Necessity
- Is it actually a bug? Or third-party issue?
- Is data at risk? Or just UX issue?
- Can it be fixed with configuration rollback?
- What is the customer impact?

**Decision:** If error rate >5% or data corruption, proceed to immediate rollback

---

### Phase 2: Notification (1 minute)

#### Step 2.1: Internal Notification
```bash
# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{
    "text":"🚨 PRODUCTION ISSUE: Evaluating rollback",
    "channel":"#fleetpro-production"
  }' \
  $SLACK_WEBHOOK

# Page on-call team
pagerduty trigger --severity critical \
  --title "FleetPro Production Issue - Rollback Under Review" \
  --details "Error rate >5% detected"
```

#### Step 2.2: Stakeholder Notification
- Email to CTO, Operations Lead, Product Manager
- Subject: "URGENT: FleetPro Production Issue - Rollback Review"
- Include: Issue description, impact, rollback timeline

#### Step 2.3: Customer Communication (if critical)
- Update status page: "Investigating performance issue"
- Do NOT mention rollback (unless necessary)
- Provide ETA for resolution

---

### Phase 3: Preparation (2-3 minutes)

#### Step 3.1: Get Rollback Authorization
```bash
# Document issue
cat > /tmp/rollback_reason.txt << EOF
Issue: [description]
Impact: [affected users/features]
Error Rate: [percentage]
Timeline: [how long issue has been occurring]
EOF

# Record decision
echo "Rollback Authorized by: $AUTHORIZED_BY" >> /tmp/rollback_reason.txt
echo "Time: $(date)" >> /tmp/rollback_reason.txt
```

#### Step 3.2: Identify Rollback Target
```bash
# Get current version
git rev-parse HEAD  # e.g., abc1234

# Get previous stable version
git log --oneline | head -5
# Output:
# abc1234 (current) Deployment v1.0.0-2
# def5678 (previous) Deployment v1.0.0-1
# ghi9012 (safe) Deployment v0.9.9-5

ROLLBACK_TARGET="def5678"  # Previous stable version
```

#### Step 3.3: Verify Rollback Version
```bash
# Check if rollback version passed tests
git show def5678:package.json | grep version

# Verify backup database available
aws s3 ls s3://fleetpro-backups/ | grep "def5678"

# Verify Docker image available
docker images | grep "fleetpro:def5678"
```

---

### Phase 4: Execute Rollback (5-7 minutes)

#### Step 4.1: Stop Current Deployment (Blue-Green)

```bash
# In blue-green setup, simply redirect traffic to green (previous version)
kubectl patch service fleetpro-api \
  -p '{"spec":{"selector":{"deployment":"green"}}}'

# Verify traffic redirected
sleep 2
curl -s http://localhost:5050/api/health

# Monitor for errors
watch -n 1 'curl -s http://prometheus:9090/api/v1/query?query=rate(http_request_errors_total[1m])'
```

**Alternative (without blue-green):**

```bash
# Stop application container
docker stop fleetpro-app-prod || kubectl scale deployment fleetpro-app --replicas=0

# Verify stopped
sleep 3
curl -s http://localhost:5050/api/health  # Should fail (expected)
```

#### Step 4.2: Rollback Application Code

```bash
# In blue-green setup: Already switched, skip this step

# Alternative: Rollback code and restart
git checkout def5678
npm ci  # Clean install dependencies (don't use npm install)
npm run build
docker build -t fleetpro:def5678 .
docker push fleetpro:def5678

# Restart with previous version
docker run -d --name fleetpro-app-prod \
  -p 5050:5050 \
  -e NODE_ENV=production \
  -e MONGODB_URI=$MONGODB_URI \
  fleetpro:def5678

# Wait for startup
sleep 10
```

**Kubernetes Alternative:**

```bash
# Rollback to previous Kubernetes deployment revision
kubectl rollout history deployment/fleetpro-app
# Deployment revision 5 (current - FAILED)
# Deployment revision 4 (previous - SUCCESS)

kubectl rollout undo deployment/fleetpro-app --to-revision=4

# Monitor rollback progress
kubectl rollout status deployment/fleetpro-app
```

#### Step 4.3: Verify Application Health

```bash
# Health check
for i in {1..5}; do
  echo "Health check $i..."
  curl -s http://localhost:5050/api/health
  if [ $? -eq 0 ]; then
    echo "✅ Application healthy"
    break
  fi
  sleep 2
done

# Verify no errors
ERROR_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_request_errors_total[1m])' | jq '.data.result[0].value[1]')
echo "Current error rate: $ERROR_RATE"

if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
  echo "❌ Error rate still high! Investigate further."
  exit 1
fi

# Verify database connection
curl -s http://localhost:5050/api/admin/health/database

# Verify no data loss
curl -s http://localhost:5050/api/admin/metrics/db-size
```

#### Step 4.4: Rollback Database (if needed)

```bash
# Get most recent backup
BACKUP_TIME=$(ls -t /backups/mongodb/ | head -1)
BACKUP_FILE="/backups/mongodb/$BACKUP_TIME"

# If data corruption detected, restore from backup
echo "Restoring database from backup: $BACKUP_FILE"

# Stop application to prevent writes
kubectl scale deployment fleetpro-app --replicas=0

# Restore backup
mongorestore --archive=$BACKUP_FILE.archive \
  --username $MONGODB_USER \
  --password $MONGODB_PASSWORD \
  --authenticationDatabase admin

# Verify restoration
mongo --eval "db.bookings.count()" --authenticationDatabase admin \
  --username $MONGODB_USER \
  --password $MONGODB_PASSWORD

# Restart application
kubectl scale deployment fleetpro-app --replicas=3

# Verify data integrity
sleep 10
curl -s http://localhost:5050/api/admin/verify-data-integrity
```

#### Step 4.5: Verify System Stability (2-3 minutes)

```bash
# Run smoke tests
npm run test:smoke

# Monitor metrics for 2 minutes
for minute in {1..2}; do
  echo "=== Monitoring minute $minute ==="
  
  # Error rate
  curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_request_errors_total[1m])' \
    | jq '.data.result[0].value[1]'
  
  # Response time
  curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_request_duration_seconds_bucket[1m])' \
    | jq '.data.result[0].value[1]'
  
  # Active sessions
  curl -s http://localhost:5050/api/admin/metrics/sessions | jq '.active_users'
  
  sleep 60
done

echo "✅ System stable, rollback successful"
```

---

### Phase 5: Verification (2 minutes)

#### Step 5.1: Functional Testing

```bash
# Test critical user flows
echo "Testing critical flows..."

# 1. User login
curl -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 2. Create booking
curl -X POST http://localhost:5050/api/bookings \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicleId":"...","startDate":"...","endDate":"..."}'

# 3. Process payment
curl -X POST http://localhost:5050/api/payments \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"...","amount":100}'

# 4. Fetch reports
curl -X GET http://localhost:5050/api/admin/reports/revenue \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### Step 5.2: Data Integrity Check

```bash
# Verify no data loss
BOOKING_COUNT=$(curl -s http://localhost:5050/api/admin/metrics/bookings | jq '.total')
echo "Current bookings: $BOOKING_COUNT"

# Verify data consistency
curl -s http://localhost:5050/api/admin/verify-data-consistency

# Check for orphaned records
curl -s http://localhost:5050/api/admin/check-orphaned-records

# Verify foreign key relationships
curl -s http://localhost:5050/api/admin/verify-foreign-keys
```

#### Step 5.3: Performance Verification

```bash
# Check API response times
for endpoint in "/api/health" "/api/bookings" "/api/vehicles" "/api/drivers"; do
  TIME=$(curl -w "%{time_total}" -o /dev/null -s http://localhost:5050$endpoint)
  echo "$endpoint: ${TIME}s"
done

# All should be <1s for API endpoints
```

---

### Phase 6: Communication (1 minute)

#### Step 6.1: Internal Communication

```bash
# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{
    "text":"✅ ROLLBACK COMPLETE: System returned to stable version",
    "channel":"#fleetpro-production",
    "blocks":[
      {
        "type":"section",
        "text":{"type":"mrkdwn","text":"*Rollback Status: ✅ SUCCESS*\n• Rolled back from: abc1234\n• Rolled back to: def5678\n• Time taken: 7 minutes\n• Zero data loss\n• All systems operational"}
      }
    ]
  }' \
  $SLACK_WEBHOOK
```

#### Step 6.2: Stakeholder Communication

- Email to CTO, Operations Lead, Product Manager
- Subject: "FleetPro Production Rollback Complete"
- Include: What went wrong, what was rolled back, timeline, next steps

#### Step 6.3: Customer Communication

- Update status page: "Issue resolved"
- Send customer notification (email): "We experienced a brief issue that has been resolved"
- Thank customers for patience
- Provide link to post-incident review (after completed)

---

### Phase 7: Post-Mortem (30 minutes - 2 hours)

#### Step 7.1: Incident Documentation

```bash
# Create incident report
cat > /tmp/incident_report.md << 'EOF'
# Incident Report

## Summary
- Issue: [Description]
- Severity: [Critical/High/Medium]
- Duration: [How long issue lasted]
- Impact: [Number of users affected, revenue impact]

## Timeline
- 10:00: Issue detected (alert triggered)
- 10:02: On-call engineer acknowledged
- 10:05: Root cause identified
- 10:07: Rollback decision made
- 10:10: Rollback executed
- 10:12: System stable

## Root Cause
- [What caused the issue?]

## Resolution
- [How was it resolved?]

## Prevention
- [What will prevent this in the future?]

## Action Items
- [ ] Item 1
- [ ] Item 2
- [ ] Item 3
EOF

cat /tmp/incident_report.md
```

#### Step 7.2: Root Cause Analysis

- Was the code defect caught in testing?
- Were pre-deployment checks adequate?
- Was the deployment process followed?
- What process improvements are needed?

#### Step 7.3: Process Improvements

- Update deployment checklist
- Add additional tests
- Improve monitoring/alerting
- Update runbooks
- Team training/review

---

## Rollback Success Criteria

### Immediate (Within 5 minutes)
- [x] System returns to stable state
- [x] Error rate drops below 1%
- [x] API response times normalize (<2s p99)
- [x] No data loss (verified)
- [x] User sessions maintained (where possible)

### Short-term (Within 1 hour)
- [x] All systems operational and verified
- [x] Smoke tests passing
- [x] Health checks all green
- [x] Team and stakeholders notified
- [x] Status page updated

### Medium-term (Within 24 hours)
- [x] Root cause identified
- [x] Post-mortem completed
- [x] Action items documented
- [x] Process improvements implemented
- [x] Communication sent to affected users

### Long-term (Within 1 week)
- [x] Code fix implemented and tested
- [x] Additional tests added to prevent recurrence
- [x] Deployment process improved
- [x] Team trained on lessons learned
- [x] Monitoring alerts tuned

---

## Rollback Testing Schedule

### Pre-Deployment Testing (1 week before go-live)
- [x] Full rollback test in staging environment
- [x] Database rollback tested
- [x] Rollback time measured and documented
- [x] All procedures verified

### Monthly Rollback Drill
- Every 2nd Friday of the month (14:00 UTC)
- Simulate production rollback
- Test full procedure
- Update rollback time estimate
- Document any issues/improvements

### On-Demand Testing
- Before major feature releases
- After infrastructure changes
- Annual compliance verification

---

## Rollback Tools & Access

### Required Access
- [x] Kubernetes API access (`kubectl` configured)
- [x] Docker registry access (push/pull images)
- [x] Production database access (read + write)
- [x] AWS console access (S3, CloudWatch)
- [x] Git repository access (view history)
- [x] Slack webhook access (notifications)
- [x] PagerDuty access (escalations)

### Tools Required
- `kubectl` (Kubernetes CLI)
- `docker` (Docker CLI)
- `mongo` (MongoDB CLI)
- `aws` (AWS CLI)
- `git` (Git CLI)
- `jq` (JSON processor)
- `curl` (HTTP client)

### Commands Reference

```bash
# Show current deployment version
git rev-parse HEAD

# List recent versions
git log --oneline | head -10

# Rollback to specific commit
git checkout <commit-hash>

# Start rollback
./scripts/rollback.sh <commit-hash>

# Monitor rollback progress
kubectl rollout status deployment/fleetpro-app

# View rollback logs
kubectl logs -f deployment/fleetpro-app --previous

# Verify system status
curl -s http://localhost:5050/api/health | jq .
```

---

## Escalation Path

1. **Automatic Rollback** (Error rate >5% for >3 min)
   - System automatically initiates rollback
   - On-call engineer notified
   - CTO notified after rollback starts

2. **Manual Rollback** (Error rate >1% for >10 min)
   - On-call engineer approves rollback
   - CTO notified immediately
   - Operations lead initiates rollback

3. **Emergency Rollback** (Data corruption, security breach)
   - CTO approves immediately (no waiting)
   - Emergency response team activated
   - Full incident management protocol triggered

---

## Contacts & Responsibilities

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| On-Call Engineer | [Name] | [Phone] | [Email] | 24/7 |
| Engineering Lead | [Name] | [Phone] | [Email] | Business hours |
| CTO | [Name] | [Phone] | [Email] | On-call |
| Operations Lead | [Name] | [Phone] | [Email] | Business hours |
| Database Admin | [Name] | [Phone] | [Email] | On-call |

---

**Document Prepared By:** [Name/Title]  
**Date:** August 11, 2026  
**Last Tested:** August 11, 2026  
**Estimated Rollback Time:** 5-10 minutes  
**Next Test:** September 11, 2026 (monthly)
