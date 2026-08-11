/**
 * Performance Baseline Verification Script
 * Tests key endpoints under load and captures performance metrics
 *
 * Usage: tsx scripts/performance-baseline.ts
 * Output: JSON report with performance metrics and bottleneck analysis
 */

import fetch from "node-fetch";

interface EndpointMetrics {
  endpoint: string;
  method: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responseTimes: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number; // requests per second
  timestamp: string;
}

interface PerformanceBaselineReport {
  timestamp: string;
  serverUrl: string;
  configuration: {
    concurrentUsers: number;
    requestsPerEndpoint: number;
    testDuration: number;
  };
  endpoints: EndpointMetrics[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    overallThroughput: number;
    maxErrorRate: number;
    bottlenecks: string[];
  };
  recommendations: string[];
}

class PerformanceBaseline {
  private serverUrl: string;
  private concurrentUsers: number = 10; // Lower for local testing
  private requestsPerEndpoint: number = 100;
  private requestTimeout: number = 10000;
  private endpoints: Array<{
    path: string;
    method: string;
    name: string;
  }>;

  constructor() {
    this.serverUrl = process.env.SERVER_URL || "http://localhost:5050";
    this.endpoints = [
      { path: "/health", method: "GET", name: "Health Check" },
      { path: "/api/customers", method: "GET", name: "List Customers" },
      { path: "/api/users", method: "GET", name: "List Users" },
      { path: "/api/vehicles", method: "GET", name: "List Vehicles" },
      { path: "/api/bookings", method: "GET", name: "List Bookings" },
    ];
  }

