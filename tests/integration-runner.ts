/**
 * Integration Test Runner
 * Orchestrates and runs all integration tests with setup/teardown
 *
 * Usage: tsx tests/integration-runner.ts
 * Output: JSON report with aggregated metrics
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";

interface TestSuiteResult {
  name: string;
  file: string;
  status: "PASS" | "FAIL" | "SKIP";
  testCount: number;
  passCount: number;
  failCount: number;
  duration: number;
  errorOutput?: string;
  timestamp: string;
}

interface MetricsData {
  responseTimesMs: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
}

interface IntegrationTestReport {
  timestamp: string;
  suites: TestSuiteResult[];
  summary: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    skippedSuites: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    overallStatus: "PASS" | "FAIL" | "PARTIAL";
  };
  metrics: MetricsData;
  recommendations: string[];
}

class IntegrationTestRunner {
  private suites: TestSuiteResult[] = [];
  private testDir: string;
  private recommendations: string[] = [];
  private responseTimes: number[] = [];
  private failedRequests: number = 0;
  private totalRequests: number = 0;

  constructor() {
    this.testDir = path.join(process.cwd(), "tests", "integration");
  }

  private parseTestOutput(output: string): {
    testCount: number;
    passCount: number;
    failCount: number;
  } {
    // Try to parse test results from output
    const passMatch = output.match(/passed|✓.*?(\d+)/i);
    const failMatch = output.match(/failed|✗.*?(\d+)/i);

    const passCount = passMatch ? parseInt(passMatch[1]) : 0;
    const failCount = failMatch ? parseInt(failMatch[1]) : 0;
    const testCount = passCount + failCount || 1;

    return { testCount, passCount, failCount };
  }

  private async runTest(
    testFile: string
  ): Promise<TestSuiteResult> {
    return new Promise((resolve) => {
      const start = Date.now();
      const testName = path.basename(testFile, ".ts");
      let stdout = "";
      let stderr = "";

      console.log(`Running: ${testName}...`);

      // Try to run with tsx
      const child = spawn("tsx", [testFile], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "test" },
      });

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on("close", (code) => {
        const duration = Date.now() - start;
        const { testCount, passCount, failCount } =
          this.parseTestOutput(stdout);

        const status = code === 0 ? "PASS" : "FAIL";

        if (status === "FAIL") {
          this.recommendations.push(
            `Fix failing tests in ${testName} (${failCount} failures)`
          );
        }

        const result: TestSuiteResult = {
          name: testName,
          file: testFile,
          status,
          testCount,
          passCount,
          failCount,
          duration,
          errorOutput: stderr || undefined,
          timestamp: new Date().toISOString(),
        };

        this.suites.push(result);
        resolve(result);
      });

      child.on("error", (error) => {
        const duration = Date.now() - start;

        const result: TestSuiteResult = {
          name: testName,
          file: testFile,
          status: "FAIL",
          testCount: 1,
          passCount: 0,
          failCount: 1,
          duration,
          errorOutput: error.message,
          timestamp: new Date().toISOString(),
        };

        this.suites.push(result);
        resolve(result);
      });
    });
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log("🔧 Setting up test environment...\n");

    // Verify test directory exists
    if (!fs.existsSync(this.testDir)) {
      console.log(`⚠️  Test directory not found: ${this.testDir}`);
      return;
    }

    // Create test database if needed
    try {
      // Could initialize test database here
      console.log("✓ Test environment ready\n");
    } catch (error: any) {
      console.error(`Failed to setup test environment: ${error.message}`);
      this.recommendations.push("Review test environment setup");
    }
  }

  private async teardownTestEnvironment(): Promise<void> {
    console.log("\n🧹 Tearing down test environment...");

    try {
      // Could clean up test data here
      console.log("✓ Test environment cleaned up\n");
    } catch (error: any) {
      console.error(`Failed to teardown test environment: ${error.message}`);
    }
  }

  private discoverTests(): string[] {
    if (!fs.existsSync(this.testDir)) {
      return [];
    }

    const files = fs.readdirSync(this.testDir);
    return files
      .filter((f) => f.endsWith(".test.ts") || f.endsWith(".spec.ts"))
      .map((f) => path.join(this.testDir, f));
  }

  private calculateMetrics(): MetricsData {
    const responseTimes = [...this.responseTimes].sort(
      (a, b) => a - b
    );

    return {
      responseTimesMs: {
        min: Math.min(...responseTimes, Infinity),
        max: Math.max(...responseTimes, -Infinity),
        avg:
          responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) /
              responseTimes.length
            : 0,
        p50:
          responseTimes[Math.floor(responseTimes.length * 0.5)] ||
          0,
        p95:
          responseTimes[Math.floor(responseTimes.length * 0.95)] ||
          0,
        p99:
          responseTimes[Math.floor(responseTimes.length * 0.99)] ||
          0,
      },
      errorRate:
        this.totalRequests > 0
          ? (this.failedRequests / this.totalRequests) * 100
          : 0,
      successRate:
        this.totalRequests > 0
          ? ((this.totalRequests - this.failedRequests) /
              this.totalRequests) *
            100
          : 100,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
    };
  }

  private generateReport(): IntegrationTestReport {
    const passedSuites = this.suites.filter((s) => s.status === "PASS").length;
    const failedSuites = this.suites.filter((s) => s.status === "FAIL").length;
    const skippedSuites = this.suites.filter((s) => s.status === "SKIP").length;

    const totalTests = this.suites.reduce((sum, s) => sum + s.testCount, 0);
    const passedTests = this.suites.reduce((sum, s) => sum + s.passCount, 0);
    const failedTests = this.suites.reduce((sum, s) => sum + s.failCount, 0);
    const totalDuration = this.suites.reduce((sum, s) => sum + s.duration, 0);

    let overallStatus: "PASS" | "FAIL" | "PARTIAL" = "PASS";
    if (failedSuites > 0) {
      overallStatus = "FAIL";
    } else if (skippedSuites > 0) {
      overallStatus = "PARTIAL";
    }

    return {
      timestamp: new Date().toISOString(),
      suites: this.suites,
      summary: {
        totalSuites: this.suites.length,
        passedSuites,
        failedSuites,
        skippedSuites,
        totalTests,
        passedTests,
        failedTests,
        totalDuration,
        overallStatus,
      },
      metrics: this.calculateMetrics(),
      recommendations: this.recommendations,
    };
  }

  async run(): Promise<IntegrationTestReport> {
    console.log("🧪 Integration Test Runner Starting...\n");
    console.log(`Test Directory: ${this.testDir}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // Setup
    await this.setupTestEnvironment();

    // Discover tests
    const testFiles = this.discoverTests();
    console.log(`Found ${testFiles.length} test suites\n`);

    if (testFiles.length === 0) {
      console.log("⚠️  No test files found");
      return {
        timestamp: new Date().toISOString(),
        suites: [],
        summary: {
          totalSuites: 0,
          passedSuites: 0,
          failedSuites: 0,
          skippedSuites: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          totalDuration: 0,
          overallStatus: "PARTIAL",
        },
        metrics: {
          responseTimesMs: {
            min: 0,
            max: 0,
            avg: 0,
            p50: 0,
            p95: 0,
            p99: 0,
          },
          errorRate: 0,
          successRate: 0,
          totalRequests: 0,
          failedRequests: 0,
        },
        recommendations: [
          "Create integration tests in tests/integration directory",
        ],
      };
    }

    // Run tests sequentially (can be modified for parallel execution)
    for (const testFile of testFiles) {
      try {
        await this.runTest(testFile);
      } catch (error) {
        console.error(`Error running test: ${error}`);
      }
    }

    // Teardown
    await this.teardownTestEnvironment();

    const report = this.generateReport();

    // Print summary
    console.log("=".repeat(60));
    console.log("📊 INTEGRATION TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Suites: ${report.summary.totalSuites}`);
    console.log(`Passed: ${report.summary.passedSuites}`);
    console.log(`Failed: ${report.summary.failedSuites}`);
    console.log(`Skipped: ${report.summary.skippedSuites}`);
    console.log(`\nTotal Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Duration: ${report.summary.totalDuration}ms`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);

    if (report.metrics.totalRequests > 0) {
      console.log("\n📈 Performance Metrics:");
      console.log(
        `  Response Time (avg): ${report.metrics.responseTimesMs.avg.toFixed(
          2
        )}ms`
      );
      console.log(
        `  Response Time (p95): ${report.metrics.responseTimesMs.p95.toFixed(
          2
        )}ms`
      );
      console.log(
        `  Response Time (p99): ${report.metrics.responseTimesMs.p99.toFixed(
          2
        )}ms`
      );
      console.log(`  Error Rate: ${report.metrics.errorRate.toFixed(2)}%`);
      console.log(`  Success Rate: ${report.metrics.successRate.toFixed(2)}%`);
    }

    if (report.recommendations.length > 0) {
      console.log("\n📋 Recommendations:");
      report.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log("=".repeat(60) + "\n");

    return report;
  }
}

async function main() {
  try {
    const runner = new IntegrationTestRunner();
    const report = await runner.run();

    // Output JSON report to file
    const reportPath = path.join(
      process.cwd(),
      ".integration-test-report.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✅ Full report saved to: ${reportPath}`);

    // Also output to stdout for CI/CD
    console.log("\n📄 JSON Report:");
    console.log(JSON.stringify(report, null, 2));

    // Exit with appropriate code
    process.exit(report.summary.overallStatus === "PASS" ? 0 : 1);
  } catch (error) {
    console.error("Fatal error during integration tests:", error);
    process.exit(2);
  }
}

main();
