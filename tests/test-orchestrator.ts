/**
 * FLEETPRO TEST ORCHESTRATOR
 *
 * Master orchestration for comprehensive testing:
 * - Coordinates all 1000+ checks
 * - Manages test execution and reporting
 * - Generates detailed analytics
 * - Provides recommendations
 * - Enables continuous integration
 *
 * Usage: tsx tests/test-orchestrator.ts
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface TestSuiteExecution {
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "RUNNING" | "PASSED" | "FAILED" | "SKIPPED";
  testCount?: number;
  passCount?: number;
  failCount?: number;
  output?: string;
  errors?: string[];
}

interface OrchestratorReport {
  timestamp: string;
  totalDuration: number;
  suites: TestSuiteExecution[];
  statistics: {
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    checkCoverage: number;
  };
  recommendations: string[];
  readinessScore: number;
  deploymentRecommendation: "APPROVED" | "APPROVED_WITH_CAUTION" | "REJECTED";
}

class TestOrchestrator {
  private suites: TestSuiteExecution[] = [];
  private startTime: Date;
  private reportDir: string;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.startTime = new Date();
    this.reportDir = path.join(process.cwd(), "reports");
    this.verbose = verbose;

    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  private log(message: string) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  private async runTestSuite(
    name: string,
    command: string,
    args: string[] = []
  ): Promise<TestSuiteExecution> {
    this.log(`🚀 Starting ${name}...`);

    const suite: TestSuiteExecution = {
      name,
      startTime: new Date().toISOString(),
      status: "RUNNING",
      errors: [],
    };

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";

      const child = spawn(command, args, {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "test" },
      });

      child.stdout?.on("data", (data) => {
        const output = data.toString();
        stdout += output;

        if (this.verbose) {
          process.stdout.write(output);
        }
      });

      child.stderr?.on("data", (data) => {
        const output = data.toString();
        stderr += output;

        if (this.verbose) {
          process.stderr.write(output);
        }
      });

      child.on("close", (code) => {
        const endTime = new Date();
        const duration = endTime.getTime() - new Date(suite.startTime).getTime();

        suite.endTime = endTime.toISOString();
        suite.duration = duration;
        suite.output = stdout;
        suite.status = code === 0 ? "PASSED" : "FAILED";

        if (code !== 0 && stderr) {
          suite.errors = stderr.split("\n").filter((line) => line.trim());
        }

        // Try to parse test results
        const passMatch = stdout.match(/Passed:\s*(\d+)/);
        const failMatch = stdout.match(/Failed:\s*(\d+)/);
        const totalMatch = stdout.match(/Total Tests:\s*(\d+)/);

        if (passMatch) suite.passCount = parseInt(passMatch[1]);
        if (failMatch) suite.failCount = parseInt(failMatch[1]);
        if (totalMatch) suite.testCount = parseInt(totalMatch[1]);

        this.log(
          `✅ Completed ${name}: ${suite.status} (${duration}ms)`
        );

        resolve(suite);
      });
    });
  }

  private async runAutonomousFramework(): Promise<TestSuiteExecution> {
    return this.runTestSuite(
      "Autonomous Framework (1000+ checks)",
      "tsx",
      ["tests/autonomous-framework.ts"]
    );
  }

  private async runSmokeTests(): Promise<TestSuiteExecution> {
    return this.runTestSuite("Smoke Tests", "tsx", ["tests/smoke.test.ts"]);
  }

  private async runIntegrationTests(): Promise<TestSuiteExecution> {
    return this.runTestSuite(
      "Integration Tests",
      "tsx",
      ["tests/integration-runner.ts"]
    );
  }

  private async runSecurityTests(): Promise<TestSuiteExecution> {
    return this.runTestSuite(
      "Security Tests",
      "tsx",
      ["tests/integration/security.test.ts"]
    );
  }

  private async runPerformanceTests(): Promise<TestSuiteExecution> {
    return this.runTestSuite(
      "Performance Tests",
      "tsx",
      ["tests/integration/performance.test.ts"]
    );
  }

  private async runDatabaseTests(): Promise<TestSuiteExecution> {
    return this.runTestSuite(
      "Database Tests",
      "tsx",
      ["tests/integration/database.test.ts"]
    );
  }

  private async runUITests(): Promise<TestSuiteExecution> {
    // Run Playwright E2E tests
    return this.runTestSuite("E2E UI Tests", "npm", ["run", "test:e2e"]);
  }

  private calculateReadinessScore(): number {
    if (this.suites.length === 0) return 0;

    const passedSuites = this.suites.filter(
      (s) => s.status === "PASSED"
    ).length;
    const totalTests = this.suites.reduce(
      (sum, s) => sum + (s.testCount || 0),
      0
    );
    const passedTests = this.suites.reduce(
      (sum, s) => sum + (s.passCount || 0),
      0
    );

    const suiteScore = (passedSuites / this.suites.length) * 50; // 50% weight
    const testScore = totalTests > 0 ? (passedTests / totalTests) * 50 : 0; // 50% weight

    return Math.round(suiteScore + testScore);
  }

  private getDeploymentRecommendation(): "APPROVED" | "APPROVED_WITH_CAUTION" | "REJECTED" {
    const failedSuites = this.suites.filter(
      (s) => s.status === "FAILED"
    ).length;
    const score = this.calculateReadinessScore();

    if (failedSuites === 0 && score >= 95) {
      return "APPROVED";
    } else if (failedSuites <= 1 && score >= 85) {
      return "APPROVED_WITH_CAUTION";
    } else {
      return "REJECTED";
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedSuites = this.suites.filter((s) => s.status === "FAILED");

    if (failedSuites.length > 0) {
      recommendations.push(
        `${failedSuites.length} test suite(s) failed. Review and fix before deployment.`
      );

      for (const suite of failedSuites) {
        if (suite.errors && suite.errors.length > 0) {
          recommendations.push(
            `  - ${suite.name}: ${suite.errors[0].substring(0, 100)}`
          );
        }
      }
    }

    const totalTests = this.suites.reduce(
      (sum, s) => sum + (s.testCount || 0),
      0
    );
    if (totalTests < 1000) {
      recommendations.push(
        `Test coverage below target (${totalTests} < 1000 checks)`
      );
    }

    const score = this.calculateReadinessScore();
    if (score < 90) {
      recommendations.push(
        `Readiness score ${score}/100 below optimal (target >= 90)`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "✅ All checks passed - system is production-ready"
      );
    }

    return recommendations;
  }

  private generateReport(): OrchestratorReport {
    const totalDuration = Date.now() - this.startTime.getTime();
    const passedSuites = this.suites.filter(
      (s) => s.status === "PASSED"
    ).length;
    const failedSuites = this.suites.filter(
      (s) => s.status === "FAILED"
    ).length;
    const totalChecks = this.suites.reduce(
      (sum, s) => sum + (s.testCount || 0),
      0
    );
    const passedChecks = this.suites.reduce(
      (sum, s) => sum + (s.passCount || 0),
      0
    );
    const failedChecks = this.suites.reduce(
      (sum, s) => sum + (s.failCount || 0),
      0
    );

    return {
      timestamp: new Date().toISOString(),
      totalDuration,
      suites: this.suites,
      statistics: {
        totalSuites: this.suites.length,
        passedSuites,
        failedSuites,
        totalChecks,
        passedChecks,
        failedChecks,
        checkCoverage: ((passedChecks / totalChecks) * 100) || 0,
      },
      recommendations: this.generateRecommendations(),
      readinessScore: this.calculateReadinessScore(),
      deploymentRecommendation: this.getDeploymentRecommendation(),
    };
  }

  private printReport(report: OrchestratorReport) {
    console.log("\n" + "╔" + "═".repeat(78) + "╗");
    console.log("║" + " FLEETPRO TEST ORCHESTRATION REPORT ".padStart(79) + "║");
    console.log("╠" + "═".repeat(78) + "╣");
    console.log(
      `║ Timestamp: ${report.timestamp}`.padEnd(79) + "║"
    );
    console.log(
      `║ Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`.padEnd(
        79
      ) + "║"
    );
    console.log(
      `║ Readiness Score: ${report.readinessScore}/100`.padEnd(79) + "║"
    );
    console.log(
      `║ Deployment: ${report.deploymentRecommendation}`.padEnd(79) + "║"
    );
    console.log("╠" + "═".repeat(78) + "╣");
    console.log("║ TEST SUITES:".padEnd(79) + "║");

    for (const suite of report.suites) {
      const icon = suite.status === "PASSED" ? "✅" : "❌";
      const details =
        suite.testCount && suite.passCount && suite.failCount
          ? ` (${suite.passCount}/${suite.testCount})`
          : "";

      console.log(
        `║ ${icon} ${suite.name.padEnd(50)} ${suite.status.padEnd(10)} ${details}`.padEnd(79) +
          "║"
      );
    }

    console.log("╠" + "═".repeat(78) + "╣");
    console.log("║ STATISTICS:".padEnd(79) + "║");
    console.log(
      `║   Total Suites: ${report.statistics.totalSuites.toString().padStart(6)} │ Passed: ${report.statistics.passedSuites.toString().padStart(4)} │ Failed: ${report.statistics.failedSuites.toString().padStart(4)}`.padEnd(
        79
      ) + "║"
    );
    console.log(
      `║   Total Checks: ${report.statistics.totalChecks.toString().padStart(6)} │ Passed: ${report.statistics.passedChecks.toString().padStart(4)} │ Failed: ${report.statistics.failedChecks.toString().padStart(4)}`.padEnd(
        79
      ) + "║"
    );
    console.log(
      `║   Coverage: ${report.statistics.checkCoverage.toFixed(1)}%`.padEnd(79) +
        "║"
    );
    console.log("╠" + "═".repeat(78) + "╣");
    console.log("║ RECOMMENDATIONS:".padEnd(79) + "║");

    for (const rec of report.recommendations.slice(0, 5)) {
      const lines = this.wrapText(rec, 75);
      for (let i = 0; i < lines.length; i++) {
        const prefix = i === 0 ? "  • " : "    ";
        console.log(
          `║ ${(prefix + lines[i]).padEnd(77)}`.padEnd(79) + "║"
        );
      }
    }

    console.log("╚" + "═".repeat(78) + "╝");
  }

  private wrapText(text: string, width: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length > width) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += (currentLine ? " " : "") + word;
      }
    }

    if (currentLine) lines.push(currentLine.trim());
    return lines;
  }

  private saveReport(report: OrchestratorReport) {
    const reportPath = path.join(
      this.reportDir,
      `orchestrator-${Date.now()}.json`
    );

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`📄 Report saved to: ${reportPath}`);

    return reportPath;
  }

  async run(): Promise<OrchestratorReport> {
    this.log("🎯 FleetPro Test Orchestration Started");
    this.log(`📦 Running comprehensive test suites...\n`);

    // Run test suites sequentially
    this.suites.push(
      await this.runAutonomousFramework()
    );
    this.suites.push(await this.runSmokeTests());
    this.suites.push(await this.runIntegrationTests());
    // this.suites.push(await this.runSecurityTests());
    // this.suites.push(await this.runPerformanceTests());
    // this.suites.push(await this.runDatabaseTests());
    // Optionally run E2E tests
    // this.suites.push(await this.runUITests());

    const report = this.generateReport();
    this.printReport(report);
    this.saveReport(report);

    this.log("\n✅ Test Orchestration Complete");

    return report;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const verbose = process.argv.includes("--verbose");

  try {
    const orchestrator = new TestOrchestrator(verbose);
    const report = await orchestrator.run();

    // Exit with appropriate code
    process.exit(
      report.deploymentRecommendation === "APPROVED"
        ? 0
        : report.deploymentRecommendation === "APPROVED_WITH_CAUTION"
          ? 1
          : 2
    );
  } catch (error) {
    console.error("Fatal error in test orchestration:", error);
    process.exit(3);
  }
}

main();
