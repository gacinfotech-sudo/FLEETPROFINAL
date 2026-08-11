# FleetPro Production Deployment Guide

Complete step-by-step guide for deploying FleetPro to production.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Application Build](#application-build)
4. [Database Setup](#database-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Docker Deployment](#docker-deployment)
7. [Monitoring & Observability](#monitoring--observability)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

### Code Review & Testing

- [ ] All code merged to main branch
- [ ] TypeScript compilation successful: `npm run check`
- [ ] No TypeScript errors or warnings
- [ ] All unit tests passing: `npm test`
- [ ] All E2E tests passing (on isolated test database)
- [ ] Code review completed and approved
- [ ] Security audit completed
- [ ] No sensitive data in code/config files

### Environment Preparation

- [ ] Production server access verified
- [ ] SSH keys configured for deployment user
- [ ] Docker & Docker Compose installed (versions >= 20.10)
- [ ] MongoDB & Redis available or ready to containerize
- [ ] SSL certificates prepared or Let's Encrypt configured
- [ ] All required API keys obtained:
  - [ ] SendGrid API key
  - [ ] Twilio credentials
  - [ ] Google Maps API key
  - [ ] Stripe API keys
  - [ ] VAPID keys for push notifications
  - [ ] WhatsApp credentials
- [ ] Logging & monitoring stack configured (Prometheus, Grafana, ELK)
- [ ] Backup storage location prepared (local or S3)

### Infrastructure Requirements

- [ ] Server specs minimum:
  - [ ] 2+ CPU cores
  - [ ] 4GB+ RAM
  - [ ] 50GB+ free disk space
  - [ ] 100Mbps+ network connectivity
- [ ] Firewall rules configured:
  - [ ] Port 80 (HTTP) → Nginx
  - [ ] Port 443 (HTTPS) → Nginx
  - [ ] Port 27017 (MongoDB) - internal only
  - [ ] Port 6379 (Redis) - internal only
  - [ ] Port 5050 (Node.js app) - internal only
- [ ] Network connectivity verified
- [ ] Backup network path accessible
- [ ] Log aggregation service ready (if using ELK)

### Documentation

- [ ] Deployment runbook prepared
- [ ] Rollback procedures documented
- [ ] API documentation updated
- [ ] Architecture diagrams updated
- [ ] Team trained on deployment process
- [ ] Incident response plan reviewed
- [ ] Monitoring dashboards configured

---

## Infrastructure Setup

### 1. Prepare Server

```bash
# SSH into production server
ssh deployment@prod-server.com

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install required tools
sudo apt-get install -y \
    curl \
    git \
    wget \
    unzip \
    build-essential \
    python3 \
    jq \
    htop \
    tmux

# Create deployment user (if not exists)
sudo useradd -m -s /bin/bash fleetpro
sudo usermod -aG docker fleetpro
```

### 2. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $(whoami)

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 3. Create Directory Structure

```bash
# Create application directory
mkdir -p /opt/fleetpro
cd /opt/fleetpro

# Create necessary subdirectories
mkdir -p {
    data/mongodb,
    data/redis,
    logs,
    backups/mongodb/archive,
    backups/mongodb/logs,
    ssl/certs,
    ssl/keys,
    monitoring/prometheus,
    monitoring/grafana,
    monitoring/alertmanager
}

# Set permissions
chmod -R 755 /opt/fleetpro
chown -R fleetpro:fleetpro /opt/fleetpro
```

### 4. Clone Repository

```bash
cd /opt/fleetpro

# Clone from Git
git clone https://github.com/yourdomain/fleetpro.git .

# Checkout production tag
git checkout v1.0.0  # Replace with actual version tag

# Verify tag
git describe --tags
```

---

## Application Build

### 1. Build Docker Image

```bash
cd /opt/fleetpro

# Build production image
docker build \
    --tag fleetpro:latest \
    --tag fleetpro:v1.0.0 \
    --build-arg NODE_ENV=production \
    .

# Verify image
docker images | grep fleetpro
docker inspect fleetpro:latest
```

### 2. Push to Registry (Optional)

```bash
# Tag for registry
docker tag fleetpro:latest registry.example.com/fleetpro:latest
docker tag fleetpro:latest registry.example.com/fleetpro:v1.0.0

# Login to registry
docker login registry.example.com

# Push images
docker push registry.example.com/fleetpro:latest
docker push registry.example.com/fleetpro:v1.0.0
```

---

## Database Setup

### 1. Initialize MongoDB

```bash
cd /opt/fleetpro

# Start MongoDB container
docker-compose -f docker-compose.production.yml up -d mongodb

# Wait for MongoDB to be ready
sleep 10

# Initialize database
docker exec fleetpro-mongodb mongosh \
    --username admin \
    --password "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "db.adminCommand('ping')"

# Run initialization script (automatic on first start)
# or manual:
docker exec -i fleetpro-mongodb mongosh \
    --username admin \
    --password "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    < database/init-mongodb.js
```

### 2. Verify Database

```bash
# Check collections
docker exec fleetpro-mongodb mongosh \
    --username admin \
    --password "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "db.fleetpro.getCollectionNames()"

# Check indexes
docker exec fleetpro-mongodb mongosh \
    --username admin \
    --password "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    fleetpro \
    --eval "db.customers.getIndexes()"
```

### 3. Setup Backup Schedule

```bash
# Copy backup script
sudo cp database/backup-mongodb.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/backup-mongodb.sh

# Create cron job for daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mongodb.sh >> /opt/fleetpro/backups/mongodb/logs/cron.log 2>&1") | crontab -

# Verify cron job
crontab -l | grep backup-mongodb
```

---

## SSL/TLS Configuration

### 1. Generate Certificates (Choose One)

#### Option A: Self-Signed (Development Only)

```bash
cd /opt/fleetpro/ssl

# Generate self-signed certificate
./setup-certificates.sh --self-signed

# Verify
openssl x509 -in certs/fleetpro.crt -text -noout
```

#### Option B: Let's Encrypt (Production)

```bash
cd /opt/fleetpro/ssl

# Setup Let's Encrypt
DOMAIN_NAME=fleetpro.example.com \
LETSENCRYPT_EMAIL=admin@example.com \
./setup-certificates.sh --letsencrypt

# Verify
certbot certificates

# Test renewal
sudo certbot renew --dry-run
```

### 2. Verify Certificate

```bash
# Check certificate validity
openssl x509 -in /opt/fleetpro/ssl/certs/fleetpro.crt -text -noout

# Check key
openssl rsa -in /opt/fleetpro/ssl/keys/fleetpro.key -check

# Check certificate expiry
echo | openssl s_client -servername example.com -connect example.com:443 2>/dev/null | \
    openssl x509 -noout -dates
```

---

## Docker Deployment

### 1. Prepare Environment File

```bash
cd /opt/fleetpro

# Copy template to production config
cp .env.production.template .env.production

# Edit with actual values
nano .env.production

# Essential variables to configure:
# - MONGODB_ROOT_PASSWORD
# - REDIS_PASSWORD
# - SESSION_SECRET
# - JWT_SECRET
# - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
# - SendGrid API key
# - Twilio credentials
# - etc.

# Secure file permissions
chmod 600 .env.production
```

### 2. Create Docker Compose Overrides (Optional)

```bash
# For additional customization
cat > docker-compose.override.yml << 'EOF'
version: '3.8'

services:
  app:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

  mongodb:
    volumes:
      - /mnt/external-storage/mongodb:/data/db
EOF
```

### 3. Start Docker Services

```bash
cd /opt/fleetpro

# Start services
docker-compose -f docker-compose.production.yml up -d

# Monitor startup
docker-compose -f docker-compose.production.yml logs -f

# Check service status
docker-compose -f docker-compose.production.yml ps

# Expected output:
# NAME          STATUS      PORTS
# fleetpro-app   Up X sec    5050/tcp
# fleetpro-mongodb  Up X sec  27017/tcp
# fleetpro-redis    Up X sec  6379/tcp
# fleetpro-nginx    Up X sec  0.0.0.0:80,443->80,443/tcp
```

### 4. Verify Services are Healthy

```bash
# Check application health
curl http://localhost/health

# Check application detailed health
curl http://localhost/health/detailed

# Check MongoDB
docker exec fleetpro-mongodb mongosh \
    --username admin \
    --password "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "db.adminCommand('ping')"

# Check Redis
redis-cli -h localhost -p 6379 ping

# Check Nginx
curl -I http://localhost/
```

---

## Monitoring & Observability

### 1. Setup Prometheus

```bash
# Create prometheus configuration
mkdir -p /opt/fleetpro/monitoring/prometheus

cat > /opt/fleetpro/monitoring/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'fleetpro'
    static_configs:
      - targets: ['app:5050']
    metrics_path: '/metrics'

  - job_name: 'mongodb'
    static_configs:
      - targets: ['mongodb:27017']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
EOF
```

### 2. Start Observability Stack

```bash
cd /opt/fleetpro

# Start observability services
docker-compose -f docker-compose.observability.yml up -d

# Verify services
docker-compose -f docker-compose.observability.yml ps

# Access dashboards:
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000 (admin/admin)
# - Jaeger: http://localhost:16686
# - Kibana: http://localhost:5601
```

### 3. Configure Alerts

```bash
# Create alerting rules
mkdir -p /opt/fleetpro/monitoring/alerts

cat > /opt/fleetpro/monitoring/alerts.yml << 'EOF'
groups:
  - name: fleetpro_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseDown
        expr: up{job="mongodb"} == 0
        for: 1m
        annotations:
          summary: "Database is down"

      - alert: AppDown
        expr: up{job="fleetpro"} == 0
        for: 1m
        annotations:
          summary: "Application is down"
EOF
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Application health
curl -s http://localhost/health | jq .

# Detailed health
curl -s http://localhost/health/detailed | jq .

# Dependency health
curl -s http://localhost/health/dependencies | jq .

# Metrics available
curl -s http://localhost/metrics | head -20
```

### 2. Functional Tests

```bash
# Test API endpoints
curl -X GET http://localhost/api/customers

# Test authentication
curl -X POST http://localhost/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@fleetpro.com","password":"password"}'

# Test WebSocket
wscat -c ws://localhost/socket.io/?EIO=4&transport=websocket
```

### 3. Database Verification

```bash
# Count records in main collections
docker exec fleetpro-mongodb mongosh \
    -u admin -p "$MONGODB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    fleetpro \
    --eval '
        print("Customers:", db.customers.countDocuments());
        print("Bookings:", db.bookings.countDocuments());
        print("Vehicles:", db.vehicles.countDocuments());
        print("Drivers:", db.drivers.countDocuments());
    '
```

### 4. Performance Testing

```bash
# Install Apache Bench
sudo apt-get install -y apache2-utils

# Load test (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost/

# Monitor response times
while true; do
    time curl -s http://localhost/health > /dev/null
    sleep 1
done
```

### 5. Security Verification

```bash
# Test HTTPS redirect
curl -I http://localhost/

# Check SSL certificate
openssl s_client -connect localhost:443 -showcerts

# Check security headers
curl -I https://localhost/ | grep -E "Strict-Transport-Security|Content-Security-Policy|X-Frame-Options"

# Test rate limiting
for i in {1..150}; do curl -s http://localhost/ > /dev/null; done
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Check specific error
docker logs fleetpro-app 2>&1 | tail -50

# Verify environment variables
docker exec fleetpro-app env | grep -E "MONGODB|REDIS|NODE"

# Restart service
docker-compose -f docker-compose.production.yml restart app
```

### Database Connection Issues

```bash
# Check MongoDB is running
docker ps | grep mongodb

# Test connection from app container
docker exec fleetpro-app mongosh \
    mongodb://admin:PASSWORD@mongodb:27017/fleetpro?authSource=admin \
    --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker logs fleetpro-mongodb | tail -50

# Verify connection string in .env.production
grep MONGODB_URI .env.production
```

### High Memory Usage

```bash
# Check container memory
docker stats

# Check Node.js heap
docker exec fleetpro-app node -e "console.log(require('v8').getHeapStatistics())"

# Check database indices
docker exec fleetpro-mongodb mongosh -u admin -p PASSWORD --authenticationDatabase admin \
    fleetpro --eval "db.currentOp()"

# Restart service
docker restart fleetpro-app
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /opt/fleetpro/ssl/certs/fleetpro.crt -text -noout

# Check key matches certificate
openssl x509 -noout -modulus -in /opt/fleetpro/ssl/certs/fleetpro.crt | openssl md5
openssl rsa -noout -modulus -in /opt/fleetpro/ssl/keys/fleetpro.key | openssl md5

# Restart Nginx
docker-compose -f docker-compose.production.yml restart nginx
```

---

## Rollback Procedures

### Quick Rollback (Last Backup)

```bash
# Stop all services
docker-compose -f docker-compose.production.yml down

# Restore from last backup
./database/restore-mongodb.sh /var/backups/fleetpro/mongodb/latest-backup.tar.gz

# Start services again
docker-compose -f docker-compose.production.yml up -d

# Verify
docker-compose -f docker-compose.production.yml ps
curl http://localhost/health
```

### Rollback to Previous Version

```bash
cd /opt/fleetpro

# Stop services
docker-compose -f docker-compose.production.yml down

# Checkout previous version
git checkout v1.0.0  # Previous stable version

# Rebuild image
docker build -t fleetpro:previous .

# Update compose file
sed -i 's/fleetpro:latest/fleetpro:previous/' docker-compose.production.yml

# Start with previous version
docker-compose -f docker-compose.production.yml up -d

# Verify
curl http://localhost/health
```

### Complete System Recovery

```bash
# 1. Stop all services
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.observability.yml down

# 2. Restore database from backup
./database/restore-mongodb.sh /var/backups/fleetpro/mongodb/backup-before-deployment.tar.gz

# 3. Remove old containers and images
docker system prune -a -f

# 4. Checkout stable version
git checkout v1.0.0

# 5. Rebuild everything
docker-compose -f docker-compose.production.yml build --no-cache

# 6. Start services
docker-compose -f docker-compose.production.yml up -d
docker-compose -f docker-compose.observability.yml up -d

# 7. Monitor logs
docker-compose -f docker-compose.production.yml logs -f
```

---

## Post-Deployment Monitoring

### Daily Tasks

- [ ] Check error logs for any issues
- [ ] Verify all services are running
- [ ] Monitor resource usage (CPU, memory, disk)
- [ ] Check database backup completion
- [ ] Review application metrics and performance

### Weekly Tasks

- [ ] Review security logs
- [ ] Check for database maintenance needs
- [ ] Verify backup integrity by test restore
- [ ] Review and analyze error patterns
- [ ] Check SSL certificate expiration (if manual)

### Monthly Tasks

- [ ] Full system audit
- [ ] Update dependencies and security patches
- [ ] Disaster recovery drill
- [ ] Performance analysis and optimization
- [ ] Capacity planning review

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Production Guide](https://docs.mongodb.com/manual/administration/production-notes/)
- [Nginx Production Guide](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Prometheus Alerting](https://prometheus.io/docs/alerting/latest/overview/)

---

## Support & Escalation

For deployment issues:

1. Check logs: `docker-compose logs [service]`
2. Review this guide's troubleshooting section
3. Contact DevOps team: devops@fleetpro.com
4. Open incident: incident@fleetpro.com

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-08-12  
**Maintained By:** DevOps Team  
**Next Review:** 2026-09-12
