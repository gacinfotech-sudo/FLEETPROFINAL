# FleetPro Deployment Execution Plan

**Status:** ✅ READY FOR EXECUTION  
**Version:** v1.0.0-production-release  
**Timeline:** 2 weeks (pre-deployment + deployment + post-deployment)  
**Downtime:** None (backward compatible)  
**Rollback Window:** < 15 minutes  

---

## Overview

This document provides step-by-step procedures for deploying FleetPro Fleet Compliance System to production. Follow this guide sequentially. Each section is independent and can be executed on the specified day.

**Recommendation:** Start immediately. This is a 2-week process ending with production go-live.

---

## WEEK 1: PRE-DEPLOYMENT PREPARATION

### DAY 1: Project Kickoff & Planning

**Morning (2 hours)**

- [ ] **Team Meeting (9:00 AM)**
  - Read: EXECUTIVE_HANDOFF.md
  - Read: DELIVERY_SUMMARY.md
  - Duration: 30 minutes
  - Attendees: Project Lead, DevOps, SRE, QA, Product

- [ ] **Assign Roles**
  ```
  Project Lead:       [Name] - Overall coordination
  DevOps Lead:        [Name] - Infrastructure & deployment
  SRE Lead:           [Name] - Monitoring & operations
  Database DBA:       [Name] - Database setup & migration
  QA Lead:            [Name] - Verification & testing
  ```

- [ ] **Review Documentation**
  - PRODUCTION_CHECKLIST.md
  - DEPLOYMENT.md
  - ONCALL_RUNBOOKS.md
  - Duration: 45 minutes

**Afternoon (3 hours)**

- [ ] **Infrastructure Review Meeting (2:00 PM)**
  - Discuss deployment method (Docker/Kubernetes/Standalone)
  - Review hardware requirements
  - Identify any blockers
  - Duration: 45 minutes

- [ ] **Access Verification**
  - [ ] Git repository access
  - [ ] Deployment server access
  - [ ] Database server access
  - [ ] AWS/Cloud console access
  - [ ] Monitoring platform access

- [ ] **Communication Setup**
  - [ ] Create Slack channel: #fleetpro-deployment
  - [ ] Add all team members
  - [ ] Pin important documents
  - [ ] Set up status updates schedule

### DAY 2: Infrastructure Planning

**Morning (3 hours)**

- [ ] **Capacity Planning**
  ```bash
  # Review hardware requirements
  CPU:      2-4 cores recommended
  RAM:      512MB-1GB minimum
  Disk:     10GB for code + 50GB for database
  Network:  1Gbps minimum
  
  # Database sizing
  Max connections: 20-50 pool size
  Storage:         ~50MB initial + growth
  Backup storage:  ~20MB per day
  ```

- [ ] **Choose Deployment Method**
  - [ ] Docker (recommended for dev/test)
  - [ ] Kubernetes (recommended for production)
  - [ ] Standalone (PM2-based)

- [ ] **Environment Configuration**
  Create `.env.production` file:
  ```env
  NODE_ENV=production
  PORT=3000
  
  # Database
  DB_HOST=your-db-host
  DB_PORT=5432
  DB_NAME=fleetpro_production
  DB_USER=fleetpro_user
  DB_PASSWORD=[SECURE]
  DB_POOL_SIZE=50
  
  # Security
  JWT_SECRET=[GENERATE NEW - min 32 chars]
  CORS_ORIGIN=https://your-domain.com
  
  # Monitoring
  LOG_LEVEL=info
  SENTRY_DSN=[IF USING SENTRY]
  ```

- [ ] **Security Checklist**
  ```bash
  # Generate JWT Secret
  openssl rand -hex 32
  # Output: [SAVE SECURELY]
  
  # Request SSL Certificate
  # Status: [ ] In progress / [ ] Complete
  
  # Configure Firewall Rules
  # Status: [ ] Rules updated
  
  # Enable Database Backups
  # Status: [ ] Backup strategy confirmed
  ```

**Afternoon (2 hours)**

- [ ] **Backup Strategy Review**
  ```bash
  # Daily backup schedule
  Schedule: 2:00 AM UTC
  Retention: 30 days minimum
  Storage: S3 or equivalent
  Verification: Test restore weekly
  ```

