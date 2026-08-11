# FleetPro On-Call Setup & Procedures

**Document Version:** 1.0  
**Date:** August 11, 2026  
**On-Call Start Date:** August 11, 2026  
**Coverage:** 24/7 (Primary + Secondary rotation)

---

## On-Call Rotation Schedule

### Primary On-Call Rotation

**Rotation Period:** Weekly (Sunday - Saturday)

#### Week 1 (Aug 11-18, 2026)
- **Primary:** [Engineer Name 1] ([Phone])
- **Secondary:** [Engineer Name 2] ([Phone])
- **Database On-Call:** [DBA Name 1] ([Phone])
- **Engineering Lead:** [Lead Name 1] ([Phone])

#### Week 2 (Aug 18-25, 2026)
- **Primary:** [Engineer Name 2] ([Phone])
- **Secondary:** [Engineer Name 3] ([Phone])
- **Database On-Call:** [DBA Name 2] ([Phone])
- **Engineering Lead:** [Lead Name 2] ([Phone])

#### Week 3 (Aug 25-Sep 1, 2026)
- **Primary:** [Engineer Name 3] ([Phone])
- **Secondary:** [Engineer Name 1] ([Phone])
- **Database On-Call:** [DBA Name 1] ([Phone])
- **Engineering Lead:** [Lead Name 1] ([Phone])

*Rotation continues indefinitely. Update schedule monthly.*

---

## On-Call Responsibilities

### Primary On-Call Engineer

**Availability:** 24/7 (all hours)  
**Response Time:** <5 minutes for critical alerts  
**Shift Duration:** 1 week (168 hours)

#### Responsibilities

1. **Alert Response**
   - Acknowledge all critical alerts within 5 minutes
   - Investigate root cause
   - Implement fixes or workarounds
   - Escalate if needed

2. **Incident Management**
   - Document incident details
   - Communicate status updates (every 15 minutes for critical)
   - Coordinate with other on-call engineers
   - Execute runbook procedures

3. **Communication**
   - Notify slack #fleetpro-production of issues
   - Update status page
   - Communicate with stakeholders
   - Provide incident summaries

4. **Prevention**
   - Monitor trends and patterns
   - Proactively address potential issues
   - Review logs for warnings
   - Communicate concerns to team

5. **Documentation**
   - Log all incidents
   - Document resolution steps
   - Create post-incident reports
   - Update runbooks with learnings

### Secondary On-Call Engineer

**Availability:** 24/7 (backup only)  
**Response Time:** <15 minutes if primary unavailable  
**Shift Duration:** 1 week (on standby)

#### Responsibilities
- Backup for primary engineer
- Handle non-critical issues
- Assist primary with major incidents
- Cover if primary is unavailable
- Training and knowledge sharing

### Database On-Call

**Availability:** 24/7 (for database issues)  
**Response Time:** <5 minutes for database critical  
**Specialization:** Database administration, backups, recovery

#### Responsibilities
- Monitor database health
- Handle replication issues
- Manage backups
- Perform database recovery if needed
- Database performance tuning

### Engineering Lead (Escalation)

**Availability:** 24/7 (escalation only)  
**Response Time:** <15 minutes if escalated  
**Responsibility:** Major technical decisions, complex troubleshooting

---

## On-Call Responsibilities Schedule

### Morning (06:00-14:00 UTC)
- 06:00: Check overnight logs
- 08:00: Daily standup (if available)
- 12:00: Mid-day metrics review
- 14:00: Handoff summary

### Afternoon/Evening (14:00-22:00 UTC)
- 14:00: Handoff review
- 18:00: Performance check
- 20:00: Evening trend review

### Night (22:00-06:00 UTC)
- 22:00: System check before sleep (if not on-call)
- On-call: Monitor critical alerts only
- 06:00: Morning handoff

---

## On-Call Tools & Access

### Required Tools

#### Communication Tools
- [x] PagerDuty (alert notifications)
- [x] Slack (team communication)
- [x] Email (stakeholder communication)
- [x] Phone (emergency calls)

