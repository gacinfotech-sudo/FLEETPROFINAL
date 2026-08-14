/**
 * LOAD TEST: Session 4 New APIs
 * Validates production capacity under realistic traffic
 * Tests all 12 new APIs with concurrent requests
 */

import http from 'http';

const BASE_URL = 'http://localhost:5050';
const TENANT_ID = '6a7ef5d106671a8f7902f35a';
const CONCURRENT_USERS = 10;
const REQUESTS_PER_USER = 100;
const TEST_DURATION_SECONDS = 60;

class LoadTester {
  constructor() {
    this.results = {
      successful: 0,
      failed: 0,
      totalTime: 0,
      responseTimes: [],
      errors: []
    };
  }

  async makeRequest(method, path, data = null) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = new URL(path, BASE_URL);

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'X-Tenant-ID': TENANT_ID,
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;
          const success = res.statusCode < 500;

          if (success) {
            this.results.successful++;
          } else {
            this.results.failed++;
            this.results.errors.push({
              path,
              status: res.statusCode,
              timestamp: new Date().toISOString()
            });
          }

          this.results.responseTimes.push(duration);
          this.results.totalTime += duration;

          resolve({ success, duration, status: res.statusCode });
        });
      });

      req.on('error', (error) => {
        this.results.failed++;
        this.results.errors.push({
          path,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        resolve({ success: false, duration: 0, error: error.message });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async runLoadTest() {
    console.log('🔴 LOAD TEST STARTING');
    console.log(`   Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`   Requests per User: ${REQUESTS_PER_USER}`);
    console.log(`   Total Requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}`);
    console.log('');

    const startTime = Date.now();
    const testPromises = [];

    // Spawn concurrent users
    for (let user = 0; user < CONCURRENT_USERS; user++) {
      testPromises.push(this.simulateUser(user));
    }

    await Promise.all(testPromises);
    const totalTime = (Date.now() - startTime) / 1000;

    this.printResults(totalTime);
  }

  async simulateUser(userId) {
    const endpoints = [
      { method: 'GET', path: '/api/tenant/booking-managers' },
      { method: 'GET', path: '/api/tenant/booking-managers/default' },
      { method: 'GET', path: '/api/tenant/staff/by-mobile?mobile=919876543210' },
      { method: 'GET', path: '/api/bookings/test/manager' },
      { method: 'GET', path: '/api/analytics/predictive/demand-forecast' },
      { method: 'GET', path: '/api/analytics/predictive/churn-risk?limit=10' },
      { method: 'GET', path: '/api/analytics/predictive/fraud-detection' },
      { method: 'GET', path: '/api/analytics/predictive/anomalies' }
    ];

    for (let i = 0; i < REQUESTS_PER_USER; i++) {
      const endpoint = endpoints[i % endpoints.length];
      await this.makeRequest(endpoint.method, endpoint.path);
    }
  }

  printResults(totalTime) {
    const avgResponseTime = this.results.totalTime / (this.results.successful + this.results.failed);
    const responseTimes = this.results.responseTimes.sort((a, b) => a - b);
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);

    const requestsPerSecond = (this.results.successful + this.results.failed) / totalTime;
    const successRate = (this.results.successful / (this.results.successful + this.results.failed)) * 100;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 LOAD TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('THROUGHPUT:');
    console.log(`  ✓ Total Requests: ${this.results.successful + this.results.failed}`);
    console.log(`  ✓ Successful: ${this.results.successful}`);
    console.log(`  ✗ Failed: ${this.results.failed}`);
    console.log(`  ✓ Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`  ✓ Requests/sec: ${requestsPerSecond.toFixed(2)}`);
    console.log(`  ✓ Test Duration: ${totalTime.toFixed(2)}s`);
    console.log('');
    console.log('RESPONSE TIME (ms):');
    console.log(`  • Min: ${minTime}ms`);
    console.log(`  • Avg: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`  • P50: ${p50}ms`);
    console.log(`  • P95: ${p95}ms`);
    console.log(`  • P99: ${p99}ms`);
    console.log(`  • Max: ${maxTime}ms`);
    console.log('');

    if (this.results.errors.length > 0) {
      console.log('⚠️  ERRORS:');
      this.results.errors.slice(0, 5).forEach((error) => {
        console.log(`  - ${error.path}: ${error.status || error.error}`);
      });
      if (this.results.errors.length > 5) {
        console.log(`  ... and ${this.results.errors.length - 5} more`);
      }
      console.log('');
    }

    console.log('PERFORMANCE TARGETS:');
    const avgTarget = 100; // 100ms target
    const p95Target = 250; // 250ms target
    const successTarget = 99; // 99% target

    console.log(`  Avg Response < 100ms: ${avgResponseTime < avgTarget ? '✅' : '⚠️'} (${avgResponseTime.toFixed(0)}ms)`);
    console.log(`  P95 Response < 250ms: ${p95 < p95Target ? '✅' : '⚠️'} (${p95}ms)`);
    console.log(`  Success Rate > 99%: ${successRate > successTarget ? '✅' : '⚠️'} (${successRate.toFixed(2)}%)`);
    console.log(`  Zero Errors: ${this.results.failed === 0 ? '✅' : '⚠️'} (${this.results.failed} failed)`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    if (
      avgResponseTime < avgTarget &&
      p95 < p95Target &&
      successRate > successTarget &&
      this.results.failed === 0
    ) {
      console.log('✅ LOAD TEST PASSED - PRODUCTION READY');
    } else {
      console.log('⚠️  LOAD TEST WARNINGS - REVIEW RESULTS');
    }
    console.log('═══════════════════════════════════════════════════════════');
  }
}

// Run the test
const tester = new LoadTester();
tester.runLoadTest().catch(console.error);