- [ ] **Monitoring Setup**
  - [ ] Prometheus configured
  - [ ] Grafana dashboards ready
  - [ ] Alert rules configured
  - [ ] Notification channels tested

### DAY 3: Database Preparation

**Morning (4 hours)**

- [ ] **PostgreSQL Installation**
  ```bash
  # Install PostgreSQL 12+
  # Create database
  createdb fleetpro_production
  
  # Create database user
  createuser fleetpro_user
  psql -d fleetpro_production -c \
    "ALTER USER fleetpro_user WITH PASSWORD '[SECURE]';"
  
  # Grant privileges
  psql -d fleetpro_production -c \
    "GRANT ALL PRIVILEGES ON DATABASE fleetpro_production 
     TO fleetpro_user;"
  ```

- [ ] **Database Configuration**
  ```bash
  # Edit postgresql.conf
  max_connections = 200
  shared_buffers = 256MB
  effective_cache_size = 1GB
  
  # Enable SSL
  ssl = on
  ssl_cert_file = '/path/to/server.crt'
  ssl_key_file = '/path/to/server.key'
  ```

- [ ] **Run Migration**
  ```bash
  # Execute schema migration
  psql -d fleetpro_production -U fleetpro_user \
    -f server/migrations/001_vehicle_compliance_schema.sql
  
  # Verify tables created
  psql -d fleetpro_production -c "\dt"
  # Expected: 11 tables
  
  # Verify indexes created
  psql -d fleetpro_production -c "\di"
  # Expected: 12 indexes
  ```

- [ ] **Data Validation**
  ```bash
  # Check connection
  psql -h $DB_HOST -U fleetpro_user \
    -d fleetpro_production -c "SELECT 1;"
  
  # Verify schema
  psql -d fleetpro_production -c \
    "SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema='public';"
  # Expected: 11 tables
  ```

**Afternoon (2 hours)**

- [ ] **Backup Testing**
  ```bash
  # Create test backup
  pg_dump fleetpro_production | gzip > backup-test.sql.gz
  
  # Test restore to temporary database
  createdb fleetpro_test
  gunzip -c backup-test.sql.gz | psql -d fleetpro_test
  
  # Verify restore
  psql -d fleetpro_test -c "SELECT COUNT(*) FROM vehicles;"
  
  # Drop test database
  dropdb fleetpro_test
  ```

### DAY 4: Application & Dependency Setup

**Morning (3 hours)**

- [ ] **Clone Repository**
  ```bash
  cd /opt/fleetpro
  git clone https://github.com/your-org/fleetpro-main.git
  cd fleetpro-main
  git checkout v1.0.0-production-release
  ```

- [ ] **Install Dependencies**
  ```bash
  # Production dependencies only
  npm ci --production
  
  # Verify no errors
  echo "Install status: $?"  # Should be 0
  ```

- [ ] **Build Application**
  ```bash
  npm run build
  
  # Check for TypeScript errors
  # Expected: 0 errors
  ```

**Afternoon (2 hours)**

- [ ] **Run Tests (Verification)**
  ```bash
  npm test
  
  # Expected output:
  # PASS  100+ test cases
  # Pass rate: 100%
  ```

- [ ] **Verify Build Artifacts**
  ```bash
  ls -la dist/
  # Should contain compiled JavaScript
  
  ls -la client/build/
  # Should contain React bundle
  ```

### DAY 5: Team Training & Documentation

**Morning (4 hours)**

- [ ] **Operations Team Training**
  - [ ] Health check endpoints (30 min)
  - [ ] Health monitoring script (30 min)
  - [ ] Common issues & solutions (60 min)
  - [ ] Incident response procedures (60 min)

- [ ] **On-Call Training**
  - [ ] Review ONCALL_RUNBOOKS.md (60 min)
  - [ ] Practice incident scenarios (30 min)
  - [ ] Review escalation procedures (30 min)

**Afternoon (2 hours)**

- [ ] **Documentation Review**
  - [ ] Confirm all procedures are clear
  - [ ] Identify any gaps
  - [ ] Create local runbooks
  - [ ] Print quick reference cards

- [ ] **Setup War Room**
  - [ ] Create Slack channel: #fleetpro-war-room
  - [ ] Setup video call (have URL ready)
  - [ ] Prepare incident response template
  - [ ] Brief all stakeholders

