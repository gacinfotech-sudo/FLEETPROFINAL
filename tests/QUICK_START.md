# FLEETPRO TESTING QUICK START GUIDE

## 30-Second Setup

```bash
# 1. Install dependencies (if needed)
npm install

# 2. Start development server (in another terminal)
npm run dev

# 3. Run full test suite
npm run test:all
```

## Common Commands

```bash
# Full production-ready validation (1000+ checks)
npm run test:orchestrate

# Fast smoke test (quick validation)
npm run test:smoke

# Autonomous framework (450+ checks)
npm run test:framework

# Health monitoring (continuous, 60 min)
npm run test:health

# Verbose output (see all details)
npm run test:orchestrate:verbose
```

## Test Results

Tests save reports to `./reports/` directory:

```bash
# View latest report
cat reports/orchestrator-*.json | tail -1

# Pretty print JSON
npm list | grep -A 1000 "test"
```

## Quick Checklist

Before deploying to production:

- [ ] Run: `npm run test:all`
- [ ] Check: Overall status is "APPROVED"
- [ ] Review: Readiness score >= 90
- [ ] Verify: 0 failed test suites
- [ ] Read: Recommendations in report
- [ ] Confirm: No critical issues
- [ ] Deploy when all ✅

## Test Status Meanings

| Status | What It Means | Action |
|--------|--------------|--------|
| ✅ PASS | Ready to go | Deploy! |
| ⚠️ AUTO_FIXED | Fixed automatically | Monitor closely |
| ❌ FAIL | Issues found | Fix before deploying |
| 🔴 CRITICAL | System error | Check logs |

## Exit Codes

```bash
# 0 = All tests passed ✅
# 1 = Auto-fixed issues ⚠️
# 2 = Tests failed ❌
# 3 = System error 🔴
```

## Monitoring

For continuous monitoring during operations:

```bash
# Run 24-hour monitoring loop
MONITOR_DURATION=1440 npm run test:health

# Custom duration (120 minutes)
MONITOR_DURATION=120 npm run test:health

# Will auto-fix issues and report status every 30 seconds
```

## Deployment Decision

```
PASS ──────────────────> ✅ DEPLOY NOW
  
AUTO_FIXED ─────────────> ⚠️ DEPLOY WITH CAUTION
  
FAIL ──────────────────> ❌ DO NOT DEPLOY
```

## Troubleshooting

### Tests won't run
```bash
# Check Node.js version
node --version  # Should be >= 16

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start fresh
npm run test:smoke
```

### Database connection errors
```bash
# Verify MongoDB running
mongosh --eval "db.runCommand({ ping: 1 })"

# Set correct URI
export MONGODB_URI=mongodb://127.0.0.1:27017/fleetpro
npm run test:framework
```

### Server connection errors
```bash
# Check if dev server is running
curl http://localhost:5050/health

# Start dev server
npm run dev

# Then run tests in another terminal
npm run test:smoke
```

### Tests timeout
```bash
# Increase timeout
export TEST_TIMEOUT=20000

# Check server performance
curl -w "@curl-format.txt" http://localhost:5050/api/customers
```

## What Gets Tested

### 1000+ Automated Checks

- 50+ API Endpoints
- 100+ Features
- 80+ Database validations
- 60+ UI Components
- 50+ Security checks
- 40+ Performance tests
- 80+ Integration tests
- 50+ Critical flows

## Reports & Logs

```bash
# View all reports
ls -la reports/

# View latest report
cat reports/orchestrator-*.json | jq '.summary'

# Export to CSV
npm run test:all > test-results.txt
```

## Performance Targets

- Response time: < 500ms
- Error rate: < 1%
- Load capacity: 10+ concurrent users
- Uptime: 99.9%+
- Database latency: < 100ms

## Next Steps

1. ✅ Run `npm run test:all`
2. ✅ Check status is "APPROVED"
3. ✅ Review readiness score
4. ✅ Read recommendations
5. ✅ Deploy to production
6. ✅ Monitor with `npm run test:health`

---

**Need more details?** See `TESTING_FRAMEWORK.md` for comprehensive guide.
