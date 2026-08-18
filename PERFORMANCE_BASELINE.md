# Performance Baseline & Load Testing - FleetPro
**Status**: Ready to Execute  
**Date**: 2026-08-15  
**Priority**: P2 (2 weeks)  
**Objective**: Establish performance metrics and identify bottlenecks

---

## Overview

This document describes the performance testing infrastructure created for the FleetPro recovered system. The infrastructure consists of 4 integrated testing modules + 2 helper scripts that measure system performance across:

1. **Baseline Response Times** (single-user performance)
2. **Load Testing** (concurrent users: 10, 50, 100)
3. **Memory Profiling** (leak detection)
4. **Database Query Analysis** (index efficiency)

---

## Quick Start

### Prerequisites

```bash
# Ensure Node.js and MongoDB are running
PORT=5050 npm run dev  # In fleetpro-main directory
```

### Run All Tests

```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main

# Method 1: Master test runner (Recommended)
./scripts/perf-baseline.sh

# Method 2: Individual tests
tsx load-test/baseline.ts
tsx load-test/load-test.ts
tsx load-test/memory-profile.ts
tsx load-test/db-analysis.ts
tsx load-test/analyze-results.ts
```

**Expected Duration**: 10-15 minutes total

### Quick Health Check

```bash
./scripts/quick-test.sh health
```

---

## Project Files Structure

### Load Testing Infrastructure

```
/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/load-test/
├── README.md                    # Comprehensive testing guide
├── baseline.ts                  # Single-user baseline tests
├── load-test.ts                # Concurrent user load tests
├── memory-profile.ts           # Memory usage profiling
├── db-analysis.ts             # Database query analysis
├── analyze-results.ts          # Results consolidation
└── results/                    # Test results directory (auto-created)
    ├── baseline-*.json
    ├── load-test-*.json
    ├── load-test-summary-*.json
    ├── memory-profile-*.json
    ├── db-analysis-*.json
    └── performance-report-*.json
```

### Helper Scripts

```
/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/scripts/
├── perf-baseline.sh            # Master test runner
└── quick-test.sh              # Quick health checks
```

### Documentation

```
/Users/pradeep/fleetpro-final-recovery/
└── PERFORMANCE_BASELINE.md     # This file
```

---

## Test Modules Detail

### 1. Baseline Tests (`baseline.ts`)

**Purpose**: Measure single-user response times for critical endpoints

**Endpoints Tested**:
- Root login (target: <500ms)
- Tenant login (target: <500ms)
- Customer list (target: <2s)
- Driver list (target: <1s)
- Booking create (target: <1s)
- Search by mobile (target: <1s)
- Dashboard stats (target: <2s)
- Vehicle list (target: <1s)

**Iterations**: 5 per endpoint  
**Duration**: ~2-3 minutes  
**Output**: `baseline-{timestamp}.json`

**Run individually**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
tsx load-test/baseline.ts
```

### 2. Load Tests (`load-test.ts`)

**Purpose**: Measure performance under concurrent user load

**Concurrency Levels**:
- 10 concurrent users (500 requests per endpoint)
- 50 concurrent users (500 requests per endpoint) ← Critical threshold
- 100 concurrent users (500 requests per endpoint)

**Endpoints Tested**:
- Customer list
- Driver list
- Dashboard stats

**Success Criteria**:
- 50 users: avg <2s, P95 <5s, error rate <5%
- 100 users: measurable degradation, recoverable

**Duration**: ~5-7 minutes  
**Output**: 
- `load-test-{timestamp}.json` (detailed)
- `load-test-summary-{timestamp}.json` (aggregated)

**Run individually**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
tsx load-test/load-test.ts
```

### 3. Memory Profiling (`memory-profile.ts`)

**Purpose**: Detect memory leaks and monitor heap usage

**Phases**:
1. Baseline (10s, no load)
2. Light load (30s, 10 concurrent users)
3. Medium load (30s, 50 concurrent users)
4. Heavy load (30s, 100 concurrent users)
5. Recovery (10s, after load stops)

**Leak Detection**:
- <10% growth: ✅ Pass
- 10-30% growth: ⚠️ Minor retention
- >30% growth: ❌ Likely leak

**Duration**: ~3-4 minutes  
**Output**: `memory-profile-{timestamp}.json`