### DAY 6: Configuration & Integration Testing

**Morning (3 hours)**

- [ ] **Environment Variable Verification**
  ```bash
  # Load production .env
  source .env.production
  
  # Verify all required variables
  echo "DB_HOST: $DB_HOST"
  echo "JWT_SECRET: [SET]"
  echo "CORS_ORIGIN: $CORS_ORIGIN"
  ```

- [ ] **Database Connection Test**
  ```bash
  # Test connection
  npm run test:db
  
  # Expected: ✅ Database connected
  ```

- [ ] **API Endpoint Testing**
  ```bash
  # Start application in test mode
  npm run dev &
  
  # Wait for startup
  sleep 5
  
  # Test health endpoint
  curl http://localhost:3000/health
  # Expected: {"status":"ok"}
  
  # Kill test process
  pkill -f "npm run dev"
  ```

**Afternoon (2 hours)**

- [ ] **Monitoring Integration Test**
  - [ ] Confirm Prometheus can scrape /metrics
  - [ ] Verify Grafana dashboards load
  - [ ] Test alert notifications
  - [ ] Verify log aggregation (if using ELK)

- [ ] **Backup Verification**
  - [ ] Run backup script
  - [ ] Verify backup file created
  - [ ] Test restore from backup
  - [ ] Confirm backup automation

### DAY 7: Pre-Deployment Sign-Off

**Morning (2 hours)**

- [ ] **Final Checklist Review**
  - [ ] All infrastructure ready
  - [ ] All services installed
  - [ ] All tests passing
  - [ ] All documentation complete
  - [ ] Team trained

- [ ] **Security Review Final**
  - [ ] SSL certificates installed
  - [ ] Firewall rules applied
  - [ ] JWT secret secured
  - [ ] Database user permissions correct

**Afternoon (1 hour)**

- [ ] **Deployment Approval**
  - [ ] DevOps Lead approval: _________ Date: _______
  - [ ] Operations Lead approval: _____ Date: _______
  - [ ] Security Lead approval: _______ Date: _______
  - [ ] Project Lead approval: ________ Date: _______

- [ ] **Schedule Deployment**
  - [ ] Date: ___________
  - [ ] Start time: ___________
  - [ ] Expected duration: ___________
  - [ ] Rollback window: ___________

---

## WEEK 2: DEPLOYMENT & VERIFICATION

### DAY 8: DEPLOYMENT DAY

**PRE-DEPLOYMENT (2 hours before)**

- [ ] **Final System Checks (2 hours before)**
  ```bash
  # Run verification script
  ./scripts/deployment-verification.sh
  
  # Expected: All checks passed
  # If any failures, resolve before proceeding
  ```

- [ ] **Team Ready (1.5 hours before)**
  - [ ] All team members present
  - [ ] War room active
  - [ ] Communication channels tested
  - [ ] Runbooks printed and available

- [ ] **Backup Current State (1 hour before)**
  ```bash
  # Create pre-deployment database backup
  pg_dump fleetpro_production | gzip > \
    backups/pre-deployment-$(date +%Y%m%d-%H%M%S).sql.gz
  
  # Create git tag
  git tag deployment-backup-$(date +%Y%m%d-%H%M%S)
  ```

**DEPLOYMENT EXECUTION (1 hour)**

Choose your deployment method:

#### Option A: Kubernetes Deployment

```bash
# 1. Create namespace
kubectl create namespace fleetpro

# 2. Create secrets
kubectl create secret generic fleetpro-secrets \
  --from-literal=db-password=$DB_PASSWORD \
  --from-literal=jwt-secret=$JWT_SECRET \
  -n fleetpro

# 3. Create ConfigMap
kubectl create configmap fleetpro-config \
  --from-env-file=.env.production \
  -n fleetpro

# 4. Deploy application
kubectl apply -f deployment.yaml

# 5. Wait for deployment
kubectl rollout status deployment/fleetpro -n fleetpro

# 6. Verify pods running
kubectl get pods -n fleetpro
# Expected: 3 pods in Running state
```

#### Option B: Docker Deployment

```bash
# 1. Build image
docker build -t fleetpro:1.0.0 .

# 2. Start services
docker-compose up -d

# 3. Wait for startup
sleep 10

# 4. Check status
docker-compose ps
# Expected: All services running

# 5. Verify application
docker logs fleetpro
# Expected: No error messages
```