  private async makeRequest(
    path: string,
    method: string
  ): Promise<{
    statusCode: number;
    responseTime: number;
    success: boolean;
  }> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.requestTimeout
      );

      const response = await fetch(`${this.serverUrl}${path}`, {
        method,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;

      return {
        statusCode: response.status,
        responseTime,
        success: response.status < 400,
      };
    } catch (error) {
      const responseTime = Date.now() - start;

      return {
        statusCode: 0,
        responseTime,
        success: false,
      };
    }
  }

  private calculateStats(values: number[]): {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / len,
      median: sorted[Math.floor(len / 2)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }

  async testEndpoint(
    path: string,
    method: string
  ): Promise<EndpointMetrics> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    let successCount = 0;
    let failCount = 0;

    console.log(
      `\n📊 Testing endpoint: ${method} ${path}`
    );
    console.log(
      `   Making ${this.requestsPerEndpoint} requests with ${this.concurrentUsers} concurrent users...`
    );

    // Simulate concurrent requests using Promise.all in batches
    const batchSize = this.concurrentUsers;
    const numBatches = Math.ceil(
      this.requestsPerEndpoint / batchSize
    );

    for (let b = 0; b < numBatches; b++) {
      const batchRequests = [];
      const remainingRequests = Math.min(
        batchSize,
        this.requestsPerEndpoint - b * batchSize
      );

      for (let i = 0; i < remainingRequests; i++) {
        batchRequests.push(
          this.makeRequest(path, method).then((result) => {
            responseTimes.push(result.responseTime);
            if (result.success) {
              successCount++;
            } else {
              failCount++;
            }
          })
        );
      }

      await Promise.all(batchRequests);

      // Progress indicator
      const progress = (
        (b + 1) /
        numBatches *
        100
      ).toFixed(0);
      process.stdout.write(`\r   Progress: ${progress}%`);
    }

    const testDuration = Date.now() - startTime;
    const stats = this.calculateStats(responseTimes);

    console.log(`\r   Progress: 100%`);
    console.log(`   Completed in ${testDuration}ms`);
    console.log(
      `   Success Rate: ${(
        (successCount / this.requestsPerEndpoint) *
        100
      ).toFixed(2)}%`
    );
    console.log(
      `   Avg Response Time: ${stats.avg.toFixed(2)}ms`
    );

    return {
      endpoint: path,
      method,
      totalRequests: this.requestsPerEndpoint,
      successfulRequests: successCount,
      failedRequests: failCount,
      responseTimes: stats,
      errorRate: (failCount / this.requestsPerEndpoint) * 100,
      throughput: (this.requestsPerEndpoint / testDuration) * 1000,
      timestamp: new Date().toISOString(),
    };
  }

  async run(): Promise<PerformanceBaselineReport> {
    console.log("📈 Performance Baseline Testing Starting...\n");
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Concurrent Users: ${this.concurrentUsers}`);
    console.log(
      `Requests per Endpoint: ${this.requestsPerEndpoint}`
    );
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const startTime = Date.now();
    const results: EndpointMetrics[] = [];

    // Test each endpoint
    for (const endpoint of this.endpoints) {
      try {
        const metrics = await this.testEndpoint(
          endpoint.path,
          endpoint.method
        );
        results.push(metrics);
      } catch (error: any) {
        console.error(
          `Error testing endpoint ${endpoint.path}: ${error.message}`
        );
      }
    }

    const testDuration = Date.now() - startTime;

    // Calculate summary
    const totalRequests = results.reduce(
      (sum, r) => sum + r.totalRequests,
      0
    );
    const successfulRequests = results.reduce(
      (sum, r) => sum + r.successfulRequests,
      0
    );
    const failedRequests = results.reduce(
      (sum, r) => sum + r.failedRequests,
      0
    );

    const allResponseTimes: number[] = [];
    for (const result of results) {
      // Reconstruct response times array for percentile calculation
      // This is approximate, using p95 and p99 from individual endpoints
      for (let i = 0; i < result.totalRequests * 0.1; i++) {
        allResponseTimes.push(result.responseTimes.avg);
      }
    }

    const overallStats = this.calculateStats(allResponseTimes);

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    const avgResponseTimes = results.map((r) => r.responseTimes.avg);
    const maxAvgTime = Math.max(...avgResponseTimes);

    results.forEach((result) => {
      if (result.responseTimes.avg > maxAvgTime * 0.8) {
        bottlenecks.push(
          `${result.endpoint} (${result.responseTimes.avg.toFixed(
            2
          )}ms avg)`
        );
      }

      if (result.errorRate > 5) {
        bottlenecks.push(
          `${result.endpoint} has high error rate (${result.errorRate.toFixed(
            2
          )}%)`
        );
      }
    });

    const maxErrorRate = Math.max(
      ...results.map((r) => r.errorRate)
    );

    const recommendations: string[] = [];

    if (overallStats.avg > 500) {
      recommendations.push(
        "Average response time is high. Consider optimizing database queries and caching."
      );
    }

    if (maxErrorRate > 5) {
      recommendations.push(
        "Error rate is above acceptable threshold. Review error logs and stability."
      );
    }

    if (bottlenecks.length > 0) {
      recommendations.push(
        `Investigate slow endpoints: ${bottlenecks.join(", ")}`
      );
    }

    if (overallStats.p99 > 2000) {
      recommendations.push(
        "P99 response time is very high. Investigate tail latency issues."
      );
    }

    recommendations.push(
      "Establish performance baselines for continuous monitoring."
    );
    recommendations.push(
      "Set up alerting for response times and error rates."
    );

    const report: PerformanceBaselineReport = {
      timestamp: new Date().toISOString(),
      serverUrl: this.serverUrl,
      configuration: {
        concurrentUsers: this.concurrentUsers,
        requestsPerEndpoint: this.requestsPerEndpoint,
        testDuration,
      },
      endpoints: results,
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        averageResponseTime: overallStats.avg,
        p95ResponseTime: overallStats.p95,
        p99ResponseTime: overallStats.p99,
        overallThroughput: (totalRequests / testDuration) * 1000,
        maxErrorRate,
        bottlenecks,
      },
      recommendations,
    };

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 PERFORMANCE BASELINE SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Successful: ${successfulRequests}`);
    console.log(`Failed: ${failedRequests}`);
    console.log(`Success Rate: ${(
      (successfulRequests / totalRequests) *
      100
    ).toFixed(2)}%`);
    console.log(
      `\nResponse Times (ms):`
    );
    console.log(`  Min: ${overallStats.min.toFixed(2)}`);
    console.log(`  Avg: ${overallStats.avg.toFixed(2)}`);
    console.log(`  P95: ${overallStats.p95.toFixed(2)}`);
    console.log(`  P99: ${overallStats.p99.toFixed(2)}`);
    console.log(`  Max: ${overallStats.max.toFixed(2)}`);
    console.log(
      `\nThroughput: ${report.summary.overallThroughput.toFixed(
        2
      )} req/sec`
    );

    if (bottlenecks.length > 0) {
      console.log(`\n⚠️  Bottlenecks Identified:`);
      bottlenecks.forEach((b) => console.log(`  - ${b}`));
    }

    if (recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    }

    console.log("=".repeat(60) + "\n");

    return report;
  }
}

async function main() {
  try {
    const baseline = new PerformanceBaseline();
    const report = await baseline.run();

    // Output JSON report
    console.log("📄 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Fatal error during performance baseline:", error);
    process.exit(1);
  }
}

main();