**Run individually**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
tsx load-test/memory-profile.ts
```

### 4. Database Analysis (`db-analysis.ts`)

**Purpose**: Analyze query performance and index efficiency

**Collections Analyzed**:
- customers
- drivers
- bookings
- vehicles
- users

**Metrics**:
- Document count
- Collection size
- Index efficiency
- Query scan ratio
- Full collection scan detection (COLLSCAN)

**Queries Tested**:
- Find by ID
- Find by mobile/email
- Find by tenantId
- Find by status
- Find by date range
- Compound queries

**Issues Identified**:
- Full collection scans (missing indexes)
- Inefficient queries (scan ratio >10x)
- Index recommendations

**Duration**: ~2-3 minutes  
**Output**: `db-analysis-{timestamp}.json`

**Run individually**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
tsx load-test/db-analysis.ts
```

### 5. Results Analysis (`analyze-results.ts`)

**Purpose**: Consolidate all results into comprehensive report

**Inputs**: All previously generated JSON files  
**Output**: `performance-report-{timestamp}.json`

**Contains**:
- Baseline performance summary
- Load test results by concurrency level
- Memory profile analysis
- Database efficiency report
- Performance grade (A-F)
- Specific recommendations

**Run individually**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
tsx load-test/analyze-results.ts
```

---

## Helper Scripts

### Master Test Runner (`perf-baseline.sh`)

Runs all tests sequentially with proper timing and error handling.

**Features**:
- Checks server is running
- Waits appropriately between tests
- Colored output
- Automatic result consolidation
- Error handling and recovery

**Usage**:
```bash
cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
chmod +x scripts/perf-baseline.sh
./scripts/perf-baseline.sh
```

**What it does**:
1. Verifies server on port 5050
2. Runs baseline tests (2-3 min)
3. Waits 30s, runs load tests (5-7 min)
4. Waits 30s, runs memory tests (3-4 min)
5. Runs database analysis (2-3 min)
6. Generates comprehensive report
7. Prints summary to console

### Quick Test Script (`quick-test.sh`)

Lightweight utility for quick checks and endpoint testing.

**Commands**:
```bash
./scripts/quick-test.sh health              # Check if server is running
./scripts/quick-test.sh endpoint /api/path  # Test specific endpoint (5 requests)
./scripts/quick-test.sh baseline            # Quick baseline (30s)
./scripts/quick-test.sh load                # Quick load test (1m)
./scripts/quick-test.sh memory              # Quick memory profile (1m)
```

**Usage Examples**:
```bash
# Check server health
./scripts/quick-test.sh health

# Test customer list endpoint
./scripts/quick-test.sh endpoint /api/customers

# Quick baseline test
./scripts/quick-test.sh baseline

# Quick load test with 50 concurrent users
./scripts/quick-test.sh load
```

---

## Performance Targets & Success Criteria

### Baseline Tests (Single User)

| Endpoint | Target | Status |
|----------|--------|--------|
| Root login | <500ms | TBD |
| Tenant login | <500ms | TBD |
| Customer list | <2s | TBD |
| Driver list | <1s | TBD |
| Booking create | <1s | TBD |
| Search | <1s | TBD |
| Dashboard | <2s | TBD |

**Criteria**: 7/8 endpoints <target = PASS

### Load Tests (50 Concurrent Users)

- ✅ Average response <2s
- ✅ P95 latency <5s
- ✅ Error rate <5%
- ✅ System stable

### Load Tests (100 Concurrent Users)

- ✅ Measurable degradation (not failure)
- ✅ System recoverable
- ✅ Error rate <20%
- ✅ Identifies breaking point

### Memory Profile

- ✅ No memory leaks (<10% growth baseline→recovery)
- ✅ Memory returns to baseline
- ✅ Peak reasonable for workload

### Database Performance

- ✅ No full collection scans (COLLSCAN)
- ✅ Efficient query scan ratios
- ✅ Proper index coverage

---

## Interpreting Results

### Performance Grades

| Grade | Meaning | Action |
|-------|---------|--------|
| A | All targets met | Monitor regularly |
| B | Minor issues (some queries >target) | Optimize in 2-3 weeks |
| C | Moderate issues (error rates at load) | Optimize this week |
| D | Significant issues (system struggles) | Critical optimization needed |
| F | Complete failure | System not production-ready |

### Key Metrics

**Response Time Percentiles**:
- **Avg**: Average of successful requests
- **P95**: 95% of requests faster than this (95th percentile)
- **P99**: 99% of requests faster than this
- **Max**: Slowest request

**Success Rate**:
- Percentage with HTTP status <400
- Target: >95% under load

**Memory Growth**:
- % increase from baseline to recovery
- <10%: Normal ✅
- 10-30%: Monitor ⚠️
- >30%: Likely leak ❌

**Query Efficiency**:
- Ratio of documents scanned vs returned
- High ratio = inefficient or missing index
- COLLSCAN = full table scan = needs index

---

## Expected Results (Recovered System)

Based on system specifications and data volume:

```
BASELINE PERFORMANCE (Single User)
├─ Root login: 200-400ms ✓
├─ Tenant login: 300-500ms ✓
├─ Customer list (1,730 docs): 800-1500ms ✓
├─ Driver list (255 docs): 300-800ms ✓
├─ Booking create: 400-800ms ✓
├─ Search: 500-1000ms ✓
└─ Dashboard: 1000-2000ms ✓