#### Option C: Standalone (PM2) Deployment

```bash
# 1. Install dependencies
npm ci --production

# 2. Build application
npm run build

# 3. Start with PM2
pm2 start npm --name fleetpro -- start

# 4. Save configuration
pm2 save
pm2 startup

# 5. Verify status
pm2 status
# Expected: online status
```

**POST-DEPLOYMENT VERIFICATION (1 hour)**

- [ ] **Health Checks**
  ```bash
  # Check liveness
  curl http://localhost:3000/health
  # Expected: {"status":"ok"}
  
  # Check readiness
  curl http://localhost:3000/ready
  # Expected: {"status":"ready"}
  
  # Check metrics
  curl http://localhost:3000/metrics
  # Expected: JSON with metrics
  ```

- [ ] **API Verification**
  ```bash
  # Test with valid JWT token
  curl -H "Authorization: Bearer $VALID_TOKEN" \
    http://localhost:3000/vehicles/test/compliance
  
  # Expected: 200 OK with compliance data
  ```

- [ ] **Database Verification**
  ```bash
  # Verify connection
  psql -d fleetpro_production -c "SELECT COUNT(*) FROM vehicles;"
  
  # Check for errors in logs
  pm2 logs fleetpro | grep -i error
  # Expected: No errors
  ```

- [ ] **Monitoring Active**
  - [ ] Prometheus scraping metrics ✅
  - [ ] Grafana dashboards showing data ✅
  - [ ] Alert rules active ✅
  - [ ] Notifications working ✅

**ANNOUNCEMENT**

- [ ] Post to Slack: #fleetpro-deployment
  ```
  ✅ Deployment Complete!
  
  Status: Production is LIVE
  Version: v1.0.0
  Health: All checks passing
  Monitoring: Active
  
  Next: Monitor continuously for 24 hours
  ```

### DAY 9-10: 24-HOUR CONTINUOUS MONITORING

**Hour 0-6 (Overnight - Automated)**

- [ ] **Start Continuous Monitoring**
  ```bash
  ./scripts/health-monitor.sh 30  # Check every 30 seconds
  ```

- [ ] **Automated Alerts**
  - [ ] Error rate monitor (if > 1%)
  - [ ] Response time monitor (if > 1s)
  - [ ] Memory monitor (if > 300MB)
  - [ ] Database connection monitor

**Hour 6-12 (Morning - Active)**

- [ ] **Business Hours Monitoring**
  - [ ] Check metrics every 15 minutes
  - [ ] Monitor for any alerts
  - [ ] Review application logs
  - [ ] Verify backup completed

- [ ] **Load Testing (if appropriate)**
  ```bash
  # Optional: Light load test
  # Run during off-peak hours only
  ab -n 1000 -c 10 http://localhost:3000/health
  ```

**Hour 12-24 (Evening - Active)**

- [ ] **Performance Review**
  ```bash
  # Check metrics via API
  curl http://localhost:3000/metrics | jq .
  
  # Verify response times
  # Expected: < 200ms average
  
  # Verify error rate
  # Expected: < 0.1%
  ```

- [ ] **Database Health Check**
  ```bash
  # Check active connections
  psql -d fleetpro_production -c \
    "SELECT count(*) FROM pg_stat_activity;"
  # Expected: < 20
  
  # Check query performance
  psql -d fleetpro_production -c \
    "SELECT mean_exec_time FROM pg_stat_statements 
     ORDER BY mean_exec_time DESC LIMIT 5;"
  ```

**Hour 24: Go-Live Confirmation**

- [ ] **24-Hour Stability Confirmed**
  - [ ] No critical errors
  - [ ] Response times stable
  - [ ] Database healthy
  - [ ] All backups successful

- [ ] **Post to Slack: #fleetpro-deployment**
  ```
  ✅ 24-Hour Stability Confirmed!
  
  System Status: HEALTHY
  Error Rate: < 0.1%
  Response Time: < 200ms
  Uptime: 100%
  
  Production deployment SUCCESSFUL ✅
  ```

### DAY 11: POST-DEPLOYMENT TESTING

**Morning (4 hours)**

