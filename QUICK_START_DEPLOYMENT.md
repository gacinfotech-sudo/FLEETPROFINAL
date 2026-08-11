# FleetPro Production Deployment - Quick Start Guide

Fast-track deployment for experienced DevOps engineers.

---

## 5-Minute Setup

### 1. Prepare Environment (1 min)

```bash
# Setup directories
mkdir -p /opt/fleetpro/{data,logs,backups,ssl,monitoring}
cd /opt/fleetpro

# Clone repo
git clone <your-repo> .
git checkout v1.0.0  # Latest stable
```

### 2. Configure (2 min)

```bash
# Copy and edit config
cp .env.production.template .env.production
nano .env.production

# ESSENTIAL variables to update:
# - MONGODB_ROOT_PASSWORD
# - REDIS_PASSWORD
# - SESSION_SECRET
# - JWT_SECRET
# - SSL certificate paths
# - API keys (SendGrid, Twilio, Stripe, etc.)
```

### 3. Generate Certificates (1 min)

```bash
# For development
./ssl/setup-certificates.sh --self-signed

# For production
DOMAIN_NAME=fleetpro.example.com \
LETSENCRYPT_EMAIL=admin@example.com \
./ssl/setup-certificates.sh --letsencrypt
```

### 4. Deploy (1 min)

```bash
# Build and start
docker build -t fleetpro:latest .
docker-compose -f docker-compose.production.yml up -d

# Verify
docker-compose -f docker-compose.production.yml ps
curl http://localhost/health
```

---

## Production URLs

```
HTTP:       http://fleetpro.example.com
HTTPS:      https://fleetpro.example.com
Admin:      https://fleetpro.example.com/admin
Prometheus: http://localhost:9090
Grafana:    http://localhost:3000
Jaeger:     http://localhost:16686
```

---

## Monitoring Stack

```bash
# Start observability services
docker-compose -f docker-compose.observability.yml up -d

# Verify
docker-compose -f docker-compose.observability.yml ps

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
# Jaeger: http://localhost:16686
# Kibana: http://localhost:5601
```

---

## Backup & Restore

```bash
# Automated daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mongodb.sh") | crontab -

# Manual backup
./database/backup-mongodb.sh

# Restore from backup
./database/restore-mongodb.sh /var/backups/fleetpro/mongodb/backup.tar.gz

# Dry-run (test)
./database/restore-mongodb.sh backup.tar.gz --dry-run
```

---

## Health Checks

```bash
# Basic health
curl http://localhost/health

# Detailed health
curl http://localhost/health/detailed | jq .

# Dependencies
curl http://localhost/health/dependencies | jq .

# Metrics
curl http://localhost/metrics | grep http_requests_total
```

---

## Troubleshooting

```bash
# View logs
docker-compose logs -f app

# Check services
docker-compose ps

# Restart service
docker-compose restart app

# Stop all
docker-compose down

# Full reset (careful!)
docker-compose down -v
docker-compose up -d
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| 503 Error | Check MongoDB/Redis: `docker-compose ps` |
| Slow startup | Wait for DB init: `docker-compose logs mongodb` |
| High memory | Restart: `docker-compose restart app` |
| SSL error | Check certs: `ls -la ssl/{certs,keys}/` |
| Database locked | Restart MongoDB: `docker-compose restart mongodb` |

---

## Performance Tuning

```bash
# Increase workers
vi docker-compose.production.yml
# Modify: deploy.resources.limits.cpus to "4"

# Check resource usage
docker stats

# Monitor metrics
curl http://localhost/metrics
```

---

## Security Checklist

- [ ] `.env.production` contains production secrets
- [ ] `.env.production` is NOT committed to git
- [ ] SSL certificates installed and working
- [ ] Database password changed from default
- [ ] Redis password set
- [ ] All API keys configured
- [ ] Firewall configured (80/443 public, others internal)
- [ ] SSH keys configured for deployment user
- [ ] Backup storage location secured
- [ ] Monitoring alerts configured

---

## Deployment Verification

```bash
# Health checks
curl -s http://localhost/health | jq .status
curl -s http://localhost/health/detailed | jq '.components[] | select(.status != "UP")'