#### Access & Authentication
- [x] VPN access to production
- [x] SSH keys for server access
- [x] Database credentials (encrypted)
- [x] AWS console access
- [x] GitHub SSH keys

#### Monitoring & Dashboards
- [x] Prometheus (http://prometheus:9090)
- [x] Grafana (http://grafana:3000)
- [x] ELK Stack (logs)
- [x] Sentry (error tracking)
- [x] AWS CloudWatch

#### Command-Line Tools
- [x] `kubectl` (Kubernetes CLI)
- [x] `docker` (Docker CLI)
- [x] `mongo` (MongoDB CLI)
- [x] `aws` (AWS CLI)
- [x] `git` (Git CLI)

### Access Setup Checklist

Before going on-call, verify you have:

```bash
# VPN Access
$ vpn status
Connected ✓

# SSH Access
$ ssh -i ~/.ssh/fleetpro-prod ubuntu@prod-api-1.example.com
Connected ✓

# Database Access
$ mongo --authenticationDatabase admin \
  --username $MONGODB_USER --password $MONGODB_PASSWORD
Connected ✓

# AWS Access
$ aws s3 ls s3://fleetpro-backups/
Accessible ✓

# Kubernetes Access
$ kubectl get nodes
Ready ✓

# Monitoring Access
$ curl http://localhost:9090/api/v1/query?query=up
Accessible ✓
```

---

## Alert Handling Procedures

### Step 1: Receive Alert (PagerDuty)

**Timeline:** T+0 seconds
- Alert triggered automatically
- PagerDuty notification sent
- SMS + Phone call (if high severity)
- Slack notification in #fleetpro-critical-alerts

### Step 2: Acknowledge Alert (T+0-300 seconds)

**Timeline:** Within 5 minutes
- Open PagerDuty and acknowledge
- Verify alert legitimacy
- Check Grafana dashboard
- Review relevant logs

### Step 3: Gather Information (T+1-5 minutes)

```bash
# System Status
curl -s http://localhost:5050/api/health | jq .

# Recent Logs
kubectl logs -f deployment/fleetpro-app --tail=100

# Check Dashboards
# Open: http://grafana:3000/d/fleetpro-production

# Database Status
mongo --eval "db.adminCommand('ping')"

# Active Processes
top -b -n 1 | head -20
```

### Step 4: Classify Alert (T+5-10 minutes)

**Is this a real issue?**
- [ ] Yes: Proceed to Step 5
- [ ] No (false alarm): Close alert, document reason

**Severity Assessment:**
- [ ] Critical (system down): Immediate action
- [ ] High (major feature broken): Quick fix needed
- [ ] Medium (performance issue): Investigate
- [ ] Low (minor issue): Log and review

### Step 5: Execute Runbook (T+10-30 minutes)

Based on alert type, follow appropriate runbook:
- `ERROR_RATE_HIGH.md` (if error rate >1%)
- `LATENCY_HIGH.md` (if response time high)
- `DATABASE_DOWN.md` (if database unavailable)
- `CPU_HIGH.md` (if CPU >95%)
- `MEMORY_HIGH.md` (if memory >95%)
- etc.

### Step 6: Escalate if Needed (T+15+ minutes)

**Escalation Triggers:**
- Issue not identified within 15 minutes → Escalate to secondary
- Issue not resolved within 30 minutes → Escalate to engineering lead
- Critical issue impacting users → Immediate escalation
- Requires rollback → Notify CTO

### Step 7: Implement Fix (T+30-60 minutes)

**Options:**
1. Quick fix (configuration change)
2. Rollback (revert code)
3. Workaround (temporary fix)
4. Escalate (pass to specialists)

### Step 8: Verify Resolution (T+60-90 minutes)

```bash
# Verify issue resolved
curl -s http://localhost:5050/api/health

# Check error rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_request_errors_total[5m])'

# Monitor for 5 minutes
for i in {1..5}; do
  sleep 60
  curl -s http://localhost:5050/api/health
done

echo "Resolution verified"
```

### Step 9: Communicate Status (T+90-120 minutes)

- [x] Update Slack #fleetpro-production
- [x] Update status page
- [x] Notify stakeholders
- [x] Close PagerDuty incident

### Step 10: Post-Incident Review (T+24 hours)

- [x] Document root cause
- [x] Create post-incident review
- [x] Identify prevention steps
- [x] Update runbooks/monitoring
- [x] Schedule team review

---

## Common Alerts & Quick Responses

### Alert: Error Rate >1%

**Runbook:** ERRORS_HIGH.md

```bash
# 1. Get error details
kubectl logs -f deployment/fleetpro-app | grep ERROR | tail -50

# 2. Identify affected endpoints
curl 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])'

# 3. Check database
mongo --eval "db.serverStatus().connections"

# 4. Potential fixes
# - Restart pods if memory leak
# - Scale up if high load
# - Rollback if recent deployment
# - Check third-party services (SendGrid, Twilio, etc.)

# 5. Escalate if unknown
```

### Alert: Response Time >3s

**Runbook:** LATENCY_HIGH.md

```bash
# 1. Check database performance
mongo --eval "db.currentOp()"

# 2. Check resource utilization
top -b -n 1 | head -20

# 3. Check network
iftop -n -P

# 4. Profile slow requests
kubectl logs -f deployment/fleetpro-app | grep "duration:"

# 5. Potential fixes
# - Scale up if CPU/Memory high
# - Optimize slow queries
# - Clear cache if needed
```

### Alert: Database Lag >500ms

**Runbook:** REPLICATION_LAG.md

```bash
# 1. Check replication status
mongo --eval "rs.status()"

# 2. Identify slow member
# Look for "stale" replica

# 3. Check network between nodes
ping -c 5 [secondary-ip]

# 4. Fix options
# - Restart slow replica
# - Increase heap size if memory pressure
# - Check disk I/O

# 5. Escalate to DBA
```

---

## On-Call Tools & Credentials

### PagerDuty Setup

1. **Download PagerDuty app** on mobile device
2. **Login with on-call credentials**
3. **Enable notifications:**
   - Push notifications: ON
   - SMS: ON
   - Phone calls: ON
4. **Test alert:** Page yourself to verify

### VPN Access

```bash
# Connect to VPN
vpn connect --profile production

# Verify connection
ifconfig | grep tun

# Test access
ssh -i ~/.ssh/fleetpro-prod ubuntu@prod-api-1.example.com
```

### SSH Keys

**Location:** `~/.ssh/fleetpro-prod`  
**Permissions:** `chmod 400 ~/.ssh/fleetpro-prod`  
**Passphrase:** [Stored in password manager]  
**Backup:** Encrypted in LastPass / 1Password

### Database Access

**Credentials Location:** `/Users/[username]/.mongo-credentials`

```
# Example .mongo-credentials (encrypted)
export MONGODB_HOST="prod-mongo-1.example.com"
export MONGODB_PORT="27017"
export MONGODB_USER="fleetpro_admin"
export MONGODB_PASSWORD="[encrypted-password]"
export MONGODB_DATABASE="fleetpro"
```

### AWS Access

**Credentials Location:** `~/.aws/credentials`

```
[fleetpro-prod]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = [encrypted-key]
region = us-east-1
```

---

## On-Call Phone & Contact Info

### Team Contact Information

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| Primary (Week 1) | [Name] | [+1-555-001] | [email] | @[username] |
| Secondary (Week 1) | [Name] | [+1-555-002] | [email] | @[username] |
| Database On-Call | [Name] | [+1-555-003] | [email] | @[username] |
| Engineering Lead | [Name] | [+1-555-004] | [email] | @[username] |
| CTO | [Name] | [+1-555-005] | [email] | @[username] |

### Emergency Escalation

**If primary on-call unreachable:**
1. Page secondary on-call
2. Page engineering lead
3. Page CTO
4. Contact office/manager

---

## On-Call Handoff Procedure

### End of Week Handoff (Sunday)

**Time:** 14:00 UTC (before new on-call starts)  
**Duration:** 30 minutes  
**Attendees:** Outgoing + Incoming on-call, engineering lead

**Handoff Checklist:**

```
[ ] 1. Review past week incidents
    - Any ongoing issues?
    - Any systemic problems?
    - Any preventive measures taken?

[ ] 2. Review open tickets
    - Any escalated issues?
    - Any performance concerns?
    - Any security alerts?

[ ] 3. Operational status
    - Any known flaky tests?
    - Any capacity concerns?
    - Any third-party issues?

[ ] 4. Access verification
    - Test VPN access
    - Test SSH access
    - Test database access
    - Test monitoring access

[ ] 5. Tool verification
    - PagerDuty app on phone
    - Slack notifications working
    - Email working
    - Phone line working

[ ] 6. Documentation review
    - Runbooks up to date?
    - Contact info correct?
    - Procedures documented?

[ ] 7. Q&A
    - Ask outgoing about tricky situations
    - Get tips and tricks
    - Clarify procedures
```

---

## On-Call Support & Wellbeing

### During On-Call Week

**Work Schedule:**
- Business hours: Regular work
- Off-hours: Available for emergencies
- No requirement to work 24/7 (unless emergency)
- Respond to critical alerts within 5 minutes

**Sleep & Health:**
- Keep phone nearby during sleep
- Get adequate rest
- Manage stress
- Take breaks as needed

**Communication:**
- Let team know if traveling
- Notify if phone number changes
- Alert if losing access
- Communicate handoff needs early

### Compensation

**On-Call Compensation Policies:**
- Hourly compensation during on-call week: [Policy]
- Incident response bonus: [Policy]
- Time-off after major incident: [Policy]
- Emergency call-out pay: [Policy]

### Support Resources

- **Employee Assistance Program (EAP):** [Contact]
- **Mental Health Support:** [Services]
- **Stress Management:** [Resources]
- **Sleep & Wellness:** [Information]

---

## On-Call Training

### Before First On-Call Shift

**Required Training (2-3 hours):**
- [ ] System architecture overview
- [ ] Monitoring dashboards walkthrough
- [ ] Alert handling procedures
- [ ] Runbook usage
- [ ] Escalation procedures
- [ ] Communication protocols
- [ ] Tool access and troubleshooting

**Shadowing (1 on-call rotation):**
- [ ] Shadow experienced on-call engineer
- [ ] Observe incident handling
- [ ] Practice with secondary role
- [ ] Ask questions and learn

**Knowledge Base Review:**
- [ ] Read runbooks
- [ ] Review past incidents
- [ ] Study monitoring setup
- [ ] Understand architecture

---

## On-Call Performance Metrics

### Monthly Review

| Metric | Target | Tracking |
|--------|--------|----------|
| Alert Response Time | <5 min | PagerDuty logs |
| Incident Resolution | <1 hour | Incident tickets |
| Escalation Rate | <20% | PagerDuty stats |
| False Alert Rate | <10% | Alert analysis |
| On-Call Availability | 100% | Schedule compliance |

---

## On-Call Checklist (Start of Shift)

**Every Sunday 14:00 UTC or shift start:**

```
[ ] Read handoff notes from previous on-call
[ ] Verify all access tools working
[ ] Check for any open issues/incidents
[ ] Review monitoring dashboards
[ ] Ensure phone has battery
[ ] Update availability status in PagerDuty
[ ] Check Slack is configured
[ ] Verify email is accessible
[ ] Test VPN connection
[ ] Review oncall procedures
```

---

**Document Prepared By:** [Name/Title]  
**Date:** August 11, 2026  
**On-Call Program Start:** August 11, 2026  
**Next Review:** September 1, 2026