- [ ] **API Endpoint Testing**
  ```bash
  # Test all 16 endpoints
  # Document API endpoint status: docs/API.md
  
  # 1. Document Management (6 endpoints)
  curl -X POST http://localhost:3000/vehicles/test/documents
  curl -X GET http://localhost:3000/vehicles/test/documents
  curl -X GET http://localhost:3000/documents/test-id
  curl -X PUT http://localhost:3000/documents/test-id
  curl -X POST http://localhost:3000/documents/test-id/verify
  curl -X POST http://localhost:3000/documents/test-id/renew
  
  # 2. Compliance (3 endpoints)
  curl -X GET http://localhost:3000/vehicles/test/compliance
  curl -X POST http://localhost:3000/bookings/test/vehicle/validate
  curl -X POST http://localhost:3000/trips/test/vehicle/risk-check
  
  # 3. Alerts (4 endpoints)
  curl -X GET http://localhost:3000/vehicles/test/alerts
  curl -X GET http://localhost:3000/alerts/critical
  curl -X POST http://localhost:3000/alerts/test-id/acknowledge
  curl -X GET http://localhost:3000/fleet/compliance-dashboard
  
  # 4. Health (3 endpoints)
  curl -X GET http://localhost:3000/health
  curl -X GET http://localhost:3000/ready
  curl -X GET http://localhost:3000/metrics
  ```

- [ ] **Feature Testing**
  - [ ] Dashboard loads correctly
  - [ ] Compliance scoring works
  - [ ] Alerts generate correctly
  - [ ] Document upload works

**Afternoon (2 hours)**

- [ ] **Backup Verification**
  ```bash
  # Test backup restoration
  # Create temporary database
  createdb fleetpro_restore_test
  
  # Restore latest backup
  gunzip -c backups/latest.sql.gz | \
    psql -d fleetpro_restore_test
  
  # Verify data
  psql -d fleetpro_restore_test -c \
    "SELECT COUNT(*) FROM vehicles;"
  
  # Drop test database
  dropdb fleetpro_restore_test
  ```

- [ ] **Performance Benchmarking**
  ```bash
  # Measure API response times
  for i in {1..100}; do
    time curl -s http://localhost:3000/health > /dev/null
  done
  
  # Expected: < 100ms avg
  ```

### DAY 12-13: TEAM HANDOFF & READINESS

**Day 12: Operations Handoff**

- [ ] **Operations Team Brief**
  - [ ] System architecture review
  - [ ] Key configuration locations
  - [ ] Monitoring dashboard walkthrough
  - [ ] Incident response procedures review

- [ ] **On-Call Rotation Setup**
  - [ ] Primary on-call assigned
  - [ ] Secondary on-call assigned
  - [ ] Escalation contacts documented
  - [ ] Runbooks accessible

- [ ] **Documentation Handoff**
  - [ ] All runbooks provided
  - [ ] Contact information confirmed
  - [ ] Escalation procedures clear
  - [ ] Support resources identified

**Day 13: Full Readiness Verification**

- [ ] **Final Checklist**
  - [ ] All systems operational
  - [ ] All monitoring active
  - [ ] All backups automated
  - [ ] All team trained
  - [ ] All documentation complete

- [ ] **Sign-Off**
  ```
  Production Deployment: ✅ COMPLETE
  System Status: ✅ HEALTHY
  Monitoring: ✅ ACTIVE
  Team Readiness: ✅ READY
  
  Approved for Standard Operations
  ```

---

## ROLLBACK PROCEDURES

**If Critical Issue Detected (within first 24 hours)**

