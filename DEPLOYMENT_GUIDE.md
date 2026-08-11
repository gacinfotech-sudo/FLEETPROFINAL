# FleetPro Notification System - Deployment Guide

## Overview

Complete notification system with multi-channel delivery (Email/SMS/Push/In-App), advanced analytics, user preferences, and production-grade monitoring.

## Pre-Deployment Checklist

### Environment Setup

```bash
# 1. Verify Node.js version
node --version  # v24.18.0 or higher

# 2. Install dependencies
npm install

# 3. Build project
npm run build   # Should complete in ~4 seconds with 0 errors

# 4. Verify MongoDB
mongosh --eval "db.adminCommand('ping')"

# 5. Check environment variables
env | grep -E "EMAIL_|SMS_|VAPID_|SENDGRID_|TWILIO_"
```

### Database Migrations

```bash
# Run all pending migrations
npm run migrate

# Verify collections exist
mongosh --eval "
  db.getCollectionNames().forEach(name => {
    if (name.includes('notification')) print(name);
  })
"

# Expected collections:
# - notification_events
# - notification_triggers
# - notification_templates
# - notification_preferences
# - notification_webhooks
# - push_subscriptions
# - email_queue
# - sms_queue
# - in_app_notifications
# - notification_analytics
# - notification_archive
# - notification_rules
# - retention_policies
```

## Deployment Steps

### Step 1: Pre-Flight Validation

```bash
# Run type checking
npx tsc --noEmit

# Run linting
npm run lint

# Run unit tests
npm run test

# Run E2E tests (if applicable)
npm run e2e

# Build production bundle
npm run build
```

### Step 2: Environment Configuration

Create or update `.env`:

```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro
DB_NAME=fleetpro

# Email Provider (choose one)
EMAIL_PROVIDER=sendgrid  # or 'smtp' or 'mock'
SENDGRID_API_KEY=your-api-key
EMAIL_FROM=noreply@fleetpro.com
EMAIL_FROM_NAME=FleetPro

# SMS Provider (choose one)
SMS_PROVIDER=twilio  # or 'sns' or 'mock'
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Web Push
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:support@fleetpro.com

# Server
PORT=5050
NODE_ENV=production
```

### Step 3: Generate VAPID Keys (for Push Notifications)

```bash
npm install -g web-push

web-push generate-vapid-keys

# Copy the keys to .env
```

### Step 4: Start Server

```bash
# Development
npm run dev

# Production
npm start

# With Docker
docker-compose -f docker-compose.yml up -d
```

### Step 5: Verify Deployment

```bash
# Test health endpoint
curl -s https://192.168.29.142:5050/api/notification-health/status | jq

# Should return:
# {
#   "status": "healthy",
#   "checks": {...},
#   "metrics": {...}
# }

# Test email provider
curl -X POST https://192.168.29.142:5050/api/notification-providers/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'

# Check Prometheus metrics
curl -s https://192.168.29.142:5050/api/notification-health/metrics
```

## Monitoring Setup

### Prometheus Integration

```yaml
# Add to prometheus.yml
scrape_configs:
  - job_name: 'fleetpro-notifications'
    metrics_path: '/api/notification-health/metrics'
    static_configs:
      - targets: ['192.168.29.142:5050']
```

### Grafana Dashboards

1. Go to: http://localhost:3000
2. Create new dashboard
3. Import from `monitoring/grafana/dashboards/fleetpro-observability.json`
4. Configure data source to Prometheus

### Alert Rules

Configure in `monitoring/alerts.yml`:

```yaml
groups:
  - name: notifications
    rules:
      - alert: NotificationFailureRateHigh
        expr: |
          (1 - notification_delivery_success_rate) > 0.05
        for: 5m
        annotations:
          summary: "Notification delivery failure rate > 5%"
```

## Scaling Considerations

### For High Volume (10K+ notifications/minute)

1. **Enable Redis caching**
   ```bash
   docker run -d -p 6379:6379 redis:7
   ```

2. **Configure connection pooling**
   ```env
   MONGODB_MAX_POOL_SIZE=50
   REDIS_ENABLED=true
   REDIS_URL=redis://localhost:6379
   ```

3. **Horizontal scaling**
   ```bash
   # Run multiple instances behind load balancer
   PORT=5050 npm start &
   PORT=5051 npm start &
   PORT=5052 npm start &
   ```

## Troubleshooting

### Email Not Sending

```bash
# Check email queue
mongosh --eval "db.email_queue.find({status: 'queued'}).limit(5)"

# Check SendGrid API key
curl -s https://api.sendgrid.com/v3/mail/validate \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

### SMS Delivery Issues

```bash
# Check SMS queue
mongosh --eval "db.sms_queue.find({status: 'queued'}).limit(5)"

# Test Twilio credentials
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  https://api.twilio.com/2010-04-01/Accounts
```

### High Database Latency

```bash
# Check indexes
mongosh --eval "db.notification_analytics.getIndexes()"

# Create missing indexes
npm run create-indexes

# Monitor query performance
mongosh --eval "db.setProfilingLevel(1, {slowms: 100})"
mongosh --eval "db.system.profile.find().sort({ts:-1}).limit(10)"
```

## Rollback Procedure

```bash
# If deployment fails, rollback to previous version
git log --oneline -5

# Get previous commit hash
git checkout <previous-hash>

# Rebuild and redeploy
npm run build
npm start

# Notify team
echo "Rolled back to $(git rev-parse --short HEAD)"
```

## Post-Deployment

### Smoke Tests

- [ ] Health endpoint returns healthy
- [ ] Create and send notification via each channel
- [ ] Verify preferences are saved
- [ ] Check analytics dashboard loads
- [ ] Test push notification delivery
- [ ] Verify email/SMS providers configured

### Monitoring

- [ ] Grafana dashboard showing metrics
- [ ] Alert rules firing for test conditions
- [ ] Prometheus scraping metrics
- [ ] Log aggregation working

### Documentation

- [ ] API docs updated
- [ ] Runbook created for common issues
- [ ] On-call procedures documented
- [ ] Incident response plan ready

## Performance Baselines

Expected metrics on production:

- **API Response Time**: < 100ms (p95)
- **Notification Delivery**: 99.9% success rate
- **Email Delivery**: < 5 seconds
- **SMS Delivery**: < 10 seconds
- **Push Delivery**: < 1 second
- **Database Query Time**: < 50ms (p95)
- **Cache Hit Rate**: > 80%

## SLA Targets

- **Availability**: 99.9% (8.76 hours downtime/month)
- **Success Rate**: 99%+ delivery
- **Response Time**: < 100ms (p95)
- **Support**: 24/7 on-call rotation

## Emergency Contacts

- **On-Call**: [Slack channel]
- **Page Duty**: [escalation policy]
- **Status Page**: [status.fleetpro.com]

---

**Deployment Date**: [INSERT DATE]  
**Deployed By**: [INSERT NAME]  
**Approval**: [INSERT SIGN-OFF]
