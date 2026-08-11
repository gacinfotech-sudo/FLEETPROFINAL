# FleetPro Fleet Compliance System - Troubleshooting Guide

## Common Issues & Solutions

### Database Connection Issues

#### Issue: "PostgreSQL connection refused"

**Symptoms:**
- GET /ready returns status 503
- Logs show "connect ECONNREFUSED"

**Solutions:**

1. Check PostgreSQL is running:
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Windows
netsh advfirewall firewall show rule name="PostgreSQL"
```

2. Verify connection parameters:
```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

3. Check database exists:
```bash
psql -U postgres -l | grep fleetpro_production
```

4. Verify user permissions:
```bash
psql -d fleetpro_production -c "GRANT ALL PRIVILEGES ON SCHEMA public TO fleetpro_user;"
```

---

#### Issue: "Too many connections"

**Symptoms:**
- Error: "remaining connection slots are reserved for non-replication superuser connections"
- Multiple failed API requests

**Solutions:**

1. Check active connections:
```bash
psql -d fleetpro_production -c "SELECT * FROM pg_stat_activity;"
```

2. Kill idle connections:
```bash
psql -d fleetpro_production -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state='idle' AND query_start < now() - interval '10 minutes';
"
```

3. Increase connection pool (restart required):
```env
DB_POOL_SIZE=50
```

---

### Performance Issues

#### Issue: "Queries are slow"

**Symptoms:**
- High response times (> 5 seconds)
- High CPU usage
- Timeout errors

**Solutions:**

1. Check index usage:
```bash
psql -d fleetpro_production -c "
  SELECT schemaname, tablename, indexname, idx_scan 
  FROM pg_stat_user_indexes 
  ORDER BY idx_scan DESC;
"
```

2. Analyze query performance:
```bash
psql -d fleetpro_production -c "
  EXPLAIN ANALYZE 
  SELECT * FROM vehicle_documents 
  WHERE tenant_id = 'test-tenant' AND is_active = true;
"
```

3. Vacuum and analyze:
```bash
psql -d fleetpro_production -c "VACUUM ANALYZE;"
```

4. Check missing indexes:
```bash
psql -d fleetpro_production -c "
  SELECT schemaname, tablename, attname 
  FROM pg_stat_user_tables 
  WHERE seq_scan > 1000;
"
```

---

#### Issue: "High memory usage"

**Symptoms:**
- Process memory > 512MB
- Application crashes
- OOM errors in logs

**Solutions:**

1. Check memory status:
```bash
curl http://localhost:3000/metrics
# Look for memory.heapUsed
```

2. Increase Node heap size:
```env
NODE_OPTIONS=--max-old-space-size=1024
```

3. Enable garbage collection logging:
```bash
NODE_OPTIONS="--max-old-space-size=1024 --trace-gc"
```

4. Restart application:
```bash
pm2 restart fleetpro
```

---

### Authentication Issues

#### Issue: "401 Unauthorized on all requests"

**Symptoms:**
- All API requests return 401
- Error: "Invalid token"

**Solutions:**

1. Verify JWT token is valid:
```bash
# Decode token at https://jwt.io
# Check expiry: exp field should be > current timestamp
```

2. Check JWT_SECRET is set:
```bash
echo $JWT_SECRET
# Should not be empty
```

3. Generate new token:
```bash
# Use authentication service to get fresh token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'
```

4. Clear token cache (if applicable):
```bash
# Clear browser localStorage
localStorage.clear()
```

---

#### Issue: "403 Forbidden - tenant_id mismatch"

**Symptoms:**
- Error: "Unauthorized"
- Cannot access resources

**Solutions:**

1. Verify tenant_id in token matches request:
```bash
# Decode JWT and check tenant_id claim
# Verify it matches the tenant_id in database queries
```

2. Check token scopes:
```bash
# Ensure token has required permissions
```

---

### Application Issues

#### Issue: "Application won't start"

**Symptoms:**
- Exit code 1
- Port already in use
- Module not found errors

**Solutions:**

1. Check port availability:
```bash
lsof -i :3000
# Kill if occupied
kill -9 <PID>
```

2. Check dependencies:
```bash
npm ci --production
npm run build
```

3. Check configuration:
```bash
# Verify all required env vars are set
env | grep DB_
env | grep NODE_
```

4. Check logs:
```bash
pm2 logs fleetpro
```

---

#### Issue: "TypeScript compilation errors"

**Symptoms:**
- Build fails
- TS2307 errors
- Cannot find module

**Solutions:**

1. Clean build:
```bash
rm -rf dist/
npm run build
```

2. Check tsconfig.json:
```bash
# Verify compiler options
cat tsconfig.json | jq .compilerOptions
```

3. Verify type definitions:
```bash
# Check node_modules/@types exists
ls node_modules/@types/
```

---

### Data Issues

#### Issue: "Missing documents after deployment"

**Symptoms:**
- Data appears to be lost
- Queries return no results

**Solutions:**