```bash
# STOP: Do not continue deployment
# ALERT: Notify all stakeholders

# OPTION 1: Quick Restart
pm2 restart fleetpro

# OPTION 2: Revert to Previous Version
git checkout production-live-20260809-212440
npm run build
pm2 restart fleetpro

# OPTION 3: Full Rollback (if data corruption)
# Stop application
pm2 stop fleetpro

# Restore database from pre-deployment backup
gunzip -c backups/pre-deployment-*.sql.gz | \
  psql -d fleetpro_production

# Restart with previous version
git checkout production-live-20260809-212440
npm run build
npm ci --production
pm2 start fleetpro

# VERIFY
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

---

## SUCCESS CRITERIA

### ✅ Deployment Successful If

- [x] Application starts without errors
- [x] Health check passes (/health → 200 OK)
- [x] Readiness check passes (/ready → 200 OK)
- [x] Metrics endpoint responds (/metrics → 200 OK)
- [x] Database connected and accessible
- [x] All 16 API endpoints responding
- [x] No critical errors in logs
- [x] Response time < 1000ms (95th percentile)
- [x] Error rate < 1%
- [x] Backups running automatically
- [x] Monitoring active and collecting data
- [x] Team trained and ready
- [x] Documentation complete

### ❌ Rollback If

- [ ] Application fails to start
- [ ] Health check failing (returns non-200)
- [ ] Database unreachable
- [ ] Critical errors in logs
- [ ] Response time > 5 seconds consistently
- [ ] Error rate > 10%
- [ ] Data corruption detected

---

## COMMUNICATION TEMPLATE

### Pre-Deployment Announcement
```
Subject: FleetPro Deployment - Week Starting [DATE]

Dear Team,

We are excited to announce that the FleetPro Fleet Compliance System 
will be deployed to production starting [DATE].

Timeline:
- Week 1: Pre-deployment preparation
- Week 2: Deployment & verification
- Total downtime: NONE (backward compatible)

Deployment Channel: #fleetpro-deployment
War Room: [VIDEO CALL LINK]

No user action required.

Questions? Contact [PROJECT LEAD]
```

### Deployment Day Notification
```
Subject: 🚀 LIVE: FleetPro Fleet Compliance System Deployed

Dear Team,

✅ FleetPro Fleet Compliance System is now LIVE in production!

Status: All systems operational
Monitoring: Active
Support: Available 24/7

Key Links:
- Dashboard: [URL]
- API: [URL]
- Documentation: [URL]

Have questions? Contact [SUPPORT EMAIL]
```

### Post-Deployment Summary
```
Subject: ✅ Deployment Complete: FleetPro v1.0.0

Dear Stakeholders,

The FleetPro Fleet Compliance System deployment is complete and 
verified successful.

Deployment Stats:
- Deployment Time: 2-3 weeks
- Downtime: 0 minutes
- Tests Passed: 100+
- System Status: HEALTHY
- Monitoring: ACTIVE

Next Steps:
- Continuous monitoring for 30 days
- Performance optimization (if needed)
- Feature enhancements (planned for Q3)

Contact: [PROJECT LEAD] for any questions
```

---

## APPENDIX: Useful Commands

### Health & Status
```bash
# Check application status
pm2 status

# View logs
pm2 logs fleetpro

# Check health
curl http://localhost:3000/health

# Check readiness
curl http://localhost:3000/ready

# View metrics
curl http://localhost:3000/metrics | jq .
```

### Database
```bash
# Connect to database
psql -d fleetpro_production -U fleetpro_user

# Check tables
\dt

# Check connections
SELECT count(*) FROM pg_stat_activity;

# Backup
pg_dump fleetpro_production | gzip > backup.sql.gz

# Restore
gunzip -c backup.sql.gz | psql -d fleetpro_production
```

### Monitoring
```bash
# Start health monitor
./scripts/health-monitor.sh 30

# View Prometheus metrics
curl http://localhost:9090

# View Grafana dashboard
open http://localhost:3000
```

### Restart/Reload
```bash
# Restart application
pm2 restart fleetpro

# Reload with zero downtime
pm2 reload fleetpro

# Stop application
pm2 stop fleetpro

# Start application
pm2 start fleetpro
```

---

## CONTACTS & ESCALATION

### Team Contacts
- **Project Lead:** [Name] [Email] [Phone]
- **DevOps Lead:** [Name] [Email] [Phone]
- **SRE Lead:** [Name] [Email] [Phone]
- **Database DBA:** [Name] [Email] [Phone]
- **QA Lead:** [Name] [Email] [Phone]

### Support Escalation
- **Level 1 (On-Call):** [Phone]
- **Level 2 (Senior Eng):** [Phone]
- **Level 3 (Manager):** [Phone]

### External Support
- **AWS Support:** [Link]
- **Database Provider:** [Contact]
- **Monitoring Platform:** [Support Link]

---

**Ready to deploy? Start DAY 1 of WEEK 1 now.**

🚀 **Let's go live!**