# Database check
docker exec fleetpro-mongodb mongosh -u admin -p "$MONGODB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval "db.customers.countDocuments()"

# API check
curl -s http://localhost/api/customers | jq .

# Performance check
ab -n 100 -c 10 http://localhost/

# SSL check
openssl s_client -connect localhost:443 < /dev/null | grep "Certificate\|Issuer"
```

---

## Maintenance Commands

```bash
# Update certificates
./ssl/setup-certificates.sh --renew

# Check certificate expiry
openssl x509 -in ssl/certs/fleetpro.crt -noout -dates

# Database statistics
docker exec fleetpro-mongodb mongosh -u admin -p "$PASSWORD" \
  --authenticationDatabase admin \
  fleetpro \
  --eval "db.stats()"

# View recent errors
docker-compose logs app | grep ERROR | tail -20

# Clean docker
docker system prune -a -f
docker volume prune -f
```

---

## Scaling

```bash
# Increase app resources
docker-compose up -d --scale app=3

# Load balance with nginx
vi nginx.conf
# Add more upstream servers:
# server app1:5050;
# server app2:5050;
# server app3:5050;
```

---

## Emergency Rollback

```bash
# Quick rollback to last commit
git reset --hard HEAD~1
docker-compose build --no-cache
docker-compose restart

# Rollback database
./database/restore-mongodb.sh /var/backups/fleetpro/mongodb/latest.tar.gz

# Full system restart
docker-compose down
docker-compose up -d
```

---

## File Locations Quick Reference

```
Configuration:  .env.production
Docker Build:   Dockerfile
Compose File:   docker-compose.production.yml
Web Server:     nginx.conf
Database Init:  database/init-mongodb.js
Seed Data:      database/seed-production.js
Backup Script:  database/backup-mongodb.sh
Restore Script: database/restore-mongodb.sh
SSL Setup:      ssl/setup-certificates.sh

Documentation:
- Deployment:   PRODUCTION_DEPLOYMENT_GUIDE.md
- Health:       HEALTH_CHECK_ENDPOINTS.md
- Summary:      PRODUCTION_INFRASTRUCTURE_SUMMARY.md
```

---

## Support Resources

- **Full Guide:** `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Monitoring:** `HEALTH_CHECK_ENDPOINTS.md`
- **Infrastructure:** `PRODUCTION_INFRASTRUCTURE_SUMMARY.md`
- **Docker Docs:** https://docs.docker.com
- **MongoDB:** https://docs.mongodb.com
- **Nginx:** https://nginx.org/en/docs

---

## One-Liners

```bash
# Start everything
docker-compose -f docker-compose.production.yml up -d && docker-compose -f docker-compose.observability.yml up -d

# Stop everything
docker-compose -f docker-compose.production.yml down && docker-compose -f docker-compose.observability.yml down

# View all logs
docker-compose logs -f --tail=100

# Check all services healthy
docker-compose ps | grep -v "Up\|Exited" && echo "All healthy" || echo "Some issues"

# Backup now
./database/backup-mongodb.sh

# Full system health report
curl -s http://localhost/health/detailed | jq .
curl -s http://localhost/health/dependencies | jq .

# Performance report
docker stats --no-stream

# Certificate status
openssl x509 -in ssl/certs/fleetpro.crt -text -noout | grep -E "Subject:|Not Before|Not After"
```

---

## Post-Deployment Checklist

- [ ] All services running: `docker-compose ps`
- [ ] Health endpoints responding: `curl http://localhost/health`
- [ ] Database accessible: `docker-compose logs mongodb`
- [ ] Redis connected: `redis-cli ping`
- [ ] SSL working: `curl -I https://localhost`
- [ ] API endpoints working: `curl http://localhost/api/customers`
- [ ] WebSocket working: Test booking creation
- [ ] Backups scheduled: `crontab -l | grep backup`
- [ ] Monitoring configured: Access Grafana
- [ ] Alerts setup: Check Prometheus rules
- [ ] Team trained: Runbook reviewed with ops team

---

**Time to Production:** ~15 minutes (including backups, monitoring, security)

**Status:** ✅ Production Ready

For detailed information, see the full deployment guide.