1. Check if migration ran:
```bash
psql -d fleetpro_production -c "\dt"
# Verify all tables exist
```

2. Check data exists:
```bash
psql -d fleetpro_production -c "SELECT COUNT(*) FROM vehicle_documents;"
```

3. Check soft deletes didn't hide data:
```bash
psql -d fleetpro_production -c "
  SELECT COUNT(*) FROM vehicle_documents WHERE is_active = false;
"
```

4. Restore from backup if needed:
```bash
gunzip -c backups/fleetpro_20260811_020000.sql.gz | psql -U fleetpro_user
```

---

#### Issue: "Data integrity errors"

**Symptoms:**
- Foreign key violations
- Constraint errors
- Duplicate key errors

**Solutions:**

1. Check constraints:
```bash
psql -d fleetpro_production -c "
  SELECT constraint_name, table_name, constraint_type 
  FROM information_schema.table_constraints 
  WHERE table_name IN ('vehicle_documents', 'document_alerts');
"
```

2. Check for orphaned records:
```bash
psql -d fleetpro_production -c "
  SELECT * FROM vehicle_documents 
  WHERE vehicle_id NOT IN (SELECT id FROM vehicles);
"
```

3. Clean up orphaned data:
```bash
psql -d fleetpro_production -c "
  DELETE FROM vehicle_documents 
  WHERE vehicle_id NOT IN (SELECT id FROM vehicles);
"
```

---

### Network Issues

#### Issue: "Cannot reach API from client"

**Symptoms:**
- CORS errors
- Connection refused
- Timeout errors

**Solutions:**

1. Check CORS configuration:
```bash
# Verify CORS_ORIGIN env var is set correctly
echo $CORS_ORIGIN
```

2. Test endpoint directly:
```bash
curl -v http://localhost:3000/health
```

3. Check firewall:
```bash
# Check if port 3000 is open
sudo ufw status | grep 3000
```

4. Check SSL certificate (if HTTPS):
```bash
openssl s_client -connect api.fleetpro.example.com:443
```

---

### Kubernetes Issues

#### Issue: "Pod CrashLoopBackOff"

**Symptoms:**
- Pod keeps restarting
- Status shows CrashLoopBackOff
- Health check failing

**Solutions:**

1. Check pod status:
```bash
kubectl describe pod fleetpro-xxxxx
# Check events section for errors
```

2. Check logs:
```bash
kubectl logs -f deployment/fleetpro
```

3. Check readiness probe:
```bash
kubectl get pod fleetpro-xxxxx -o yaml | grep readinessProbe
```

4. Increase initial delay if database slow:
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 30  # Increase from 10
  periodSeconds: 5
```

---

#### Issue: "Service timeout"

**Symptoms:**
- GET /ready times out
- kubectl exec hangs

**Solutions:**

1. Check resource limits:
```bash
kubectl top pod fleetpro-xxxxx
# Check if CPU/memory at limit
```

2. Increase resources:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

3. Check DNS resolution:
```bash
kubectl exec -it fleetpro-xxxxx -- nslookup postgres
```

---

### Monitoring Issues

#### Issue: "Prometheus scrape failed"

**Symptoms:**
- Prometheus shows "DOWN" for fleetpro job
- No metrics collected

**Solutions:**

1. Check metrics endpoint:
```bash
curl -v http://localhost:3000/metrics
```

2. Verify Prometheus config:
```yaml
scrape_configs:
  - job_name: 'fleetpro'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

3. Check firewall allows Prometheus:
```bash
telnet localhost 3000
```

---

## Debugging Tips

### Enable Debug Logging

```env
LOG_LEVEL=debug
DEBUG=fleetpro:*
```

### Check Process Status

```bash
# PM2 status
pm2 status

# Process info
ps aux | grep node

# Port usage
netstat -tulpn | grep 3000
```

### Database Debugging

```bash
# Connect to database
psql -d fleetpro_production -U fleetpro_user

# Check current queries
SELECT pid, query FROM pg_stat_activity;

# View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 5;
```

### Network Debugging

```bash
# Test connectivity
curl -v http://localhost:3000/health

# Check DNS
nslookup api.fleetpro.example.com

# Trace network
traceroute api.fleetpro.example.com
```

---

## Performance Optimization Checklist

- [ ] Database indexes created
- [ ] Connection pooling configured
- [ ] Query monitoring enabled
- [ ] Memory limits set appropriately
- [ ] CPU limits tuned
- [ ] Caching implemented
- [ ] Load testing completed
- [ ] Metrics collection working
- [ ] Alerts configured
- [ ] Backup strategy tested

---

## Support Resources

- **GitHub Issues:** https://github.com/fleetpro/issues
- **Documentation:** https://docs.fleetpro.com
- **API Reference:** `/docs/API.md`
- **Deployment Guide:** `/docs/DEPLOYMENT.md`
- **Community Forum:** https://forum.fleetpro.com

---

**Last Updated:** 2026-08-11  
**Maintained By:** FleetPro Platform Team