LOAD TEST RESULTS (50 concurrent)
├─ Customer list: 1-3s avg ✓
├─ Driver list: 500ms-2s avg ✓
└─ Dashboard: 2-5s avg ✓

MEMORY PROFILE
├─ Baseline: 100-150 MB
├─ Under load: 200-300 MB
└─ Growth: <20% ✓

DATABASE PERFORMANCE
├─ Avg query time: 10-50ms ✓
├─ Slow queries (>100ms): <5 ✓
└─ Full scans: 0 ✓
```

---

## Optimization Recommendations

### If Baseline is Slow

1. **Add missing indexes**
   ```javascript
   db.customers.createIndex({ mobile: 1 })
   db.customers.createIndex({ email: 1 })
   db.drivers.createIndex({ tenantId: 1, status: 1 })
   db.bookings.createIndex({ customerId: 1, status: 1 })
   ```

2. **Optimize database queries**
   - Use projection (select only needed fields)
   - Add pagination
   - Use compound indexes

3. **Implement response caching**
   - Cache frequently accessed data
   - Use Redis for session cache

### If Load Tests Fail

1. **Increase database connection pool**
   ```env
   DB_POOL_SIZE=30
   DB_TIMEOUT=10000
   ```

2. **Implement request queuing**
   - Use Bull/BullMQ for task queue
   - Process in batches

3. **Add load balancing**
   - Use PM2 cluster mode
   - Distribute across multiple server instances

4. **Implement rate limiting**
   - Throttle high-volume endpoints
   - Queue long-running operations

### If Memory Leaks Detected

1. **Profile with Node.js inspector**
   ```bash
   node --inspect server/index.ts
   # Then open chrome://inspect in Chrome
   ```

2. **Check for common issues**:
   - Event listeners not removed
   - Timers/intervals not cleared
   - Circular references in cache
   - Growing collections

3. **Add monitoring**:
   ```typescript
   setInterval(() => {
     const mem = process.memoryUsage();
     console.log(`Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
   }, 60000);
   ```

---

## Continuous Monitoring

### Setup Automated Tests

```bash
# Add to cron (run daily at 2 AM)
# 0 2 * * * cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main && ./scripts/perf-baseline.sh

# Or run manually
./scripts/perf-baseline.sh

# Or run quick health check
./scripts/quick-test.sh health
```

### Track Performance Over Time

```bash
# Compare results between runs
ls -la load-test/results/
cat load-test/results/performance-report-*.json | jq '.summary'
```

### Set Performance Alerts

Monitor for:
- Response time >2s at baseline
- Error rate >5% at 50 users
- Memory growth >20%
- New full collection scans

---

## Troubleshooting

### Server Not Running

```bash
PORT=5050 npm run dev
# If port 5050 is in use:
lsof -i :5050
kill -9 <PID>
```

### Tests Timeout

- Check server is responsive: `./scripts/quick-test.sh health`
- Reduce concurrent user count in load-test.ts
- Increase timeout values
- Check database connectivity

### Database Connection Fails

```bash
# Test MongoDB connection
mongosh --eval "db.adminCommand('ping')"

# Check MONGODB_URI
grep MONGODB_URI .env

# View connection logs
tail -f .server-5050.log | grep -i "mongo\|database"
```

### No Results Files Generated

```bash
# Check results directory exists
ls -la load-test/results/

# Check disk space
df -h

# Run individual test with verbose output
tsx load-test/baseline.ts 2>&1
```

### High Error Rates

- Check server logs for errors
- Verify API endpoints exist
- Check authentication/authorization
- Reduce concurrency level

### Out of Memory During Tests

- Close other applications
- Reduce concurrent user count
- Increase Node.js heap size:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" tsx load-test/load-test.ts
  ```

---

## Files Created

### Performance Testing Infrastructure

| File | Purpose | Type | Size |
|------|---------|------|------|
| load-test/baseline.ts | Single-user baseline | TypeScript | ~400 LOC |
| load-test/load-test.ts | Concurrent load tests | TypeScript | ~450 LOC |
| load-test/memory-profile.ts | Memory leak detection | TypeScript | ~400 LOC |
| load-test/db-analysis.ts | Database query analysis | TypeScript | ~350 LOC |
| load-test/analyze-results.ts | Results consolidation | TypeScript | ~500 LOC |
| scripts/perf-baseline.sh | Master test runner | Shell | ~150 lines |
| scripts/quick-test.sh | Quick health checks | Shell | ~200 lines |
| load-test/README.md | Comprehensive guide | Markdown | ~500 lines |
| PERFORMANCE_BASELINE_TEMPLATE.md | Report template | Markdown | ~400 lines |

**Total**: ~2,500+ LOC of testing infrastructure

### Generated Files (After Tests Run)

```
load-test/results/
├── baseline-1724000000000.json
├── load-test-1724000060000.json
├── load-test-summary-1724000120000.json
├── memory-profile-1724000180000.json
├── db-analysis-1724000240000.json
└── performance-report-1724000300000.json
```

---

## Timeline & Milestones

### Week 1 (2026-08-15 to 2026-08-21)

- [x] Create performance testing infrastructure
- [ ] Run baseline tests
- [ ] Run load tests
- [ ] Run memory profiling
- [ ] Run database analysis
- [ ] Generate comprehensive report
- [ ] Identify bottlenecks
- [ ] Prioritize optimizations

### Week 2 (2026-08-22 to 2026-08-28)

- [ ] Implement database optimizations (indexes)
- [ ] Implement caching if needed
- [ ] Re-run performance tests
- [ ] Validate improvements
- [ ] Document results

### Ongoing

- [ ] Weekly quick health checks
- [ ] Monthly full test suite
- [ ] Continuous monitoring
- [ ] Performance regression detection

---

## Success Criteria Checklist

### Infrastructure Setup
- [x] Baseline testing module created
- [x] Load testing module created
- [x] Memory profiling module created
- [x] Database analysis module created
- [x] Results analyzer created
- [x] Master test runner created
- [x] Quick test helper created
- [x] Comprehensive documentation created

### Testing Execution (To Be Completed)
- [ ] Baseline tests run successfully
- [ ] Load tests run successfully
- [ ] Memory profiling completed
- [ ] Database analysis completed
- [ ] Results consolidated
- [ ] Report generated

### Analysis & Recommendations
- [ ] Bottlenecks identified
- [ ] Optimization opportunities listed
- [ ] Performance grade assigned
- [ ] Recommendations prioritized

---

## Support & Reference

### Documentation Files

- `load-test/README.md` - Comprehensive testing guide
- `PERFORMANCE_BASELINE_TEMPLATE.md` - Report template
- `PERFORMANCE_BASELINE.md` - This file

### Key Commands

```bash
# Run all tests
./scripts/perf-baseline.sh

# Run specific test
tsx load-test/baseline.ts
tsx load-test/load-test.ts
tsx load-test/memory-profile.ts
tsx load-test/db-analysis.ts
tsx load-test/analyze-results.ts

# Quick checks
./scripts/quick-test.sh health
./scripts/quick-test.sh endpoint /api/customers

# View results
ls -la load-test/results/
cat load-test/results/performance-report-*.json | jq '.'
```

### Important Directories

```
/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/load-test/
/Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main/scripts/
/Users/pradeep/fleetpro-final-recovery/
```

---

## Next Steps

1. **Execute Full Test Suite**
   ```bash
   cd /Users/pradeep/fleetpro-main-p0-fixed/fleetpro-main
   ./scripts/perf-baseline.sh
   ```

2. **Review Results**
   ```bash
   cat load-test/results/performance-report-*.json
   ```

3. **Identify Bottlenecks**
   - Review "Recommendations" section
   - Check database analysis for missing indexes
   - Check memory profile for leaks

4. **Implement Optimizations**
   - Add database indexes
   - Implement caching
   - Optimize slow queries
   - Fix memory leaks

5. **Re-run Tests**
   - Validate improvements
   - Measure performance gains
   - Document results

---

**Created**: 2026-08-15  
**Version**: 1.0  
**Status**: Ready for Execution

---

*Performance baseline infrastructure ready. Execute `./scripts/perf-baseline.sh` to begin testing.*
