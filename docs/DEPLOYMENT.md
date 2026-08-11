# FleetPro Fleet Compliance System - Deployment Guide

## Production Deployment Procedures

### Prerequisites

- PostgreSQL 12+ installed
- Node.js 16+ installed
- npm 7+ installed
- Docker (optional, for containerized deployment)
- Kubernetes cluster (optional, for cloud deployment)

### Environment Setup

1. **Database Configuration**

```bash
# Create PostgreSQL database
createdb fleetpro_production

# Create database user
createuser fleetpro_user -P

# Grant privileges
psql -d fleetpro_production -c "GRANT ALL PRIVILEGES ON DATABASE fleetpro_production TO fleetpro_user;"
```

2. **Environment Variables**

Create `.env.production`:

```env
# Database
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=fleetpro_production
DB_USER=fleetpro_user
DB_PASSWORD=<secure-password>
DB_SSL=true
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Authentication
JWT_SECRET=<generate-with-openssl-rand-hex-32>
JWT_EXPIRY=24h

# Features
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true
ENABLE_AUDIT_LOGGING=true
```

### Database Migration & Deployment

1. **Run Migrations**

```bash
# Backup existing database (if upgrading)
pg_dump fleetpro_production > backup-$(date +%Y%m%d).sql

# Run migration
npm run migrate -- 001_vehicle_compliance_schema.sql

# Verify schema
psql -d fleetpro_production -c "\dt"
```

2. **Create Indexes**

```bash
# Indexes are created by migration script automatically
# Verify indexes exist
psql -d fleetpro_production -c "\di"
```

3. **Seed Master Data** (optional)

```bash
# Load document types master data
npm run db:seed -- document-types-master.sql

# Load alert configuration defaults
npm run db:seed -- alert-config-defaults.sql
```

### Application Deployment

1. **Build Application**

```bash
# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Run tests
npm test

# Build Docker image (optional)
docker build -t fleetpro:1.0.0 .
```

2. **Start Server**

```bash
# Development
npm run dev

# Production
npm run start

# With PM2 (recommended)
pm2 start npm --name "fleetpro" -- start
pm2 save
pm2 startup
```

3. **Verify Deployment**

```bash
# Check health
curl http://localhost:3000/health
# Response: { "status": "ok", "timestamp": "...", "uptime": ... }

# Check readiness
curl http://localhost:3000/ready
# Response: { "status": "ready", "database": "connected", ... }

# Get metrics
curl http://localhost:3000/metrics
# Response: { "timestamp": "...", "uptime": ..., "memory": {...}, "cpu": {...} }
```

### Kubernetes Deployment

1. **Create ConfigMap for Environment**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fleetpro-config
  namespace: default
data:
  DB_HOST: postgres.default.svc.cluster.local
  DB_PORT: "5432"
  DB_NAME: fleetpro_production
  NODE_ENV: production
  PORT: "3000"
  LOG_LEVEL: info
```

2. **Create Secret for Credentials**

```bash
kubectl create secret generic fleetpro-secrets \
  --from-literal=DB_USER=fleetpro_user \
  --from-literal=DB_PASSWORD=<secure-password> \
  --from-literal=JWT_SECRET=<secure-secret>
```

3. **Deploy Pod**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fleetpro
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fleetpro
  template:
    metadata:
      labels:
        app: fleetpro
    spec:
      containers:
      - name: fleetpro
        image: fleetpro:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: fleetpro-config
        - secretRef:
            name: fleetpro-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

4. **Create Service**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: fleetpro-service
  namespace: default
spec:
  type: LoadBalancer
  selector:
    app: fleetpro
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

### Docker Deployment

1. **Dockerfile**

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/index.js"]
```

2. **docker-compose.yml**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: fleetpro_production
      POSTGRES_USER: fleetpro_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fleetpro_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  fleetpro:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: fleetpro_production
      DB_USER: fleetpro_user
      DB_PASSWORD: ${DB_PASSWORD}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  postgres_data:
```

3. **Deploy with Docker Compose**

```bash
# Start services
docker-compose up -d

# Verify services
docker-compose ps

# Check logs
docker-compose logs -f fleetpro

# Stop services
docker-compose down
```

### Monitoring & Logging

1. **Set Up Prometheus Monitoring**

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'fleetpro'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

Start Prometheus:

```bash
prometheus --config.file=prometheus.yml
```

2. **Set Up ELK Stack (Elasticsearch, Logstash, Kibana)**

Configure logging in application:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

3. **Set Up Alerts**

Configure alert rules in Prometheus:

```yaml
groups:
  - name: fleetpro
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      - alert: DatabaseDown
        expr: up{job="fleetpro"} == 0
        for: 1m
        annotations:
          summary: "Database connection failed"
```

### Backup & Recovery

1. **Automated Backups**

```bash
#!/bin/bash
# backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/fleetpro_${TIMESTAMP}.sql"

pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d fleetpro_production \
  > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp ${BACKUP_FILE}.gz s3://backups-bucket/

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Schedule with cron:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-db.sh
```

2. **Recovery Procedure**

```bash
# Stop application
pm2 stop fleetpro

# Restore database
gunzip -c backups/fleetpro_20260811_020000.sql.gz | psql -U fleetpro_user -d fleetpro_production

# Verify restore
psql -d fleetpro_production -c "SELECT COUNT(*) FROM vehicle_documents;"

# Restart application
pm2 start fleetpro
```

### Performance Tuning

1. **Database Connection Pooling**

```env
# Optimize pool settings
DB_POOL_SIZE=20          # Number of connections in pool
DB_IDLE_TIMEOUT=30000    # Close idle connections after 30s
DB_CONNECTION_TIMEOUT=10000  # Connect timeout 10s
```

2. **Query Optimization**

```bash
# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM vehicle_documents WHERE tenant_id = $1;

# Check index usage
SELECT schemaname, tablename, indexname FROM pg_indexes 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
```

3. **Application Tuning**

```env
NODE_ENV=production
# Enable production optimizations
NODE_OPTIONS=--max-old-space-size=512
```

### Rollback Procedure

```bash
# If issues detected after deployment:

# 1. Check current version
npm list fleetpro

# 2. Revert to previous version
npm install fleetpro@1.0.0

# 3. Rebuild
npm run build

# 4. Restart application
pm2 restart fleetpro

# 5. Verify health
curl http://localhost:3000/health
```

### Scaling Guidelines

- **Vertical Scaling:** Increase server resources (CPU, RAM)
- **Horizontal Scaling:** Run multiple instances behind load balancer
- **Database Scaling:** Use read replicas for read-heavy workloads
- **Caching:** Implement Redis for frequently accessed data

### Security Checklist

- [ ] All environment variables set securely
- [ ] Database SSL connection enabled
- [ ] JWT secret rotated
- [ ] Firewall rules configured
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Backups encrypted
- [ ] Audit logging enabled
- [ ] Monitoring alerts configured

### Support & Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

---

**Deployment Status: PRODUCTION-READY ✅**
